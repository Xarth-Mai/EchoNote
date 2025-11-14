use serde::{Deserialize, Serialize};

/// 完整日记数据
#[derive(Debug, Clone)]
pub struct EntryRecord {
    summary: DiaryEntry,
    body: String,
}

impl EntryRecord {
    /// 创建新的记录，summary 负责前端元数据，body 保留完整 Markdown 正文。
    pub fn new(summary: DiaryEntry, body: String) -> Self {
        Self { summary, body }
    }

    /// 返回引用，供列表等只读场景复用 frontmatter。
    pub fn summary(&self) -> &DiaryEntry {
        &self.summary
    }

    /// 返回正文引用，避免多次克隆。
    pub fn body(&self) -> &str {
        &self.body
    }

    /// 覆写记录内容，用于更新同一天的条目。
    pub fn update(&mut self, summary: DiaryEntry, body: String) {
        self.summary = summary;
        self.body = body;
    }
}

/// 日记元数据
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
