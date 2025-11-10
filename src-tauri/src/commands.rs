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
    if !(1..=12).contains(&month) {
        return Err("month must be between 1 and 12".into());
    }

    let prefix = format!("{year:04}-{month:02}-");
    let store = STORE
        .lock()
        .map_err(|_| "failed to acquire diary store lock".to_string())?;

    let mut entries: Vec<DiaryEntry> = store
        .values()
        .filter(|record| record.summary.date.starts_with(&prefix))
        .map(|record| record.summary.clone())
        .collect();

    entries.sort_by(|a, b| b.date.cmp(&a.date));
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
    let store = STORE
        .lock()
        .map_err(|_| "failed to acquire diary store lock".to_string())?;
    Ok(store.get(&date).map(|record| record.body.clone()))
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
    let mut store = STORE
        .lock()
        .map_err(|_| "failed to acquire diary store lock".to_string())?;

    let now_seconds = Local::now().timestamp() as u64;
    let merged_entry = {
        let mut enriched = entry;
        if enriched.updated_at.is_none() {
            enriched.updated_at = Some(now_seconds);
        }
        if enriched.language.is_none() {
            enriched.language = Some("zh-CN".into());
        }
        enriched
    };

    store.insert(
        merged_entry.date.clone(),
        EntryRecord {
            summary: merged_entry,
            body,
        },
    );
    Ok(())
}

fn seed_entries() -> Vec<EntryRecord> {
    let today = Local::now().date_naive();
    let templates = vec![
        (
            "☕️",
            "晨间散步捕捉到阳光，顺手整理了 App UI 灵感。",
            "一杯热咖啡后在河边走了 20 分钟，顺着 App Store 的展陈复盘了 EchoNote 的交互节奏。",
        ),
        (
            "🌧️",
            "雨天宅家，写作灵感被窗外雨声触发。",
            "以『雨』为主题写了 600 字散文，坐在窗边听雨声敲击玻璃，顺便打磨了编辑器的空态文案。",
        ),
        (
            "🎧",
            "午后听播客获得灵感，为时间线加上心情标签。",
            "播客里提到的『情绪刻度』启发我给时间线增添 emoji 入口，顺手画了几张草图。",
        ),
        (
            "🧘",
            "晚间进行冥想与拉伸，整理最近的睡眠与情绪波动。",
            "冥想 10 分钟后记录了对“慢”的理解，并分析了本周入睡前的情绪起伏。",
        ),
        (
            "🚴",
            "周末骑行沿途拍照，想把照片引用到日记里。",
            "测试了手机端拍照→即刻写作的流程，用了 3 个场景验证上传后的断点续写效果。",
        ),
    ];

    templates
        .into_iter()
        .enumerate()
        .map(|(index, (mood, summary, body))| {
            let date = today
                .checked_sub_days(Days::new((index as u64) * 2))
                .unwrap_or(today);
            make_record(date, mood, summary, body)
        })
        .chain(std::iter::once({
            let date = today.checked_sub_days(Days::new(15)).unwrap_or(today);
            make_record(
                date,
                "📚",
                "复习过往日记，整理关键词云。",
                "把过去两周的记录导入到 AI 摘要里，尝试生成关键词云，观察自己关注的主题。",
            )
        }))
        .collect()
}

fn make_record(date: NaiveDate, mood: &str, summary: &str, body: &str) -> EntryRecord {
    let formatted = date.format("%Y-%m-%d").to_string();
    let summary_struct = DiaryEntry {
        date: formatted.clone(),
        mood: Some(mood.to_string()),
        ai_summary: Some(summary.to_string()),
        language: Some("zh-CN".into()),
        updated_at: Some(Local::now().timestamp() as u64),
    };

    EntryRecord {
        summary: summary_struct,
        body: body.to_string(),
    }
}
