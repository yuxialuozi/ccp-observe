# -*- coding: utf-8 -*-
"""Find upstreams already configured in the installed AI clients.

The `ccp` launcher and the proxy entry point both use this so a fresh install
never starts with an empty provider list. A Codex-only machine has no
``~/.claude/settings.json`` and a Claude-only machine has no
``~/.codex/config.toml``; whichever exists is imported.
"""

from __future__ import annotations

from . import claude_env, codex_env


def providers(env: dict | None = None) -> list[dict]:
    """Providers discovered from Claude Code settings and Codex config."""
    env = claude_env.read_settings_env() if env is None else env
    found = []
    for provider in (claude_env.build_provider(env), codex_env.build_provider()):
        if provider:
            found.append(provider)
    return found


def import_all(store, preferred_id: str = "", force: bool = False,
               env: dict | None = None) -> dict:
    """Import every discovered provider, respecting existing panel config."""
    return claude_env.ensure_providers(store, providers(env), preferred_id,
                                       force=force)


__all__ = ["providers", "import_all"]
