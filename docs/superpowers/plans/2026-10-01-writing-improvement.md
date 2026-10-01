# Writing Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A hotkey rewrites the selected text with a free online LLM by default, offers tones and a custom prompt, and replaces the selection with the result the user clicks.

**Architecture:** A new `writing` service kind (`src/services/writing/`), a new `writing` window (`src/window/Writing/`) that grows downwards through a Rust command, and a Rust action that reads the selection, remembers the app it came from and pastes the chosen result back.

**Tech Stack:** Tauri 1 (Rust), React 18 in strict TypeScript, NextUI, Vitest. One new Rust dependency: `enigo` 0.2 (already in `Cargo.lock` through `selection`).

**Spec:** [2026-10-01-writing-improvement-design.md](../specs/2026-10-01-writing-improvement-design.md)

## Global Constraints

- Branch `feat/writing-improvement`; small commits, one topic each; a refactor is its own commit.
- Tests never reach a paid service: unit tests fake the network; the real app is opened in test mode only, which forces `['llm7']`.
- Real-app windows open on the secondary monitor (test mode), and the owner's `config.json` is backed up before and restored after.
- New UI strings go to `en_US.json` and `zh_CN.json`; other locales fall back to English.
- A built-in prompt is one line without `"`, `%` or line breaks (it passes through `cmd.exe`).
- Execution: native, in this session (ruling: the tasks share interfaces closely, and the owner asked not to be stopped for execution-method choices). The plan gives interfaces and test cases; code is written against them with TDD.

## Review Focus

1. Text with `$&`, quotes or line breaks reaches the service unchanged (no `replaceAll` templating). Test in Task 1.
2. A service answers with an HTTP error or an empty choice: the box shows the error and a retry, the window stays usable. Tests in Tasks 2 and 6.
3. New text arrives while results are on their way: late answers for the old text are dropped. Test in Task 6.
4. Tones pressed with a disabled service in the list: only enabled services get boxes. Test in Task 6 (`results.ts`).
5. Test mode: replace must not paste or touch the clipboard. Rust guard in Task 5; the window test checks the command is still the only thing called.

---

### Task 1: Prompt and contract

**Files:** create `src/utils/writing_prompt.ts`, `src/utils/writing_prompt.test.ts`; modify `src/types/service.ts`.

**Produces:**

```ts
export const DEFAULT_WRITING_PROMPT: string;
/** `Style: …\n`, `Request: …\n`, blank line, text. Line breaks in style and request become spaces. */
export function writingMessage(text: string, options?: { style?: string; request?: string }): string;
// src/types/service.ts
export interface WritingOptions { config: ServiceConfig; style?: string; request?: string; setResult?: (partial: string) => void }
export type WritingService = ServiceModule<{ improve: (text: string, options: WritingOptions) => Promise<string> }>;
```

- [ ] Tests: message with neither line starts with a blank line; with both, in that order; a request with a line break is flattened; text with `$&` and `"""` is kept; the default prompt matches no `/[\r\n"%]/`.
- [ ] Implement; `pnpm test src/utils/writing_prompt`; commit "Add the writing prompt" and "Add the writing service contract".

### Task 2: HTTP services and the registry

**Files:** create `src/services/writing/chat.ts` (+test), `src/services/writing/llm7/{index.ts,info.ts,Config.tsx}` (+test), `src/services/writing/openai/{index.ts,info.ts,Config.tsx}` (+test), `src/services/writing/index.ts`, `public/logo/llm7.svg`; modify `src/i18n/locales/en_US.json`, `zh_CN.json`.

**Produces:**

```ts
// chat.ts: one non-streaming chat completion through Tauri's fetch
export function chatUrl(requestPath: string): string; // adds https:// and /v1/chat/completions unless the path ends in /chat/completions; no doubled /v1
export async function chat(request: { url: string; apiKey?: string; model: string; systemPrompt: string; message: string }): Promise<string>;
// throws `Http Request Error\nHttp Status: <n>\n<body>` or the JSON of a reply without text
```

- `llm7`: `https://api.llm7.io/v1/chat/completions`, `model` default `default`, no `Authorization` header.
- `openai`: `requestPath` default `https://api.openai.com/v1/chat/completions`, `model` default `gpt-4o-mini`, `Authorization: Bearer <apiKey>`.
- Both `Config` forms: instance name, their fields, an instructions textarea (default `DEFAULT_WRITING_PROMPT`), Save tests with `improve('hello', { config })` first, as the translate forms do. `llm7`'s form saves under its instance key (it has settings).
- i18n: `services.writing.<name>.title`, `services.writing.model`, `services.writing.request_path`, `services.writing.api_key`, `services.writing.instructions`, `services.writing.llm7.description` (says the text goes to llm7.io).

- [ ] Tests (httpMock): request body snapshot for each service (system + user message, model); the reply's text trimmed; HTTP 500 throws the status; empty `choices` throws; `chatUrl` cases (`api.openai.com`, `https://x/v1`, `…/chat/completions`).
- [ ] Commits: chat helper; llm7; openai; registry.

### Task 3: Command-line services

**Files:** modify `src/components/AgentCliConfig/index.tsx` (+test); create `src/services/writing/{claude_code,codex}/{index.ts,info.ts,Config.tsx}` (+one test each); modify registry.

- [ ] Refactor commit, no behaviour change: `AgentCliConfig` takes optional `kind` (`'translate'` default), `defaultSystemPrompt` and `testPrompt`, used for the title key, the default instructions and the form's test run. Existing tests pass unchanged.
- [ ] `improve` = `runAgentCli(agentCliSpec(provider, { ...config, systemPrompt: config.systemPrompt || DEFAULT_WRITING_PROMPT }), writingMessage(text, { style, request }), setResult)`.
- [ ] Tests: the spec and prompt `agent_cli_run` receives, for both.

### Task 4: Rust settings

**Files:** modify `src-tauri/src/config.rs`, `src-tauri/src/agent_cli.rs`.

- [ ] `check_service_available`: prune `writing_service_list` against `["llm7", "openai", "claude_code", "codex"]`, no plugins.
- [ ] `configured_specs` split into `specs_in(list: &Value, config_of: impl Fn(&str) -> Option<Value>) -> Vec<Spec>` (pure, tested) and a caller that reads both `translate_service_list` and `writing_service_list`. Test: specs come from both lists, duplicates once, disabled and unsaved skipped.
- [ ] `cargo test agent_cli`.

### Task 5: Rust action, window and replace

**Files:** modify `src-tauri/src/window.rs`, `main.rs`, `hotkey.rs`, `server.rs`, `Cargo.toml`.

**Produces (commands):** `get_writing_text() -> String`; `fit_writing_window(height: f64)`; `writing_replace(text: String) -> Result<(), String>`. Event `new_writing_text` (payload: the text). State `WritingText(Mutex<String>)`.

- [ ] `writing_window()`: `build_window("writing", "Writing")`; new window: skip taskbar, 460x120 logical, placed with `beside` a zero-size anchor at `placement_point()` inside `translate_area`.
- [ ] `selection_writing()` / `text_writing(text)` as in the spec; the foreground window handle is kept in an `AtomicIsize` (Windows).
- [ ] `fit_writing_window`: physical height = `ceil(height * scale)`; corner = `inside(x, y, width, height, translate_area)`; `set_rect`.
- [ ] `writing_replace`: test mode closes the window and returns; otherwise hide, `SetForegroundWindow` (Windows), 150 ms, save clipboard text, set text, paste (`enigo`: Control or Meta + `v`), 300 ms, restore, close.
- [ ] Hotkey `hotkey_selection_writing` in both match blocks and in `all`; HTTP `/selection_writing` and `/writing`.
- [ ] `cargo check`; commits: window and text; fit; replace; hotkey; HTTP.

### Task 6: The window

**Files:** create `src/utils/writing_tones.ts`, `src/window/Writing/results.ts` (+test), `src/window/Writing/Grow.tsx`, `src/window/Writing/ResultCard.tsx`, `src/window/Writing/index.tsx` (+test); modify `src/App.tsx`, `src/test/fake-tauri.ts`, `src/style.css`, locales.

**Produces:**

```ts
// writing_tones.ts
export interface Tone { name: string; instruction: string }
export const DEFAULT_TONES: Tone[]; // Professional, Casual, Friendly, Confident, Concise
// results.ts
export interface ResultSpec { id: string; service: string; label?: string; style?: string; request?: string }
export function enabledServices(list: string[], configs: ServiceConfigMap): string[];
export function defaultResults(services: string[]): ResultSpec[];
export function toneResults(tones: Tone[], services: string[]): ResultSpec[]; // tone by tone
export function customResults(request: string, services: string[], round: number): ResultSpec[];
```

- `Grow`: animates its height to its content's (measured with `react-use-measure`, `offsetSize`), from 0 on mount; `animated={false}` leaves the height to the content.
- `ResultCard`: props `{ text, spec, config, animated, onState, onReplace }`; asks its service on mount and on retry; drops answers of an older run.
- `index.tsx`: text from `get_writing_text` and `new_writing_text`; test mode forces `['llm7']`; fits the window to `bar + content` up to 80% of `screen.availHeight`, one `fit_writing_window` call at a time; shows itself after the first fit; blur close as the Translate window.

- [ ] `results.ts` tests: order with two services and two tones is `t1/a, t1/b, t2/a, t2/b`; disabled services dropped; ids unique across rounds of the same custom request.
- [ ] Window tests (label `writing`, httpMock): the default box shows the service's answer; Tones adds five boxes with the tone names and sends each instruction as `Style:`; Custom Prompt + Enter sends `Request:` and clears the input; a click on a box calls `writing_replace` with its text; a failed request shows the error and Retry asks again; new text drops a late answer; test mode ignores `writing_service_list`; `fakeTauri.unhandled` is empty.
- [ ] Commits: tones; result order; Grow; card; window; App wiring.

### Task 7: Settings

**Files:** create `src/window/Config/pages/Writing/index.tsx` (+test), `src/window/Config/pages/Service/Writing/{index.tsx,SelectModal/index.tsx,ConfigModal/index.tsx,ServiceItem/index.tsx}`; modify `pages/Hotkey/index.tsx` (+test), `pages/Service/index.tsx` (+test), `routes/index.tsx`, `components/SideBar/index.tsx`, locales.

- [ ] Writing page: tones list (name input, instruction input, delete), Add Tone, Reset; switches for `writing_window_animation` and `writing_close_on_blur`. Tests: shows the five default tones; editing a name saves `writing_tones`; reset restores.
- [ ] Hotkey row `config.hotkey.selection_writing` ("Writing Improvement"); test lists six shortcuts.
- [ ] Service tab "Writing" with `LLM7 (free)` by default; the page test checks the tab.
- [ ] Commits: one per page.

### Task 8: Smoke and docs

- [ ] `scripts/smoke.ts`: `Writing` in `APP_TITLES`; scenario `writing`: `POST /writing` with `me and him goes to the store`, expects `Tones`.
- [ ] Wiki: architecture (window, flow, command count), frontend (window, config page, events), backend (commands, events, hotkeys, HTTP), services (kind, table, adding), config-keys, testing (test mode), setup if needed. AGENTS.md intro line. Three READMEs: intro sentence and one new fork bullet each.

### Task 9: Verify and ship

- [ ] `pnpm check:docs && pnpm typecheck && pnpm test && pnpm build`; `cargo test agent_cli placement` in `src-tauri/`.
- [ ] Real app: back up `%APPDATA%\com.pot-app.desktop\config.json`; `pnpm tauri dev`; test mode on; `POST /writing`; screenshot through the smoke helper; `pnpm smoke`; test mode off; restore the config.
- [ ] Push, PR to the fork, wait for CI, merge with a merge commit.
