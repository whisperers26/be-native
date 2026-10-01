# AGENTS.md

Entry point for AI agents working in this repository. It stays short on
purpose: the detail lives in one-topic wiki pages under `docs/agents/`, so
read only the pages your task needs.

## What this is

Be Native, the owner's fork of [Pot](https://github.com/pot-app/pot-desktop),
a cross-platform translation and OCR desktop app, continued after upstream was
archived. Writing improvement is planned next to translation. It is a Tauri 1 app: a Rust backend in `src-tauri/` and a React 18
frontend in strict TypeScript in `src/`.

## Rules

1. Never commit to `main`. Work on one branch per feature or fix, open a PR to
   the fork, and merge it yourself with a merge commit once the checks pass.
   Procedure: [git-workflow.md](docs/agents/git-workflow.md).
2. If the owner explicitly asks to review a PR, open it and stop. Do not merge.
3. Never push to, open PRs against, or add a remote for upstream
   `pot-app/pot-desktop`. Every `gh pr` command takes
   `--repo whisperers26/be-native`.
4. Small commits, one topic each. Renames and moves get their own commits.
   Stage only the files the commit is about.
5. Keep the docs true in the same PR: all three READMEs (`README.md`,
   `README_EN.md`, `README_KR.md`) when something a reader sees changes, and
   the wiki pages your change makes wrong.
6. A refactor does not change runtime behaviour. If you find a bug on the way,
   add it to [known-issues.md](docs/agents/known-issues.md) and fix it on its
   own branch.
7. When you run the app to test, keep its windows on the secondary monitor,
   never the primary one. How: [testing.md](docs/agents/testing.md).

## Commands

| Command | What it does |
| --- | --- |
| `pnpm install` | Install frontend dependencies |
| `pnpm tauri dev` | Run the app: Vite on port 1420 plus a Rust debug build |
| `pnpm build` | Build the frontend into `dist/` |
| `pnpm test` | Run the unit and component tests (Vitest) |
| `pnpm typecheck` | Type-check the app, tests and scripts (TypeScript, strict) |
| `pnpm check:transpile` | Prove a change touched types only ([typescript.md](docs/agents/typescript.md)) |
| `pnpm smoke` | Check the running app's windows (Windows; start the app first) |
| `pnpm check:docs` | Check doc links, README fork sections, and this index |

Before opening a PR, run `pnpm check:docs`, `pnpm typecheck`, `pnpm test` and
`pnpm build`; CI runs the same checks on every PR.

## Wiki

| Read | When you are |
| --- | --- |
| [git-workflow.md](docs/agents/git-workflow.md) | Branching, committing, opening or merging a PR |
| [setup-and-run.md](docs/agents/setup-and-run.md) | Installing tools, running or building the app, finding its files |
| [architecture.md](docs/agents/architecture.md) | New here, or unsure whether Rust or React owns something |
| [frontend.md](docs/agents/frontend.md) | Changing windows, pages, hooks, state, i18n or styling |
| [backend.md](docs/agents/backend.md) | Changing Rust: commands, windows, tray, hotkeys, HTTP API, OCR |
| [services.md](docs/agents/services.md) | Adding or changing a translate, OCR, TTS or collection service, or plugins |
| [testing.md](docs/agents/testing.md) | Writing or running tests, or a test failed |
| [typescript.md](docs/agents/typescript.md) | Writing or typing code in `src/`, or a type error blocks you |
| [config-keys.md](docs/agents/config-keys.md) | Reading, adding or changing a setting |
| [known-issues.md](docs/agents/known-issues.md) | Seeing odd behaviour, or about to fix a bug |
| [ci.md](docs/agents/ci.md) | Changing CI, or a check failed on your PR |
