// Read the text selected in the app that has the focus.
//
// On Windows this replaces `selection::get_text`, which reads through UI Automation and otherwise
// presses Ctrl+C while the user still holds the shortcut's keys. It releases them in software, but
// the user's finger is still on Alt: the key repeats and its release then reaches the app as a tap
// of Alt alone. Chrome moves the focus to its menu button on that tap, so the next Ctrl+C copies
// nothing and a Ctrl+V pastes nowhere, until the user clicks into the page again. Here the copy
// waits until the keys are let go, and waits longer for the app to put the text on the clipboard.

#[cfg(not(target_os = "windows"))]
pub fn get_text() -> String {
    selection::get_text()
}

#[cfg(target_os = "windows")]
pub use windows_impl::get_text;

#[cfg(target_os = "windows")]
mod windows_impl {
    use log::{info, warn};
    use std::error::Error;
    use std::time::{Duration, Instant};
    use windows::Win32::System::Com::{CoCreateInstance, CoInitialize, CLSCTX_ALL};
    use windows::Win32::System::DataExchange::GetClipboardSequenceNumber;
    use windows::Win32::UI::Accessibility::{
        CUIAutomation, IUIAutomation, IUIAutomationTextPattern, UIA_TextPatternId,
    };
    use windows::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;

    // How long the user may take to let go of the shortcut
    const RELEASE_TIMEOUT: Duration = Duration::from_millis(1500);
    // How long an app may take to answer Ctrl+C; a busy web page can take more than 100 ms
    const COPY_TIMEOUT: Duration = Duration::from_millis(800);
    const POLL: Duration = Duration::from_millis(10);

    pub fn get_text() -> String {
        match by_automation() {
            Ok(text) if !text.is_empty() => return text,
            Ok(_) => info!("Selection: UI Automation found no selected text"),
            Err(e) => info!("Selection: UI Automation failed: {}", e),
        }
        match by_clipboard() {
            Ok(text) => text,
            Err(e) => {
                warn!("Selection: copying failed: {}", e);
                String::new()
            }
        }
    }

    // Whether a key of the keyboard is held down. Mouse buttons (0x01 to 0x06) do not count.
    fn any_key_down() -> bool {
        (0x08..=0xFE).any(|vk| unsafe { GetAsyncKeyState(vk) } as u16 & 0x8000 != 0)
    }

    // Wait until the user has let go of every key, so that keys pressed in software do not mix with
    // the shortcut's. Says whether they did before the timeout.
    fn wait_for_keys_released() -> bool {
        let start = Instant::now();
        while any_key_down() {
            if start.elapsed() > RELEASE_TIMEOUT {
                return false;
            }
            std::thread::sleep(POLL);
        }
        true
    }

    // Edge, Chrome with accessibility on, and UWP apps. Nothing is pressed.
    fn by_automation() -> Result<String, Box<dyn Error>> {
        let _ = unsafe { CoInitialize(None) };
        let automation: IUIAutomation =
            unsafe { CoCreateInstance(&CUIAutomation, None, CLSCTX_ALL) }?;
        let element = unsafe { automation.GetFocusedElement() }?;
        let pattern: IUIAutomationTextPattern =
            unsafe { element.GetCurrentPatternAs(UIA_TextPatternId) }?;
        let ranges = unsafe { pattern.GetSelection() }?;
        let mut text = String::new();
        for i in 0..unsafe { ranges.Length() }? {
            let range = unsafe { ranges.GetElement(i) }?;
            text.push_str(&unsafe { range.GetText(-1) }?.to_string());
        }
        Ok(text.trim().to_string())
    }

    fn press_copy() -> Result<(), String> {
        use enigo::{
            Direction::{Click, Press, Release},
            Enigo, Key, Keyboard, Settings,
        };

        if !wait_for_keys_released() {
            info!("Selection: the shortcut is still held, copying anyway");
        }
        let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
        // A key still held: an unassigned key pressed between Alt's (or Windows') press and its
        // release keeps the release from counting as a tap that opens a menu
        let _ = enigo.key(Key::Other(0xE8), Click);
        for key in [Key::Control, Key::Alt, Key::Shift, Key::Meta] {
            let _ = enigo.key(key, Release);
        }
        enigo.key(Key::Control, Press).map_err(|e| e.to_string())?;
        let pressed = enigo.key(Key::C, Click).map_err(|e| e.to_string());
        let _ = enigo.key(Key::Control, Release);
        pressed
    }

    // Almost every app: press Ctrl+C and read the clipboard, then give it back what it held
    fn by_clipboard() -> Result<String, Box<dyn Error>> {
        let mut clipboard = arboard::Clipboard::new()?;
        let old_text = clipboard.get_text().ok();
        let old_image = match old_text {
            Some(_) => None,
            None => clipboard.get_image().ok(),
        };
        let before = unsafe { GetClipboardSequenceNumber() };
        press_copy()?;

        let start = Instant::now();
        while unsafe { GetClipboardSequenceNumber() } == before {
            if start.elapsed() > COPY_TIMEOUT {
                return Err("nothing was copied".into());
            }
            std::thread::sleep(POLL);
        }
        // The app may still be writing its other formats
        std::thread::sleep(Duration::from_millis(30));
        let new_text = clipboard.get_text();

        if let Some(old_text) = old_text {
            clipboard.set_text(old_text)?;
        } else if let Some(old_image) = old_image {
            clipboard.set_image(old_image)?;
        } else {
            clipboard.clear()?;
        }
        Ok(new_text
            .map_err(|_| "what was copied is not text")?
            .trim()
            .to_string())
    }
}
