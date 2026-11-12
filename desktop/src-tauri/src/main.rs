// ccp-observe desktop shell.
//
// The Rust side does exactly three things, matching the product brief:
//   1. start / stop the local Python proxy as a child process;
//   2. own the tray icon (show / hide the panel, quit = stop the proxy);
//   3. open the panel window.
//
// Everything else — routing, stats, truncation detection — lives in the
// proxy. The window is a plain WebView pointing at the panel it serves, so
// no Tauri IPC is exposed to page content.

// Release builds are a GUI app: without this the linker emits a console
// subsystem binary, so launching from the Start Menu / Desktop shortcut pops
// an empty cmd window. Debug builds keep the console for log output.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{BufRead, BufReader, Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

/// Where the panel is served by the proxy. The tray and the window both read
/// the same value, so they cannot disagree.
const HOST: &str = "127.0.0.1";
const DEFAULT_PORT: u16 = 8787;

/// `CCP_PORT` lets the app dodge a port already taken by something else. It is
/// read once per call so the child process, the readiness probe and the window
/// URL all see the same number.
fn proxy_port() -> u16 {
    std::env::var("CCP_PORT")
        .ok()
        .and_then(|v| v.trim().parse().ok())
        .unwrap_or(DEFAULT_PORT)
}

fn panel_url() -> String {
    format!("http://{HOST}:{}/_ccp/", proxy_port())
}

/// Set once the proxy reports its real URL — it walks forward from the
/// requested port when that one is taken, so the window must follow the
/// handshake rather than assume `proxy_port()` bound successfully.
static PANEL_URL: Mutex<Option<String>> = Mutex::new(None);

fn resolved_panel_url() -> String {
    PANEL_URL
        .lock()
        .ok()
        .and_then(|guard| guard.clone())
        .unwrap_or_else(panel_url)
}

/// Holds the proxy child so the tray "quit" handler can stop it cleanly.
struct ProxyProcess(Mutex<Option<Child>>);

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[cfg(windows)]
fn hide_console(cmd: &mut Command) {
    use std::os::windows::process::CommandExt;
    cmd.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn hide_console(_cmd: &mut Command) {}

/// One way to invoke a Python 3 interpreter: a program plus fixed leading
/// args. `py` needs `-3`; a direct `python.exe` path needs nothing.
#[derive(Clone, Debug)]
struct PythonCmd {
    program: String,
    prefix: Vec<String>,
}

impl PythonCmd {
    fn new(program: impl Into<String>, prefix: &[&str]) -> Self {
        Self {
            program: program.into(),
            prefix: prefix.iter().map(|s| s.to_string()).collect(),
        }
    }

    fn label(&self) -> String {
        if self.prefix.is_empty() {
            self.program.clone()
        } else {
            format!("{} {}", self.program, self.prefix.join(" "))
        }
    }

    /// Run `<interp> [prefix] --version` and require a real Python 3.
    ///
    /// This is the check that matters on Windows: `python.exe` in
    /// `%LOCALAPPDATA%\Microsoft\WindowsApps` is an App Execution Alias stub
    /// that prints "Python was not found" and exits 49. It spawns fine, so
    /// spawning alone proves nothing.
    fn works(&self) -> bool {
        let mut cmd = Command::new(&self.program);
        cmd.args(&self.prefix)
            .arg("--version")
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        hide_console(&mut cmd);
        match cmd.output() {
            Ok(out) => {
                let text = format!(
                    "{}{}",
                    String::from_utf8_lossy(&out.stdout),
                    String::from_utf8_lossy(&out.stderr)
                )
                .to_lowercase();
                out.status.success() && text.contains("python 3")
            }
            Err(_) => false,
        }
    }
}

/// Every place a usable interpreter might live, most explicit first.
fn python_candidates() -> Vec<PythonCmd> {
    let mut out: Vec<PythonCmd> = Vec::new();

    if let Ok(explicit) = std::env::var("CCP_PYTHON") {
        let explicit = explicit.trim();
        if !explicit.is_empty() {
            out.push(PythonCmd::new(explicit, &[]));
        }
    }

    if cfg!(windows) {
        // `py` is the launcher and is not affected by the Store alias.
        out.push(PythonCmd::new("py", &["-3"]));
        out.push(PythonCmd::new("python", &[]));
        out.push(PythonCmd::new("python3", &[]));
        out.extend(installed_pythons());
    } else {
        out.push(PythonCmd::new("python3", &[]));
        out.push(PythonCmd::new("python", &[]));
    }

    out
}

/// Discover interpreters in the usual Windows install roots, newest first.
#[cfg(windows)]
fn installed_pythons() -> Vec<PythonCmd> {
    let mut roots: Vec<PathBuf> = Vec::new();
    for var in ["LOCALAPPDATA", "ProgramFiles", "ProgramFiles(x86)"] {
        if let Ok(base) = std::env::var(var) {
            let base = PathBuf::from(base);
            roots.push(base.join("Programs").join("Python"));
            roots.push(base.join("Python"));
        }
    }

    let mut found: Vec<(u32, PathBuf)> = Vec::new();
    for root in roots {
        let Ok(entries) = std::fs::read_dir(&root) else { continue };
        for entry in entries.flatten() {
            let dir = entry.path();
            let exe = dir.join("python.exe");
            if !exe.is_file() {
                continue;
            }
            let name = dir.file_name().and_then(|n| n.to_str()).unwrap_or("");
            let version: u32 = name
                .chars()
                .filter(|c| c.is_ascii_digit())
                .collect::<String>()
                .parse()
                .unwrap_or(0);
            found.push((version, exe));
        }
    }
    // Python314 before Python313 before Python39.
    found.sort_by(|a, b| b.0.cmp(&a.0));
    found
        .into_iter()
        .map(|(_, exe)| PythonCmd::new(exe.to_string_lossy().to_string(), &[]))
        .collect()
}

#[cfg(not(windows))]
fn installed_pythons() -> Vec<PythonCmd> {
    Vec::new()
}

/// First interpreter that actually reports itself as Python 3.
fn pick_python() -> Result<PythonCmd, String> {
    let candidates = python_candidates();
    let mut tried = Vec::new();
    for candidate in &candidates {
        if candidate.works() {
            return Ok(candidate.clone());
        }
        tried.push(candidate.label());
    }
    Err(format!(
        "找不到可用的 Python 3。已尝试：{}。请安装 Python 3.9+，或把 CCP_PYTHON 指向解释器的绝对路径（例如 \
         C:\\Users\\you\\AppData\\Local\\Programs\\Python\\Python313\\python.exe）。",
        tried.join(" / ")
    ))
}

/// Append a line to the desktop log so a failed start leaves evidence.
fn log_line(log: Option<&Path>, line: &str) {
    // Release builds are GUI subsystem: there is no attached console, and
    // println! would fail on the invalid stdout handle.
    if cfg!(debug_assertions) {
        println!("[ccp-observe] {line}");
    }
    let Some(path) = log else { return };
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
    {
        // One write call per line: the proxy's stdout and stderr are logged
        // from two threads and appending half a line would interleave them.
        let _ = file.write_all(format!("{line}\n").as_bytes());
    }
}

/// Locate the proxy directory at runtime. Order of precedence:
///   1. CCP_PROXY_DIR (explicit override / CI);
///   2. the `proxy/` resource shipped inside the installed app — Tauri keeps
///      resource paths relative to src-tauri, so check each shape it can
///      produce before falling back;
///   3. `<repo>/proxy` next to src-tauri (when running `tauri dev`).
fn resolve_proxy_dir(app: &AppHandle) -> PathBuf {
    if let Ok(dir) = std::env::var("CCP_PROXY_DIR") {
        return PathBuf::from(dir);
    }
    if let Ok(res) = app.path().resource_dir() {
        for candidate in [
            res.join("proxy"),
            res.join("resources").join("proxy"),
            res.join("_up_").join("resources").join("proxy"),
        ] {
            if candidate.join("proxy.py").exists() {
                return candidate;
            }
        }
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("proxy")
}

/// Spawn `python proxy.py` and wait (briefly) for its `CCP_READY` handshake.
///
/// Returns `Ok(None)` when an already-running ccp-observe was found and no
/// child was started — two copies fighting over the same state directory is
/// worse than reusing the one that is up.
fn spawn_proxy(dir: PathBuf, log: Option<PathBuf>) -> Result<Option<Child>, String> {
    let script = dir.join("proxy.py");
    if !script.exists() {
        return Err(format!("找不到代理脚本: {}", script.display()));
    }

    // Someone (the user, or a previous run of the tray app) may already be
    // serving our panel. Reuse it instead of spawning a second sidecar.
    if let Some(port) = find_panel_port() {
        let url = format!("http://{HOST}:{port}/_ccp/");
        log_line(log.as_deref(), &format!("found running proxy at {url}; reusing it"));
        if let Ok(mut guard) = PANEL_URL.lock() {
            *guard = Some(url);
        }
        return Ok(None);
    }

    let python = pick_python().map_err(|err| {
        log_line(log.as_deref(), &err);
        err
    })?;
    log_line(log.as_deref(), &format!("using python: {}", python.label()));

    let port = proxy_port();
    let mut cmd = Command::new(&python.program);
    cmd.args(&python.prefix)
        .arg(&script)
        .arg("--host")
        .arg(HOST)
        .arg("--port")
        .arg(port.to_string())
        .current_dir(&dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    hide_console(&mut cmd);

    let mut child = cmd.spawn().map_err(|e| {
        let msg = format!("无法启动 Python 代理（{}）: {e}", python.label());
        log_line(log.as_deref(), &msg);
        msg
    })?;

    let stdout = match child.stdout.take() {
        Some(pipe) => pipe,
        None => return Err("无法读取代理输出".to_string()),
    };
    let stderr = child.stderr.take();

    let (tx, rx): (_, Receiver<String>) = mpsc::channel();
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines().map_while(Result::ok) {
            if line.contains("CCP_READY") {
                let _ = tx.send(line);
            }
        }
    });

    // Keep the tail of stderr so a crash can be explained instead of guessed.
    let tail: std::sync::Arc<Mutex<Vec<String>>> = std::sync::Arc::new(Mutex::new(Vec::new()));
    if let Some(stderr) = stderr {
        let tail = tail.clone();
        let log = log.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines().map_while(Result::ok) {
                log_line(log.as_deref(), &format!("stderr: {line}"));
                if let Ok(mut buf) = tail.lock() {
                    buf.push(line);
                    if buf.len() > 12 {
                        buf.remove(0);
                    }
                }
            }
        });
    }
    let tail_text = || {
        tail.lock()
            .ok()
            .map(|buf| buf.join("\n"))
            .filter(|s| !s.trim().is_empty())
    };

    match rx.recv_timeout(Duration::from_secs(20)) {
        Ok(line) => {
            log_line(log.as_deref(), &format!("proxy ready: {line}"));
            if let Some(url) = url_from_handshake(&line) {
                if let Ok(mut guard) = PANEL_URL.lock() {
                    *guard = Some(url);
                }
            }
            Ok(Some(child))
        }
        Err(RecvTimeoutError::Timeout) => {
            if let Some(port) = find_panel_port() {
                // Nothing on stdout, but *our* panel answers — treat it as up.
                log_line(log.as_deref(), &format!("panel found on port {port}; reusing it"));
                if let Ok(mut guard) = PANEL_URL.lock() {
                    *guard = Some(format!("http://{HOST}:{port}/_ccp/"));
                }
                Ok(Some(child))
            } else {
                let _ = child.kill();
                let detail = tail_text().unwrap_or_default();
                let msg = format!(
                    "代理未能在 20 秒内就绪（端口 {port}）。{}",
                    if detail.is_empty() {
                        "代理没有输出任何错误，可能卡在启动阶段。".to_string()
                    } else {
                        format!("代理输出：\n{detail}")
                    }
                );
                log_line(log.as_deref(), &msg);
                Err(msg)
            }
        }
        Err(RecvTimeoutError::Disconnected) => match find_panel_port() {
            Some(port) => {
                if let Ok(mut guard) = PANEL_URL.lock() {
                    *guard = Some(format!("http://{HOST}:{port}/_ccp/"));
                }
                Ok(Some(child))
            }
            None => {
                let _ = child.kill();
                let detail = tail_text()
                    .map(|d| format!("代理输出：\n{d}"))
                    .unwrap_or_else(|| "代理进程没有输出就退出了。".to_string());
                let msg = format!("代理进程提前退出。{detail}");
                log_line(log.as_deref(), &msg);
                Err(msg)
            }
        },
    }
}

/// True only when the thing listening on our port is ccp-observe itself.
///
/// A bare TCP connect is not enough: if the port is taken by an unrelated
/// service the proxy dies, yet the port still accepts connections — and the
/// window would then point at that stranger's UI. Instead, ask the panel API
/// for `/healthz` and require the body `{"ok": true, ...}` that only our proxy
/// sends.
fn panel_responds_at(port: u16) -> bool {
    let addr: SocketAddr = match format!("{HOST}:{port}").parse() {
        Ok(a) => a,
        Err(_) => return false,
    };
    let mut stream = match TcpStream::connect_timeout(&addr, Duration::from_millis(400)) {
        Ok(s) => s,
        Err(_) => return false,
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(1500)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(1500)));
    let request = format!(
        "GET /healthz HTTP/1.1\r\nHost: {HOST}:{port}\r\nConnection: close\r\nAccept: */*\r\n\r\n"
    );
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }
    let mut response = String::new();
    if stream.take(4096).read_to_string(&mut response).is_err() {
        return false;
    }
    response.contains("200") && response.contains("\"ok\": true")
}

/// Pull `http://127.0.0.1:PORT/_ccp/` out of the `CCP_READY ...` line.
fn url_from_handshake(line: &str) -> Option<String> {
    line.split_whitespace()
        .find(|token| token.starts_with("http://") && token.contains("/_ccp/"))
        .map(|token| token.to_string())
}

/// Scan the same forward range the proxy walks, looking for *our* panel.
///
/// Used only when the handshake never arrives; the proxy may still have come
/// up on a later port than the one we asked for.
fn find_panel_port() -> Option<u16> {
    let start = proxy_port();
    (start..start.saturating_add(20)).find(|port| panel_responds_at(*port))
}

fn toggle_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let visible = win.is_visible().unwrap_or(false);
        if visible {
            let _ = win.hide();
        } else {
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "打开面板", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", "隐藏窗口", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出（停止代理）", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &hide, &quit])?;

    let icon = tauri::include_image!("icons/32x32.png");

    TrayIconBuilder::new()
        .tooltip("ccp-observe")
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
            "hide" => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.hide();
                }
            }
            "quit" => {
                stop_proxy(app);
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            // Left click toggles the panel, matching Clash Verge.
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_window(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

fn stop_proxy(app: &AppHandle) {
    if let Some(state) = app.try_state::<ProxyProcess>() {
        if let Ok(mut guard) = state.0.lock() {
            if let Some(mut child) = guard.take() {
                let _ = child.kill();
                let _ = child.wait();
                if cfg!(debug_assertions) {
                    println!("[ccp-observe] proxy stopped");
                }
            }
        }
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Persist config in the user's profile rather than the install
            // directory (which may be read-only). The proxy honours this.
            let cfg_dir = app.path().app_config_dir().ok();
            let log_path = cfg_dir.as_ref().map(|d| d.join("desktop.log"));
            if let Some(dir) = &cfg_dir {
                std::env::set_var("CCP_STATE_DIR", dir.join("state"));
                let _ = std::fs::create_dir_all(dir);
            }
            if let Some(log) = &log_path {
                let _ = std::fs::write(
                    log,
                    format!("ccp-observe desktop {}\n", env!("CARGO_PKG_VERSION")),
                );
            }

            // 1) Start the proxy. If it fails we still open a window — as a
            //    local page that explains how to fix it — so the user is
            //    never left staring at a silent tray icon.
            let dir = resolve_proxy_dir(app.handle());
            log_line(log_path.as_deref(), &format!("proxy dir: {}", dir.display()));
            let mut failure: Option<String> = None;
            let started = match spawn_proxy(dir, log_path.clone()) {
                Ok(child) => {
                    app.manage(ProxyProcess(Mutex::new(child)));
                    true
                }
                Err(err) => {
                    log_line(log_path.as_deref(), &err);
                    failure = Some(err);
                    app.manage(ProxyProcess(Mutex::new(None)));
                    false
                }
            };

            // 2) Panel window. When the proxy is up the window is the panel
            //    itself; otherwise it is the bundled troubleshooting page,
            //    pre-loaded with whatever went wrong.
            let live_port = find_panel_port();
            if let (true, Some(port)) = (started, live_port) {
                if let Ok(mut guard) = PANEL_URL.lock() {
                    *guard = Some(format!("http://{HOST}:{port}/_ccp/"));
                }
            }
            let mut builder = WebviewWindowBuilder::new(
                app,
                "main",
                match (started, live_port) {
                    (true, Some(_)) => WebviewUrl::External(resolved_panel_url().parse()?),
                    _ => WebviewUrl::App("index.html".into()),
                },
            )
            .title("ccp-observe · AI 编码代理观测面板")
            .inner_size(1440.0, 900.0)
            .min_inner_size(1024.0, 660.0);

            if let (false, Some(err)) = (started, failure.as_ref()) {
                let detail = match log_path.as_ref() {
                    Some(p) => format!("{err}\n\n详细日志：{}", p.display()),
                    None => err.clone(),
                };
                // Runs before the page's own scripts, so index.html can render
                // the real reason instead of a generic guess.
                builder = builder.initialization_script(&format!(
                    "window.__CCP_DIAG = {};",
                    serde_json::to_string(&detail).unwrap_or_else(|_| "\"\"".to_string())
                ));
            }
            builder.build()?;

            // 3) Tray icon.
            build_tray(app.handle())?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building ccp-observe desktop")
        .run(|app, event| {
            if let RunEvent::ExitRequested { .. } = event {
                stop_proxy(app);
            }
        });
}
