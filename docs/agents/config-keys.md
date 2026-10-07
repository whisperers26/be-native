# Config keys

Every setting lives in one JSON file, `config.json` in the app config directory ([paths](setup-and-run.md#data-on-disk)). The frontend reads and writes it with `useConfig(key, default)`; the first read of a missing key writes the default to the file. Rust reads some keys directly and, for the keys marked "Rust", writes the default when the key is missing. Rust reads values with a fixed type and panics on a value of another type, so never change a key's type.

## App

| Key | Default | Notes |
| --- | --- | --- |
| `app_language` | `en` | UI language; also the tray menu language. Rust |
| `app_theme` | `system` | `system`, `light`, `dark` |
| `app_font`, `app_fallback_font` | `default` | Font family names |
| `app_font_size` | `16` | Pixels. A number by default, but the General page saves a picked size as a string (`'18'`) |
| `window_animation` | `true` | Off: the progress indicator, the circle-to-window opening and the windows' resizing (Translate and Writing) happen at once. The indicator's turning ring is not part of it |
| `dev_mode` | `false` | F12 opens devtools |
| `check_update` | `true` | Check for updates at launch (release builds only; a debug build never does). Rust |
| `server_port` | `60828` | Local HTTP API port; restart to apply. Rust |
| `tray_click_event` | `config` | Windows tray left click: `config`, `translate`, `ocr_recognize`, `ocr_translate`, `ocr_copy`, `disable`. Rust |
| `proxy_enable` | `false` | Applied at launch only |
| `proxy_host`, `proxy_port` | `''` | Rust builds `http://<host>:<port>`; the port must be a number |
| `proxy_username`, `proxy_password` | `''` | Ignored (the inputs are disabled) |
| `no_proxy` | `localhost,127.0.0.1` | |

## Translate

| Key | Default | Notes |
| --- | --- | --- |
| `translate_source_language` | `auto` | |
| `translate_target_language` | `zh_cn` | |
| `translate_second_language` | `en` | Used as the target when the detected source language equals the target |
| `translate_detect_engine` | `local` | `local` (offline, Rust), `baidu`, `google`, `tencent`, `niutrans`, `yandex`, `bing` |
| `translate_auto_copy` | `disable` | `source`, `target`, `source_target`, `disable`; also set from the tray. Rust |
| `translate_merge_lines` | `true` | Join lines that only wrapped and keep paragraphs and list items (`mergeLines`, [frontend.md](frontend.md#translate-window)) |
| `incremental_translate` | `false` | Append new text to the previous text |
| `dynamic_translate` | `false` | Translate one second after typing |
| `translate_remember_language` | `false` | Save languages chosen in the window as the defaults |
| `history_disable` | `false` | |
| `translate_window_position` | `smart` | `smart` (beside the screenshot region or the cursor), `mouse` (at the cursor) or `pre_state` (last position) |
| `translate_window_position_x`, `translate_window_position_y` | `0` | Saved position |
| `translate_remember_window_size` | `false` | On: the window opens at the saved size, which follows the user's resizing. Off: it sizes itself to what it shows ([frontend.md](frontend.md#translate-window)) |
| `translate_window_width`, `translate_window_height` | `350`, `420` | Saved size, in logical pixels; used only while the size is remembered. Rust |
| `translate_close_on_blur` | `true` | |
| `translate_always_on_top` | `false` | |
| `translate_hide_window` | `false` | Translate without showing the window |
| `hide_source`, `hide_language` | `false` | Hide the source box or the language bar |
| `clipboard_monitor` | `false` | Toggled from the tray only. Rust |

## Writing

| Key | Default | Notes |
| --- | --- | --- |
| `writing_tones` | Professional, Casual, Friendly, Confident, Concise | A list of `{ name, instruction }` (`DEFAULT_TONES` in `src/utils/writing_tones`): what the Tones button asks for |
| `writing_close_on_blur` | `true` | |

## Recognize (OCR)

| Key | Default | Notes |
| --- | --- | --- |
| `recognize_language` | `auto` | |
| `recognize_merge_lines` | `true` | The same, for the Recognize window and silent recognition |
| `recognize_auto_copy` | `false` | |
| `recognize_hide_window` | `false` | |
| `recognize_close_on_blur` | `true` | |
| `recognize_window_width`, `recognize_window_height` | `800`, `400` | Rust |

## Hotkeys

| Key | Default | Notes |
| --- | --- | --- |
| `hotkey_selection_translate`, `hotkey_input_translate`, `hotkey_ocr_recognize`, `hotkey_ocr_translate`, `hotkey_ocr_copy`, `hotkey_selection_writing` | `''` | Accelerator strings set on the Hotkey page; empty means no shortcut. Rust |

## Services

| Key | Default | Notes |
| --- | --- | --- |
| `translate_service_list` | `['deepl', 'bing', 'lingva', 'yandex', 'google', 'ecdict']` | Instance keys in display order. Rust prunes unknown entries at launch |
| `writing_service_list` | `['llm7']` | Same; no plugins |
| `recognize_service_list` | `['rapidocr', 'system', 'tesseract']` | Same |
| `tts_service_list` | `['lingva_tts']` | Same; only the first entry is used |
| `collection_service_list` | `[]` | Same |
| `<instance key>` | `{}` | That instance's settings: `instanceName`, the service's own fields, and for translate `enable`. Rust reads `command`, `model`, `effort`, `systemPrompt` and `enable` of `claude_code` and `codex` instances, of both the translate and the writing list |

## Adding a setting

Pick a `snake_case` key and read it with `useConfig('<key>', <default>)` wherever it is used; give the same default everywhere. If Rust needs it, read it with `get("<key>")` in `src-tauri/src/config.rs` and handle a missing or wrongly typed value without `unwrap()`. Add a row to this page.
