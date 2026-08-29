/** 应用入口:插件、site:// 协议、命令注册 */
mod commands;
mod events;
mod fsutil;
mod state;

use std::borrow::Cow;

use tauri::http::{Request, Response, StatusCode};
use tauri::Manager;
use tauri::UriSchemeContext;

use state::AppState;

/* ---------- site:// 自定义协议:当前站点根目录的静态文件服务 ---------- */

fn mime_for(path: &str) -> &'static str {
    let ext = path.rsplit('.').next().unwrap_or("").to_ascii_lowercase();
    match ext.as_str() {
        "html" | "htm" => "text/html; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "md" => "text/markdown; charset=utf-8",
        "txt" => "text/plain; charset=utf-8",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        "wasm" => "application/wasm",
        "map" => "application/json",
        _ => "application/octet-stream",
    }
}

fn serve_response(status: StatusCode, mime: &str, body: Vec<u8>) -> Response<Cow<'static, [u8]>> {
    Response::builder()
        .status(status)
        .header("Content-Type", mime)
        .header("Cache-Control", "no-store")
        .body(Cow::Owned(body))
        .unwrap()
}

fn handle_site<R: tauri::Runtime>(
    ctx: UriSchemeContext<'_, R>,
    request: Request<Vec<u8>>,
) -> Response<Cow<'static, [u8]>> {
    let app = ctx.app_handle();
    let state = app.state::<AppState>();
    let root = match state.site_root.lock() {
        Ok(guard) => match guard.clone() {
            Some(root) => root,
            None => {
                return serve_response(StatusCode::NOT_FOUND, "text/plain; charset=utf-8", b"no site open".to_vec())
            }
        },
        Err(_) => return serve_response(StatusCode::INTERNAL_SERVER_ERROR, "text/plain; charset=utf-8", Vec::new()),
    };

    let raw = request.uri().path();
    let decoded = percent_encoding::percent_decode_str(raw).decode_utf8_lossy().to_string();
    let mut rel = decoded.trim_start_matches('/').trim_end_matches('/').to_string();
    if rel.is_empty() {
        rel = "build/index.html".into();
    }

    let full = match fsutil::safe_join(&root, &rel) {
        Ok(p) => p,
        Err(e) => return serve_response(StatusCode::FORBIDDEN, "text/plain; charset=utf-8", e.into_bytes()),
    };

    let target = if full.is_dir() {
        full.join("index.html")
    } else {
        full
    };

    if !target.is_file() {
        return serve_response(StatusCode::NOT_FOUND, "text/plain; charset=utf-8", format!("not found: {rel}").into_bytes());
    }

    match std::fs::read(&target) {
        Ok(bytes) => {
            let mime = mime_for(&target.to_string_lossy());
            serve_response(StatusCode::OK, mime, bytes)
        }
        Err(_) => serve_response(StatusCode::NOT_FOUND, "text/plain; charset=utf-8", Vec::new()),
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|_app, _argv, _cwd| {}))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(AppState::default())
        .register_uri_scheme_protocol("site", handle_site)
        .invoke_handler(tauri::generate_handler![
            // 应用
            commands::get_bootstrap,
            commands::save_settings,
            commands::log_frontend,
            commands::check_update,
            // 站点
            commands::create_site,
            commands::open_site,
            commands::close_site,
            commands::get_site_root,
            commands::read_site_config,
            commands::save_site_config,
            commands::set_site_logo,
            commands::remove_site_logo,
            // 内容
            commands::list_tree,
            commands::read_docs,
            commands::save_doc,
            commands::create_doc,
            commands::create_folder,
            commands::rename_item,
            commands::move_item,
            commands::delete_item,
            commands::import_files,
            // 构建
            commands::clear_build,
            commands::write_build_files,
            commands::copy_paths,
            // 主题
            commands::list_custom_themes,
            commands::read_theme_files,
            commands::save_theme_files,
            commands::create_custom_theme,
            commands::delete_theme,
            commands::import_theme_zip,
            commands::export_theme_zip,
            // GitHub
            commands::github_read_config,
            commands::github_save_config,
            commands::github_verify,
            commands::github_sync,
            // 系统
            commands::open_path,
            commands::open_external,
            commands::reload_webview,
        ])
        .setup(|app| {
            let state = app.state::<AppState>();
            if let Ok(dir) = app.path().app_data_dir() {
                let _ = std::fs::create_dir_all(&dir);
                if let Ok(mut guard) = state.app_data_dir.lock() {
                    *guard = dir;
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running plainstruct");
}
