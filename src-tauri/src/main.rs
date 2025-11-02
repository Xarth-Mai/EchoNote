//! EchoNote 应用程序入口
//!
//! 这是 EchoNote Tauri 应用的主入口点。

// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    echonote_lib::run()
}
