use std::path::Path;
use tauri::Manager;

/// The GTK version kept its work in `<config dir>/cheatsheet-maker/autosave.json`.
fn read_legacy_autosave(config_dir: &Path) -> Option<String> {
    std::fs::read_to_string(config_dir.join("cheatsheet-maker").join("autosave.json")).ok()
}

#[tauri::command]
fn legacy_autosave(app: tauri::AppHandle) -> Option<String> {
    read_legacy_autosave(&app.path().config_dir().ok()?)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![legacy_autosave])
        .run(tauri::generate_context!())
        .expect("Cheatsheet Maker failed to start");
}

#[cfg(test)]
mod tests {
    use super::read_legacy_autosave;

    #[test]
    fn reads_the_gtk_autosave_when_present() {
        let dir = std::env::temp_dir().join(format!("cm-legacy-{}", std::process::id()));
        assert_eq!(read_legacy_autosave(&dir), None);
        std::fs::create_dir_all(dir.join("cheatsheet-maker")).unwrap();
        std::fs::write(
            dir.join("cheatsheet-maker").join("autosave.json"),
            "{\"pages\":[]}",
        )
        .unwrap();
        assert_eq!(
            read_legacy_autosave(&dir).as_deref(),
            Some("{\"pages\":[]}")
        );
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
