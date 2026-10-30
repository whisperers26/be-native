// Putting a text in place of the selection it was made from: the app the selection was in gets
// the focus back and the text is pasted there.

use crate::window::test_mode;
use crate::APP;
use log::{info, warn};
use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};
use std::time::Duration;
use tauri::api::notification::Notification;
use tauri::{Manager, Window};

// Whether a result is being pasted, which takes the clipboard for a moment
static REPLACING: AtomicBool = AtomicBool::new(false);

// The clipboard monitor asks, so that it does not take the pasted text for something copied
pub fn replacing() -> bool {
    REPLACING.load(Ordering::SeqCst)
}

// Where a window's text came from. Translation and writing each keep their own, so that one does
// not paste into the app the other's selection was in.
pub struct Source {
    // The window the selection was in, which gets the focus back for the paste (Windows)
    #[cfg_attr(not(target_os = "windows"), allow(dead_code))]
    window: AtomicIsize,
    // Whether the text came from a selection, which a result can then be pasted over
    from_selection: AtomicBool,
}

impl Source {
    pub const fn new() -> Self {
        Source {
            window: AtomicIsize::new(0),
            from_selection: AtomicBool::new(false),
        }
    }

    // The text came from a selection in `window`, which `foreground_window` gave before the
    // selection was read. Without one, the window remembered before stays.
    pub fn selected_in(&self, window: Option<isize>) {
        if let Some(hwnd) = window {
            self.window.store(hwnd, Ordering::SeqCst);
        }
        self.from_selection.store(true, Ordering::SeqCst);
    }

    // The text came from elsewhere (typed, recognized, the clipboard or the HTTP API): there is
    // nothing to paste a result over
    pub fn not_selected(&self) {
        self.from_selection.store(false, Ordering::SeqCst);
    }
}

// The window that has the focus, unless it is one of this app's own
#[cfg(target_os = "windows")]
pub fn foreground_window() -> Option<isize> {
    use windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow;

    let foreground = unsafe { GetForegroundWindow() }.0 as isize;
    let own = APP.get().is_some_and(|app| {
        app.windows().values().any(|window| {
            window
                .hwnd()
                .is_ok_and(|hwnd| hwnd.0 as isize == foreground)
        })
    });
    Some(foreground).filter(|_| !own)
}

#[cfg(not(target_os = "windows"))]
pub fn foreground_window() -> Option<isize> {
    None
}

// Give the focus back to the window the selection was in, and say whether it has it: a paste
// must not go to another window.
#[cfg(target_os = "windows")]
fn focus_source(source: &Source) -> bool {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, IsWindow, SetForegroundWindow,
    };

    let hwnd = HWND(source.window.load(Ordering::SeqCst) as _);
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

// Elsewhere than on Windows, hiding this app's window gives the focus back
#[cfg(not(target_os = "windows"))]
fn focus_source(_source: &Source) -> bool {
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

pub fn notify(title: &str, body: &str) {
    let app_handle = APP.get().unwrap();
    let _ = Notification::new(&app_handle.config().tauri.bundle.identifier)
        .title(title)
        .body(body)
        .icon("pot")
        .show();
}

// Put `text` in place of the selection `source` came from: the app it was in gets the focus back
// and the text is pasted there. The clipboard gets back what it held afterwards. Without a
// selection to paste over, or when its window does not get the focus back, the text is copied
// instead. `window`, this app's window the text was picked in, is hidden first and closed after.
pub fn put_in_place(window: &Window, source: &Source, text: String) -> Result<(), String> {
    if test_mode() {
        // A test has no selection, and must leave the owner's foreground app and clipboard alone
        info!("Replace: test mode, nothing is pasted");
        let _ = window.close();
        return Ok(());
    }
    // A second press while the first is being pasted
    if REPLACING.swap(true, Ordering::SeqCst) {
        return Ok(());
    }
    let result = replace(window, source, text);
    REPLACING.store(false, Ordering::SeqCst);
    let _ = window.close();
    result
}

fn replace(window: &Window, source: &Source, text: String) -> Result<(), String> {
    let _ = window.hide();
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    if !source.from_selection.load(Ordering::SeqCst) || !focus_source(source) {
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
            warn!("Replace: paste failed: {}", e);
            notify(
                "Copied to the clipboard",
                "It could not be pasted for you: paste it yourself.",
            );
        }
    }
    Ok(())
}
