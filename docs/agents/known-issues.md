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

## Services

- **System OCR has no Portuguese.** The `system` OCR `Language` maps `pt_pt`, but its per-OS language tables use the key `pt`, so Portuguese becomes `undefined`.
- **Some error paths throw `TypeError`s.** caiyun and lingva (translate) call `.trim()` on the response object while building their error message; volcengine OCR (both variants) calls `.trim()` on `undefined` when the response has no `data`. The user sees a `TypeError` instead of the provider's error.
- **The DeepL API check uses a comma operator.** `(result.translations, result.translations[0])` only tests its second operand.
- **Lingva TTS fails silently.** On an HTTP error it returns `undefined` instead of throwing.
- **Anki errors are ignored.** The `error` field of AnkiConnect's replies is never checked.
- **QR code OCR can hang.** The image loader has no `onerror`, so an unreadable image never settles.

## Rust

- **A wrongly typed setting panics.** Rust reads settings with `as_bool()`, `as_i64()` or `as_str()` followed by `unwrap()`; a value of another type panics, at launch if it is read during setup. Example: with the proxy enabled and a host set, an empty or non-numeric `proxy_port` (the settings page's default is `''`) crashes the app at launch.
- **Offline detection never returns Ukrainian.** The `lang_detect` command builds its detector without Ukrainian (only the warm-up includes it), so `uk` is never returned.
- **A cancelled screenshot leaves its listener behind.** The `success` listener on the screenshot window is removed only when it fires, and Tauri 1 keeps a closed window's listeners; after a cancelled capture, a later successful one can also run the stale action.
- **One bad HTTP request stops the API.** A non-UTF-8 request body, or a failed response, panics the server thread; the HTTP API stays down until restart.
- **Deleted settings can come back.** The frontend and Rust each cache `config.json`, and a reload merges into the cache instead of replacing it, so a key deleted by one side is written back by the other side's next save.
- **Two unused imports.** `src-tauri/src/window.rs` imports `std::fs` and `dirs::cache_dir` without using them, which causes two compiler warnings.
- **The updater offers upstream's successor.** `tauri.conf.json` still points the updater at upstream's feed, which now announces "4.0.0" (a notice about upstream's new app, Manggo, asking users not to update). Every launch with `check_update` on opens the Updater window, and its Update button would install upstream's build. Disabling or redirecting the updater is a product decision for the owner.
- **The single-instance plugin dereferences a null pointer.** Its Windows window procedure reads its user-data pointer before setting it. Debug builds made with newer Rust check for null dereferences and abort at launch, so `src-tauri/Cargo.toml` turns debug assertions off for `tauri-plugin-single-instance` in the dev profile (release builds never had them). The real fix belongs in the plugin.
