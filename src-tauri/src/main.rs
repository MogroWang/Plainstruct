// 阻止 release 构建在 Windows 上弹出控制台窗口,勿删
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    plainstruct_lib::run()
}
