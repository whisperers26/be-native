use std::process::Command;

/// Speaks `text` with the voice the OS has for `lang` (`en`, `zh-CN`, ...) and returns the audio file's bytes:
/// WAV from SAPI on Windows, AIFF from `say` on macOS, WAV from `espeak-ng` on Linux.
#[tauri::command(async)]
pub fn system_tts(text: String, lang: String) -> Result<Vec<u8>, String> {
    if text.trim().is_empty() {
        return Err("Text is empty".to_string());
    }
    speak(&text, &lang)
}

fn temp_file(extension: &str) -> std::path::PathBuf {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    std::env::temp_dir().join(format!(
        "be_native_tts_{}_{}.{}",
        std::process::id(),
        nanos,
        extension
    ))
}

/// Reads the file the speech program wrote and removes it.
fn take_audio(path: &std::path::Path) -> Result<Vec<u8>, String> {
    let bytes = std::fs::read(path).map_err(|e| format!("No audio was produced: {}", e));
    let _ = std::fs::remove_file(path);
    bytes
}

fn run(mut command: Command, missing: &str) -> Result<(), String> {
    let output = command.output().map_err(|e| format!("{}: {}", missing, e))?;
    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if stderr.is_empty() {
            format!("Speech failed with status {}", output.status)
        } else {
            stderr
        })
    }
}

#[cfg(target_os = "windows")]
fn speak(text: &str, lang: &str) -> Result<Vec<u8>, String> {
    use std::os::windows::process::CommandExt;

    // The text, language and path travel in environment variables, so no quoting can break the script. The script
    // itself has no double quotes: the command line would strip them.
    const SCRIPT: &str = r#"
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$lang = $env:BN_TTS_LANG
if ($lang) {
    $voices = @($s.GetInstalledVoices() | Where-Object { $_.Enabled })
    $primary = $lang.Split('-')[0]
    $v = $voices | Where-Object { $_.VoiceInfo.Culture.Name -eq $lang } | Select-Object -First 1
    if (-not $v) { $v = $voices | Where-Object { $_.VoiceInfo.Culture.Name -like ($primary + '*') } | Select-Object -First 1 }
    if (-not $v) { [Console]::Error.WriteLine('No installed voice for ' + $lang + '. Add one in Windows Settings > Time & language > Speech.'); exit 3 }
    $s.SelectVoice($v.VoiceInfo.Name)
}
$s.SetOutputToWaveFile($env:BN_TTS_OUT)
$s.Speak($env:BN_TTS_TEXT)
$s.Dispose()
"#;

    let out = temp_file("wav");
    let mut command = Command::new("powershell.exe");
    command
        .args(["-NoProfile", "-NonInteractive", "-Command", SCRIPT])
        .env("BN_TTS_TEXT", text)
        .env("BN_TTS_LANG", lang)
        .env("BN_TTS_OUT", &out)
        .creation_flags(0x08000000);
    if let Err(e) = run(command, "Cannot start PowerShell") {
        let _ = std::fs::remove_file(&out);
        return Err(e);
    }
    take_audio(&out)
}

#[cfg(target_os = "macos")]
fn speak(text: &str, lang: &str) -> Result<Vec<u8>, String> {
    // `say -v ?` lists "Name   xx_YY   # sample"; names may contain spaces.
    let listing = Command::new("say")
        .args(["-v", "?"])
        .output()
        .map_err(|e| format!("Cannot start say: {}", e))?;
    let listing = String::from_utf8_lossy(&listing.stdout).to_string();
    let wanted = lang.replace('-', "_");
    let primary = wanted.split('_').next().unwrap_or("").to_string();
    let voices: Vec<(String, String)> = listing
        .lines()
        .filter_map(|line| {
            let head = line.split('#').next()?.trim_end();
            let split = head.rfind(char::is_whitespace)?;
            Some((
                head[..split].trim().to_string(),
                head[split..].trim().to_string(),
            ))
        })
        .collect();
    let voice = voices
        .iter()
        .find(|(_, locale)| *locale == wanted)
        .or_else(|| {
            voices
                .iter()
                .find(|(_, locale)| locale.split('_').next() == Some(primary.as_str()))
        })
        .map(|(name, _)| name.clone())
        .ok_or_else(|| format!("No installed voice for {}", lang))?;

    let out = temp_file("aiff");
    let mut command = Command::new("say");
    command.arg("-v").arg(&voice).arg("-o").arg(&out).arg("--").arg(text);
    if let Err(e) = run(command, "Cannot start say") {
        let _ = std::fs::remove_file(&out);
        return Err(e);
    }
    take_audio(&out)
}

#[cfg(target_os = "linux")]
fn speak(text: &str, lang: &str) -> Result<Vec<u8>, String> {
    let primary = lang.split('-').next().unwrap_or("en").to_lowercase();
    for program in ["espeak-ng", "espeak"] {
        let mut command = Command::new(program);
        command.args(["-v", &primary, "--stdout", "--", text]);
        match command.output() {
            Ok(output) if output.status.success() => return Ok(output.stdout),
            Ok(output) => {
                return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
            }
            Err(_) => continue,
        }
    }
    Err("espeak-ng is not installed".to_string())
}
