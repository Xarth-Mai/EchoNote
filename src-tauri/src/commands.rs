use std::collections::HashMap;
use std::sync::Mutex;

use chrono::{Datelike, NaiveDate};
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
/// 与前端 `saveEntryByDate(summary, body)` 对应。
///
/// 参数：
/// - entry: 日记元数据（frontmatter）
/// - body: 正文内容（Markdown）
#[tauri::command]
pub async fn save_entry_by_date(mut entry: DiaryEntry, body: String) -> Result<(), String> {
    // 标准化日期后才写入 Map，确保多种格式都能正确聚合。
    let normalized_date = normalize_date(&entry.date)?;
    entry.date = normalized_date.clone();

    let mut store = STORE
        .lock()
        .map_err(|_| "failed to lock in-memory store".to_string())?;

    match store.get_mut(&normalized_date) {
        Some(record) => {
            record.update(entry, body);
        }
        None => {
            store.insert(normalized_date, EntryRecord::new(entry, body));
        }
    };

    Ok(())
}

const DATE_FORMAT: &str = "%Y-%m-%d";

/// 尝试按照固定格式解析日期，错误信息中包含原始输入，方便前端调试。
fn parse_date(date: &str) -> Result<NaiveDate, String> {
    NaiveDate::parse_from_str(date, DATE_FORMAT)
        .map_err(|err| format!("invalid date \"{date}\": {err}"))
}

/// 返回标准 YYYY-MM-DD 字符串，持久化 key 与排序都依赖该结果。
fn normalize_date(date: &str) -> Result<String, String> {
    Ok(parse_date(date)?.format(DATE_FORMAT).to_string())
}
