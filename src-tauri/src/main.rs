//! EchoNote Entrance

// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // 独立入口仅负责启动库中的 Tauri 构建逻辑。
    echonote_lib::run()
}
