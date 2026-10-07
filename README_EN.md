<div align="center">

<h3><a href='./README.md'>中文</a> | English | <a href='./README_KR.md'> 한글 </a></h3>

<img width="160" src="public/icon.svg" alt="Be Native"/>

# Be Native

🌈 Read and write like a native speaker: a cross-platform app for translation, OCR and writing improvement

![License](https://img.shields.io/github/license/whisperers26/be-native.svg)
![Tauri](https://img.shields.io/badge/Tauri-1.6.8-blue?logo=tauri)
![TypeScript](https://img.shields.io/badge/-TypeScript-blue?logo=typescript&logoColor=white)
![Rust](https://img.shields.io/badge/-Rust-orange?logo=rust&logoColor=white)
![Windows](https://img.shields.io/badge/-Windows-blue?logo=windows&logoColor=white)
![MacOS](https://img.shields.io/badge/-macOS-black?&logo=apple&logoColor=white)
![Linux](https://img.shields.io/badge/-Linux-yellow?logo=linux&logoColor=white)

</div>

**Be Native** helps you read and write in a language that is not your own. It does selection translation, input translation, screenshot OCR, screenshot translation and writing improvement, which rewrites what you wrote so it reads naturally, with many translation, writing, OCR, text-to-speech and vocabulary services plus plugins. It runs on Windows, macOS and Linux.

Be Native is built on [Pot](https://github.com/pot-app/pot-desktop) and is a personal fork of it. Upstream [pot-app/pot-desktop](https://github.com/pot-app/pot-desktop) has been archived; development continues in [whisperers26/be-native](https://github.com/whisperers26/be-native). Installers are published on this fork's [Releases](https://github.com/whisperers26/be-native/releases) page and the in-app updater reads them; the install instructions below are for upstream Pot.

<div align="center">

<table>
<tr>
    <td> <img src="asset/1.png">
    <td> <img src="asset/2.png">
    <td> <img src="asset/3.png">
</table>

# Table of Contents

</div>

-   [Usage](#usage)
-   [Features](#features)
-   [Changes in This Fork](#changes-in-this-fork)
-   [Supported Services](#supported-services)
-   [Plugin System](#plugin-system)
-   [Installation](#installation)
-   [External Calls](#external-calls)
-   [Wayland Support](#wayland-support)
-   [Internationalization](#internationalizationweblate)
-   [Contributors](#contributors)
-   [Thanks](#thanks)

<div align="center">

# Usage

</div>

Every action below has its own shortcut. Set them in Settings → Hotkey; an action with no shortcut is not triggered.

-   **Selection translation**: select text in any app, then press the selection translation shortcut. The translation window opens next to the pointer with the text translated by every service you turned on.
-   **Input translation**: press the input translation shortcut, type or paste the text in the window that opens, and press Enter.
-   **Clipboard listening**: click the top left icon of a translation window; from then on every text you copy is translated automatically.
-   **Screenshot OCR**: press the shortcut, then drag over the part of the screen to read. The recognized text appears in a window, where you can copy or translate it.
-   **Screenshot translation**: press the shortcut, then drag over the part of the screen to translate. The text in it is recognized and translated.
-   **Silent OCR copy**: press its shortcut (also in the tray menu), then drag over the screen. No window opens: the recognized text goes straight to the clipboard, and a notification tells you if nothing could be read.
-   **Writing improvement**: select text you wrote and press the writing shortcut. A window shows it rewritten to read naturally, one box per service.
    -   Click a result to replace the selected text with it.
    -   **Tones** adds one version for each tone (professional, casual, friendly, confident, concise); edit the tones in Settings → Writing.
    -   **Custom Prompt** takes a request of your own, such as "make it shorter".
-   **Progress indicator**: while text is being recognized and translated, a small round indicator with the icon of the service at work is shown instead of an empty window. Click it to open the window at once; otherwise the window opens out of it when the translations are ready.
-   **Window animations**: the window transitions (the circle turning into the window, the window growing with its content) can be switched off with "Window Animations" in Settings → General. It covers the translation and the writing windows; the turning ring of the progress indicator is not affected.
-   **External calls**: other apps can trigger every action above through the local HTTP API, see [External Calls](#external-calls).

<div align="center">

# Features

</div>

-   [x] Writing improvement: rewrites what you wrote so it reads naturally, in several tones, with a free default service (LLM7)
-   [x] Silent OCR copy: recognized text goes to the clipboard without opening a window
-   [x] Use your Claude Code or Codex subscription for translation and writing, no API key needed
-   [x] Offline OCR with RapidOCR, which reads small text that the system OCR misses
-   [x] A translation window that sizes itself to its text, with optional window animations
-   [x] Parallel translations with multiple services ([Supported Services](#supported-services))
-   [x] OCR with multiple services ([Supported Services](#supported-services))
-   [x] Text-to-Speech with multiple services ([Supported Services](#supported-services))
-   [x] Export to vocabulary apps ([Supported Services](#supported-services))
-   [x] External calls ([External Calls](#external-calls))
-   [x] Plugin system ([Plugin System](#plugin-system))
-   [x] Support Windows, macOS and Linux
-   [x] Support Wayland (Tested on KDE, Gnome and Hyprland)
-   [x] Multi-language support

<div align="center">

# Changes in This Fork

</div>

<!-- fork:start -->

- The main branch is `main`; every change lands through a pull request.
- AI agents work from [AGENTS.md](./AGENTS.md) and the wiki in [docs/agents](./docs/agents/).
- CI checks every pull request (docs, types, tests and the frontend build).
- Automated tests (Vitest) pin the frontend's behaviour: `pnpm test`.
- A real-app smoke test (`pnpm smoke`, Windows) checks the app's windows through its local HTTP API.
- The frontend is strict TypeScript; CI rejects JavaScript files under `src/`.
- Pushing a `v*` tag builds and publishes signed installers as a GitHub release; the in-app updater reads the latest release instead of upstream's feed.
- The app is named Be Native and has its own icon; a debug build (`pnpm tauri dev`) calls itself "Be Native (Debug)" and does not check for updates at launch.
- Selecting a screen region shows a horizontal and a vertical line through the pointer instead of a small crosshair; the lines stay on one monitor and follow the pointer to another.
- Silent text recognition: its own hotkey (also in the tray menu and the HTTP API as `/ocr_copy`) selects a screen region and copies the recognized text to the clipboard without opening a window.
- Claude Code and Codex are translation services: they use the `claude` or `codex` command-line tool already installed and signed in on your computer, so translations run on your subscription with no API key. Each translation gets a fresh session, and one is kept ready in the background so answers come about as fast as from an API; model and reasoning level are set in the service settings, where a button asks the tool which models it offers and lists them.
- RapidOCR is a built-in OCR service: the PP-OCRv5 models run on your computer, fully offline, and read small text and tight selections that the system OCR misses (Simplified and Traditional Chinese, English and Japanese). It is the default OCR service on a fresh install; an existing OCR service list is left as it is.
- The translation window sizes itself to its text: it shows everything without scrolling where it can, gets wider rather than tall and narrow for longer text, and never fills the screen. Turn on "Remember Window Size" to keep the size you give it instead, which it now reopens with exactly.
- While a text is being recognized and translated, a small round progress indicator with the icon of the service at work is shown instead of an empty window; the window pours out of it, like liquid, once the translations are there. Click the indicator to open the window right away. "Window Animations" in the General settings turns the animations off, for the writing window too.
- Text that mixes languages is detected by its larger part, so mostly English text with some Chinese in it is translated instead of being taken for Chinese.
- The language of a text is detected on your computer by default, without sending it to a web service; the other engines can still be chosen in the Translate settings.
- When a web detection engine fails, the language label says "Detection failed (English)", so you know English is only the fallback.
- Recognized and selected text has its wrapped lines merged by default: lines that were broken only because the text wrapped are joined, while paragraphs, headings and list items (bulleted, numbered or unmarked) keep their own lines. Words broken by a hyphen are put back together, and Chinese and Japanese are joined without spaces. It replaces Pot's "Delete Newline", which made everything one line and was off by default.
- The About page links to this fork: GitHub opens this repository and Feedback opens its issues. Upstream's website, e-mail and community links are gone.
- Backup (WebDAV, Aliyun Drive, local file) is removed: the settings no longer have a Backup page.
- Writing improvement: select text you wrote and press its hotkey, and a window shows it rewritten to read naturally. The default service is LLM7, which is free and online and needs no account or key (without a token it answers only a few requests before it makes you wait; a free token from llm7.io lifts that to 60 a minute); any OpenAI-compatible API, or your subscription through Claude Code or Codex, works too, and each service's prompt can be changed. The Tones button adds versions in five tones (professional, casual, friendly, confident, concise; editable in the settings), and Custom Prompt takes a request of your own. Each result is a box of its own, and the window grows smoothly downwards, moving up only when there is no room below. Click any result to put it in place of the text you selected.
- The "Transparent Effect" setting is gone: the settings and updater windows are always opaque. "Remember Window Size" is off by default.
- The Recognize window closes when it loses focus by default, like the Translate window.
- Menus in the Config window open without the scale-and-fade animation: the page behind a menu no longer flickers in front of it.
- With screens stacked one above the other, windows now open on the screen you are working on instead of the one below it.
- On a screen whose scaling differs from the main screen's, selecting a screen region covers the whole screen again instead of showing a small copy of it in the top-left corner.
- Versions 1.1.5 and older cannot update themselves: the updater window tells them to download the latest release from GitHub and, during installation, to uninstall the old version and clean the app data, with a link to this repository.

<!-- fork:end -->

<div align="center">

# Supported Services

</div>

## Translation

-   [x] [OpenAI](https://platform.openai.com/)
-   [x] [ChatGLM](https://www.zhipuai.cn/)
-   [x] [Gemini Pro](https://gemini.google.com/)
-   [x] [Ollama](https://www.ollama.com/) (Offline)
-   [x] [Ali Translate](https://www.aliyun.com/product/ai/alimt)
-   [x] [Baidu Translate](https://fanyi.baidu.com/)
-   [x] [Caiyun](https://fanyi.caiyunapp.com/)
-   [x] [Tencent Transmart](https://fanyi.qq.com/)
-   [x] [Tencent Interactive Translate](https://transmart.qq.com/)
-   [x] [Volcengine Translate](https://translate.volcengine.com/)
-   [x] [NiuTrans](https://niutrans.com/)
-   [x] [Google Translate](https://translate.google.com)
-   [x] [Bing Translate](https://learn.microsoft.com/zh-cn/azure/cognitive-services/translator/)
-   [x] [Bing Dictionary](https://www.bing.com/dict)
-   [x] [DeepL](https://www.deepl.com/)
-   [x] [Youdao](https://ai.youdao.com/)
-   [x] [Cambridge Dictionary](https://dictionary.cambridge.org/)
-   [x] [Yandex](https://translate.yandex.com/)
-   [x] [Lingva](https://github.com/TheDavidDelta/lingva-translate) ([Plugin](https://github.com/pot-app/pot-app-translate-plugin-template))
-   [x] [Tatoeba](https://tatoeba.org/) ([Plugin](https://github.com/pot-app/pot-app-translate-plugin-tatoeba))
-   [x] [ECDICT](https://github.com/skywind3000/ECDICT) ([Plugin](https://github.com/pot-app/pot-app-translate-plugin-ecdict))

More Services see [Plugin System](#plugin-system)

## Text Recognize

-   [x] System OCR (Offline)
    -   [x] [Windows.Media.OCR](https://learn.microsoft.com/en-us/uwp/api/windows.media.ocr.ocrengine?view=winrt-22621) on Windows
    -   [x] [Apple Vision Framework](https://developer.apple.com/documentation/vision/recognizing_text_in_images) on MacOS
    -   [x] [Tesseract OCR](https://github.com/tesseract-ocr) on Linux
-   [x] [Tesseract.js](https://tesseract.projectnaptha.com/) (Offline)
-   [x] [Baidu](https://ai.baidu.com/tech/ocr/general)
-   [x] [Tencent](https://cloud.tencent.com/product/ocr-catalog)
-   [x] [Volcengine](https://www.volcengine.com/product/OCR)
-   [x] [iflytek](https://www.xfyun.cn/services/common-ocr)
-   [x] [Tencent Image Translate](https://cloud.tencent.com/document/product/551/17232)
-   [x] [Baidu Image Translate](https://fanyi-api.baidu.com/product/22)
-   [x] [Simple LaTeX](https://simpletex.cn/)
-   [x] [OCRSpace](https://ocr.space/) ([Plugin](https://github.com/pot-app/pot-app-recognize-plugin-template))
-   [x] [Rapid](https://github.com/RapidAI/RapidOcrOnnx) (Offline [Plugin](https://github.com/pot-app/pot-app-recognize-plugin-rapid))
-   [x] [Paddle](https://github.com/hiroi-sora/PaddleOCR-json) (Offline [Plugin](https://github.com/pot-app/pot-app-recognize-plugin-paddle))

More Services see [Plugin System](#plugin-system)

## Text-to-Speech

-   [x] [Lingva](https://github.com/thedaviddelta/lingva-translate)

More Services see [Plugin System](#plugin-system)

## Collection

-   [x] [Anki](https://apps.ankiweb.net/)
-   [x] [Eudic](https://dict.eudic.net/)
-   [x] [Youdao](https://www.youdao.com/) ([Plugin](https://github.com/pot-app/pot-app-collection-plugin-youdao))
-   [x] [ShanBay](https://web.shanbay.com/web/main) ([Plugin](https://github.com/pot-app/pot-app-collection-plugin-shanbay))

More Services see [Plugin System](#plugin-system)

<div align="center">

# Plugin System

</div>

The built-in services are limited. But you can expand the app's functionality through the plugin system.

## Install Plugin

You can find plugins you need in the [Plugin List](https://pot-app.com/plugin.html), and then go to the plugin repo to download it.

The file extension of pot plugin is `.potext`. After downloading the `.potext` file, go to Preferences - Service Settings - Add External Plugin - Install External Plugin to select the corresponding `.potext` to install it. It will then be added to the service list and can be used like a built-in service.

### Troubleshooting

-   The specified module could not be found (Windows)

    Errors like this occur because the system lacks C++ libraries，Go to [here](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170#visual-studio-2015-2017-2019-and-2022) download and install it.

-   Not a valid Win32 application (Windows)

    An error like this indicates that you did not download the plugin for the corresponding system or architecture. Go to the plugin repository and download the correct plugin to solve the problem.

## Develop Plugin

The [Template](https://pot-app.com/en/plugin.html#template) section in the [Plugin List](https://pot-app.com/en/plugin.html) provides plugin development templates for various plugins. Please check the corresponding template repo for specific documentation.

<div align="center">

# Installation

</div>

## Windows

### Install via Winget

```powershell
winget install Pylogmon.pot
```

### Install Manually

1. Download the installation package ending in `.exe` from the Latest [Release](https://github.com/pot-app/pot-desktop/releases/latest) page.

    - 64-bit machine download `pot_{version}_x64-setup.exe`
    - 32-bit machine download `pot_{version}_x86-setup.exe`
    - arm64 machine download `pot_{version}_arm64-setup.exe`

2. Double click the downloaded file to install it.

### 故障排除

-   There is no interface after startup, and there is no response when clicking the tray icon.

    Check if WebView2 is uninstalled/disabled, if so, install WebView2 manually or restore it.

    If the enterprise edition system is inconvenient to install or cannot install WebView2, please try to download the fix WebView2 version `pot_{version} at [Release](https://github.com/pot-app/pot-desktop/releases/latest) _{arch}_fix_webview2_runtime-setup.exe`

    If the issue persists, please try starting in Windows 7 compatibility mode.

## MacOS

### Install via Brew

1. Add our tap:

```bash
brew tap pot-app/homebrew-tap
```

2. Install pot:

```bash
brew install --cask pot
```

3. Upgrade pot

```bash
brew upgrade --cask pot
```

### Install Manually

1. Download the installation package ending in `.dmg` from the Latest [Release](https://github.com/pot-app/pot-desktop/releases/latest) page. (If you are using M1, please download the installation package named `pot_{version}_aarch64.dmg`, otherwise download the installation package named `pot_{version}_x64.dmg`)
2. Double click the downloaded file to install it.

### Troubleshooting

-   "pot" can’t be opened because the developer cannot be verified.

    Click the Cancel button, then go to the Settings -> Privacy and Security page, click the Still Open button, and then click the Open button in the pop-up window. After that, there will be no more pop-up warnings when opening pot.

    If you cannot find the above options in Privacy & Security, or get error prompts such as broken files with Apple Silicon machines. Open Terminal.app and enter the following command (you may need to enter a password halfway through), then restart pot:

    ```bash
    sudo xattr -d com.apple.quarantine /Applications/pot.app
    ```

-   If you encounter a permission prompt every time you open it, or if you cannot perform a shortcut translation, please go to Settings -> Privacy & Security -> Supporting Features to remove pot, and then re-add pot.

## Linux

### Debian/Ubuntu

We provide `deb` packages for Linux.

Please note that: There are two deb package, `universal` is based on `glibc2.28` and `openssl-1.1`, If the regular deb package can't run on your machine due to dependency problems, please download the `universal` package, Due to its low version dependency, it can run on most systems.

### Arch/Manjaro

> [!WARNING]  
> In newer version of [Webkit2Gtk](https://archlinux.org/packages/extra/x86_64/webkit2gtk) (2.42.0), Because Nvidia Proprietary drives are not fully implemented DMABUF, it will cause failure to start and crash.<br>
> Please downgrade or add the `WEBKIT_DISABLE_DMABUF_RENDERER=1` environment variable to `/etc/environment` (or other places where environment variables are set) to turn off the use of DMABUF.

1. View on [AUR](https://aur.archlinux.org/packages?O=0&K=pot-translation)

Use aur helper：

```bash
yay -S pot-translation # or pot-translation-bin or pot-translation-git
# or
paru -S pot-translation # or pot-translation-bin or pot-translation-git
```

2. If you are using `archlinuxcn`, you can install directly using pacman:

```bash
sudo pacman -S pot-translation
```

### Flatpak

> [!WARNING]
> The tray icon is missing in Flatpak version.

<a href='https://flathub.org/apps/com.pot_app.pot'>
    <img width='240' alt='Download on Flathub' src='https://flathub.org/api/badge?locale=en'/>
</a>

<div align="center">

# External Calls

</div>

Pot provides a complete HTTP interface for integration with other software. You can call pot by sending HTTP requests to `127.0.0.1:port`, where `port` is the listening port of pot, default to `60828`, and can be changed in the app settings.

## API Docs:

```bash
POST "/" => Translate given text (body is text to translate)
GET "/config" => Open settings
POST "/translate" => Translate given text (same as "/")
GET "/selection_translate" => Translate selected text
GET "/input_translate" => Open input translation
GET "/ocr_recognize" => Perform OCR on screenshot
GET "/ocr_translate" => Perform translation on screenshot
GET "/ocr_recognize?screenshot=false" => OCR without taking screenshot
GET "/ocr_translate?screenshot=false" => Translate screenshot without taking screenshot
GET "/ocr_recognize?screenshot=true" => OCR with screenshot
GET "/ocr_translate?screenshot=true" => Translate screenshot
GET "/ocr_copy" => Recognize a screenshot region and copy the text, without a window
GET "/ocr_copy?screenshot=false" => Copy the text of an existing screenshot, without a window
```

## Example:

-   Call translation by selection:

    To call pot's translation by selection, simply send a request to `127.0.0.1:port`:

    E.g. using curl:

    ```bash
    curl "127.0.0.1:60828/selection_translate"
    ```

## OCR without internal screenshot

This allows you to perform OCR/translation without using pot's internal screenshot, so you can use your own screenshot tools. It also solves the problem where pot's internal screenshot doesn't work on some platforms.

### Workflow:

1. Take screenshot using other tool
2. Save screenshot to `$CACHE/com.pot-app.desktop/pot_screenshot_cut.png`
3. Send request to `127.0.0.1:port/ocr_recognize?screenshot=false` to call

> `$CACHE` is the system cache dir, e.g. `C:\Users\{username}\AppData\Local\com.pot-app.desktop\pot_screenshot_cut.png` on Windows.

### Example

OCR using Flameshot on Linux:

```bash
rm ~/.cache/com.pot-app.desktop/pot_screenshot_cut.png && flameshot gui -s -p ~/.cache/com.pot-app.desktop/pot_screenshot_cut.png && curl "127.0.0.1:60828/ocr_recognize?screenshot=false"
```

## Existing Usages (Quick selection translation)

### SnipDo (Windows)

1. Download and install SnipDo in the [Microsoft Store](https://apps.microsoft.com/store/detail/snipdo/9NPZ2TVKJVT7)
2. Download the SnipDo extension of pot from the Latest [Release](https://github.com/pot-app/pot-desktop/releases/latest) (pot.pbar)
3. Double click the downloaded file to install it.
4. Selection some text, you can see the pot icon in the upper right corner of the selection, click the icon to translate.

### PopClip (MacOS)

1. Download and install PopClip in the [App Store](https://apps.apple.com/us/app/popclip/id445189367?mt=12)
2. Download the PopClip extension of pot from the Latest [Release](https://github.com/pot-app/pot-desktop/releases/latest) (pot.popclipextz)
3. Double click the downloaded file to install it.
4. Enable the pot extension in PopClip settings, and then you can translate by selecting text.

### Starry (Linux)

> Starry is still in the development stage, so you can only compile him manually

Github: [ccslykx/Starry](https://github.com/ccslykx/Starry)

<div align="center">

# Wayland Support

</div>

Due to the varying levels of support for Wayland among different distributions, pot itself cannot achieve perfect compatibility. However, here are some solutions to common issues that can be implemented through proper configuration, allowing pot to run flawlessly on Wayland.

## Shortcut key cannot be used

Due to Tauri's lack of support for Wayland, the shortcut key scheme in the pot application cannot be used under Wayland.
You can set the system shortcut and send a request with `curl` to call pot, see [External Calls](#external-calls) for details

## Screenshot doesn't work

In some pure Wayland desktop environments/window managers (such as Hyprland), the built-in screenshot feature of pot cannot be used. In this case, you can use other screenshot tools instead. For more details, please refer to the section [Not Using Built-in Screenshot](#not-using-built-in-screenshot).

Below is a configuration example for Hyprland using `grim` and `slurp` to achieve screenshot functionality:

```conf
bind = ALT, X, exec, grim -g "$(slurp)" ~/.cache/com.pot-app.desktop/pot_screenshot_cut.png && curl "127.0.0.1:60828/ocr_recognize?screenshot=false"
bind = ALT, C, exec, grim -g "$(slurp)" ~/.cache/com.pot-app.desktop/pot_screenshot_cut.png && curl "127.0.0.1:60828/ocr_translate?screenshot=false"
```

Other desktop environments/window managers also have similar operations.

## The translation window follows the mouse position.

Due to the current inability of pot to obtain accurate mouse coordinates under Wayland, its internal implementation cannot function properly.
For certain desktop environments/window managers, it is possible to achieve window following mouse position by setting window rules. Here we take Hyprland as an example:

```conf
windowrulev2 = float, class:(pot), title:(Translator|OCR|PopClip|Screenshot Translate) # Translation window floating
windowrulev2 = move cursor 0 0, class:(pot), title:(Translator|PopClip|Screenshot Translate) # Translation window follows the mouse position.
```

<div align="center">

# Internationalization([Weblate](https://hosted.weblate.org/engage/pot-app/))

[![](https://hosted.weblate.org/widget/pot-app/pot-desktop/svg-badge.svg)](https://hosted.weblate.org/engage/pot-app/)

[![](https://hosted.weblate.org/widget/pot-app/pot-desktop/multi-auto.svg)](https://hosted.weblate.org/engage/pot-app/)

</div>

<div align="center">

# Contributors

</div>

<img src="https://github.com/pot-app/.github/blob/master/pot-desktop-contributions.svg?raw=true" width="100%"/>

## Manual compilation

### Requirements

Node.js 22

pnpm 10.14.0 (pinned by packageManager in package.json)

Rust >= 1.80.0

### Start compilation

1. Clone the repository

    ```bash
    git clone https://github.com/whisperers26/be-native.git
    ```

2. Install dependencies

    ```bash
    cd be-native
    pnpm install
    ```

3. Install dependencies(Only Linux)

    ```bash
    sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.0-dev libayatana-appindicator3-dev librsvg2-dev patchelf libxdo-dev libxcb1 libxrandr2 libdbus-1-3
    ```

4. Development (Optional)

    ```bash
    pnpm tauri dev # Run the app in development mode
    ```

5. Build
    ```bash
    pnpm tauri build # Build into installation package
    ```

6. Test

    ```bash
    pnpm test # Unit and component tests
    pnpm typecheck # TypeScript type check
    pnpm smoke # Real-app smoke test (Windows; start the app with pnpm tauri dev first)
    ```

<div align="center">

# Acknowledgement

</div>

-   [Bob](https://github.com/ripperhe/Bob) Inspiration
-   [bob-plugin-openai-translator](https://github.com/yetone/bob-plugin-openai-translator) OpenAI API Reference
-   [@uiYzzi](https://github.com/uiYzzi) Implementation ideas
-   [@Lichenkass](https://github.com/Lichenkass) Maintaining the Deepin App Store.
-   [Tauri](https://github.com/tauri-apps/tauri) A user-friendly GUI framework.
