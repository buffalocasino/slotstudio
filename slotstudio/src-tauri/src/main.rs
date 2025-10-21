#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    ffi::OsStr,
    fs,
    path::{Path, PathBuf},
};

#[tauri::command]
fn read_project_dir(path: String) -> Result<Vec<String>, String> {
    fs::read_dir(path)
        .map_err(|error| error.to_string())?
        .filter_map(|entry| entry.ok())
        .map(|entry| {
            entry
                .file_name()
                .into_string()
                .map_err(|_| String::from("Invalid UTF-8 in file name"))
        })
        .collect()
}

fn unique_destination(mut dest: PathBuf) -> PathBuf {
    if !dest.exists() {
        return dest;
    }

    let parent = dest.parent().map(Path::to_path_buf).unwrap_or_default();
    let file_stem = dest
        .file_stem()
        .and_then(OsStr::to_str)
        .unwrap_or("asset")
        .to_string();
    let extension = dest
        .extension()
        .and_then(OsStr::to_str)
        .map(|ext| format!(".{}", ext))
        .unwrap_or_default();

    let mut counter = 1;
    loop {
        let candidate =
            parent.join(format!("{}-{}{}", file_stem, counter, extension));
        if !candidate.exists() {
            return candidate;
        }
        counter += 1;
    }
}

#[tauri::command]
fn import_assets(paths: Vec<String>) -> Result<Vec<String>, String> {
    if paths.is_empty() {
        return Ok(Vec::new());
    }

    let project_root = std::env::current_dir().map_err(|e| e.to_string())?;
    let static_dir = project_root.join("static").join("imports");
    fs::create_dir_all(&static_dir).map_err(|e| e.to_string())?;

    let mut imported = Vec::new();

    for source_str in paths {
        let source_path = PathBuf::from(&source_str);
        if !source_path.exists() {
            return Err(format!("Asset not found: {}", source_str));
        }

        let file_name = source_path
            .file_name()
            .ok_or_else(|| format!("Invalid asset path: {}", source_str))?;

        let destination = unique_destination(static_dir.join(file_name));
        fs::copy(&source_path, &destination)
            .map_err(|e| format!("Failed to copy asset: {}", e))?;

        if let Ok(relative) = destination.strip_prefix(&project_root) {
            imported.push(relative.to_string_lossy().to_string());
        } else {
            imported.push(destination.to_string_lossy().to_string());
        }
    }

    Ok(imported)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![read_project_dir, import_assets])
        .run(tauri::generate_context!())
        .expect("error while running Slot Studio");
}
