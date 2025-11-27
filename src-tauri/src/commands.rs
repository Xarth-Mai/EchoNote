//! Tauri command entrypoints that bridge front-end invokes to the Rust services.

use tauri::AppHandle;

use crate::ai_provider::{AiChatRequest, AiChatResult};
use crate::entry_service::{self, AiInvokePayload, AiModelListRequest, HeroGreetingRequest};
use crate::models::DiaryEntry;
use crate::security::secrets;

#[tauri::command]
pub async fn list_entries_by_month(
    app: AppHandle,
    year: u16,
    month: u8,
) -> Result<Vec<DiaryEntry>, String> {
    entry_service::list_entries_by_month(app, year, month)
}

#[tauri::command]
pub async fn get_entry_body_by_date(
    app: AppHandle,
    date: String,
) -> Result<Option<String>, String> {
    entry_service::get_entry_body_by_date(app, date)
}

#[tauri::command]
pub async fn save_entry_by_date(
    app: AppHandle,
    date: String,
    body: String,
    ai: Option<AiInvokePayload>,
) -> Result<DiaryEntry, String> {
    entry_service::save_entry_by_date(app, date, body, ai)
}

#[tauri::command]
pub async fn invoke_ai_chat(
    app: AppHandle,
    request: AiChatRequest,
) -> Result<AiChatResult, String> {
    entry_service::invoke_ai_chat(&app, request).await
}

#[tauri::command]
pub async fn invoke_generate_hero_greeting(
    app: AppHandle,
    request: HeroGreetingRequest,
) -> Result<String, String> {
    entry_service::generate_hero_greeting(&app, request).await
}

#[tauri::command]
pub async fn list_ai_models(
    app: AppHandle,
    request: AiModelListRequest,
) -> Result<Vec<String>, String> {
    entry_service::list_ai_models(&app, request).await
}

#[tauri::command]
pub async fn store_api_secret(
    app: AppHandle,
    provider_id: String,
    api_key: String,
) -> Result<(), String> {
    let trimmed = api_key.trim();
    if trimmed.is_empty() {
        return delete_api_secret(app, provider_id).await;
    }
    secrets::save_api_key(&app, &provider_id, trimmed)
}

#[tauri::command]
pub async fn delete_api_secret(app: AppHandle, provider_id: String) -> Result<(), String> {
    secrets::delete_api_key(&app, &provider_id)
}
