/** 文件系统工具:路径安全校验与 POSIX 化 */
use std::path::{Component, Path, PathBuf};

/// 将相对路径安全地拼接到 root 下,拒绝绝对路径与 `..`
pub fn safe_join(root: &Path, rel: &str) -> Result<PathBuf, String> {
    let rel = rel.replace('\\', "/");
    let p = Path::new(&rel);
    if p.is_absolute() {
        return Err(format!("非法路径: {rel}"));
    }
    for comp in p.components() {
        match comp {
            Component::Normal(_) | Component::CurDir => {}
            _ => return Err(format!("非法路径: {rel}")),
        }
    }
    Ok(root.join(p))
}

/// 路径转为 POSIX 风格字符串(以 / 分隔)
pub fn to_posix(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

/// 相对 root 的 POSIX 路径
pub fn rel_posix(root: &Path, path: &Path) -> String {
    match path.strip_prefix(root) {
        Ok(rel) => to_posix(rel),
        Err(_) => to_posix(path),
    }
}

/// 文件名合法化:去掉 Windows 非法字符
pub fn safe_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .filter(|c| !matches!(c, '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|'))
        .map(|c| if c.is_control() { ' ' } else { c })
        .collect();
    let trimmed = cleaned.trim();
    if trimmed.is_empty() {
        "untitled".to_string()
    } else {
        trimmed.to_string()
    }
}

/// 生成不冲突的目标路径(存在则追加 -2/-3…)
pub fn unique_path(dest: &Path) -> PathBuf {
    if !dest.exists() {
        return dest.to_path_buf();
    }
    let stem = dest
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    let ext = dest.extension().map(|s| s.to_string_lossy().to_string());
    for i in 2..1000 {
        let name = match &ext {
            Some(e) => format!("{stem}-{i}.{e}"),
            None => format!("{stem}-{i}"),
        };
        let candidate = dest.with_file_name(name);
        if !candidate.exists() {
            return candidate;
        }
    }
    dest.to_path_buf()
}

/// 判断是否为可导入的内容文件(md / 图片)
pub fn is_importable(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_ascii_lowercase())
            .as_deref(),
        Some("md" | "markdown" | "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg")
    )
}
