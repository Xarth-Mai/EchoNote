//! EchoNote Tauri Core Lib

mod ai_migration;
mod ai_prefs;
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
        .plugin(tauri_plugin_store::Builder::default().build())
        // 注册允许前端调用的指令，新增命令需在此同步登记。
        .invoke_handler(tauri::generate_handler![
            commands::list_entries_by_month,
            commands::get_entry_body_by_date,
            commands::save_entry_by_date,
            commands::invoke_ai_chat,
            commands::invoke_generate_hero_greeting,
            commands::list_ai_models,
            commands::store_api_secret,
            commands::delete_api_secret,
        ])
        .setup(|app| {
            if let Err(err) = ai_migration::migrate_if_needed(&app.handle()) {
                eprintln!("[EchoNote] AI config migration skipped: {err}");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
