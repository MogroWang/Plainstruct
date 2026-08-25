/** 构建命令:清理/写出文本文件/拷贝资源 */
use serde::Deserialize;
use std::path::PathBuf;
use tauri::State;

use crate::fsutil::{rel_posix, safe_join};
use crate::state::AppState;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputFile {
    pub path: String,
    pub content: String,
}

#[derive(Deserialize)]
pub struct CopyItem {
    pub src: String,
    pub dest: String,
}

fn build_root(root: &PathBuf) -> PathBuf {
    root.join("build")
}

#[tauri::command]
pub fn clear_build(state: State<'_, AppState>) -> Result<(), String> {
    let root = state.site_root()?;
    let build = build_root(&root);
    if build.exists() {
        std::fs::remove_dir_all(&build).map_err(|e| e.to_string())?;
    }
    std::fs::create_dir_all(&build).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_build_files(state: State<'_, AppState>, files: Vec<OutputFile>) -> Result<(), String> {
    let root = state.site_root()?;
    let build = build_root(&root);
    std::fs::create_dir_all(&build).map_err(|e| e.to_string())?;
    for file in &files {
        let full = safe_join(&build, &file.path)?;
        if let Some(parent) = full.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        std::fs::write(&full, &file.content).map_err(|e| format!("写出 {} 失败: {e}", file.path))?;
    }
    Ok(())
}

fn copy_recursive(src: &PathBuf, dest: &PathBuf) -> Result<(), String> {
    if src.is_file() {
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        std::fs::copy(src, dest).map_err(|e| e.to_string())?;
        return Ok(());
    }
    for entry in walkdir::WalkDir::new(src).into_iter().filter_map(|e| e.ok()) {
        if !entry.file_type().is_file() {
            continue;
        }
        let rel = entry.path().strip_prefix(src).map_err(|e| e.to_string())?;
        let target = dest.join(rel);
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        std::fs::copy(entry.path(), &target).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn copy_paths(state: State<'_, AppState>, items: Vec<CopyItem>) -> Result<(), String> {
    let root = state.site_root()?;
    for item in &items {
        let src = safe_join(&root, &item.src)?;
        let dest = safe_join(&root, &item.dest)?;
        if !src.exists() {
            continue; // 资源缺失不阻断构建
        }
        if src.is_dir() {
            std::fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
            copy_recursive(&src, &dest)?;
        } else {
            if let Some(parent) = dest.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            std::fs::copy(&src, &dest).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// 供 GitHub 同步收集构建产物
pub fn collect_build_files(root: &PathBuf) -> Result<Vec<(String, Vec<u8>)>, String> {
    let build = build_root(root);
    if !build.exists() {
        return Err("build 目录不存在,请先构建".into());
    }
    let mut out = Vec::new();
    for entry in walkdir::WalkDir::new(&build).into_iter().filter_map(|e| e.ok()) {
        if !entry.file_type().is_file() {
            continue;
        }
        let rel = rel_posix(&build, entry.path());
        let bytes = std::fs::read(entry.path()).map_err(|e| e.to_string())?;
        out.push((rel, bytes));
    }
    Ok(out)
}
