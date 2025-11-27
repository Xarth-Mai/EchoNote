//! Diary domain services: storage, caching, and AI summary orchestration.

use std::borrow::Cow;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use chrono::{Duration, Local, NaiveDate, Utc};
use once_cell::sync::{Lazy, OnceCell};
use reqwest::Url;
use serde::Deserialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter};

use crate::ai_prefs;
use crate::ai_provider::{self, AiChatRequest, AiChatResult, AiMessage};
use crate::models::{DiaryEntry, EntryRecord};
use crate::security::{device, secrets};
use crate::storage::{self, StorageLayout};

/// 内存缓存，Key 使用标准化后的 YYYY-MM-DD，以支持 get/list/save 的快速查询。
static STORE: Lazy<Mutex<HashMap<String, EntryRecord>>> = Lazy::new(|| {
    let map = HashMap::new();
    Mutex::new(map)
});
static STORAGE_LAYOUT: OnceCell<StorageLayout> = OnceCell::new();
const ENTRY_METADATA_EVENT: &str = "entry-metadata-updated";
const EMPTY_ENTRY_SUMMARY: &str = "空白日记";
const AI_PENDING_SUMMARY: &str = "AI 摘要生成中...";
const DATE_FORMAT: &str = "%Y-%m-%d";
// 软上限：在内存中保留的本文+摘要记录数量，避免长时间运行占用过大内存。
const MAX_STORE_ENTRIES: usize = 500;
const GREETING_MAX_CONTEXT_ENTRIES: usize = 30;
const GREETING_MAX_SUMMARY_LENGTH: usize = 180;
const GREETING_MAX_TOKENS: u32 = 80;

#[derive(Debug, Deserialize, Clone)]
pub struct AiInvokePayload {
    #[serde(rename = "providerId")]
    pub provider_id: Option<String>,
    pub prompt: Option<String>,
    #[serde(rename = "maxTokens")]
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
}

#[derive(Debug, Deserialize)]
pub struct AiModelListRequest {
    #[serde(rename = "providerId")]
    provider_id: String,
}

#[derive(Debug, Deserialize)]
pub struct HeroGreetingRequest {
    #[serde(rename = "providerId")]
    provider_id: String,
    #[serde(rename = "userPrompt")]
    user_prompt: Option<String>,
    #[serde(rename = "locale")]
    locale: Option<String>,
    #[serde(rename = "date")]
    date: Option<String>,
    #[serde(rename = "maxTokens")]
    max_tokens: Option<u32>,
    pub temperature: Option<f32>,
    #[serde(rename = "timezone")]
    timezone: Option<String>,
}

/// 列出指定年月的日记条目摘要（仅 frontmatter，不含正文）
///
/// 与前端 `list_entries_by_month(year, month)` 对应。
///
/// 参数：
/// - year: 年份（如 2025）
/// - month: 月份（1-12，自然月）
pub fn list_entries_by_month(
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
pub fn get_entry_body_by_date(app: AppHandle, date: String) -> Result<Option<String>, String> {
    // 统一日期格式为 %Y-%m-%d，方便与 STORE 中的 key 对比。
    let normalized_date = normalize_date(&date)?;
    let layout = storage_layout(&app)?;

    if let Some(body) = {
        let store = STORE
            .lock()
            .map_err(|_| "failed to lock in-memory store".to_string())?;
        store.get(&normalized_date).and_then(|record| {
            // 仅当缓存正文与摘要内的 hash 一致时复用，避免月度索引只加载 frontmatter 导致正文为空。
            let cached_body = record.body();
            (fingerprint(cached_body) == record.summary().hash).then(|| cached_body.to_string())
        })
    } {
        return Ok(Some(body));
    }

    if let Some(record) = storage::load_entry(&layout, &normalized_date)? {
        let body = record.body().to_string();
        let mut store = STORE
            .lock()
            .map_err(|_| "failed to lock in-memory store".to_string())?;
        store.insert(normalized_date, record);
        prune_store_capacity(&mut store);
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
pub fn save_entry_by_date(
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
        summarize_body(&body).unwrap_or_else(|| EMPTY_ENTRY_SUMMARY.to_string())
    };

    let summary = build_summary(
        &app,
        existing_summary.as_ref(),
        &normalized_date,
        &body,
        ai_summary_text,
    )?;

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
    prune_store_capacity(&mut store);

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

/// 生成首页 Hero Greeting，由后端拼接上下文与系统提示词，前端仅传递用户偏好。
pub async fn generate_hero_greeting(
    app: &AppHandle,
    request: HeroGreetingRequest,
) -> Result<String, String> {
    let provider_id = request.provider_id.trim();
    if provider_id.is_empty() || provider_id == "noai" {
        return Err("AI provider is required".to_string());
    }

    let provider_ctx = ai_prefs::resolve_provider_context(app, provider_id)?;
    let api_key = secrets::load_api_key(app, provider_id)?
        .ok_or_else(|| "API Key is required for AI provider".to_string())?;
    let api_base = sanitize_api_base_url(Some(provider_ctx.base_url.clone()), provider_id)?;
    let model = provider_ctx.model.clone();

    let target_date = resolve_greeting_date(request.date.as_deref())?;
    let timezone = resolve_timezone_label(request.timezone.as_deref());
    let language = resolve_language_label(request.locale.as_deref());
    let layout = storage_layout(app)?;
    let history_context = collect_recent_ai_summaries(&layout, target_date)?;

    let system_prompt =
        build_greeting_system_prompt(target_date, &timezone, language, history_context.as_slice());
    let user_prompt = build_greeting_user_prompt(
        request
            .user_prompt
            .as_deref()
            .or_else(|| Some(provider_ctx.greeting_prompt.as_str())),
    );
    let temperature = request
        .temperature
        .map(|value| value.clamp(0.0, 2.0))
        .unwrap_or(provider_ctx.temperature);
    let max_tokens = request
        .max_tokens
        .filter(|value| *value > 0)
        .unwrap_or(provider_ctx.max_tokens)
        .min(GREETING_MAX_TOKENS);

    let ai_request = AiChatRequest {
        provider_id: provider_id.to_string(),
        messages: vec![
            AiMessage {
                role: "system".into(),
                content: system_prompt,
            },
            AiMessage {
                role: "user".into(),
                content: user_prompt,
            },
        ],
        temperature: Some(temperature),
        max_tokens: Some(max_tokens),
    };

    let response =
        ai_provider::invoke_ai_chat(provider_id, ai_request, model, &api_key, &api_base).await?;
    let greeting = extract_greeting_from_response(&response.content);
    if greeting.is_empty() {
        return Err("AI greeting response is empty".to_string());
    }
    Ok(greeting)
}

/// 查询指定 Base URL + API Key 的可用模型（API Key 来自本地后端存储）
pub async fn list_ai_models(
    app: &AppHandle,
    request: AiModelListRequest,
) -> Result<Vec<String>, String> {
    let provider_id = request.provider_id;
    if provider_id == "noai" {
        return Err("AI provider is disabled".to_string());
    }

    let provider_ctx = ai_prefs::resolve_provider_context(app, &provider_id)?;
    let base_url = sanitize_api_base_url(Some(provider_ctx.base_url.clone()), &provider_id)?;
    let api_key = secrets::load_api_key(app, &provider_id)?
        .ok_or_else(|| "API Key is required to list models".to_string())?;

    match ai_provider::list_provider_models(&provider_id, base_url.trim_end_matches('/'), &api_key)
        .await
    {
        Ok(models) => {
            ai_prefs::persist_model_list(app, &provider_id, &models)?;
            Ok(models)
        }
        Err(err) => {
            let prefs = ai_prefs::load_preferences(app)?;
            if let Some(cache) = prefs
                .providers
                .get(&provider_id)
                .and_then(|slot| slot.model_list.clone())
            {
                return Ok(cache);
            }
            Err(err)
        }
    }
}

fn resolve_greeting_date(raw: Option<&str>) -> Result<NaiveDate, String> {
    if let Some(date_str) = raw {
        return parse_date(date_str);
    }
    Ok(Local::now().date_naive())
}

fn resolve_timezone_label(raw: Option<&str>) -> String {
    let offset_minutes = Local::now().offset().local_minus_utc();
    let offset_label = format_timezone_offset(offset_minutes);
    if let Some(value) = raw {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            return format!("{trimmed} ({offset_label})");
        }
    }
    offset_label
}

fn format_timezone_offset(total_minutes: i32) -> String {
    let sign = if total_minutes >= 0 { '+' } else { '-' };
    let minutes = total_minutes.abs();
    let hours = minutes / 60;
    let mins = minutes % 60;
    format!("UTC{sign}{hours:02}:{mins:02}")
}

fn collect_recent_ai_summaries(
    layout: &StorageLayout,
    today: NaiveDate,
) -> Result<Vec<String>, String> {
    let mut rows = Vec::new();
    for offset in 0..GREETING_MAX_CONTEXT_ENTRIES {
        let Some(target_date) = today.checked_sub_signed(Duration::days(offset as i64)) else {
            break;
        };
        let date_str = target_date.format(DATE_FORMAT).to_string();
        if let Some(entry) = load_entry_summary(layout, &date_str)? {
            if let Some(ai_summary) = entry.ai_summary {
                let trimmed = ai_summary.trim();
                if trimmed.is_empty() || trimmed == AI_PENDING_SUMMARY {
                    continue;
                }
                let normalized = normalize_greeting_summary(trimmed);
                rows.push(format!("{date_str}: {normalized}"));
            }
        }
    }
    Ok(rows)
}

fn load_entry_summary(layout: &StorageLayout, date: &str) -> Result<Option<DiaryEntry>, String> {
    if let Some(summary) = {
        let store = STORE
            .lock()
            .map_err(|_| "failed to lock in-memory store".to_string())?;
        store.get(date).map(|record| record.summary().clone())
    } {
        return Ok(Some(summary));
    }

    if let Some(record) = storage::load_entry(layout, date)? {
        let summary = record.summary().clone();
        let mut store = STORE
            .lock()
            .map_err(|_| "failed to lock in-memory store".to_string())?;
        store.insert(date.to_string(), record);
        prune_store_capacity(&mut store);
        return Ok(Some(summary));
    }

    Ok(None)
}

fn normalize_greeting_summary(value: &str) -> String {
    let compacted = value
        .split_whitespace()
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join(" ");
    let mut result = String::new();
    let mut count = 0;
    for ch in compacted.chars() {
        if count >= GREETING_MAX_SUMMARY_LENGTH {
            result.push('…');
            break;
        }
        result.push(ch);
        count += 1;
    }
    result
}

fn build_greeting_system_prompt(
    date: NaiveDate,
    timezone: &str,
    language: &str,
    context: &[String],
) -> String {
    let context_block = if context.is_empty() {
        "No AI summaries were provided in the past month.".to_string()
    } else {
        context.join("\n")
    };

    format!(
        "Output only JSON: {{\"greeting\":\"<≤24 chars>\"}}\nRules: greeting must be warm, concise, add emoji, reflect recent diary tone, no chain-of-thought or explanations, JSON only.\nLanguage: {language}\nDate: {}\nTimezone: {}\nRecent summaries:\n{}",
        date.format(DATE_FORMAT),
        timezone,
        context_block
    )
}

fn build_greeting_user_prompt(preference: Option<&str>) -> String {
    let trimmed = preference
        .unwrap_or(ai_prefs::DEFAULT_GREETING_PROMPT)
        .trim();
    if trimmed.is_empty() {
        ai_prefs::DEFAULT_GREETING_PROMPT.to_string()
    } else {
        trimmed.to_string()
    }
}

fn resolve_language_label(locale: Option<&str>) -> &'static str {
    match locale.unwrap_or("zh-Hans") {
        "en" => "English",
        "ja" => "Japanese",
        "zh-Hant" => "Traditional Chinese",
        _ => "Simplified Chinese",
    }
}

fn extract_greeting_from_response(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    let block = strip_code_fence_block(trimmed);
    if let Ok(value) = serde_json::from_str::<Value>(block.as_ref()) {
        if let Some(text) = value.as_str() {
            let candidate = text.trim();
            if !candidate.is_empty() {
                return candidate.to_string();
            }
        }

        if let Some(map) = value.as_object() {
            for key in ["greeting", "message", "text"] {
                if let Some(text) = map.get(key).and_then(|val| val.as_str()) {
                    let candidate = text.trim();
                    if !candidate.is_empty() {
                        return candidate.to_string();
                    }
                }
            }
        }
    }

    trimmed.to_string()
}

fn build_summary_prompt(body: impl AsRef<str>, custom_prompt: Option<&str>) -> Vec<AiMessage> {
    let user_custom = custom_prompt.unwrap_or(ai_prefs::DEFAULT_PROMPT);

    let system_prompt = format!(
        r#"Output only JSON: {{"emoji":"<1-symbol>","summary":"<≤60 chars>"}}.Rules: emoji = 1 symbol; summary must use the diary author's language and writing style; no fabrication; avoid chain-of-thought or explanations; JSON only.Diary: {}"#,
        body.as_ref()
    );

    vec![
        AiMessage {
            role: "system".into(),
            content: system_prompt,
        },
        AiMessage {
            role: "user".into(),
            content: user_custom.into(),
        },
    ]
}

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
    app: &AppHandle,
    existing: Option<&DiaryEntry>,
    date: &str,
    body: &str,
    ai_summary: String,
) -> Result<DiaryEntry, String> {
    Ok(DiaryEntry {
        hlc: existing
            .map(|entry| entry.hlc.clone())
            .unwrap_or(next_hlc(app)?),
        hash: fingerprint(body),
        date: date.to_string(),
        emoji: existing.and_then(|entry| entry.emoji.clone()),
        ai_summary: Some(ai_summary),
        language: detect_language(body),
    })
}

fn next_hlc(app: &AppHandle) -> Result<String, String> {
    let timestamp = Utc::now().timestamp_millis();
    let logical = LOGICAL_COUNTER.fetch_add(1, Ordering::SeqCst);
    let device_id = device::device_id(app)?;
    Ok(format!("{timestamp}-{logical}-{device_id}"))
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
    prune_store_capacity(&mut store);

    entries.sort_by(|a, b| match a.date.cmp(&b.date) {
        std::cmp::Ordering::Equal => a.hlc.cmp(&b.hlc),
        other => other,
    });

    Ok(entries)
}

fn sanitize_ai_payload(mut ai: AiInvokePayload) -> Option<AiInvokePayload> {
    let provider = ai.provider_id.as_ref()?.trim();
    if provider.is_empty() || provider == "noai" {
        return None;
    }
    ai.provider_id = Some(provider.to_string());
    ai.prompt = ai
        .prompt
        .map(|p| p.trim().to_string())
        .filter(|p| !p.is_empty());
    ai.max_tokens = ai.max_tokens.filter(|value| *value > 0);
    ai.temperature = ai.temperature.map(|value| value.clamp(0.0, 2.0));
    Some(ai)
}

fn default_api_base_for(provider_id: &str) -> &'static str {
    ai_prefs::default_api_base_for(provider_id)
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

    // Retry logic: try up to 3 times (initial + 2 retries)
    let mut attempts = 0;
    let max_attempts = 3;
    let mut summary_result = Err("Initial".to_string());

    while attempts < max_attempts {
        summary_result = request_ai_summary(&app, &ai, &body).await;
        if summary_result.is_ok() {
            break;
        }
        attempts += 1;
        if attempts < max_attempts {
            eprintln!(
                "[EchoNote] AI summary failed (attempt {}/{}), retrying...",
                attempts, max_attempts
            );
        }
    }

    let AiSummaryResult {
        summary: ai_summary,
        emoji: ai_emoji,
    } = match summary_result {
        Ok(res) => res,
        Err(err) => {
            eprintln!("[EchoNote] AI summary failed after {} attempts: {}. Falling back to local summary.", attempts, err);
            let local_summary =
                summarize_body(&body).unwrap_or_else(|| EMPTY_ENTRY_SUMMARY.to_string());
            AiSummaryResult {
                summary: local_summary,
                emoji: None,
            }
        }
    };

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
        summary.ai_summary = Some(ai_summary);
        if let Some(new_emoji) = ai_emoji {
            summary.emoji = Some(new_emoji);
        }
        summary.language = detect_language(&body);

        record.update(summary.clone(), body.clone());

        (summary, body)
    };

    storage::write_entry(&layout, &updated_summary, &persisted_body)?;
    app.emit(ENTRY_METADATA_EVENT, &updated_summary)
        .map_err(|err| format!("failed to emit metadata event: {err}"))?;
    Ok(())
}

async fn request_ai_summary(
    app: &AppHandle,
    ai: &AiInvokePayload,
    body: &str,
) -> Result<AiSummaryResult, String> {
    let provider_id = ai
        .provider_id
        .as_ref()
        .ok_or_else(|| "AI provider is required".to_string())?;
    let provider_ctx = ai_prefs::resolve_provider_context(app, provider_id)?;
    let api_key = secrets::load_api_key(app, provider_id)?
        .ok_or_else(|| "API Key is required for AI provider".to_string())?;
    let api_base = sanitize_api_base_url(Some(provider_ctx.base_url.clone()), provider_id)?;

    let model = provider_ctx.model.clone();
    let prompt = ai
        .prompt
        .as_ref()
        .map(|text| text.trim())
        .filter(|text| !text.is_empty())
        .map(|text| text.to_string())
        .unwrap_or_else(|| provider_ctx.prompt.clone());
    let max_tokens = ai
        .max_tokens
        .filter(|value| *value > 0)
        .unwrap_or(provider_ctx.max_tokens);
    let temperature = ai
        .temperature
        .map(|value| value.clamp(0.0, 2.0))
        .unwrap_or(provider_ctx.temperature);

    let request = AiChatRequest {
        provider_id: provider_id.to_string(),
        messages: build_summary_prompt(body, Some(&prompt)),
        temperature: Some(temperature),
        max_tokens: Some(max_tokens),
    };

    let response =
        ai_provider::invoke_ai_chat(provider_id, request, model, &api_key, &api_base).await?;
    Ok(parse_ai_summary_response(&response.content))
}

#[derive(Debug, Clone)]
struct AiSummaryResult {
    summary: String,
    emoji: Option<String>,
}

#[derive(Deserialize)]
struct AiSummaryJsonPayload {
    summary: Option<String>,
    emoji: Option<String>,
}

fn parse_ai_summary_response(raw: &str) -> AiSummaryResult {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return AiSummaryResult {
            summary: String::new(),
            emoji: None,
        };
    }

    if let Some(result) = parse_ai_summary_json(trimmed) {
        return result;
    }

    parse_ai_summary_fallback(trimmed)
}

fn parse_ai_summary_json(raw: &str) -> Option<AiSummaryResult> {
    let block = strip_code_fence_block(raw);
    let payload: AiSummaryJsonPayload = serde_json::from_str(block.as_ref()).ok()?;
    let summary = sanitize_summary_text(payload.summary, block.as_ref());
    let emoji = sanitize_emoji_text(payload.emoji);
    Some(AiSummaryResult { summary, emoji })
}

fn parse_ai_summary_fallback(raw: &str) -> AiSummaryResult {
    if let Some((idx, width)) = find_summary_delimiter(raw) {
        let emoji_candidate = raw[..idx].trim().trim_start_matches('$').trim();
        let summary_candidate = raw[idx + width..].trim();
        let summary_text = if summary_candidate.is_empty() {
            raw
        } else {
            summary_candidate
        };
        let emoji = sanitize_emoji_text(Some(emoji_candidate.to_string()));
        return AiSummaryResult {
            summary: summary_text.to_string(),
            emoji,
        };
    }

    AiSummaryResult {
        summary: raw.to_string(),
        emoji: None,
    }
}

fn strip_code_fence_block(input: &str) -> Cow<'_, str> {
    let trimmed = input.trim();
    if !trimmed.starts_with("```") {
        return Cow::Borrowed(trimmed);
    }

    let mut parts = trimmed.splitn(2, '\n');
    let _ = parts.next();
    if let Some(rest) = parts.next() {
        if let Some(end_idx) = rest.rfind("```") {
            return Cow::Owned(rest[..end_idx].trim().to_string());
        }
        return Cow::Owned(rest.trim().to_string());
    }

    Cow::Borrowed(trimmed)
}

fn sanitize_summary_text(value: Option<String>, fallback: &str) -> String {
    value
        .and_then(|text| {
            let trimmed = text.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        })
        .unwrap_or_else(|| fallback.trim().to_string())
}

fn sanitize_emoji_text(value: Option<String>) -> Option<String> {
    value.and_then(|text| {
        let trimmed = text.trim();
        let char_count = trimmed.chars().count();
        if trimmed.is_empty() || char_count > 8 {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn find_summary_delimiter(value: &str) -> Option<(usize, usize)> {
    for (idx, ch) in value.char_indices() {
        if ch == ':' || ch == '：' {
            return Some((idx, ch.len_utf8()));
        }
    }
    None
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

fn sanitize_api_base_url(raw: Option<String>, provider_id: &str) -> Result<String, String> {
    let value = raw.unwrap_or_else(|| default_api_base_for(provider_id).to_string());
    if value.trim().is_empty() {
        return Ok(default_api_base_for(provider_id).to_string());
    }

    let parsed = Url::parse(value.trim()).map_err(|err| format!("invalid AI base URL: {err}"))?;
    parsed
        .host_str()
        .ok_or_else(|| "AI base URL is missing host".to_string())?;

    let url_string: String = parsed.into();
    Ok(url_string.trim_end_matches('/').to_string())
}

fn prune_store_capacity(store: &mut HashMap<String, EntryRecord>) {
    if store.len() <= MAX_STORE_ENTRIES {
        return;
    }

    let mut entries: Vec<(String, NaiveDate, String)> = store
        .iter()
        .filter_map(|(key, record)| {
            parse_date(key)
                .ok()
                .map(|date| (key.clone(), date, record.summary().hlc.clone()))
        })
        .collect();

    if entries.is_empty() {
        return;
    }

    entries.sort_by(|a, b| a.1.cmp(&b.1).then(a.2.cmp(&b.2)));
    let overflow = store.len().saturating_sub(MAX_STORE_ENTRIES);
    for (key, _, _) in entries.into_iter().take(overflow) {
        store.remove(&key);
    }
}
