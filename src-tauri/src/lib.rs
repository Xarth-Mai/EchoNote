//! EchoNote Tauri Core Lib

mod commands;

/// Init and Run Tauri App
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::list_entries_by_month,
            commands::get_entry_body_by_date,
            commands::save_entry_by_date,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
