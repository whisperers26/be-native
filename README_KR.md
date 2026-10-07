<img width="200px" src="public/icon.svg" align="left"/>

# Be Native

> 🌈 원어민처럼 읽고 쓰기: 크로스 플랫폼 번역 및 OCR 앱

![License](https://img.shields.io/github/license/whisperers26/be-native.svg)
![Tauri](https://img.shields.io/badge/Tauri-1.6.8-blue?logo=tauri)
![TypeScript](https://img.shields.io/badge/-TypeScript-blue?logo=typescript&logoColor=white)
![Rust](https://img.shields.io/badge/-Rust-orange?logo=rust&logoColor=white)
![Windows](https://img.shields.io/badge/-Windows-blue?logo=windows&logoColor=white)
![MacOS](https://img.shields.io/badge/-macOS-black?&logo=apple&logoColor=white)
![Linux](https://img.shields.io/badge/-Linux-yellow?logo=linux&logoColor=white)

<!-- fork:start -->

> **Be Native**는 모국어가 아닌 언어로 읽고 쓰는 것을 돕습니다. 선택 번역, 입력 번역, 스크린샷 OCR, 스크린샷 번역, 그리고 작성한 글을 더 자연스럽게 다듬어 주는 글쓰기 개선을 제공하며, 여러 번역·글쓰기·문자 인식·음성 합성·단어장 서비스와 플러그인을 지원합니다. Windows, macOS, Linux에서 동작합니다.
>
> Be Native는 [Pot](https://github.com/pot-app/pot-desktop)을 기반으로 한 개인 포크입니다. 업스트림 저장소 [pot-app/pot-desktop](https://github.com/pot-app/pot-desktop)은 보관(archived)되었으며, 개발은 [whisperers26/be-native](https://github.com/whisperers26/be-native)에서 계속됩니다. 설치 파일은 이 포크의 [Releases](https://github.com/whisperers26/be-native/releases) 페이지에 배포되며 앱 내 업데이트도 이를 읽습니다. 아래 설치 안내는 업스트림 Pot용입니다.
>
> 이 포크의 변경 사항:
>
> - 기본 브랜치는 `main`이며, 모든 변경은 풀 리퀘스트로 병합됩니다.
> - AI 에이전트는 [AGENTS.md](./AGENTS.md)와 [docs/agents](./docs/agents/)의 위키를 따라 작업합니다.
> - 모든 풀 리퀘스트는 CI에서 검사됩니다(문서, 타입, 테스트 및 프런트엔드 빌드).
> - 자동화 테스트(Vitest)가 프런트엔드 동작을 고정합니다: `pnpm test`.
> - 실제 앱 스모크 테스트(`pnpm smoke`, Windows)가 로컬 HTTP API로 앱의 창을 검사합니다.
> - 프런트엔드는 strict 모드의 TypeScript이며, CI는 `src/` 아래의 JavaScript 파일을 거부합니다.
> - `v*` 태그를 푸시하면 서명된 설치 파일을 빌드해 GitHub 릴리스로 배포하며, 앱 내 업데이트는 업스트림 피드 대신 최신 릴리스를 읽습니다.
> - 앱 이름을 Be Native로 바꾸고 새 아이콘을 넣었습니다. 디버그 빌드(`pnpm tauri dev`)는 "Be Native (Debug)"로 표시되며 시작 시 업데이트를 확인하지 않습니다.
> - 화면 영역을 선택할 때 작은 십자 커서 대신 포인터를 지나는 가로선과 세로선을 표시합니다. 선은 한 모니터 안에만 그려지고, 포인터가 다른 모니터로 가면 따라갑니다.
> - 조용한 문자 인식: 전용 단축키(트레이 메뉴와 HTTP API의 `/ocr_copy`로도 사용 가능)로 화면 영역을 선택하면 창을 띄우지 않고 인식한 텍스트를 클립보드에 복사합니다.
> - Claude Code와 Codex를 번역 서비스로 추가했습니다. 컴퓨터에 설치되어 로그인된 `claude` 또는 `codex` 명령줄 도구를 그대로 사용하므로 API 키 없이 구독으로 번역합니다. 번역마다 새 세션을 쓰고 백그라운드에 세션 하나를 미리 준비해 두어 API와 비슷한 속도로 응답하며, 모델과 추론 수준은 서비스 설정에서 고르며, 설정의 버튼을 누르면 도구가 제공하는 모델을 조회해 목록으로 보여 줍니다.
> - RapidOCR를 내장 OCR 서비스로 추가했습니다. PP-OCRv5 모델이 컴퓨터에서 완전히 오프라인으로 실행되며, 시스템 OCR이 놓치는 작은 글자와 글자에 바짝 붙인 좁은 선택 영역도 읽습니다(중국어 간체·번체, 영어, 일본어). 새로 설치하면 기본 OCR 서비스이며, 이미 설정한 OCR 서비스 목록은 그대로 유지됩니다.
> - 번역 창이 텍스트에 맞춰 크기를 스스로 조절합니다. 가능한 한 스크롤 없이 전체 내용을 보여 주고, 긴 텍스트에서는 좁고 길어지는 대신 가로로 넓어지며, 화면을 가득 채우지 않습니다. "창 크기 유지"를 켜면 직접 조절한 크기를 유지하고, 다음에도 정확히 같은 크기로 열립니다.
> - 텍스트를 인식하고 번역하는 동안에는 빈 창 대신, 작업 중인 서비스의 아이콘이 들어 있는 작은 원형 진행 표시기가 나타납니다. 번역이 끝나면 창이 액체처럼 표시기에서 흘러나와 펼쳐집니다. 표시기를 클릭하면 창이 바로 열립니다. 일반 설정의 "창 애니메이션"에서 애니메이션을 끌 수 있으며 글쓰기 창에도 적용됩니다.
> - 여러 언어가 섞인 텍스트는 더 큰 비중을 차지하는 부분으로 언어를 감지하므로, 중국어가 조금 섞인 영어 텍스트도 중국어로 처리되지 않고 번역됩니다.
> - 텍스트의 언어는 기본적으로 웹 서비스로 보내지 않고 내 컴퓨터에서 감지합니다. 다른 감지 엔진은 번역 설정에서 여전히 선택할 수 있습니다.
> - 온라인 감지 엔진이 실패하면 언어 표시에 "감지 실패(영어)"라고 나타나, 영어가 기본값으로 쓰였음을 알 수 있습니다.
> - 인식한 텍스트와 선택한 텍스트는 기본적으로 줄바꿈을 똑똑하게 합칩니다. 줄이 넘쳐서 끊긴 줄만 이어 붙이고, 문단·제목·목록 항목(글머리 기호, 번호, 또는 표시 없음)은 각자 줄을 유지합니다. 하이픈으로 나뉜 단어는 다시 합치고, 중국어와 일본어는 공백 없이 잇습니다. 모든 내용을 한 줄로 만들던 Pot의 "줄바꿈 삭제"(기본값 꺼짐)를 대체합니다.
> - 정보(About) 페이지의 링크는 이 포크를 가리킵니다. GitHub는 이 저장소를, 피드백은 이 저장소의 이슈를 엽니다. 업스트림의 웹사이트, 이메일, 커뮤니티 링크는 제거했습니다.
> - 백업 기능(WebDAV, Aliyun Drive, 로컬 파일)을 제거했습니다. 설정에 백업 페이지가 더 이상 없습니다.
> - 글쓰기 개선: 직접 쓴 글을 선택하고 단축키를 누르면 더 자연스럽게 고쳐 쓴 글을 창에 보여 줍니다. 기본 서비스는 계정이나 키가 필요 없는 무료 온라인 서비스 LLM7이며(토큰이 없으면 몇 건의 요청만 처리한 뒤 기다려야 하며, llm7.io에서 무료 토큰을 받으면 분당 60건까지 요청할 수 있습니다), OpenAI 호환 API나 Claude Code·Codex를 통한 구독도 쓸 수 있고, 서비스마다 프롬프트를 바꿀 수 있습니다. "어조" 버튼은 다섯 가지 어조(전문적, 캐주얼, 친근함, 자신감, 간결함; 설정에서 수정 가능)의 결과를 더 보여 주고, "사용자 프롬프트"에는 원하는 요청을 직접 입력할 수 있습니다. 결과마다 별도의 상자로 표시되며, 창은 아래쪽으로 부드럽게 늘어나고 아래에 공간이 없을 때만 위로 이동합니다. 결과를 클릭하면 선택했던 글이 그 결과로 바뀝니다.
> - "투명 효과" 설정이 없어졌습니다. 설정 창과 업데이트 창은 항상 불투명합니다. "창 크기 유지"는 기본적으로 꺼져 있습니다.
> - 문자 인식 창은 번역 창처럼 기본적으로 포커스를 잃으면 닫힙니다.
> - 설정 창의 메뉴는 확대·페이드 애니메이션 없이 열립니다. 메뉴 뒤의 화면이 메뉴 앞으로 깜박이지 않습니다.
> - 화면이 위아래로 배치된 경우, 창이 아래 화면이 아니라 현재 작업 중인 화면에서 열립니다.
> - 배율이 주 화면과 다른 화면에서 영역을 선택할 때, 화면이 왼쪽 위에 작게 표시되지 않고 다시 화면 전체를 덮습니다.
> - 1.1.5 이하 버전은 자동으로 업데이트할 수 없습니다. 업데이트 창이 GitHub에서 최신 릴리스를 내려받아 설치할 때 이전 버전을 제거하고 앱 데이터를 삭제하도록 안내하며, 이 저장소의 링크를 보여 줍니다.

<!-- fork:end -->

<br/>
<hr/>
<div align="center">

<h3><a href='./README.md'>中文</a> | <a href='./README_EN.md'> English </a> | 한글</h3>

<table>
<tr>
    <td> <img src="asset/1.png">
    <td> <img src="asset/2.png">
    <td> <img src="asset/3.png">
</table>

# 목차

</div>

-   [사용법](#usage)
-   [기능](#features)
-   [지원 서비스](#supported-services)
-   [플러그인 시스템](#plugin-system)
-   [설치](#installation)
-   [외부호출](#external-calls)
-   [Wayland 지원](#wayland-support)
-   [다국어](#internationalizationweblate)
-   [기여자](#contributors)
-   [감사한 사람들](#thanks)

<div align="center">

# 사용법

</div>

각 동작에는 자신만의 단축키가 있습니다. “설정 → 단축키”에서 지정하세요. 단축키를 지정하지 않은 동작은 실행되지 않습니다.

-   **선택 번역**: 아무 앱에서나 글을 선택한 뒤 선택 번역 단축키를 누릅니다. 포인터 옆에 번역 창이 열리고, 켜 둔 모든 서비스의 번역이 표시됩니다.
-   **입력 번역**: 입력 번역 단축키를 누르고, 열린 창에 글을 입력하거나 붙여넣은 뒤 Enter를 누릅니다.
-   **클립보드 감시**: 번역 창 왼쪽 위의 아이콘을 누르면, 이후 복사하는 모든 글이 자동으로 번역됩니다.
-   **스크린샷 OCR**: 단축키를 누르고 인식할 화면 영역을 드래그합니다. 인식된 글이 창에 표시되며 복사하거나 번역할 수 있습니다.
-   **스크린샷 번역**: 단축키를 누르고 번역할 화면 영역을 드래그합니다. 영역 안의 글이 인식되어 번역됩니다.
-   **무음 OCR 복사**: 전용 단축키(트레이 메뉴에도 있음)를 누르고 화면 영역을 드래그합니다. 창은 열리지 않고 인식된 글이 바로 클립보드에 복사되며, 인식된 글이 없으면 알림이 표시됩니다.
-   **글쓰기 개선**: 직접 쓴 글을 선택하고 글쓰기 단축키를 누릅니다. 서비스마다 하나씩, 더 자연스럽게 고친 글이 창에 표시됩니다.
    -   결과를 클릭하면 선택했던 글이 그 결과로 바뀝니다.
    -   **어조** 버튼은 어조(전문적, 캐주얼, 친근함, 자신감, 간결함)마다 하나씩 버전을 추가하며, 어조는 “설정 → 글쓰기”에서 수정할 수 있습니다.
    -   **사용자 지정 프롬프트**에는 “더 짧게”처럼 원하는 요청을 직접 입력할 수 있습니다.
-   **진행 표시기**: 글을 인식하고 번역하는 동안 빈 창 대신 작업 중인 서비스의 아이콘이 담긴 작은 원형 표시기가 나타납니다. 누르면 창이 바로 열리고, 누르지 않으면 번역이 끝났을 때 표시기에서 창이 펼쳐집니다.
-   **창 애니메이션**: 창 전환 애니메이션(원이 창으로 바뀌는 효과, 내용에 따라 창이 커지는 효과)은 “설정 → 일반”의 “창 애니메이션”에서 끌 수 있으며 번역 창과 글쓰기 창 모두에 적용됩니다. 진행 표시기에서 도는 고리는 영향을 받지 않습니다.
-   **외부호출**: 다른 앱이 로컬 HTTP API로 위의 모든 동작을 실행할 수 있습니다. [External Calls](#external-calls)를 참고하세요.

<div align="center">

# 기능

</div>

-   [x] 글쓰기 개선: 직접 쓴 글을 더 자연스럽게 고쳐 주며, 여러 어조를 지원하고 기본 서비스는 무료인 LLM7
-   [x] 무음 OCR 복사: 인식된 글을 창 없이 바로 클립보드에 복사
-   [x] Claude Code 또는 Codex 구독으로 번역과 글쓰기 (API 키 불필요)
-   [x] RapidOCR 오프라인 문자 인식: 시스템 OCR이 읽지 못하는 작은 글자도 인식
-   [x] 글에 맞춰 크기가 자동으로 조절되는 번역 창, 선택 가능한 창 애니메이션
-   [x] 여러 번역 사이트를 사용한 동시번역 ([상세 페이지](#supported-services))
-   [x] 문자인식 OCR ([상세 페이지](#supported-services))
-   [x] 텍스트 음성 변환 ([상세 페이지](#supported-services))
-   [x] 사전 앱에 내보내기 ([상세 페이지](#supported-services))
-   [x] 외부호출 ([External Calls](#external-calls))
-   [x] 플러그인 시스템 ([Plugin System](#plugin-system))
-   [x] 운영체제 지원 - Windows, macOS and Linux
-   [x] Wayland 지원 (Tested on KDE, Gnome and Hyprland)
-   [x] 다중언어 지원

<div align="center">

# 상세 페이지

</div>

## 번역

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

추가항목은 다음을 참고 [Plugin System](#plugin-system)

## 문자인식

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

추가항목은 다음을 참고 [Plugin System](#plugin-system)

## 문자-음성변환

-   [x] [Lingva](https://github.com/thedaviddelta/lingva-translate)

추가항목은 다음을 참고 [Plugin System](#plugin-system)

## 사전

-   [x] [Anki](https://apps.ankiweb.net/)
-   [x] [Eudic](https://dict.eudic.net/)
-   [x] [Youdao](https://www.youdao.com/) ([Plugin](https://github.com/pot-app/pot-app-collection-plugin-youdao))
-   [x] [ShanBay](https://web.shanbay.com/web/main) ([Plugin](https://github.com/pot-app/pot-app-collection-plugin-shanbay))

추가항목은 다음을 참고 [Plugin System](#plugin-system)

<div align="center">

# -플러그인- 시스템

</div>

정해진 기본 설정항목 외에, -플러그인 시스템-을 통해 사용자가 원하는 기능을 추가할 수 있습니다.

## -플러그인-의 설치

설치가능한 플러그인 항목은 다음을 참고하세요 [Plugin List](https://pot-app.com/plugin.html). 그리고 필요한 항목을 다운받으십시오.

플러그인의 확장자는 `.potext` 입니다. 다운받은 `.potext` 확장자 파일을 프로그램 설정메뉴 - 서비스 - Add External Plugin - Install External Plugin 메뉴에서 등록하여 설치합니다. 파일을 등록하면 해당 항목을 프로그램의 사용목록에 표시가 되어 사용이 가능해 집니다.

### 문제해결

-   특정모듈을 불러오지 못할 때 (Windows)

    C++ 라이브러리가 없을 때 이러한 문제가 주로 발생합니다. 다음페이지를 방문하여 필요한 라이브러리를 설치합니다. [참고 페이지](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170#visual-studio-2015-2017-2019-and-2022)

-   유효하지 않은 Win32 프로그램 (Windows)

    시스템 또는 프로그램과 호환되지 않는 플러그인을 다운받아 설치한 경우입니다. 플러그인에서 적절한 파일을 다운받았는지 확인하시고 재설치 하십시오.

## -플러그인-의 개발

템플릿 [Template](https://pot-app.com/en/plugin.html#template) 항목에서 다양한 항목을 플러그인들을 찾을 수 있습니다 [Plugin List](https://pot-app.com/en/plugin.html). 이 곳에서 필요한 문서를 참고하십시오.

<div align="center">

# 설치방법

</div>

## Windows 윈도우

### Winget 을 이용한 설치

```powershell
winget install Pylogmon.pot
```

### 수동 설치

1. 최신버전 다운로드 페이지 [Release](https://github.com/pot-app/pot-desktop/releases/latest)에서 `.exe` 파일을 다운받습니다.

    - 64-bit 버전 사용시, `pot_{version}_x64-setup.exe`
    - 32-bit 버전 사용시, `pot_{version}_x86-setup.exe`
    - arm64 버전 사용시, `pot_{version}_arm64-setup.exe`

2. 더블클릭하여 설치를 합니다.

### 문제해결

-   설치 후 프로그램창이 보이지 않거나 오른쪽 하단 시스템 트레이 항목에 아이콘이 표시되지 않을 경우,

    윈도우-브라우저에서 사용하는 WebView2 기능이 설치되지 않았거나 비활성화 된 경우 입니다. 이 때는 WebView2 를 설치하거나 기능을 재설정 하십시오.

    회사/기업 사용자의 경우 WebView2 기능이 설치되지 않았거나 비활성화된 경우가 있습니다. 이 경우 다음을 설치하십시오. WebView2 version `pot_{version} at [Release](https://github.com/pot-app/pot-desktop/releases/latest) _{arch}_fix_webview2_runtime-setup.exe`

    문제가 해결되지 않는 경우, Windows 7 compatibility mode에서 시도해 보십시오.

## MacOS 맥OS

### Brew를 통한 설치

1. 탭에 추가:

```bash
brew tap pot-app/homebrew-tap
```

2. 설치:

```bash
brew install --cask pot
```

3. 업데이트:

```bash
brew upgrade --cask pot
```

### 수동설치

1. 최신버전 다운로드 페이지 [Release](https://github.com/pot-app/pot-desktop/releases/latest)에서 `.dmg` 파일을 다운받습니다. (M1 사용자이면, 다음 파일명을 다운로드 합니다 `pot_{version}_aarch64.dmg`, 기타 사용자는 다음 파일을 다운로드 합니다. `pot_{version}_x64.dmg`)
2. 더블클릭하여 설치를 합니다.

### 문제해결

-   "pot" 을 열 수 없는 경우는 개발자 인증이 되지 않아서 입니다.

    취소 버튼을 누르고 설정 메뉴로 들어갑니다 -> 개인정보 및 보안 메뉴에서 설정을 합니다.
    열기 버튼을 클릭한 다음 팝업 창에서 열기 버튼을 클릭합니다. 그 이후에는 포트를 열 때 더 이상 팝업 경고가 표시되지 않습니다.

    개인정보 및 보안에서 위의 옵션을 찾을 수 없거나 Apple Silicon 컴퓨터에서 파일 손상과 같은 오류 메시지가 표시되는 경우. Terminal.app을 열고 다음 명령을 입력한 다음(중간에 비밀번호를 입력해야 할 수도 있음), pot을 다시 시작합니다:

    ```bash
    sudo xattr -d com.apple.quarantine /Applications/pot.app
    ```

-   열 때마다 권한 프롬프트가 나타나거나 바로 가기 번역을 수행할 수 없는 경우 설정 -> 개인정보 및 보안 -> 지원 기능으로 이동하여 Pot을 제거한 다음 Pot을 다시 추가하세요..

## Linux

### Debian/Ubuntu 데비안/우분투

리눅스 환경을 위해 `deb` 파일이 제공됩니다

참고 : 두 가지 버전이 제공됩니다. `glibc2.28`기반의 `universal`과 `openssl-1.1` 버전입니다. 프로그램이 당신의 컴퓨터에서 정상적으로 실행되지 않는다면 dependency와 관련된 문제일 경우가 많습니다. `universal`버전을 사용하면 이전 버전의 dependency를 사용하여 실행하면 대부분 실행이 가능합니다.

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
> 시스템 트레이 아이콘이 Flatpak을 통해 설치하면 표시되지 않습니다.

<a href='https://flathub.org/apps/com.pot_app.pot'>
    <img width='240' alt='Download on Flathub' src='https://flathub.org/api/badge?locale=en'/>
</a>

<div align="center">

# 외부호출

</div>

Pot은 완벽한 HTTP 인터페이스를 제공합니다. 이를 통해 다른 프로그램과 연동해서 사용이 가능합니다. 타 프로그램은 HTTP requests를 `127.0.0.1:port` 주소로 보내어 활용할 수 있습니다. 기본 포트는 `60828`입니다. 이는 사용자 설정에서 변경이 가능합니다.

## API 상세:

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

## 예제:

-   선택영역 자동번역:

    "선택영역 자동번역"을 호출하려면 간단히 `127.0.0.1:port`에 호출요청을 합니다:

    E.g. curl 사용시:

    ```bash
    curl "127.0.0.1:60828/selection_translate"
    ```

## 자체스크린샷 미사용 OCR 기능

OCR 및 번역을 위해서 pot은 자체 스크린샷(화면캡쳐)기능을 사용하지 않을 수 있습니다. 자체 화면캡쳐 툴을 사용하면 특정환경에서 자체 스크린샷 기능이 정상적으로 동작하지 않는 것을 해결할 수 있습니다.

### Workflow:

1. 타 스크린샷 프로그램을 사용하여 화면을 캡쳐합니다
2. 캡쳐한 화면을 다음 위치에 저장합니다. `$CACHE/com.pot-app.desktop/pot_screenshot_cut.png`
3. 외부호출을 통해 번역요청을 요청합니다. `127.0.0.1:port/ocr_recognize?screenshot=false`

> `$CACHE` 는 시스템 캐시 폴더입니다. e.g. 윈도우는 다음경로를 확인하세요 `C:\Users\{username}\AppData\Local\com.pot-app.desktop\pot_screenshot_cut.png` .

### 예제

리눅스에서 Flameshot을 활용한 OCR:

```bash
rm ~/.cache/com.pot-app.desktop/pot_screenshot_cut.png && flameshot gui -s -p ~/.cache/com.pot-app.desktop/pot_screenshot_cut.png && curl "127.0.0.1:60828/ocr_recognize?screenshot=false"
```

## Existing Usages (Quick selection translation)

### SnipDo (Windows)

1. SnipDo를 [Microsoft Store](https://apps.microsoft.com/store/detail/snipdo/9NPZ2TVKJVT7) 에서 다운받아 설치합니다.
2. DSnipDo 확장팩을 최신버전 다운 경로에서 [Release](https://github.com/pot-app/pot-desktop/releases/latest) (pot.pbar) 다운받습니다.
3. 더블클릭하여 설치합니다.
4. 특정단어를 선택하게 되면, 선택영역의 오른쪽 윗 부분에 번역아이콘이 보이게 됩니다. 클릭하여 번역을 진행합니다.

### PopClip (MacOS)

1. PopClip를 [App Store](https://apps.apple.com/us/app/popclip/id445189367?mt=12) 에서 다운받아 설치합니다.
2. PopClip 확장팩을 최신버전 다운 경로에서 [Release](https://github.com/pot-app/pot-desktop/releases/latest) (pot.popclipextz) 다운받습니다.
3. 더블클릭하여 설치합니다.
4. PopClip settings에서 기능을 활성화 하면 선택영역의 번역을 할 수 있습니다.

### Starry (Linux)

> Starry는 아직 개발단계에 머물러 있습니다.따라서 사용자가 직업 컴파일해야 합니다.

Github: [ccslykx/Starry](https://github.com/ccslykx/Starry)

<div align="center">

# Wayland 지원

</div>

배포판마다 Wayland에 대한 지원 수준이 다르기 때문에 pot 자체로는 완벽한 호환성을 달성할 수 없습니다. 하지만 다음은 적절한 구성을 통해 구현할 수 있는 몇 가지 일반적인 문제에 대한 해결책으로, Wayland에서 pot을 완벽하게 실행할 수 있습니다.

## 단축키를 적용할 수 없을 때,

타우리Tauri는 웨이랜드Wayland를 지원하지 않기 때문에, pot의 단축키 기능은 웨이랜드Waylan에서 사용할 수 없습니다.
시스템 단축키를 설정하고 `curl`로 요청을 보내 팟을 호출할 수 있으며, 자세한 내용은[External Calls](#external-calls) 을 참조하세요.

## 단축키가 동작하지 않을 때,

일부 순수 웨이랜드Wayland 데스크톱 환경/창 관리자(예: 하이프랜드)에서는 pot의 기본 제공 스크린샷 기능을 사용할 수 없습니다. 이 경우 다른 스크린샷 도구를 대신 사용할 수 있습니다. 자세한 내용은 [Not Using Built-in Screenshot](#not-using-built-in-screenshot) 섹션을 참조하세요.

아래는 스크린샷 기능을 구현하기 위해 `grim`과 `slurp`를 사용하는 Hyprland의 구성 예시입니다:

```conf
bind = ALT, X, exec, grim -g "$(slurp)" ~/.cache/com.pot-app.desktop/pot_screenshot_cut.png && curl "127.0.0.1:60828/ocr_recognize?screenshot=false"
bind = ALT, C, exec, grim -g "$(slurp)" ~/.cache/com.pot-app.desktop/pot_screenshot_cut.png && curl "127.0.0.1:60828/ocr_translate?screenshot=false"
```

다른 데스크톱 환경/창 관리자도 비슷한 작업을 수행합니다.

## 번역창은 마우스 좌표를 따라갑니다.

현재 웨이랜드Wayland에서 정확한 마우스 좌표를 얻을 수 없기 때문에 내부 구현이 제대로 작동하지 않습니다. 특정 데스크톱 환경/창 관리자의 경우 창 규칙을 설정하여 마우스 위치에 따른 창을 구현할 수 있습니다. 여기서는 하이프랜드Hyprland를 예로 들어보겠습니다:

```conf
windowrulev2 = float, class:(pot), title:(Translator|OCR|PopClip|Screenshot Translate) # Translation window floating
windowrulev2 = move cursor 0 0, class:(pot), title:(Translator|PopClip|Screenshot Translate) # Translation window follows the mouse position.
```

<div align="center">

# 다중언어 지원([Weblate](https://hosted.weblate.org/engage/pot-app/))

[![](https://hosted.weblate.org/widget/pot-app/pot-desktop/svg-badge.svg)](https://hosted.weblate.org/engage/pot-app/)

[![](https://hosted.weblate.org/widget/pot-app/pot-desktop/multi-auto.svg)](https://hosted.weblate.org/engage/pot-app/)

</div>

<div align="center">

# 기여자

</div>

<img src="https://github.com/pot-app/.github/blob/master/pot-desktop-contributions.svg?raw=true" width="100%"/>

## 사용자 컴파일

### 요구사항

Node.js 22

pnpm 10.14.0 (package.json의 packageManager로 고정)

Rust >= 1.80.0

### 컴파일 방법

1. repository을 복사합니다

    ```bash
    git clone https://github.com/whisperers26/be-native.git
    ```

2. dependencies를 설치합니다

    ```bash
    cd be-native
    pnpm install
    ```

3. (Only Linux) dependencies를 설치합니다

    ```bash
    sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.0-dev libayatana-appindicator3-dev librsvg2-dev patchelf libxdo-dev libxcb1 libxrandr2 libdbus-1-3
    ```

4. 개발모드 (Optional)

    ```bash
    pnpm tauri dev # Run the app in development mode
    ```

5. 빌드
    ```bash
    pnpm tauri build # Build into installation package
    ```

6. 테스트

    ```bash
    pnpm test # Unit and component tests
    pnpm typecheck # TypeScript type check
    pnpm smoke # Real-app smoke test (Windows; start the app with pnpm tauri dev first)
    ```

<div align="center">

# 관련사항

</div>

-   [Bob](https://github.com/ripperhe/Bob) Inspiration
-   [bob-plugin-openai-translator](https://github.com/yetone/bob-plugin-openai-translator) OpenAI API Reference
-   [@uiYzzi](https://github.com/uiYzzi) Implementation ideas
-   [@Lichenkass](https://github.com/Lichenkass) Maintaining the Deepin App Store.
-   [Tauri](https://github.com/tauri-apps/tauri) A user-friendly GUI framework.

<div align="center">
