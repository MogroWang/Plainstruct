/** 全局状态:当前站点根目录、应用数据目录、共享 HTTP 客户端 */
use std::path::PathBuf;
use std::sync::Mutex;

pub struct AppState {
    pub site_root: Mutex<Option<PathBuf>>,
    pub app_data_dir: Mutex<PathBuf>,
    pub http: reqwest::Client,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            site_root: Mutex::new(None),
            app_data_dir: Mutex::new(PathBuf::new()),
            http: reqwest::Client::builder()
                .user_agent("Plainstruct")
                .build()
                .expect("failed to build http client"),
        }
    }
}

impl AppState {
    pub fn site_root(&self) -> Result<PathBuf, String> {
        self.site_root
            .lock()
            .map_err(|e| e.to_string())?
            .clone()
            .ok_or_else(|| "no-site-open".to_string())
    }

    pub fn app_data(&self) -> PathBuf {
        self.app_data_dir.lock().map(|p| p.clone()).unwrap_or_default()
    }
}
