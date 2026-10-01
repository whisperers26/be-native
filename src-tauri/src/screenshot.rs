use crate::placement::Rect;
use log::info;
use std::sync::Mutex;

// The origin of the monitor that was captured last, and the region that was cut from the capture
// last. Together they say where on the desktop the user selected.
static ORIGIN: Mutex<(i32, i32)> = Mutex::new((0, 0));
static REGION: Mutex<Option<Rect>> = Mutex::new(None);

// Remember the region cut from the last capture, given in the capture's own pixels
pub fn set_region(left: u32, top: u32, width: u32, height: u32) {
    let (x, y) = *ORIGIN.lock().unwrap();
    *REGION.lock().unwrap() = Some(Rect {
        x: x + left as i32,
        y: y + top as i32,
        width: width as i32,
        height: height as i32,
    });
}

// The region selected last, in physical desktop pixels. It is handed out once, so that a later
// window is not placed beside a selection made long ago.
pub fn take_region() -> Option<Rect> {
    REGION.lock().unwrap().take()
}

#[tauri::command]
pub fn screenshot(x: i32, y: i32) {
    use crate::APP;
    use dirs::cache_dir;
    use screenshots::{Compression, Screen};
    use std::fs;
    info!("Screenshot screen with position: x={}, y={}", x, y);
    let screens = Screen::all().unwrap();
    for screen in screens {
        let info = screen.display_info;
        info!("Screen: {:?}", info);
        if info.x == x && info.y == y {
            *ORIGIN.lock().unwrap() = (x, y);
            let handle = APP.get().unwrap();
            let mut app_cache_dir_path = cache_dir().expect("Get Cache Dir Failed");
            app_cache_dir_path.push(&handle.config().tauri.bundle.identifier);
            if !app_cache_dir_path.exists() {
                // 创建目录
                fs::create_dir_all(&app_cache_dir_path).expect("Create Cache Dir Failed");
            }
            app_cache_dir_path.push("pot_screenshot.png");

            let image = screen.capture().unwrap();
            let buffer = image.to_png(Compression::Fast).unwrap();
            fs::write(app_cache_dir_path, buffer).unwrap();
            break;
        }
    }
}
