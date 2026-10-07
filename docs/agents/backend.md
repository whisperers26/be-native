# Backend (Rust)

`src-tauri/` is a Tauri 1.8 app, crate `pot`. `src-tauri/src/main.rs` registers the plugins, runs setup, registers the commands, and keeps the app running when the last window closes.

## Modules

| Module | Does |
| --- | --- |
| `main` | Builder: plugins, setup, commands, tray handler, exit prevention. Globals `APP` (the app handle) and `StringWrapper` (text waiting for the translate window) |
| `window` | `build_window` and every window entry point: config, translate (selection, input, text, image), recognize, screenshot, updater |
| `config` | The settings store handle, `get`, `set`, `is_first_run`, service list pruning, plugin directory cleanup |
| `hotkey` | Global shortcuts |
| `tray` | Tray menu in 11 languages, tray events, `update_tray` |
| `server` | The local HTTP API |
| `clipboard` | The clipboard monitor loop |
| `screenshot` | Captures one monitor to `pot_screenshot.png` |
| `system_ocr` | OS OCR: Windows.Media.Ocr, a bundled macOS helper, or Linux `tesseract` |
| `lang_detect` | Offline language detection (lingua) |
| `agent_cli` | Claude Code and Codex sessions for the translate and writing services of the same names ([services.md](services.md)) |
| `writing` | Writing improvement: the selected text, the Writing window and its height, pasting a result over the selection |
| `cmd` | Other commands: text state, store reload, image cut, base64 and copy, proxy, plugin install and run, fonts, devtools |
| `updater` | Update check at launch |
| `error` | The `Error` type commands return; sent to JavaScript as its message |

## Launch

1. macOS: accessory activation policy and the accessibility permission prompt.
2. Load the settings and prune unknown services from the four service lists.
3. First run (settings empty): open the Config window.
4. Build the tray menu, start the HTTP server, register the global shortcuts (a failure shows a notification), apply the proxy if enabled, check for updates, warm up offline language detection if it is the selected engine or none has been chosen (it is the default), start the clipboard monitor if enabled, start the waiting Claude Code and Codex sessions.

## Commands

| Command | Arguments | Returns | Does |
| --- | --- | --- | --- |
| `get_text` | — | string | The text waiting for the translate window |
| `reload_store` | — | — | Reloads `config.json` into Rust's cache, then matches the waiting Claude Code and Codex sessions to it |
| `screenshot` | `x`, `y` | — | Captures the monitor at that position to `pot_screenshot.png` |
| `cursor_position` | — | `{ x, y, monitor: { x, y } }` | The cursor's physical position and the origin of the monitor under it; an error if either is unknown |
| `show_window`, `focus_window` | — | — | Show or focus the calling window; in test mode, show it without activating it and do not focus it |
| `translate_window_waiting` | — | boolean | Whether the Translate window was opened at its waiting size (below) and has not asked for its size yet |
| `translate_window_origin` | `width`, `height` | `[x, y]` | Where the Translate window's top left corner is now, seen from the corner it would have after `fit_translate_window` with this size, in logical pixels |
| `translate_window_opened` | — | — | Give the Translate window the shadow it waits without |
| `fit_translate_window` | `width`, `height`, `glide?` | — | Resize the calling (Translate) window, in logical pixels, and keep it inside its monitor's work area; a window still where the `smart` position put it is placed beside its anchor again for the new size. A showing window glides there in 160 ms (`placement::between`), moved and resized in one step per frame, unless `glide` is false; a newer call takes over from one under way |
| `test_mode` | — | boolean | Whether test mode is on |
| `cut_image` | `left`, `top`, `width`, `height` | — | Crops it to `pot_screenshot_cut.png` |
| `get_base64` | — | string | `pot_screenshot_cut.png` as base64; `""` if missing |
| `copy_img` | `width`, `height` | — | Copies the cut image to the clipboard |
| `system_ocr` | `lang` | string | OS OCR of `pot_screenshot_cut.png`; the text has one line per line read |
| `lang_detect` | `text` | string | Offline language detection; an app language code, `en` if unsure |
| `get_writing_text` | — | string | The text waiting for the writing window |
| `fit_writing_window` | `height` | — | Give the calling (Writing) window this height, in logical pixels, at once. Its top left corner stays, unless the window would reach below its monitor's work area: then it moves up as far as that takes (`placement::inside`) |
| `writing_replace` | `text` | — | Hide the Writing window, give the focus back to the window the selection was in (Windows; elsewhere hiding does), put `text` on the clipboard, send the paste shortcut (`enigo` on Windows, `osascript` on macOS, `xdotool` on Linux), put back the text or image the clipboard held, and close the window. The text is only copied, and a notification says so, when there is no selection to paste over (a text from `/writing`), when that window is gone or does not get the focus back, or when the shortcut cannot be sent. A second call while one is under way does nothing, and the clipboard monitor does not read the clipboard meanwhile. In test mode it only closes the window |
| `agent_cli_run` | `id`, `spec`, `prompt` | string | Runs one prompt in a Claude Code or Codex session of its own and returns the answer; emits `agent_cli_stream` meanwhile |
| `agent_cli_models` | `provider`, `command` | `[{ label, value }]` | Asks the installed Claude Code or Codex which models it offers; sends no prompt |
| `set_proxy`, `unset_proxy` | — | bool | Set or clear the proxy environment variables. The frontend never calls them; the proxy is applied at launch |
| `install_plugin` | `pathList` | number | Installs `.potext` files |
| `run_binary` | `pluginType`, `pluginName`, `cmdName`, `args` | `{ stdout, stderr, status }` | Runs a program with the plugin's directory as working directory |
| `font_list` | — | string[] | System font families |
| `open_devtools` | — | — | Toggles the devtools |
| `register_shortcut_by_frontend` | `name`, `shortcut` | — | Registers one global shortcut; the Hotkey page unregisters the old one and saves the setting |
| `update_tray` | `language`, `copyMode` | — | Rebuilds the tray menu; empty arguments are read from the settings |
| `updater_window` | — | — | Opens the Updater window |

JavaScript passes argument names in camelCase (`copyMode`); Tauri maps them to Rust's snake_case. Commands that are not `async` run on the main thread and block the UI while they run.

To add a command, write a `#[tauri::command]` function in the module it belongs to, add it to `generate_handler!` in `main.rs`, and call it from the frontend with `invoke`.

## Windows

`build_window(label, title)` creates a hidden, frameless, transparent window (on macOS, with an overlay title bar) that loads `index.html` on the monitor under the mouse, or focuses the window if it already exists. The frontend shows the window when it is ready, through `show_window` and `focus_window`. In test mode ([testing.md](testing.md#test-mode)) the window goes to the centre of the secondary monitor instead, and is neither focused nor activated. Sizes: Config 800×600; Translate from `translate_window_width` and `translate_window_height` (350×420) when `translate_remember_window_size` is on, otherwise 420×240 until the window fits itself to its content ([frontend.md](frontend.md#translate-window)); a window opened for a text or a screenshot starts 88×88 and without a shadow instead, to wait in as a progress indicator, until it has opened (`translate_window_opened`); the window stays 12 px off the edges of the monitor's work area when the `smart` position places it and when it fits itself; placed by `translate_window_position` (below) and sized after it is placed; Writing 460×120 beside the cursor (`placement::beside` with the cursor as anchor), until the window gives itself the height of what it shows ([frontend.md](frontend.md#writing-window)); Recognize from `recognize_window_width` and `recognize_window_height` (800×400); Silent Recognize is never shown; Updater 600×400; Screenshot full screen.

The `smart` position puts the Translate window beside what the text came from: the region of a screenshot translation (`cut_image` records it, `image_translate` takes it), otherwise the cursor. `placement::beside` picks the corner: right of the anchor, else left, below or above, the first side with room inside the monitor's work area (the whole monitor off Windows); if no side has room, where the window covers the least of the anchor, and over the middle of an anchor it cannot get out of. It is arithmetic on numbers the app already has, so it costs no extra call or window move. Input translation centres the window, as with `mouse`.

On Windows the Screenshot window is subclassed (`suppress_title_bar`) so that the system never paints its non-client area. Without that, activating the window paints an old-style title bar across the top of the screen, which shows whenever the WebView has not drawn over it yet.

On Windows every window except Screenshot is subclassed by `drag_guard.rs` for the drag between monitors of different scale. While a drag lasts, `WM_DPICHANGED` is held back from tao, which would resize the window under the cursor until it jumped between two sizes and came out far larger, and `fit_translate_window` does nothing (`dragging()`). Windows resizes the window to the new scale itself during the drag. When the drag ends, tao is sent the new scale with its own resizing cancelled (otherwise the window flashes at a size scaled twice), and the window is set to the logical size it had when the drag began.

## Events

| Event | Direction | Payload |
| --- | --- | --- |
| `new_text` | Rust → translate window | The text, `[INPUT_TRANSLATE]` or `[IMAGE_TRANSLATE]` |
| `new_writing_text` | Rust → writing window | The text to improve |
| `new_image` | Rust → recognize or silent_recognize window | `""`; the window re-reads the image |
| `translate_auto_copy_changed` | Rust → all windows | The auto-copy mode, when changed from the tray |
| `agent_cli_stream` | Rust → the window that called `agent_cli_run` | `{ id, text }`: the answer so far |
| `success` | Screenshot window → Rust | None; the region is saved, continue with OCR or image translation |

## Hotkeys

The settings `hotkey_selection_translate`, `hotkey_input_translate`, `hotkey_ocr_recognize`, `hotkey_ocr_translate`, `hotkey_ocr_copy` and `hotkey_selection_writing` are empty by default, so there are no shortcuts until the user sets them. They are registered at launch; if one fails, the ones after it are skipped.

The writing hotkey (`writing::selection_writing`) reads the selection as selection translation does. With nothing selected it shows a notification and opens no window. The tray has no entry for it: opening the tray menu takes the focus, and the selection with it.

## Tray

Menu: input translate, clipboard monitor (toggle), auto copy (source, target, both, off), OCR recognize, OCR translate, OCR copy, settings, check for updates, view log, restart, quit. On Windows a left click runs `tray_click_event` (default: open settings).

## HTTP API

A server on `127.0.0.1:<server_port>` (default 60828) handles one request at a time, accepts any method, matches the URL exactly including the query string, and replies `ok`:

| URL | Does |
| --- | --- |
| `/`, `/translate` | Translates the request body |
| `/selection_translate`, `/input_translate` | Like the hotkeys |
| `/ocr_recognize`, `/ocr_translate` | Screenshot, then OCR or image translation |
| `/ocr_copy` | Screenshot, then OCR copied to the clipboard without a window |
| `/ocr_recognize?screenshot=false`, `/ocr_translate?screenshot=false`, `/ocr_copy?screenshot=false` | The same, with an existing `pot_screenshot_cut.png` |
| `/selection_writing` | Like the hotkey |
| `/writing` | Improves the request body. There is no selection, so a result that is picked is copied, not pasted |
| `/config` | Opens the Config window |
| `/test_mode?on=true`, `/test_mode?on=false` | Debug builds only: turns test mode on or off ([testing.md](testing.md#test-mode)) |

Changing the port needs a restart. The API has no authentication.

## OCR

- Windows: Windows.Media.Ocr, with the user's language packs for `auto`; a missing language pack gives "Language package not installed!".
- macOS: the bundled helpers `src-tauri/resources/ocr-<arch>-apple-darwin`.
- Linux: the `tesseract` command; the deb and rpm packages depend on `tesseract-ocr`.

## Plugins

`install_plugin` accepts `.potext` zips whose names start with `plugin` and which contain `info.json` (with `plugin_type`) and `main.js`, and extracts them to `<app config dir>/plugins/<plugin_type>/<name>/`. At launch, directories under `plugins/<type>/` whose names do not start with `plugin` are deleted.

## Tauri plugins

`single-instance` (a second launch shows a notification and exits), `log` (a file named after the app, `Be Native.log` or `Be Native (Debug).log` from a debug build, and stdout), `autostart`, `sql` (the SQLite history), `store` (settings), `fs-watch` (the frontend watches `config.json`).

Rust bugs found so far: [known-issues.md](known-issues.md).
