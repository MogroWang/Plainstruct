/** 内容命令:文件树、文档读写、增删改移、导入 */
use serde::Serialize;
use std::path::PathBuf;
use tauri::State;

use crate::fsutil::{is_importable, rel_posix, safe_join, safe_name, unique_path};
use crate::state::AppState;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TreeNode {
    pub name: String,
    pub path: String,
    #[serde(rename = "type")]
    pub node_type: String,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub children: Vec<TreeNode>,
}

fn content_root(root: &PathBuf) -> PathBuf {
    root.join("content")
}

/// 递归构建内容树:目录优先,保持文件系统原始顺序
fn walk(dir: &PathBuf, rel: &str) -> Vec<TreeNode> {
    let mut dirs: Vec<(String, PathBuf)> = Vec::new();
    let mut files: Vec<(String, PathBuf)> = Vec::new();
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let Ok(ft) = entry.file_type() else { continue };
        if ft.is_dir() {
            dirs.push((name, entry.path()));
        } else if ft.is_file() {
            files.push((name, entry.path()));
        }
    }

    let mut nodes = Vec::new();
    for (name, path) in dirs {
        let child_rel = if rel.is_empty() { name.clone() } else { format!("{rel}/{name}") };
        let children = walk(&path, &child_rel);
        nodes.push(TreeNode {
            name,
            path: child_rel,
            node_type: "dir".into(),
            children,
        });
    }
    for (name, _) in files {
        let path = if rel.is_empty() { name.clone() } else { format!("{rel}/{name}") };
        nodes.push(TreeNode {
            name,
            path,
            node_type: "file".into(),
            children: Vec::new(),
        });
    }
    nodes
}

#[tauri::command]
pub fn list_tree(state: State<'_, AppState>) -> Result<Vec<TreeNode>, String> {
    let root = state.site_root()?;
    Ok(walk(&content_root(&root), ""))
}

#[tauri::command]
pub fn read_docs(state: State<'_, AppState>, paths: Vec<String>) -> Result<Vec<String>, String> {
    let root = state.site_root()?;
    let content = content_root(&root);
    let mut out = Vec::with_capacity(paths.len());
    for p in &paths {
        let full = safe_join(&content, p)?;
        let bytes = std::fs::read(&full).map_err(|e| format!("读取 {p} 失败: {e}"))?;
        out.push(String::from_utf8_lossy(&bytes).to_string());
    }
    Ok(out)
}

#[tauri::command]
pub fn save_doc(state: State<'_, AppState>, path: String, content: String) -> Result<(), String> {
    let root = state.site_root()?;
    let full = safe_join(&content_root(&root), &path)?;
    if let Some(parent) = full.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&full, content).map_err(|e| format!("保存 {path} 失败: {e}"))
}

#[tauri::command]
pub fn create_doc(
    state: State<'_, AppState>,
    dir: String,
    name: String,
    title: Option<String>,
) -> Result<String, String> {
    let root = state.site_root()?;
    let content = content_root(&root);
    let parent = if dir.is_empty() { content.clone() } else { safe_join(&content, &dir)? };
    std::fs::create_dir_all(&parent).map_err(|e| e.to_string())?;

    let clean = safe_name(&name);
    let file_name = if clean.to_lowercase().ends_with(".md") { clean } else { format!("{clean}.md") };
    let mut target = unique_path(&parent.join(&file_name));
    // unique_path 可能返回已带序号的文件名,这里确保文件名以 .md 结尾
    if !target.to_string_lossy().to_lowercase().ends_with(".md") {
        target.set_extension("md");
    }

    let doc_title = title
        .filter(|t| !t.trim().is_empty())
        .unwrap_or_else(|| target.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default());
    let template = format!("---\ntitle: {doc_title}\n---\n\n正文。\n");
    std::fs::write(&target, template).map_err(|e| e.to_string())?;
    Ok(rel_posix(&content, &target))
}

#[tauri::command]
pub fn create_folder(state: State<'_, AppState>, parent: String, name: String) -> Result<String, String> {
    let root = state.site_root()?;
    let content = content_root(&root);
    let parent_dir = if parent.is_empty() { content.clone() } else { safe_join(&content, &parent)? };
    let target = unique_path(&parent_dir.join(safe_name(&name)));
    std::fs::create_dir_all(&target).map_err(|e| e.to_string())?;
    Ok(rel_posix(&content, &target))
}

#[tauri::command]
pub fn rename_item(state: State<'_, AppState>, path: String, new_name: String) -> Result<String, String> {
    let root = state.site_root()?;
    let content = content_root(&root);
    let full = safe_join(&content, &path)?;
    if !full.exists() {
        return Err(format!("不存在: {path}"));
    }
    let parent = full.parent().ok_or("非法路径")?.to_path_buf();
    let target = unique_path(&parent.join(safe_name(&new_name)));
    std::fs::rename(&full, &target).map_err(|e| e.to_string())?;
    Ok(rel_posix(&content, &target))
}

#[tauri::command]
pub fn move_item(state: State<'_, AppState>, src: String, dest_dir: String) -> Result<String, String> {
    let root = state.site_root()?;
    let content = content_root(&root);
    let src_full = safe_join(&content, &src)?;
    if !src_full.exists() {
        return Err(format!("不存在: {src}"));
    }
    let dest_parent = if dest_dir.is_empty() { content.clone() } else { safe_join(&content, &dest_dir)? };

    // 禁止把目录移动进自身子树
    let src_str = format!("{}", src_full.to_string_lossy());
    let dest_str = format!("{}", dest_parent.to_string_lossy());
    if dest_str.starts_with(&src_str) {
        return Err("invalid-move".into());
    }

    // 源已位于目标目录时为无操作:否则 unique_path 会因源文件自身占用目标名而生成 "-2" 副本名
    if src_full.parent() == Some(dest_parent.as_path()) {
        return Ok(src);
    }

    std::fs::create_dir_all(&dest_parent).map_err(|e| e.to_string())?;
    let name = src_full.file_name().ok_or("非法路径")?.to_os_string();
    let target = unique_path(&dest_parent.join(name));
    std::fs::rename(&src_full, &target).map_err(|e| e.to_string())?;
    Ok(rel_posix(&content, &target))
}

#[tauri::command]
pub fn delete_item(state: State<'_, AppState>, path: String) -> Result<(), String> {
    let root = state.site_root()?;
    let full = safe_join(&content_root(&root), &path)?;
    if !full.exists() {
        return Ok(());
    }
    trash::delete(&full).map_err(|e| format!("移入回收站失败: {e}"))
}

#[tauri::command]
pub fn import_files(state: State<'_, AppState>, src_paths: Vec<String>, dest_dir: String) -> Result<u32, String> {
    let root = state.site_root()?;
    let content = content_root(&root);
    let dest_parent = if dest_dir.is_empty() { content.clone() } else { safe_join(&content, &dest_dir)? };
    std::fs::create_dir_all(&dest_parent).map_err(|e| e.to_string())?;

    let mut count = 0;
    for src in &src_paths {
        let src_path = PathBuf::from(src);
        if !src_path.is_file() || !is_importable(&src_path) {
            continue;
        }
        let name = src_path.file_name().ok_or("非法路径")?.to_os_string();
        let target = unique_path(&dest_parent.join(name));
        std::fs::copy(&src_path, &target).map_err(|e| e.to_string())?;
        count += 1;
    }
    Ok(count)
}
