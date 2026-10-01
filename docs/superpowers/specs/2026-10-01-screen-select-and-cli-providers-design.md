# Screen-selection lines, silent OCR copy, and CLI providers

Date: 2026-10-01. Requested by the owner in one message; designed and built
without approval stops under the standing "do not ask again" instruction, so
every judgment call is recorded below as a ruling.

## What the owner asked for

1. In every screen-selection action, replace the small crosshair cursor with a
   horizontal and a vertical line across the screen. One monitor only; when the
   mouse moves to another monitor, the lines move there too.
2. A silent "select a region, copy the recognized text" action that shows
   nothing, with its own hotkey like the other actions.
3. Claude Code and Codex as translation providers, using the installed CLI (and
   so the owner's subscription), not an API key or a subscription token. One
   translation per session. A fresh session is always waiting in the
   background, is ended when its task is done, and is replaced at once, so the
   CLI answers about as fast as an API. The settings choose model and reasoning
   level.

Not merged, no PR: the owner tests by hand first.

## Branches

Stacked, each cut from the one before, so the last one holds everything:

1. `docs/screen-select-cli-spec`: this document.
2. `fix/screenshot-stale-listener`: a known bug the silent action would expose.
3. `feat/screenshot-crosshair-lines`
4. `feat/ocr-silent-copy`
5. `feat/cli-agent-providers`

## 0. Stale screenshot listener (fix)

known-issues.md: a cancelled capture leaves its `success` listener behind, so a
later capture also runs the stale action. With a silent action that would open
the Recognize window after a silent capture. Fix: Rust remembers the one
`success` listener and removes it before registering the next. This also stops
two actions running when a hotkey is pressed while the picker is already open.

## 1. Crosshair lines

All selection goes through the `screenshot` window (Windows and Linux; macOS
uses the system `screencapture`, which is unchanged).

- The overlay hides the cursor (`cursor-none`) and draws two 1px lines through
  the pointer, the full width and height of the window. The window covers
  exactly one monitor, so the lines never reach another.
- New Rust command `cursor_position` returns the cursor's physical position
  and the origin of the monitor under it. The window calls it every 50 ms.
  - First answer: places the lines before the mouse has moved.
  - Origin differs from the window's monitor, and no drag is in progress: the
    window hides, captures the new monitor, moves there (leave full screen, set
    position, enter full screen), and shows again once the new capture has
    loaded.
- During a drag the window stays where it is; a selection belongs to one
  monitor.

Rulings:

- The lines use the selection box's colour (sky-500).
- Polling lives in the frontend: the webview gets no mouse events once the
  cursor has left its window, and a frontend poll knows whether a drag is in
  progress.

## 2. Silent OCR copy

- Rust `ocr_copy()`: the same capture as `ocr_recognize`, then opens a window
  labelled `silent_recognize` that is never shown.
- That window renders `src/window/SilentRecognize/`: reads the cut image
  (`get_base64`), runs the first instance of `recognize_service_list` with
  `recognize_language`, applies `recognize_delete_newline`, writes the text to
  the clipboard and closes itself.
- Reachable like the other actions: setting `hotkey_ocr_copy` (Hotkey page),
  tray menu item, HTTP `/ocr_copy` (and `?screenshot=false`), and the tray
  click option.

Rulings:

- Success shows nothing at all, as asked. A failure (OCR error, language not
  supported by the service, no text) shows a system notification, because
  otherwise a failure is indistinguishable from an empty clipboard.
- Same service and language defaults as the Recognize window; no new settings.
- A separate hidden window rather than doing OCR in the picker window: it also
  serves macOS and the HTTP API's `screenshot=false`.

## 3. Claude Code and Codex providers

Two translate services, `claude_code` and `codex`, sharing one Rust module
(`agent_cli`) and one frontend helper (`src/utils/agent_cli`).

Measured with Claude Code 2.1.284 (haiku, one sentence):

| | first text after sending | total |
| --- | --- | --- |
| cold start | about 1.4 s plus thinking | 4.7 s |
| warm, default thinking | 0.9 s plus thinking | 5.8 s |
| warm, thinking off | 0.66 s | 0.9 s |

So two things matter: a warm process, and no thinking.

### Sessions

- A session is one CLI process. `agent_cli` keeps a pool of warm processes,
  one per distinct spec (provider, command, model, reasoning level, system
  prompt).
- Warm Claude process: `claude -p --input-format stream-json --output-format
  stream-json --verbose --include-partial-messages --system-prompt <prompt>
  --tools "" --strict-mcp-config --setting-sources "" --no-session-persistence
  --disable-slash-commands [--model <m>] [--effort <e>]`, started in the temp
  directory. It loads and then waits on stdin; it makes no request, so an idle
  warm session costs no usage.
- A translation takes the warm process (or starts one if none matches), writes
  one user message, streams the text back, and kills the process at the
  `result` line. The replacement is started as soon as the warm one is taken.
- The pool is reconciled with the settings at launch and on every
  `reload_store`: one warm process per enabled `claude_code`/`codex` instance
  in `translate_service_list`, others killed.
- Closing the app closes the processes' stdin, which ends them.

### Keeping usage small (Claude)

- `--system-prompt` replaces Claude Code's own (large) system prompt; no tools,
  no MCP servers, no user/project settings (so no hooks, CLAUDE.md or plugins'
  context), no skills. A translation sent about 480 input tokens in the probe.
- Reasoning level `off` sets `MAX_THINKING_TOKENS=0`. It is the default.
- Default model `haiku`.

### Codex

`codex exec --json --skip-git-repo-check --sandbox read-only [--model <m>]
[-c model_reasoning_effort=<e>] -`, the prompt (instructions plus text) on
stdin. Codex reads its whole prompt from stdin before it starts, so the warm
process has only paid for process start-up; it is still one session per
translation. Output: the last `agent_message` item, ended by `turn.completed`.

Ruling: Codex is not installed on this machine, so the Codex path is written
from its documented CLI and covered by unit tests of the argument builder and
the line parser only. It is untested against the real CLI.

### Frontend

- `translate()` of both services builds the user message (`Target language`,
  `Source language`, then the text) and calls `runAgentCli(spec, prompt,
  setResult)`, which invokes `agent_cli_run` and listens for
  `agent_cli_stream` events carrying the text so far.
- Settings form: instance name, executable (empty: found on `PATH`), model,
  reasoning level, instructions (the system prompt). Claude's model is a list
  (CLI default, haiku, sonnet, opus, fable) that also accepts typed names;
  Codex's is free text because its model names cannot be checked here.
- Reasoning levels: Claude `off`, `default`, `low`, `medium`, `high`, `xhigh`,
  `max`; Codex `default`, `minimal`, `low`, `medium`, `high`, `xhigh`.

### Errors

A missing executable, a non-zero exit, or an error result is returned as the
command's error string (with stderr when there is no result) and shown in the
result card like any service error.

## Testing

- Vitest: the Screenshot window (lines, monitor switch), SilentRecognize
  (copies, notifies on failure), the Hotkey page, both services (prompt, spec,
  streaming, errors).
- Rust unit tests for the pure parts of `agent_cli` (arguments, output
  parsing).
- Real app on the secondary monitor: the lines, a silent copy, a Claude Code
  translation. Moving the picker between monitors needs the primary monitor,
  which agents must not use, so it is left to the owner's manual test.
