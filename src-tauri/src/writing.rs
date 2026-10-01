// Writing improvement: the selected text is rewritten in the `writing` window, and the result the
// user picks there is pasted over the selection.

use crate::placement::{beside, inside, Rect};
use crate::window::{
    build_window, placement_point, set_rect, test_mode, translate_area, PLACEMENT_GAP,
};
use crate::APP;
use log::{info, warn};
use std::sync::Mutex;
use std::time::Duration;
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

// Give the focus back to the window the selection was in. Elsewhere than on Windows, hiding the
// Writing window does that.
#[cfg(target_os = "windows")]
fn focus_source() {
    use std::sync::atomic::Ordering;
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{IsWindow, SetForegroundWindow};

    let hwnd = HWND(SOURCE_WINDOW.load(Ordering::SeqCst) as _);
    unsafe {
        if IsWindow(hwnd).as_bool() {
            let _ = SetForegroundWindow(hwnd);
        } else {
            warn!("The window the selection was in is gone");
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn focus_source() {}

// Press the paste shortcut in the window that has the focus
#[cfg(target_os = "windows")]
fn paste() -> Result<(), String> {
    use enigo::{
        Direction::{Click, Press, Release},
        Enigo, Key, Keyboard, Settings,
    };

    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    // A modifier still held down would make it another shortcut
    for key in [Key::Control, Key::Alt, Key::Shift, Key::Meta] {
        let _ = enigo.key(key, Release);
    }
    enigo.key(Key::Control, Press).map_err(|e| e.to_string())?;
    let pressed = enigo.key(Key::V, Click).map_err(|e| e.to_string());
    let _ = enigo.key(Key::Control, Release);
    pressed
}

#[cfg(target_os = "macos")]
fn paste() -> Result<(), String> {
    run_paste_command(
        "osascript",
        &[
            "-e",
            "tell application \"System Events\" to keystroke \"v\" using command down",
        ],
    )
}

#[cfg(target_os = "linux")]
fn paste() -> Result<(), String> {
    run_paste_command("xdotool", &["key", "--clearmodifiers", "ctrl+v"])
}

#[cfg(not(target_os = "windows"))]
fn run_paste_command(program: &str, args: &[&str]) -> Result<(), String> {
    let status = std::process::Command::new(program)
        .args(args)
        .status()
        .map_err(|e| format!("{program}: {e}"))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("{program} ended with {status}"))
    }
}

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

// Give the Writing window the height it asks for, in logical pixels. Its top left corner stays
// where it is, so the window grows downwards; it moves up only as far as the bottom of the
// monitor's work area makes it. The window asks again for every step of an animation, so the
// change is made at once.
#[tauri::command(async)]
pub fn fit_writing_window(window: Window, height: f64) {
    let Ok(Some(monitor)) = window.current_monitor() else {
        warn!("Monitor not found, the Writing window keeps its size");
        return;
    };
    let (Ok(position), Ok(size)) = (window.outer_position(), window.inner_size()) else {
        return;
    };
    // Rounded up, so that a fraction of a pixel cut off does not leave something to scroll
    let height = (height * monitor.scale_factor()).ceil() as i32;
    let width = size.width as i32;
    let (x, y) = inside(
        position.x,
        position.y,
        width,
        height,
        translate_area(&monitor),
    );
    set_rect(
        &window,
        Rect {
            x,
            y,
            width,
            height,
        },
    );
}

// Put `text` in place of the selection: the app it was in gets the focus back and the text is
// pasted there. The clipboard gets its old text back afterwards.
#[tauri::command(async)]
pub fn writing_replace(window: Window, text: String) -> Result<(), String> {
    if test_mode() {
        // A test has no selection, and must leave the owner's foreground app and clipboard alone
        info!("Writing improvement: test mode, nothing is pasted");
        let _ = window.close();
        return Ok(());
    }
    let _ = window.hide();
    focus_source();
    // The app needs a moment to have the focus again
    std::thread::sleep(Duration::from_millis(150));

    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    let old_text = clipboard.get_text().ok();
    clipboard.set_text(text).map_err(|e| e.to_string())?;
    match paste() {
        Ok(()) => {
            // The app reads the clipboard when it handles the shortcut, which is not at once
            std::thread::sleep(Duration::from_millis(300));
            if let Some(old_text) = old_text {
                let _ = clipboard.set_text(old_text);
            }
        }
        Err(e) => {
            // The text stays on the clipboard, to be pasted by hand
            warn!("Writing improvement: paste failed: {}", e);
            notify(
                "Copied to the clipboard",
                "It could not be pasted for you: paste it yourself.",
            );
        }
    }
    let _ = window.close();
    Ok(())
}
