// Putting a text in place of the selection it was made from: the app the selection was in gets
// the focus back and the text is pasted there.

use crate::APP;
use log::warn;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::api::notification::Notification;
use tauri::{Manager, Window};

// Whether a result is being pasted, which takes the clipboard for a moment
pub(crate) static REPLACING: AtomicBool = AtomicBool::new(false);

// The clipboard monitor asks, so that it does not take the pasted text for something copied
pub fn replacing() -> bool {
    REPLACING.load(Ordering::SeqCst)
}

// The window the selection was in, which gets the focus back for the paste
#[cfg(target_os = "windows")]
pub(crate) static SOURCE_WINDOW: std::sync::atomic::AtomicIsize =
    std::sync::atomic::AtomicIsize::new(0);

// The window that has the focus, unless it is the Writing window itself
#[cfg(target_os = "windows")]
pub(crate) fn foreground_window() -> Option<isize> {
    use windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow;

    let foreground = unsafe { GetForegroundWindow() }.0 as isize;
    let own = APP
        .get()
        .and_then(|app| app.get_window("writing"))
        .and_then(|window| window.hwnd().ok())
        .map(|hwnd| hwnd.0 as isize);
    Some(foreground).filter(|hwnd| Some(*hwnd) != own)
}

#[cfg(target_os = "windows")]
pub(crate) fn remember_source(source: Option<isize>) {
    if let Some(hwnd) = source {
        SOURCE_WINDOW.store(hwnd, Ordering::SeqCst);
    }
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn foreground_window() -> Option<isize> {
    None
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn remember_source(_source: Option<isize>) {}

// Give the focus back to the window the selection was in, and say whether it has it: a paste
// must not go to another window.
#[cfg(target_os = "windows")]
fn focus_source() -> bool {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, IsWindow, SetForegroundWindow,
    };

    let hwnd = HWND(SOURCE_WINDOW.load(Ordering::SeqCst) as _);
    unsafe {
        if !IsWindow(hwnd).as_bool() {
            warn!("The window the selection was in is gone");
            return false;
        }
        let _ = SetForegroundWindow(hwnd);
        // The app needs a moment to have the focus again
        std::thread::sleep(Duration::from_millis(150));
        GetForegroundWindow() == hwnd
    }
}

// Elsewhere than on Windows, hiding the Writing window gives the focus back
#[cfg(not(target_os = "windows"))]
fn focus_source() -> bool {
    std::thread::sleep(Duration::from_millis(150));
    true
}

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

pub(crate) fn notify(title: &str, body: &str) {
    let app_handle = APP.get().unwrap();
    let _ = Notification::new(&app_handle.config().tauri.bundle.identifier)
        .title(title)
        .body(body)
        .icon("pot")
        .show();
}

pub(crate) fn replace(window: &Window, from_selection: bool, text: String) -> Result<(), String> {
    let _ = window.hide();
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    if !from_selection || !focus_source() {
        clipboard.set_text(text).map_err(|e| e.to_string())?;
        notify(
            "Copied to the clipboard",
            "There is no selection to replace: paste it where you want it.",
        );
        return Ok(());
    }

    let old_text = clipboard.get_text().ok();
    let old_image = match old_text {
        Some(_) => None,
        None => clipboard.get_image().ok(),
    };
    clipboard.set_text(text).map_err(|e| e.to_string())?;
    match paste() {
        Ok(()) => {
            // The app reads the clipboard when it handles the shortcut, which is not at once
            std::thread::sleep(Duration::from_millis(300));
            if let Some(old_text) = old_text {
                let _ = clipboard.set_text(old_text);
            } else if let Some(old_image) = old_image {
                let _ = clipboard.set_image(old_image);
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
    Ok(())
}
