// Writing improvement: the selected text is rewritten in the `writing` window, and the result the
// user picks there is pasted over the selection.

use crate::placement::{beside, Rect};
use crate::window::{build_window, placement_point, translate_area, PLACEMENT_GAP};
use crate::APP;
use log::info;
use std::sync::Mutex;
use tauri::api::notification::Notification;
use tauri::{Manager, Window};

// Text to be improved
pub struct WritingText(pub Mutex<String>);

// The size the Writing window opens at, in logical pixels. It keeps its width and gives itself the
// height of what it shows, through `fit_writing_window`.
const WRITING_SIZE: (f64, f64) = (460.0, 120.0);

// The window the selection was in, which gets the focus back for the paste
#[cfg(target_os = "windows")]
static SOURCE_WINDOW: std::sync::atomic::AtomicIsize = std::sync::atomic::AtomicIsize::new(0);

#[cfg(target_os = "windows")]
fn remember_source() {
    use std::sync::atomic::Ordering;
    use windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow;

    let foreground = unsafe { GetForegroundWindow() }.0 as isize;
    // The hotkey pressed in the Writing window itself leaves the app the text came from as it is
    let own = APP
        .get()
        .and_then(|app| app.get_window("writing"))
        .and_then(|window| window.hwnd().ok())
        .map(|hwnd| hwnd.0 as isize);
    if Some(foreground) != own {
        SOURCE_WINDOW.store(foreground, Ordering::SeqCst);
    }
}

#[cfg(not(target_os = "windows"))]
fn remember_source() {}

fn notify(title: &str, body: &str) {
    let app_handle = APP.get().unwrap();
    let _ = Notification::new(&app_handle.config().tauri.bundle.identifier)
        .title(title)
        .body(body)
        .icon("pot")
        .show();
}

// The Writing window: beside the cursor, so that it has the room below it to grow into
fn writing_window() -> Window {
    let point = placement_point();
    let (window, exists) = build_window("writing", "Writing");
    if exists {
        return window;
    }
    window.set_skip_taskbar(true).unwrap();
    let monitor = window.current_monitor().unwrap().unwrap();
    let scale = monitor.scale_factor();
    let (width, height) = WRITING_SIZE;
    let (x, y) = beside(
        Rect {
            x: point.x,
            y: point.y,
            width: 0,
            height: 0,
        },
        (width * scale) as i32,
        (height * scale) as i32,
        translate_area(&monitor),
        (PLACEMENT_GAP * scale) as i32,
    );
    window
        .set_position(tauri::PhysicalPosition::new(x, y))
        .unwrap();
    // Sized once it is where it stays, as the Translate window is
    window
        .set_size(tauri::LogicalSize::new(width, height))
        .unwrap();
    window
}

fn open(text: String) {
    let app_handle = APP.get().unwrap();
    let state: tauri::State<WritingText> = app_handle.state();
    state.0.lock().unwrap().replace_range(.., &text);
    let window = writing_window();
    window.emit("new_writing_text", text).unwrap();
}

// Improve the text selected in the app that has the focus
pub fn selection_writing() {
    remember_source();
    let text = selection::get_text();
    if text.trim().is_empty() {
        info!("Writing improvement: nothing is selected");
        notify(
            "Nothing is selected",
            "Select the text to improve, then press the shortcut.",
        );
        return;
    }
    open(text);
}

// Improve a text that did not come from a selection (the HTTP API)
pub fn text_writing(text: String) {
    if text.trim().is_empty() {
        return;
    }
    open(text);
}

#[tauri::command]
pub fn get_writing_text(state: tauri::State<WritingText>) -> String {
    state.0.lock().unwrap().to_string()
}
