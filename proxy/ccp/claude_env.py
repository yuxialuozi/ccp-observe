# -*- coding: utf-8 -*-
"""Import the user's existing Claude Code configuration into ccp-observe.

The `ccp` command is meant to be a drop-in replacement for `claude`: the user
already points Claude Code at some gateway (``~/.claude/settings.json`` gives
``ANTHROPIC_BASE_URL`` plus a token), and we do not want them to retype any of
it. This module reads those settings, builds a provider from them, and stores
it as the default route — once. Later edits happen in the panel.

Nothing here needs the proxy to be running, so it is easy to unit test.
"""

from __future__ import annotations

import json
import os
import re
from urllib.parse import urlparse

SETTINGS_FILES = ("settings.json", "settings.local.json")

# Keys that describe where the client talks. ANTHROPIC_API_URL is the older
# name some setups still carry.
BASE_URL_KEYS = ("ANTHROPIC_BASE_URL", "ANTHROPIC_API_URL")

MODEL_KEYS = (
    "ANTHROPIC_MODEL",
    "ANTHROPIC_DEFAULT_OPUS_MODEL",
    "ANTHROPIC_DEFAULT_SONNET_MODEL",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL",
    "ANTHROPIC_SMALL_FAST_MODEL",
)


def claude_home() -> str:
    override = os.environ.get("CLAUDE_CONFIG_DIR")
    if override:
        return override
    return os.path.join(os.path.expanduser("~"), ".claude")


def _load_json(path: str) -> dict:
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def read_settings_env(home: str | None = None) -> dict:
    """Merge the ``env`` blocks of settings.json and settings.local.json.

    Local settings win, matching how Claude Code layers them.
    """
    home = home or claude_home()
    env: dict = {}
    for name in SETTINGS_FILES:
        block = _load_json(os.path.join(home, name)).get("env")
        if not isinstance(block, dict):
            continue
        for key, value in block.items():
            if isinstance(value, bool):
                continue
            text = str(value).strip()
            if text:
                env[str(key)] = text
    return env


def is_loopback_url(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return host in ("127.0.0.1", "localhost", "::1", "0.0.0.0")


def upstream_from_env(env: dict) -> str:
    """The real upstream, ignoring a base URL that already points at us."""
    for key in BASE_URL_KEYS:
        url = (env.get(key) or "").strip()
        if url and not is_loopback_url(url):
            return url
    return ""


def _slug(text: str, fallback: str = "claude-upstream") -> str:
    slug = re.sub(r"[^a-z0-9_-]+", "-", str(text or "").lower()).strip("-")
    return slug or fallback


def auth_header_from_env(env: dict) -> str:
    token = (env.get("ANTHROPIC_AUTH_TOKEN") or "").strip()
    if token:
        return "Authorization: Bearer %s" % token
    key = (env.get("ANTHROPIC_API_KEY") or "").strip()
    if key:
        return "x-api-key: %s" % key
    return ""


def models_from_env(env: dict) -> list[str]:
    seen = []
    for key in MODEL_KEYS:
        value = (env.get(key) or "").strip()
        if value and value not in seen:
            seen.append(value)
    return seen[:50]


def build_provider(env: dict) -> dict | None:
    """Turn a Claude Code ``env`` block into a ccp-observe provider entry."""
    base = upstream_from_env(env)
    if not base:
        return None
    netloc = urlparse(base).netloc or base
    provider = {
        "id": _slug(netloc),
        "name": netloc,
        "protocol": "anthropic",
        "base_url": base.rstrip("/"),
        "auth_header": auth_header_from_env(env),
        "models": models_from_env(env),
        "enabled": True,
        "note": "从 ~/.claude/settings.json 导入",
    }
    return provider


def describe(env: dict) -> dict:
    """Human-readable summary for `ccp --doctor`; contains no secrets."""
    base = upstream_from_env(env)
    provider = build_provider(env) or {}
    return {
        "claude_home": claude_home(),
        "upstream": base,
        "provider_id": provider.get("id", ""),
        "protocol": provider.get("protocol", ""),
        "auth": "已找到" if provider.get("auth_header") else "无（沿用客户端请求头）",
        "models": provider.get("models", []),
        "ignored_base_url": (env.get(BASE_URL_KEYS[0]) or "") if base and
        is_loopback_url(env.get(BASE_URL_KEYS[0]) or "") else "",
    }


def provider_for_agent(agent: str, *providers: dict | None) -> dict | None:
    """Pick the discovered provider that matches the client being launched."""
    by_agent = {"claude": "anthropic", "codex": "openai"}
    wanted = by_agent.get(agent or "")
    for provider in providers:
        if provider and wanted and provider.get("protocol") == wanted:
            return provider
    return None


def ensure_providers(store, candidates: list[dict], preferred_id: str = "",
                     force: bool = False) -> dict:
    """Merge discovered providers into the config store.

    Only providers whose id is not already present are added, unless
    ``force`` asks for a refresh. When the store is empty every candidate is
    imported; when the user already has configuration, only the provider for
    the client being launched is added. Panel edits are never overwritten.

    Returns ``{"imported": bool, "reason": str, "providers": [dict],
    "provider": dict|None, "default": str}``.
    """
    candidates = [p for p in candidates
                  if isinstance(p, dict) and p.get("id") and p.get("base_url")]
    if not candidates:
        return {"imported": False, "reason": "没有找到可用的上游地址",
                "providers": [], "provider": None, "default": ""}

    cfg = store.get()
    providers = list(cfg.get("providers") or [])
    existing = {p.get("id"): p for p in providers}
    has_config = bool(providers or cfg.get("upstream"))
    added: list[dict] = []

    for candidate in candidates:
        pid = candidate["id"]
        if pid in existing:
            if force:
                # Keep the id stable so routes pointing at it stay valid.
                merged = dict(existing[pid])
                merged.update(candidate)
                providers = [merged if p.get("id") == pid else p for p in providers]
                existing[pid] = merged
                added.append(merged)
            continue
        if not has_config or pid == preferred_id:
            providers.append(candidate)
            existing[pid] = candidate
            added.append(candidate)

    known = {p.get("id") for p in providers}
    current_default = cfg.get("default_provider") or ""
    default = current_default if current_default in known else ""
    if not default:
        if preferred_id in known:
            default = preferred_id
        else:
            default = next((p.get("id") for p in candidates if p.get("id") in known), "")

    if added or default != current_default:
        store.save({
            "providers": providers,
            "default_provider": default,
            "routes": cfg.get("routes") or [],
        })

    if added:
        reason = "已导入 %s" % "、".join(p.get("name") or p.get("id") for p in added)
    elif force:
        reason = "已刷新"
    else:
        reason = "已有配置，未覆盖"
    return {
        "imported": bool(added),
        "reason": reason,
        "providers": added,
        "provider": added[0] if added else candidates[0],
        "default": default,
    }
