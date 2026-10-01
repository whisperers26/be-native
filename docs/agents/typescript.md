# TypeScript

The frontend was converted from JavaScript to strict TypeScript, one layer per PR, without changing what it does. `src/` holds no JavaScript any more: `tsconfig.json` does not allow it, and CI fails on a `.js` or `.jsx` file there.

## Configuration

| File | Covers | Notes |
| --- | --- | --- |
| `tsconfig.json` | `src/` (app code and tests) | `strict`, `verbatimModuleSyntax`, `jsx: react-jsx`, `useDefineForClassFields: true`; types from `vite/client` |
| `tsconfig.node.json` | `scripts/`, `vitest.config.ts`, `vite.config.ts`, `tailwind.config.ts` | Node types; for the tooling scripts run with `tsx` and the build configs |

`pnpm typecheck` checks both. CI runs it on every PR.

Two settings exist to keep the migration behaviour-free:

- `verbatimModuleSyntax`: TypeScript keeps every import exactly as written. Without it, an import used only as a type, or not at all, would be dropped from the output, which can change which modules run. Import types with `import type`.
- `useDefineForClassFields: true`: class fields keep JavaScript's semantics; TypeScript's default for older targets would emit them differently.

## Type policy

- Types only. A conversion adds annotations and nothing else: no new default values, `?.`, `??`, guards, enums, or reformatting. If a fix seems needed, record the bug in [known-issues.md](known-issues.md) and fix it in its own PR.
- `strict` everywhere. `any` only for data whose shape the app does not control (HTTP responses, plugin code loaded with `eval`) and for gaps in third-party types; prefer a small local interface where the code reads only a few fields.
- Type-only escape hatches are fine because they emit nothing: `as` (`options: TranslateOptions = {} as TranslateOptions`), the non-null `!` (`document.getElementById('root')!`), and `satisfies`.
- `@ts-expect-error` needs a comment saying why. Do not put it inside an object literal: esbuild keeps a comment that stands before a property, so the output changes; use an `as` cast on the value there.
- Where a known bug's line cannot take a `@ts-expect-error` (a read inside an object literal), type it with `!` or `as` and put `// known bug (known-issues.md): <what>` before the statement.
- Keep the line breaks of call arguments, object and array literals and import lists: esbuild keeps their layout, so re-wrapping them, by hand or with a formatter, changes the output. A parameter list that grew too long with its types may be wrapped (esbuild prints parameters on one line); `pnpm check:transpile` shows any wrap that does change the output.
- Declare class fields with `declare` (`declare voice: string;`). With `useDefineForClassFields`, a plain field declaration is emitted as a field set to `undefined`.
- Type an HTTP reply with the `fetch` type argument (`fetch<DeepLResponse>(url, options)`), not with a cast on `res.data`.
- Type a Tauri event's payload with `listen`'s type argument (`listen<DownloadProgress>(event, handler)`), following the Rust struct: an `Option<T>` field is `T | null`.
- Tauri's `fetch` types require `method` in the options, but at run time it defaults to GET. Where the code passes options without `method`, leave it out and mark the call with `@ts-expect-error` and that reason: adding `method: 'GET'` changes the output. A call without options (`fetch(url)`) needs nothing.
- Give `useConfig` a type argument when its default does not show the stored type: an empty `[]` or `{}` (`useConfig<string[]>(key, [])`), or a value whose type changes once edited (anki's `port` is a number by default and a string after the user types one).
- DOM calls that cannot tell the element type return a base type: `createElement('CANVAS')` gives an `HTMLElement` (TypeScript maps only lowercase tag names) and `querySelector('.x')` an `Element`. Use the type argument (`querySelector<HTMLElement>('.x')`) or an `as` cast.
- Look a service up by a name known only at run time through its registry's contract: `(builtinServices as Record<string, TranslateService>)[name]`. The contracts (`TranslateService`, `RecognizeService`, `TtsService`, `CollectionService`) are in `src/types/service.ts`.
- Some values are empty until something has run: `useConfig` returns `null` until the store has been read, `atom<string>()` holds `string | undefined`, `useState()` starts `undefined`. Where the code runs after that and does not check, take the value with `!`. If the unchecked read can really fail, record the bug and mark the line with `@ts-expect-error`.
- Keep `useRef()` as it is, because `useRef(null)` is a different call in the output, and cast it: `useRef<HTMLTextAreaElement>() as MutableRefObject<HTMLTextAreaElement>`. If the element is not always rendered, cast to `MutableRefObject<HTMLImageElement | null>` instead, so every read takes a visible `!`.
- A `@ts-expect-error` may stand before a statement inside a function that is a JSX attribute's value (an `onPress` handler), but not between attributes. Before a JSX child, `{/* @ts-expect-error ... */}` covers errors inside that child, but not a child the parent's children type rejects (NextUI's collection children): TypeScript then reports the error on the comment itself. Cast such a child instead (`as any`) and explain it in a `{/* ... */}` comment, which esbuild drops. A literal attribute value the type rejects takes a cast in braces, which emits the same string: `radius={'10' as unknown as 'lg'}` (one literal type converts to another only through `unknown`). If the value is a mistake, record it as a bug.
- Typing gaps in the windows' libraries: NextUI's `onAction` hands back a `Key` (cast `as string` when the item keys are strings); Tauri's `toLogical` result does not fit a `PhysicalPosition` variable, and `PhysicalPosition | LogicalPosition` is not narrowed because every physical position also fits the logical type, so annotate the union and cast the call (`(position as PhysicalPosition).toLogical(factor)`); `parseInt(position.x)` takes a number where the type wants a string, so it needs a cast (`position.x as unknown as string`, which emits the same call) or a `@ts-expect-error` with that reason; the cast is narrower, since it cannot hide another error on the line.
- More gaps met in the Config window's forms and tables: NextUI's `Input` types `value` as a string, so a number goes through `unknown` (`value={port as unknown as string}`), and a `string | number` takes a plain `as string`. React turns every `key` into a string, so a numeric `key={10}` still reaches `onAction` as `'10'`, and a setting saved from such a menu is `number | string` (`useConfig<number | string>`), not a number. `TableColumn` requires children, which a hidden header does not need, so each childless column takes a `{/* @ts-expect-error ... */}`; a `TableBody` render function that answers `false` to skip a row needs its result cast to `ReactElement`. A `catch (e)` variable is `unknown`; where the handler only calls `toString()` on what Tauri or a util threw, write `catch (e: any)`.

## Proving a migration changed nothing

Every migration PR shows three things:

1. `pnpm check:transpile` passes. It compiles every renamed or modified source file under `src/` twice, as it was on the base (`origin/main` by default, `--base <ref>` to change) and as committed at `HEAD`, with the esbuild that Vite uses, and requires identical JavaScript. It reads commits only, so it refuses to run while `src/` has uncommitted changes: commit first. New files must compile to nothing (types only), and no snapshot file may change. If a difference is intended and explained in the PR, name the file with `--allow <path>`.
2. `pnpm test` passes with the test files changed at most in their types and the snapshots untouched.
3. For windows and services, the real-app smoke test matches the JavaScript baseline ([testing.md](testing.md)).

## New code

All of `src/` is TypeScript. Write a new file as `.ts`, or `.tsx` when it holds JSX, and follow the type policy above; CI fails on a `.js` or `.jsx` file in `src/`. When a change should touch types only, such as tightening a type, `pnpm check:transpile` still proves it.

## Migration status

| Layer | Scope | Status |
| --- | --- | --- |
| L0 | Toolchain, `check:transpile` | Done |
| L1 | `src/utils`, `src/hooks`, `src/i18n`, `src/types` | Done |
| L2 | `src/services` | Done |
| L3 | `src/components`, `src/window` | Done |
| L4 | `src/main`, `src/App`, `index.html`, Vite and Tailwind configs; `allowJs` off | Done |

Staying JavaScript on purpose: `postcss.config.js`, `public/*.js` (bundled Tesseract files), external `.potext` plugins.
