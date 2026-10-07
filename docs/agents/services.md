# Services

Built-in translation, writing improvement, OCR ("recognize"), text-to-speech and collection (word book) services live in `src/services/<kind>/<name>/`. External plugins (`.potext`) add more at runtime. Windows reach both through service instance keys stored in the settings.

## Kinds

| Kind | Registry | Main function | Built-ins |
| --- | --- | --- | --- |
| translate | `src/services/translate/index` | `translate(text, from, to, options)` | 23 |
| writing | `src/services/writing/index` | `improve(text, options)` | 4 |
| recognize | `src/services/recognize/index` | `recognize(base64, language, options)` | 16 |
| tts | `src/services/tts/index` | `tts(text, lang, options)` | 1 |
| collection | `src/services/collection/index` | `collection(source, target, options)` | 2 |

## A service module

`src/services/<kind>/<dir>/` holds three files:

- `index`: the main function, then `export * from './Config'` and `export * from './info'`.
- `info.ts`: `info = { name, icon }` and, except for collection and writing services, a `Language` enum.
- `Config`: `export function Config(props)`, the settings form.

The registry re-exports each module under its service name, which must equal `info.name`. Directory names can differ: `recognize/baidu` is `baidu_ocr`.

The types live in `src/types/service.ts`: `ServiceModule` is what every module provides, and `TranslateService`, `WritingService`, `RecognizeService`, `TtsService` and `CollectionService` are each kind's contract. Each registry checks its modules against its contract with `satisfies`, so a module that breaks it fails `pnpm typecheck`.

`Language` is a TypeScript string enum from the app's language codes (`auto` plus `languageList` in `src/utils/language`) to the provider's codes. Callers test support with `appCode in Language` and pass `Language[appCode]`. Values may repeat (`zh_cn` and `zh_tw` can both map to `ZH`).

## Calling convention

| Kind | Called as | Returns |
| --- | --- | --- |
| translate | `translate(text.trim(), Language[from], Language[to], { config, detect, setResult })` | A string or a dictionary object. Streaming services return `'[STREAM]'` when there is no `setResult` |
| writing | `improve(text, { config, style, request, setResult, signal })` | A string |
| recognize | `recognize(base64Png, Language[lang], { config })` | A string |
| tts | `tts(text, Language[lang], { config })` | Audio bytes (a number array) |
| collection | `collection(sourceText, result, { config })` | Ignored |

- `config` is the instance's settings object from the store, or `{}` if none was ever saved.
- `detect` is the detected source language, as an app code. `setResult(partial)` streams partial text; openai, geminipro, chatglm, ollama, claude_code and codex use it.
- For writing, `style` is a tone's instruction and `request` the user's own; both are optional. `signal` is aborted when the rewrite is no longer wanted.
- A dictionary result (`DictionaryResult`) is `{ pronunciations: [{ region?, symbol, voice }], explanations: [{ trait, explains: string[] }], associations?: string[], sentence?: [{ source, target? }] }`. google, youdao, bing_dict, cambridge_dict and ecdict can return one (cambridge_dict leaves out `associations` and `sentence`); the Translate window renders it specially.
- Services signal errors by throwing, usually a string such as `` `Http Request Error\nHttp Status: ${status}\n...` ``, sometimes an `Error`. Callers show `e.toString()`.
- The Translate window calls every enabled translate instance. TTS, and the OCR step of image translation, use the first instance in their list. The Recognize window lets the user pick.

## Settings forms

`Config` receives `{ name, instanceKey, pluginType, pluginList, updateServiceList, onClose }`; built-ins use `instanceKey`, `updateServiceList` and `onClose`.

The usual form calls `useConfig(instanceKey, { instanceName: t('services.<kind>.<name>.title'), ...defaults }, { sync: false })`. On submit it runs the service once with a canned input (translate: `'hello'` from `auto` to `zh_cn`); only if that succeeds does it save with `setConfig(config, true)`, call `updateServiceList(instanceKey)`, and `onClose()`.

Services with no settings (bing, yandex, bing_dict, cambridge_dict, ecdict and lingva for translate; system, tesseract, rapidocr and qrcode for OCR) call `updateServiceList('<name>')` with the bare name, so each has at most one instance.

## Instances

- An instance key is `<service>@<random base36>` (`createServiceInstanceKey` in `src/utils/service_instance`). Keys without `@` come from older versions and still work. A key whose service part starts with `plugin` is a plugin.
- Each kind's instances are listed, in order, in `translate_service_list`, `writing_service_list`, `recognize_service_list`, `tts_service_list` and `collection_service_list`; each instance's settings are stored under its key. See [config-keys.md](config-keys.md).
- At launch, Rust removes every list entry whose service is neither in its built-in lists (`check_service_available` in `src-tauri/src/config.rs`) nor an installed plugin.

## Adding a built-in service

1. Create `src/services/<kind>/<name>/` with `index`, `info.ts` and `Config`, modelled on a service of the same kind (deepl for a keyed translate API, lingva for a keyless one).
2. Re-export it from `src/services/<kind>/index` under `<name>`, equal to `info.name`.
3. **Add `<name>` to the matching built-in list in `check_service_available` in `src-tauri/src/config.rs`. Without this, the app removes the service from the user's list at the next launch.**
4. Add a logo under `public/logo/` and set `info.icon` to `logo/<file>`.
5. Add `services.<kind>.<name>.title`, and any labels the form uses, to `src/i18n/locales/en_US.json`; other locales fall back to English.
6. Make HTTP requests with `fetch` and `Body` from `@tauri-apps/api/http`: they run in Rust, so CORS does not apply.

## Writing services

A writing service rewrites a text in the language it is written in. The Writing window asks every enabled instance ([frontend.md](frontend.md#writing-window)). There are no writing plugins.

| Service | What it asks | Settings |
| --- | --- | --- |
| `llm7` | LLM7.io, an OpenAI-compatible API that needs no key. The default, and the only one asked in test mode | `apiKey` (an optional free token), `model`, `systemPrompt` |
| `openai` | Any OpenAI-compatible chat API, with the user's key | `requestPath`, `apiKey`, `model`, `systemPrompt` |
| `claude_code`, `codex` | The installed command-line tool (below) | `command`, `model`, `effort`, `systemPrompt`, `models` |

- **One prompt for all of them** (`src/utils/writing_prompt`). The instructions (`DEFAULT_WRITING_PROMPT`, or the instance's `systemPrompt`) are the system prompt. The message (`writingMessage`) is `Style: <tone's instruction>`, `Request: <the user's request>`, a blank line, then the text; either line is left out when there is none. The style and the request are in the message so that the system prompt of a command-line service is the same for every request, and its waiting session serves any of them. The text is put in as it is, with no `$text` templating.
- **HTTP.** `llm7` and `openai` share `src/services/writing/chat` (`chatUrl`, `send`, `answer`, `chat`) and the form `ChatConfig`. They do not stream. `chatUrl` accepts a host, a base URL with or without `/v1`, or the full URL.
- **LLM7's limits** (seen on 2026-10-01). Its documentation (`docs.llm7.io/limits.md`) gives a free token 1 request a second, 60 a minute, 250 an hour and 100,000 tokens a day, and says nothing of requests without a token. Those were answered, but only a few in a row: about ten within a few minutes brought 429 with `retry_after` of up to a minute, and each request made before that time was over was refused again. After about forty within half an hour it said to wait 22 minutes. Its model `default` was at times refused with 402. So `llm7` makes the requests of a window take turns, waits as long as a 429 says, twice, and asks again, unless it says more than 65 s, which is shown as the error instead, and on any other refusal asks the next model: the configured one (default `mistral-Nemo-Instruct-2407`), then `codestral-latest`, then `default`. A request whose `signal` is aborted before its turn is not sent. The tones' five requests therefore arrive one after another.

## Unusual services

- Not using HTTP at all: claude_code and codex (`invoke('agent_cli_run')`, see above).
- Not using Tauri's `fetch`: chatglm (global `fetch`), openai and geminipro when streaming (`window.fetch`), ollama (the `ollama/browser` package), tesseract (`tesseract.js`, with its worker and core in `public/`), rapidocr (ONNX Runtime and models in `public/rapidocr/`, see below), qrcode (canvas and `jsqr`), system OCR (`invoke('system_ocr')`).
- Reading the cut screenshot from disk instead of using the `base64` argument: baidu_img_ocr, simple_latex_ocr, and system OCR (in Rust).
- Signing requests with the current time or random values: alibaba, baidu and baidu_field, tencent (translate and OCR), volcengine (translate and OCR), the three iflytek OCR services, youdao, chatglm (a JWT signed with `jose`), deepl's free endpoint.

## Command-line services (Claude Code, Codex)

`claude_code` and `codex` translate, and rewrite, through the command-line tool the user has installed and signed in to, so a translation uses that account's subscription and the app holds no key or token. Rust runs the tools (`src-tauri/src/agent_cli.rs`); the frontend's side is `src/utils/agent_cli` and the shared settings form `src/components/AgentCliConfig/`.

- **One translation, one session.** A session is one process of the tool. It gets one prompt, and is killed when its answer is complete.
- **A session waits in the background.** Starting the process is the slow part (about half a second for Claude Code), so Rust keeps one started session per distinct spec (provider, executable, model, reasoning level, instructions) of the enabled instances in `translate_service_list` and `writing_service_list`. It is started at launch and on every `reload_store`; sessions whose spec is no longer in the settings are killed. A translation takes the waiting session and Rust starts the next one at once. A waiting session has sent no request, so it uses nothing. With no waiting session (two translations at once, or the settings form's test run), one is started on demand.
- **Claude Code** runs as `claude -p --input-format stream-json --output-format stream-json --verbose --include-partial-messages --system-prompt <instructions> --tools "" --strict-mcp-config --setting-sources "" --no-session-persistence --disable-slash-commands`, plus `--model` and `--effort` when set, in the temp directory. That drops Claude Code's own system prompt, tools, MCP servers, settings files (hooks, plugins, CLAUDE.md) and skills, which leaves a request of about 500 input tokens. The reasoning level `off` sets `MAX_THINKING_TOKENS=0`; thinking is most of the time and the usage of a short translation (measured with haiku: 0.9 s without, 5 s with).
- **Codex** runs as `codex exec --json --skip-git-repo-check --sandbox read-only -`, plus `--model` and `-c model_reasoning_effort=<level>` when set, with the instructions and the text on stdin. Codex starts working only when its prompt ends, so its waiting session has saved only the process start. This half follows Codex's documented CLI; of it, only listing the models has been run against the real tool.
- **The prompt.** The instructions are the system prompt (Claude Code) or lead the prompt (Codex). The message is `Target language: <name>`, `Source language: <name>` unless it is to be detected, a blank line, then the text (`translationPrompt`). A writing service sends the writing message instead (above), and its form (`AgentCliConfig` with `kind='writing'`) offers the writing instructions.
- **Calling.** `runAgentCli(spec, prompt, setResult)` invokes `agent_cli_run` with a fresh id and listens for `agent_cli_stream` events `{ id, text }`, the text so far, which it passes to `setResult` with a `_` cursor. Errors (tool not found, not signed in, unknown model) reject with the tool's own message. A turn that ends without an answer rejects too, never resolves with an empty string: Claude Code closes a turn that was refused or broke off with a `result` line that has `is_error` and no `result`, only `subtype`, `stop_reason` and an `errors` list, and those become the message; a turn of either tool that completes with no text rejects with "… ended its turn without an answer". An empty message would show as an empty card, since the windows take an empty error for no error. Rust also logs every failed session as a warning.
- **The executable** is the `command` setting, or, when that is empty, `claude` or `codex` found on `PATH`, in `~/.local/bin`, in `%APPDATA%\npm` (Windows) or in `/usr/local/bin` and `/opt/homebrew/bin` (elsewhere).
- **The models.** The button beside the model field calls `listAgentCliModels(provider, command)`, which invokes `agent_cli_models`: Rust starts the tool, reads the models it offers the signed-in account and stops it, giving up after 20 s. No prompt is sent, so it uses nothing. Codex is run as `codex debug models`, whose catalog lists each model's `slug` and `display_name`; those with `visibility` `list` are kept. Claude Code is started as for a translation and sent the control request `{"type":"control_request","request_id":"models","request":{"subtype":"initialize"}}` on stdin; the `control_response` line that answers it holds `response.response.models`, each with `value`, `resolvedModel` and `displayName`. An alias (`opus`, `sonnet`, `haiku`) is listed as the exact model it resolves to, once; `default` is kept as it is. Neither is a documented interface of its tool (seen with Codex 0.160.1 and Claude Code 2.1.284), so a tool that answers differently gives an error and the field stays as it was. The form stores the list as `models` in the instance's settings and suggests it from then on, in place of the built-in `CLAUDE_CODE_MODELS` (Codex has no built-in list, and a plain text field until it has been asked). The field takes any name either way.
- Instance settings: `command`, `model`, `effort`, `systemPrompt`, and `models` (`[{ label, value }]`, the models last listed, which only the form reads). Rust reads the first four from the store to start the waiting session, so a change to their names needs both sides.

## RapidOCR

`rapidocr` is offline OCR with the PP-OCRv5 mobile models, the ones RapidOCR ships, run in the window with ONNX Runtime's WebAssembly build through the `esearch-ocr` package. Nothing leaves the computer and nothing is downloaded at run time.

- **Files.** Everything it loads is in `public/rapidocr/`, committed (about 35 MB) and served as it is: `ort.wasm.bundle.min.mjs` and `ort-wasm-simd-threaded.wasm` (copied from `node_modules/onnxruntime-web/dist/`, version 1.30.0, which is a dev dependency for its types and as the source of these two files), and `ppocr_v5_mobile_det.onnx`, `ppocr_v5_mobile_rec.onnx` and `ppocrv5_dict.txt` (from `ppocr_v5_mobile.zip` in release 4.0.0 of `xushengfeng/eSearch-OCR`). To update the runtime, bump the dev dependency and copy the two files again.
- **Why the runtime is not bundled.** `src/services/recognize/rapidocr/runtime.ts` imports the `.mjs` at run time by its full URL. Bundling it would put it through the build's `safari11` target on macOS and Linux, and Vite's dev server refuses to serve a file from `public/` as a module when it is imported by path.
- **One model, few languages.** The model reads Simplified and Traditional Chinese, English and Japanese at once, so `Language` has only `auto`, `zh_cn`, `zh_tw`, `en` and `ja`, and the language argument is ignored. Other languages need other recognition models, which are not bundled.
- **Margin.** The image is drawn onto a canvas 16 px larger on each side, filled with the colour of its corner pixel, because text detection misses text that touches the image edge (a tight selection around one word). Enlarging small text as well was tried and dropped: it made the model lose the spaces between words.
- **Output.** One line per line of text, in the library's reading order (columns, then paragraphs, then lines).
- **Cost.** The engine (runtime plus models) is loaded once per window and kept. Measured on Windows through the silent OCR copy action, a small selection took about 1.2 s from the request to the text on the clipboard, including opening the hidden window and loading the engine. It runs on one thread: more need `SharedArrayBuffer`, which the app's windows do not have.

## External plugins

- A plugin is a `.potext` zip whose file name starts with `plugin` and which contains `info.json` and `main.js`. Plugin list and templates: https://pot-app.com/plugin.html.
- Config → Service → add external plugin → install calls `invoke('install_plugin', { pathList })`. Rust extracts the zip to `<app config dir>/plugins/<plugin_type>/<name>/`, taking `plugin_type` from `info.json`. Uninstalling deletes that directory.
- `info.json` fields the app reads: `display`, `icon`, `homepage`, `plugin_type`, `language` (app code → plugin code), and `needs` (`[{ key, display, type?: 'input' | 'select', options? }]`), which the plugin settings form (`src/window/Config/pages/Service/PluginConfig/`) renders.
- `invoke_plugin(kind, name)` (`src/utils/invoke_plugin`) reads `main.js` on every call and runs it with `eval`; the script must define a function named after its kind (`translate`, `recognize`, `tts` or `collection`). It is called like a built-in, with `info.language` codes and with `utils` added to the options: `tauriFetch`, `http`, `readBinaryFile`, `readTextFile`, `Database`, `CryptoJS`, `run` (runs a program in the plugin directory through `run_binary`), `cacheDir`, `pluginDir`, `osType`.
- Plugins run with the app's full Tauri API access.

## Language detection

`src/utils/lang_detect` detects the source language with the engine in `translate_detect_engine` (default `local`): `local` (Rust, offline), or the web endpoints of baidu, google, tencent, niutrans, yandex or bing. An unknown engine name falls back to `local`. `detectLanguage(text)` answers `{ language, failed }`: when a web engine cannot be asked (an HTTP error, or no network) or names no language the app knows, `language` is `en` and `failed` is true, and the Translate window's language chip then reads "Detection failed (English)" (`translate.detect_failed`) in the warning colour. `local` never fails: it answers `en` when unsure. The default export, `detect(text)`, gives the language alone.

Text that mixes Chinese, Japanese or Korean with another script is detected by its larger part. The engines answer Chinese for mostly English text with a little Chinese in it (Google does from about one Chinese character per three English words), and the Translate window then translates into `translate_second_language`, which leaves the English as it was. So when the words in the other script outnumber the Chinese, Japanese and Korean characters counted two to a word, those characters are left out of the text the engine sees. The services still translate the whole text.
