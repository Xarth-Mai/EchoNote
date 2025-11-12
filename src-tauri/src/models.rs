use serde::{Deserialize, Serialize};

/// 完整日记数据
#[derive(Debug, Clone)]
pub struct EntryRecord {
    summary: DiaryEntry,
    body: String,
}

/// 日记元数据（与前端 `DiaryEntry` 对齐）
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
