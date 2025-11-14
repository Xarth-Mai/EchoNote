use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use chrono::{NaiveDate, Utc};
use once_cell::sync::{Lazy, OnceCell};
use serde::Deserialize;
use tauri::{AppHandle, Emitter};

use crate::models::{DiaryEntry, EntryRecord};
use crate::openai::{self, OpenAiChatRequest, OpenAiChatResult, OpenAiMessage};
use crate::storage::{self, StorageLayout};

/// 内存缓存，Key 使用标准化后的 YYYY-MM-DD，以支持 get/list/save 的快速查询。
static STORE: Lazy<Mutex<HashMap<String, EntryRecord>>> = Lazy::new(|| {
    let map = HashMap::new();
    Mutex::new(map)
});
static STORAGE_LAYOUT: OnceCell<StorageLayout> = OnceCell::new();
const ENTRY_METADATA_EVENT: &str = "entry-metadata-updated";
const AI_NOT_CONFIGURED_SUMMARY: &str = "AI 功能未配置";
const AI_PENDING_SUMMARY: &str = "AI 摘要生成中...";
const DEFAULT_MODEL: &str = "gpt-5.1-mini";
const DATE_FORMAT: &str = "%Y-%m-%d";
const DEFAULT_PROMPT: &str = "You are an assistant that summarizes diary entries in concise Chinese, optionally referencing emotions if present.";
const DEFAULT_TEMPERATURE: f32 = 0.3;

#[derive(Debug, Deserialize, Clone)]
pub struct AiInvokePayload {
    #[serde(rename = "baseUrl")]
    pub base_url: Option<String>,
    #[serde(rename = "apiKey")]
    pub api_key: Option<String>,
    pub model: Option<String>,
    pub prompt: Option<String>,
    #[serde(rename = "maxTokens")]
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
}

#[derive(Debug, Deserialize)]
pub struct ModelListRequest {
    #[serde(rename = "baseUrl")]
    base_url: Option<String>,
    #[serde(rename = "apiKey")]
    api_key: Option<String>,
}

/// 列出指定年月的日记条目摘要（仅 frontmatter，不含正文）
///
/// 与前端 `list_entries_by_month(year, month)` 对应。
///
/// 参数：
/// - year: 年份（如 2025）
/// - month: 月份（1-12，自然月）
#[tauri::command]
pub async fn list_entries_by_month(
    app: AppHandle,
    year: u16,
    month: u8,
) -> Result<Vec<DiaryEntry>, String> {
    // 校验月份范围，避免前端或调用者传入非法参数后导致日期解析 panic。
    if !(1..=12).contains(&month) {
        return Err(format!("month must be between 1 and 12 (got {month})"));
    }

    let year = year as i32;
    let month = month as u32;

    let layout = storage_layout(&app)?;
    load_month_into_store(&layout, year, month)
}

/// 按日期获取日记正文内容
///
/// 与前端 `get_entry_body(date)` 对应，返回正文 Markdown 字符串或 null。
///
/// 参数：
/// - date: YYYY-MM-DD
#[tauri::command]
pub async fn get_entry_body_by_date(
    app: AppHandle,
    date: String,
) -> Result<Option<String>, String> {
    // 统一日期格式为 %Y-%m-%d，方便与 STORE 中的 key 对比。
    let normalized_date = normalize_date(&date)?;
    let layout = storage_layout(&app)?;

    if let Some(body) = {
        let store = STORE
            .lock()
            .map_err(|_| "failed to lock in-memory store".to_string())?;
        store
            .get(&normalized_date)
            .map(|record| record.body().to_string())
    } {
        return Ok(Some(body));
    }

    if let Some(record) = storage::load_entry(&layout, &normalized_date)? {
        let body = record.body().to_string();
        let mut store = STORE
            .lock()
            .map_err(|_| "failed to lock in-memory store".to_string())?;
        store.insert(normalized_date, record);
        return Ok(Some(body));
    }

    Ok(None)
}

/// 根据日期保存/更新日记内容
///
/// 与前端 `saveEntryByDate(date, body)` 对应，返回最新的摘要信息。
///
/// 参数：
/// - date: 日期（YYYY-MM-DD）
/// - body: 正文内容（Markdown）
#[tauri::command]
pub async fn save_entry_by_date(
    app: AppHandle,
    date: String,
    body: String,
    ai: Option<AiInvokePayload>,
) -> Result<DiaryEntry, String> {
    let layout = storage_layout(&app)?;
    let normalized_date = normalize_date(&date)?;

    let existing_summary = {
        let store = STORE
            .lock()
            .map_err(|_| "failed to lock in-memory store".to_string())?;
        store
            .get(&normalized_date)
            .map(|record| record.summary().clone())
    };

    let ai_payload = ai.and_then(sanitize_ai_payload);
    let ai_summary_text = if ai_payload.is_some() {
        AI_PENDING_SUMMARY.to_string()
    } else {
        existing_summary
            .as_ref()
            .and_then(|entry| entry.ai_summary.clone())
            .or_else(|| summarize_body(&body))
            .unwrap_or_else(|| AI_NOT_CONFIGURED_SUMMARY.to_string())
    };

    let summary = build_summary(
        existing_summary.as_ref(),
        &normalized_date,
        &body,
        ai_summary_text,
    );

    storage::write_entry(&layout, &summary, &body)
        .map_err(|err| format!("failed to persist entry to disk: {err}"))?;

    let mut store = STORE
        .lock()
        .map_err(|_| "failed to lock in-memory store".to_string())?;
    if let Some(record) = store.get_mut(&normalized_date) {
        record.update(summary.clone(), body.clone());
    } else {
        store.insert(
            normalized_date.clone(),
            EntryRecord::new(summary.clone(), body.clone()),
        );
    }

    if let Some(payload) = ai_payload {
        spawn_metadata_refresh(
            &app,
            normalized_date.clone(),
            payload,
            body.clone(),
            summary.hash.clone(),
        );
    }

    Ok(summary)
}

/// 统一调用 OpenAI Chat Completions 接口
#[tauri::command]
pub async fn invoke_openai_chat(request: OpenAiChatRequest) -> Result<OpenAiChatResult, String> {
    openai::invoke_chat_completion(request).await
}

/// 查询指定 Base URL + API Key 的可用模型
#[tauri::command]
pub async fn list_ai_models(request: ModelListRequest) -> Result<Vec<String>, String> {
    let base_url = request
        .base_url
        .unwrap_or_else(|| "https://api.openai.com/v1".to_string());
    let api_key = request
        .api_key
        .ok_or_else(|| "API Key is required to list models".to_string())?;

    openai::list_models(base_url.trim_end_matches('/'), &api_key).await
}

fn build_summary_prompt(body: &str, custom_prompt: Option<&str>) -> Vec<OpenAiMessage> {
    let system_prompt = custom_prompt.unwrap_or(DEFAULT_PROMPT);
    vec![
        OpenAiMessage {
            role: "system".to_string(),
            content: system_prompt.to_string(),
        },
        OpenAiMessage {
            role: "user".to_string(),
            content: format!(
                "请围绕以下日记内容生成一句话摘要（限制 60 字以内）：\n{}",
                body
            ),
        },
    ]
}

static DEVICE_ID: Lazy<String> = Lazy::new(resolve_device_id);
static LOGICAL_COUNTER: AtomicU64 = AtomicU64::new(0);

fn storage_layout(app_handle: &AppHandle) -> Result<StorageLayout, String> {
    STORAGE_LAYOUT
        .get_or_try_init(|| storage::StorageLayout::prepare(app_handle))
        .map(|layout| layout.clone())
        .map_err(|err| err)
}

/// 尝试按照固定格式解析日期，错误信息中包含原始输入，方便前端调试。
fn parse_date(date: &str) -> Result<NaiveDate, String> {
    NaiveDate::parse_from_str(date, DATE_FORMAT)
        .map_err(|err| format!("invalid date \"{date}\": {err}"))
}

/// 返回标准 YYYY-MM-DD 字符串，持久化 key 与排序都依赖该结果。
fn normalize_date(date: &str) -> Result<String, String> {
    Ok(parse_date(date)?.format(DATE_FORMAT).to_string())
}

fn build_summary(
    existing: Option<&DiaryEntry>,
    date: &str,
    body: &str,
    ai_summary: String,
) -> DiaryEntry {
    DiaryEntry {
        hlc: existing
            .map(|entry| entry.hlc.clone())
            .unwrap_or_else(next_hlc),
        hash: fingerprint(body),
        date: date.to_string(),
        emoji: existing.and_then(|entry| entry.emoji.clone()),
        ai_summary: Some(ai_summary),
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
    let hash = blake3::hash(body.as_bytes());
    hash.to_hex().to_string()
}

fn load_month_into_store(
    layout: &StorageLayout,
    year: i32,
    month: u32,
) -> Result<Vec<DiaryEntry>, String> {
    let mut entries = Vec::new();
    let records = storage::load_month_entries(layout, year, month)?;
    let mut store = STORE
        .lock()
        .map_err(|_| "failed to lock in-memory store".to_string())?;

    for record in records {
        let summary = record.summary().clone();
        entries.push(summary.clone());
        store.insert(summary.date.clone(), record);
    }

    entries.sort_by(|a, b| match a.date.cmp(&b.date) {
        std::cmp::Ordering::Equal => a.hlc.cmp(&b.hlc),
        other => other,
    });

    Ok(entries)
}

fn sanitize_ai_payload(mut ai: AiInvokePayload) -> Option<AiInvokePayload> {
    let base = ai.base_url.as_ref()?.trim();
    let api = ai.api_key.as_ref()?.trim();
    if base.is_empty() || api.is_empty() {
        return None;
    }
    ai.base_url = Some(base.trim_end_matches('/').to_string());
    ai.api_key = Some(api.to_string());
    ai.model = ai
        .model
        .map(|m| m.trim().to_string())
        .filter(|m| !m.is_empty());
    ai.prompt = ai
        .prompt
        .map(|p| p.trim().to_string())
        .filter(|p| !p.is_empty());
    ai.max_tokens = ai.max_tokens.filter(|value| *value > 0);
    ai.temperature = ai.temperature.map(|value| value.clamp(0.0, 2.0));
    Some(ai)
}

fn spawn_metadata_refresh(
    app: &AppHandle,
    date: String,
    ai: AiInvokePayload,
    body: String,
    expected_hash: String,
) {
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(err) = regenerate_entry_metadata(app_handle, date, ai, body, expected_hash).await
        {
            eprintln!("[EchoNote] metadata refresh failed: {err}");
        }
    });
}

async fn regenerate_entry_metadata(
    app: AppHandle,
    date: String,
    ai: AiInvokePayload,
    body: String,
    expected_hash: String,
) -> Result<(), String> {
    let layout = storage_layout(&app)?;
    let summary_text = request_ai_summary(&ai, &body).await?;

    let (updated_summary, persisted_body) = {
        let mut store = STORE
            .lock()
            .map_err(|_| "failed to lock in-memory store".to_string())?;
        let Some(record) = store.get_mut(&date) else {
            return Ok(());
        };

        if record.summary().hash != expected_hash {
            return Ok(());
        }

        let mut summary = record.summary().clone();
        summary.ai_summary = Some(summary_text);
        summary.language = detect_language(&body);

        record.update(summary.clone(), body.clone());

        (summary, body)
    };

    storage::write_entry(&layout, &updated_summary, &persisted_body)?;
    app.emit(ENTRY_METADATA_EVENT, &updated_summary)
        .map_err(|err| format!("failed to emit metadata event: {err}"))?;
    Ok(())
}

async fn request_ai_summary(ai: &AiInvokePayload, body: &str) -> Result<String, String> {
    let model = ai
        .model
        .clone()
        .unwrap_or_else(|| DEFAULT_MODEL.to_string());
    let prompt = ai
        .prompt
        .clone()
        .unwrap_or_else(|| DEFAULT_PROMPT.to_string());
    let max_tokens = ai.max_tokens.or(Some(200));
    let temperature = ai.temperature.unwrap_or(DEFAULT_TEMPERATURE);

    let request = OpenAiChatRequest {
        model,
        messages: build_summary_prompt(body, Some(&prompt)),
        temperature: Some(temperature),
        max_tokens,
        api_key: ai.api_key.clone(),
        api_base: ai.base_url.clone(),
    };

    let response = openai::invoke_chat_completion(request).await?;
    Ok(response.content.trim().to_string())
}

fn summarize_body(body: &str) -> Option<String> {
    let trimmed = body.trim();
    if trimmed.is_empty() {
        return None;
    }

    const LIMIT: usize = 120;
    let mut summary = String::new();
    let mut count = 0;
    for ch in trimmed.chars() {
        if count >= LIMIT {
            summary.push_str("...");
            break;
        }
        let normalized = match ch {
            '\n' | '\r' => ' ',
            _ => ch,
        };
        summary.push(normalized);
        count += 1;
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
