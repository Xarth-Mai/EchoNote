//! EchoNote Tauri 应用核心库
//!
//! 提供 Tauri 应用的初始化和启动功能。

/// 启动 Tauri 应用
///
/// 初始化并运行 Tauri 应用，配置必要的插件和命令处理器。
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
