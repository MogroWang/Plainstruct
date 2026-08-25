/** 应用级命令:bootstrap、设置、日志 */
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

use crate::state::AppState;

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RecentSite {
    pub name: String,
    pub path: String,
    pub opened_at: u64,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AppData {
    #[serde(default)]
    settings: Value,
    #[serde(default)]
    recent_sites: Vec<RecentSite>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Bootstrap {
    version: String,
    platform: String,
    app_data_dir: String,
    settings: Value,
    recent_sites: Vec<RecentSite>,
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

pub fn read_app_data(state: &AppState) -> AppData {
    let file = state.app_data().join("app.json");
    std::fs::read_to_string(&file)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn write_app_data(state: &AppState, data: &AppData) -> Result<(), String> {
    let dir = state.app_data();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let file = dir.join("app.json");
    let json = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
    std::fs::write(file, json).map_err(|e| e.to_string())
}

/// 记录最近打开的站点(置顶去重,最多 8 条)
pub fn touch_recent(state: &AppState, name: &str, path: &str) {
    let mut data = read_app_data(state);
    data.recent_sites.retain(|s| s.path != path);
    data.recent_sites.insert(
        0,
        RecentSite {
            name: name.to_string(),
            path: path.to_string(),
            opened_at: now_millis(),
        },
    );
    data.recent_sites.truncate(8);
    let _ = write_app_data(state, &data);
}

#[tauri::command]
pub fn get_bootstrap(state: State<'_, AppState>) -> Result<Bootstrap, String> {
    let data = read_app_data(&state);
    let platform = if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "unknown"
    };
    Ok(Bootstrap {
        version: env!("CARGO_PKG_VERSION").to_string(),
        platform: platform.to_string(),
        app_data_dir: state.app_data().to_string_lossy().to_string(),
        settings: if data.settings.is_null() {
            serde_json::json!({ "locale": "zh-CN", "autosave": true })
        } else {
            data.settings
        },
        recent_sites: data.recent_sites,
    })
}

#[tauri::command]
pub fn save_settings(state: State<'_, AppState>, patch: Value) -> Result<Value, String> {
    let mut data = read_app_data(&state);
    let obj = data.settings.as_object_mut().ok_or("settings 损坏")?;
    if let Some(patch_obj) = patch.as_object() {
        for (k, v) in patch_obj {
            obj.insert(k.clone(), v.clone());
        }
    }
    write_app_data(&state, &data)?;
    Ok(data.settings)
}

#[tauri::command]
pub fn log_frontend(msg: String) {
    println!("[frontend] {msg}");
}
