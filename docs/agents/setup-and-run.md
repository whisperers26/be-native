# Setup and run

## Tools

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | `.node-version` (21); Node 22 also works | |
| pnpm | 9 or newer | The lockfile is format 9.0 |
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
- Only one instance runs at a time. The app identifier, `com.pot-app.desktop`, is the same as upstream Pot's, so an installed Pot and the dev build share settings, and whichever starts second exits with an "already running" notification. Quit the other one first.
- Global shortcuts are empty until set in Config → Hotkey. Without them, trigger windows through the local HTTP API (port setting `server_port`, default 60828):

  ```bash
  curl 127.0.0.1:60828/config
  curl -X POST 127.0.0.1:60828/translate -d "hello world"
  curl 127.0.0.1:60828/input_translate
  ```

- With `dev_mode` on (Config → General), F12 opens the devtools of the focused window.
- The updater still checks upstream's release feed; upstream's latest release is 3.0.7, the version in this repository, so it finds nothing.

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
| `pnpm tauri build` | A release binary plus MSI and NSIS installers in `src-tauri/target/release/bundle/`, in about 2.5 minutes. It then exits with "A public key has been found, but no private key. Make sure to set `TAURI_PRIVATE_KEY` environment variable.": the updater is active with upstream's public key, and only the signing of the updater bundles needs the private key. The installers are already written by then. |

## In RustRover

Open the repository root. RustRover finds the Cargo project at `src-tauri/Cargo.toml` and the Node project at the root, with pnpm as its package manager. Run `pnpm tauri dev` in the IDE terminal, or create an npm run configuration for the `tauri` script with the argument `dev`. There are no shared run configurations yet.
