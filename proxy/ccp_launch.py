# -*- coding: utf-8 -*-
"""`ccp` — run Claude Code or Codex through ccp-observe, with zero configuration.

What a user expects after installing: open a terminal, type ``ccp``, and their
existing client setup keeps working — same gateway, same key, same model
choices — except it now goes through the local proxy so the panel has data.

Both clients are supported. Whichever is installed is used automatically; when
both are, the first run asks once and the answer is remembered.

To make that true this launcher does five things:

1. reads the user's Claude Code settings (``~/.claude/settings.json``) and/or
   Codex configuration (``~/.codex/config.toml`` + ``auth.json``) and imports
   the gateway + credential into ccp-observe as providers, once;
2. finds a running ccp-observe, or starts one detached on a free port;
3. resolves which client to run (explicit arg > remembered > only one > ask);
4. points that client at the port — Claude via ``--settings``, Codex via ``-c``
   overrides, so neither user's own config file is modified;
5. execs it and passes every argument through.

The proxy is left running afterwards on purpose: the next ``ccp`` reuses it,
and the panel keeps accumulating history while the user works.

Usage::

    ccp                       # 自动选择客户端（claude / codex），然后启动
    ccp claude                # 明确用 Claude Code
    ccp codex                 # 明确用 Codex
    ccp --continue            # 任何客户端参数原样透传
    ccp --agent list          # 看已安装的客户端与当前默认
    ccp --doctor              # 只做检查，不启动客户端
    ccp --no-launch           # 只确保代理在跑
    ccp --reimport            # 用 settings.json 覆盖已导入的供应商
"""

from __future__ import annotations

import argparse
import getpass
import glob
import io
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from urllib.parse import urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from ccp import claude_env, codex_env, discover  # noqa: E402
from ccp.config import ConfigStore  # noqa: E402

APP_ID = "com.ccpobserve.desktop"
DEFAULT_PORT = 8787
PORT_TRIES = 20
READY_TIMEOUT = 20.0


# --------------------------------------------------------------------- paths

def state_dir() -> str:
    """Share state with the desktop app so both see one configuration."""
    override = os.environ.get("CCP_STATE_DIR")
    if override:
        return os.path.abspath(override)
    if sys.platform == "win32":
        base = os.environ.get("APPDATA") or os.path.expanduser("~")
        return os.path.join(base, APP_ID, "state")
    if sys.platform == "darwin":
        return os.path.expanduser("~/Library/Application Support/%s/state" % APP_ID)
    return os.path.expanduser("~/.config/%s/state" % APP_ID)


def log_path() -> str:
    return os.path.join(os.path.dirname(state_dir()), "proxy.log")


def _print(line: str = "") -> None:
    print(line, flush=True)


# ------------------------------------------------------------------- python

def _python_works(program: str, prefix: list[str]) -> bool:
    try:
        out = subprocess.run(
            [program, *prefix, "--version"],
            capture_output=True, text=True, timeout=15,
        )
    except (OSError, subprocess.SubprocessError):
        return False
    text = (out.stdout + out.stderr).lower()
    return out.returncode == 0 and "python 3" in text


def find_python() -> list[str] | None:
    """Command prefix that runs Python 3, or ``None``.

    ``python`` on Windows may be the Microsoft Store stub, which spawns fine
    and then exits 49 — so every candidate is checked by actually running it.
    """
    candidates: list[list[str]] = []
    explicit = (os.environ.get("CCP_PYTHON") or "").strip()
    if explicit:
        candidates.append([explicit])
    if sys.platform == "win32":
        candidates.append(["py", "-3"])
        candidates.append(["python"])
        candidates.append(["python3"])
        for pattern in (
            os.path.join(os.environ.get("LOCALAPPDATA", ""), "Programs", "Python", "Python3*", "python.exe"),
            os.path.join(os.environ.get("ProgramFiles", ""), "Python", "Python3*", "python.exe"),
        ):
            for exe in sorted(glob.glob(pattern), reverse=True):
                candidates.append([exe])
    else:
        candidates.append(["python3"])
        candidates.append(["python"])
    for candidate in candidates:
        if not candidate[0]:
            continue
        if _python_works(candidate[0], candidate[1:]):
            return candidate
    return None


# -------------------------------------------------------------------- proxy

def _http_json(url: str, timeout: float = 2.0, payload: dict | None = None) -> dict | None:
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {"Content-Type": "application/json"} if data else {}
    req = urllib.request.Request(url, data=data, headers=headers,
                                 method="POST" if data else "GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8", "replace"))
    except (urllib.error.URLError, OSError, ValueError):
        return None


def is_ccp_at(port: int) -> bool:
    """True only when *our* proxy answers — other services can own a port."""
    health = _http_json("http://127.0.0.1:%d/healthz" % port)
    if not health or not health.get("ok"):
        return False
    selftest = _http_json("http://127.0.0.1:%d/_ccp/api/selftest" % port)
    return bool(selftest and "checks" in selftest)


def find_running(start: int = DEFAULT_PORT) -> int | None:
    for port in range(start, start + PORT_TRIES):
        if is_ccp_at(port):
            return port
    return None


def start_proxy(python: list[str], port: int) -> tuple[int | None, str]:
    """Spawn a detached proxy and wait for it to answer.

    Returns ``(port, error)``. The proxy walks forward when the requested port
    is taken, so the caller looks at the whole range rather than at ``port``.
    """
    script = None
    for name in ("proxy.py",):
        candidate = os.path.join(HERE, name)
        if os.path.isfile(candidate):
            script = candidate
            break
    if not script:
        return None, "找不到 proxy.py（安装目录可能不完整）"

    log = log_path()
    os.makedirs(os.path.dirname(log), exist_ok=True)
    env = dict(os.environ)
    env["CCP_STATE_DIR"] = state_dir()
    env["PYTHONUTF8"] = "1"

    kwargs: dict = {
        "stdin": subprocess.DEVNULL,
        "env": env,
        "cwd": HERE,
        "close_fds": True,
    }
    if os.name == "nt":
        # Detached + no window: the proxy outlives this console.
        kwargs["creationflags"] = 0x00000008 | 0x00000200 | 0x08000000
        kwargs["stdout"] = open(log, "ab")
        kwargs["stderr"] = subprocess.STDOUT
    else:
        kwargs["start_new_session"] = True
        kwargs["stdout"] = open(log, "ab")
        kwargs["stderr"] = subprocess.STDOUT

    try:
        subprocess.Popen([*python, script, "--port", str(port)], **kwargs)
    except OSError as exc:
        return None, "无法启动代理：%s" % exc

    deadline = time.time() + READY_TIMEOUT
    while time.time() < deadline:
        found = find_running(port)
        if found:
            return found, ""
        time.sleep(0.3)
    return None, "代理在 %.0f 秒内没有就绪，日志：%s" % (READY_TIMEOUT, log)


def sync_running(port: int, store: ConfigStore) -> None:
    """Push the store's providers/routes into an already running proxy.

    The proxy may have been started by an earlier `ccp` run, before the provider
    we just imported existed. It hot-reloads config through the panel API.
    """
    cfg = store.get()
    if not (cfg.get("providers") or cfg.get("upstream")):
        return
    _http_json(
        "http://127.0.0.1:%d/_ccp/api/config" % port,
        payload={
            "providers": cfg.get("providers") or [],
            "default_provider": cfg.get("default_provider") or "",
            "routes": cfg.get("routes") or [],
        },
    )


# ----------------------------------------------------------------- providers

def preferred_agent_hint(known_agent: str | None, passthrough: list[str]) -> str | None:
    """The client this run will most likely use, without prompting."""
    available = installed_agents()
    for name in (known_agent,
                 passthrough[0] if passthrough else None,
                 read_last_agent()):
        if name in AGENTS and name in available:
            return name
    if len(available) == 1:
        return available[0]
    return None


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9_-]+", "-", str(text or "").lower()).strip("-") or "manual-upstream"


def _interactive() -> bool:
    try:
        return bool(sys.stdin is not None and sys.stdin.isatty())
    except (AttributeError, io.UnsupportedOperation):
        return False


def first_run_provider(agent: str | None) -> dict | None:
    """Ask for one upstream when neither client has a configuration.

    This is the one case auto-import cannot cover: a brand-new machine. Asking
    two questions here is much cheaper than launching the client into a
    guaranteed ``upstream_not_configured`` error and making the user find the
    panel first.
    """
    if not _interactive():
        return None
    _print("[ccp] 没有在 Claude Code / Codex 的配置里找到上游地址。")
    _print("      填一个 Base URL 就能用；回车跳过则之后在面板里配置。")
    try:
        base = input("      上游 Base URL: ").strip()
    except (EOFError, KeyboardInterrupt):
        _print()
        return None
    if not base:
        return None
    default_protocol = "openai" if agent == "codex" else "anthropic"
    try:
        raw = input("      协议 [anthropic/openai]（回车=%s）: " % default_protocol).strip().lower()
    except (EOFError, KeyboardInterrupt):
        _print()
        return None
    protocol = raw if raw in ("anthropic", "openai") else default_protocol
    try:
        key = getpass.getpass("      密钥（可直接粘贴完整 Authorization 头，回车跳过）: ").strip()
    except (EOFError, KeyboardInterrupt):
        _print()
        key = ""
    auth = ""
    if key:
        auth = key if ":" in key.split(" ", 1)[0] else "Authorization: Bearer %s" % key
    host = urlparse(base).netloc or base
    return {
        "id": "manual-" + _slug(host),
        "name": host,
        "protocol": protocol,
        "base_url": base.rstrip("/"),
        "auth_header": auth,
        "models": [],
        "enabled": True,
        "note": "首次运行时填写",
    }


def ensure_agent_route(store: ConfigStore, agent: str, provider: dict | None) -> bool:
    """Add a path rule when the default provider speaks the wrong protocol.

    Codex sends Responses API requests, which cannot be translated from an
    Anthropic provider — without a rule it would fail with
    ``ccp_unsupported_translation``. The rule is appended, so any rule the
    user wrote in the panel still wins.
    """
    if not provider or not provider.get("id"):
        return False
    cfg = store.get()
    providers = cfg.get("providers") or []
    default = next((p for p in providers
                    if p.get("id") == cfg.get("default_provider")), {})
    default_protocol = (default.get("protocol") or "auto").lower()
    if agent == "codex":
        needed = default_protocol != "openai"
        pattern = "/v1/responses*"
    else:
        needed = default_protocol == "openai"
        pattern = "/v1/messages*"
    if not needed:
        return False
    routes = list(cfg.get("routes") or [])
    if any(r.get("match") == pattern and r.get("provider") == provider["id"]
           for r in routes):
        return False
    routes.append({"match": pattern, "provider": provider["id"]})
    store.save({"routes": routes})
    return True


# ------------------------------------------------------------------- agents
#
# Two clients, two very different integration surfaces:
#
# * Claude Code has `--settings <file>`, so the override is a temp JSON and
#   the user's own settings still merge on top.
# * Codex has `-c key=value` (dotted TOML path). Its provider block is passed
#   on the command line, which leaves ~/.codex/config.toml untouched — the
#   same promise as Claude's --settings.
#
# Codex only speaks `wire_api = "responses"` (0.16x dropped "chat"), and it
# always sends a `web_search` tool which most OpenAI-compatible gateways
# reject, so web_search is pinned to "disabled" in the override.

AGENTS = ("claude", "codex")

AGENT_LABEL = {"claude": "Claude Code", "codex": "Codex"}


def find_agent(agent: str) -> str | None:
    """Resolve an agent's executable on PATH, or ``None``."""
    names = {
        "claude": ("claude.cmd", "claude.exe", "claude"),
        "codex": ("codex.cmd", "codex.exe", "codex"),
    }.get(agent, ())
    if os.name != "nt":
        names = tuple(n for n in names if not n.endswith(".cmd") and not n.endswith(".exe"))
    for name in names:
        found = shutil.which(name)
        if found:
            return found
    return None


def installed_agents() -> list[str]:
    return [a for a in AGENTS if find_agent(a)]


def agent_state_path() -> str:
    return os.path.join(state_dir(), "agent.json")


def read_last_agent() -> str | None:
    try:
        with open(agent_state_path(), "r", encoding="utf-8") as fh:
            value = (json.load(fh) or {}).get("last_agent")
    except (OSError, ValueError):
        return None
    return value if value in AGENTS else None


def remember_agent(agent: str) -> None:
    """Persist the choice; a failure here must never block a launch."""
    try:
        path = agent_state_path()
        os.makedirs(os.path.dirname(path), exist_ok=True)
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump({"last_agent": agent}, fh, ensure_ascii=False, indent=2)
        os.replace(tmp, path)
    except OSError:
        pass


def choose_agent(passthrough: list[str]) -> tuple[str, list[str]] | None:
    """Work out which client to run. Returns ``(agent, remaining_args)``.

    Precedence: an explicit first argument > the remembered choice > the only
    installed client > a one-time prompt. A bare `ccp` therefore never asks
    twice, and never asks at all when only one client is installed.
    """
    available = installed_agents()

    # 1) `ccp codex ...` — only when that agent is actually installed, so a
    #    prompt that happens to start with the word stays a prompt.
    if passthrough and passthrough[0] in AGENTS and passthrough[0] in available:
        agent = passthrough[0]
        remember_agent(agent)
        return agent, passthrough[1:]

    # 2) Remembered choice, still installed.
    last = read_last_agent()
    if last and last in available:
        return last, passthrough

    # 3) Exactly one client installed: use it silently.
    if len(available) == 1:
        remember_agent(available[0])
        return available[0], passthrough

    if not available:
        _print("[ccp] 没有找到 claude 或 codex。")
        _print("      安装其中一个后重试：npm i -g @anthropic-ai/claude-code  /  npm i -g @openai/codex")
        return None

    # 4) Both installed, nothing remembered. Ask once.
    choice = prompt_agent(available)
    if not choice:
        # Non-interactive stdin (a script, an IDE task runner) must not dead-end
        # on a question nobody can answer: fall back to the first available,
        # which is claude and therefore the historical behaviour.
        _print("[ccp] 无法交互选择，本次使用 %s。" % AGENT_LABEL[available[0]])
        return available[0], passthrough
    remember_agent(choice)
    return choice, passthrough


def prompt_agent(available: list[str]) -> str | None:
    """Ask which client to run. Returns ``None`` when it cannot ask."""
    interactive = True
    try:
        interactive = sys.stdin is not None and sys.stdin.isatty()
    except (AttributeError, io.UnsupportedOperation):
        interactive = False
    if not interactive:
        return None
    _print("[ccp] 检测到多个客户端，这次用哪个？（回车默认 %s，记忆到下次）"
           % AGENT_LABEL[available[0]])
    for idx, name in enumerate(available, 1):
        _print("      %d) %s" % (idx, AGENT_LABEL[name]))
    try:
        raw = input("> ").strip()
    except (EOFError, KeyboardInterrupt):
        _print()
        return None
    if not raw:
        return available[0]
    if raw.isdigit() and 1 <= int(raw) <= len(available):
        return available[int(raw) - 1]
    lowered = raw.lower()
    for name in available:
        if lowered in (name, AGENT_LABEL[name].lower()):
            return name
    return available[0]


# ------------------------------------------------------------------- claude

def write_override(port: int) -> str:
    """Settings fragment that only redirects the base URL.

    Everything else in the user's settings (model choices, timeouts,
    permissions) keeps applying, because Claude Code merges this file on top.
    """
    path = os.path.join(os.path.dirname(state_dir()), "claude-proxy.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump({"env": {"ANTHROPIC_BASE_URL": "http://127.0.0.1:%d" % port}},
                  fh, ensure_ascii=False, indent=2)
    return path


def find_claude() -> str | None:
    return find_agent("claude")


def launch_claude(claude: str, settings: str, args: list[str]) -> int:
    cmd = [claude, "--settings", settings, *args]
    try:
        return subprocess.call(cmd)
    except KeyboardInterrupt:
        return 130


# -------------------------------------------------------------------- codex

def codex_base_url(port: int) -> str:
    return "http://127.0.0.1:%d/v1" % port


def codex_overrides(port: int) -> list[str]:
    """`-c` flags that point Codex at the proxy without editing its config.

    `env_key` names a variable the launcher also sets, so Codex is satisfied
    that a credential exists; the proxy replaces the Authorization header with
    the provider's own. `model_provider`/`model` are left to the user's config
    unless they would be overridden by our provider block — Codex needs *some*
    provider, and inheriting the user's model keeps their setup intact.
    """
    return [
        "-c", 'model_provider="ccp"',
        "-c", 'model_providers.ccp.name="ccp-observe"',
        "-c", 'model_providers.ccp.base_url="%s"' % codex_base_url(port),
        "-c", 'model_providers.ccp.env_key="CCP_PROXY_KEY"',
        "-c", 'model_providers.ccp.wire_api="responses"',
        # Most OpenAI-compatible gateways reject Codex's built-in web_search
        # tool; disable it or every request 400s.
        "-c", 'web_search="disabled"',
    ]


def launch_codex(codex: str, port: int, args: list[str]) -> int:
    cmd = [codex, *codex_overrides(port), *args]
    env = dict(os.environ)
    env.setdefault("CCP_PROXY_KEY", "ccp-proxy-placeholder")
    try:
        return subprocess.call(cmd, env=env)
    except KeyboardInterrupt:
        return 130


# -------------------------------------------------------------------- report

def doctor(python: list[str] | None, port: int | None, imported: dict,
           env: dict, claude: str | None, last_agent: str | None = None) -> int:
    info = claude_env.describe(env)
    codex_info = codex_env.describe()
    codex = find_agent("codex")
    rows = [
        ("Python", " ".join(python) if python else "未找到（需要 Python 3.9+ 或设置 CCP_PYTHON）"),
        ("Claude Code", claude or "未找到（请先安装 claude）"),
        ("Codex", codex or "未找到（请先安装 codex）"),
        ("默认客户端", AGENT_LABEL.get(last_agent or "", "未选择（下次运行时决定）")),
        ("配置目录", info["claude_home"]),
        ("状态目录", state_dir()),
        ("代理", "http://127.0.0.1:%d/_ccp/" % port if port else "未运行"),
        ("Claude 上游", info["upstream"] or "未找到（settings.json 里没有 ANTHROPIC_BASE_URL）"),
        ("Codex 上游", codex_info["upstream"] or "未找到（config.toml 里没有 model_providers 地址）"),
        ("供应商 id", ", ".join(x for x in (info["provider_id"],
                                            "codex-" + codex_info["provider_id"]
                                            if codex_info["provider_id"] else "") if x) or "—"),
        ("鉴权", "Claude：%s；Codex：%s" % (info["auth"], codex_info["auth"])),
        ("模型", ", ".join(info["models"] + codex_info["models"]) or "—"),
        ("导入结果", imported.get("reason", "—")),
    ]
    _print("ccp-observe")
    _print("-" * 46)
    for key, value in rows:
        _print("  %-10s %s" % (key, value))
    if info["ignored_base_url"]:
        _print("  %-10s %s" % ("已忽略", "%s（指向本机代理，不是真实上游）"
                               % info["ignored_base_url"]))
    if port:
        _print("  %-10s %s" % ("面板", "http://127.0.0.1:%d/_ccp/" % port))
    _print()
    if not python and not port:
        _print("安装 Python 3.9+，或设置 CCP_PYTHON 指向解释器绝对路径。")
        return 2
    if not claude and not codex:
        _print("先安装一个客户端：npm i -g @anthropic-ai/claude-code 或 npm i -g @openai/codex。")
        return 1
    if not info["upstream"] and not codex_info["upstream"]:
        _print("在 ~/.claude/settings.json 里写 ANTHROPIC_BASE_URL，或在 ~/.codex/config.toml "
               "里配置 model_providers，然后重跑 ccp；也可以直接在面板的「供应商」页添加。")
        return 1
    return 0


# ---------------------------------------------------------------------- main

def main(argv: list[str] | None = None) -> int:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
        except (AttributeError, ValueError):
            pass

    parser = argparse.ArgumentParser(
        prog="ccp", add_help=False,
        description="通过 ccp-observe 运行 Claude Code 或 Codex（其余参数原样传给客户端）",
    )
    parser.add_argument("--doctor", action="store_true", help="只做检查，不启动客户端")
    parser.add_argument("--no-launch", action="store_true", help="确保代理已启动后退出")
    parser.add_argument("--reimport", action="store_true",
                        help="用 settings.json / config.toml 覆盖已导入的供应商")
    parser.add_argument("--port", type=int, default=int(os.environ.get("CCP_PORT", DEFAULT_PORT)))
    parser.add_argument("--agent", metavar="NAME",
                        help="指定客户端：claude / codex / list（临时覆盖记忆的选择）")
    parser.add_argument("-h", "--help", action="store_true", help="显示帮助")
    known, passthrough = parser.parse_known_args(argv)

    if known.help:
        _print(__doc__.strip())
        return 0

    if known.agent == "list":
        available = installed_agents()
        _print("已安装：" + (", ".join(available) or "（无）"))
        _print("当前默认：" + AGENT_LABEL.get(read_last_agent() or "", "未选择"))
        return 0

    if known.agent and known.agent not in AGENTS:
        _print("[ccp] 未知客户端 %r，可选 %s。" % (known.agent, " / ".join(AGENTS)))
        return 2
    if known.agent and not find_agent(known.agent):
        _print("[ccp] 找不到 %s 命令，请先安装。" % AGENT_LABEL[known.agent])
        return 2

    # Discover upstreams from both clients before touching the proxy. A Codex
    # user has no ~/.claude/settings.json at all; importing only Claude's
    # settings left the proxy with no provider and every request failed with
    # upstream_not_configured — the first thing a fresh install ran into.
    env = claude_env.read_settings_env()
    candidates = discover.providers(env)
    hint = preferred_agent_hint(known.agent, passthrough)
    hint_provider = claude_env.provider_for_agent(hint, *candidates) if hint else None
    preferred_id = (hint_provider or (candidates[0] if candidates else {})).get("id", "")

    store = ConfigStore(state_dir())
    imported = claude_env.ensure_providers(store, candidates, preferred_id,
                                           force=known.reimport)

    # Neither client configured: ask once instead of launching into a 502.
    if not candidates and not known.doctor:
        manual = first_run_provider(hint)
        if manual:
            candidates = [manual]
            imported = claude_env.ensure_providers(store, candidates, manual["id"])

    running = find_running(known.port)
    python = find_python() if (known.doctor or not running) else None

    if known.doctor:
        return doctor(python, running, imported, env, find_claude(), read_last_agent())

    if not running:
        if not python:
            _print("[ccp] 找不到可用的 Python 3。")
            _print("      安装 Python 3.9+，或设置 CCP_PYTHON 指向 python.exe 的绝对路径。")
            return 2
        _print("[ccp] 正在启动本地代理…")
        port, error = start_proxy(python, known.port)
        if not port:
            _print("[ccp] " + error)
            return 2
        running = port
    else:
        _print("[ccp] 复用已运行的代理（端口 %d）" % running)

    # A proxy started by an earlier run may not know the provider we just wrote.
    sync_running(running, store)
    if imported.get("providers"):
        _print("[ccp] 已导入供应商：%s" % "、".join(
            p.get("name") or p.get("id") for p in imported["providers"]))

    _print("[ccp] 面板：http://127.0.0.1:%d/_ccp/" % running)

    if known.no_launch:
        return 0

    if known.agent:
        agent, launch_args = known.agent, passthrough
    else:
        resolved = choose_agent(passthrough)
        if not resolved:
            return 2
        agent, launch_args = resolved

    # The remembered client may not have been the one whose config we imported
    # first. Make sure this agent has a provider, and that Codex requests do not
    # fall through to an anthropic default it cannot translate from.
    wanted = claude_env.provider_for_agent(agent, *candidates)
    if wanted:
        known_ids = {p.get("id") for p in store.get().get("providers") or []}
        if wanted["id"] not in known_ids:
            extra = claude_env.ensure_providers(store, [wanted], wanted["id"])
            if extra.get("imported"):
                _print("[ccp] 已从 %s 配置导入供应商：%s"
                       % (AGENT_LABEL[agent], wanted.get("name") or wanted["id"]))
        if ensure_agent_route(store, agent, wanted):
            _print("[ccp] 已为 %s 添加路由：%s"
                   % (AGENT_LABEL[agent], "/v1/responses*" if agent == "codex"
                      else "/v1/messages*"))
        sync_running(running, store)

    _print("[ccp] 启动 %s（代理端口 %d）" % (AGENT_LABEL[agent], running))
    if agent == "codex":
        return launch_codex(find_agent("codex") or "codex", running, launch_args)
    return launch_claude(find_agent("claude") or "claude",
                         write_override(running), launch_args)


if __name__ == "__main__":
    sys.exit(main())
