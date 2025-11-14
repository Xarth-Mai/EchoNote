//! File-based diary storage utilities.

use std::fs;
use std::path::{Path, PathBuf};

use chrono::{Datelike, NaiveDate};
use tauri::{AppHandle, Manager};

use crate::models::{DiaryEntry, EntryRecord};

const DATE_FORMAT: &str = "%Y-%m-%d";

#[derive(Debug, Clone)]
pub struct StorageLayout {
    root: PathBuf,
}

impl StorageLayout {
    /// Resolve the application data directory that works across desktop/mobile targets.
    pub fn prepare(app_handle: &AppHandle) -> Result<Self, String> {
        let resolver = app_handle.path();
        let base = resolver
            .app_data_dir()
            .or_else(|_| resolver.app_local_data_dir())
            .or_else(|_| resolver.app_config_dir())
            .or_else(|_| resolver.app_cache_dir())
            .map_err(|err| err.to_string())
            .or_else(|err| {
                std::env::current_dir().map_err(|io_err| {
                    format!("failed to resolve app data directory ({err}) and fallback failed: {io_err}")
                })
            })?;

        ensure_dir(&base)?;
        Ok(Self { root: base })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }
}

/// Persist a diary entry as `$APP_DATA/YYYY/MM/YYYY-MM-DD.md`.
pub fn write_entry(layout: &StorageLayout, summary: &DiaryEntry, body: &str) -> Result<(), String> {
    let date = NaiveDate::parse_from_str(&summary.date, DATE_FORMAT)
        .map_err(|err| format!("invalid diary date {}: {err}", summary.date))?;
    let path = entry_path(layout.root(), &date, true)?;

    let yaml = serde_yaml::to_string(summary)
        .map_err(|err| format!("failed to serialize diary metadata: {err}"))?;
    let mut document = String::new();
    document.push_str("---\n");
    document.push_str(&yaml);
    if !yaml.ends_with('\n') {
        document.push('\n');
    }
    document.push_str("---\n\n");
    document.push_str(body);

    fs::write(&path, document)
        .map_err(|err| format!("failed to write entry file {}: {err}", path.display()))
}

/// Load a specific entry by date.
pub fn load_entry(layout: &StorageLayout, date: &str) -> Result<Option<EntryRecord>, String> {
    let date = NaiveDate::parse_from_str(date, DATE_FORMAT)
        .map_err(|err| format!("invalid date {date}: {err}"))?;
    let path = entry_path(layout.root(), &date, false)?;
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(&path)
        .map_err(|err| format!("failed to read entry {}: {err}", path.display()))?;
    parse_document(&content).map(Some)
}

/// Load all entries for a month (year-month) and return them as records.
pub fn load_month_entries(
    layout: &StorageLayout,
    year: i32,
    month: u32,
) -> Result<Vec<EntryRecord>, String> {
    let month_dir = month_dir_path(layout.root(), year, month, false)?;
    if month_dir.is_none() {
        return Ok(Vec::new());
    }
    let month_dir = month_dir.unwrap();
    let mut records = Vec::new();
    for entry in fs::read_dir(&month_dir)
        .map_err(|err| format!("failed to read {}: {err}", month_dir.display()))?
    {
        let entry = entry.map_err(|err| format!("failed to iterate entries: {err}"))?;
        let path = entry.path();
        if !path.is_file() || path.extension().and_then(|ext| ext.to_str()) != Some("md") {
            continue;
        }
        let content = fs::read_to_string(&path)
            .map_err(|err| format!("failed to read entry {}: {err}", path.display()))?;
        match parse_document(&content) {
            Ok(record) => records.push(record),
            Err(err) => {
                return Err(format!(
                    "failed to parse entry file {}: {err}",
                    path.display()
                ))
            }
        }
    }
    Ok(records)
}

fn entry_path(root: &Path, date: &NaiveDate, ensure: bool) -> Result<PathBuf, String> {
    let month_dir = month_dir_path(root, date.year(), date.month(), ensure)?;
    let dir = month_dir.ok_or_else(|| "failed to resolve month directory".to_string())?;
    Ok(dir.join(format!("{}.md", date.format(DATE_FORMAT))))
}

fn month_dir_path(
    root: &Path,
    year: i32,
    month: u32,
    ensure: bool,
) -> Result<Option<PathBuf>, String> {
    let year_dir = root.join(format!("{year:04}"));
    if ensure {
        ensure_dir(&year_dir)?;
    } else if !year_dir.exists() {
        return Ok(None);
    }

    let month_dir = year_dir.join(format!("{month:02}"));
    if ensure {
        ensure_dir(&month_dir)?;
    } else if !month_dir.exists() {
        return Ok(None);
    }

    Ok(Some(month_dir))
}

fn ensure_dir(path: &Path) -> Result<(), String> {
    fs::create_dir_all(path)
        .map_err(|err| format!("failed to create directory {}: {err}", path.display()))
}

fn parse_document(document: &str) -> Result<EntryRecord, String> {
    let sanitized = document.trim_start_matches('\u{feff}');
    let body_start = sanitized
        .strip_prefix("---\r\n")
        .or_else(|| sanitized.strip_prefix("---\n"))
        .ok_or_else(|| "entry missing opening frontmatter delimiter".to_string())?;

    let closing_marker = "\n---";
    let closing_idx = body_start
        .find(closing_marker)
        .ok_or_else(|| "entry missing closing frontmatter delimiter".to_string())?;
    let (frontmatter_block, rest) = body_start.split_at(closing_idx);
    let mut remainder = rest
        .strip_prefix(closing_marker)
        .ok_or_else(|| "entry closing delimiter malformed".to_string())?;

    while remainder.starts_with(['\r', '\n']) {
        remainder = &remainder[1..];
    }

    let summary: DiaryEntry = serde_yaml::from_str(frontmatter_block)
        .map_err(|err| format!("failed to parse diary metadata: {err}"))?;
    Ok(EntryRecord::new(summary, remainder.to_string()))
}
