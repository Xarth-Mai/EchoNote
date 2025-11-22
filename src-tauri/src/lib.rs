//! EchoNote Tauri Core Lib

mod ai_provider;
mod commands;
mod entry_service;
mod models;
mod security;
mod storage;

/// Init and Run Tauri App
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 注册允许前端调用的指令，新增命令需在此同步登记。
        .invoke_handler(tauri::generate_handler![
            commands::list_entries_by_month,
            commands::get_entry_body_by_date,
            commands::save_entry_by_date,
            commands::invoke_ai_chat,
            commands::list_ai_models,
            commands::store_api_secret,
            commands::load_api_secret,
            commands::delete_api_secret,
            commands::load_cached_models,
            commands::load_provider_base_url,
            commands::store_provider_base_url,
            commands::delete_provider_slot,
            commands::store_provider_model,
            commands::load_provider_model,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
