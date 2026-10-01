# Testing

## Commands

| Command | What it does |
| --- | --- |
| `pnpm test` | Runs every `*.test.ts(x)` under `src/`, and every `*.test.ts` under `scripts/`, once (Vitest, jsdom) |
| `pnpm test:watch` | The same, re-running on change |
| `pnpm test src/services/translate/deepl` | Only the tests under one path (no `--`: with it, pnpm passes the path in a way Vitest ignores and the whole suite runs) |

CI runs `pnpm test` on every PR.

Rust has unit tests only for `agent_cli` (the arguments it starts the tools with, and how it reads their output). Run them from `src-tauri/` with `cargo test agent_cli`; CI does not. `cargo test agent_cli -- --ignored --nocapture` also runs two tests against the real Claude Code with the signed-in account, each a one-line translation.

## Layout

Tests sit next to the code they test (`src/utils/index.test.ts` tests `src/utils/index`). Snapshots live in `__snapshots__/` beside the test. Test helpers live in `src/test/`:

| File | Provides |
| --- | --- |
| `src/test/setup.ts` | Runs before every test file: installs the fakes below, freezes time and randomness, stubs browser APIs jsdom lacks |
| `src/test/http.ts` | `httpMock`: replaces `fetch` from `@tauri-apps/api/http` |
| `src/test/fake-tauri.ts` | `fakeTauri`: an in-memory Tauri backend answering every IPC call |
| `src/test/stream.ts` | `stubFetch`, `streamBody`, `sseEvent`: the browser `fetch` and streamed bodies, for the services that do not use Tauri's `fetch` |
| `src/test/harness.test.ts` | Tests of the helpers above, including the frozen values |

## What is frozen

| Thing | Value in tests |
| --- | --- |
| `Date` | `2026-01-02T03:04:05.678Z` (a stubbed `Date`; timers stay real, and `vi.useFakeTimers()` starts from this time) |
| `Math.random()` | `0.123456789` |
| `nanoid()` | `'nanoid-fixed-id'` |
| `uuid.v4()` | `'01234567-89ab-4cde-8f01-23456789abcd'` |
| Tauri paths | `/fake/<BaseDirectory name>[/<path>]`, for example `/fake/AppConfig/config.json` |
| OS (`initEnv`) | `Windows_NT`, `x86_64`, `10.0.26200`; change `fakeTauri.os` before calling `initEnv()` |

## HTTP

Queue one response per request the code will make, in order, then inspect what it sent:

```ts
import { httpMock } from '../../../test/http';

httpMock.queue({ data: { translation: 'hallo' } });
const result = await translate('hello', 'en', 'de');
expect(result).toBe('hallo');
expect(httpMock.calls).toMatchSnapshot();
```

`queue({ status: 500, data: {...} })` makes a failed response (`ok` is false). A request with nothing queued throws `httpMock: no response queued for <METHOD> <url>`. Code that uses the browser's `fetch` instead (chatglm, streaming openai and geminipro, ollama) uses `stubFetch` from `src/test/stream`: it replaces the global `fetch` for one test and returns a function listing the calls in the same `{ url, options }` shape. Build streamed bodies with `streamBody(...reads)` (or `streamBody(text, readSize)` to split bytes across reads) and server-sent events with `sseEvent(delta)`.

## The fake Tauri backend

- Rust commands: defaults for every command the app calls (`get_text` → `''`, `lang_detect` → `'en'`, …). Override one with `fakeTauri.command('get_text', () => 'hello')`.
- Settings: `fakeTauri.store` is the settings file (`config.json`); seed it before rendering, read it after.
- Events: `listen`/`emit` work between all code under test; `fakeTauri.emit('new_text', 'hi')` plays Rust emitting an event; `fakeTauri.emitted` records what the app emitted.
- Files: `fakeTauri.files.set('AppCache:pot_screenshot_cut.png', [137, 80])` (base directory name, colon, path) or a plain path.
- `fakeTauri.calls` records every IPC call; `fakeTauri.unhandled` lists calls the fake did not recognise. A render test asserts `unhandled` is empty.
- Window label: `@tauri-apps/api/window` reads it when first imported, so set it at the top of the test file:

  ```ts
  vi.hoisted(() => {
      (window as any).__TAURI_METADATA__ = { __windows: [{ label: 'translate' }], __currentWindow: { label: 'translate' } };
  });
  ```

## Rules

- These are characterization tests: they pin what the code does today, including its bugs (see [known-issues.md](known-issues.md)). A refactor must keep them passing without changing them.
- Snapshot files change only in a PR that means to change behaviour, and that PR says which snapshots changed and why. Never run `vitest -u` to make a refactor pass.
- Prove a new test can fail: break the code under test on purpose (one character), watch the test fail, restore.

## Real-app smoke test

`pnpm smoke` checks the real app on Windows. Start the app first with the "Tauri dev" run configuration in RustRover (or `pnpm tauri dev`), then run the "Smoke test" run configuration (or `pnpm smoke`). If you switched branches since starting the app, restart it first; otherwise every scenario can time out waiting for its window ([setup-and-run.md](setup-and-run.md#run)). It:

1. Stops at once, with exit code 1, if nothing answers on the app's HTTP port (`server_port`, default 60828) or the app is not this repository's dev build (`src-tauri\target\debug\Be Native.exe`).
2. Turns on the app's test mode (below), closes any open app windows, then runs four scenarios through the HTTP API: `config` (`GET /config`, window shows "General Settings"), `translate` (`POST /translate` with `hello world`, which the window must show), `input` (`GET /input_translate`), and `ocr` (writes a "Hello World" image to the app's `pot_screenshot_cut.png`, then `GET /ocr_recognize?screenshot=false`). Each scenario waits up to 15 s for its window, reads its text through UI Automation where it checks text, saves a screenshot, and closes the window. The window draws the screenshot itself (`PrintWindow`), so other windows covering it, or showing through its translucent parts, do not appear in it. It turns test mode off again at the end.
3. Fails on any `[ERROR]` or `panicked` line the app logged during the run, except translation services failing on the network (`[<service>]happened error`), which it lists as warnings: several default services depend on servers that are gone (see [known-issues.md](known-issues.md)). A JavaScript error in such a line (`TypeError`, `ReferenceError`, `SyntaxError`, `RangeError`, `is not a function`, `is not defined`, `Cannot read propert…`) still fails the run: the Translate window logs every translate error through that same line, so a bug in the app's own code looks like a network failure otherwise. Some services already throw a `TypeError` on an unexpected server reply (see known-issues.md), so a live provider answering with an error body can fail the run without any refactor bug; check the log line before blaming the change. The report keeps only the first line of each error; the HTTP status and reply follow it in the app's log, `Be Native (Debug).log` ([setup-and-run.md](setup-and-run.md#data-on-disk)). A service can also start failing for outside reasons: Google answers `Http Status: 429` with a "Sorry..." page when it rate-limits the app. `scripts/smoke/log.ts` sorts the lines; `pnpm test` runs its tests.

Results go to `test-results/smoke/<time>/` (gitignored): `report.json` and one PNG per scenario. `scripts/smoke/windows.ps1` holds the Windows helpers (find, capture and close windows; read UI Automation text; draw the OCR image).

The baseline from the JavaScript code is kept at `test-results/smoke/baseline-js/` on the owner's machine. Its `config.png` was captured again on 2026-10-01, while the Config window was still JavaScript, because the first one showed another app covering the window. After a refactor, run the smoke test again and compare the screenshots with it: layout, labels and the shown image must match; live translation results may differ.

The smoke test does not touch the mouse, the keyboard or the focus, so the owner can keep working while it runs. If it says the app has no test mode, the running app was built before test mode existed: restart it.

### Test mode

A debug build has a test mode for testing in the background. `GET /test_mode?on=true` on the app's HTTP API turns it on and `?on=false` turns it off; it is off at launch, and release builds do not have it. While it is on:

- New windows open at the centre of the secondary monitor (the first monitor that is not the primary one; the primary one if it is alone) instead of on the monitor under the mouse cursor, sized by that monitor's scale. The cursor is not read or moved.
- On Windows, windows are shown without being activated and are never focused, so the window the owner is typing in keeps the focus. A window that never had the focus cannot lose it, so the Translate window does not close itself (`translate_close_on_blur`). On Linux and macOS a shown window still takes the focus.
- The Translate window translates with Google alone (`google`, with its default settings), whatever `translate_service_list` holds: Google is free, while the owner's services may spend an AI subscription or a paid API. The setting itself is not changed. Do not test a paid service against the real provider unless the owner asks for it; use the unit tests, which fake the network.
- The Translate window does not save its size or position (`translate_remember_window_size`, `translate_window_position`), so a test cannot change what the owner saved.

The Translate window reads test mode when it opens, so turn it on before opening the window. OCR, language detection and text-to-speech still use the configured services.

To open a window by hand without disturbing the owner, turn test mode on, send the HTTP request, and turn it off when done:

```bash
curl "http://127.0.0.1:60828/test_mode?on=true"
curl "http://127.0.0.1:60828/config"
curl "http://127.0.0.1:60828/test_mode?on=false"
```

Test mode cannot cover what needs real input: global hotkeys, selection translation (it reads the selection of the foreground app) and dragging a region in the Screenshot window, which also covers its monitor and takes the focus.

The `ocr` screenshot's text pane shows either nothing or the loading skeleton, depending on when the screenshot is taken: the window never finishes loading ([known-issues.md](known-issues.md)). Both match the baseline.

## Render tests

Every window (`src/window/<Name>/index.test.tsx`; SilentRecognize's tests check what it copies, since it renders nothing), every settings page (`src/window/Config/pages/<Page>/index.test.tsx`) and `src/App.test.tsx` has a render test:

- Set the window label in a `vi.hoisted` block before importing the component (see above).
- Import `src/i18n` so labels are the English text from `en_US.json`; render inside `NextUIProvider`, plus `MemoryRouter` for the Config window and its pages.
- Assert the labels the user sees, and end with `expect(fakeTauri.unhandled).toEqual([])`.
- Keep the network out: a window that detects a language when it opens (Translate) needs `fakeTauri.store.set('translate_detect_engine', 'local')`; an unqueued HTTP request fails the run as an unhandled rejection.
- Wait for whatever happens after the settings load (`findBy…`, `vi.waitFor`), never for a fixed time.

React prints development warnings from the app's own code during these tests (`defaultProps` in react-beautiful-dnd, a `className={false}` in the Translate window's source area), and react-beautiful-dnd prints development-only "Unable to find drag handle" setup messages in the Service settings page test. They are not failures.
