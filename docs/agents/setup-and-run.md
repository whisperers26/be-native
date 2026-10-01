# Setup and run

## Tools

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | `.node-version` (22) | |
| pnpm | 10.14.0 | Pinned by `packageManager` in `package.json` |
| Rust | stable (1.98.1 known to work) | Windows: the MSVC toolchain |
| Windows extras | Visual Studio 2022 or newer with "Desktop development with C++"; WebView2 runtime | WebView2 ships with Windows 10 and 11 |
| Linux extras | `sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.0-dev libayatana-appindicator3-dev librsvg2-dev patchelf libxdo-dev libxcb1 libxrandr2 libdbus-1-3` | |
| macOS extras | Xcode command line tools | |

Install Rust on Windows with `winget install --id Rustlang.Rustup -e`, then open a new terminal so `%USERPROFILE%\.cargo\bin` is on `PATH`.

## Install

```bash
pnpm install
```

pnpm 10 skips the install scripts of esbuild and tesseract.js and prints a warning. The build does not need them.

## Run

```bash
pnpm tauri dev
```

This starts Vite on http://localhost:1420 (`pnpm dev`; the port is fixed and must be free), then builds and starts the Rust app in debug mode. The first Rust build takes one or two minutes; later builds are incremental. Frontend edits hot-reload; Rust edits rebuild and restart the app.

What to expect:

- On first run (no settings file yet) the Config window opens. Otherwise the app starts with only a tray icon.
- Closing a window does not quit. Quit or restart from the tray menu.
- Restart `pnpm tauri dev` after switching branches. Vite keeps serving the modules it transformed before the switch, and those can still import files the new branch renamed or deleted (such as a `.jsx` that became `.tsx`). New windows then fail to load and stay hidden.
- Only one instance runs at a time. The app identifier, `com.pot-app.desktop`, is the same as upstream Pot's, so an installed Pot and the dev build share settings, and whichever starts second exits with an "already running" notification. Quit the other one first.
- Global shortcuts are empty until set in Config → Hotkey. Without them, trigger windows through the local HTTP API (port setting `server_port`, default 60828):

  ```bash
  curl 127.0.0.1:60828/config
  curl -X POST 127.0.0.1:60828/translate -d "hello world"
  curl 127.0.0.1:60828/input_translate
  ```

- With `dev_mode` on (Config → General), F12 opens the devtools of the focused window.
- The updater reads `latest.json` from this fork's latest GitHub release. A build older than that release opens the Updater window at launch; a build at the latest version stays quiet. Turn off "check for updates" in Config → General to stop the launch check.

## Data on disk

| What | Windows | Linux | macOS |
| --- | --- | --- | --- |
| Settings `config.json`, history `history.db`, plugins `plugins/` | `%APPDATA%\com.pot-app.desktop\` | `~/.config/com.pot-app.desktop/` | `~/Library/Application Support/com.pot-app.desktop/` |
| Log `pot.log` (deleted at launch once over 40 KB) | `%APPDATA%\com.pot-app.desktop\logs\` | `~/.config/com.pot-app.desktop/logs/` | `~/Library/Logs/com.pot-app.desktop/` |
| Screenshots `pot_screenshot.png`, `pot_screenshot_cut.png` | `%LOCALAPPDATA%\com.pot-app.desktop\` | `~/.cache/com.pot-app.desktop/` | `~/Library/Caches/com.pot-app.desktop/` |

To start as on first run, quit the app and move `config.json` away.

## Build

| Command | Result |
| --- | --- |
| `pnpm build` | The frontend only, into `dist/`, in about 15 seconds. It warns that the main chunk is over 500 kB; that is expected. |
| `pnpm tauri build` | A release binary plus MSI and NSIS installers in `src-tauri/target/release/bundle/`, in about 2.5 minutes. It then exits with "A public key has been found, but no private key. Make sure to set `TAURI_PRIVATE_KEY` environment variable.": only the signing of the updater bundles needs the private key. The installers are already written by then. |

## Releasing

A release is a `v*` tag on `main`; `release.yml` does the rest.

1. Set the same version in `package.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` (the `pot` package) and `src-tauri/tauri.conf.json`, and merge that through a PR.
2. `git switch main && git pull --ff-only && git tag v<version> && git push origin v<version>`.
3. Watch it: `gh run watch --repo whisperers26/be-native`. The release appears at `https://github.com/whisperers26/be-native/releases` with the installers and `latest.json`.

The update bundles are signed with a minisign key. Its public half is `pubkey` in `tauri.conf.json`; the private half lives only in the repository secrets `TAURI_PRIVATE_KEY` and `TAURI_KEY_PASSWORD` and in the owner's backup. Losing it means installed copies can never update again, because they only accept bundles signed by that key.

## In RustRover

Open the repository root. RustRover finds the Cargo project at `src-tauri/Cargo.toml` and the Node project at the root, with pnpm as its package manager.

Shared run configurations live in `.run/` and appear in the run menu:

| Configuration | Runs |
| --- | --- |
| Tauri dev | `pnpm tauri dev`: the app |
| Unit tests | `pnpm test` |
| Typecheck | `pnpm typecheck` |
| Smoke test | `pnpm smoke`, against the running app ([testing.md](testing.md)) |
| Docs check | `pnpm check:docs` |

RustRover passes its own environment to these. If it was already open when you installed Rust, "Tauri dev" fails with "failed to get cargo metadata: program not found"; restart RustRover so it picks up `%USERPROFILE%\.cargo\bin`.
