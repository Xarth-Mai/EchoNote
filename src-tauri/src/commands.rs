use std::collections::HashMap;
use std::sync::Mutex;

use chrono::{Days, Local, NaiveDate};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};

use crate::models::{DiaryEntry, EntryRecord};

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
