// Keeps a window the size it has on screen while the user drags it to a monitor with another scale.
//
// On the way, Windows tells the window its new scale (`WM_DPICHANGED`) and tao resizes the window to
// it. Resized under the cursor, the window can lie mostly on the monitor it came from again, which
// asks for the old scale again, and so on: the window jumped between two sizes and places, and
// came out of the drag far larger than it went in (840 x 620 to 1493 x 1103). So a window that is
// being dragged is left alone, and tao is told of the new scale once the drag is over, when it
// resizes the window the way it does for a window that was moved by the program.
//
// A window that is being dragged also holds off its own resizing: its page measures in the scale of
// the monitor it is mostly on, which the window's may not match yet, and asks for more each time.
// That went on until the window was far wider than the screen.

#[cfg(target_os = "windows")]
mod imp {
    use std::cell::Cell;
    use std::sync::atomic::{AtomicBool, Ordering};

    use tauri::Window;
    use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, RECT, WPARAM};
    use windows::Win32::UI::HiDpi::GetDpiForWindow;
    use windows::Win32::UI::Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass};
    use windows::Win32::UI::WindowsAndMessaging::{
        GetClientRect, GetWindowRect, SendMessageW, SetWindowPos, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, WINDOWPOS,
        WM_DPICHANGED, WM_ENTERSIZEMOVE, WM_EXITSIZEMOVE, WM_NCDESTROY, WM_SYSCOMMAND, WM_WINDOWPOSCHANGING,
    };

    // The command that starts moving a window, in the low bits of the `WM_SYSCOMMAND` parameter
    const SC_MOVE: usize = 0xF010;
    const SC_MASK: usize = 0xFFF0;
    // The subclass id, and the scale at which Windows counts 100%
    const SUBCLASS_ID: usize = 2;
    const BASE_DPI: f64 = 96.0;

    // Whether a window is being dragged: the window moves, and no other window does at the same time
    static DRAGGING: AtomicBool = AtomicBool::new(false);

    // What one window remembers, used on its own thread only
    struct Guard {
        // A move has started, and its modal loop is about to begin
        moving: Cell<bool>,
        // The size the window had when the drag began, in logical pixels, while it is dragged
        logical: Cell<Option<(f64, f64)>>,
        // tao is being told the new scale, and may not move or resize the window meanwhile
        syncing: Cell<bool>,
        // The scale at which the drag began
        start_dpi: Cell<u32>,
    }

    pub fn dragging() -> bool {
        DRAGGING.load(Ordering::SeqCst)
    }

    fn client_size(hwnd: HWND) -> Option<(i32, i32)> {
        let mut rect = RECT::default();
        unsafe { GetClientRect(hwnd, &mut rect) }.ok()?;
        Some((rect.right - rect.left, rect.bottom - rect.top))
    }

    // Give the window `logical` at `dpi`, where it is. The window has no frame, so its client area is
    // all of it.
    fn resize(hwnd: HWND, logical: (f64, f64), dpi: u32) {
        let scale = dpi as f64 / BASE_DPI;
        let width = (logical.0 * scale).round() as i32;
        let height = (logical.1 * scale).round() as i32;
        if client_size(hwnd) == Some((width, height)) {
            return;
        }
        let mut rect = RECT::default();
        if unsafe { GetWindowRect(hwnd, &mut rect) }.is_err() {
            return;
        }
        let _ = unsafe {
            SetWindowPos(
                hwnd,
                HWND::default(),
                rect.left,
                rect.top,
                width,
                height,
                SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE,
            )
        };
    }

    unsafe extern "system" fn guard_proc(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
        id: usize,
        data: usize,
    ) -> LRESULT {
        let guard = &*(data as *const Guard);
        match msg {
            WM_SYSCOMMAND => {
                guard.moving.set(wparam.0 & SC_MASK == SC_MOVE);
                DefSubclassProc(hwnd, msg, wparam, lparam)
            }
            WM_ENTERSIZEMOVE => {
                if guard.moving.get() {
                    let dpi = GetDpiForWindow(hwnd);
                    if let (Some((width, height)), true) = (client_size(hwnd), dpi > 0) {
                        let scale = dpi as f64 / BASE_DPI;
                        guard.start_dpi.set(dpi);
                        guard.logical.set(Some((width as f64 / scale, height as f64 / scale)));
                        DRAGGING.store(true, Ordering::SeqCst);
                    }
                }
                DefSubclassProc(hwnd, msg, wparam, lparam)
            }
            WM_WINDOWPOSCHANGING if guard.syncing.get() => {
                let position = &mut *(lparam.0 as *mut WINDOWPOS);
                position.flags |= SWP_NOSIZE | SWP_NOMOVE;
                LRESULT(0)
            }
            // Left to the end of the drag: tao is not told yet
            WM_DPICHANGED if guard.logical.get().is_some() => LRESULT(0),
            WM_EXITSIZEMOVE => {
                // tao ends its own drag here
                let result = DefSubclassProc(hwnd, msg, wparam, lparam);
                guard.moving.set(false);
                DRAGGING.store(false, Ordering::SeqCst);
                if let Some(logical) = guard.logical.take() {
                    let dpi = GetDpiForWindow(hwnd);
                    if dpi != guard.start_dpi.get() {
                        // Windows has resized the window to the new scale already, and tao, which
                        // goes by the scale it knew, would scale it once more, to a size that
                        // shows for a moment. It is only told the scale: its resizing is cancelled.
                        guard.syncing.set(true);
                        let mut rect = RECT::default();
                        if GetWindowRect(hwnd, &mut rect).is_ok() {
                            let scale = WPARAM((dpi | dpi << 16) as usize);
                            SendMessageW(hwnd, WM_DPICHANGED, scale, LPARAM(&rect as *const RECT as isize));
                        }
                        guard.syncing.set(false);
                    }
                    resize(hwnd, logical, dpi);
                }
                result
            }
            WM_NCDESTROY => {
                let _ = RemoveWindowSubclass(hwnd, Some(guard_proc), id);
                DRAGGING.store(false, Ordering::SeqCst);
                drop(Box::from_raw(data as *mut Guard));
                DefSubclassProc(hwnd, msg, wparam, lparam)
            }
            _ => DefSubclassProc(hwnd, msg, wparam, lparam),
        }
    }

    pub fn install(window: &Window) {
        let Ok(hwnd) = window.hwnd() else {
            return;
        };
        let hwnd = hwnd.0 as isize;
        // A window can only be subclassed from the thread that owns it
        window
            .run_on_main_thread(move || unsafe {
                let guard = Box::into_raw(Box::new(Guard {
                    moving: Cell::new(false),
                    logical: Cell::new(None),
                    syncing: Cell::new(false),
                    start_dpi: Cell::new(0),
                }));
                if !SetWindowSubclass(HWND(hwnd as _), Some(guard_proc), SUBCLASS_ID, guard as usize)
                    .as_bool()
                {
                    drop(Box::from_raw(guard));
                }
            })
            .unwrap_or_default();
    }
}

#[cfg(target_os = "windows")]
pub use imp::{dragging, install};

#[cfg(not(target_os = "windows"))]
pub fn install(_window: &tauri::Window) {}

#[cfg(not(target_os = "windows"))]
pub fn dragging() -> bool {
    false
}
