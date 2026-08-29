/** 系统命令:打开路径/外链、刷新指定 webview */
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
pub fn open_path(app: AppHandle, path: String) -> Result<(), String> {
    app.opener().open_path(path, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_external(app: AppHandle, url: String) -> Result<(), String> {
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err("仅支持 http/https 链接".into());
    }
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}

/// 原地刷新指定 webview(不销毁窗口,保持位置与尺寸),用于独立预览窗口加载最新构建产物
#[tauri::command]
pub fn reload_webview(app: AppHandle, label: String) -> Result<(), String> {
    let win = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("webview not found: {label}"))?;
    win.eval("window.location.reload()").map_err(|e| e.to_string())
}
