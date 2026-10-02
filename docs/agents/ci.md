# CI

## Workflows

| File | Runs on | What it does |
| --- | --- | --- |
| `.github/workflows/ci.yml` | Every PR to `main`, every push to `main` | Installs from the lockfile, fails if `src/` holds a `.js` or `.jsx` file, runs `pnpm check:docs`, `pnpm typecheck`, `pnpm test`, builds the frontend with `pnpm build` |
| `.github/workflows/release.yml` | Every `v*` tag, or manually | Builds the installers for Windows x64, macOS (Apple silicon and Intel) and Linux x64 with `tauri-action`, signs the update bundles and publishes a GitHub release with `latest.json`, the file the in-app updater reads. Needs the repository secrets `TAURI_PRIVATE_KEY` and `TAURI_KEY_PASSWORD`; see [setup-and-run.md](setup-and-run.md#releasing). The Linux job builds with Rust 1.90, not stable: wry 0.24 (Tauri 1) fails to compile on Linux with Rust 1.95 or newer, and the other platforms are unaffected. |

CI covers the frontend only. Nothing builds or checks the Rust code in CI:
build it locally with `pnpm tauri dev` when you change `src-tauri/`.

## Waiting for CI

```bash
gh pr checks <branch> --repo whisperers26/be-native --watch
```

A failing check blocks the merge. Read the failing step's log with
`gh run view <run-id> --repo whisperers26/be-native --log-failed`, fix the
cause on the branch, and push again.

## Toolchain pins

- Node: `.node-version`, read by `actions/setup-node`.
- pnpm: `packageManager` in `package.json`, read by `pnpm/action-setup`.

Change a version by editing that file; local runs and CI then agree.

## Adding a check

Add a step to the `frontend` job in `ci.yml`, a row to the Commands table in
`AGENTS.md`, and a row to the Workflows table above.
