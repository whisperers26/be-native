# CI

## Workflows

| File | Runs on | What it does |
| --- | --- | --- |
| `.github/workflows/ci.yml` | Every PR to `main`, every push to `main` | Installs from the lockfile, fails if `src/` holds a `.js` or `.jsx` file, runs `pnpm check:docs`, `pnpm typecheck`, `pnpm test`, builds the frontend with `pnpm build` |
| `.github/workflows/package.yml` | Manual only (`workflow_dispatch`) | Upstream's signed multi-platform release. It needs pot-app's signing and Apple secrets, which this fork does not have. Do not run it. |

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
