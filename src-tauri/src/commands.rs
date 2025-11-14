use std::collections::hash_map::DefaultHasher;
use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use chrono::{Datelike, NaiveDate, Utc};
use once_cell::sync::Lazy;

use crate::models::{DiaryEntry, EntryRecord};

/// 内存缓存，Key 使用标准化后的 YYYY-MM-DD，以支持 get/list/save 的快速查询。
static STORE: Lazy<Mutex<HashMap<String, EntryRecord>>> = Lazy::new(|| {
    let map = HashMap::new();
    Mutex::new(map)
});

/// 列出指定年月的日记条目摘要（仅 frontmatter，不含正文）
///
/// 与前端 `list_entries_by_month(year, month)` 对应。
///
/// 参数：
/// - year: 年份（如 2025）
/// - month: 月份（1-12，自然月）
#[tauri::command]
pub async fn list_entries_by_month(year: u16, month: u8) -> Result<Vec<DiaryEntry>, String> {
    // 校验月份范围，避免前端或调用者传入非法参数后导致日期解析 panic。
    if !(1..=12).contains(&month) {
        return Err(format!("month must be between 1 and 12 (got {month})"));
    }

    let year = year as i32;
    let month = month as u32;

    let store = STORE
        .lock()
        .map_err(|_| "failed to lock in-memory store".to_string())?;

    let mut entries = store
        .values()
        .filter_map(|record| {
            // 以元数据中的日期字段为依据，忽略非法格式。
            match parse_date(&record.summary().date) {
                Ok(date) if date.year() == year && date.month() == month => {
                    Some(record.summary().clone())
                }
                _ => None,
            }
        })
        .collect::<Vec<_>>();

    entries.sort_by(|a, b| match a.date.cmp(&b.date) {
        std::cmp::Ordering::Equal => a.hlc.cmp(&b.hlc),
        other => other,
    });

    Ok(entries)
}

/// 按日期获取日记正文内容
///
/// 与前端 `get_entry_body(date)` 对应，返回正文 Markdown 字符串或 null。
///
/// 参数：
/// - date: YYYY-MM-DD
#[tauri::command]
pub async fn get_entry_body_by_date(date: String) -> Result<Option<String>, String> {
    // 统一日期格式为 %Y-%m-%d，方便与 STORE 中的 key 对比。
    let normalized_date = normalize_date(&date)?;
    let store = STORE
        .lock()
        .map_err(|_| "failed to lock in-memory store".to_string())?;

    Ok(store
        .get(&normalized_date)
        .map(|record| record.body().to_string()))
}

/// 根据日期保存/更新日记内容
///
/// 与前端 `saveEntryByDate(date, body)` 对应，返回最新的摘要信息。
///
/// 参数：
/// - date: 日期（YYYY-MM-DD）
/// - body: 正文内容（Markdown）
#[tauri::command]
pub async fn save_entry_by_date(date: String, body: String) -> Result<DiaryEntry, String> {
    // 标准化日期后才写入 Map，确保多种格式都能正确聚合。
    let normalized_date = normalize_date(&date)?;

    let mut store = STORE
        .lock()
        .map_err(|_| "failed to lock in-memory store".to_string())?;

    let summary = if let Some(record) = store.get_mut(&normalized_date) {
        let summary = build_summary(Some(record.summary()), &normalized_date, &body);
        record.update(summary.clone(), body.clone());
        summary
    } else {
        let summary = build_summary(None, &normalized_date, &body);
        store.insert(
            normalized_date.clone(),
            EntryRecord::new(summary.clone(), body),
        );
        summary
    };

    Ok(summary)
}

const DATE_FORMAT: &str = "%Y-%m-%d";

static DEVICE_ID: Lazy<String> = Lazy::new(resolve_device_id);
static LOGICAL_COUNTER: AtomicU64 = AtomicU64::new(0);

/// 尝试按照固定格式解析日期，错误信息中包含原始输入，方便前端调试。
fn parse_date(date: &str) -> Result<NaiveDate, String> {
    NaiveDate::parse_from_str(date, DATE_FORMAT)
        .map_err(|err| format!("invalid date \"{date}\": {err}"))
}

/// 返回标准 YYYY-MM-DD 字符串，持久化 key 与排序都依赖该结果。
fn normalize_date(date: &str) -> Result<String, String> {
    Ok(parse_date(date)?.format(DATE_FORMAT).to_string())
}

fn build_summary(existing: Option<&DiaryEntry>, date: &str, body: &str) -> DiaryEntry {
    DiaryEntry {
        hlc: existing
            .map(|entry| entry.hlc.clone())
            .unwrap_or_else(next_hlc),
        hash: fingerprint(body),
        date: date.to_string(),
        emoji: existing.and_then(|entry| entry.emoji.clone()),
        ai_summary: summarize_body(body),
        language: detect_language(body),
    }
}

fn next_hlc() -> String {
    let timestamp = Utc::now().timestamp_millis();
    let logical = LOGICAL_COUNTER.fetch_add(1, Ordering::SeqCst);
    format!("{timestamp}-{logical}-{}", DEVICE_ID.as_str())
}

fn resolve_device_id() -> String {
    std::env::var("HOSTNAME")
        .or_else(|_| std::env::var("COMPUTERNAME"))
        .unwrap_or_else(|_| "echonote".to_string())
}

fn fingerprint(body: &str) -> String {
    let mut hasher = DefaultHasher::new();
    body.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

fn summarize_body(body: &str) -> Option<String> {
    let trimmed = body.trim();
    if trimmed.is_empty() {
        return None;
    }

    const LIMIT: usize = 120;
    let mut summary = String::new();
    let mut count = 0;
    let mut truncated = false;

    for ch in trimmed.chars() {
        if count >= LIMIT {
            truncated = true;
            break;
        }
        let normalized = match ch {
            '\n' | '\r' => ' ',
            _ => ch,
        };
        summary.push(normalized);
        count += 1;
    }

    if truncated {
        summary.push_str("...");
    }

    Some(summary)
}

fn detect_language(body: &str) -> Option<String> {
    let trimmed = body.trim();
    if trimmed.is_empty() {
        return None;
    }

    let total = trimmed.chars().count();
    if total == 0 {
        return None;
    }

    let ascii_letters = trimmed
        .chars()
        .filter(|ch| ch.is_ascii_alphabetic())
        .count();
    let ratio = ascii_letters as f32 / total as f32;
    if ratio > 0.6 {
        Some("en".to_string())
    } else {
        Some("zh".to_string())
    }
}
