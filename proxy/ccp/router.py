# -*- coding: utf-8 -*-
"""Model routing: pick a provider for one request.

Rules are evaluated top-down, first match wins. A rule matches either a model
glob against the request body's ``model`` field or a path glob when the
pattern starts with ``/``. Behind explicit rules there are three fallbacks,
in order: a provider that advertises the model in its ``models`` list, the
configured default provider, then the legacy single ``upstream``.

The router never mutates the request; it only decides where it goes and
whether the wire format has to be translated.
"""

from __future__ import annotations

import fnmatch
import re


def _glob(pattern: str, value: str) -> bool:
    pattern = (pattern or "").strip()
    if not pattern:
        return False
    if pattern in ("*", "**"):
        return True
    # fnmatch is case-insensitive on Windows; model ids are not, so normalise.
    return fnmatch.fnmatchcase(value or "", pattern)


def _provider_index(providers: list[dict]) -> dict[str, dict]:
    return {p.get("id"): p for p in providers or [] if p.get("id")}


def _usable(provider: dict | None) -> bool:
    if not provider:
        return False
    if not provider.get("enabled", True):
        return False
    return bool((provider.get("base_url") or "").strip())


def _protocols(provider: dict, client_protocol: str, translate: bool) -> tuple[str, bool]:
    """Return ``(upstream_protocol, needs_translation)``."""
    declared = (provider.get("protocol") or "auto").lower()
    if declared not in ("anthropic", "openai"):
        return client_protocol, False
    if declared == client_protocol:
        return declared, False
    if translate:
        return declared, True
    # Translation disabled: speak the provider's dialect on its own terms only
    # if the client already speaks it, otherwise keep the client's format and
    # let the upstream reject it — silently rewriting would be worse.
    return client_protocol, False


def resolve(config: dict, client_protocol: str, model: str, path: str) -> dict:
    """Decide the upstream for one request.

    Returns a dict with ``provider`` (or ``None``), ``base_url``,
    ``auth_header``, ``upstream_protocol``, ``translate``, ``matched`` (which
    rule fired) and ``source`` (``rule`` / ``models`` / ``default`` /
    ``legacy`` / ``none``).
    """
    providers = _provider_index(config.get("providers") or [])
    translate_allowed = bool(config.get("translate", True))
    target_path = path.split("?", 1)[0]
    model = (model or "").strip()

    for rule in config.get("routes") or []:
        pattern = rule.get("match") or ""
        if pattern.startswith("/"):
            if not _glob(pattern, target_path):
                continue
        elif not _glob(pattern, model):
            continue
        provider = providers.get(rule.get("provider") or "")
        if not _usable(provider):
            continue
        upstream_protocol, translate = _protocols(provider, client_protocol, translate_allowed)
        return _decision(provider, upstream_protocol, translate, "rule", pattern)

    # A provider that lists this exact model is an implicit route.
    for provider in providers.values():
        if not _usable(provider):
            continue
        if model and model in (provider.get("models") or []):
            upstream_protocol, translate = _protocols(provider, client_protocol, translate_allowed)
            return _decision(provider, upstream_protocol, translate, "models", "models[]")

    default_id = config.get("default_provider") or ""
    if default_id and _usable(providers.get(default_id)):
        provider = providers[default_id]
        upstream_protocol, translate = _protocols(provider, client_protocol, translate_allowed)
        return _decision(provider, upstream_protocol, translate, "default", "default_provider")

    # Legacy single-upstream mode.
    legacy = ""
    if client_protocol == "anthropic" and config.get("upstream_anthropic"):
        legacy = config["upstream_anthropic"]
    elif client_protocol == "openai" and config.get("upstream_openai"):
        legacy = config["upstream_openai"]
    legacy = legacy or config.get("upstream") or ""
    if legacy.strip():
        return {
            "provider": None,
            "provider_id": "",
            "provider_name": "",
            "base_url": legacy.strip(),
            "auth_header": (config.get("upstream_auth_header") or "").strip(),
            "upstream_protocol": client_protocol,
            "translate": False,
            "matched": "",
            "source": "legacy",
        }

    return {
        "provider": None,
        "provider_id": "",
        "provider_name": "",
        "base_url": "",
        "auth_header": "",
        "upstream_protocol": client_protocol,
        "translate": False,
        "matched": "",
        "source": "none",
    }


def _decision(provider: dict, upstream_protocol: str, translate: bool,
              source: str, matched: str) -> dict:
    return {
        "provider": provider,
        "provider_id": provider.get("id") or "",
        "provider_name": provider.get("name") or provider.get("id") or "",
        "base_url": (provider.get("base_url") or "").strip(),
        "auth_header": (provider.get("auth_header") or "").strip(),
        "upstream_protocol": upstream_protocol,
        "translate": bool(translate),
        "matched": matched,
        "source": source,
    }


def explain(config: dict, client_protocol: str, model: str, path: str = "/v1/messages") -> dict:
    """Panel-facing dry run: same decision, serialisable."""
    d = resolve(config, client_protocol, model, path)
    provider = d.get("provider") or {}
    return {
        "model": model,
        "client_protocol": client_protocol,
        "provider_id": d.get("provider_id"),
        "provider_name": d.get("provider_name"),
        "base_url": d.get("base_url"),
        "upstream_protocol": d.get("upstream_protocol"),
        "translate": d.get("translate"),
        "source": d.get("source"),
        "matched": d.get("matched"),
        "enabled": provider.get("enabled", True) if provider else None,
    }


def validate_rule(match: str) -> str:
    """Return an error string, or ``''`` when the pattern is usable."""
    match = (match or "").strip()
    if not match:
        return "匹配模式不能为空"
    if match.startswith("/"):
        return ""
    if match.count("[") != match.count("]"):
        return "字符组括号不匹配"
    if re.search(r"\s", match):
        return "模型匹配模式不能包含空白字符"
    return ""


__all__ = ["resolve", "explain", "validate_rule"]
