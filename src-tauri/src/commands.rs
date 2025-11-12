use std::collections::HashMap;
use std::sync::Mutex;

use chrono::{Days, Local, NaiveDate};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};

static STORE: Lazy<Mutex<HashMap<String, EntryRecord>>> = Lazy::new(|| {
    let mut map = HashMap::new();
    for record in seed_entries() {
        map.insert(record.summary.date.clone(), record);
    }
    Mutex::new(map)
});

#[derive(Debug, Clone)]
struct EntryRecord {
    summary: DiaryEntry,
    body: String,
}

/// 日记条目（与前端 `DiaryEntry` 对齐）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiaryEntry {
    /// $Timestamp + "-" + $LogicalCounter + "-" + DeviceID
    pub hlc: String,
    /// BLAKE3 HASH
    pub hash: String,
    /// 日期：YYYY-MM-DD
    pub date: String,
    /// 每日 Emoji
    #[serde(skip_serializing_if = "Option::is_none")]
    pub emoji: Option<String>,
    /// AI 生成的摘要（前端字段名为 aiSummary）
    #[serde(rename = "aiSummary", skip_serializing_if = "Option::is_none")]
    pub ai_summary: Option<String>,
    /// 语言
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
}

/// 列出指定年月的日记条目摘要（仅 frontmatter，不含正文）
///
/// 与前端 `list_entries_by_month(year, month)` 对应。
///
/// 参数：
/// - year: 年份（如 2025）
/// - month: 月份（1-12，自然月）
#[tauri::command]
pub async fn list_entries_by_month(year: u16, month: u8) -> Result<Vec<DiaryEntry>, String> {}

/// 按日期获取日记正文内容
///
/// 与前端 `get_entry_body(date)` 对应，返回正文 Markdown 字符串或 null。
///
/// 参数：
/// - date: YYYY-MM-DD
#[tauri::command]
pub async fn get_entry_body_by_date(date: String) -> Result<Option<String>, String> {}

/// 根据日期保存/更新日记内容
///
/// 与前端 `saveEntryByDate(summary, body)` 对应。
///
/// 参数：
/// - entry: 日记元数据（frontmatter）
/// - body: 正文内容（Markdown）
#[tauri::command]
pub async fn save_entry_by_date(entry: DiaryEntry, body: String) -> Result<(), String> {}
