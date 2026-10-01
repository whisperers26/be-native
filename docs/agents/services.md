# Services

Built-in translation, OCR ("recognize"), text-to-speech and collection (word book) services live in `src/services/<kind>/<name>/`. External plugins (`.potext`) add more at runtime. Windows reach both through service instance keys stored in the settings.

## Kinds

| Kind | Registry | Main function | Built-ins |
| --- | --- | --- | --- |
| translate | `src/services/translate/index` | `translate(text, from, to, options)` | 21 |
| recognize | `src/services/recognize/index` | `recognize(base64, language, options)` | 15 |
| tts | `src/services/tts/index` | `tts(text, lang, options)` | 1 |
| collection | `src/services/collection/index` | `collection(source, target, options)` | 2 |

## A service module

`src/services/<kind>/<dir>/` holds three files:

- `index`: the main function, then `export * from './Config'` and `export * from './info'`.
- `info.ts`: `info = { name, icon }` and, except for collection services, a `Language` enum.
- `Config`: `export function Config(props)`, the settings form.

The registry re-exports each module under its service name, which must equal `info.name`. Directory names can differ: `recognize/baidu` is `baidu_ocr`.

The types live in `src/types/service.ts`: `ServiceModule` is what every module provides, and `TranslateService`, `RecognizeService`, `TtsService` and `CollectionService` are each kind's contract. Each registry checks its modules against its contract with `satisfies`, so a module that breaks it fails `pnpm typecheck`.

`Language` is a TypeScript string enum from the app's language codes (`auto` plus `languageList` in `src/utils/language`) to the provider's codes. Callers test support with `appCode in Language` and pass `Language[appCode]`. Values may repeat (`zh_cn` and `zh_tw` can both map to `ZH`).

## Calling convention

| Kind | Called as | Returns |
| --- | --- | --- |
| translate | `translate(text.trim(), Language[from], Language[to], { config, detect, setResult })` | A string or a dictionary object. Streaming services return `'[STREAM]'` when there is no `setResult` |
| recognize | `recognize(base64Png, Language[lang], { config })` | A string |
| tts | `tts(text, Language[lang], { config })` | Audio bytes (a number array) |
| collection | `collection(sourceText, result, { config })` | Ignored |

- `config` is the instance's settings object from the store, or `{}` if none was ever saved.
- `detect` is the detected source language, as an app code. `setResult(partial)` streams partial text; openai, geminipro, chatglm and ollama use it.
- A dictionary result (`DictionaryResult`) is `{ pronunciations: [{ region?, symbol, voice }], explanations: [{ trait, explains: string[] }], associations?: string[], sentence?: [{ source, target? }] }`. google, youdao, bing_dict, cambridge_dict and ecdict can return one (cambridge_dict leaves out `associations` and `sentence`); the Translate window renders it specially.
- Services signal errors by throwing, usually a string such as `` `Http Request Error\nHttp Status: ${status}\n...` ``, sometimes an `Error`. Callers show `e.toString()`.
- The Translate window calls every enabled translate instance. TTS, and the OCR step of image translation, use the first instance in their list. The Recognize window lets the user pick.

## Settings forms

`Config` receives `{ name, instanceKey, pluginType, pluginList, updateServiceList, onClose }`; built-ins use `instanceKey`, `updateServiceList` and `onClose`.

The usual form calls `useConfig(instanceKey, { instanceName: t('services.<kind>.<name>.title'), ...defaults }, { sync: false })`. On submit it runs the service once with a canned input (translate: `'hello'` from `auto` to `zh_cn`); only if that succeeds does it save with `setConfig(config, true)`, call `updateServiceList(instanceKey)`, and `onClose()`.

Services with no settings (bing, yandex, bing_dict, cambridge_dict, ecdict and lingva for translate; system, tesseract and qrcode for OCR) call `updateServiceList('<name>')` with the bare name, so each has at most one instance.

## Instances

- An instance key is `<service>@<random base36>` (`createServiceInstanceKey` in `src/utils/service_instance`). Keys without `@` come from older versions and still work. A key whose service part starts with `plugin` is a plugin.
- Each kind's instances are listed, in order, in `translate_service_list`, `recognize_service_list`, `tts_service_list` and `collection_service_list`; each instance's settings are stored under its key. See [config-keys.md](config-keys.md).
- At launch, Rust removes every list entry whose service is neither in its built-in lists (`check_service_available` in `src-tauri/src/config.rs`) nor an installed plugin.

## Adding a built-in service

1. Create `src/services/<kind>/<name>/` with `index`, `info.ts` and `Config`, modelled on a service of the same kind (deepl for a keyed translate API, lingva for a keyless one).
2. Re-export it from `src/services/<kind>/index` under `<name>`, equal to `info.name`.
3. **Add `<name>` to the matching built-in list in `check_service_available` in `src-tauri/src/config.rs`. Without this, the app removes the service from the user's list at the next launch.**
4. Add a logo under `public/logo/` and set `info.icon` to `logo/<file>`.
5. Add `services.<kind>.<name>.title`, and any labels the form uses, to `src/i18n/locales/en_US.json`; other locales fall back to English.
6. Make HTTP requests with `fetch` and `Body` from `@tauri-apps/api/http`: they run in Rust, so CORS does not apply.

## Unusual services

- Not using Tauri's `fetch`: chatglm (global `fetch`), openai and geminipro when streaming (`window.fetch`), ollama (the `ollama/browser` package), tesseract (`tesseract.js`, with its worker and core in `public/`), qrcode (canvas and `jsqr`), system OCR (`invoke('system_ocr')`).
- Reading the cut screenshot from disk instead of using the `base64` argument: baidu_img_ocr, simple_latex_ocr, and system OCR (in Rust).
- Signing requests with the current time or random values: alibaba, baidu and baidu_field, tencent (translate and OCR), volcengine (translate and OCR), the three iflytek OCR services, youdao, chatglm (a JWT signed with `jose`), deepl's free endpoint.

## External plugins

- A plugin is a `.potext` zip whose file name starts with `plugin` and which contains `info.json` and `main.js`. Plugin list and templates: https://pot-app.com/plugin.html.
- Config → Service → add external plugin → install calls `invoke('install_plugin', { pathList })`. Rust extracts the zip to `<app config dir>/plugins/<plugin_type>/<name>/`, taking `plugin_type` from `info.json`. Uninstalling deletes that directory.
- `info.json` fields the app reads: `display`, `icon`, `homepage`, `plugin_type`, `language` (app code → plugin code), and `needs` (`[{ key, display, type?: 'input' | 'select', options? }]`), which the plugin settings form (`src/window/Config/pages/Service/PluginConfig/`) renders.
- `invoke_plugin(kind, name)` (`src/utils/invoke_plugin`) reads `main.js` on every call and runs it with `eval`; the script must define a function named after its kind (`translate`, `recognize`, `tts` or `collection`). It is called like a built-in, with `info.language` codes and with `utils` added to the options: `tauriFetch`, `http`, `readBinaryFile`, `readTextFile`, `Database`, `CryptoJS`, `run` (runs a program in the plugin directory through `run_binary`), `cacheDir`, `pluginDir`, `osType`.
- Plugins run with the app's full Tauri API access.

## Language detection

`src/utils/lang_detect` detects the source language with the engine in `translate_detect_engine` (default `baidu`): the web endpoints of baidu, google, tencent, niutrans, yandex or bing, or `local` (Rust, offline). An unknown engine name falls back to `local`; a failed detection returns `en`.
