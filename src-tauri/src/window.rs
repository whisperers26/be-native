use std::fs;

use crate::config::get;
use crate::config::set;
use crate::placement::{beside, inside, Rect};
use crate::StringWrapper;
use crate::APP;
use dirs::cache_dir;
use log::{info, warn};
use mouse_position::mouse_position::{Mouse, Position};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Manager;
use tauri::Monitor;
use tauri::Window;
use tauri::WindowBuilder;
#[cfg(any(target_os = "macos", target_os = "windows"))]
use window_shadows::set_shadow;

// Test mode lets the app be tested in the background: windows open on the secondary monitor and
// never take the focus. The HTTP API switches it, in debug builds only.
static TEST_MODE: AtomicBool = AtomicBool::new(false);

pub fn set_test_mode(on: bool) {
    info!("Test mode: {}", on);
    TEST_MODE.store(on, Ordering::Relaxed);
}

// Whether test mode is on. The Translate window asks, to translate with a free service only.
#[tauri::command]
pub fn test_mode() -> bool {
    TEST_MODE.load(Ordering::Relaxed)
}

// Get daemon window instance
fn get_daemon_window() -> Window {
    let app_handle = APP.get().unwrap();
    match app_handle.get_window("daemon") {
        Some(v) => v,
        None => {
            warn!("Daemon window not found, create new daemon window!");
            WindowBuilder::new(
                app_handle,
                "daemon",
                tauri::WindowUrl::App("daemon.html".into()),
            )
            .title("Daemon")
            .additional_browser_args("--disable-web-security")
            .visible(false)
            .build()
            .unwrap()
        }
    }
}

// Find the monitor that contains a physical position
fn monitor_at(x: i32, y: i32) -> Option<Monitor> {
    let monitors = get_daemon_window().available_monitors().unwrap();

    for m in monitors {
        let size = m.size();
        let position = m.position();

        if x >= position.x
            && x <= (position.x + size.width as i32)
            && y >= position.y
            && y <= (position.y + size.height as i32)
        {
            return Some(m);
        }
    }
    None
}

// Get monitor where the mouse is currently located
fn get_current_monitor(x: i32, y: i32) -> Monitor {
    info!("Mouse position: {}, {}", x, y);
    match monitor_at(x, y) {
        Some(m) => {
            info!("Current Monitor: {:?}", m);
            m
        }
        None => {
            warn!("Current Monitor not found, using primary monitor");
            get_daemon_window().primary_monitor().unwrap().unwrap()
        }
    }
}

// The cursor's physical position and the origin of the monitor under it. The screenshot window polls
// this to follow the cursor to another monitor, which it cannot see through its own mouse events.
#[tauri::command(async)]
pub fn cursor_position() -> Result<serde_json::Value, String> {
    let Mouse::Position { x, y } = Mouse::get_mouse_position() else {
        return Err("Mouse position not found".to_string());
    };
    let monitor = monitor_at(x, y).ok_or("Monitor not found")?;
    let origin = monitor.position();
    Ok(serde_json::json!({ "x": x, "y": y, "monitor": { "x": origin.x, "y": origin.y } }))
}

// The centre of the first monitor that is not the primary one, or of the primary one if it is alone
fn secondary_monitor_centre() -> Position {
    let daemon = get_daemon_window();
    let primary = daemon.primary_monitor().unwrap().unwrap();
    let monitors = daemon.available_monitors().unwrap();
    let monitor = monitors
        .iter()
        .find(|m| m.position() != primary.position())
        .unwrap_or(&primary);
    Position {
        x: monitor.position().x + (monitor.size().width / 2) as i32,
        y: monitor.position().y + (monitor.size().height / 2) as i32,
    }
}

// Show a window without making it the active one
#[cfg(target_os = "windows")]
fn show_inactive(window: &Window) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{ShowWindow, SW_SHOWNOACTIVATE};

    let Ok(hwnd) = window.hwnd() else {
        warn!("Window handle not found: {}", window.label());
        return;
    };
    unsafe {
        let _ = ShowWindow(HWND(hwnd.0 as _), SW_SHOWNOACTIVATE);
    }
}

#[cfg(not(target_os = "windows"))]
fn show_inactive(window: &Window) {
    window.show().unwrap_or_default();
}

// The frontend shows and focuses its window through these two, so that test mode can keep the
// window from taking the focus. A window that never had the focus cannot lose it either, so the
// ones that close on blur stay open.
#[tauri::command]
pub fn show_window(window: Window) {
    if TEST_MODE.load(Ordering::Relaxed) {
        show_inactive(&window);
    } else {
        window.show().unwrap_or_default();
    }
}

#[tauri::command]
pub fn focus_window(window: Window) {
    if !TEST_MODE.load(Ordering::Relaxed) {
        window.set_focus().unwrap_or_default();
    }
}

// The part of the monitor that windows may cover: on Windows the work area, which leaves out the
// taskbar
#[cfg(target_os = "windows")]
fn usable_area(monitor: &Monitor) -> Rect {
    use windows::Win32::Foundation::POINT;
    use windows::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromPoint, MONITORINFO, MONITOR_DEFAULTTONEAREST,
    };

    let centre = POINT {
        x: monitor.position().x + (monitor.size().width / 2) as i32,
        y: monitor.position().y + (monitor.size().height / 2) as i32,
    };
    let mut info = MONITORINFO {
        cbSize: std::mem::size_of::<MONITORINFO>() as u32,
        ..Default::default()
    };
    let found = unsafe {
        GetMonitorInfoW(
            MonitorFromPoint(centre, MONITOR_DEFAULTTONEAREST),
            &mut info,
        )
    };
    if !found.as_bool() {
        warn!("Work area not found, using the whole monitor");
        return whole_monitor(monitor);
    }
    let area = info.rcWork;
    Rect {
        x: area.left,
        y: area.top,
        width: area.right - area.left,
        height: area.bottom - area.top,
    }
}

#[cfg(not(target_os = "windows"))]
fn usable_area(monitor: &Monitor) -> Rect {
    whole_monitor(monitor)
}

fn whole_monitor(monitor: &Monitor) -> Rect {
    Rect {
        x: monitor.position().x,
        y: monitor.position().y,
        width: monitor.size().width as i32,
        height: monitor.size().height as i32,
    }
}

// The physical position that decides where a new window goes: the mouse, or in test mode the
// centre of the secondary monitor, which keeps the windows off the screen the owner works on
fn placement_point() -> Position {
    if TEST_MODE.load(Ordering::Relaxed) {
        return secondary_monitor_centre();
    }
    match Mouse::get_mouse_position() {
        Mouse::Position { x, y } => Position { x, y },
        Mouse::Error => {
            warn!("Mouse position not found, using (0, 0) as default");
            Position { x: 0, y: 0 }
        }
    }
}

// Creating a window on the mouse monitor
fn build_window(label: &str, title: &str) -> (Window, bool) {
    let mouse_position = placement_point();
    let current_monitor = get_current_monitor(mouse_position.x, mouse_position.y);
    let position = current_monitor.position();

    let test_mode = TEST_MODE.load(Ordering::Relaxed);

    let app_handle = APP.get().unwrap();
    match app_handle.get_window(label) {
        Some(v) => {
            info!("Window existence: {}", label);
            if !test_mode {
                v.set_focus().unwrap();
            }
            (v, true)
        }
        None => {
            info!("Window not existence, Creating new window: {}", label);
            let mut builder = tauri::WindowBuilder::new(
                app_handle,
                label,
                tauri::WindowUrl::App("index.html".into()),
            )
            .position(position.x.into(), position.y.into())
            .additional_browser_args("--disable-web-security")
            .focused(!test_mode)
            .title(title)
            .visible(false);

            #[cfg(target_os = "macos")]
            {
                builder = builder
                    .title_bar_style(tauri::TitleBarStyle::Overlay)
                    .hidden_title(true);
            }
            #[cfg(not(target_os = "macos"))]
            {
                builder = builder.transparent(true).decorations(false);
            }
            let window = builder.build().unwrap();

            if label != "screenshot" {
                #[cfg(not(target_os = "linux"))]
                set_shadow(&window, true).unwrap_or_default();
            }
            let _ = window.current_monitor();
            (window, false)
        }
    }
}

pub fn config_window() {
    let (window, _exists) = build_window("config", "Config");
    window
        .set_min_size(Some(tauri::LogicalSize::new(800, 400)))
        .unwrap();
    window.set_size(tauri::LogicalSize::new(800, 600)).unwrap();
    window.center().unwrap();
}

// The gap between a window and what it is placed beside, in logical pixels
const PLACEMENT_GAP: f64 = 8.0;

// What the `smart` position put the Translate window beside, and where it put it
static TRANSLATE_PLACED: std::sync::Mutex<Option<(Rect, (i32, i32))>> =
    std::sync::Mutex::new(None);

// `region` is what the text came from, if it came from a place on the screen. The `smart` position
// puts the window beside it.
fn translate_window(region: Option<Rect>) -> Window {
    // Mouse physical position
    let mut mouse_position = placement_point();
    let (window, exists) = build_window("translate", "Translate");
    if exists {
        return window;
    }
    window.set_skip_taskbar(true).unwrap();
    *TRANSLATE_PLACED.lock().unwrap() = None;
    // Get Translate Window Size
    let width = match get("translate_window_width") {
        Some(v) => v.as_i64().unwrap(),
        None => {
            set("translate_window_width", 350);
            350
        }
    };
    let height = match get("translate_window_height") {
        Some(v) => v.as_i64().unwrap(),
        None => {
            set("translate_window_height", 420);
            420
        }
    };

    let monitor = window.current_monitor().unwrap().unwrap();
    let dpi = monitor.scale_factor();

    let position_type = match get("translate_window_position") {
        Some(v) => v.as_str().unwrap().to_string(),
        None => "smart".to_string(),
    };

    match position_type.as_str() {
        "smart" => {
            // Beside the region, or beside the cursor when there is no region
            let anchor = region.unwrap_or(Rect {
                x: mouse_position.x,
                y: mouse_position.y,
                width: 0,
                height: 0,
            });
            let (x, y) = beside(
                anchor,
                (width as f64 * dpi) as i32,
                (height as f64 * dpi) as i32,
                usable_area(&monitor),
                (PLACEMENT_GAP * dpi) as i32,
            );
            window
                .set_position(tauri::PhysicalPosition::new(x, y))
                .unwrap();
            *TRANSLATE_PLACED.lock().unwrap() = Some((anchor, (x, y)));
        }
        "mouse" => {
            // Adjust window position
            let monitor_size = monitor.size();
            let monitor_size_width = monitor_size.width as f64;
            let monitor_size_height = monitor_size.height as f64;
            let monitor_position = monitor.position();
            let monitor_position_x = monitor_position.x as f64;
            let monitor_position_y = monitor_position.y as f64;

            if mouse_position.x as f64 + width as f64 * dpi
                > monitor_position_x + monitor_size_width
            {
                mouse_position.x -= (width as f64 * dpi) as i32;
                if (mouse_position.x as f64) < monitor_position_x {
                    mouse_position.x = monitor_position_x as i32;
                }
            }
            if mouse_position.y as f64 + height as f64 * dpi
                > monitor_position_y + monitor_size_height
            {
                mouse_position.y -= (height as f64 * dpi) as i32;
                if (mouse_position.y as f64) < monitor_position_y {
                    mouse_position.y = monitor_position_y as i32;
                }
            }

            window
                .set_position(tauri::PhysicalPosition::new(
                    mouse_position.x,
                    mouse_position.y,
                ))
                .unwrap();
        }
        _ => {
            let position_x = match get("translate_window_position_x") {
                Some(v) => v.as_i64().unwrap(),
                None => 0,
            };
            let position_y = match get("translate_window_position_y") {
                Some(v) => v.as_i64().unwrap(),
                None => 0,
            };
            window
                .set_position(tauri::PhysicalPosition::new(
                    (position_x as f64) * dpi,
                    (position_y as f64) * dpi,
                ))
                .unwrap();
        }
    }

    // The size is set once the window is where it stays. A window that moves to a monitor with
    // another scale is resized on the way (known-issues.md), so a size set before the move came
    // out wrong there.
    window
        .set_size(tauri::LogicalSize::new(width as f64, height as f64))
        .unwrap();

    window
}

// Give the Translate window the size it asks for, in logical pixels, and keep it on its monitor. A
// window still where the `smart` position put it is placed again for its new size, so that it does
// not grow over what it was put beside.
#[tauri::command(async)]
pub fn fit_translate_window(window: Window, width: f64, height: f64) {
    let Ok(Some(monitor)) = window.current_monitor() else {
        warn!("Monitor not found, the Translate window keeps its size");
        return;
    };
    let Ok(current) = window.outer_position() else {
        return;
    };
    let scale = monitor.scale_factor();
    // Rounded up, so that a fraction of a pixel cut off does not leave something to scroll
    let width = (width * scale).ceil() as i32;
    let height = (height * scale).ceil() as i32;
    let area = usable_area(&monitor);

    let mut placed = TRANSLATE_PLACED.lock().unwrap();
    let (x, y) = match placed.as_mut() {
        Some((anchor, corner)) if *corner == (current.x, current.y) => {
            *corner = beside(
                *anchor,
                width,
                height,
                area,
                (PLACEMENT_GAP * scale) as i32,
            );
            *corner
        }
        _ => inside(current.x, current.y, width, height, area),
    };
    window
        .set_size(tauri::PhysicalSize::new(width, height))
        .unwrap_or_default();
    if (x, y) != (current.x, current.y) {
        window
            .set_position(tauri::PhysicalPosition::new(x, y))
            .unwrap_or_default();
    }
}

pub fn selection_translate() {
    use selection::get_text;
    // Get Selected Text
    let text = get_text();
    if !text.trim().is_empty() {
        let app_handle = APP.get().unwrap();
        // Write into State
        let state: tauri::State<StringWrapper> = app_handle.state();
        state.0.lock().unwrap().replace_range(.., &text);
    }

    let window = translate_window(None);
    window.emit("new_text", text).unwrap();
}

pub fn input_translate() {
    let app_handle = APP.get().unwrap();
    // Clear State
    let state: tauri::State<StringWrapper> = app_handle.state();
    state
        .0
        .lock()
        .unwrap()
        .replace_range(.., "[INPUT_TRANSLATE]");
    let window = translate_window(None);
    let position_type = match get("translate_window_position") {
        Some(v) => v.as_str().unwrap().to_string(),
        None => "smart".to_string(),
    };
    if position_type == "smart" || position_type == "mouse" {
        window.center().unwrap();
    }

    window.emit("new_text", "[INPUT_TRANSLATE]").unwrap();
}

pub fn text_translate(text: String) {
    let app_handle = APP.get().unwrap();
    // Clear State
    let state: tauri::State<StringWrapper> = app_handle.state();
    state.0.lock().unwrap().replace_range(.., &text);
    let window = translate_window(None);
    window.emit("new_text", text).unwrap();
}

pub fn image_translate() {
    let app_handle = APP.get().unwrap();
    let state: tauri::State<StringWrapper> = app_handle.state();
    state
        .0
        .lock()
        .unwrap()
        .replace_range(.., "[IMAGE_TRANSLATE]");
    // In test mode the window stays on the secondary monitor, wherever the region was
    let region = crate::screenshot::take_region().filter(|_| !TEST_MODE.load(Ordering::Relaxed));
    let window = translate_window(region);
    window.emit("new_text", "[IMAGE_TRANSLATE]").unwrap();
}

pub fn recognize_window() {
    let (window, exists) = build_window("recognize", "Recognize");
    if exists {
        window.emit("new_image", "").unwrap();
        return;
    }
    let width = match get("recognize_window_width") {
        Some(v) => v.as_i64().unwrap(),
        None => {
            set("recognize_window_width", 800);
            800
        }
    };
    let height = match get("recognize_window_height") {
        Some(v) => v.as_i64().unwrap(),
        None => {
            set("recognize_window_height", 400);
            400
        }
    };
    let monitor = window.current_monitor().unwrap().unwrap();
    let dpi = monitor.scale_factor();
    window
        .set_size(tauri::PhysicalSize::new(
            (width as f64) * dpi,
            (height as f64) * dpi,
        ))
        .unwrap();
    window.center().unwrap();
    window.emit("new_image", "").unwrap();
}

// A window that is never shown: it copies the text of the cut screenshot and closes itself
pub fn silent_recognize_window() {
    let (window, exists) = build_window("silent_recognize", "Silent Recognize");
    if exists {
        window.emit("new_image", "").unwrap();
        return;
    }
    window.set_skip_taskbar(true).unwrap();
}

#[cfg(target_os = "windows")]
unsafe extern "system" fn no_title_bar_proc(
    hwnd: windows::Win32::Foundation::HWND,
    msg: u32,
    wparam: windows::Win32::Foundation::WPARAM,
    lparam: windows::Win32::Foundation::LPARAM,
    id: usize,
    _data: usize,
) -> windows::Win32::Foundation::LRESULT {
    use windows::Win32::Foundation::{LPARAM, LRESULT};
    use windows::Win32::UI::Shell::{DefSubclassProc, RemoveWindowSubclass};
    use windows::Win32::UI::WindowsAndMessaging::{WM_NCACTIVATE, WM_NCDESTROY, WM_NCPAINT};

    match msg {
        // -1 keeps the default handler from repainting the non-client area
        WM_NCACTIVATE => DefSubclassProc(hwnd, msg, wparam, LPARAM(-1)),
        WM_NCPAINT => LRESULT(0),
        WM_NCDESTROY => {
            let _ = RemoveWindowSubclass(hwnd, Some(no_title_bar_proc), id);
            DefSubclassProc(hwnd, msg, wparam, lparam)
        }
        _ => DefSubclassProc(hwnd, msg, wparam, lparam),
    }
}

// Windows paints an old-style title bar on the frameless full-screen window when it is
// activated, which shows until the WebView has drawn over it
#[cfg(target_os = "windows")]
fn suppress_title_bar(window: &Window) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::Shell::SetWindowSubclass;

    let Ok(hwnd) = window.hwnd() else {
        warn!("Screenshot window handle not found");
        return;
    };
    let hwnd = hwnd.0 as isize;
    // A window can only be subclassed from the thread that owns it
    window
        .run_on_main_thread(move || unsafe {
            let _ = SetWindowSubclass(HWND(hwnd as _), Some(no_title_bar_proc), 1, 0);
        })
        .unwrap_or_default();
}

#[cfg(not(target_os = "macos"))]
fn screenshot_window() -> Window {
    let (window, _exists) = build_window("screenshot", "Screenshot");
    #[cfg(target_os = "windows")]
    suppress_title_bar(&window);

    window.set_skip_taskbar(true).unwrap();
    #[cfg(target_os = "macos")]
    {
        let monitor = window.current_monitor().unwrap().unwrap();
        let size = monitor.size();
        window.set_decorations(false).unwrap();
        window.set_size(*size).unwrap();
    }

    #[cfg(not(target_os = "macos"))]
    window.set_fullscreen(true).unwrap();

    window.set_always_on_top(true).unwrap();
    window
}

// The listener of the last capture. Tauri keeps a closed window's listeners, so one left behind by
// a cancelled capture would run its action after the next capture.
#[cfg(not(target_os = "macos"))]
static REGION_LISTENER: std::sync::Mutex<Option<tauri::EventHandler>> = std::sync::Mutex::new(None);

// Run `action` once the screenshot window reports that the region has been cut
#[cfg(not(target_os = "macos"))]
fn on_region_selected(window: &Window, action: fn()) {
    let mut listener = REGION_LISTENER.lock().unwrap();
    if let Some(id) = listener.take() {
        window.unlisten(id);
    }
    *listener = Some(window.listen("success", move |_| action()));
}

pub fn ocr_recognize() {
    #[cfg(target_os = "macos")]
    {
        let app_handle = APP.get().unwrap();
        let mut app_cache_dir_path = cache_dir().expect("Get Cache Dir Failed");
        app_cache_dir_path.push(&app_handle.config().tauri.bundle.identifier);
        if !app_cache_dir_path.exists() {
            // 创建目录
            fs::create_dir_all(&app_cache_dir_path).expect("Create Cache Dir Failed");
        }
        app_cache_dir_path.push("pot_screenshot_cut.png");

        let path = app_cache_dir_path.to_string_lossy().replace("\\\\?\\", "");
        println!("Screenshot path: {}", path);
        if let Ok(_output) = std::process::Command::new("/usr/sbin/screencapture")
            .arg("-i")
            .arg("-r")
            .arg(path)
            .output()
        {
            recognize_window();
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        on_region_selected(&screenshot_window(), recognize_window);
    }
}
pub fn ocr_copy() {
    #[cfg(target_os = "macos")]
    {
        let app_handle = APP.get().unwrap();
        let mut app_cache_dir_path = cache_dir().expect("Get Cache Dir Failed");
        app_cache_dir_path.push(&app_handle.config().tauri.bundle.identifier);
        if !app_cache_dir_path.exists() {
            // 创建目录
            fs::create_dir_all(&app_cache_dir_path).expect("Create Cache Dir Failed");
        }
        app_cache_dir_path.push("pot_screenshot_cut.png");

        let path = app_cache_dir_path.to_string_lossy().replace("\\\\?\\", "");
        println!("Screenshot path: {}", path);
        if let Ok(_output) = std::process::Command::new("/usr/sbin/screencapture")
            .arg("-i")
            .arg("-r")
            .arg(path)
            .output()
        {
            silent_recognize_window();
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        on_region_selected(&screenshot_window(), silent_recognize_window);
    }
}
pub fn ocr_translate() {
    #[cfg(target_os = "macos")]
    {
        let app_handle = APP.get().unwrap();
        let mut app_cache_dir_path = cache_dir().expect("Get Cache Dir Failed");
        app_cache_dir_path.push(&app_handle.config().tauri.bundle.identifier);
        if !app_cache_dir_path.exists() {
            // 创建目录
            fs::create_dir_all(&app_cache_dir_path).expect("Create Cache Dir Failed");
        }
        app_cache_dir_path.push("pot_screenshot_cut.png");

        let path = app_cache_dir_path.to_string_lossy().replace("\\\\?\\", "");
        println!("Screenshot path: {}", path);
        if let Ok(_output) = std::process::Command::new("/usr/sbin/screencapture")
            .arg("-i")
            .arg("-r")
            .arg(path)
            .output()
        {
            image_translate();
            ();
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        on_region_selected(&screenshot_window(), image_translate);
    }
}

#[tauri::command(async)]
pub fn updater_window() {
    let (window, _exists) = build_window("updater", "Updater");
    window
        .set_min_size(Some(tauri::LogicalSize::new(600, 400)))
        .unwrap();
    window.set_size(tauri::LogicalSize::new(600, 400)).unwrap();
    window.center().unwrap();
}
