# Fork foundation: workflow, agent wiki, tests, TypeScript — design

Date: 2026-09-30
Status: approved in conversation, pending written-spec review

## Context

This repository (`whisperers26/be-native`) is a fork of `pot-app/pot-desktop`
("Pot"), which upstream has archived. Pot is a Tauri 1 desktop app: a Rust
backend in `src-tauri/` (~2.4k lines, 14 modules) and a React 18 frontend in
`src/` (141 JS/JSX files, ~16.7k lines, plus 41 small `.ts` files holding
service metadata and language tables). There are no tests, no `tsconfig`, and
the only CI workflow (`package.yml`) is upstream's signed release pipeline.

The owner wants to develop on this fork, largely through AI agents, without
affecting upstream.

## What was asked

1. Keep the README up to date with this repo's changes.
2. An `AGENTS.md` plus related markdown pages, structured as a wiki so agents
   load only what they need.
3. Refactor the JavaScript to TypeScript.
4. Test scripts, and real-app tests run in the IDE, proving the codebase works
   the same as before.
5. Put the workflow rules in this project's `AGENTS.md`: `main` replaces
   `master` as the main branch; agents work on their own branch per feature or
   fix and open and merge the PR themselves, unless the owner explicitly asks
   to review it, in which case the agent opens the PR and does not merge.

## Decisions taken in conversation

- Rust toolchain: installed via winget (`stable-x86_64-pc-windows-msvc`,
  rustc 1.98.1).
- README: all three languages (`README.md` zh, `README_EN.md`,
  `README_KR.md`) are kept in sync; every README change touches all three.
- Real-app tests: IDE run configurations plus a scripted smoke test, not a
  WebDriver E2E suite.
- TypeScript: layered and strict (option 1 of 3 considered; see below).

## Assumptions (stated to the owner, not contradicted)

- "Do not affect the original repo": every push and PR targets
  `whisperers26/be-native` only. No `upstream` remote is added; `gh` is pinned
  to the fork.
- "The code rule" = the branch/PR rules in item 5 plus the owner's commit rules
  from their global `CLAUDE.md`, copied into `AGENTS.md` so non-Claude agents
  follow them too.
- "Works the same as before" = the TypeScript migration changes types only,
  not runtime behaviour. Latent bugs that TypeScript exposes are recorded, not
  fixed.
- PRs are merged with merge commits (never squash) so small commits survive on
  `main`.

## 1. Repository and workflow

### Branch switch

- Rename `master` to `main` on GitHub with the branch-rename API (this also
  makes `main` the default branch).
- Update the local clone: rename the local branch, set its upstream to
  `origin/main`, refresh `origin/HEAD`.
- `gh repo set-default whisperers26/be-native`.
- Turn on "automatically delete head branches" on the fork.

### Rules (in `AGENTS.md`, detailed in `docs/agents/git-workflow.md`)

- Never commit to `main` directly.
- One branch per feature or fix, named `<type>/<slug>` with type one of
  `feat`, `fix`, `refactor`, `test`, `docs`, `ci`, `chore`.
- The owner's commit rules, copied verbatim: small commits, one topic each;
  mechanical changes (moves, renames, extractions) in their own commits;
  commit at each working step; only stage the files the commit is about.
- Open PRs with `gh pr create --repo whisperers26/be-native --base main`.
  Never target `pot-app/pot-desktop`.
- Merge only after local checks and CI pass:
  `gh pr merge <n> --repo whisperers26/be-native --merge --delete-branch`.
- Exception: when the owner explicitly asks to review a PR, open it, report the
  link, and do not merge.
- Any PR that changes behaviour, setup, commands, or project structure updates
  all three READMEs and the wiki pages it affects.

### CI

- New `.github/workflows/ci.yml` on `pull_request` to `main` and `push` to
  `main`, Ubuntu runner: `pnpm install --frozen-lockfile`, then `pnpm build`.
  Later PRs add `pnpm test` and `pnpm typecheck` to it as those commands
  appear.
- Add `"packageManager": "pnpm@10.14.0"` to `package.json` so CI and local use
  the same pnpm.
- Upstream's `package.yml` becomes `workflow_dispatch` only. As written it
  runs on any tag push and would try a signed multi-platform release with
  secrets this fork does not have.
- No Rust job in CI: nothing in this project changes Rust.

### Claude Code

- A one-line root `CLAUDE.md` containing `@AGENTS.md`, so Claude Code loads the
  same rules as other agents.

## 2. Tests

### Script tests (`pnpm test`)

- Vitest, jsdom, React Testing Library, and Tauri's official
  `@tauri-apps/api/mocks` (`mockIPC`, `mockWindows`). Config in
  `vitest.config.ts`.
- Test files sit next to the code: `*.test.ts` / `*.test.tsx`; snapshots in
  `__snapshots__/` beside them.
- All written against the current JavaScript and merged before any TypeScript
  conversion starts, so they characterize today's behaviour.
- Coverage:
  - Every built-in service (21 translate, 15 recognize, 1 TTS,
    2 collection = 39). With Tauri's `http.fetch` mocked and the clock,
    randomness and UUIDs frozen: snapshot the outgoing request (URL, method,
    headers, query, body, signatures); assert how a canned response is parsed
    into the return value; assert the error thrown for a failed response;
    snapshot the exported `info` and `Language` table.
  - Utilities: `debounce`, service instance keys, language tables, each
    language-detection engine (request and code mapping), store and env
    initialization.
  - Hooks: `useConfig` (default value, debounced persist, change event,
    cross-window listen), `useGetState`, `useSyncAtom`, `useToastStyle`.
  - Render tests with mocked IPC for each window (Translate, Recognize,
    Screenshot, Updater, Config) and each Config page: renders without
    throwing and shows its key labels. Not full DOM snapshots — those would
    turn every future UI change into snapshot churn.

### Real-app tests

- Shared RustRover run configurations committed as `.run/*.run.xml`: Tauri
  dev, unit tests, typecheck, smoke. (`.idea/` stays gitignored.)
- `pnpm smoke` (Windows): with the app already running, it drives the app
  through its local HTTP API (`127.0.0.1:60828`): open Config, `POST /translate`
  "hello world", open input translate, OCR a fixture image via
  `/ocr_recognize?screenshot=false`. For each step it checks the expected
  window appears, captures a screenshot to gitignored `test-results/smoke/`,
  and closes the window. At the end it scans the app log for errors and
  panics. Stronger assertions are added where cheap (for example, OCR output
  on the fixture image via the offline system OCR).
- Procedure: launch the app through RustRover's run configuration, run the
  smoke test on the JavaScript code to capture a baseline, then again after
  each TypeScript layer, and compare the screenshots visually against the
  baseline. Network-dependent content (live translation results) is expected
  to differ; layout, labels, and offline results (OCR) are not.

## 3. TypeScript migration

### Approaches considered

1. Layered and strict (chosen): `strict: true` from the start; convert one
   layer per PR; each PR proves it changed no runtime behaviour.
2. All at once, loose: rename everything, `strict: false`, `any` as needed.
   Rejected: one unreviewable PR, little type value.
3. Gradual: keep mixed JS/TS and convert on touch. Rejected: never finishes,
   does not meet the request.

### Toolchain

- `tsconfig.json`: `strict`, `verbatimModuleSyntax` (so TypeScript does not
  drop imports that JavaScript kept, which could change side effects),
  `jsx: react-jsx`, `moduleResolution: bundler`, `resolveJsonModule`,
  `noEmit`, `allowJs` only while migrating. `src/vite-env.d.ts` references
  `vite/client`.
- `pnpm typecheck` = `tsc --noEmit`, added to CI.
- Missing type packages: `@types/react`, `@types/react-dom`,
  `@types/crypto-js`, `@types/md5`, `@types/react-beautiful-dnd`.

### Types

- Shared contracts in `src/types/`: the module shape each service kind must
  export (translate, recognize, tts, collection), and shared config/service
  helpers. `useConfig` becomes generic on its default value.
- Types only: no new default values, guards, or enums; no reformatting.
- `any` only for untyped external data (HTTP JSON, `eval`-loaded plugins) and
  third-party gaps; `@ts-expect-error` needs a reason comment.
- Bugs that TypeScript exposes go into `docs/agents/known-issues.md`, not into
  a fix.

### Proof of no behaviour change, per PR

1. Transpile equivalence: a script transpiles each migrated file at the base
   revision and at the branch head with esbuild and diffs the output. A
   types-only change produces identical JavaScript; any difference must be
   explained in the PR description.
2. The characterization tests pass. Migration PRs may only make type-level
   edits to test files (checked by the same equivalence script); snapshot
   files stay byte-identical.
3. The smoke run matches the JavaScript baseline.

### Layers (one PR each)

| PR | Scope |
| --- | --- |
| L0 | Toolchain: tsconfig, type packages, `pnpm typecheck`, equivalence script |
| L1 | `src/utils`, `src/hooks`, `src/i18n`, `src/types` |
| L2a | `src/services/translate` |
| L2b | `src/services/recognize` |
| L2c | `src/services/tts`, `src/services/collection` |
| L3a | `src/components`, `src/window/Translate` |
| L3b | `src/window/Recognize`, `src/window/Screenshot`, `src/window/Updater` |
| L3c | `src/window/Config` |
| L4 | `src/main`, `src/App`, `index.html`, `vite.config.ts`, `tailwind.config.ts`; drop `allowJs`; CI fails if any `.js`/`.jsx` remains under `src/` |

Commits within a layer: first a pure rename commit (`git mv`, builds and tests
pass, `tsc` may not yet), then typing commits per module. Typecheck is green at
the end of every PR.

### Out of scope (stays JavaScript)

- `postcss.config.js`: five lines; its loader's TypeScript support is not
  reliable.
- `updater/*.mjs`: upstream's release tooling, used only by the dormant
  release workflow.
- `public/*.js`: vendored Tesseract bundles.
- External `.potext` plugins: loaded at runtime with `eval`, JavaScript by
  design.

## 4. Agent wiki and README

### `AGENTS.md` (root, about 80 lines)

What the repo is, the workflow rules, the command cheat sheet, and an index of
wiki pages in the form "read X when doing Y".

### `docs/agents/` pages (one topic each)

| Page | Covers |
| --- | --- |
| `git-workflow.md` | Branches, commits, PR open/merge, review exception, README/wiki duty |
| `setup-and-run.md` | Toolchain, install, dev run, build, IDE run configurations |
| `architecture.md` | Big picture: Rust core, multi-window frontend, IPC, events, HTTP API, config store |
| `frontend.md` | `src/` layout, windows, state, `useConfig`, i18n, styling |
| `backend.md` | `src-tauri/` modules, commands, tray, hotkeys, server, OCR, backup |
| `services.md` | Service kinds, module contract, instance keys, adding a service, external plugins |
| `testing.md` | Test layers, commands, mocking patterns, smoke test |
| `typescript.md` | tsconfig, type policy, where types live, migration notes |
| `ci.md` | CI checks, dormant release workflow |
| `known-issues.md` | Latent bugs found during the migration |

The architecture, frontend, backend, services, and setup pages are written in
the first docs PR (describing the JavaScript code) so migration agents can use
them; later PRs update the pages they affect; the final docs PR is a
consistency pass against the TypeScript code.

### README (three languages)

- An "About this fork" section at the top of each.
- TypeScript badge replaces the JavaScript badge.
- Build-from-source steps use the fork URL and list the new commands
  (`pnpm test`, `pnpm typecheck`, `pnpm smoke`).
- Upstream install instructions stay, labelled as installing upstream Pot
  (this fork publishes no releases).

## 5. Order of work

1. This spec and the implementation plan (branch `docs/fork-foundation-spec`).
2. Rename `master` to `main`; merge the spec/plan PR.
3. PR: `AGENTS.md`, `CLAUDE.md`, wiki pages, README fork section (×3).
4. PR: CI workflow; release workflow manual-only; `packageManager` field.
5. PRs: test setup with utility tests; translate service tests; recognize
   service tests; TTS/collection tests; hook and render tests; smoke test and
   run configurations (captures the JavaScript baseline).
6. PRs: TypeScript layers L0 → L4.
7. PR: wiki consistency pass and final README.

## Success criteria

- `main` is the default branch and `master` no longer exists on the fork.
- `AGENTS.md` stays short and indexes single-topic wiki pages.
- No `.js`/`.jsx` files remain under `src/`; `pnpm typecheck` passes with
  `strict: true` and without `allowJs`.
- `pnpm test` passes; the characterization tests were merged before the
  migration, and migration PRs changed them only at type level.
- Every migrated file is transpile-equivalent to its JavaScript original, or
  the difference is explained in its PR.
- The smoke test passes on the JavaScript baseline and on the final
  TypeScript code, and the screenshots match.
- All three READMEs describe the fork.
- All work landed through PRs merged with merge commits.

## Risks

- Tauri 1 dependencies versus a current Rust compiler: resolved. The
  unmodified app builds with rustc 1.98.1 (two unused-import warnings in
  `window.rs`, no errors).
- jsdom limits for NextUI or framer-motion in render tests: narrow the render
  scope where needed.
- Window detection and screenshots of WebView2 windows from a script may need
  a fallback (for example, full-screen capture).
- The test and migration volume is large: work is parallelized across agents
  per layer.
