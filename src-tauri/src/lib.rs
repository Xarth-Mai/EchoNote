//! EchoNote Tauri Core Lib

mod commands;
mod models;
mod openai;
mod storage;

/// Init and Run Tauri App
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::list_entries_by_month,
            commands::get_entry_body_by_date,
            commands::save_entry_by_date,
            commands::invoke_openai_chat,
            commands::list_ai_models,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
