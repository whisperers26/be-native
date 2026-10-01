// Claude Code and Codex as translation engines, through the command-line tools the user has
// installed and signed in to. One translation is one session, which is one process.
//
// Starting the process is the slow part, so a session per configured service waits in the
// background, already loaded and reading stdin. A translation takes it, the next one is started
// at once, and the used one is killed when its answer is complete. A waiting session has made no
// request, so it costs no usage.

use crate::config::get;
use log::{info, warn};
use once_cell::sync::Lazy;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::{Arc, Mutex};

const CLAUDE_CODE: &str = "claude_code";
const CODEX: &str = "codex";

// What a session is started with. Two translations can share a waiting session only if all of it
// is equal.
#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub struct Spec {
    // "claude_code" or "codex"
    pub provider: String,
    // The executable; empty to look for it on PATH
    #[serde(default)]
    pub command: String,
    // Empty or "default" for the tool's own default
    #[serde(default)]
    pub model: String,
    // The reasoning level. Empty or "default" for the tool's own default; "off" (Claude Code)
    // turns thinking off
    #[serde(default)]
    pub effort: String,
    #[serde(default)]
    pub system_prompt: String,
}

impl Spec {
    // The spec of a service instance, from its stored settings
    fn from_config(provider: &str, config: &Value) -> Spec {
        let field = |key: &str| config[key].as_str().unwrap_or_default().to_string();
        Spec {
            provider: provider.to_string(),
            command: field("command"),
            model: field("model"),
            effort: field("effort"),
            system_prompt: field("systemPrompt"),
        }
    }
}

fn is_default(value: &str) -> bool {
    value.is_empty() || value == "default"
}

// Everything that would add tokens to the request or work to the start-up is turned off: Claude
// Code's own system prompt, tools, MCP servers, settings files (hooks, plugins, CLAUDE.md), skills
// and the session file.
fn claude_args(spec: &Spec) -> Vec<String> {
    let mut args: Vec<String> = [
        "-p",
        "--input-format",
        "stream-json",
        "--output-format",
        "stream-json",
        "--verbose",
        "--include-partial-messages",
        "--system-prompt",
        &spec.system_prompt,
        "--tools",
        "",
        "--strict-mcp-config",
        "--setting-sources",
        "",
        "--no-session-persistence",
        "--disable-slash-commands",
    ]
    .iter()
    .map(|arg| arg.to_string())
    .collect();
    if !is_default(&spec.model) {
        args.extend(["--model".to_string(), spec.model.clone()]);
    }
    if !is_default(&spec.effort) && spec.effort != "off" {
        args.extend(["--effort".to_string(), spec.effort.clone()]);
    }
    args
}

// The prompt is read from stdin ("-")
fn codex_args(spec: &Spec) -> Vec<String> {
    let mut args: Vec<String> = ["exec", "--json", "--skip-git-repo-check", "--sandbox", "read-only"]
        .iter()
        .map(|arg| arg.to_string())
        .collect();
    if !is_default(&spec.model) {
        args.extend(["--model".to_string(), spec.model.clone()]);
    }
    if !is_default(&spec.effort) {
        args.extend([
            "-c".to_string(),
            format!("model_reasoning_effort={}", spec.effort),
        ]);
    }
    args.push("-".to_string());
    args
}

fn envs(spec: &Spec) -> Vec<(&'static str, &'static str)> {
    if spec.provider == CLAUDE_CODE && spec.effort == "off" {
        vec![("MAX_THINKING_TOKENS", "0")]
    } else {
        vec![]
    }
}

// Look for a tool on PATH and where its installers put it. A desktop app often gets a shorter
// PATH than a terminal does.
fn find_executable(name: &str) -> Option<PathBuf> {
    let mut dirs: Vec<PathBuf> = std::env::var_os("PATH")
        .map(|path| std::env::split_paths(&path).collect())
        .unwrap_or_default();
    if let Some(home) = dirs::home_dir() {
        dirs.push(home.join(".local").join("bin"));
    }
    #[cfg(target_os = "windows")]
    if let Some(data) = dirs::config_dir() {
        dirs.push(data.join("npm"));
    }
    #[cfg(not(target_os = "windows"))]
    dirs.extend([PathBuf::from("/usr/local/bin"), PathBuf::from("/opt/homebrew/bin")]);

    #[cfg(target_os = "windows")]
    let file_names = [format!("{name}.exe"), format!("{name}.cmd"), format!("{name}.bat")];
    #[cfg(not(target_os = "windows"))]
    let file_names = [name.to_string()];

    dirs.iter()
        .flat_map(|dir| file_names.iter().map(move |file_name| dir.join(file_name)))
        .find(|path| path.is_file())
}

fn executable(spec: &Spec) -> Result<PathBuf, String> {
    if !spec.command.is_empty() {
        return Ok(PathBuf::from(&spec.command));
    }
    let name = if spec.provider == CODEX { "codex" } else { "claude" };
    find_executable(name).ok_or(format!(
        "{name} was not found. Install it, or set its path in the service settings."
    ))
}

// A running tool. Dropping it ends the session.
struct Session {
    child: Child,
    // None once the prompt has been sent and stdin closed (Codex)
    stdin: Option<ChildStdin>,
    stdout: BufReader<ChildStdout>,
    stderr: Arc<Mutex<String>>,
}

impl Session {
    fn start(spec: &Spec) -> Result<Session, String> {
        let program = executable(spec)?;
        let args = match spec.provider.as_str() {
            CLAUDE_CODE => claude_args(spec),
            CODEX => codex_args(spec),
            other => return Err(format!("Unknown provider: {other}")),
        };
        let mut command = Command::new(&program);
        command
            .args(args)
            .envs(envs(spec))
            // Away from any project, so the tool finds no project files to read
            .current_dir(std::env::temp_dir())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            // CREATE_NO_WINDOW
            command.creation_flags(0x08000000);
        }
        let mut child = command
            .spawn()
            .map_err(|e| format!("Failed to start {}: {e}", display(&program)))?;
        let stdin = child.stdin.take();
        let stdout = BufReader::new(child.stdout.take().unwrap());
        // Keep stderr drained, or the tool blocks once the pipe is full
        let stderr = Arc::new(Mutex::new(String::new()));
        let mut pipe = child.stderr.take().unwrap();
        let buffer = stderr.clone();
        std::thread::spawn(move || {
            let mut chunk = [0u8; 4096];
            while let Ok(read) = pipe.read(&mut chunk) {
                if read == 0 {
                    break;
                }
                buffer
                    .lock()
                    .unwrap()
                    .push_str(&String::from_utf8_lossy(&chunk[..read]));
            }
        });
        Ok(Session { child, stdin, stdout, stderr })
    }

    fn is_alive(&mut self) -> bool {
        matches!(self.child.try_wait(), Ok(None))
    }

    // What to report when the tool stopped without an answer
    fn failure(&mut self) -> String {
        let _ = self.child.wait();
        // The thread draining stderr may still be a moment behind the exit
        std::thread::sleep(std::time::Duration::from_millis(50));
        let stderr = self.stderr.lock().unwrap().trim().to_string();
        if stderr.is_empty() {
            "The command-line tool ended without an answer".to_string()
        } else {
            stderr
        }
    }
}

impl Drop for Session {
    fn drop(&mut self) {
        self.stdin.take();
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn display(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

// One line of a tool's output, as far as a translation cares
#[derive(Debug, PartialEq)]
enum Event {
    // More text, to add to what has arrived
    Delta(String),
    // The whole text so far, replacing what has arrived
    Text(String),
    // The session is over. Claude Code carries the answer here; Codex has sent it already
    Done(Option<String>),
    Failed(String),
    // Something went wrong that the tool may still recover from
    Warning(String),
    Other,
}

fn parse_claude_line(line: &str) -> Event {
    let Ok(value) = serde_json::from_str::<Value>(line) else {
        return Event::Other;
    };
    match value["type"].as_str() {
        Some("stream_event") => {
            let delta = &value["event"]["delta"];
            // Thinking arrives as thinking_delta and is not part of the answer
            if value["event"]["type"] == "content_block_delta" && delta["type"] == "text_delta" {
                Event::Delta(delta["text"].as_str().unwrap_or_default().to_string())
            } else {
                Event::Other
            }
        }
        Some("result") => {
            let result = value["result"].as_str().unwrap_or_default().to_string();
            if value["is_error"].as_bool().unwrap_or(false) {
                Event::Failed(result)
            } else {
                Event::Done(Some(result))
            }
        }
        _ => Event::Other,
    }
}

fn parse_codex_line(line: &str) -> Event {
    let Ok(value) = serde_json::from_str::<Value>(line) else {
        return Event::Other;
    };
    match value["type"].as_str() {
        Some("item.completed") => {
            let item = &value["item"];
            // Older versions name the field item_type and the kind assistant_message
            let kind = item["type"].as_str().or(item["item_type"].as_str());
            match kind {
                Some("agent_message") | Some("assistant_message") => {
                    Event::Text(item["text"].as_str().unwrap_or_default().to_string())
                }
                _ => Event::Other,
            }
        }
        Some("turn.completed") => Event::Done(None),
        Some("turn.failed") => Event::Failed(
            value["error"]["message"]
                .as_str()
                .unwrap_or("The turn failed")
                .to_string(),
        ),
        Some("error") => Event::Warning(
            value["message"]
                .as_str()
                .unwrap_or("Codex reported an error")
                .to_string(),
        ),
        _ => Event::Other,
    }
}

// Send the one prompt of this session and read the answer. `on_text` gets the text so far each
// time more of it arrives.
fn converse(
    session: &mut Session,
    spec: &Spec,
    prompt: &str,
    on_text: impl Fn(&str),
) -> Result<String, String> {
    let is_codex = spec.provider == CODEX;
    let input = if is_codex {
        // Codex takes no system prompt here, so the instructions lead the prompt
        format!("{}\n\n{}", spec.system_prompt, prompt)
    } else {
        format!(
            "{}\n",
            json!({ "type": "user", "message": { "role": "user", "content": prompt } })
        )
    };
    let sent = match session.stdin.as_mut() {
        Some(stdin) => stdin
            .write_all(input.as_bytes())
            .and_then(|_| stdin.flush())
            .is_ok(),
        None => false,
    };
    if !sent {
        return Err(session.failure());
    }
    if is_codex {
        // Codex starts when its prompt ends
        session.stdin.take();
    }

    let mut text = String::new();
    let mut warning = None;
    let mut line = String::new();
    loop {
        line.clear();
        match session.stdout.read_line(&mut line) {
            Ok(0) | Err(_) => break,
            Ok(_) => {}
        }
        let event = if is_codex {
            parse_codex_line(&line)
        } else {
            parse_claude_line(&line)
        };
        match event {
            Event::Delta(delta) => {
                text.push_str(&delta);
                on_text(&text);
            }
            Event::Text(whole) => {
                text = whole;
                on_text(&text);
            }
            Event::Done(answer) => return Ok(answer.unwrap_or(text)),
            Event::Failed(message) => return Err(message),
            Event::Warning(message) => warning = Some(message),
            Event::Other => {}
        }
    }
    if is_codex && !text.is_empty() {
        return Ok(text);
    }
    Err(warning.unwrap_or_else(|| session.failure()))
}

// The sessions waiting for a translation or a rewrite
static POOL: Lazy<Mutex<HashMap<Spec, Session>>> = Lazy::new(|| Mutex::new(HashMap::new()));

// The lists of service instances that can hold a Claude Code or Codex instance
const SERVICE_LISTS: [&str; 2] = ["translate_service_list", "writing_service_list"];

// One spec per enabled Claude Code or Codex instance in a service list. `config_of` gives the
// stored settings of an instance.
fn specs_in(list: &Value, config_of: impl Fn(&str) -> Option<Value>) -> Vec<Spec> {
    let mut specs = vec![];
    for key in list.as_array().into_iter().flatten().filter_map(Value::as_str) {
        let provider = key.split('@').next().unwrap_or_default();
        if provider != CLAUDE_CODE && provider != CODEX {
            continue;
        }
        let Some(config) = config_of(key) else {
            continue;
        };
        if !config["enable"].as_bool().unwrap_or(true) {
            continue;
        }
        let spec = Spec::from_config(provider, &config);
        // Never saved by its settings form, so the frontend's defaults are not known here
        if spec.system_prompt.is_empty() || specs.contains(&spec) {
            continue;
        }
        specs.push(spec);
    }
    specs
}

// One spec per enabled Claude Code or Codex instance in the settings, for translation or writing
fn configured_specs() -> Vec<Spec> {
    let mut specs: Vec<Spec> = vec![];
    for list in SERVICE_LISTS.iter().filter_map(|name| get(name)) {
        for spec in specs_in(&list, get) {
            if !specs.contains(&spec) {
                specs.push(spec);
            }
        }
    }
    specs
}

fn warm(pool: &mut HashMap<Spec, Session>, spec: &Spec) {
    if pool.get_mut(spec).is_some_and(|session| session.is_alive()) {
        return;
    }
    match Session::start(spec) {
        Ok(session) => {
            info!("Agent CLI session waiting: {} {}", spec.provider, spec.model);
            pool.insert(spec.clone(), session);
        }
        Err(e) => {
            warn!("Agent CLI session failed to start: {}", e);
            pool.remove(spec);
        }
    }
}

// Make the waiting sessions match the settings: one for each configured service, none for
// anything else. Runs at launch and whenever the settings are reloaded.
pub fn sync() {
    std::thread::spawn(|| {
        let specs = configured_specs();
        let mut pool = POOL.lock().unwrap();
        pool.retain(|spec, _| specs.contains(spec));
        for spec in &specs {
            warm(&mut pool, spec);
        }
    });
}

// End every waiting session
pub fn shutdown() {
    POOL.lock().unwrap().clear();
}

#[derive(Clone, serde::Serialize)]
struct StreamPayload<'a> {
    id: &'a str,
    text: &'a str,
}

// Run one prompt in its own session and return the answer. While it arrives, the calling window
// gets `agent_cli_stream` events with `{ id, text }`, the text so far.
#[tauri::command(async)]
pub fn agent_cli_run(
    window: tauri::Window,
    id: String,
    spec: Spec,
    prompt: String,
) -> Result<String, String> {
    let waiting = {
        let mut pool = POOL.lock().unwrap();
        let waiting = pool.remove(&spec);
        // Start the next session now, so it is loaded by the time this one is done. A spec that is
        // not in the settings (a settings form testing itself) gets none.
        if configured_specs().contains(&spec) {
            warm(&mut pool, &spec);
        }
        waiting
    };
    // A session that has waited for long may have ended meanwhile
    let mut session = match waiting {
        Some(mut session) => {
            if session.is_alive() {
                session
            } else {
                Session::start(&spec)?
            }
        }
        None => {
            info!("Agent CLI session started on demand: {}", spec.provider);
            Session::start(&spec)?
        }
    };
    let result = converse(&mut session, &spec, &prompt, |text| {
        let _ = window.emit("agent_cli_stream", StreamPayload { id: &id, text });
    });
    // The session is over: dropping it kills the process
    drop(session);
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    fn spec(provider: &str, model: &str, effort: &str) -> Spec {
        Spec {
            provider: provider.to_string(),
            command: String::new(),
            model: model.to_string(),
            effort: effort.to_string(),
            system_prompt: "Translate.".to_string(),
        }
    }

    #[test]
    fn specs_come_from_the_enabled_saved_instances_of_a_list() {
        let list = json!(["google", "claude_code@a", "codex@b", "claude_code@off", "claude_code@new", "claude_code@same"]);
        let config_of = |key: &str| match key {
            "claude_code@a" | "claude_code@same" => {
                Some(json!({ "model": "haiku", "effort": "off", "systemPrompt": "Rewrite." }))
            }
            "codex@b" => Some(json!({ "effort": "low", "systemPrompt": "Rewrite." })),
            "claude_code@off" => Some(json!({ "enable": false, "systemPrompt": "Rewrite." })),
            // Added but never saved by its settings form
            "claude_code@new" => Some(json!({})),
            _ => None,
        };

        let specs = specs_in(&list, config_of);

        let providers: Vec<&str> = specs.iter().map(|spec| spec.provider.as_str()).collect();
        assert_eq!(providers, [CLAUDE_CODE, CODEX]);
        assert_eq!(specs[0].model, "haiku");
        assert_eq!(specs[0].system_prompt, "Rewrite.");
        assert_eq!(specs[1].effort, "low");
    }

    #[test]
    fn a_list_that_is_not_a_list_has_no_specs() {
        assert!(specs_in(&json!("claude_code"), |_| Some(json!({}))).is_empty());
    }

    #[test]
    fn claude_args_replace_the_system_prompt_and_turn_everything_else_off() {
        let args = claude_args(&spec(CLAUDE_CODE, "haiku", "low"));
        assert_eq!(
            args,
            [
                "-p",
                "--input-format",
                "stream-json",
                "--output-format",
                "stream-json",
                "--verbose",
                "--include-partial-messages",
                "--system-prompt",
                "Translate.",
                "--tools",
                "",
                "--strict-mcp-config",
                "--setting-sources",
                "",
                "--no-session-persistence",
                "--disable-slash-commands",
                "--model",
                "haiku",
                "--effort",
                "low",
            ]
        );
    }

    #[test]
    fn claude_defaults_add_no_model_or_effort() {
        for (model, effort) in [("", ""), ("default", "default")] {
            let args = claude_args(&spec(CLAUDE_CODE, model, effort));
            assert!(!args.contains(&"--model".to_string()));
            assert!(!args.contains(&"--effort".to_string()));
        }
    }

    #[test]
    fn claude_effort_off_turns_thinking_off_through_the_environment() {
        let off = spec(CLAUDE_CODE, "haiku", "off");
        assert!(!claude_args(&off).contains(&"--effort".to_string()));
        assert_eq!(envs(&off), [("MAX_THINKING_TOKENS", "0")]);
        assert!(envs(&spec(CLAUDE_CODE, "haiku", "low")).is_empty());
        assert!(envs(&spec(CODEX, "", "off")).is_empty());
    }

    #[test]
    fn codex_args_read_the_prompt_from_stdin() {
        assert_eq!(
            codex_args(&spec(CODEX, "gpt-5", "low")),
            [
                "exec",
                "--json",
                "--skip-git-repo-check",
                "--sandbox",
                "read-only",
                "--model",
                "gpt-5",
                "-c",
                "model_reasoning_effort=low",
                "-",
            ]
        );
        assert_eq!(
            codex_args(&spec(CODEX, "", "default")),
            ["exec", "--json", "--skip-git-repo-check", "--sandbox", "read-only", "-"]
        );
    }

    #[test]
    fn spec_from_config_reads_the_stored_fields() {
        let config = json!({
            "instanceName": "Claude",
            "command": "",
            "model": "sonnet",
            "effort": "off",
            "systemPrompt": "Translate."
        });
        let mut expected = spec(CLAUDE_CODE, "sonnet", "off");
        assert_eq!(Spec::from_config(CLAUDE_CODE, &config), expected);
        expected.model = String::new();
        expected.effort = String::new();
        expected.system_prompt = String::new();
        assert_eq!(Spec::from_config(CLAUDE_CODE, &json!({})), expected);
    }

    #[test]
    fn spec_deserializes_from_the_frontend_names() {
        let value = json!({ "provider": "codex", "systemPrompt": "Translate." });
        let parsed: Spec = serde_json::from_value(value).unwrap();
        assert_eq!(parsed, spec(CODEX, "", ""));
    }

    #[test]
    fn claude_lines() {
        let delta = r#"{"type":"stream_event","event":{"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"你好"}}}"#;
        assert_eq!(parse_claude_line(delta), Event::Delta("你好".to_string()));
        let thinking = r#"{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"hm"}}}"#;
        assert_eq!(parse_claude_line(thinking), Event::Other);
        let result = r#"{"type":"result","subtype":"success","is_error":false,"result":"你好"}"#;
        assert_eq!(parse_claude_line(result), Event::Done(Some("你好".to_string())));
        let error = r#"{"type":"result","subtype":"success","is_error":true,"result":"There's an issue with the selected model"}"#;
        assert_eq!(
            parse_claude_line(error),
            Event::Failed("There's an issue with the selected model".to_string())
        );
        assert_eq!(parse_claude_line(r#"{"type":"system","subtype":"init"}"#), Event::Other);
        assert_eq!(parse_claude_line("not json"), Event::Other);
    }

    #[test]
    fn codex_lines() {
        let message = r#"{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"你好"}}"#;
        assert_eq!(parse_codex_line(message), Event::Text("你好".to_string()));
        let old = r#"{"type":"item.completed","item":{"id":"item_1","item_type":"assistant_message","text":"你好"}}"#;
        assert_eq!(parse_codex_line(old), Event::Text("你好".to_string()));
        let reasoning = r#"{"type":"item.completed","item":{"id":"item_0","type":"reasoning","text":"hm"}}"#;
        assert_eq!(parse_codex_line(reasoning), Event::Other);
        assert_eq!(
            parse_codex_line(r#"{"type":"turn.completed","usage":{"input_tokens":1}}"#),
            Event::Done(None)
        );
        assert_eq!(
            parse_codex_line(r#"{"type":"turn.failed","error":{"message":"model not found"}}"#),
            Event::Failed("model not found".to_string())
        );
        assert_eq!(
            parse_codex_line(r#"{"type":"error","message":"stream error"}"#),
            Event::Warning("stream error".to_string())
        );
        assert_eq!(parse_codex_line(r#"{"type":"thread.started","thread_id":"x"}"#), Event::Other);
    }

    // Talks to the real Claude Code with the signed-in account, so it runs only on request:
    // cargo test agent_cli -- --ignored --nocapture
    #[test]
    #[ignore]
    fn real_claude_session_translates_once_it_has_waited() {
        let mut spec = spec(CLAUDE_CODE, "haiku", "off");
        spec.system_prompt =
            "You are a translation engine. Reply with the translation only.".to_string();
        let mut session = Session::start(&spec).unwrap();
        std::thread::sleep(std::time::Duration::from_secs(3));
        assert!(session.is_alive());

        let started = std::time::Instant::now();
        let streamed = Mutex::new(vec![]);
        let answer = converse(
            &mut session,
            &spec,
            "Target language: German

Good morning",
            |text| streamed.lock().unwrap().push(text.to_string()),
        )
        .unwrap();
        println!("{answer:?} in {:?}, {} updates", started.elapsed(), streamed.lock().unwrap().len());
        assert!(answer.to_lowercase().contains("guten morgen"));
        assert_eq!(streamed.lock().unwrap().last(), Some(&answer));
    }

    #[test]
    #[ignore]
    fn real_claude_session_reports_an_unknown_model() {
        let spec = spec(CLAUDE_CODE, "no-such-model", "off");
        let mut session = Session::start(&spec).unwrap();
        let error = converse(&mut session, &spec, "Target language: German

Hi", |_| {}).unwrap_err();
        println!("{error}");
        assert!(error.contains("no-such-model"));
    }
}
