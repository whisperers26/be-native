// Writing improvement: the selected text is rewritten in the `writing` window, and the result the
// user picks there is pasted over the selection.

use crate::placement::{beside, inside, Rect};
use crate::replace::{foreground_window, notify, remember_source, replace, REPLACING};
use crate::window::{
    build_window, placement_point, set_rect, test_mode, translate_area, PLACEMENT_GAP,
};
use crate::APP;
use log::{info, warn};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{Manager, Window};

// Text to be improved
pub struct WritingText(pub Mutex<String>);

// The size the Writing window opens at, in logical pixels. It keeps its width and gives itself the
// height of what it shows, through `fit_writing_window`.
const WRITING_SIZE: (f64, f64) = (460.0, 120.0);

// Whether the text came from a selection, which a result can then be pasted over. A text from the
// HTTP API has none.
static FROM_SELECTION: AtomicBool = AtomicBool::new(false);

// The Writing window: beside the cursor, so that it has the room below it to grow into
fn writing_window() -> Window {
    let point = placement_point();
    let (window, exists) = build_window("writing", "Writing");
    if exists {
        return window;
    }
    window.set_skip_taskbar(true).unwrap();
    let (width, height) = WRITING_SIZE;
    let Ok(Some(monitor)) = window.current_monitor() else {
        warn!("Monitor not found, the Writing window stays where it was created");
        let _ = window.set_size(tauri::LogicalSize::new(width, height));
        return window;
    };
    let scale = monitor.scale_factor();
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

fn open(text: String, from_selection: bool) {
    let app_handle = APP.get().unwrap();
    let state: tauri::State<WritingText> = app_handle.state();
    state.0.lock().unwrap().replace_range(.., &text);
    FROM_SELECTION.store(from_selection, Ordering::SeqCst);
    let window = writing_window();
    let _ = window.emit("new_writing_text", text);
}

// Improve the text selected in the app that has the focus
pub fn selection_writing() {
    let source = foreground_window();
    let text = crate::selected_text::get_text();
    if text.trim().is_empty() {
        info!("Writing improvement: nothing is selected");
        notify(
            "Nothing is selected",
            "Select the text to improve, then press the shortcut.",
        );
        return;
    }
    // Only now: a press with nothing selected leaves an open window's source as it is
    remember_source(source);
    open(text, true);
}

// Improve a text that did not come from a selection (the HTTP API). There is nothing to paste a
// result over, so a result that is picked is copied.
pub fn text_writing(text: String) {
    if text.trim().is_empty() {
        return;
    }
    open(text, false);
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
// pasted there. The clipboard gets back what it held afterwards. Without a selection to paste
// over, or when its window does not get the focus back, the text is copied instead.
#[tauri::command(async)]
pub fn writing_replace(window: Window, text: String) -> Result<(), String> {
    if test_mode() {
        // A test has no selection, and must leave the owner's foreground app and clipboard alone
        info!("Writing improvement: test mode, nothing is pasted");
        let _ = window.close();
        return Ok(());
    }
    // A second press on a result while the first is being pasted
    if REPLACING.swap(true, Ordering::SeqCst) {
        return Ok(());
    }
    let result = replace(&window, FROM_SELECTION.load(Ordering::SeqCst), text);
    REPLACING.store(false, Ordering::SeqCst);
    let _ = window.close();
    result
}
