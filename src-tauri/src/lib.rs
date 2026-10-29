use std::{fs, io::Read, path::PathBuf};
use tauri::{AppHandle, Manager};

const DB: &str = "study-tracker.db";
const PENDING: &str = "restore.pending";
const KEEP_AUTO: usize = 7;

fn config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_config_dir().map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
struct Backups {
    dir: String,
    files: Vec<String>,
}

/// Lists backup files (newest first) and prunes `auto-*` ones beyond the newest KEEP_AUTO.
#[tauri::command]
fn backups(app: AppHandle) -> Result<Backups, String> {
    let dir = config_dir(&app)?.join("backups");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let mut files: Vec<String> = fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok()?.file_name().into_string().ok())
        .filter(|n| n.ends_with(".db"))
        .collect();
    files.sort_by(|a, b| b.cmp(a));
    let old: Vec<String> = files.iter().filter(|n| n.starts_with("auto-")).skip(KEEP_AUTO).cloned().collect();
    for n in &old {
        let _ = fs::remove_file(dir.join(n));
    }
    files.retain(|n| !old.contains(n));
    Ok(Backups { dir: dir.to_string_lossy().into_owned(), files })
}

#[tauri::command]
fn write_text(path: String, contents: String) -> Result<(), String> {
    fs::write(path, contents).map_err(|e| e.to_string())
}

/// Validates `src` is a SQLite file and stages it; it replaces the live DB on next launch.
#[tauri::command]
fn stage_restore(app: AppHandle, src: String) -> Result<(), String> {
    let mut head = [0u8; 16];
    fs::File::open(&src).and_then(|mut f| f.read_exact(&mut head)).map_err(|e| e.to_string())?;
    if &head != b"SQLite format 3\0" {
        return Err("Not a SQLite database file.".into());
    }
    fs::copy(&src, config_dir(&app)?.join(PENDING)).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn restart_app(app: AppHandle) {
    app.restart();
}

fn apply_pending_restore(app: &AppHandle) -> Result<(), String> {
    let dir = config_dir(app)?;
    let pending = dir.join(PENDING);
    if pending.exists() {
        for ext in ["-wal", "-shm"] {
            let _ = fs::remove_file(dir.join(format!("{DB}{ext}")));
        }
        fs::rename(pending, dir.join(DB)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            if let Err(e) = apply_pending_restore(app.handle()) {
                eprintln!("restore failed: {e}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![backups, write_text, stage_restore, restart_app])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
