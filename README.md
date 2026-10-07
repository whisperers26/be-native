<img width="200px" src="public/icon.svg" align="left"/>

# Be Native

> 🌈 像母语者一样阅读和写作：跨平台的划词翻译与文字识别软件

![License](https://img.shields.io/github/license/whisperers26/be-native.svg)
![Tauri](https://img.shields.io/badge/Tauri-1.6.8-blue?logo=tauri)
![TypeScript](https://img.shields.io/badge/-TypeScript-blue?logo=typescript&logoColor=white)
![Rust](https://img.shields.io/badge/-Rust-orange?logo=rust&logoColor=white)
![Windows](https://img.shields.io/badge/-Windows-blue?logo=windows&logoColor=white)
![MacOS](https://img.shields.io/badge/-macOS-black?&logo=apple&logoColor=white)
![Linux](https://img.shields.io/badge/-Linux-yellow?logo=linux&logoColor=white)

<!-- fork:start -->

> **Be Native** 帮助你用非母语阅读和写作。它提供划词翻译、输入翻译、截图 OCR、截图翻译和写作润色（把你写的文字改得更地道），支持多个翻译、润色、文字识别、语音合成和生词本接口以及插件。支持 Windows、macOS 和 Linux。
>
> Be Native 基于 [Pot](https://github.com/pot-app/pot-desktop)，是它的个人分支（fork）。上游仓库 [pot-app/pot-desktop](https://github.com/pot-app/pot-desktop) 已归档，开发在 [whisperers26/be-native](https://github.com/whisperers26/be-native) 继续进行。安装包发布在本分支的 [Releases](https://github.com/whisperers26/be-native/releases) 页面，应用内更新也读取这里；下文的安装说明针对的是上游的 Pot。
>
> 本分支的改动：
>
> - 主分支为 `main`，所有改动都通过 Pull Request 合并。
> - AI 代理按照 [AGENTS.md](./AGENTS.md) 及 [docs/agents](./docs/agents/) 中的 wiki 工作。
> - 每个 Pull Request 都会经过 CI 检查（文档、类型、测试和前端构建）。
> - 前端行为由自动化测试（Vitest）固定，命令为 `pnpm test`。
> - 真实应用冒烟测试（`pnpm smoke`，Windows）通过本地 HTTP 接口检查应用的各个窗口。
> - 前端代码是严格模式（strict）的 TypeScript，CI 会拒绝 `src/` 下的 JavaScript 文件。
> - 推送 `v*` 标签会构建并在 GitHub 发布带签名的安装包，应用内更新读取最新的发布，不再读取上游的更新源。
> - 应用更名为 Be Native 并换了新图标；调试版本（`pnpm tauri dev`）显示为 “Be Native (Debug)”，启动时不检查更新。
> - 框选屏幕区域时，用穿过鼠标位置的一条横线和一条竖线代替小十字光标；线条只画在一块屏幕上，鼠标移到另一块屏幕时跟着过去。
> - 静默文字识别：用单独的快捷键（托盘菜单和 HTTP API 的 `/ocr_copy` 也可触发）框选屏幕区域后，不弹出任何窗口，直接把识别出的文字复制到剪切板。
> - 新增 Claude Code 和 Codex 翻译服务：直接调用本机已安装并登录的 `claude` 或 `codex` 命令行工具，使用你的订阅额度，无需 API Key。每次翻译使用全新的会话，后台始终预先准备好一个会话，因此速度接近 API；模型和推理级别可在服务设置中选择，设置中的按钮可向工具查询当前提供的模型并列出。
> - 内置 RapidOCR 文字识别服务：PP-OCRv5 模型在本机完全离线运行，能识别系统 OCR 识别不了的小字和紧贴文字的小范围框选（支持简体中文、繁体中文、英文和日文）。全新安装时它是默认的文字识别服务；已有的服务列表保持不变。
> - 翻译窗口会根据文本自动调整大小：尽量完整显示内容而无需滚动，文本较长时优先变宽而不是变得又高又窄，并且不会铺满屏幕。开启“记住窗口大小”后则保持你调整的大小，并且每次都以完全相同的大小打开。
> - 文字识别和翻译进行期间，不再显示空窗口，而是显示一个带有当前服务图标的圆形进度指示器；翻译完成后，窗口像液体一样从指示器中流出并展开。点击指示器可立即打开窗口。可在通用设置中通过“窗口动画”关闭动画，写作润色窗口同样适用。
> - 混合语言的文本按占比更大的部分检测语言，因此夹杂少量中文的英文文本会被正常翻译，而不是被当作中文。
> - 默认在本机检测文本的语言，不再把文本发送给在线服务；其他检测引擎仍可在翻译设置中选择。
> - 在线检测引擎检测失败时，语言标签会显示“检测失败（英语）”，让你知道此时是按默认的英语处理的。
> - 识别出的文字和划词得到的文字默认会智能合并换行：只合并因折行而断开的行，段落、标题和列表项（带项目符号、带编号或不带标记）仍各占一行；被连字符拆开的单词会重新拼合，中文和日文合并时不加空格。它取代了 Pot 原来的“删除换行”（把全部内容压成一行，且默认关闭）。
> - “关于”页面的链接都指向本分支：“GitHub”打开本仓库，“问题反馈”打开本仓库的 Issues；上游的官网、邮箱和社区入口已移除。
> - 备份功能（WebDAV、阿里云盘、本地文件）已移除：设置里不再有“备份”页面。
> - 写作润色：选中自己写的文字后按快捷键，窗口会显示改写得更地道的版本。默认使用免费的在线服务 LLM7（无需账号或密钥；没有令牌时只响应少量请求，之后需要等待，在 llm7.io 免费申请令牌后每分钟可请求 60 次），也可以使用任何兼容 OpenAI 的 API，或通过 Claude Code、Codex 使用订阅；每个服务的提示词都可以修改。“语气”按钮再给出五种语气的版本（专业、随意、友好、自信、简洁，可在设置中修改），“自定义提示”可以输入自己的要求；每个结果是一个单独的框，窗口平滑地向下展开，只有下方空间不够时才整体上移。点击任意一个结果即可替换原来选中的文字。
> - “透明效果”设置已移除：设置窗口和更新窗口始终不透明。“记住窗口大小”默认关闭。
> - 文字识别窗口默认在失去焦点时关闭，与翻译窗口一致。
> - 设置窗口里的菜单不再有缩放淡入动画：菜单后面的页面不再闪烁到菜单前面。
> - 屏幕上下排列时，窗口现在会在当前使用的屏幕上打开，而不是出现在下方的屏幕上。
> - 在缩放比例与主屏幕不同的屏幕上，截图选区重新覆盖整个屏幕，而不是只在左上角显示缩小的画面。
> - 1.1.5 及更早的版本无法自动更新：更新窗口会提示从 GitHub 下载最新版本，安装时选择卸载旧版本并清理应用数据，并附有本仓库的链接。

<!-- fork:end -->

<br/>
<hr/>
<div align="center">

<h3>中文 | <a href='./README_EN.md'>English</a> | <a href='./README_KR.md'> 한글 </a></h3>

<table>
<tr>
    <td> <img src="asset/1.png">
    <td> <img src="asset/2.png">
    <td> <img src="asset/3.png">
</table>

# 目录

</div>

-   [使用说明](#使用说明)
-   [特色功能](#特色功能)
-   [支持接口](#支持接口)
-   [插件系统](#插件系统)
-   [安装指南](#安装指南)
-   [外部调用](#外部调用)
-   [Wayland 支持](#wayland-支持)
-   [国际化](#国际化weblate)
-   [贡献者](#贡献者)
-   [感谢](#感谢)

<div align="center">

# 使用说明

</div>

每个操作都有自己的快捷键，在“设置 → 快捷键”中设置；没有设置快捷键的操作不会被触发。

-   **划词翻译**：在任意软件中选中文字，按下划词翻译快捷键。翻译窗口会在鼠标旁边打开，显示你启用的所有服务的翻译结果。
-   **输入翻译**：按下输入翻译快捷键，在弹出的窗口中输入或粘贴文字，按下回车翻译。
-   **剪切板监听**：点击翻译窗口左上角的图标，之后复制的每一段文字都会被自动翻译。
-   **截图 OCR**：按下快捷键后框选需要识别的区域，识别出的文字显示在窗口中，可以复制或翻译。
-   **截图翻译**：按下快捷键后框选需要翻译的区域，区域内的文字会被识别并翻译。
-   **静默文字识别**：按下它的快捷键（托盘菜单中也有）后框选屏幕区域。不会弹出任何窗口，识别出的文字直接复制到剪切板；识别不出文字时会有通知提醒。
-   **写作润色**：选中自己写的文字，按下写作润色快捷键。窗口会为每个服务显示一个改写得更地道的版本。
    -   点击任意一个结果，即可用它替换选中的文字。
    -   **语气**按钮会为每种语气（专业、随意、友好、自信、简洁）各给出一个版本，语气可在“设置 → 写作”中修改。
    -   **自定义提示**可以输入自己的要求，例如“改得更短”。
-   **进度指示器**：文字识别和翻译进行期间，显示一个带有当前服务图标的圆形指示器，而不是空窗口。点击它可立即打开窗口，否则翻译完成后窗口会从它里面展开。
-   **窗口动画**：窗口的过渡动画（圆形指示器变成窗口、窗口随内容增长）可以在“设置 → 通用”中通过“窗口动画”关闭，对翻译窗口和写作窗口都有效；进度指示器上转动的圆环不受影响。
-   **外部调用**：其他软件可以通过本机 HTTP 接口触发上面的所有操作，详见 [外部调用](#外部调用)。

<div align="center">

# 特色功能

</div>

-   [x] 写作润色：把你写的文字改得更地道，支持多种语气，默认使用免费的 LLM7 服务
-   [x] 静默文字识别：识别出的文字直接复制到剪切板，不弹出窗口
-   [x] 翻译和写作可使用你的 Claude Code 或 Codex 订阅，无需 API Key
-   [x] 内置 RapidOCR 离线文字识别，能识别系统 OCR 识别不了的小字
-   [x] 翻译窗口根据文本自动调整大小，窗口动画可选
-   [x] 多接口并行翻译 ([支持接口](#支持接口))
-   [x] 多接口文字识别 ([支持接口](#支持接口))
-   [x] 多接口语音合成 ([支持接口](#支持接口))
-   [x] 导出到生词本 ([支持接口](#支持接口))
-   [x] 外部调用 ([详情](#外部调用))
-   [x] 支持插件系统 ([插件系统](#插件系统))
-   [x] 支持所有 PC 平台 (Windows, macOS, Linux)
-   [x] 支持 Wayland (在 KDE、Gnome 以及 Hyprland 上测试)
-   [x] 多语言支持

<div align="center">

# 支持接口

</div>

## 翻译

-   [x] [OpenAI](https://platform.openai.com/)
-   [x] [智谱 AI](https://www.zhipuai.cn/)
-   [x] [Gemini Pro](https://gemini.google.com/)
-   [x] [Ollama](https://www.ollama.com/) (离线)
-   [x] [阿里翻译](https://www.aliyun.com/product/ai/alimt)
-   [x] [百度翻译](https://fanyi.baidu.com/)
-   [x] [彩云小译](https://fanyi.caiyunapp.com/)
-   [x] [腾讯翻译君](https://fanyi.qq.com/)
-   [x] [腾讯交互翻译](https://transmart.qq.com/)
-   [x] [火山翻译](https://translate.volcengine.com/)
-   [x] [小牛翻译](https://niutrans.com/)
-   [x] [Google](https://translate.google.com)
-   [x] [Bing](https://learn.microsoft.com/zh-cn/azure/cognitive-services/translator/)
-   [x] [Bing 词典](https://www.bing.com/dict)
-   [x] [DeepL](https://www.deepl.com/)
-   [x] [有道翻译](https://ai.youdao.com/)
-   [x] [剑桥词典](https://dictionary.cambridge.org/)
-   [x] [Yandex](https://translate.yandex.com/)
-   [x] [Lingva](https://github.com/TheDavidDelta/lingva-translate) ([插件](https://github.com/pot-app/pot-app-translate-plugin-template))
-   [x] [Tatoeba](https://tatoeba.org/) ([插件](https://github.com/pot-app/pot-app-translate-plugin-tatoeba))
-   [x] [ECDICT](https://github.com/skywind3000/ECDICT) ([插件](https://github.com/pot-app/pot-app-translate-plugin-ecdict))

更多接口支持见 [插件系统](#插件系统)

## 文字识别

-   [x] 系统 OCR (离线)
    -   [x] [Windows.Media.OCR](https://learn.microsoft.com/en-us/uwp/api/windows.media.ocr.ocrengine?view=winrt-22621) on Windows
    -   [x] [Apple Vision Framework](https://developer.apple.com/documentation/vision/recognizing_text_in_images) on MacOS
    -   [x] [Tesseract OCR](https://github.com/tesseract-ocr) on Linux
-   [x] [Tesseract.js](https://tesseract.projectnaptha.com/) (离线)
-   [x] [百度](https://ai.baidu.com/tech/ocr/general)
-   [x] [腾讯](https://cloud.tencent.com/product/ocr-catalog)
-   [x] [火山](https://www.volcengine.com/product/OCR)
-   [x] [迅飞](https://www.xfyun.cn/services/common-ocr)
-   [x] [腾讯图片翻译](https://cloud.tencent.com/document/product/551/17232)
-   [x] [百度图片翻译](https://fanyi-api.baidu.com/product/22)
-   [x] [Simple LaTeX](https://simpletex.cn/)
-   [x] [OCRSpace](https://ocr.space/) ([插件](https://github.com/pot-app/pot-app-recognize-plugin-template))
-   [x] [Rapid](https://github.com/RapidAI/RapidOcrOnnx) (离线 [插件](https://github.com/pot-app/pot-app-recognize-plugin-rapid))
-   [x] [Paddle](https://github.com/hiroi-sora/PaddleOCR-json) (离线 [插件](https://github.com/pot-app/pot-app-recognize-plugin-paddle))

更多接口支持见 [插件系统](#插件系统)

## 语音合成

-   [x] [Lingva](https://github.com/thedaviddelta/lingva-translate)

更多接口支持见 [插件系统](#插件系统)

## 生词本

-   [x] [Anki](https://apps.ankiweb.net/)
-   [x] [欧路词典](https://dict.eudic.net/)
-   [x] [有道](https://www.youdao.com/) ([插件](https://github.com/pot-app/pot-app-collection-plugin-youdao))
-   [x] [扇贝](https://web.shanbay.com/web/main) ([插件](https://github.com/pot-app/pot-app-collection-plugin-shanbay))

更多接口支持见 [插件系统](#插件系统)

<div align="center">

# 插件系统

</div>

软件内置接口数量有限，但是您可以通过插件系统来扩展软件的功能。

## 插件安装

你可以在 [Plugin List](https://pot-app.com/plugin.html) 查找你需要的插件，然后前往插件仓库下载插件。

pot 插件的扩展名为 `.potext`, 下载得到`.potext`文件之后， 在 偏好设置-服务设置-添加外部插件-安装外部插件 选择对应的 `.potext` 即可安装成功，添加到服务列表中即可像内置服务一样正常使用了。

### 故障排除

-   找不到指定的模块 (Windows)

    出现类似这样的报错是因为系统缺少 C++库，前往[这里](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170#visual-studio-2015-2017-2019-and-2022)安装即可解决问题。

-   不是有效的 Win32 应用程序 (Windows)

    出现类似这样的报错说明你没有下载对应系统或者架构的插件，前往插件仓库下载正确的插件即可解决问题。

## 插件开发

在 [Plugin List](https://pot-app.com/plugin.html) 中的 [模板](https://pot-app.com/plugin.html#%E6%A8%A1%E6%9D%BF) 章节提供了各种插件的开发模板，具体的开发文档请查看对应的模板仓库。

<div align="center">

# 安装指南

</div>

## Windows

### 通过 Winget 安装

```powershell
winget install Pylogmon.pot
```

### 手动安装

1. 在 [Release](https://github.com/pot-app/pot-desktop/releases/latest) 页面下载最新 `exe` 安装包。

    - 64 位机器下载 `pot_{version}_x64-setup.exe`
    - 32 位机器下载 `pot_{version}_x86-setup.exe`
    - arm64 机器下载 `pot_{version}_arm64-setup.exe`

2. 双击安装包进行安装。

### 故障排除

-   启动后没有界面，点击托盘图标没有反应

    检查是否卸载/禁用了 WebView2，如果卸载/禁用了 WebView2，请手动安装 WebView2 或将其恢复。

    如果是企业版系统不方便安装或无法安装 WebView2，请尝试在 [Release](https://github.com/pot-app/pot-desktop/releases/latest) 下载内置 WebView2 的版本 `pot_{version}_{arch}_fix_webview2_runtime-setup.exe`

    若问题仍然存在请尝试使用 Windows7 兼容模式启动。

## MacOS

### 通过 Brew 安装

1. 添加我们的 tap:

```bash
brew tap pot-app/homebrew-tap
```

2. 安装 pot:

```bash
brew install --cask pot
```

3. 更新 pot

```bash
brew upgrade --cask pot
```

### 手动安装

1. 从 [Release](https://github.com/pot-app/pot-desktop/releases/latest) 页面下载最新的 `dmg` 安装包。（如果您使用的是 M1 芯片，请下载名为`pot_{version}_aarch64.dmg`的安装包，否则请下载名为`pot_{version}_x64.dmg`的安装包）
2. 双击下载的文件后将 pot 拖入 Applications 文件夹即可完成安装。

### 故障排除

-   由于开发者无法验证，“pot”无法打开。

    点击 取消 按钮，然后去 设置 -> 隐私与安全性 页面，点击 仍要打开 按钮，然后在弹出窗口里点击 打开 按钮即可，以后打开 pot 就再也不会有任何弹窗告警了

    如果在 隐私与安全性 中找不到以上选项，或启动时提示文件损坏。打开 Terminal.app，并输入以下命令，然后重启 pot 即可：

    ```bash
    sudo xattr -d com.apple.quarantine /Applications/pot.app
    ```

-   如果每次打开时都遇到辅助功能权限提示，或者无法进行划词翻译，请前往设置 -> 隐私与安全 -> 辅助功能，移除 “pot”，并重新添加 “pot”。

## Linux

### Debian/Ubuntu

1. 从 [Release](https://github.com/pot-app/pot-desktop/releases/latest) 页面下载最新的对应架构的 `deb` 安装包。

2. 使用 `apt-get` 进行安装

    ```bash
    sudo apt-get install ./pot_{version}_amd64.deb
    ```

### Arch/Manjaro

> [!WARNING]
> 在最新版本的 [Webkit2Gtk](https://archlinux.org/packages/extra/x86_64/webkit2gtk) (2.42.0) 中，由于 Nvidia 专有驱动未完全实现 DMABUF，将导致无法启动和崩溃的情况发生。<br>
> 请降级或在 `/etc/environment` （或者其他设置环境变量的地方）中加入 `WEBKIT_DISABLE_DMABUF_RENDERER=1` 环境变量关闭 DMABUF 的使用。

1. 在 [AUR](https://aur.archlinux.org/packages?O=0&K=pot-translation) 查看

使用 `AUR helper` 安装：

```bash
yay -S pot-translation # 或 pot-translation-bin

# paru -S pot-translation # 或 pot-translation-bin
```

2. 如果你使用 `archlinuxcn` 源，可以直接使用 pacman 安装

```bash
sudo pacman -S pot-translation
```

### Flatpak

> [!WARNING]
> Flatpak 版本缺失托盘图标。

<a href='https://flathub.org/apps/com.pot_app.pot'>
    <img width='240' alt='Download on Flathub' src='https://flathub.org/api/badge?locale=zh-Hans'/>
</a>

<div align="center">

# 外部调用

</div>

Pot 提供了完整的 HTTP 接口，以便可以被其他软件调用。您可以通过向 `127.0.0.1:port` 发送 HTTP 请求来调用 pot，其中的`port`是 pot 监听的端口号，默认为`60828`,可以在软件设置中进行更改。

## API 文档:

```bash
POST "/" => 翻译指定文本(body为需要翻译的文本),
GET "/config" => 打开设置,
POST "/translate" => 翻译指定文本(同"/"),
GET "/selection_translate" => 划词翻译,
GET "/input_translate" => 输入翻译,
GET "/ocr_recognize" => 截图OCR,
GET "/ocr_translate" => 截图翻译,
GET "/ocr_recognize?screenshot=false" => 截图OCR(不使用软件内截图),
GET "/ocr_translate?screenshot=false" => 截图翻译(不使用软件内截图),
GET "/ocr_recognize?screenshot=true" => 截图OCR,
GET "/ocr_translate?screenshot=true" => 截图翻译,
GET "/ocr_copy" => 截图识别并复制文字(不弹出窗口),
GET "/ocr_copy?screenshot=false" => 识别已有截图并复制文字(不弹出窗口),
```

## 示例：

-   调用划词翻译：

    如果想要调用 pot 划词翻译，只需向`127.0.0.1:port`发送请求即可。

    例如通过 curl 发送请求：

    ```bash
    curl "127.0.0.1:60828/selection_translate"
    ```

## 不使用软件内截图

这一功能可以让您在不使用软件内截图的情况下调用截图 OCR/截图翻译功能，这样您就可以使用您喜欢的截图工具来截图了，也可以解决在某些平台下 pot 自带的截图无法使用的问题。

### 调用流程

1. 使用其他截图工具截图
2. 将截图保存在 `$CACHE/com.pot-app.desktop/pot_screenshot_cut.png`
3. 向`127.0.0.1:port/ocr_recognize?screenshot=false`发送请求即可调用成功

> `$CACHE`为系统缓存目录，例如在 Windows 上为`C:\Users\{用户名}\AppData\Local\com.pot-app.desktop\pot_screenshot_cut.png`

### 示例

在 Linux 下调用 Flameshot 进行截图 OCR:

```bash
rm ~/.cache/com.pot-app.desktop/pot_screenshot_cut.png && flameshot gui -s -p ~/.cache/com.pot-app.desktop/pot_screenshot_cut.png && curl "127.0.0.1:60828/ocr_recognize?screenshot=false"
```

## 现有用法 (快捷划词翻译)

### SnipDo (Windows)

1. 从 [Microsoft Store](https://apps.microsoft.com/store/detail/snipdo/9NPZ2TVKJVT7) 下载安装 SnipDo。
2. 从 [Release](https://github.com/pot-app/pot-desktop/releases/latest) 下载 pot 的 SnipDo 扩展 (pot.pbar)
3. 双击下载的扩展文件完成安装。
4. 选中文字，可以看到弹出的 SnipDo 工具条，点击翻译按钮即可翻译。

### PopClip (MacOS)

1. 从 [App Store](https://apps.apple.com/us/app/popclip/id445189367?mt=12) 下载安装 PopClip
2. 从 [Release](https://github.com/pot-app/pot-desktop/releases/latest) 下载 pot 的 PopClip 扩展 (pot.popclipextz)
3. 双击下载的扩展文件完成安装。
4. 在 PopClip 的扩展中启用 pot 扩展，选中文本即可点击翻译。

### Starry (Linux)

> Starry 目前仍处于开发阶段，因此您只能手动编译它。

Github: [ccslykx/Starry](https://github.com/ccslykx/Starry)

<div align="center">

# Wayland 支持

</div>

由于各大发行版对于 Wayland 的支持程度不同，所以 pot 本身没法做到特别完美的支持，这里可以提供一些常见问题的解决方案，通过合理的设置之后，pot 也可以在 Wayland 下完美运行。

## 快捷键无法使用

由于 Tauri 的快捷键方案并没有支持 Wayland，所以 pot 应用内的快捷键设置在 Wayland 下无法使用。 您可以设置系统快捷用 curl 发送请求来触发 pot，详见[外部调用](#外部调用)

## 截图无法使用

在一些纯 Wayland 桌面环境/窗口管理器(如 Hyprland)上，pot 内置的截图无法使用，这时可以通过使用其他截图工具代替，详见 [不使用软件内截图](#不使用软件内截图)

下面给出在 Hyprland 下的配置示例(通过 grim 和 slurp 实现截图)：

```conf
bind = ALT, X, exec, grim -g "$(slurp)" ~/.cache/com.pot-app.desktop/pot_screenshot_cut.png && curl "127.0.0.1:60828/ocr_recognize?screenshot=false"
bind = ALT, C, exec, grim -g "$(slurp)" ~/.cache/com.pot-app.desktop/pot_screenshot_cut.png && curl "127.0.0.1:60828/ocr_translate?screenshot=false"
```

其他桌面环境/窗口管理器也是类似的操作

## 划词翻译窗口跟随鼠标位置

由于目前 pot 在 Wayland 下还无法获取到正确的鼠标坐标，所以内部的实现无法工作。 对于某些桌面环境/窗口管理器，可以通过设置窗口规则来实现窗口跟随鼠标位置，这里以 Hyprland 为例：

```conf
windowrulev2 = float, class:(pot), title:(Translator|OCR|PopClip|Screenshot Translate) # Translation window floating
windowrulev2 = move cursor 0 0, class:(pot), title:(Translator|PopClip|Screenshot Translate) # Translation window follows the mouse position.
```

<div align="center">

# 国际化([Weblate](https://hosted.weblate.org/engage/pot-app/))

[![](https://hosted.weblate.org/widget/pot-app/pot-desktop/svg-badge.svg)](https://hosted.weblate.org/engage/pot-app/)

[![](https://hosted.weblate.org/widget/pot-app/pot-desktop/zh_Hans/multi-auto.svg)](https://hosted.weblate.org/engage/pot-app/)

</div>

<div align="center">

# 贡献者

</div>

<img src="https://github.com/pot-app/.github/blob/master/pot-desktop-contributions.svg?raw=true" width="100%"/>

## 手动编译

### 环境要求

Node.js 22

pnpm 10.14.0（由 package.json 中的 packageManager 字段固定）

Rust >= 1.80.0

### 开始编译

1. Clone 仓库

    ```bash
    git clone https://github.com/whisperers26/be-native.git
    ```

2. 安装依赖

    ```bash
    cd be-native
    pnpm install
    ```

3. 安装依赖(仅 Linux 需要)

    ```bash
    sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.0-dev libayatana-appindicator3-dev librsvg2-dev patchelf libxdo-dev libxcb1 libxrandr2 libdbus-1-3
    ```

4. 开发调试

    ```bash
    pnpm tauri dev # Run the app in development mode
    ```

5. 打包构建
    ```bash
    pnpm tauri build # Build into installation package
    ```

6. 测试

    ```bash
    pnpm test # Unit and component tests
    pnpm typecheck # TypeScript type check
    pnpm smoke # Real-app smoke test (Windows; start the app with pnpm tauri dev first)
    ```

<div align="center">

# 感谢

</div>

-   [Bob](https://github.com/ripperhe/Bob) 灵感来源
-   [bob-plugin-openai-translator](https://github.com/yetone/bob-plugin-openai-translator) OpenAI 接口参考
-   [@uiYzzi](https://github.com/uiYzzi) 实现思路
-   [@Lichenkass](https://github.com/Lichenkass) 维护 Deepin 应用商店中的 pot
-   [Tauri](https://github.com/tauri-apps/tauri) 好用的 GUI 框架

<div align="center">
