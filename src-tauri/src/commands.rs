use tauri::AppHandle;

use crate::entry_service::{self, AiInvokePayload, ModelListRequest};
use crate::models::DiaryEntry;
use crate::openai::{OpenAiChatRequest, OpenAiChatResult};
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
pub async fn invoke_openai_chat(
    app: AppHandle,
    request: OpenAiChatRequest,
) -> Result<OpenAiChatResult, String> {
    entry_service::invoke_openai_chat(&app, request).await
}

#[tauri::command]
pub async fn list_ai_models(
    app: AppHandle,
    request: ModelListRequest,
) -> Result<Vec<String>, String> {
    entry_service::list_ai_models(&app, request).await
}

#[tauri::command]
pub async fn load_cached_models(
    app: AppHandle,
    provider_id: String,
) -> Result<Option<Vec<String>>, String> {
    crate::security::secrets::load_model_cache(&app, &provider_id)
}

#[tauri::command]
pub async fn load_provider_base_url(
    app: AppHandle,
    provider_id: String,
) -> Result<Option<String>, String> {
    crate::security::secrets::load_base_url(&app, &provider_id)
}

#[tauri::command]
pub async fn store_provider_base_url(
    app: AppHandle,
    provider_id: String,
    base_url: String,
) -> Result<(), String> {
    crate::security::secrets::save_base_url(&app, &provider_id, &base_url)
}

#[tauri::command]
pub async fn delete_provider_slot(app: AppHandle, provider_id: String) -> Result<(), String> {
    crate::security::secrets::delete_provider(&app, &provider_id)
}

#[tauri::command]
pub async fn store_provider_model(
    app: AppHandle,
    provider_id: String,
    model: String,
) -> Result<(), String> {
    crate::security::secrets::save_selected_model(&app, &provider_id, &model)
}

#[tauri::command]
pub async fn load_provider_model(
    app: AppHandle,
    provider_id: String,
) -> Result<Option<String>, String> {
    crate::security::secrets::load_selected_model(&app, &provider_id)
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
pub async fn load_api_secret(
    app: AppHandle,
    provider_id: String,
) -> Result<Option<String>, String> {
    secrets::load_api_key(&app, &provider_id)
}

#[tauri::command]
pub async fn delete_api_secret(app: AppHandle, provider_id: String) -> Result<(), String> {
    secrets::delete_api_key(&app, &provider_id)
}
