# -*- coding: utf-8 -*-
"""Protocol helpers: path routing, model extraction, usage normalization."""

from __future__ import annotations

import json
import re
from typing import Any

ANTHROPIC_PATHS = ("/v1/messages", "/v1/messages/count_tokens")
OPENAI_SUFFIXES = ("/chat/completions", "/completions", "/responses", "/embeddings")
ANTHROPIC_HEADER = "x-api-key"
ANTHROPIC_VERSION = "anthropic-version"


def detect_protocol(path: str, headers: dict | None = None, body: dict | None = None) -> str:
    """Classify a request path as ``anthropic`` or ``openai``.

    Path wins. Headers and body shape are fallbacks for exotic clients.
    """
    p = path.split("?", 1)[0].rstrip("/").lower()
    if p.endswith("/v1/messages") or p.endswith("/messages") or "/messages/count_tokens" in p:
        return "anthropic"
    if any(p.endswith(s) for s in OPENAI_SUFFIXES):
        return "openai"
    headers = headers or {}
    lower = {str(k).lower(): v for k, v in headers.items()}
    if ANTHROPIC_VERSION in lower:
        return "anthropic"
    if "anthropic" in str(lower.get("user-agent", "")).lower():
        return "anthropic"
    if body:
        if "max_tokens" in body and "messages" in body and "tools" in body and "system" in body:
            return "anthropic"
        if "messages" in body and ("max_completion_tokens" in body or "max_tokens" in body):
            return "openai"
    return "openai"


def upstream_path(path: str, protocol: str) -> str:
    """Map the inbound path onto the upstream endpoint.

    Accepts both bare (``/v1/messages``) and prefixed (``/openai/v1/...``)
    inbound paths by keeping everything from the first ``/v1`` segment.
    """
    clean = path.split("?", 1)[0]
    idx = clean.find("/v1")
    if idx >= 0:
        clean = clean[idx:]
    if not clean.startswith("/"):
        clean = "/" + clean
    if protocol == "anthropic" and clean in ("/messages", "/messages/count_tokens"):
        clean = "/v1" + clean
    if protocol == "openai" and clean.startswith("/chat/completions"):
        clean = "/v1" + clean
    return clean


def join_upstream(base: str, path: str) -> str:
    """Join a configured base URL with the protocol path.

    If the base already contains ``/v1`` (e.g. ``https://host/openai/v1``),
    the duplicate prefix in ``path`` is dropped. If the base ends in a path
    but no ``/v1``, the path is appended verbatim.
    """
    base = (base or "").strip().rstrip("/")
    if not base:
        return ""
    if not re.match(r"^https?://", base, re.I):
        base = "https://" + base
    if base.endswith("/v1") and path.startswith("/v1/"):
        return base + path[3:]
    return base + path


def request_model(body: Any) -> str | None:
    if not isinstance(body, dict):
        return None
    model = body.get("model")
    return str(model) if model else None


_SESSION_KEYS = (
    "x-session-id", "session_id", "x-claude-code-session-id", "x-request-session",
)


def session_id(headers: dict | None, body: Any) -> str | None:
    lower = {str(k).lower(): v for k, v in (headers or {}).items()}
    for key in _SESSION_KEYS:
        val = lower.get(key)
        if val:
            return str(val)[:80]
    if isinstance(body, dict):
        meta = body.get("metadata")
        if isinstance(meta, dict):
            for key in ("session_id", "user_id"):
                if meta.get(key):
                    return str(meta[key])[:80]
    return None


def estimate_input_tokens(body: Any) -> int:
    """Rough token estimate for a local ``count_tokens`` answer.

    Only feeds Claude Code's context meter, so chars/4 over the parts that
    actually get sent is accurate enough — and it must never raise, because a
    broken estimate would break the turn it is trying to assist.
    """
    try:
        if isinstance(body, str):
            text = body
        else:
            text = json.dumps(body, ensure_ascii=False)
    except (TypeError, ValueError):
        text = str(body)
    return max(1, len(text) // 4)


def summarize_body(body: Any, limit: int = 400) -> str:
    """Small human-readable summary of the request body for error rows."""
    if body is None:
        return ""
    if isinstance(body, str):
        text = body
    else:
        try:
            text = json.dumps(body, ensure_ascii=False)
        except (TypeError, ValueError):
            text = str(body)
    text = re.sub(r"\s+", " ", text)
    return text[:limit] + ("…" if len(text) > limit else "")


def usage_from_anthropic(obj: dict) -> dict:
    usage = obj.get("usage") or {}
    if not isinstance(usage, dict):
        usage = {}
    out = {}
    if usage.get("input_tokens") is not None:
        out["input_tokens"] = int(usage["input_tokens"])
    if usage.get("output_tokens") is not None:
        out["output_tokens"] = int(usage["output_tokens"])
    if usage.get("cache_read_input_tokens") is not None:
        out["cache_read_tokens"] = int(usage["cache_read_input_tokens"])
    if usage.get("cache_creation_input_tokens") is not None:
        out["cache_write_tokens"] = int(usage["cache_creation_input_tokens"])
    return out


def usage_from_openai(obj: dict) -> dict:
    usage = obj.get("usage") or {}
    if not isinstance(usage, dict):
        usage = {}
    out = {}
    # Chat Completions says prompt/completion; the Responses API (Codex) says
    # input/output. Accept either so a non-streaming call is still counted.
    prompt = usage.get("prompt_tokens", usage.get("input_tokens"))
    completion = usage.get("completion_tokens", usage.get("output_tokens"))
    if prompt is not None:
        out["input_tokens"] = int(prompt)
    if completion is not None:
        out["output_tokens"] = int(completion)
    details = usage.get("prompt_tokens_details") or usage.get("input_tokens_details") or {}
    if isinstance(details, dict) and details.get("cached_tokens") is not None:
        out["cache_read_tokens"] = int(details["cached_tokens"])
    return out


def model_from_response(protocol: str, obj: dict) -> str | None:
    if not isinstance(obj, dict):
        return None
    if protocol == "anthropic":
        msg = obj.get("message") if isinstance(obj.get("message"), dict) else obj
        if msg.get("model"):
            return str(msg["model"])
    if obj.get("model"):
        return str(obj["model"])
    return None


def json_or_none(text: str) -> Any:
    try:
        return json.loads(text)
    except (ValueError, TypeError):
        return None


__all__ = [
    "detect_protocol", "upstream_path", "join_upstream", "request_model",
    "session_id", "summarize_body", "estimate_input_tokens",
    "usage_from_anthropic", "usage_from_openai",
    "model_from_response", "json_or_none",
]
