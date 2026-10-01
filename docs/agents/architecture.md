# Architecture

Be Native is a fork of Pot, a Tauri 1 desktop app. One Rust process owns the windows, the tray, global shortcuts, a local HTTP API, the clipboard monitor, screenshots and system OCR. Each window is a WebView running the same React bundle, which picks what to render from the window's label.

| Piece | Where | Read |
| --- | --- | --- |
| Rust core | `src-tauri/` | [backend.md](backend.md) |
| React UI in TypeScript, one bundle for every window | `src/` | [frontend.md](frontend.md) |
| Translation, OCR, TTS and collection services, plugins | `src/services/` | [services.md](services.md) |
| Settings, one JSON file read by both sides | `config.json` | [config-keys.md](config-keys.md) |
| Tools, running, files on disk | | [setup-and-run.md](setup-and-run.md) |

## Windows

Rust creates windows on demand (`src-tauri/src/window.rs`), hidden; each shows itself when its React code is ready. All except `daemon` load `index.html`.

| Label | Purpose |
| --- | --- |
| `daemon` | Hidden static page created at launch; Rust uses it to find monitors |
| `translate` | Results from every enabled translate service |
| `recognize` | OCR of a screenshot region |
| `silent_recognize` | Never shown: copies the text of a screenshot region and closes |
| `screenshot` | Full-screen region picker (not on macOS, which uses `screencapture`) |
| `config` | Settings |
| `updater` | Update download and install |

Closing a window never quits the app; only Quit or Restart in the tray does. A second launch shows an "already running" notification and exits.

## Main flows

- **Selection translation.** Hotkey → Rust reads the selected text (UI Automation or a simulated copy on Windows) → stores it and opens or focuses the `translate` window → a new window fetches it with `get_text`, an open one receives `new_text` → the window detects the language and calls every enabled translate service.
- **Input translation.** The same, with the text `[INPUT_TRANSLATE]`, which opens an empty input box.
- **OCR.** Hotkey → Rust opens the `screenshot` window → it captures the monitor (`pot_screenshot.png`), the user drags a region, `cut_image` writes `pot_screenshot_cut.png`, and the window emits `success` → Rust opens `recognize` → it reads the image with `get_base64` and runs the chosen OCR service.
- **Image translation.** The same capture, then `[IMAGE_TRANSLATE]` goes to the `translate` window, which runs OCR with the first OCR service and translates the text.
- **Silent OCR copy.** The same capture, then Rust opens the `silent_recognize` window, which stays hidden, runs the first OCR service, writes the text to the clipboard and closes. Only a failure shows, as a notification.
- **Clipboard monitor.** Toggled from the tray. Rust polls the clipboard every 500 ms and sends new text to the `translate` window.
- **Local HTTP API.** `127.0.0.1:60828` lets other programs trigger the same actions; routes in [backend.md](backend.md).

## Settings

`config.json` in the app config directory is cached twice: by the frontend (`tauri-plugin-store`, through `useConfig`, which keeps windows in sync with `<key>_changed` events) and by Rust (`get` and `set` in `src-tauri/src/config.rs`). The frontend watches the file and calls `reload_store` so Rust picks up changes. Reloads merge rather than replace, and whichever side saves last writes its whole cache.

## How the two sides talk

- Frontend → Rust: `invoke('<command>', args)`, 21 commands.
- Rust → frontend: the events `new_text` and `new_image` to one window, and `translate_auto_copy_changed` to every window.
- Frontend → Rust: the event `success` from the screenshot window.
- Requests to outside services go through Tauri's HTTP client, which runs in Rust, so CORS does not apply.

## Inherited risks

- Windows run with `--disable-web-security` and a permissive content security policy.
- Plugins are run with `eval`, with full Tauri API access, and can start programs.
- The HTTP API has no authentication.
- The product name is "Be Native" (`productName` in `tauri.conf.json`). The app identifier (`com.pot-app.desktop`), the crate (`pot`), the log and screenshot file names and the `.potext` plugin extension are still upstream's, so settings and plugins carry over. The updater feed and update signing key are the fork's own.
