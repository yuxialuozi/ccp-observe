# -*- coding: utf-8 -*-
"""ccp-observe entry point.

Zero third-party dependencies: runs on a stock CPython 3.9+ install.

Usage examples::

    python proxy.py                          # 127.0.0.1:8787, panel at /_ccp/
    python proxy.py --port 8788
    python proxy.py --upstream https://example.internal/v1
    python proxy.py --open                   # launch the panel in a browser

Environment overrides (used by the desktop sidecar): CCP_UPSTREAM,
CCP_STATE_DIR, CCP_HOST, CCP_PORT, CCP_OPEN_PANEL=1.
"""

from __future__ import annotations

import argparse
import os
import signal
import sys
import threading
import time
import webbrowser

# Windows consoles default to a legacy code page, which turns the Chinese
# banner into mojibake when output is piped. The handshake line is ASCII, so
# this only affects human-facing output — but it is what people see first.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except (AttributeError, ValueError):
        pass

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ccp import discover  # noqa: E402
from ccp.config import ConfigStore, _as_bool  # noqa: E402
from ccp.server import ProxyServer  # noqa: E402
from ccp.stats import MetricsStore  # noqa: E402


def _enabled_providers(cfg: dict) -> list[dict]:
    return [p for p in cfg.get("providers") or []
            if p.get("enabled", True) and (p.get("base_url") or "").strip()]


def _banner(host: str, port: int, config: ConfigStore) -> str:
    cfg = config.get()
    providers = _enabled_providers(cfg)
    panel = "http://%s:%s/_ccp/" % (host, port)
    lines = [
        "",
        "  ccp-observe · AI 编码代理观测面板",
        "  ------------------------------------------------",
        "  代理监听   http://%s:%s" % (host, port),
        "  面板地址   %s" % panel,
    ]
    if cfg.get("upstream"):
        lines.append("  上游地址   %s" % cfg["upstream"])
    if providers:
        summary = "、".join("%s → %s" % (p.get("name") or p.get("id"), p.get("base_url"))
                            for p in providers[:3])
        lines.append("  供应商     %s" % summary)
    if not cfg.get("upstream") and not providers:
        lines.append("  上游地址   （未配置）")
    lines.append("  状态目录   %s" % config._base)
    if not cfg.get("upstream") and not providers:
        lines += [
            "",
            "  [!] 尚未配置上游地址。",
            "      打开面板 → 右上角齿轮 → 填写「上游地址」并保存，",
            "      或使用: python proxy.py --upstream https://example.internal/v1",
        ]
    lines.append("")
    return "\n".join(lines)


def _bind(host: str, port: int, config: ConfigStore, store: MetricsStore,
          tries: int = 20):
    """Bind the listener, walking forward when the port is taken.

    Another local tool squatting on the default port is common enough that
    refusing to start would be a bad first-run experience. The caller prints
    the port that actually got bound, and the desktop app reads it from the
    CCP_READY handshake rather than assuming.
    """
    last: OSError | None = None
    for candidate in range(port, port + tries):
        try:
            return ProxyServer((host, candidate), config, store), candidate
        except OSError as exc:
            last = exc
            if candidate == port:
                print("[ccp-observe] 端口 %d 已占用，正在寻找可用端口…" % candidate, file=sys.stderr)
            continue
    raise last or OSError("no free port")


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="ccp-observe", description="本地 AI 网关观测代理")
    parser.add_argument("--host", default=os.environ.get("CCP_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("CCP_PORT", "8787")))
    parser.add_argument("--no-port-scan", action="store_true",
                        help="端口被占用时直接退出，不自动顺延")
    parser.add_argument("--upstream", default=os.environ.get("CCP_UPSTREAM", ""),
                        help="上游基址，例如 https://example.internal/v1")
    parser.add_argument("--open", action="store_true",
                        default=_as_bool(os.environ.get("CCP_OPEN_PANEL", "0")),
                        help="启动后自动打开浏览器面板")
    parser.add_argument("--no-banner", action="store_true")
    args = parser.parse_args(argv)

    config = ConfigStore()
    if args.upstream:
        config.save({"upstream": args.upstream})
    else:
        # Starting the proxy directly (start.sh, the desktop app) should work on
        # a machine where Claude Code or Codex is already configured. Import
        # once; a later panel edit is never overwritten.
        imported = discover.import_all(config)
        if imported.get("providers"):
            print("[ccp-observe] 已从本机客户端配置导入供应商：%s"
                  % "、".join(p.get("name") or p.get("id")
                             for p in imported["providers"]), flush=True)

    store = MetricsStore(history_limit=int(config.get().get("history_limit", 500)))
    tries = 1 if args.no_port_scan else 20
    try:
        server, port = _bind(args.host, args.port, config, store, tries)
    except OSError as exc:
        print("[ccp-observe] 无法绑定 %s:%s — %s" % (args.host, args.port, exc), file=sys.stderr)
        return 2

    if port != args.port:
        print("[ccp-observe] 已改用端口 %d（%d 被占用）" % (port, args.port), file=sys.stderr)

    if not args.no_banner:
        print(_banner(args.host, port, config), flush=True)

    # Machine-readable handshake for the Tauri sidecar / start scripts.
    print("CCP_READY http://%s:%s/_ccp/ pid=%d" % (args.host, port, os.getpid()), flush=True)

    if args.open:
        url = "http://%s:%s/_ccp/" % (args.host, port)
        threading.Thread(target=lambda: (time.sleep(0.8), webbrowser.open(url)), daemon=True).start()

    def _shutdown(signum, frame):  # noqa: ARG001
        print("\n[ccp-observe] 正在关闭…", flush=True)
        threading.Thread(target=server.shutdown, daemon=True).start()

    for sig in ("SIGINT", "SIGTERM", "SIGBREAK"):
        if hasattr(signal, sig):
            try:
                signal.signal(getattr(signal, sig), _shutdown)
            except (ValueError, OSError):
                pass

    try:
        server.serve_forever(poll_interval=0.4)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
