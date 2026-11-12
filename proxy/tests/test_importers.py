# -*- coding: utf-8 -*-
"""Unit tests for the Claude Code / Codex configuration importers."""

import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from ccp import claude_env, codex_env  # noqa: E402
from ccp.config import ConfigStore  # noqa: E402


CODEX_TOML = """\
model = "gpt-test"
model_provider = "gw"

[model_providers.gw]
name = "Test Gateway"
base_url = "https://gw.example/v1"
wire_api = "responses"
env_key = "CCP_TEST_CODEX_KEY"
"""


class CodexEnvTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.home = self.tmp.name
        with open(os.path.join(self.home, "config.toml"), "w", encoding="utf-8") as fh:
            fh.write(CODEX_TOML)

    def tearDown(self):
        self.tmp.cleanup()
        os.environ.pop("CCP_TEST_CODEX_KEY", None)

    def test_builds_openai_provider(self):
        provider = codex_env.build_provider(self.home)
        self.assertIsNotNone(provider)
        self.assertEqual(provider["id"], "codex-gw")
        self.assertEqual(provider["protocol"], "openai")
        self.assertEqual(provider["base_url"], "https://gw.example/v1")
        self.assertEqual(provider["models"], ["gpt-test"])

    def test_reads_key_from_auth_json(self):
        with open(os.path.join(self.home, "auth.json"), "w", encoding="utf-8") as fh:
            fh.write('{"OPENAI_API_KEY": "sk-from-auth"}')
        provider = codex_env.build_provider(self.home)
        self.assertEqual(provider["auth_header"],
                         "Authorization: Bearer sk-from-auth")

    def test_env_key_wins_over_auth_json(self):
        os.environ["CCP_TEST_CODEX_KEY"] = "sk-from-env"
        with open(os.path.join(self.home, "auth.json"), "w", encoding="utf-8") as fh:
            fh.write('{"OPENAI_API_KEY": "sk-from-auth"}')
        provider = codex_env.build_provider(self.home)
        self.assertEqual(provider["auth_header"],
                         "Authorization: Bearer sk-from-env")

    def test_missing_config_returns_none(self):
        empty = tempfile.TemporaryDirectory()
        try:
            self.assertIsNone(codex_env.build_provider(empty.name))
        finally:
            empty.cleanup()

    def test_fallback_toml_reader_handles_sections(self):
        parsed = codex_env._simple_toml(CODEX_TOML)
        self.assertEqual(parsed["model"], "gpt-test")
        self.assertEqual(parsed["model_providers"]["gw"]["base_url"],
                         "https://gw.example/v1")

    def test_fallback_toml_reader_handles_booleans_and_quotes(self):
        parsed = codex_env._simple_toml(
            '[model_providers.gw]\nrequires_openai_auth = true\n'
            'note = "a # not a comment"\n')
        entry = parsed["model_providers"]["gw"]
        self.assertIs(entry["requires_openai_auth"], True)
        self.assertEqual(entry["note"], "a # not a comment")


class EnsureProvidersTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = ConfigStore(self.tmp.name)
        self.claude = {
            "id": "claude-gw", "name": "Claude GW", "protocol": "anthropic",
            "base_url": "https://claude.example", "auth_header": "",
            "models": [], "enabled": True, "note": "",
        }
        self.codex = {
            "id": "codex-gw", "name": "Codex GW", "protocol": "openai",
            "base_url": "https://codex.example/v1", "auth_header": "",
            "models": ["gpt-test"], "enabled": True, "note": "",
        }

    def tearDown(self):
        self.tmp.cleanup()

    def test_empty_store_imports_everything(self):
        result = claude_env.ensure_providers(
            self.store, [self.claude, self.codex], self.codex["id"])
        ids = [p["id"] for p in self.store.get()["providers"]]
        self.assertEqual(ids, ["claude-gw", "codex-gw"])
        self.assertEqual(self.store.get()["default_provider"], "codex-gw")
        self.assertEqual(len(result["providers"]), 2)

    def test_existing_config_only_gains_the_wanted_provider(self):
        claude_env.ensure_providers(self.store, [self.claude], self.claude["id"])
        claude_env.ensure_providers(self.store, [self.claude, self.codex],
                                    self.codex["id"])
        ids = [p["id"] for p in self.store.get()["providers"]]
        self.assertEqual(ids, ["claude-gw", "codex-gw"])

    def test_existing_panel_edit_is_not_overwritten_without_force(self):
        claude_env.ensure_providers(self.store, [self.claude], self.claude["id"])
        edited = dict(self.claude, base_url="https://edited.example")
        claude_env.ensure_providers(self.store, [edited], self.claude["id"])
        self.assertEqual(self.store.get()["providers"][0]["base_url"],
                         self.claude["base_url"])

    def test_force_refreshes_in_place(self):
        claude_env.ensure_providers(self.store, [self.claude], self.claude["id"])
        edited = dict(self.claude, base_url="https://edited.example")
        claude_env.ensure_providers(self.store, [edited], self.claude["id"],
                                    force=True)
        providers = self.store.get()["providers"]
        self.assertEqual(len(providers), 1)
        self.assertEqual(providers[0]["base_url"], "https://edited.example")

    def test_provider_for_agent_matches_protocol(self):
        self.assertIs(claude_env.provider_for_agent(
            "codex", self.claude, self.codex), self.codex)
        self.assertIs(claude_env.provider_for_agent(
            "claude", self.claude, self.codex), self.claude)


if __name__ == "__main__":
    unittest.main()
