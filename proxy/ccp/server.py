# -*- coding: utf-8 -*-
"""The HTTP server: reverse-proxying, observation, retries and panel hosting."""

from __future__ import annotations

import json
import os
import socket
import ssl
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

from . import __version__
from .capture import CaptureStore, build_entry
from .config import ConfigStore, _as_bool
from .protocol import (
    detect_protocol,
    estimate_input_tokens,
    join_upstream,
    json_or_none,
    model_from_response,
    request_model,
    session_id,
    summarize_body,
    upstream_path,
    usage_from_anthropic,
    usage_from_openai,
)
from .router import explain as explain_route
from .router import resolve as resolve_route
from .router import validate_rule
from .stats import MetricsStore, RequestRecord, _now_iso, reason_label, reason_owner
from .usage import UsageLedger
from .translate import (
    anthropic_response_to_openai,
    anthropic_to_openai,
    make_stream,
    openai_response_to_anthropic,
    openai_to_anthropic,
)
from .truncation import TruncationScanner

PANEL_PREFIX = "/_ccp"
PANEL_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static")

_CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".map": "application/json; charset=utf-8",
}

_HOP_BY_HOP = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailers", "transfer-encoding", "upgrade", "host", "content-length",
}

# Headers that only make sense to one dialect; they are dropped when the
# request is translated before going upstream.
_ANTHROPIC_ONLY = {"anthropic-version", "anthropic-beta", "x-api-key"}
_OPENAI_ONLY = {"openai-organization", "openai-project", "openai-beta"}

# Response headers worth keeping when we synthesise the body ourselves.
_KEEP_RESPONSE = {"x-request-id", "request-id", "openai-processing-ms",
                  "anthropic-ratelimit-requests-remaining"}


class ProxyHandler(BaseHTTPRequestHandler):
    server_version = "ccp-observe/" + __version__
    protocol_version = "HTTP/1.1"

    # -- wiring ------------------------------------------------------------
    @property
    def config(self) -> ConfigStore:
        return self.server.config  # type: ignore[attr-defined]

    @property
    def store(self) -> MetricsStore:
        return self.server.store  # type: ignore[attr-defined]

    @property
    def capture(self) -> CaptureStore:
        return self.server.capture  # type: ignore[attr-defined]

    @property
    def usage(self) -> UsageLedger:
        return self.server.usage  # type: ignore[attr-defined]

    def log_message(self, fmt, *args):  # quieter default logging
        if _as_bool(os.environ.get("CCP_VERBOSE", "0")):
            super().log_message(fmt, *args)

    # -- routing -----------------------------------------------------------
    def do_GET(self):
        self._route("GET")

    def do_POST(self):
        self._route("POST")

    def do_PUT(self):
        self._route("PUT")

    def do_DELETE(self):
        self._route("DELETE")

    def do_PATCH(self):
        self._route("PATCH")

    def do_HEAD(self):
        self._route("HEAD")

    def do_OPTIONS(self):
        if self.path.startswith(PANEL_PREFIX):
            self.send_response(204)
            self._cors()
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        self._route("OPTIONS")

    def _route(self, method: str):
        path = self.path.split("?", 1)[0]
        if path == "/_ccp":
            # Relative-path robustness: bounce to the trailing-slash form so
            # the panel's ./assets/* references resolve correctly.
            self.send_response(302)
            self.send_header("Location", "/_ccp/")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        if path.startswith(PANEL_PREFIX + "/api/"):
            self._handle_api(method, path)
            return
        if path.startswith(PANEL_PREFIX + "/") or path == PANEL_PREFIX:
            self._serve_static(path)
            return
        if path in ("/healthz", "/_health"):
            self._send_json(200, {"ok": True, "version": __version__})
            return
        self._handle_proxy(method)

    # -- helpers -----------------------------------------------------------
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")

    def _send_json(self, code: int, payload, extra_headers: dict | None = None):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self._cors()
        for k, v in (extra_headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _read_body(self) -> bytes:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return b""
        return self.rfile.read(length)

    # -- panel API ---------------------------------------------------------
    def _handle_api(self, method: str, path: str):
        route = path[len(PANEL_PREFIX + "/api/"):].rstrip("/")
        if route == "stats" and method == "GET":
            self._send_json(200, self.store.stats())
            return
        if route == "recent" and method == "GET":
            model = self._query("model")
            limit = self._query_int("limit", 100)
            self._send_json(200, {"items": self.store.recent(limit=limit, model=model)})
            return
        if route == "errors" and method == "GET":
            limit = self._query_int("limit", 100)
            self._send_json(200, {"items": self.store.errors(limit=limit)})
            return
        if route == "truncations" and method == "GET":
            model = self._query("model")
            limit = self._query_int("limit", 100)
            self._send_json(200, {"items": self.store.truncations(model=model, limit=limit)})
            return
        if route == "context" and method == "GET":
            model = self._query("model") or ""
            self._send_json(200, {"items": self.store.context_series(model)})
            return
        if route == "buckets" and method == "GET":
            model = self._query("model") or ""
            gran = self._query("granularity") or "day"
            if gran not in ("day", "week", "month"):
                gran = "day"
            self._send_json(200, {"items": self.store.buckets(model, gran)})
            return
        if route == "usage" and method == "GET":
            days = self._query_int("days", 30)
            self._send_json(200, {
                "days": self.usage.days(days),
                "models": self.usage.by_model(days),
                "providers": self.usage.providers(days),
                "summary": self.usage.summary(days),
                "persisted": os.path.exists(os.path.join(self.config._base, "usage.json")),
            })
            return
        if route == "config":
            if method == "GET":
                self._send_json(200, self._public_config())
                return
            if method == "POST":
                body = json_or_none(self._read_body().decode("utf-8", "replace")) or {}
                if not isinstance(body, dict):
                    self._send_json(400, {"ok": False, "error": "body must be a JSON object"})
                    return
                saved = self.config.save(body)
                self.store.limit(saved.get("history_limit", 500))
                self.capture.configure(saved.get("capture_limit"),
                                       saved.get("capture_body_limit"))
                self._send_json(200, {"ok": True, "config": self._public_config()})
                return
        if route == "test" and method == "POST":
            body = json_or_none(self._read_body().decode("utf-8", "replace")) or {}
            result = self._test_upstream(body if isinstance(body, dict) else {})
            self._send_json(200 if result.get("ok") else 502, result)
            return
        if route == "selftest" and method == "GET":
            self._send_json(200, self._selftest())
            return
        if route == "route" and method in ("GET", "POST"):
            body = {}
            if method == "POST":
                body = json_or_none(self._read_body().decode("utf-8", "replace")) or {}
            else:
                body = {"model": self._query("model") or "",
                        "protocol": self._query("protocol") or "anthropic"}
            model = str(body.get("model") or "")
            proto = str(body.get("protocol") or "anthropic")
            if proto not in ("anthropic", "openai"):
                proto = "anthropic"
            cfg = self.config.get()
            decision = explain_route(cfg, proto, model)
            # Surface every rule that *could* match so the UI can explain a
            # decision rather than just state it.
            decision["providers"] = [
                {"id": p.get("id"), "name": p.get("name"),
                 "protocol": p.get("protocol"), "enabled": p.get("enabled", True),
                 "models": p.get("models") or []}
                for p in cfg.get("providers") or []
            ]
            self._send_json(200, decision)
            return
        if route == "routes/validate" and method == "POST":
            body = json_or_none(self._read_body().decode("utf-8", "replace")) or {}
            match = str(body.get("match") or "")
            provider = str(body.get("provider") or "")
            errors = []
            err = validate_rule(match)
            if err:
                errors.append(err)
            if not provider:
                errors.append("必须选择目标供应商")
            elif not self.config.provider(provider):
                errors.append("供应商 %s 不存在" % provider)
            self._send_json(200, {"ok": not errors, "errors": errors})
            return
        if route == "capture" and method == "GET":
            model = self._query("model")
            limit = self._query_int("limit", 50)
            truncated_only = self._query("truncated") in ("1", "true", "yes")
            self._send_json(200, {
                "items": self.capture.recent(limit=limit, model=model,
                                             truncated_only=truncated_only),
                "stats": self.capture.stats(),
            })
            return
        if route.startswith("capture/"):
            rid = unquote(route[len("capture/"):])
            item = self.capture.get(rid)
            if not item:
                self._send_json(404, {"ok": False, "error": "capture not found"})
                return
            self._send_json(200, item)
            return
        self._send_json(404, {"ok": False, "error": "unknown api route: " + route})

    def _public_config(self) -> dict:
        cfg = self.config.get()
        cfg = dict(cfg)
        cfg["version"] = __version__
        cfg["panel_dir"] = PANEL_DIR
        cfg["has_panel"] = os.path.exists(os.path.join(PANEL_DIR, "index.html"))
        cfg["listen"] = "%s:%s" % (self.server.server_address[0], self.server.server_address[1])
        return cfg

    def _query(self, key: str):
        qs = urlsplit(self.path).query
        for part in qs.split("&"):
            if "=" in part:
                k, v = part.split("=", 1)
                if unquote(k) == key:
                    return unquote(v)
        return None

    def _query_int(self, key: str, default: int) -> int:
        raw = self._query(key)
        try:
            return max(1, min(2000, int(raw))) if raw else default
        except ValueError:
            return default

    # -- selftest + upstream probe ----------------------------------------
    def _selftest(self) -> dict:
        checks = []

        def check(name, ok, detail=""):
            checks.append({"name": name, "ok": bool(ok), "detail": detail})

        cfg = self.config.get()
        check("config_loaded", True, "upstream=%s" % ("已配置" if cfg.get("upstream") else "未配置"))
        check("panel_built", os.path.exists(os.path.join(PANEL_DIR, "index.html")),
              "static/index.html")
        check("state_dir", os.path.isdir(self.config._base), self.config._base)
        check("store_ready", hasattr(self.store, "_records"), "history_limit=%s" % self.store._history_limit)
        self.store.stats()  # touch the aggregation path so a bug surfaces in selftest
        check("aggregation", True, "%d models tracked" % len(self.store.model_names()))

        providers = cfg.get("providers") or []
        enabled = [p for p in providers if p.get("enabled", True) and p.get("base_url")]
        # An empty provider list is a valid first-run state, not a failure;
        # only a default_provider pointing at nothing is worth flagging.
        default_pid = cfg.get("default_provider") or ""
        default_ok = not default_pid or bool(self.config.provider(default_pid))
        check("providers", default_ok,
              "%d 个供应商已启用，默认=%s%s" % (
                  len(enabled), default_pid or "无",
                  "" if default_ok else "（不存在）"))
        routes = cfg.get("routes") or []
        dangling = [r for r in routes if not self.config.provider(r.get("provider") or "")]
        check("routes", not dangling,
              "%d 条路由%s" % (len(routes),
                               "" if not dangling else "，%d 条指向不存在的供应商" % len(dangling)))
        check("capture", bool(cfg.get("capture_enabled", True)),
              str(self.capture.stats()))

        up = cfg.get("upstream") or cfg.get("upstream_anthropic") or cfg.get("upstream_openai")
        if up or enabled:
            check("upstream_configured", True, up or "%d providers" % len(enabled))
        else:
            check("upstream_configured", True, "未配置（首次使用请在设置页填写）")

        ok = all(c["ok"] for c in checks)
        return {"ok": ok, "version": __version__, "checks": checks, "generated_at": _now_iso()}

    def _test_upstream(self, body: dict) -> dict:
        cfg = self.config.get()
        protocol = body.get("protocol") or "anthropic"
        provider_id = body.get("provider") or ""
        provider = self.config.provider(provider_id) if provider_id else None
        base = (body.get("upstream") or (provider or {}).get("base_url")
                or self.config.upstream_for(protocol) or "").strip()
        if not base:
            return {"ok": False, "error": "未填写上游地址"}
        url = join_upstream(base, "/v1/models")
        headers = {"Content-Type": "application/json", "User-Agent": "ccp-observe-selftest"}
        auth = (body.get("auth_header") or (provider or {}).get("auth_header")
                or cfg.get("upstream_auth_header") or "").strip()
        if auth:
            name, _, value = auth.partition(":")
            headers[name.strip()] = value.strip()
        started = time.time()
        try:
            if protocol == "anthropic":
                # A minimal, malformed-safe probe: count_tokens when possible.
                probe_url = join_upstream(base, "/v1/messages/count_tokens")
                payload = {
                    "model": body.get("model") or "probe-model",
                    "messages": [{"role": "user", "content": "ping"}],
                }
                req = urllib.request.Request(probe_url, data=json.dumps(payload).encode(),
                                             headers=headers, method="POST")
            else:
                req = urllib.request.Request(url, headers=headers, method="GET")
            ctx = ssl.create_default_context()
            with urllib.request.urlopen(req, timeout=int(cfg.get("connect_timeout_s", 15)),
                                        context=ctx) as resp:
                elapsed = round((time.time() - started) * 1000, 1)
                snippet = resp.read(400).decode("utf-8", "replace")
                return {
                    "ok": resp.status < 400,
                    "status": resp.status,
                    "latency_ms": elapsed,
                    "url": url,
                    "provider": provider_id or None,
                    "sample": snippet[:300],
                }
        except urllib.error.HTTPError as exc:
            elapsed = round((time.time() - started) * 1000, 1)
            # 401/403/400 still prove the host is reachable & speaking HTTP.
            reachable = exc.code in (400, 401, 403, 404, 405, 422, 429)
            return {
                "ok": reachable,
                "status": exc.code,
                "latency_ms": elapsed,
                "url": url,
                "provider": provider_id or None,
                "reachable": reachable,
                "error": "HTTP %d：主机可达但拒绝了探测请求（可能是鉴权或路径差异）" % exc.code,
            }
        except Exception as exc:  # noqa: BLE001 - report any failure verbatim
            elapsed = round((time.time() - started) * 1000, 1)
            return {"ok": False, "error": "%s: %s" % (type(exc).__name__, exc),
                    "latency_ms": elapsed, "url": url, "provider": provider_id or None}

    # -- static ------------------------------------------------------------
    def _serve_static(self, path: str):
        rel = path[len(PANEL_PREFIX):].lstrip("/")
        rel = unquote(rel)
        if not rel or rel.endswith("/"):
            rel = os.path.join(rel, "index.html")
        candidate = os.path.normpath(os.path.join(PANEL_DIR, rel))
        root = os.path.normpath(PANEL_DIR)
        if not candidate.startswith(root):  # path traversal guard
            self._send_json(403, {"error": "forbidden"})
            return
        if os.path.isdir(candidate):
            candidate = os.path.join(candidate, "index.html")
        if not os.path.isfile(candidate):
            # SPA fallback for client-side views
            fallback = os.path.join(root, "index.html")
            if os.path.isfile(fallback) and "." not in os.path.basename(rel):
                candidate = fallback
            else:
                self._send_json(404, {"error": "not found: " + rel})
                return
        self._write_file(candidate)

    def _write_file(self, file_path: str):
        ext = os.path.splitext(file_path)[1].lower()
        ctype = _CONTENT_TYPES.get(ext, "application/octet-stream")
        try:
            with open(file_path, "rb") as fh:
                data = fh.read()
        except OSError as exc:
            self._send_json(500, {"error": str(exc)})
            return
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        cache = "no-cache" if ext == ".html" else "public, max-age=31536000, immutable"
        self.send_header("Cache-Control", cache)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    # -- proxy -------------------------------------------------------------
    def _handle_proxy(self, method: str):
        raw_body = self._read_body()
        body_text = raw_body.decode("utf-8", "replace")
        body_obj = json_or_none(body_text)
        protocol = detect_protocol(self.path, dict(self.headers), body_obj)
        requested_model = request_model(body_obj)
        cfg = self.config.get()

        # Some gateways have no count_tokens endpoint (it 404s), which makes
        # Claude Code fail early in the turn. Answer it locally: the estimate
        # only feeds a progress bar, and a round trip we know will fail is
        # worse than an approximation.
        path_only = self.path.split("?", 1)[0]
        if path_only.endswith("/messages/count_tokens") and cfg.get("local_count_tokens", True):
            if isinstance(body_obj, dict):
                self._send_json(200, {"input_tokens": estimate_input_tokens(body_obj)})
                return

        decision = resolve_route(cfg, protocol, requested_model or "", self.path)
        upstream = (decision.get("base_url") or "").strip()
        if not upstream:
            self._send_json(502, {
                "ok": False,
                "error": "upstream_not_configured",
                "message": "尚未配置上游地址或供应商，请打开 /_ccp/ 的「供应商」或「设置」页填写后再试。",
                "protocol": protocol,
            })
            return

        upstream_protocol = decision.get("upstream_protocol") or protocol

        # The translator speaks chat-completions <-> messages. The Responses API
        # (what Codex uses) has a different request/response grammar, so a
        # cross-protocol hop would silently mangle it — the client then retries
        # five times against a malformed body. Fail once, with a message that
        # says what to change.
        if (decision.get("translate") and protocol == "openai"
                and path_only.endswith("/responses")
                and upstream_protocol != "openai"):
            self._send_json(400, {
                "error": {
                    "type": "ccp_unsupported_translation",
                    "message": "Codex 使用 Responses API，当前供应商是 %s 协议，"
                               "两者无法转换。请把 Codex 路由到一个 protocol=openai "
                               "的供应商（「路由」页加一条规则即可）。" % upstream_protocol,
                }
            })
            return

        out_body, translated = self._translate_request(protocol, upstream_protocol,
                                                       body_obj, raw_body, decision)
        target_path = self._target_path(self.path, protocol, upstream_protocol, translated)
        url = join_upstream(upstream, target_path)
        headers = self._forward_headers(protocol, upstream_protocol, decision)

        req_id = self.store.next_id()
        started_at = time.time()
        self.store.begin()
        record_kw = dict(
            id=req_id, started_at=started_at, model=requested_model or "unknown",
            requested_model=requested_model, protocol=protocol,
            path=self.path.split("?", 1)[0], method=method,
            session=session_id(dict(self.headers), body_obj),
            body_snippet=summarize_body(body_obj, 300), truncated=False, retried_ok=False,
            provider_id=decision.get("provider_id") or "",
            provider_name=decision.get("provider_name") or "",
            upstream_protocol=upstream_protocol,
            translated=translated,
            route_source=decision.get("source") or "",
        )

        max_attempts = max(1, int(cfg.get("retries", 0)) + 1)
        backoff = float(cfg.get("retry_backoff_ms", 600)) / 1000.0
        attempts = 0
        last_error = ""
        attempt = 0

        while attempt < max_attempts:
            attempt += 1
            attempts = attempt
            try:
                result = self._attempt(url, method, headers, out_body, protocol,
                                       upstream_protocol, record_kw, attempt,
                                       max_attempts, started_at, raw_body, decision)
                if result is None:
                    return  # response already streamed/handled
                last_error = result.get("error", "")
                status = result.get("status")
                if not result.get("retryable", False):
                    break
                if attempt < max_attempts:
                    time.sleep(min(backoff * attempt, 10.0))
                    continue
                self._record_error(record_kw, status or 502, attempts,
                                   last_error, started_at, max_attempts, raw_body, decision)
                self._send_json(status or 502, {
                    "ok": False, "error": "upstream_failed_after_retries",
                    "attempts": attempts, "detail": last_error,
                })
                return
            except (BrokenPipeError, ConnectionResetError):
                last_error = "client_disconnected"
                break
            except Exception as exc:  # noqa: BLE001
                last_error = "%s: %s" % (type(exc).__name__, exc)
                if attempt < max_attempts:
                    time.sleep(min(backoff * attempt, 10.0))
                    continue
                self._record_error(record_kw, 502, attempts, last_error, started_at,
                                   max_attempts, raw_body, decision)
                self._send_json(502, {
                    "ok": False, "error": "upstream_exception",
                    "attempts": attempts, "detail": last_error,
                })
                return

        # Retry loop ended without streaming a response (non-retryable failure).
        self._record_error(record_kw, 502, attempts, last_error or "unknown", started_at,
                           max_attempts, raw_body, decision)
        self._send_json(502, {"ok": False, "error": "upstream_failed", "attempts": attempts,
                              "detail": last_error})

    def _translate_request(self, client_protocol: str, upstream_protocol: str,
                           body_obj, raw_body: bytes, decision: dict) -> tuple[bytes, bool]:
        """Rewrite the request body when the provider speaks the other dialect."""
        if not decision.get("translate") or client_protocol == upstream_protocol:
            return raw_body, False
        if not isinstance(body_obj, dict):
            return raw_body, False
        try:
            if client_protocol == "anthropic" and upstream_protocol == "openai":
                converted = anthropic_to_openai(body_obj)
            elif client_protocol == "openai" and upstream_protocol == "anthropic":
                converted = openai_to_anthropic(body_obj)
            else:
                return raw_body, False
        except Exception:  # noqa: BLE001 - a translation bug must not kill the request
            return raw_body, False
        return json.dumps(converted, ensure_ascii=False).encode("utf-8"), True

    def _target_path(self, path: str, client_protocol: str,
                     upstream_protocol: str, translated: bool) -> str:
        if translated:
            # The endpoint, not the inbound path, decides which API we call.
            return "/v1/chat/completions" if upstream_protocol == "openai" else "/v1/messages"
        return upstream_path(path, upstream_protocol)

    def _attempt(self, url, method, headers, out_body, client_protocol,
                 upstream_protocol, record_kw, attempt, max_attempts, started_at,
                 raw_body, decision):
        """One upstream try.

        Returns ``None`` when the response was fully relayed (success or a
        definite non-retryable response to the client), or a dict that signals
        a retryable failure.
        """
        cfg = self.config.get()
        req = urllib.request.Request(
            url, data=out_body if method in ("POST", "PUT", "PATCH") else None,
            headers=headers, method=method)
        try:
            resp = urllib.request.urlopen(req, timeout=int(cfg.get("read_timeout_s", 900)),
                                          context=ssl.create_default_context())
        except urllib.error.HTTPError as exc:
            status = exc.code
            detail = _safe_read(exc)
            retryable = is_transient(status, detail, cfg)
            if retryable and attempt < max_attempts:
                return {"retryable": True, "status": status, "error": "HTTP %d" % status,
                        "detail": detail}
            # non-retryable (4xx) or retries exhausted -> relay the error body
            self._relay_error(exc, status, detail)
            self._finalize(record_kw, status, attempts=attempt, ok=False,
                           error="HTTP %d" % status, started_at=started_at,
                           max_attempts=max_attempts, retried_ok=False,
                           response_body=detail, decision=decision)
            return None
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as exc:
            if attempt < max_attempts:
                return {"retryable": True, "status": 502, "error": str(exc)}
            return {"retryable": False, "status": 502, "error": str(exc)}

        # Success: relay status + headers, then stream the body.
        status = getattr(resp, "status", 200)
        content_type = resp.headers.get("Content-Type", "")
        is_sse = "text/event-stream" in content_type.lower()
        translating = bool(decision.get("translate")) and client_protocol != upstream_protocol

        self.send_response(status if 200 <= status < 400 else 200)
        for key, value in resp.headers.items():
            if key.lower() in _HOP_BY_HOP:
                continue
            if translating and key.lower() in ("content-type", "content-encoding"):
                continue
            self.send_header(key, value)
        if translating:
            self.send_header("Content-Type",
                             "text/event-stream; charset=utf-8" if is_sse
                             else "application/json; charset=utf-8")
        self._cors()
        # We chunk unless we can measure length — and translation invalidates
        # any length the upstream reported.
        length = resp.headers.get("Content-Length")
        if length and not translating:
            self.send_header("Content-Length", length)
        else:
            self.send_header("Connection", "close")
            self.close_connection = True
        self.end_headers()

        scanner = TruncationScanner(client_protocol) if is_sse else None
        shim = make_stream(upstream_protocol, client_protocol,
                           record_kw.get("requested_model") or "") if translating and is_sse else None
        non_sse_body = b""
        sent_body = b""          # what the client actually received
        upstream_raw = b""       # upstream bytes (capture shows the real wire)
        aborted = False
        try:
            while True:
                chunk = resp.read(4096)
                if not chunk:
                    break
                upstream_raw += chunk if len(upstream_raw) < 2_000_000 else b""
                out_chunk = shim.feed(chunk) if shim is not None else chunk
                if not out_chunk:
                    if scanner is not None:
                        scanner.feed(b"")
                    continue
                try:
                    self.wfile.write(out_chunk)
                    self.wfile.flush()
                except (BrokenPipeError, ConnectionResetError):
                    aborted = True
                    break
                if scanner is not None:
                    scanner.feed(out_chunk)
                else:
                    if len(non_sse_body) < 2_000_000:
                        non_sse_body += out_chunk
                if len(sent_body) < 2_000_000:
                    sent_body += out_chunk
            if shim is not None:
                tail = shim.close()
                if tail:
                    try:
                        self.wfile.write(tail)
                        self.wfile.flush()
                    except (BrokenPipeError, ConnectionResetError):
                        aborted = True
                    if scanner is not None:
                        scanner.feed(tail)
                    if len(sent_body) < 2_000_000:
                        sent_body += tail
        finally:
            resp.close()

        # Interpret the response for metrics.
        usage: dict = {}
        resp_model = None
        truncation = None
        if scanner is not None:
            trunc = scanner.finish(status, aborted=aborted)
            truncation = trunc.detail("stream")
            usage = dict(scanner.usage)
            resp_model = scanner.model or None
        else:
            source = sent_body if translating else non_sse_body
            obj = json_or_none(source.decode("utf-8", "replace"))
            if isinstance(obj, dict):
                if translating:
                    # `obj` is already in the client's dialect.
                    usage = (usage_from_anthropic(obj) if client_protocol == "anthropic"
                             else usage_from_openai(obj))
                    resp_model = model_from_response(client_protocol, obj)
                else:
                    usage = (usage_from_anthropic(obj) if client_protocol == "anthropic"
                             else usage_from_openai(obj))
                    resp_model = model_from_response(client_protocol, obj)

        self._finalize(
            record_kw, status, attempts=attempt, ok=200 <= status < 400,
            error=None if 200 <= status < 400 else "HTTP %d" % status,
            started_at=started_at, max_attempts=max_attempts,
            retried_ok=(attempt > 1 and 200 <= status < 400),
            usage=usage, response_model=resp_model, truncation=truncation,
            aborted=aborted, stream=is_sse,
            request_body=raw_body, response_body=sent_body,
            response_headers=dict(resp.headers.items()), decision=decision,
        )
        return None

    def _relay_error(self, exc, status: int, detail: bytes):
        self.send_response(status)
        ctype = exc.headers.get("Content-Type", "application/json") if exc.headers else "application/json"
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(detail)))
        self._cors()
        self.end_headers()
        try:
            self.wfile.write(detail)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _record_error(self, record_kw, status, attempts, error, started_at, max_attempts,
                      raw_body=b"", decision=None):
        self._finalize(record_kw, status, attempts=attempts, ok=False, error=error,
                       started_at=started_at, max_attempts=max_attempts, retried_ok=False,
                       request_body=raw_body, decision=decision or {})

    def _finalize(self, record_kw, status, attempts, ok, error, started_at, max_attempts,
                  retried_ok=False, usage=None, response_model=None, truncation=None,
                  aborted=False, stream=False, request_body=b"", response_body=b"",
                  response_headers=None, decision=None):
        cfg = self.config.get()
        model = response_model or record_kw.get("model")
        mapped = cfg.get("model_map", {}).get(model or "")
        if mapped:
            model = mapped
        usage = usage or {}
        decision = decision or {}
        record = RequestRecord(
            id=record_kw["id"],
            started_at=started_at,
            time=_now_iso(started_at),
            model=model or record_kw.get("model") or "unknown",
            requested_model=record_kw.get("requested_model"),
            status=status,
            ok=bool(ok),
            attempts=attempts,
            duration_ms=round((time.time() - started_at) * 1000.0, 1),
            input_tokens=usage.get("input_tokens"),
            output_tokens=usage.get("output_tokens"),
            cache_read_tokens=usage.get("cache_read_tokens"),
            cache_write_tokens=usage.get("cache_write_tokens"),
            session=record_kw.get("session"),
            protocol=record_kw.get("protocol"),
            path=record_kw.get("path"),
            truncated=bool(truncation),
            retried_ok=bool(retried_ok),
            error=error,
            stream=stream or truncation is not None,
            body_snippet=record_kw.get("body_snippet"),
            truncation=truncation,
            provider_id=record_kw.get("provider_id"),
            provider_name=record_kw.get("provider_name"),
            upstream_protocol=record_kw.get("upstream_protocol"),
            translated=bool(record_kw.get("translated")),
            route_source=record_kw.get("route_source"),
        )
        self.store.add(record)
        if cfg.get("usage_enabled", True):
            try:
                self.usage.record(
                    ts=started_at,
                    model=record.model or "unknown",
                    provider=record.provider_name or record.provider_id or "",
                    ok=bool(record.ok),
                    truncated=bool(record.truncated),
                    retried_ok=bool(record.retried_ok),
                    duration_ms=float(record.duration_ms or 0),
                    input_tokens=record.input_tokens,
                    output_tokens=record.output_tokens,
                    cache_read=record.cache_read_tokens,
                    cache_write=record.cache_write_tokens,
                )
            except Exception:  # noqa: BLE001 - accounting must never break a request
                pass
        if cfg.get("capture_enabled", True):
            reason = (truncation or {}).get("reason") or ""
            self.capture.add(build_entry(
                rid=record.id, started_at=started_at,
                record_kw=dict(record_kw, model=record.model),
                decision=decision, request_body=request_body,
                request_headers=getattr(self, "_client_headers", {}),
                status=status, ok=ok, attempts=attempts,
                duration_ms=(time.time() - started_at) * 1000.0, error=error,
                response_body=response_body,
                response_headers=response_headers or {},
                stream=stream, truncated=bool(truncation), reason=reason,
                owner=reason_owner(reason) if reason else "",
                translated=bool(record_kw.get("translated")),
                usage=usage,
                body_limit=int(cfg.get("capture_body_limit") or 262144),
            ))

    def _forward_headers(self, client_protocol: str, upstream_protocol: str,
                         decision: dict) -> dict:
        headers = {}
        drop = set()
        if client_protocol != upstream_protocol:
            drop |= _ANTHROPIC_ONLY if client_protocol == "anthropic" else _OPENAI_ONLY
        for key, value in self.headers.items():
            if key.lower() in _HOP_BY_HOP or key.lower() in drop:
                continue
            headers[key] = value
        self._client_headers = dict(headers)
        auth = (decision.get("auth_header") or "").strip()
        if not auth:
            cfg = self.config.get()
            incoming_auth = any(k.lower() in ("authorization", "x-api-key") for k in headers)
            if not incoming_auth or decision.get("source") == "legacy":
                auth = (cfg.get("upstream_auth_header") or "").strip()
        if auth:
            name, _, val = auth.partition(":")
            if name.strip():
                # One provider key must not travel next to a stale client key.
                for stale in ("authorization", "x-api-key", "api-key"):
                    for existing in list(headers):
                        if existing.lower() == stale:
                            headers.pop(existing)
                headers[name.strip()] = val.strip()
        if client_protocol != upstream_protocol:
            headers.pop("Content-Type", None)
            headers["Content-Type"] = "application/json"
        return headers


def _safe_read(exc: urllib.error.HTTPError) -> bytes:
    try:
        return exc.read()
    except Exception:  # noqa: BLE001
        return b""


def is_transient(status: int, body: bytes, cfg: dict | None = None) -> bool:
    """Should this upstream failure be retried?

    Everything >= 500, 429 and the classic timeouts are transient. A 400 is
    only retried when it carries a known flaky signature: some gateways answer
    a valid request with 400 "invalid JSON request body" under load, and
    Claude Code treats any 400 as fatal, so retrying is the difference between
    a slow turn and a dead one. A genuinely malformed request still fails fast.
    """
    if status in (408, 409, 425, 429):
        return True
    if status >= 500:
        # A model-routing refusal is a 5xx that retrying cannot fix.
        if b"model_not_found" in (body or b""):
            return False
        return True
    if status != 400:
        return False
    cfg = cfg or {}
    text = body or b""
    # A 400 body that is not even JSON came from something in the middle, not
    # from request validation; that is a transport glitch worth one more try.
    try:
        json.loads(text.decode("utf-8", "replace"))
    except ValueError:
        return True
    patterns = cfg.get("retry_400_patterns") or ()
    return any(str(p).encode("utf-8") in text for p in patterns)


class ProxyServer(ThreadingHTTPServer):
    daemon_threads = True
    # On Windows SO_REUSEADDR lets a second process silently share the port,
    # which would split traffic between two proxies. Refuse that instead.
    allow_reuse_address = os.name != "nt"

    def server_bind(self):
        if os.name == "nt" and hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            try:
                self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
            except OSError:
                pass
        super().server_bind()

    def __init__(self, address, config: ConfigStore, store: MetricsStore,
                 capture: CaptureStore | None = None,
                 usage: UsageLedger | None = None):
        super().__init__(address, ProxyHandler)
        self.config = config
        self.store = store
        self.capture = capture or CaptureStore(
            limit=int(config.get().get("capture_limit") or 200),
            body_limit=int(config.get().get("capture_body_limit") or 262144),
        )
        self.usage = usage or UsageLedger(
            config._base, retain_days=int(config.get().get("usage_retain_days") or 120))

    def server_close(self):
        # A crash shouldn't lose the day's totals, but a normal shutdown must
        # never leave the last few seconds unwritten.
        try:
            self.usage.flush(force=True)
        except Exception:  # noqa: BLE001 - shutdown must not raise
            pass
        super().server_close()


__all__ = ["ProxyServer", "ProxyHandler", "PANEL_DIR"]
