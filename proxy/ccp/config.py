# -*- coding: utf-8 -*-
"""Configuration persistence for the ccp-observe proxy.

Three layers, lowest priority first:

1. ``default_config()``   - safe, vendor-neutral defaults (empty upstream).
2. ``config.json``        - written by the panel through ``POST /_ccp/api/config``.
3. ``CCP_*`` env vars     - for the desktop sidecar and CI runs.

Two ways to describe where requests go:

* **providers + routes** (preferred): a list of named upstreams, each with its
  own protocol, base URL and auth, plus glob rules mapping model names onto
  them. This is what the 供应商 / 路由 pages edit.
* **legacy single upstream**: ``upstream`` / ``upstream_anthropic`` /
  ``upstream_openai``. Still honoured when no provider matches, so existing
  configs keep working.

Nothing in this project hardcodes a real upstream. Every example uses
``example.internal`` placeholders so the proxy works on any network.
"""

from __future__ import annotations

import json
import os
import re
import threading

CONFIG_FILE_NAME = "config.json"

PROTOCOLS = ("auto", "anthropic", "openai")

DEFAULT_CONFIG = {
    # Legacy single-upstream mode.
    "upstream": "",
    "client_protocol": "auto",
    "retries": 3,
    "retry_backoff_ms": 600,
    "model_map": {},
    "history_limit": 500,
    "upstream_anthropic": "",
    "upstream_openai": "",
    "upstream_auth_header": "",
    "connect_timeout_s": 15,
    "read_timeout_s": 900,
    # Provider / routing mode.
    "providers": [],
    "routes": [],
    "default_provider": "",
    "translate": True,
    # Capture.
    "capture_enabled": True,
    "capture_limit": 200,
    "capture_body_limit": 262144,
    # Answer /v1/messages/count_tokens locally instead of forwarding it: most
    # gateways 404 it, and an estimate is enough for the client's context meter.
    "local_count_tokens": True,
    # Some gateways answer a valid request with 400 "invalid JSON request body"
    # under load. These substrings mark such a flake as retryable; an empty list
    # means every 400 fails fast.
    "retry_400_patterns": ["invalid JSON request body"],
    # Daily usage totals are persisted to state/usage.json; they outlive the
    # in-memory request ring so yesterday's numbers are still there tomorrow.
    "usage_enabled": True,
    "usage_retain_days": 120,
}


def _env(name: str) -> str | None:
    value = os.environ.get(name)
    if value is None or value.strip() == "":
        return None
    return value.strip()


def _as_bool(value: str) -> bool:
    return str(value).strip().lower() in ("1", "true", "yes", "on")


def _slug(text: str, fallback: str = "provider") -> str:
    slug = re.sub(r"[^a-z0-9_-]+", "-", str(text or "").strip().lower()).strip("-")
    return slug or fallback


def state_dir() -> str:
    """Directory that stores config + history.

    Defaults to ``<proxy dir>/state``; override with ``CCP_STATE_DIR``.
    """
    override = _env("CCP_STATE_DIR")
    if override:
        return os.path.abspath(override)
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(here, "state")


def clean_provider(raw: dict, index: int = 0) -> dict | None:
    """Validate one provider entry. Returns ``None`` when unusable."""
    if not isinstance(raw, dict):
        return None
    name = str(raw.get("name") or raw.get("id") or "").strip()
    base = str(raw.get("base_url") or raw.get("url") or "").strip()
    if not name and not base:
        return None
    pid = _slug(raw.get("id") or name or ("provider-%d" % (index + 1)))
    protocol = str(raw.get("protocol") or "auto").strip().lower()
    if protocol not in PROTOCOLS:
        protocol = "auto"
    models = raw.get("models") or []
    if isinstance(models, str):
        models = [m for m in re.split(r"[,\s]+", models) if m]
    clean_models = [str(m).strip() for m in models if str(m).strip()][:50]
    return {
        "id": pid,
        "name": name or pid,
        "protocol": protocol,
        "base_url": base,
        "auth_header": str(raw.get("auth_header") or "").strip(),
        "models": clean_models,
        "enabled": bool(raw.get("enabled", True)),
        "note": str(raw.get("note") or "").strip()[:200],
    }


def clean_routes(raw) -> list[dict]:
    if not isinstance(raw, list):
        return []
    out = []
    for item in raw[:200]:
        if isinstance(item, str) and "=" in item:
            match, provider = item.split("=", 1)
        elif isinstance(item, dict):
            match = item.get("match") or item.get("pattern") or ""
            provider = item.get("provider") or ""
        else:
            continue
        match = str(match).strip()
        provider = _slug(provider) if str(provider).strip() else ""
        if match and provider:
            out.append({"match": match, "provider": provider})
    return out


class ConfigStore:
    """Thread-safe config holder that also knows how to validate input."""

    def __init__(self, base_dir: str | None = None):
        self._base = base_dir or state_dir()
        self._lock = threading.RLock()
        self._config = dict(DEFAULT_CONFIG)
        os.makedirs(self._base, exist_ok=True)
        self._load()

    # -- paths -------------------------------------------------------------
    @property
    def path(self) -> str:
        return os.path.join(self._base, CONFIG_FILE_NAME)

    # -- load / save -------------------------------------------------------
    def _load(self) -> None:
        merged = dict(DEFAULT_CONFIG)
        if os.path.exists(self.path):
            try:
                with open(self.path, "r", encoding="utf-8") as fh:
                    stored = json.load(fh)
                if isinstance(stored, dict):
                    merged.update(self._sanitize(stored, partial=True))
            except (OSError, ValueError):
                pass
        merged.update(self._from_env())
        self._config = merged

    def _from_env(self) -> dict:
        env: dict = {}
        if _env("CCP_UPSTREAM"):
            env["upstream"] = _env("CCP_UPSTREAM")
        if _env("CCP_UPSTREAM_ANTHROPIC"):
            env["upstream_anthropic"] = _env("CCP_UPSTREAM_ANTHROPIC")
        if _env("CCP_UPSTREAM_OPENAI"):
            env["upstream_openai"] = _env("CCP_UPSTREAM_OPENAI")
        if _env("CCP_UPSTREAM_AUTH_HEADER"):
            env["upstream_auth_header"] = _env("CCP_UPSTREAM_AUTH_HEADER")
        if _env("CCP_RETRIES"):
            try:
                env["retries"] = max(0, int(_env("CCP_RETRIES") or "0"))
            except ValueError:
                pass
        if _env("CCP_HISTORY_LIMIT"):
            try:
                env["history_limit"] = max(1, int(_env("CCP_HISTORY_LIMIT") or "0"))
            except ValueError:
                pass
        if _env("CCP_MODEL_MAP"):
            mapping = {}
            for line in (_env("CCP_MODEL_MAP") or "").split(","):
                if "=" in line:
                    src, dst = line.split("=", 1)
                    if src.strip() and dst.strip():
                        mapping[src.strip()] = dst.strip()
            if mapping:
                env["model_map"] = mapping
        raw_providers = _env("CCP_PROVIDERS_JSON")
        if raw_providers:
            try:
                parsed = json.loads(raw_providers)
                if isinstance(parsed, list):
                    env["providers"] = parsed
            except ValueError:
                pass
        return env

    def _sanitize(self, raw: dict, partial: bool = False) -> dict:
        out: dict = {}
        if "upstream" in raw:
            out["upstream"] = str(raw.get("upstream") or "").strip()
        if "upstream_anthropic" in raw:
            out["upstream_anthropic"] = str(raw.get("upstream_anthropic") or "").strip()
        if "upstream_openai" in raw:
            out["upstream_openai"] = str(raw.get("upstream_openai") or "").strip()
        if "upstream_auth_header" in raw:
            out["upstream_auth_header"] = str(raw.get("upstream_auth_header") or "").strip()
        if "client_protocol" in raw:
            proto = str(raw.get("client_protocol") or "auto").strip().lower()
            out["client_protocol"] = proto if proto in PROTOCOLS else "auto"
        if "retries" in raw:
            out["retries"] = max(0, min(20, int(raw.get("retries") or 0)))
        if "retry_backoff_ms" in raw:
            out["retry_backoff_ms"] = max(0, min(60000, int(raw.get("retry_backoff_ms") or 0)))
        if "history_limit" in raw:
            out["history_limit"] = max(1, min(20000, int(raw.get("history_limit") or 1)))
        if "connect_timeout_s" in raw:
            out["connect_timeout_s"] = max(1, min(300, int(raw.get("connect_timeout_s") or 1)))
        if "read_timeout_s" in raw:
            out["read_timeout_s"] = max(1, min(3600, int(raw.get("read_timeout_s") or 1)))
        if "model_map" in raw:
            mapping = raw.get("model_map") or {}
            clean = {}
            if isinstance(mapping, dict):
                for k, v in mapping.items():
                    key, val = str(k).strip(), str(v).strip()
                    if key and val:
                        clean[key] = val
            out["model_map"] = clean

        if "providers" in raw:
            raw_list = raw.get("providers") or []
            providers = []
            seen = set()
            if isinstance(raw_list, list):
                for idx, item in enumerate(raw_list[:50]):
                    prov = clean_provider(item, idx)
                    if prov is None:
                        continue
                    base_id = prov["id"]
                    suffix = 2
                    while prov["id"] in seen:
                        prov["id"] = "%s-%d" % (base_id, suffix)
                        suffix += 1
                    seen.add(prov["id"])
                    providers.append(prov)
            out["providers"] = providers
        if "routes" in raw:
            out["routes"] = clean_routes(raw.get("routes"))
        if "default_provider" in raw:
            out["default_provider"] = _slug(raw.get("default_provider")) if str(
                raw.get("default_provider") or "").strip() else ""
        if "translate" in raw:
            out["translate"] = bool(raw.get("translate"))
        if "capture_enabled" in raw:
            out["capture_enabled"] = bool(raw.get("capture_enabled"))
        if "capture_limit" in raw:
            out["capture_limit"] = max(1, min(2000, int(raw.get("capture_limit") or 1)))
        if "capture_body_limit" in raw:
            out["capture_body_limit"] = max(1024, min(4_000_000, int(raw.get("capture_body_limit") or 1024)))
        if "local_count_tokens" in raw:
            out["local_count_tokens"] = bool(raw.get("local_count_tokens"))
        if "retry_400_patterns" in raw:
            items = raw.get("retry_400_patterns") or []
            if isinstance(items, str):
                items = [items]
            out["retry_400_patterns"] = [
                str(p).strip() for p in items if str(p).strip()
            ][:10]
        if "usage_enabled" in raw:
            out["usage_enabled"] = bool(raw.get("usage_enabled"))
        if "usage_retain_days" in raw:
            out["usage_retain_days"] = max(7, min(730, int(raw.get("usage_retain_days") or 120)))
        return out

    def save(self, patch: dict) -> dict:
        """Validate + persist a partial config patch, then return the result."""
        with self._lock:
            clean = self._sanitize(patch or {}, partial=True)
            merged = dict(self._config)
            merged.update(clean)
            # A removed default provider would otherwise dangle.
            ids = {p["id"] for p in merged.get("providers", [])}
            if merged.get("default_provider") and merged["default_provider"] not in ids:
                merged["default_provider"] = ""
            merged["routes"] = [r for r in merged.get("routes", []) if r["provider"] in ids] \
                if ids else merged.get("routes", [])
            self._config = merged
            tmp = self.path + ".tmp"
            with open(tmp, "w", encoding="utf-8") as fh:
                json.dump(self._config, fh, ensure_ascii=False, indent=2)
            os.replace(tmp, self.path)
            return dict(self._config)

    # -- read --------------------------------------------------------------
    def get(self) -> dict:
        with self._lock:
            return dict(self._config)

    def providers(self) -> list[dict]:
        with self._lock:
            return [dict(p) for p in self._config.get("providers", [])]

    def provider(self, pid: str) -> dict | None:
        with self._lock:
            for prov in self._config.get("providers", []):
                if prov.get("id") == pid:
                    return dict(prov)
        return None

    def upstream_for(self, protocol: str) -> str:
        cfg = self._config
        if protocol == "anthropic" and cfg.get("upstream_anthropic"):
            return cfg["upstream_anthropic"]
        if protocol == "openai" and cfg.get("upstream_openai"):
            return cfg["upstream_openai"]
        return cfg.get("upstream") or ""


__all__ = [
    "ConfigStore", "DEFAULT_CONFIG", "state_dir", "_as_bool",
    "clean_provider", "clean_routes", "PROTOCOLS",
]
