# -*- coding: utf-8 -*-
"""Import the user's existing Codex configuration into ccp-observe.

Claude Code keeps its gateway in ``~/.claude/settings.json``; Codex keeps the
same information in ``~/.codex/config.toml`` (``model_provider`` plus a
``[model_providers.<id>]`` block) and ``~/.codex/auth.json`` (the API key).
A Codex-only user has no Claude settings at all, so without this module `ccp`
would start the proxy with no upstream and every request would come back
``upstream_not_configured``.

The TOML is read with the standard library on Python 3.11+, and with a small
line-based reader on older versions. Only the handful of keys ccp needs are
interpreted, which keeps the project dependency-free.
"""

from __future__ import annotations

import json
import os
import re

CONFIG_FILE = "config.toml"
AUTH_FILE = "auth.json"

DEFAULT_ENV_KEY = "OPENAI_API_KEY"


# --------------------------------------------------------------------- paths

def codex_home() -> str:
    override = os.environ.get("CODEX_HOME")
    if override:
        return override
    return os.path.join(os.path.expanduser("~"), ".codex")


def config_path(home: str | None = None) -> str:
    return os.path.join(home or codex_home(), CONFIG_FILE)


def auth_path(home: str | None = None) -> str:
    return os.path.join(home or codex_home(), AUTH_FILE)


def _slug(text: str, fallback: str = "codex-upstream") -> str:
    slug = re.sub(r"[^a-z0-9_-]+", "-", str(text or "").lower()).strip("-")
    return slug or fallback


# ---------------------------------------------------------------------- toml
#
# tomllib exists from 3.11; the project still supports 3.9. The fallback is
# deliberately narrow: Codex configs are flat key/value pairs inside section
# tables, which is all we have to read here.

def _simple_toml(text: str) -> dict:
    data: dict = {}
    section: dict | None = data
    for raw_line in text.splitlines():
        line = _strip_comment(raw_line).strip()
        if not line:
            continue
        if line.startswith("[") and line.endswith("]"):
            name = line[1:-1].strip()
            section = data
            for part in name.split("."):
                part = part.strip().strip('"').strip("'")
                if not part:
                    section = None
                    break
                child = section.get(part)
                if not isinstance(child, dict):
                    child = {}
                    section[part] = child
                section = child
            continue
        if "=" not in line or section is None:
            continue
        key, _, value = line.partition("=")
        key = key.strip().strip('"').strip("'")
        if key:
            section[key] = _scalar(value.strip())
    return data


def _strip_comment(line: str) -> str:
    quote = ""
    for idx, char in enumerate(line):
        if quote:
            if char == quote:
                quote = ""
        elif char in ('"', "'"):
            quote = char
        elif char == "#":
            return line[:idx]
    return line


def _scalar(value: str):
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
        return value[1:-1]
    lowered = value.lower()
    if lowered in ("true", "false"):
        return lowered == "true"
    for cast in (int, float):
        try:
            return cast(value)
        except ValueError:
            pass
    return value


def load_toml(path: str) -> dict:
    try:
        with open(path, "rb") as fh:
            raw = fh.read()
    except OSError:
        return {}
    text = raw.decode("utf-8", "replace")
    for loader in (_stdlib_toml, _tomli):
        parsed = loader(text)
        if parsed is not None:
            return parsed if isinstance(parsed, dict) else {}
    return _simple_toml(text)


def _stdlib_toml(text: str):
    try:
        import tomllib  # type: ignore[import-not-found]
    except ImportError:
        return None
    try:
        return tomllib.loads(text)
    except ValueError:
        return {}


def _tomli(text: str):
    try:
        import tomli  # type: ignore[import-not-found]
    except ImportError:
        return None
    try:
        return tomli.loads(text)
    except ValueError:
        return {}


# -------------------------------------------------------------------- config

def read_config(home: str | None = None) -> dict:
    cfg = load_toml(config_path(home))
    return cfg if isinstance(cfg, dict) else {}


def read_auth(home: str | None = None) -> dict:
    try:
        with open(auth_path(home), "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def provider_entries(cfg: dict) -> dict[str, dict]:
    raw = cfg.get("model_providers")
    if not isinstance(raw, dict):
        return {}
    return {str(key): value for key, value in raw.items()
            if isinstance(value, dict)}


def active_provider_id(cfg: dict) -> str:
    """The provider Codex itself would use: top-level ref, or the only one."""
    wanted = str(cfg.get("model_provider") or "").strip()
    entries = provider_entries(cfg)
    if wanted and wanted in entries:
        return wanted
    if len(entries) == 1:
        return next(iter(entries))
    return ""


def _bearer(value: str) -> str:
    value = (value or "").strip()
    return "Authorization: Bearer %s" % value if value else ""


def auth_header_for(provider_id: str, cfg: dict, home: str | None = None) -> str:
    """Find the credential Codex would send for this provider.

    Order matches how Codex resolves it: an explicit bearer token in the
    provider block, then the provider's ``env_key``, then ``auth.json``.
    OAuth-only logins have no importable static key; those are left empty and
    the client's own header passes through instead.
    """
    entry = provider_entries(cfg).get(provider_id) or {}
    explicit = entry.get("experimental_bearer_token") or entry.get("bearer_token")
    if isinstance(explicit, str) and explicit.strip():
        return _bearer(explicit)

    env_key = str(entry.get("env_key") or DEFAULT_ENV_KEY).strip()
    value = (os.environ.get(env_key) or "").strip()
    if value:
        return _bearer(value)

    auth = read_auth(home)
    key = str(auth.get("OPENAI_API_KEY") or "").strip()
    if key:
        return _bearer(key)
    return ""


def models_from_config(cfg: dict) -> list[str]:
    seen: list[str] = []
    for value in (cfg.get("model"), cfg.get("review_model")):
        text = str(value or "").strip()
        if text and text not in seen:
            seen.append(text)
    return seen[:50]


def build_provider(home: str | None = None, cfg: dict | None = None) -> dict | None:
    """Turn Codex's active ``model_provider`` into a ccp-observe provider."""
    cfg = cfg if isinstance(cfg, dict) else read_config(home)
    provider_id = active_provider_id(cfg)
    if not provider_id:
        return None
    entry = provider_entries(cfg).get(provider_id) or {}
    base = str(entry.get("base_url") or "").strip()
    if not base:
        return None
    name = str(entry.get("name") or provider_id).strip() or provider_id
    return {
        "id": "codex-" + _slug(provider_id),
        "name": name,
        "protocol": "openai",
        "base_url": base.rstrip("/"),
        "auth_header": auth_header_for(provider_id, cfg, home),
        "models": models_from_config(cfg),
        "enabled": True,
        "note": "从 %s 导入" % config_path(home),
    }


def describe(home: str | None = None, cfg: dict | None = None) -> dict:
    """Summary for `ccp --doctor`, without leaking the credential."""
    cfg = cfg if isinstance(cfg, dict) else read_config(home)
    provider_id = active_provider_id(cfg)
    entry = provider_entries(cfg).get(provider_id) or {}
    provider = build_provider(home, cfg) or {}
    return {
        "codex_home": home or codex_home(),
        "provider_id": provider_id,
        "upstream": provider.get("base_url", ""),
        "auth": "已找到" if provider.get("auth_header") else "无（沿用客户端请求头）",
        "models": provider.get("models", []),
        "wire_api": str(entry.get("wire_api") or "").strip(),
    }


__all__ = [
    "codex_home", "config_path", "auth_path", "load_toml", "read_config",
    "read_auth", "build_provider", "describe", "active_provider_id",
]
