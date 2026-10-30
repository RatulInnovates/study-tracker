use std::{
    collections::HashMap,
    fs,
    io::{Read, Write},
    path::PathBuf,
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager};

const DB: &str = "study-tracker.db";
const PENDING: &str = "restore.pending";
const KEEP_AUTO: usize = 7;

fn config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_config_dir().map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
struct Backups {
    dir: String,
    files: Vec<String>,
}

/// Lists backup files (newest first) and prunes `auto-*` ones beyond the newest KEEP_AUTO.
#[tauri::command]
fn backups(app: AppHandle) -> Result<Backups, String> {
    let dir = config_dir(&app)?.join("backups");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let mut files: Vec<String> = fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok()?.file_name().into_string().ok())
        .filter(|n| n.ends_with(".db"))
        .collect();
    files.sort_by(|a, b| b.cmp(a));
    let old: Vec<String> = files.iter().filter(|n| n.starts_with("auto-")).skip(KEEP_AUTO).cloned().collect();
    for n in &old {
        let _ = fs::remove_file(dir.join(n));
    }
    files.retain(|n| !old.contains(n));
    Ok(Backups { dir: dir.to_string_lossy().into_owned(), files })
}

#[tauri::command]
fn write_text(path: String, contents: String) -> Result<(), String> {
    // Only used for the JSON export; refuse anything else so a compromised page can't overwrite arbitrary files.
    if !path.to_lowercase().ends_with(".json") {
        return Err("write_text only writes .json files".into());
    }
    fs::write(path, contents).map_err(|e| e.to_string())
}

/// Validates `src` is a SQLite file and stages it; it replaces the live DB on next launch.
#[tauri::command]
fn stage_restore(app: AppHandle, src: String) -> Result<(), String> {
    let mut head = [0u8; 16];
    fs::File::open(&src).and_then(|mut f| f.read_exact(&mut head)).map_err(|e| e.to_string())?;
    if &head != b"SQLite format 3\0" {
        return Err("Not a SQLite database file.".into());
    }
    fs::copy(&src, config_dir(&app)?.join(PENDING)).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn restart_app(app: AppHandle) {
    app.restart();
}

fn apply_pending_restore(app: &AppHandle) -> Result<(), String> {
    let dir = config_dir(app)?;
    let pending = dir.join(PENDING);
    if pending.exists() {
        for ext in ["-wal", "-shm"] {
            let _ = fs::remove_file(dir.join(format!("{DB}{ext}")));
        }
        fs::rename(pending, dir.join(DB)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ---- Reviewer ---------------------------------------------------------------
// The command allowlist lives in its own file (not the DB) so backups can never carry or restore it.

const ALLOWLIST: &str = "review-allowlist.json";
const MAX_OUT: usize = 60_000;

fn load_allowlist(app: &AppHandle) -> HashMap<String, Vec<String>> {
    config_dir(app)
        .ok()
        .and_then(|d| fs::read_to_string(d.join(ALLOWLIST)).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

#[tauri::command]
fn get_allowlist(app: AppHandle, project_id: i64) -> Vec<String> {
    load_allowlist(&app).remove(&project_id.to_string()).unwrap_or_default()
}

#[tauri::command]
fn set_allowlist(app: AppHandle, project_id: i64, commands: Vec<String>) -> Result<(), String> {
    let mut all = load_allowlist(&app);
    let cleaned: Vec<String> = commands.into_iter().map(|c| c.trim().to_string()).filter(|c| !c.is_empty()).collect();
    all.insert(project_id.to_string(), cleaned);
    let dir = config_dir(&app)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    fs::write(dir.join(ALLOWLIST), serde_json::to_string_pretty(&all).unwrap()).map_err(|e| e.to_string())
}

fn cap(s: String) -> String {
    if s.chars().count() <= MAX_OUT {
        return s;
    }
    let mut t: String = s.chars().take(MAX_OUT).collect();
    t.push_str("\n...[truncated]");
    t
}

/// Runs `cmd` to completion (killed after `secs`), returning (exit code, stdout+stderr).
fn run_cmd(mut cmd: Command, stdin: Option<String>, secs: u64) -> Result<(i32, String), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    cmd.stdin(if stdin.is_some() { Stdio::piped() } else { Stdio::null() })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = cmd.spawn().map_err(|e| e.to_string())?;
    if let (Some(text), Some(mut si)) = (stdin, child.stdin.take()) {
        thread::spawn(move || {
            let _ = si.write_all(text.as_bytes());
        });
    }
    fn drain(mut r: impl Read + Send + 'static) -> thread::JoinHandle<String> {
        thread::spawn(move || {
            let mut b = Vec::new();
            let _ = r.read_to_end(&mut b);
            String::from_utf8_lossy(&b).into_owned()
        })
    }
    let out = drain(child.stdout.take().unwrap());
    let err = drain(child.stderr.take().unwrap());
    let deadline = Instant::now() + Duration::from_secs(secs);
    let code = loop {
        if let Some(st) = child.try_wait().map_err(|e| e.to_string())? {
            break st.code().unwrap_or(-1);
        }
        if Instant::now() > deadline {
            // `cmd /C claude` leaves claude running after cmd is killed (and holds our pipes open); kill the whole tree.
            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                let _ = Command::new("taskkill").args(["/PID", &child.id().to_string(), "/T", "/F"]).creation_flags(0x0800_0000).output();
            }
            let _ = child.kill();
            let _ = child.wait();
            return Err(format!("timed out after {secs}s"));
        }
        thread::sleep(Duration::from_millis(50));
    };
    let mut text = out.join().unwrap_or_default();
    text.push_str(&err.join().unwrap_or_default());
    Ok((code, cap(text)))
}

fn shell(command: &str) -> Command {
    #[cfg(windows)]
    {
        let mut c = Command::new("cmd");
        c.args(["/C", command]);
        c
    }
    #[cfg(not(windows))]
    {
        let mut c = Command::new("sh");
        c.args(["-c", command]);
        c
    }
}

#[derive(serde::Serialize)]
struct CmdResult {
    code: i32,
    output: String,
}

/// Runs a command only if it is exactly one of the project's allowlisted commands.
#[tauri::command]
async fn run_allowed(app: AppHandle, project_id: i64, repo: String, command: String) -> Result<CmdResult, String> {
    if !get_allowlist(app, project_id).contains(&command) {
        return Err("command is not on this project's allowlist".into());
    }
    if !PathBuf::from(&repo).is_dir() {
        return Err(format!("repo path is not a folder: {repo}"));
    }
    tauri::async_runtime::spawn_blocking(move || {
        let mut c = shell(&command);
        c.current_dir(&repo);
        run_cmd(c, None, 300).map(|(code, output)| CmdResult { code, output })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// `git status` + `git diff <base>` for the repo, minus secret-looking files. Untracked files are listed by name only.
#[tauri::command]
async fn repo_context(repo: String, base: String) -> Result<String, String> {
    let ok_ref = !base.is_empty() && !base.starts_with('-') && base.chars().all(|c| c.is_alphanumeric() || "._/~^@{}-".contains(c));
    if !ok_ref {
        return Err("invalid base ref".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let git = |args: &[&str]| {
            let mut c = Command::new("git");
            c.arg("-C").arg(&repo).args(args);
            run_cmd(c, None, 60)
        };
        let (code, status) = git(&["status", "--short"])?;
        if code != 0 {
            return Err(format!("not a git repo or git failed:\n{status}"));
        }
        let (code, diff) = git(&[
            "diff", "--no-ext-diff", "--no-textconv", &base, "--", ".", ":(exclude,glob)**/.env*", ":(exclude,glob)**/*.pem", ":(exclude,glob)**/*.key", ":(exclude,glob)**/id_rsa*",
        ])?;
        if code != 0 {
            return Err(format!("git diff {base} failed:\n{diff}"));
        }
        Ok(format!("## git status --short\n{status}\n## git diff {base}\n{diff}"))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// `claude` command. GUI apps on macOS/Linux don't inherit the terminal's PATH, so add the usual install dirs.
fn claude(args: &str) -> Command {
    #[allow(unused_mut)] // only mutated on non-Windows
    let mut c = shell(&format!("claude {args}"));
    #[cfg(not(windows))]
    {
        let home = std::env::var("HOME").unwrap_or_default();
        let extra = [format!("{home}/.local/bin"), format!("{home}/.claude/local"), format!("{home}/.npm-global/bin"), "/opt/homebrew/bin".into(), "/usr/local/bin".into()];
        let path = std::env::var("PATH").unwrap_or_default();
        c.env("PATH", format!("{}:{path}", extra.join(":")));
    }
    c
}

/// Returns the installed Claude Code version, or an error if the CLI is missing or broken.
#[tauri::command]
async fn claude_check() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(|| match run_cmd(claude("--version"), None, 20)? {
        (0, out) => Ok(out.trim().to_string()),
        (_, out) => Err(out.trim().to_string()),
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Runs `claude -p --output-format json` with the prompt on stdin and returns the answer text (the `result` field).
fn claude_text(prompt: String) -> Result<String, String> {
    let mut c = claude("-p --output-format json");
    c.current_dir(std::env::temp_dir());
    let (code, out) = run_cmd(c, Some(prompt), 240)?;
    if code != 0 {
        return Err(format!("claude exited with {code}: {out}"));
    }
    let v: serde_json::Value = serde_json::from_str(&out).map_err(|_| format!("claude CLI returned non-JSON output: {}", out.chars().take(200).collect::<String>()))?;
    match v["result"].as_str() {
        Some(t) if v["is_error"] != true => Ok(t.to_string()),
        _ => Err(format!("claude CLI error: {}", v["result"].as_str().unwrap_or(&out).chars().take(300).collect::<String>())),
    }
}

// ---- AI provider ---------------------------------------------------------------
// Settings and the API key live in their own file (not the DB), so backups and JSON exports can never carry the key.
// shortcut: the key is stored as plain text in the user's config dir (0600 on unix); move to the OS keychain if shared machines matter.

const AI_CONFIG: &str = "ai-config.json";

#[derive(serde::Serialize, serde::Deserialize, Default, Clone)]
struct AiConfig {
    provider: String, // "claude-cli" | "anthropic" | anything else = OpenAI-compatible at base_url
    base_url: String,
    model: String,
    api_key: String,
}

fn load_ai(app: &AppHandle) -> AiConfig {
    let mut c: AiConfig = config_dir(app)
        .ok()
        .and_then(|d| fs::read_to_string(d.join(AI_CONFIG)).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();
    if c.provider.is_empty() {
        c.provider = "claude-cli".into();
    }
    c
}

#[derive(serde::Serialize)]
struct AiPublic {
    provider: String,
    base_url: String,
    model: String,
    has_key: bool,
}

/// Never returns the key itself.
#[tauri::command]
fn ai_get_config(app: AppHandle) -> AiPublic {
    let c = load_ai(&app);
    AiPublic { provider: c.provider, base_url: c.base_url, model: c.model, has_key: !c.api_key.is_empty() }
}

fn is_local(url: &str) -> bool {
    let host = url.split("://").nth(1).unwrap_or("").split(['/', ':']).next().unwrap_or("");
    host == "localhost" || host == "127.0.0.1" || host == "[::1]"
}

/// `api_key`: Some(non-empty) replaces the key, None keeps it. Changing provider or URL without a new key clears it,
/// so a key can never be sent to a host it wasn't entered for.
#[tauri::command]
fn ai_set_config(app: AppHandle, provider: String, base_url: String, model: String, api_key: Option<String>, clear_key: bool) -> Result<(), String> {
    let old = load_ai(&app);
    let (base_url, model) = (base_url.trim().trim_end_matches('/').to_string(), model.trim().to_string());
    let moved = old.provider != provider || old.base_url != base_url;
    let key = match api_key.map(|k| k.trim().to_string()).filter(|k| !k.is_empty()) {
        Some(k) => k,
        None if clear_key || moved => String::new(),
        None => old.api_key,
    };
    if provider != "claude-cli" {
        if model.is_empty() {
            return Err("Model is required.".into());
        }
        if provider != "anthropic" && !(base_url.starts_with("https://") || base_url.starts_with("http://")) {
            return Err("Base URL must start with https:// (or http:// for a local server).".into());
        }
        if !key.is_empty() && base_url.starts_with("http://") && !is_local(&base_url) {
            return Err("Refusing to send an API key over plain http to a remote host. Use https://.".into());
        }
    }
    let dir = config_dir(&app)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(AI_CONFIG);
    fs::write(&path, serde_json::to_string_pretty(&AiConfig { provider, base_url, model, api_key: key }).unwrap()).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

fn http_json(req: ureq::Request, body: serde_json::Value) -> Result<serde_json::Value, String> {
    match req.send_json(body) {
        Ok(r) => r.into_json().map_err(|e| format!("bad response: {e}")),
        Err(ureq::Error::Status(code, r)) => Err(format!("HTTP {code}: {}", r.into_string().unwrap_or_default().chars().take(300).collect::<String>())),
        Err(e) => Err(e.to_string()),
    }
}

fn api_text(c: AiConfig, prompt: String) -> Result<String, String> {
    let agent = ureq::AgentBuilder::new().timeout(Duration::from_secs(240)).build();
    if c.provider == "anthropic" {
        let url = if c.base_url.is_empty() { "https://api.anthropic.com".to_string() } else { c.base_url };
        let v = http_json(
            agent.post(&format!("{url}/v1/messages")).set("x-api-key", &c.api_key).set("anthropic-version", "2023-06-01"),
            serde_json::json!({ "model": c.model, "max_tokens": 8192, "messages": [{ "role": "user", "content": prompt }] }),
        )?;
        let text: String = v["content"].as_array().map(|a| a.iter().filter_map(|b| b["text"].as_str()).collect()).unwrap_or_default();
        return if text.is_empty() { Err(format!("empty reply: {v}")) } else { Ok(text) };
    }
    let mut req = agent.post(&format!("{}/chat/completions", c.base_url));
    if !c.api_key.is_empty() {
        req = req.set("Authorization", &format!("Bearer {}", c.api_key));
    }
    let v = http_json(req, serde_json::json!({ "model": c.model, "messages": [{ "role": "user", "content": prompt }] }))?;
    match v["choices"][0]["message"]["content"].as_str() {
        Some(t) if !t.is_empty() => Ok(t.to_string()),
        _ => Err(format!("empty reply: {v}")),
    }
}

/// The one entry point for every AI feature: returns the model's reply text from whichever provider is configured.
#[tauri::command]
async fn ai_ask(app: AppHandle, prompt: String) -> Result<String, String> {
    let c = load_ai(&app);
    tauri::async_runtime::spawn_blocking(move || if c.provider == "claude-cli" { claude_text(prompt) } else { api_text(c, prompt) })
        .await
        .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            if let Err(e) = apply_pending_restore(app.handle()) {
                eprintln!("restore failed: {e}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![backups, write_text, stage_restore, restart_app, get_allowlist, set_allowlist, run_allowed, repo_context, claude_check, ai_get_config, ai_set_config, ai_ask])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
