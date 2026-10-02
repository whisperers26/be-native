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
| `writing` | `src/window/Writing/` | The writing improvement hotkey, the HTTP API |
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
| `src/components/AgentCliConfig/` | The settings form shared by the Claude Code and Codex services, for translation and for writing (`kind`) |
| `src/hooks/` | `useConfig`, `useGetState`, `useSyncAtom`, `useToastStyle`, `useVoice` |
| `src/utils/` | Store and env setup, `debounce`, language detection, language tables, service instance keys, the plugin loader, the Claude Code and Codex session helper (`agent_cli`), the writing prompt and the default tones (`writing_prompt`, `writing_tones`), `showWindow`, `focusWindow` and `isTestMode` (`window`): a window shows and focuses itself through these, never `appWindow.show()` or `appWindow.setFocus()`, so that [test mode](testing.md#test-mode) can keep it in the background |
| `src/i18n/` | i18next setup and `locales/*.json` |
| `src/types/` | Shared TypeScript types; so far the service types (`service.ts`) |
| `src/services/` | Built-in services: [services.md](services.md) |

## Translate window

- Text arrives through `invoke('get_text')` when the window mounts, and through the `new_text` event afterwards. Two payloads are special: `[INPUT_TRANSLATE]` opens an empty input, and `[IMAGE_TRANSLATE]` first runs OCR on the cut screenshot (`invoke('get_base64')`) with the first OCR instance.
- New text is trimmed and, unless `translate_merge_lines` is off, its wrapped lines are merged (`mergeLines` in `src/utils/merge_lines`: a line that left room for the next word, or that a list marker follows, keeps its break; a full line is joined to the next. Lines are measured by letter widths, and "full" is learned from how far the block's own longer lines reach). With `incremental_translate` it is appended to the previous text. Its language is detected with `src/utils/lang_detect`.
- Translation starts when the text is committed to `sourceTextAtom`: on new text, on Enter (without Shift), on the translate button, or one second after typing when `dynamic_translate` is on.
- There is one result card (`components/TargetArea`) per enabled instance in `translate_service_list`, each calling its service as described in [services.md](services.md). If the source is `auto` and the detected language equals the target, a card translates into `translate_second_language` instead.
- Streaming services call `setResult` repeatedly; a per-card request id drops updates from superseded requests.
- A card can speak the result (first TTS instance), copy it, translate it back, retry, and send it to each collection service.
- Each finished card result is saved to SQLite (`sqlite:history.db`, table `history`) unless `history_disable` is on.
- Waiting. A window opened for a text or a screenshot starts as a round progress indicator (`components/Progress`): Rust opens it 88 px square and answers `translate_window_waiting`. The content is laid out unseen, at the size the window will open to (the remembered size, or the one `fitSize` settles on), while `stageAtom` (`progress.ts`) is `waiting`. The indicator shows the icon of the service at work: the OCR instance while an image is recognized (`sourceBusyAtom`), then the translate instances whose cards are loading (`cardProgressAtom`), taking turns every 1.4 s when there are several. Once the source text is ready and every card has finished, with a result or an error, the window opens (`opening`, 600 ms) and is then `shown`, for as long as it lives: new text in an open window does not bring the indicator back. Pressing the indicator opens the window at once. The input window, and a window opened without text, never wait.
- Opening. The window draws its own opening instead of growing frame by frame, which would resize the web view every frame. It asks Rust where its corner will be (`translate_window_origin`), takes its size in one step (`fit_translate_window` with `glide: false`), see-through but for the indicator, which stays where it was on the screen, and then pours out of the indicator's disc: its `clip-path` goes through the shapes of `liquid.ts` (a drop that swells around the disc, runs to the far edges with its sides bowed out, and settles with a small wobble; all paths of the same commands, played with the Web Animations API; 30 steps sampled from curves that run through the whole way, because keyframes that each ease in and out bring the shape to rest at every one of them, which shows as a stutter) while the content, a layer of its own, fades in and scales up from 0.92 with a slight bounce. When that is over it calls `translate_window_opened`, which gives the window its shadow. The indicator itself pops in (340 ms) when the source area first shows the window (`windowShowingAtom`). Until the window has opened, a card's height animation is switched off, so that the window is not measured half open. While the window opens its content is drawn scaled, so nothing that decides a size may be measured as drawn (`getBoundingClientRect`): the cards measure their layout size (`useMeasure` with `offsetSize`) and the window its content's `offsetHeight`, plus a pixel, because a content a fraction of a pixel taller than its room brings a scrollbar that takes width from the text. Each of the indicator's arcs is an svg in a `div` of its own, and the `div` turns: the compositor keeps a turning `div` going while the page's thread is busy, which it is for the whole recognition with RapidOCR (it runs in the window). An animation on the `svg` element or inside it runs on the page's thread and stands still that long (measured on 2026-10-01: the arc's direction did not change during recognition). With `window_animation` off, the indicator and the window come at once and later fits do not glide; only the ring still turns.
- Size. With `translate_remember_window_size` on, the window keeps the size Rust opened it with and saves it, in logical pixels, 100 ms after a resize. With it off, the window fits itself to what it shows: a `ResizeObserver` on the content measures it, `fitSize` (`auto_size.ts`) works out the size, and `fit_translate_window` applies it. The height is the content's, up to 75% of the screen's work area and 800 px; beyond that the content scrolls. The width starts at 420 px and grows in steps of 40 px while the window would be more than 0.7 times as tall as wide and a text of three lines or more could still use the room, up to 60% of the work area and 900 px. The width only grows while the source text stays the same, so that the window cannot go back and forth between two widths; for new source text it is worked out anew. A window as tall as it may be shows the translations before the source text: the box around the source text gives up the height that is missing, in whole lines and down to three, and scrolls (`sourceHeightAtom`). Rust takes 160 ms to get the window to a size, so after asking for one the window waits until it has it (or 500 ms) and then measures again. The text boxes take their height from their text again when their width changes.
- Auto-copy (`translate_auto_copy`) is skipped while the clipboard monitor is on.
- The window closes when it loses focus, unless `translate_close_on_blur` is off or the window is pinned (`translate_always_on_top`). Position and size can be remembered.

## Writing window

- Text arrives through `invoke('get_writing_text')` when the window mounts, and through the `new_writing_text` event afterwards. New text starts the window over: its boxes are keyed by a count of the texts, so the old ones are unmounted and their late answers dropped.
- `results.ts` says which boxes there are, each one request to one service (`ResultSpec`): the default rewrite from each enabled instance of `writing_service_list`; after a press on Tones, every tone of `writing_tones` from every service, tone by tone; after a custom prompt (the Enter key or the Enter button), that request from every service. The later boxes are kept in the order they were asked for, so no box ever moves.
- A box (`ResultCard`) asks its service when it appears ([services.md](services.md)), shows shimmering bars as tall as the original text while it waits, then the rewrite, or the error with a retry button. A click on a finished box, or Enter on it, calls `writing_replace` with its text; the copy button copies instead. It aborts its request's `signal` when it is unmounted or retried.
- Growth. Every box and the custom prompt's input sit in a `Grow`, which animates its height to that of what it holds (260 ms), from nothing when it first shows. A `ResizeObserver` on the content asks Rust for the window's height (`fit_writing_window`) on every change, which during such an animation is every frame: one request at a time, each for the height of that moment. Rust keeps the window's top left corner and moves it up only when the bottom of the work area is in the way, so the window grows downwards with its content. The window shows itself after the first fit. At 80% of the work area's height it stops growing, and the content scrolls, to the newest boxes. Until then the content never scrolls: a scrollbar that came and went would rewrap the text. `window_animation` off makes boxes and window take their size at once.
- The window closes when it loses focus (`writing_close_on_blur`) unless pinned, on Escape, and after a replace.
- In test mode it asks `llm7` alone, whatever `writing_service_list` holds ([testing.md](testing.md#test-mode)).

## Other windows

- **Recognize**: shows the cut screenshot (`invoke('get_base64')`, refreshed on `new_image`) and runs OCR with the chosen instance and language (defaults: the first in `recognize_service_list`, and `recognize_language`). Its Translate button posts the text to the app's own HTTP API (`/translate`).
- **SilentRecognize**: renders nothing and is never shown. It reads the cut screenshot (`invoke('get_base64')`), runs the first instance in `recognize_service_list` with `recognize_language`, merges wrapped lines unless `recognize_merge_lines` is off, writes the text to the clipboard and closes. A `new_image` event while it is still working starts another run, and only the latest result is copied. A failure, an unsupported language or an empty result sends a system notification instead, and is written to the log.
- **Screenshot**: shows a full-screen capture of the current monitor (`invoke('screenshot')`, which writes `pot_screenshot.png`). Instead of a cursor it draws a horizontal and a vertical line through the pointer, across that one monitor. It polls `invoke('cursor_position')` every 50 ms: to place the lines before the mouse has moved, and to follow the cursor to another monitor (hide, leave full screen, move, enter full screen, capture again, show when the capture has loaded), unless a region is being dragged. Dragging selects a region; on release it calls `invoke('cut_image')` and emits `success`. macOS uses the system `screencapture` tool instead of this window.
- **Updater**: runs Tauri's `checkUpdate()`, shows the release notes as markdown, downloads with a progress bar, installs, and relaunches.
- **Config**: a sidebar plus react-router pages (`src/window/Config/routes/`); `/` redirects to `/general`.

| Config page | Holds |
| --- | --- |
| General | Autostart, update check, HTTP port, UI language, theme, fonts, tray click (Windows), transparency, dev mode, proxy |
| Translate | Default languages, detection engine, auto-copy, history, incremental and dynamic translation, window behaviour |
| Writing | The tones (name and instruction each), window animations, close on blur |
| Recognize | Default OCR language and window behaviour |
| Hotkey | The six global shortcuts |
| Service | Instances per kind (translate, writing, OCR, TTS, collection), their settings, external plugins |
| History | Browse, edit and clear the translation history; send entries to collections |
| About | Version, links, update check, the log and config folders |

## State

- All settings live in one JSON store; reference: [config-keys.md](config-keys.md).
- `useConfig(key, defaultValue, { sync = true })` returns `[value, setValue, getValue]`. `value` is `null` until the store has been read; a missing key gets the default, which is also written to the store. `setValue(v)` updates state at once and, after 500 ms without another change, saves the store and emits `<key>_changed` (with `.` replaced by `_` and `@` by `:`). Every `useConfig` for that key, in every window, listens to that event; that is how windows stay in sync. With `{ sync: false }`, only `setValue(v, true)` saves.
- `deleteKey(key)` removes a key without emitting an event.
- jotai atoms hold state shared inside one window (source text, detected language, selected languages, the OCR image and text). Each window is a separate JavaScript context, so atoms never cross windows.
- `useGetState` is `useState` plus a getter that reads the latest value. `useSyncAtom` keeps a local copy of an atom and pushes it to the atom when told to.

## Talking to Rust

- Commands: `invoke('<name>', args)` from `@tauri-apps/api/tauri`. What each one does: [backend.md](backend.md).
- Events listened to: `new_text`, `new_writing_text`, `new_image`, `agent_cli_stream`, `reload_plugin_list`, `<key>_changed`, and Tauri's `tauri://blur`, `tauri://focus`, `tauri://move`, `tauri://resize`, `tauri://update-download-progress`.
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
