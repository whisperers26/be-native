# Known issues

Bugs in code inherited from upstream, not fixed yet. Each one was confirmed by reading the code. To fix one, use its own `fix/` branch and delete its entry in the same PR. When you find a new bug and do not fix it, add it here.

## Frontend

- **The language swap can throw.** In `src/window/Translate/components/LanguageArea`, the second-language branch of the swap calls `setTargetLanguage(secondLanguage)`, but the variable is named `translateSecondLanguage`, so that branch throws a `ReferenceError`.
- **The Translate window never reloads plugins.** `src/window/Translate/` registers its `reload_plugin_list` listener only `if (!unlisten)`, but `unlisten` already holds the blur listener, so installing or removing a plugin does not reach an open Translate window.
- **The result spinner ignores dark mode.** `TargetArea` compares the `useTheme()` object with `'dark'`, so the spinner always uses the light colour.
- **The second-language target is not checked.** `TargetArea` checks the selected target against the service's `Language`, then may switch to `translate_second_language` without checking that one; an unsupported second language reaches the service as `undefined`.
- **Target auto-copy depends on list position.** Only the card at position 0 of `translate_service_list` copies the target text; if that instance is disabled, target auto-copy never happens.
- **Dynamic translate does not debounce.** `SourceArea` keeps its timer in a variable that is re-created on every render, so every keystroke schedules its own translation one second later.
- **Font size classes may not exist.** `SourceArea` and `TargetArea` build Tailwind classes at runtime (`text-[${appFontSize}px]`); Tailwind only generates classes it finds written out in the source.
- **Keydown listeners pile up.** `src/App` adds a global keydown listener on every `dev_mode` change and never removes the previous one.
- **`deleteKey`'s check does nothing.** In `src/hooks/useConfig`, `store.has(key)` is not awaited, so the condition is a promise and always true. Deleting still works.
- **Two UI locales are unused.** `src/i18n/locales/ta_IN.json` and `tk_TM.json` are never imported, so Tamil and Turkmen cannot be selected.
- **Uninstalled plugins leave instances behind.** Uninstalling removes only list entries equal to the plugin's bare name, but instances are stored as `<plugin>@<id>`; they stay in the service lists, and the Translate window then reads info for a plugin that no longer exists.
- **TTS plugin settings look in the wrong list.** The TTS settings dialog passes `pluginType='translate'` to the plugin settings form.
- **Aliyun backup without a login throws.** The Backup page shows "log in first" and then calls `.then` on an undefined result. The `local` backup also ignores the file name it is given.
- **The Recognize window can stay loading.** Opened through the HTTP API with `/ocr_recognize?screenshot=false` (seen on Windows 11 on 2026-10-01), the window shows the image but never a result, even after pressing Recognize. System OCR does return (each run is followed by its language-detection request), but the result is not rendered. The recognition effect can run before the instance and language atoms are both set, and its stale-result guard drops earlier results; the exact cause is not pinned down. The smoke test checks only that this window opens.

## Services

- **System OCR has no Portuguese.** The `system` OCR `Language` maps `pt_pt`, but its per-OS language tables use the key `pt`, so Portuguese becomes `undefined`.
- **Some error paths throw `TypeError`s.** caiyun and lingva (translate) call `.trim()` on the response object while building their error message; volcengine OCR (both variants) calls `.trim()` on `undefined` when the response has no `data`; iflytek_latex reads `result.data['region']` without checking `data`; tencent_img reads `Response.ImageRecord.Value` without checking `ImageRecord`. The user sees a `TypeError` instead of the provider's error.
- **The DeepL API check uses a comma operator.** `(result.translations, result.translations[0])` only tests its second operand.
- **Lingva TTS fails silently.** On an HTTP error it returns `undefined` instead of throwing.
- **Anki errors are ignored.** The `error` field of AnkiConnect's replies is never checked.
- **QR code OCR can hang.** The image loader has no `onerror`, so an unreadable image never settles; an image with zero width or height never settles either.
- **iflytek sends its authorization unencoded.** The iflytek and iflytek_intsig OCR services put the base64 `authorization` (which can contain `+`, `/` and `=`) into the query string as it is; only `date` is URL-encoded.
- **baidu_img's settings check misses an absent key.** It tests `appid === ''`, so a config without `appid` at all passes the check and the request is signed with `undefined`.
- **Several default translate services fail today.** Checked on 2026-10-01: lingva (`lingva.pot-app.com` no longer resolves), ecdict (`pot-app.com/api/dict` answers 405), bing (its token endpoint answers 404, so "Get Token Failed"), and deepl's free endpoint (rate-limited with 429). Four of the six default translate services show errors out of the box.
- **bing_dict sends the text unencoded.** It builds its URL with `q=${text}`, so an `&` or `#` in the text corrupts the query.
- **baidu_field sends "undefined" without a field.** Its `'it'` default exists only in the settings form; a config without `field` signs and sends `undefined`.
- **niutrans falls back to plain HTTP.** A config without `https` shows the switch as on, but the request goes to `http://`.
- **openai doubles `/v1`.** A base URL ending in `/v1` becomes `…/v1/v1/chat/completions`.
- **openai streaming can lose the whole reply.** After an event with empty `choices` (the shape of Azure's content-filter preamble), the buffer never parses again and the result is `''`.
- **geminipro streaming mis-parses chunks.** Its greedy regex throws a `SyntaxError` on two parts in one read and on a part spread over three reads (`temp += str` re-adds `temp`); it collapses whitespace runs inside the text; and it calls `setResult` unguarded at the end (a `TypeError` with neither `setResult` nor text). Its streaming HTTP error message, like openai's, ends in "undefined" because a `Response` has no `.data`.
- **chatglm streaming corrupts or drops text.** A delta without `content` appends "undefined"; a last event not followed by a blank line is dropped.
- **The LLM services expand `$` patterns in the user's text.** chatglm, geminipro, ollama and openai fill prompts with `replaceAll('$text', text)`, so `$$`, `$&` and similar in the text are interpreted; the later `$from`, `$to` and `$detect` replacements also run inside the inserted text; and `$detect` becomes "undefined" when no detected language is passed.
- **google's dictionary mode can throw.** It reads `result[0][1][3]` without a guard (a `TypeError` when there is no transliteration entry); a custom URL with a trailing slash requests `//translate_a/single`; any host beginning with "http" is taken to have a scheme.
- **youdao throws on an empty `exam_type`.** It calls `reduce` without an initial value.
- **transmart sends absent credentials as "undefined".** Its check is `!== ''`, so a config without `username` or `token` sends them as `undefined`.
- **ollama rewrites the server URL.** A `requestPath` without a scheme gets `https://`, and the ollama client adds its default port to explicit URLs.
- **deepl's free endpoint merges Portuguese variants.** `PT-BR` and `PT-PT` are both cut to `PT` by `slice(0, 2)`.

## Rust

- **A wrongly typed setting panics.** Rust reads settings with `as_bool()`, `as_i64()` or `as_str()` followed by `unwrap()`; a value of another type panics, at launch if it is read during setup. Example: with the proxy enabled and a host set, an empty or non-numeric `proxy_port` (the settings page's default is `''`) crashes the app at launch.
- **Offline detection never returns Ukrainian.** The `lang_detect` command builds its detector without Ukrainian (only the warm-up includes it), so `uk` is never returned.
- **A cancelled screenshot leaves its listener behind.** The `success` listener on the screenshot window is removed only when it fires, and Tauri 1 keeps a closed window's listeners; after a cancelled capture, a later successful one can also run the stale action.
- **One bad HTTP request stops the API.** A non-UTF-8 request body, or a failed response, panics the server thread; the HTTP API stays down until restart.
- **Deleted settings can come back.** The frontend and Rust each cache `config.json`, and a reload merges into the cache instead of replacing it, so a key deleted by one side is written back by the other side's next save.
- **Two unused imports.** `src-tauri/src/window.rs` imports `std::fs` and `dirs::cache_dir` without using them, which causes two compiler warnings.
- **The updater offers upstream's successor.** `tauri.conf.json` still points the updater at upstream's feed, which now announces "4.0.0" (a notice about upstream's new app, Manggo, asking users not to update). Every launch with `check_update` on opens the Updater window, and its Update button would install upstream's build. Disabling or redirecting the updater is a product decision for the owner.
- **The single-instance plugin dereferences a null pointer.** Its Windows window procedure reads its user-data pointer before setting it. Debug builds made with newer Rust check for null dereferences and abort at launch, so `src-tauri/Cargo.toml` turns debug assertions off for `tauri-plugin-single-instance` in the dev profile (release builds never had them). The real fix belongs in the plugin.
