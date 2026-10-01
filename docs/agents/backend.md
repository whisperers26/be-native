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
| `backup` | WebDAV, local file and Aliyun Drive backup and restore |
| `cmd` | Other commands: text state, store reload, image cut, base64 and copy, proxy, plugin install and run, fonts, devtools |
| `updater` | Update check at launch |
| `error` | The `Error` type commands return; sent to JavaScript as its message |

## Launch

1. macOS: accessory activation policy and the accessibility permission prompt.
2. Load the settings and prune unknown services from the four service lists.
3. First run (settings empty): open the Config window.
4. Build the tray menu, start the HTTP server, register the global shortcuts (a failure shows a notification), apply the proxy if enabled, check for updates, warm up offline language detection if it is the selected engine, start the clipboard monitor if enabled.

## Commands

| Command | Arguments | Returns | Does |
| --- | --- | --- | --- |
| `get_text` | — | string | The text waiting for the translate window |
| `reload_store` | — | — | Reloads `config.json` into Rust's cache |
| `screenshot` | `x`, `y` | — | Captures the monitor at that position to `pot_screenshot.png` |
| `cut_image` | `left`, `top`, `width`, `height` | — | Crops it to `pot_screenshot_cut.png` |
| `get_base64` | — | string | `pot_screenshot_cut.png` as base64; `""` if missing |
| `copy_img` | `width`, `height` | — | Copies the cut image to the clipboard |
| `system_ocr` | `lang` | string | OS OCR of `pot_screenshot_cut.png` |
| `lang_detect` | `text` | string | Offline language detection; an app language code, `en` if unsure |
| `set_proxy`, `unset_proxy` | — | bool | Set or clear the proxy environment variables. The frontend never calls them; the proxy is applied at launch |
| `install_plugin` | `pathList` | number | Installs `.potext` files |
| `run_binary` | `pluginType`, `pluginName`, `cmdName`, `args` | `{ stdout, stderr, status }` | Runs a program with the plugin's directory as working directory |
| `font_list` | — | string[] | System font families |
| `open_devtools` | — | — | Toggles the devtools |
| `register_shortcut_by_frontend` | `name`, `shortcut` | — | Registers one global shortcut; the Hotkey page unregisters the old one and saves the setting |
| `update_tray` | `language`, `copyMode` | — | Rebuilds the tray menu; empty arguments are read from the settings |
| `updater_window` | — | — | Opens the Updater window |
| `webdav` | `operate`, `url`, `username`, `password`, `name` | string | `put`, `get`, `list` or `delete` backups under `<url>/pot-app/` |
| `local` | `operate`, `path` | string | `put` writes a backup zip, `get` restores one |
| `aliyun` | `operate`, `path`, `url` | string | Uploads to, or downloads from, a presigned Aliyun Drive URL |

JavaScript passes argument names in camelCase (`copyMode`); Tauri maps them to Rust's snake_case. Commands that are not `async` run on the main thread and block the UI while they run.

To add a command, write a `#[tauri::command]` function in the module it belongs to, add it to `generate_handler!` in `main.rs`, and call it from the frontend with `invoke`.

## Windows

`build_window(label, title)` creates a hidden, frameless, transparent window (on macOS, with an overlay title bar) that loads `index.html` on the monitor under the mouse, or focuses the window if it already exists. The frontend shows the window when it is ready. Sizes: Config 800×600; Translate from `translate_window_width` and `translate_window_height` (350×420), at the cursor or at a saved position; Recognize from `recognize_window_width` and `recognize_window_height` (800×400); Updater 600×400; Screenshot full screen.

## Events

| Event | Direction | Payload |
| --- | --- | --- |
| `new_text` | Rust → translate window | The text, `[INPUT_TRANSLATE]` or `[IMAGE_TRANSLATE]` |
| `new_image` | Rust → recognize window | `""`; the window re-reads the image |
| `translate_auto_copy_changed` | Rust → all windows | The auto-copy mode, when changed from the tray |
| `success` | Screenshot window → Rust | None; the region is saved, continue with OCR or image translation |

## Hotkeys

The settings `hotkey_selection_translate`, `hotkey_input_translate`, `hotkey_ocr_recognize` and `hotkey_ocr_translate` are empty by default, so there are no shortcuts until the user sets them. They are registered at launch; if one fails, the ones after it are skipped.

## Tray

Menu: input translate, clipboard monitor (toggle), auto copy (source, target, both, off), OCR recognize, OCR translate, settings, check for updates, view log, restart, quit. On Windows a left click runs `tray_click_event` (default: open settings).

## HTTP API

A server on `127.0.0.1:<server_port>` (default 60828) handles one request at a time, accepts any method, matches the URL exactly including the query string, and replies `ok`:

| URL | Does |
| --- | --- |
| `/`, `/translate` | Translates the request body |
| `/selection_translate`, `/input_translate` | Like the hotkeys |
| `/ocr_recognize`, `/ocr_translate` | Screenshot, then OCR or image translation |
| `/ocr_recognize?screenshot=false`, `/ocr_translate?screenshot=false` | The same, with an existing `pot_screenshot_cut.png` |
| `/config` | Opens the Config window |

Changing the port needs a restart. The API has no authentication.

## OCR

- Windows: Windows.Media.Ocr, with the user's language packs for `auto`; a missing language pack gives "Language package not installed!".
- macOS: the bundled helpers `src-tauri/resources/ocr-<arch>-apple-darwin`.
- Linux: the `tesseract` command; the deb and rpm packages depend on `tesseract-ocr`.

## Plugins

`install_plugin` accepts `.potext` zips whose names start with `plugin` and which contain `info.json` (with `plugin_type`) and `main.js`, and extracts them to `<app config dir>/plugins/<plugin_type>/<name>/`. At launch, directories under `plugins/<type>/` whose names do not start with `plugin` are deleted.

## Backup

A backup is an uncompressed zip of `config.json`, `history.db` if present, and everything under `plugins/`. Restoring extracts it over the app config directory; files not in the archive are kept. `src-tauri/src/backup.rs` hard-codes that directory as `<config dir>/com.pot-app.desktop`.

## Tauri plugins

`single-instance` (a second launch shows a notification and exits), `log` (`pot.log` and stdout), `autostart`, `sql` (the SQLite history), `store` (settings), `fs-watch` (the frontend watches `config.json`).

Rust bugs found so far: [known-issues.md](known-issues.md).
