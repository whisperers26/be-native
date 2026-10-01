use crate::config::{get, set};
use crate::window::updater_window;
use log::{info, warn};

pub fn check_update(app_handle: tauri::AppHandle) {
    // A debug build is built from the working tree, so no release is newer than it.
    if cfg!(debug_assertions) {
        info!("Debug build, skipping the update check");
        return;
    }
    let enable = match get("check_update") {
        Some(v) => v.as_bool().unwrap(),
        None => {
            set("check_update", true);
            true
        }
    };
    if enable {
        tauri::async_runtime::spawn(async move {
            match tauri::updater::builder(app_handle).check().await {
                Ok(update) => {
                    if update.is_update_available() {
                        info!("New version available");
                        updater_window();
                    }
                }
                Err(e) => {
                    warn!("Failed to check update: {}", e);
                }
            }
        });
    }
}
