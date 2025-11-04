use serde::{Deserialize, Serialize};

/// 日记条目（与前端 `DiaryEntry` 对齐）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiaryEntry {
    /// 日期：YYYY-MM-DD
    pub date: String,
    /// 心情 emoji
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mood: Option<String>,
    /// AI 生成的摘要（前端字段名为 aiSummary）
    #[serde(rename = "aiSummary", skip_serializing_if = "Option::is_none")]
    pub ai_summary: Option<String>,
    /// 语言
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    /// 更新时间（秒）（前端字段名为 updatedAt）
    #[serde(rename = "updatedAt", skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<u64>,
}

/// 列出指定年月的日记条目摘要（仅 frontmatter，不含正文）
///
/// 与前端 `list_entries_by_month(year, month)` 对应。
///
/// 参数：
/// - year: 年份（如 2025）
/// - month: 月份（1-12，自然月）
#[tauri::command]
pub async fn list_entries_by_month(year: u16, month: u8) -> Result<Vec<DiaryEntry>, String> {
    // TODO: 读取存储，返回该月所有条目的 frontmatter 列表
    let _ = (year, month);
    Ok(Vec::new())
}

/// 按日期获取日记正文内容
///
/// 与前端 `get_entry_body(date)` 对应，返回正文 Markdown 字符串或 null。
///
/// 参数：
/// - date: YYYY-MM-DD
#[tauri::command]
pub async fn get_entry_body_by_date(date: String) -> Result<Option<String>, String> {
    // TODO: 读取指定日期的正文内容，若不存在返回 None
    let _ = date;
    Ok(None)
}

/// 根据日期保存/更新日记内容
///
/// 与前端 `saveEntryByDate(summary, body)` 对应。
///
/// 参数：
/// - entry: 日记元数据（frontmatter）
/// - body: 正文内容（Markdown）
#[tauri::command]
pub async fn save_entry_by_date(entry: DiaryEntry, body: String) -> Result<(), String> {
    // TODO: 持久化写入 entry 与 body（前端不处理 frontmatter 组装）
    let _ = (entry, body);
    Ok(())
}
