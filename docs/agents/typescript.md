# TypeScript

The frontend is being converted from JavaScript to strict TypeScript, one layer per PR, without changing what it does. Until the last layer lands, `tsconfig.json` allows JavaScript files next to TypeScript ones.

## Configuration

| File | Covers | Notes |
| --- | --- | --- |
| `tsconfig.json` | `src/` (app code and tests) | `strict`, `verbatimModuleSyntax`, `jsx: react-jsx`, `useDefineForClassFields: true`, `allowJs` while migrating; types from `vite/client` |
| `tsconfig.node.json` | `scripts/`, `vitest.config.ts` | Node types; for the tooling scripts run with `tsx` |

`pnpm typecheck` checks both. CI runs it on every PR.

Two settings exist to keep the migration behaviour-free:

- `verbatimModuleSyntax`: TypeScript keeps every import exactly as written. Without it, an import used only as a type, or not at all, would be dropped from the output, which can change which modules run. Import types with `import type`.
- `useDefineForClassFields: true`: class fields keep JavaScript's semantics; TypeScript's default for older targets would emit them differently.

## Type policy

- Types only. A conversion adds annotations and nothing else: no new default values, `?.`, `??`, guards, enums, or reformatting. If a fix seems needed, record the bug in [known-issues.md](known-issues.md) and fix it in its own PR.
- `strict` everywhere. `any` only for data whose shape the app does not control (HTTP responses, plugin code loaded with `eval`) and for gaps in third-party types; prefer a small local interface where the code reads only a few fields.
- Type-only escape hatches are fine because they emit nothing: `as` (`options: TranslateOptions = {} as TranslateOptions`, `res.data as DeepLResponse`), the non-null `!` (`document.getElementById('root')!`), and `satisfies`.
- `@ts-expect-error` needs a comment saying why. Do not put it inside an object literal: esbuild keeps a comment that stands before a property, so the output changes; use an `as` cast on the value there.

## Proving a migration changed nothing

Every migration PR shows three things:

1. `pnpm check:transpile` passes. It compiles every renamed or modified source file under `src/` twice, as it was on the base (`origin/main` by default, `--base <ref>` to change) and as it is now, with the esbuild that Vite uses, and requires identical JavaScript. New files must compile to nothing (types only), and no snapshot file may change. If a difference is intended and explained in the PR, name the file with `--allow <path>`.
2. `pnpm test` passes with the test files changed at most in their types and the snapshots untouched.
3. For windows and services, the real-app smoke test matches the JavaScript baseline ([testing.md](testing.md)).

## Converting a file

1. Rename it in its own commit with `git mv`: `.jsx` with JSX to `.tsx`, `.jsx` without JSX and `.js` to `.ts`. Import paths stay extension-less, so nothing else changes.
2. Add types in follow-up commits, one module or a small group per commit.
3. Run `pnpm typecheck`, `pnpm test`, `pnpm check:transpile`, `pnpm build`.

## Migration status

| Layer | Scope | Status |
| --- | --- | --- |
| L0 | Toolchain, `check:transpile` | Done |
| L1 | `src/utils`, `src/hooks`, `src/i18n`, `src/types` | Done |
| L2 | `src/services` | In progress (translate services done) |
| L3 | `src/components`, `src/window` | Pending |
| L4 | `src/main`, `src/App`, `index.html`, Vite and Tailwind configs; `allowJs` off | Pending |

Staying JavaScript on purpose: `postcss.config.js`, `updater/*.mjs` (upstream's release tooling), `public/*.js` (bundled Tesseract files), external `.potext` plugins.
