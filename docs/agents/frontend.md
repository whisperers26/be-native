# Frontend

The React 18 app in `src/`, written in strict TypeScript ([typescript.md](typescript.md)). Every window except the hidden `daemon` window runs this one bundle and picks what to render from its window label.

Stack: React 18; Vite 5 (dev server on port 1420); NextUI 2.4 on Tailwind 3.4, with `next-themes` for dark mode; jotai for state inside a window; i18next for UI text; react-router 6 for the Config window's pages; and the Tauri 1 JavaScript API (`@tauri-apps/api`) plus the store, SQL, fs-watch, log and autostart plugin APIs.

## Boot

1. `index.html` loads `src/main`. The `daemon` window loads `daemon.html`, which has no script.
2. `src/main` blocks the context menu in production builds, runs `initStore()` (`src/utils/store`) and `initEnv()` (`src/utils/env`, which sets `osType`, `arch`, `osVersion`, `appVersion`), then renders `App` inside `NextUIProvider` and `NextThemesProvider`.
3. `src/App` renders the component for the window's label:

| Label | Component | Opened by |
| --- | --- | --- |
| `translate` | `src/window/Translate/` | Selection, input and image translation, the HTTP API, the clipboard monitor |
| `recognize` | `src/window/Recognize/` | OCR after a screenshot, the HTTP API |
| `silent_recognize` | `src/window/SilentRecognize/` | The silent OCR copy hotkey, the tray, the HTTP API |
| `screenshot` | `src/window/Screenshot/` | The OCR and image translation hotkeys (not on macOS) |
| `config` | `src/window/Config/` | The tray, first run, the HTTP API |
| `updater` | `src/window/Updater/` | The update check, the About page |

An unknown label renders nothing. Rust creates the windows: [backend.md](backend.md).

`App` also applies the theme (`app_theme`; `system` follows the OS), the UI language (`app_language`), and the font family and size. Its global keydown handler blocks Ctrl shortcuts except c, v, x, a, z and y, blocks the F-keys, closes the window on Escape, and opens the devtools on F12 when `dev_mode` is on.

`App` imports every window module, so module-level code in any window's files (event listeners, the audio context in `useVoice`) runs in every window.

## Layout

| Path | Holds |
| --- | --- |
| `src/main`, `src/App` | Boot and choosing the window component |
| `src/window/<Name>/` | One directory per window; subcomponents in subdirectories |
| `src/components/WindowControl/` | Minimise, maximise and close buttons for frameless windows (hidden on macOS) |
| `src/components/AgentCliConfig/` | The settings form shared by the Claude Code and Codex translate services |
| `src/hooks/` | `useConfig`, `useGetState`, `useSyncAtom`, `useToastStyle`, `useVoice` |
| `src/utils/` | Store and env setup, `debounce`, language detection, language tables, service instance keys, the plugin loader, the Claude Code and Codex session helper (`agent_cli`) |
| `src/i18n/` | i18next setup and `locales/*.json` |
| `src/types/` | Shared TypeScript types; so far the service types (`service.ts`) |
| `src/services/` | Built-in services: [services.md](services.md) |

## Translate window

- Text arrives through `invoke('get_text')` when the window mounts, and through the `new_text` event afterwards. Two payloads are special: `[INPUT_TRANSLATE]` opens an empty input, and `[IMAGE_TRANSLATE]` first runs OCR on the cut screenshot (`invoke('get_base64')`) with the first OCR instance.
- New text is trimmed, optionally stripped of newlines (`translate_delete_newline`) or appended to the previous text (`incremental_translate`), and its language is detected with `src/utils/lang_detect`.
- Translation starts when the text is committed to `sourceTextAtom`: on new text, on Enter (without Shift), on the translate button, or one second after typing when `dynamic_translate` is on.
- There is one result card (`components/TargetArea`) per enabled instance in `translate_service_list`, each calling its service as described in [services.md](services.md). If the source is `auto` and the detected language equals the target, a card translates into `translate_second_language` instead.
- Streaming services call `setResult` repeatedly; a per-card request id drops updates from superseded requests.
- A card can speak the result (first TTS instance), copy it, translate it back, retry, and send it to each collection service.
- Each finished card result is saved to SQLite (`sqlite:history.db`, table `history`) unless `history_disable` is on.
- Auto-copy (`translate_auto_copy`) is skipped while the clipboard monitor is on.
- The window closes when it loses focus, unless `translate_close_on_blur` is off or the window is pinned (`translate_always_on_top`). Position and size can be remembered.

## Other windows

- **Recognize**: shows the cut screenshot (`invoke('get_base64')`, refreshed on `new_image`) and runs OCR with the chosen instance and language (defaults: the first in `recognize_service_list`, and `recognize_language`). Its Translate button posts the text to the app's own HTTP API (`/translate`).
- **SilentRecognize**: renders nothing and is never shown. It reads the cut screenshot (`invoke('get_base64')`), runs the first instance in `recognize_service_list` with `recognize_language`, applies `recognize_delete_newline`, writes the text to the clipboard and closes. A `new_image` event while it is still working starts another run, and only the latest result is copied. A failure, an unsupported language or an empty result sends a system notification instead.
- **Screenshot**: shows a full-screen capture of the current monitor (`invoke('screenshot')`, which writes `pot_screenshot.png`). Instead of a cursor it draws a horizontal and a vertical line through the pointer, across that one monitor. It polls `invoke('cursor_position')` every 50 ms: to place the lines before the mouse has moved, and to follow the cursor to another monitor (hide, leave full screen, move, enter full screen, capture again, show when the capture has loaded), unless a region is being dragged. Dragging selects a region; on release it calls `invoke('cut_image')` and emits `success`. macOS uses the system `screencapture` tool instead of this window.
- **Updater**: runs Tauri's `checkUpdate()`, shows the release notes as markdown, downloads with a progress bar, installs, and relaunches.
- **Config**: a sidebar plus react-router pages (`src/window/Config/routes/`); `/` redirects to `/general`.

| Config page | Holds |
| --- | --- |
| General | Autostart, update check, HTTP port, UI language, theme, fonts, tray click (Windows), transparency, dev mode, proxy |
| Translate | Default languages, detection engine, auto-copy, history, incremental and dynamic translation, window behaviour |
| Recognize | Default OCR language and window behaviour |
| Hotkey | The five global shortcuts |
| Service | Instances per kind (translate, OCR, TTS, collection), their settings, external plugins |
| History | Browse, edit and clear the translation history; send entries to collections |
| Backup | Back up settings and history to WebDAV, Aliyun Drive or a local file, and restore them |
| About | Version, links, update check, the log and config folders |

## State

- All settings live in one JSON store; reference: [config-keys.md](config-keys.md).
- `useConfig(key, defaultValue, { sync = true })` returns `[value, setValue, getValue]`. `value` is `null` until the store has been read; a missing key gets the default, which is also written to the store. `setValue(v)` updates state at once and, after 500 ms without another change, saves the store and emits `<key>_changed` (with `.` replaced by `_` and `@` by `:`). Every `useConfig` for that key, in every window, listens to that event; that is how windows stay in sync. With `{ sync: false }`, only `setValue(v, true)` saves.
- `deleteKey(key)` removes a key without emitting an event.
- jotai atoms hold state shared inside one window (source text, detected language, selected languages, the OCR image and text). Each window is a separate JavaScript context, so atoms never cross windows.
- `useGetState` is `useState` plus a getter that reads the latest value. `useSyncAtom` keeps a local copy of an atom and pushes it to the atom when told to.

## Talking to Rust

- Commands: `invoke('<name>', args)` from `@tauri-apps/api/tauri`. What each one does: [backend.md](backend.md).
- Events listened to: `new_text`, `new_image`, `agent_cli_stream`, `reload_plugin_list`, `<key>_changed`, and Tauri's `tauri://blur`, `tauri://focus`, `tauri://move`, `tauri://resize`, `tauri://update-download-progress`.
- Events emitted: `<key>_changed`, `success` (Screenshot), `reload_plugin_list` (plugin install and uninstall).
- Requests to outside services go through Tauri's HTTP client (`fetch` from `@tauri-apps/api/http`), which runs in Rust, so CORS does not apply.

## i18n

- `src/i18n/` imports 19 locale files and registers each under the app's language code (`en_US.json` as `en`, `zh_CN.json` as `zh_cn`, `pt_BR.json` as `pt_br`, …).
- Fallbacks: `zh_cn` and `zh_tw` to each other, `pt_pt` and `pt_br` to each other, `nb_no` and `nn_no` to each other, everything else to `en`.
- Keys are dotted paths in one namespace: `config.general.app_theme`, `languages.<code>`, `services.translate.<name>.title`, `common.ok`.
- Upstream translated the locales on Weblate; this fork is not connected to it, so edit the JSON files directly. A new UI string needs at least an `en_US.json` entry; missing keys fall back to English.

## Styling

- Tailwind with the NextUI plugin; the light and dark palettes are defined in the Tailwind config (`tailwind.config` at the repository root). Dark mode is the `dark` class that `next-themes` sets.
- CSS files: `src/style.css` (rounded transparent window, thin scrollbars), `src/window/Config/style.css`, `src/components/WindowControl/style.css`.
- Icons come from `react-icons`; flags from `flag-icons` (`fi fi-<country>` classes; codes in `src/utils/language`).
- Draggable lists use `react-beautiful-dnd`; the result card's collapse animation uses `@react-spring/web`.

Frontend bugs found so far: [known-issues.md](known-issues.md).
