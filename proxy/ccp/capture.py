# -*- coding: utf-8 -*-
"""Request/response capture — the "packet capture" view.

The metrics ledger keeps counters; this keeps the actual bytes of the last
N exchanges so a user can see *what* went over the wire, not just how much.
Bodies are truncated to ``capture_body_limit`` (default 256 KB) with a marker,
and credential-ish headers are redacted before anything is stored.
"""

from __future__ import annotations

import json
import threading
import time
from collections import OrderedDict

SECRET_HEADERS = {
    "authorization", "x-api-key", "api-key", "anthropic-auth-token",
    "proxy-authorization", "cookie", "set-cookie", "x-goog-api-key",
}

REDACTED = "***redacted***"


def redact_headers(headers: dict) -> dict:
    out = {}
    for key, value in (headers or {}).items():
        if str(key).lower() in SECRET_HEADERS:
            text = str(value)
            # Keep the scheme so "Bearer sk-…" stays identifiable.
            scheme = text.split(" ", 1)[0] if " " in text else ""
            out[key] = (scheme + " " + REDACTED) if scheme else REDACTED
        else:
            out[key] = str(value)
    return out


def _clip(text: str, limit: int) -> tuple[str, bool]:
    if limit <= 0 or len(text) <= limit:
        return text, False
    head = limit // 2
    tail = limit - head
    return text[:head] + "\n…[truncated %d bytes]…\n" % (len(text) - limit) + text[-tail:], True


def pretty(body: bytes, limit: int) -> dict:
    """Best-effort JSON formatting so the capture view is readable."""
    text = (body or b"").decode("utf-8", errors="replace")
    clipped, cut = _clip(text, limit)
    formatted = clipped
    if not cut:
        try:
            formatted = json.dumps(json.loads(text), ensure_ascii=False, indent=2)
        except ValueError:
            formatted = text
    return {"text": formatted, "bytes": len(body or b""), "truncated": cut}


class CaptureStore:
    """Ring buffer of full exchanges, newest first on read."""

    def __init__(self, limit: int = 200, body_limit: int = 262144):
        self._lock = threading.RLock()
        self._items: "OrderedDict[str, dict]" = OrderedDict()
        self._limit = max(1, int(limit))
        self._body_limit = max(1024, int(body_limit))

    def configure(self, limit: int | None = None, body_limit: int | None = None) -> None:
        with self._lock:
            if limit:
                self._limit = max(1, int(limit))
            if body_limit:
                self._body_limit = max(1024, int(body_limit))
            self._trim()

    def _trim(self) -> None:
        while len(self._items) > self._limit:
            self._items.popitem(last=False)

    def add(self, entry: dict) -> None:
        with self._lock:
            self._items[entry["id"]] = entry
            self._trim()

    def get(self, rid: str) -> dict | None:
        with self._lock:
            item = self._items.get(rid)
            return dict(item) if item else None

    def recent(self, limit: int = 50, model: str | None = None,
               truncated_only: bool = False) -> list[dict]:
        rows = []
        with self._lock:
            items = list(reversed(self._items.values()))
        for item in items:
            if model and item.get("model") != model:
                continue
            if truncated_only and not item.get("truncated"):
                continue
            rows.append(self._summary(item))
            if len(rows) >= limit:
                break
        return rows

    def _summary(self, item: dict) -> dict:
        return {k: item.get(k) for k in (
            "id", "time", "started_at_ms", "model", "requested_model", "protocol",
            "upstream_protocol", "provider_id", "provider_name", "path", "method",
            "status", "ok", "attempts", "duration_ms", "session", "stream",
            "truncated", "reason", "owner", "error", "input_tokens", "output_tokens",
            "cache_read_tokens", "request_bytes", "response_bytes", "translated",
        )}

    def stats(self) -> dict:
        with self._lock:
            return {"captured": len(self._items), "limit": self._limit,
                    "body_limit": self._body_limit}


def build_entry(*, rid: str, started_at: float, record_kw: dict, decision: dict,
                request_body: bytes, request_headers: dict, status: int | None,
                ok: bool, attempts: int, duration_ms: float, error: str | None,
                response_body: bytes, response_headers: dict, stream: bool,
                truncated: bool, reason: str, owner: str, translated: bool,
                usage: dict | None, body_limit: int) -> dict:
    req = pretty(request_body, body_limit)
    resp = pretty(response_body, body_limit)
    return {
        "id": rid,
        "time": time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(started_at)),
        "started_at_ms": int(started_at * 1000),
        "model": record_kw.get("model"),
        "requested_model": record_kw.get("requested_model"),
        "protocol": record_kw.get("protocol"),
        "upstream_protocol": decision.get("upstream_protocol"),
        "provider_id": decision.get("provider_id") or "",
        "provider_name": decision.get("provider_name") or "",
        "path": record_kw.get("path"),
        "method": record_kw.get("method") or "POST",
        "status": status,
        "ok": bool(ok),
        "attempts": attempts,
        "duration_ms": round(duration_ms, 1),
        "session": record_kw.get("session"),
        "stream": bool(stream),
        "truncated": bool(truncated),
        "reason": reason or "",
        "owner": owner or "",
        "error": error or "",
        "input_tokens": (usage or {}).get("input_tokens"),
        "output_tokens": (usage or {}).get("output_tokens"),
        "cache_read_tokens": (usage or {}).get("cache_read_tokens"),
        "request_bytes": req["bytes"],
        "response_bytes": resp["bytes"],
        "translated": bool(translated),
        "request": {"headers": redact_headers(request_headers), **req},
        "response": {"headers": redact_headers(response_headers), **resp},
    }


__all__ = ["CaptureStore", "redact_headers", "pretty", "build_entry", "SECRET_HEADERS"]
