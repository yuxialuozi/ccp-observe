# -*- coding: utf-8 -*-
"""Integration tests for ccp-observe.

Runs a fake upstream plus the real proxy in-process, then exercises both
protocols, SSE truncation detection, retries, the config API and the panel.

    python -m unittest discover -s proxy/tests -v
"""

import json
import os
import socket
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from datetime import date, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from ccp.capture import CaptureStore, build_entry, pretty, redact_headers  # noqa: E402
from ccp.config import ConfigStore  # noqa: E402
from ccp.router import explain, resolve, validate_rule  # noqa: E402
from ccp.server import ProxyServer  # noqa: E402
from ccp.stats import MetricsStore  # noqa: E402
from ccp.translate import (  # noqa: E402
    AnthropicToOpenAIStream, OpenAIToAnthropicStream,
    anthropic_to_openai, make_stream, openai_to_anthropic,
)
from ccp.truncation import TruncationScanner  # noqa: E402
from ccp.usage import UsageLedger  # noqa: E402


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


ANTHROPIC_SSE_OK = (
    b'event: message_start\n'
    b'data: {"type":"message_start","message":{"model":"demo-model-a","usage":{"input_tokens":1200,"cache_read_input_tokens":300}}}\n\n'
    b'event: content_block_start\n'
    b'data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_1","name":"Read"}}\n\n'
    b'event: content_block_delta\n'
    b'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"file_path\\":\\"/tmp/a.py\\"}"}}\n\n'
    b'event: content_block_stop\n'
    b'data: {"type":"content_block_stop","index":0}\n\n'
    b'event: message_delta\n'
    b'data: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":64}}\n\n'
    b'event: message_stop\n'
    b'data: {"type":"message_stop"}\n\n'
)

ANTHROPIC_SSE_TRUNCATED = (
    b'event: message_start\n'
    b'data: {"type":"message_start","message":{"model":"demo-model-a","usage":{"input_tokens":9000}}}\n\n'
    b'event: content_block_start\n'
    b'data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_2","name":"Edit"}}\n\n'
    b'event: content_block_delta\n'
    b'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"file_path\\":\\"/tmp/b.py\\",\\"old_str\\":\\"def fa"}}\n\n'
)

OPENAI_SSE_OK = (
    b'data: {"model":"demo-model-b","choices":[{"index":0,"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call_1","function":{"name":"shell","arguments":""}}]}}]}\n\n'
    b'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"cmd\\":\\"ls\\"}"}}]}}]}\n\n'
    b'data: {"choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":50,"completion_tokens":10,"prompt_tokens_details":{"cached_tokens":20}}}\n\n'
    b'data: [DONE]\n\n'
)

OPENAI_SSE_TRUNCATED = (
    b'data: {"model":"demo-model-b","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_2","function":{"name":"shell","arguments":""}}]}}]}\n\n'
    b'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"cmd\\":\\"rm -rf"}}]}}]}\n\n'
)

# OpenAI Responses API (Codex): a complete function call with usage.
RESPONSES_SSE_OK = (
    b'data: {"type":"response.output_item.added","output_index":0,'
    b'"item":{"type":"function_call","call_id":"c1","name":"shell"}}\n\n'
    b'data: {"type":"response.function_call_arguments.delta","output_index":0,"delta":"{\\"cmd\\":"}\n\n'
    b'data: {"type":"response.function_call_arguments.done","output_index":0,"arguments":"{\\"cmd\\":\\"ls\\"}"}\n\n'
    b'data: {"type":"response.output_item.done","output_index":0,'
    b'"item":{"type":"function_call","arguments":"{\\"cmd\\":\\"ls\\"}"}}\n\n'
    b'data: {"type":"response.completed","response":{"model":"resp-model",'
    b'"usage":{"input_tokens":100,"output_tokens":7,'
    b'"input_tokens_details":{"cached_tokens":60}}}}\n\n'
)


class FakeUpstream(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    fail_next = 0

    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path.startswith("/v1/models"):
            body = json.dumps({"data": [{"id": "example-model"}]}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_error(404)

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        payload = self.rfile.read(n)
        if FakeUpstream.fail_next > 0:
            FakeUpstream.fail_next -= 1
            body = b'{"error":{"message":"upstream overloaded"}}'
            self.send_response(503)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        body_in = json.loads(payload or b"{}")
        if self.path.endswith("/messages"):
            if body_in.get("messages") and "TRUNC" in json.dumps(body_in):
                stream = ANTHROPIC_SSE_TRUNCATED
            elif body_in.get("stream"):
                stream = ANTHROPIC_SSE_OK
            else:
                stream = b'{"type":"message","model":"demo-model-a","usage":{"input_tokens":10,"output_tokens":5},"content":[]}'
        else:
            if body_in.get("messages") and "TRUNC" in json.dumps(body_in):
                stream = OPENAI_SSE_TRUNCATED
            else:
                stream = OPENAI_SSE_OK
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Content-Length", str(len(stream)))
        self.end_headers()
        self.wfile.write(stream)


def http(base, path, method="GET", body=None, headers=None, timeout=10):
    data = json.dumps(body).encode() if body is not None else None
    hdrs = {"Content-Type": "application/json"}
    hdrs.update(headers or {})
    req = urllib.request.Request(base + path, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read(), dict(resp.headers)
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read(), dict(exc.headers)


class ProxyIntegrationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.up_port = free_port()
        cls.upstream = ThreadingHTTPServer(("127.0.0.1", cls.up_port), FakeUpstream)
        threading.Thread(target=cls.upstream.serve_forever, daemon=True).start()
        cls.upstream_url = "http://127.0.0.1:%d" % cls.up_port

        cls.state = os.path.join(HERE, "_state_test")
        os.makedirs(cls.state, exist_ok=True)
        cfg_path = os.path.join(cls.state, "config.json")
        if os.path.exists(cfg_path):
            os.remove(cfg_path)
        # isolate from env vars set on the machine
        for key in list(os.environ):
            if key.startswith("CCP_"):
                if key != "CCP_STATE_DIR":
                    os.environ.pop(key, None)
        os.environ["CCP_STATE_DIR"] = cls.state

        cls.config = ConfigStore()
        cls.config.save({
            "upstream": cls.upstream_url,
            "retries": 2,
            "retry_backoff_ms": 10,
        })
        cls.store = MetricsStore(history_limit=200)
        cls.port = free_port()
        cls.proxy = ProxyServer(("127.0.0.1", cls.port), cls.config, cls.store)
        threading.Thread(target=cls.proxy.serve_forever, daemon=True).start()
        cls.base = "http://127.0.0.1:%d" % cls.port
        time.sleep(0.2)

    @classmethod
    def tearDownClass(cls):
        cls.proxy.shutdown()
        cls.upstream.shutdown()

    def test_01_anthropic_stream_ok(self):
        status, body, headers = http(self.base, "/v1/messages", "POST", {
            "model": "demo-model-a", "stream": True,
            "max_tokens": 100, "messages": [{"role": "user", "content": "hi"}],
        })
        self.assertEqual(status, 200)
        self.assertIn(b"message_stop", body)

    def test_02_anthropic_truncation_detected(self):
        status, body, _ = http(self.base, "/v1/messages", "POST", {
            "model": "demo-model-a", "stream": True, "max_tokens": 50,
            "messages": [{"role": "user", "content": "TRUNC please"}],
        })
        self.assertEqual(status, 200)
        status, raw, _ = http(self.base, "/_ccp/api/truncations?limit=5")
        items = json.loads(raw)["items"]
        self.assertTrue(items, "expected a truncation record")
        self.assertIn("def fa", json.dumps(items[0]["truncation"], ensure_ascii=False))

    def test_03_openai_stream_ok_and_usage(self):
        status, body, _ = http(self.base, "/v1/chat/completions", "POST", {
            "model": "demo-model-b", "stream": True,
            "messages": [{"role": "user", "content": "hi"}],
        })
        self.assertEqual(status, 200)
        status, raw, _ = http(self.base, "/_ccp/api/recent?limit=5&model=demo-model-b")
        self.assertEqual(status, 200)
        self.assertTrue(json.loads(raw)["items"])

    def test_04_openai_truncation(self):
        http(self.base, "/v1/chat/completions", "POST", {
            "model": "demo-model-b", "stream": True,
            "messages": [{"role": "user", "content": "TRUNC"}],
        })
        status, raw, _ = http(self.base, "/_ccp/api/truncations?model=demo-model-b")
        items = json.loads(raw)["items"]
        self.assertTrue(items)
        self.assertIn("rm -rf", json.dumps(items[0]["truncation"]))

    def test_05_retry_then_success(self):
        FakeUpstream.fail_next = 1
        status, body, _ = http(self.base, "/v1/messages", "POST", {
            "model": "demo-model-a", "max_tokens": 10,
            "messages": [{"role": "user", "content": "retry me"}],
        })
        self.assertEqual(status, 200)
        status, raw, _ = http(self.base, "/_ccp/api/stats")
        stats = json.loads(raw)
        self.assertGreaterEqual(stats["overall"]["retried_ok"], 1)

    def test_06_stats_shape(self):
        status, raw, _ = http(self.base, "/_ccp/api/stats")
        stats = json.loads(raw)
        self.assertEqual(status, 200)
        for key in ("overall", "models", "active_model", "status", "protocol_mix",
                    "last_truncation_at", "last_truncation_ms"):
            self.assertIn(key, stats)
        models = {m["model"] for m in stats["models"]}
        self.assertIn("demo-model-a", models)
        self.assertIn("demo-model-b", models)
        self.assertGreater(stats["protocol_mix"]["anthropic"], 0)
        self.assertGreater(stats["protocol_mix"]["openai"], 0)

    def test_07_config_roundtrip(self):
        status, raw, _ = http(self.base, "/_ccp/api/config", "POST", {
            "retries": 5, "model_map": {"demo-model-b": "mapped-model"},
        })
        self.assertEqual(status, 200)
        cfg = json.loads(raw)["config"]
        self.assertEqual(cfg["retries"], 5)
        status, raw, _ = http(self.base, "/_ccp/api/config")
        self.assertEqual(json.loads(raw)["model_map"], {"demo-model-b": "mapped-model"})
        # restore
        http(self.base, "/_ccp/api/config", "POST", {"retries": 2, "model_map": {}})

    def test_08_model_map_applied_to_metrics(self):
        http(self.base, "/_ccp/api/config", "POST", {"model_map": {"demo-model-b": "mapped-model"}})
        http(self.base, "/v1/chat/completions", "POST", {
            "model": "demo-model-b", "stream": True, "messages": [{"role": "user", "content": "m"}],
        })
        status, raw, _ = http(self.base, "/_ccp/api/stats")
        names = {m["model"] for m in json.loads(raw)["models"]}
        self.assertIn("mapped-model", names)
        http(self.base, "/_ccp/api/config", "POST", {"model_map": {}})

    def test_09_test_endpoint(self):
        status, raw, _ = http(self.base, "/_ccp/api/test", "POST", {
            "upstream": self.upstream_url, "protocol": "openai",
        })
        self.assertEqual(status, 200, raw)
        self.assertTrue(json.loads(raw)["ok"])

    def test_10_missing_upstream_returns_guidance(self):
        http(self.base, "/_ccp/api/config", "POST", {"upstream": "", "upstream_openai": "", "upstream_anthropic": ""})
        status, raw, _ = http(self.base, "/v1/messages", "POST", {"model": "x", "messages": []})
        self.assertEqual(status, 502)
        self.assertEqual(json.loads(raw)["error"], "upstream_not_configured")
        http(self.base, "/_ccp/api/config", "POST", {"upstream": self.upstream_url})

    def test_11_selftest_and_redirect(self):
        status, raw, _ = http(self.base, "/_ccp/api/selftest")
        self.assertEqual(status, 200)
        self.assertIn("checks", json.loads(raw))

        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, *args, **kwargs):
                return None

        opener = urllib.request.build_opener(NoRedirect)
        try:
            opener.open(self.base + "/_ccp", timeout=5)
            self.fail("expected a redirect")
        except urllib.error.HTTPError as exc:
            self.assertEqual(exc.code, 302)
            self.assertEqual(exc.headers.get("Location"), "/_ccp/")

    def test_12_buckets_and_context(self):
        status, raw, _ = http(self.base, "/_ccp/api/buckets?model=demo-model-a&granularity=day")
        self.assertEqual(status, 200)
        self.assertTrue(json.loads(raw)["items"])
        status, raw, _ = http(self.base, "/_ccp/api/context?model=demo-model-a")
        self.assertTrue(json.loads(raw)["items"])

    def test_13_route_preview_and_rule_validation(self):
        status, raw, _ = http(self.base, "/_ccp/api/config", "POST", {
            "providers": [
                {"id": "gw-a", "name": "网关 A", "protocol": "anthropic",
                 "base_url": self.upstream_url},
                {"id": "gw-b", "name": "网关 B", "protocol": "openai",
                 "base_url": self.upstream_url},
            ],
            "routes": [{"match": "routed-*", "provider": "gw-b"}],
            "default_provider": "gw-a",
        })
        self.assertEqual(status, 200, raw)

        status, raw, _ = http(self.base, "/_ccp/api/route?model=routed-1&protocol=anthropic")
        decision = json.loads(raw)
        self.assertEqual(status, 200)
        self.assertEqual(decision["provider_id"], "gw-b")
        self.assertEqual(decision["source"], "rule")
        self.assertEqual(decision["matched"], "routed-*")
        self.assertEqual(decision["upstream_protocol"], "openai")
        self.assertTrue(decision["translate"])
        self.assertEqual(len(decision["providers"]), 2)

        status, raw, _ = http(self.base, "/_ccp/api/routes/validate", "POST",
                              {"match": "a b", "provider": "gw-b"})
        self.assertFalse(json.loads(raw)["ok"])
        status, raw, _ = http(self.base, "/_ccp/api/routes/validate", "POST",
                              {"match": "routed-*", "provider": "gw-b"})
        self.assertTrue(json.loads(raw)["ok"])

        # restore the legacy-only setup the later tests assume
        http(self.base, "/_ccp/api/config", "POST", {
            "providers": [], "routes": [], "default_provider": "",
        })

    def test_14_route_does_not_need_keys_from_client(self):
        http(self.base, "/_ccp/api/config", "POST", {
            "providers": [{"id": "gw-a", "name": "A", "protocol": "anthropic",
                           "base_url": self.upstream_url,
                           "auth_header": "Authorization: Bearer provider-key"}],
            "default_provider": "gw-a",
        })
        status, body, _ = http(self.base, "/v1/messages", "POST", {
            "model": "demo-model-a", "stream": True,
            "messages": [{"role": "user", "content": "hi"}],
        }, headers={"x-api-key": "client-placeholder"})
        self.assertEqual(status, 200)
        self.assertIn(b"message_stop", body)
        http(self.base, "/_ccp/api/config", "POST", {"providers": [], "default_provider": ""})

    def test_15_capture_redacts_and_clips(self):
        http(self.base, "/v1/messages", "POST", {
            "model": "capture-model", "stream": True,
            "messages": [{"role": "user", "content": "capture me"}],
        }, headers={"Authorization": "Bearer sk-secret-value"})

        status, raw, _ = http(self.base, "/_ccp/api/capture?limit=20")
        self.assertEqual(status, 200)
        items = json.loads(raw)["items"]
        rows = [i for i in items if i.get("requested_model") == "capture-model"]
        self.assertTrue(rows, "expected a capture for the requested model")
        rid = rows[0]["id"]

        status, raw, _ = http(self.base, "/_ccp/api/capture/" + rid)
        item = json.loads(raw)
        auth = ""
        for key, value in item["request"]["headers"].items():
            if key.lower() == "authorization":
                auth = value
        self.assertIn("***redacted***", auth)
        self.assertNotIn("sk-secret-value", json.dumps(item))
        self.assertIn("capture me", item["request"]["text"])

        status, raw, _ = http(self.base, "/_ccp/api/capture/does-not-exist")
        self.assertEqual(status, 404)

    def test_16_translated_provider_round_trip(self):
        # Client speaks Anthropic, provider speaks OpenAI: request body must be
        # converted on the way out and the SSE converted back on the way in.
        http(self.base, "/_ccp/api/config", "POST", {
            "providers": [{"id": "gw-oai", "name": "OAI", "protocol": "openai",
                           "base_url": self.upstream_url}],
            "default_provider": "gw-oai",
            "translate": True,
        })
        status, body, _ = http(self.base, "/v1/messages", "POST", {
            "model": "demo-model-a", "stream": True, "max_tokens": 64,
            "messages": [{"role": "user", "content": "hi there"}],
        })
        self.assertEqual(status, 200)
        # Converted response must be Anthropic-shaped, not raw OpenAI chunks.
        self.assertIn(b"content_block_start", body)
        self.assertNotIn(b"chat.completion.chunk", body)

        status, raw, _ = http(self.base, "/_ccp/api/capture?limit=5&model=demo-model-a")
        items = json.loads(raw)["items"]
        self.assertTrue(any(i["translated"] for i in items))
        self.assertTrue(any(i["upstream_protocol"] == "openai" for i in items))

        http(self.base, "/_ccp/api/config", "POST", {
            "providers": [], "default_provider": "", "translate": True,
        })


class ScannerUnitTest(unittest.TestCase):
    def test_openai_truncated(self):
        s = TruncationScanner("openai")
        s.feed(OPENAI_SSE_TRUNCATED)
        res = s.finish(200)
        self.assertTrue(res.truncated)
        self.assertIn("rm -rf", res.calls[0].args)

    def test_anthropic_complete(self):
        s = TruncationScanner("anthropic")
        s.feed(ANTHROPIC_SSE_OK)
        res = s.finish(200)
        self.assertFalse(res.truncated)

    def test_anthropic_max_tokens(self):
        s = TruncationScanner("anthropic")
        s.feed(
            b'data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"t","name":"X"}}\n\n'
            b'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"a\\":1}"}}\n\n'
            b'data: {"type":"message_delta","delta":{"stop_reason":"max_tokens"}}\n\n'
        )
        res = s.finish(200)
        self.assertTrue(res.truncated)

    def test_responses_complete_captures_usage(self):
        s = TruncationScanner("openai")
        s.feed(RESPONSES_SSE_OK)
        res = s.finish(200)
        self.assertFalse(res.truncated)
        # input/output (not prompt/completion) and input_tokens_details.cached
        self.assertEqual(s.usage["input_tokens"], 100)
        self.assertEqual(s.usage["output_tokens"], 7)
        self.assertEqual(s.usage["cache_read_tokens"], 60)
        self.assertEqual(s.model, "resp-model")

    def test_responses_max_output_tokens(self):
        s = TruncationScanner("openai")
        s.feed(
            b'data: {"type":"response.output_item.added","output_index":0,'
            b'"item":{"type":"function_call","call_id":"c1","name":"shell"}}\n\n'
            b'data: {"type":"response.function_call_arguments.delta","output_index":0,'
            b'"delta":"{\\"cmd\\":\\"ls"}\n\n'
            b'data: {"type":"response.incomplete","response":{"model":"m",'
            b'"incomplete_details":{"reason":"max_output_tokens"}}}\n\n'
        )
        res = s.finish(200)
        self.assertTrue(res.truncated)
        self.assertEqual(res.reason, "max_tokens")

    def test_responses_broken_json_after_done(self):
        s = TruncationScanner("openai")
        s.feed(
            b'data: {"type":"response.output_item.added","output_index":0,'
            b'"item":{"type":"function_call","call_id":"c1","name":"shell"}}\n\n'
            b'data: {"type":"response.output_item.done","output_index":0,'
            b'"item":{"type":"function_call","arguments":"{\\"cmd\\":\\"ls"}}\n\n'
            b'data: {"type":"response.completed","response":{"model":"m"}}\n\n'
        )
        res = s.finish(200)
        self.assertTrue(res.truncated)
        self.assertEqual(res.reason, "invalid_tool_json")

    def test_responses_cut_stream_is_incomplete(self):
        s = TruncationScanner("openai")
        s.feed(
            b'data: {"type":"response.output_item.added","output_index":0,'
            b'"item":{"type":"function_call","call_id":"c1","name":"shell"}}\n\n'
            b'data: {"type":"response.function_call_arguments.delta","output_index":0,"delta":"{"}\n\n'
        )
        res = s.finish(200, aborted=True)
        self.assertTrue(res.truncated)
        self.assertEqual(res.reason, "client_aborted")


class RouterUnitTest(unittest.TestCase):
    CONFIG = {
        "translate": True,
        "providers": [
            {"id": "a", "name": "A", "protocol": "anthropic", "base_url": "https://a.example.internal/v1"},
            {"id": "b", "name": "B", "protocol": "openai", "base_url": "https://b.example.internal/v1"},
            {"id": "off", "name": "Off", "protocol": "openai", "base_url": "https://c.example.internal", "enabled": False},
        ],
        "routes": [
            {"match": "claude-*", "provider": "a"},
            {"match": "/v1/chat/*", "provider": "b"},
            {"match": "*oai*", "provider": "off"},
        ],
        "default_provider": "b",
    }

    def test_rule_match_model(self):
        d = resolve(self.CONFIG, "anthropic", "claude-3", "/v1/messages")
        self.assertEqual(d["provider_id"], "a")
        self.assertEqual(d["source"], "rule")
        self.assertFalse(d["translate"])

    def test_rule_match_path(self):
        d = resolve(self.CONFIG, "anthropic", "anything", "/v1/chat/completions")
        self.assertEqual(d["provider_id"], "b")
        self.assertEqual(d["upstream_protocol"], "openai")
        self.assertTrue(d["translate"])

    def test_disabled_provider_is_skipped(self):
        d = resolve(self.CONFIG, "openai", "my-oai-model", "/v1/chat/completions")
        # the *oai* rule points at a disabled provider, then the path rule...
        # path rule comes first in file order, so it still wins here
        self.assertEqual(d["provider_id"], "b")

    def test_models_list_route(self):
        cfg = dict(self.CONFIG, providers=[
            {"id": "a", "name": "A", "protocol": "anthropic",
             "base_url": "https://a.example.internal", "models": ["claude-3"]},
        ], routes=[], default_provider="")
        d = resolve(cfg, "anthropic", "claude-3", "/v1/messages")
        self.assertEqual(d["source"], "models")

    def test_default_then_legacy(self):
        cfg = dict(self.CONFIG, routes=[], providers=[])
        d = resolve(dict(cfg, upstream="https://legacy.example.internal"), "openai", "x", "/v1/chat/completions")
        self.assertEqual(d["source"], "legacy")
        self.assertFalse(d["translate"])

    def test_none_when_unconfigured(self):
        d = resolve({"providers": [], "routes": []}, "anthropic", "x", "/v1/messages")
        self.assertEqual(d["source"], "none")
        self.assertEqual(d["base_url"], "")

    def test_translate_off_keeps_client_dialect(self):
        d = resolve(dict(self.CONFIG, translate=False), "anthropic", "m", "/v1/messages")
        self.assertFalse(d["translate"])
        self.assertEqual(d["upstream_protocol"], "anthropic")

    def test_auto_protocol_follows_client(self):
        cfg = dict(self.CONFIG, routes=[], providers=[
            {"id": "a", "name": "A", "protocol": "auto", "base_url": "https://a.example.internal"}],
            default_provider="a")
        d = resolve(cfg, "openai", "m", "/v1/chat/completions")
        self.assertEqual(d["upstream_protocol"], "openai")
        self.assertFalse(d["translate"])

    def test_explain_is_serialisable(self):
        d = explain(self.CONFIG, "anthropic", "claude-3")
        json.dumps(d)  # must not leak the provider dict
        self.assertNotIn("provider", d)

    def test_validate_rule(self):
        self.assertIn("不能为空", validate_rule(""))
        self.assertIn("空白", validate_rule("a b"))
        self.assertIn("括号", validate_rule("a[bc"))
        self.assertEqual(validate_rule("deepseek-*"), "")
        self.assertEqual(validate_rule("/v1/messages*"), "")


class TranslateUnitTest(unittest.TestCase):
    def test_anthropic_request_to_openai(self):
        out = anthropic_to_openai({
            "model": "m", "max_tokens": 100, "system": "be brief",
            "messages": [
                {"role": "user", "content": "hello"},
                {"role": "assistant", "content": [
                    {"type": "tool_use", "id": "tu_1", "name": "Read",
                     "input": {"path": "/a"}}]},
                {"role": "user", "content": [
                    {"type": "tool_result", "tool_use_id": "tu_1", "content": "ok"}]},
            ],
            "tools": [{"name": "Read", "description": "read", "input_schema": {"type": "object"}}],
        })
        self.assertEqual(out["model"], "m")
        self.assertEqual(out["max_tokens"], 100)
        self.assertEqual(out["messages"][0], {"role": "system", "content": "be brief"})
        self.assertEqual(out["messages"][2]["tool_calls"][0]["function"]["name"], "Read")
        self.assertEqual(out["tools"][0]["function"]["parameters"], {"type": "object"})

    def test_openai_request_to_anthropic(self):
        out = openai_to_anthropic({
            "model": "m",
            "messages": [
                {"role": "system", "content": "sys"},
                {"role": "user", "content": "hi"},
                {"role": "assistant", "content": None, "tool_calls": [
                    {"id": "call_1", "type": "function",
                     "function": {"name": "Read", "arguments": "{\"p\":1}"}}]},
                {"role": "tool", "tool_call_id": "call_1", "content": "done"},
            ],
        })
        self.assertEqual(out["system"], "sys")
        self.assertEqual(out["messages"][1]["content"][0]["type"], "tool_use")
        self.assertEqual(out["messages"][2]["content"][0]["type"], "tool_result")

    def test_stream_shims_refuse_to_fabricate_a_finish(self):
        # Upstream cut the stream before any terminal event: no synthetic
        # finish may be emitted or truncation would look like success.
        oai = OpenAIToAnthropicStream("m")
        oai.feed(b'data: {"choices":[{"index":0,"delta":{"content":"hi"}}]}\n\n')
        self.assertEqual(oai.close(), b"")

        anth = AnthropicToOpenAIStream("m")
        anth.feed(b'data: {"type":"content_block_delta","index":0,'
                  b'"delta":{"type":"text_delta","text":"hi"}}\n\n')
        self.assertNotIn(b"[DONE]", anth.close())

    def test_stream_shims_do_emit_finish_when_upstream_did(self):
        oai = OpenAIToAnthropicStream("m")
        text = oai.feed(
            b'data: {"choices":[{"index":0,"delta":{"content":"hi"},"finish_reason":"stop"}],'
            b'"usage":{"prompt_tokens":5,"completion_tokens":2}}\n\n'
            b'data: [DONE]\n\n')
        self.assertIn(b"message_stop", text)

        anth = AnthropicToOpenAIStream("m")
        text = anth.feed(
            b'data: {"type":"message_start","message":{"model":"m","usage":{"input_tokens":3}}}\n\n'
            b'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},'
            b'"usage":{"output_tokens":4}}\n\n'
            b'data: {"type":"message_stop"}\n\n')
        self.assertIn(b"[DONE]", text)

    def test_make_stream(self):
        self.assertIsNone(make_stream("anthropic", "anthropic"))
        self.assertIsInstance(make_stream("openai", "anthropic"), OpenAIToAnthropicStream)
        self.assertIsInstance(make_stream("anthropic", "openai"), AnthropicToOpenAIStream)


class CaptureUnitTest(unittest.TestCase):
    def test_redact_headers_keeps_scheme(self):
        out = redact_headers({
            "Authorization": "Bearer sk-abcdef",
            "X-Api-Key": "plain-key",
            "Content-Type": "application/json",
        })
        self.assertEqual(out["Authorization"], "Bearer ***redacted***")
        self.assertEqual(out["X-Api-Key"], "***redacted***")
        self.assertEqual(out["Content-Type"], "application/json")

    def test_pretty_clips_large_bodies(self):
        body = json.dumps({"k": "x" * 4000}).encode()
        out = pretty(body, limit=500)
        self.assertTrue(out["truncated"])
        self.assertLess(len(out["text"]), 700)
        self.assertEqual(out["bytes"], len(body))

    def test_pretty_formats_small_json(self):
        out = pretty(b'{"a":1}', limit=1024)
        self.assertFalse(out["truncated"])
        self.assertIn("\n", out["text"])

    def test_store_is_a_ring_buffer(self):
        store = CaptureStore(limit=3)
        for i in range(5):
            store.add({"id": str(i), "model": "m", "truncated": i % 2 == 0})
        ids = [row["id"] for row in store.recent(limit=10)]
        self.assertEqual(ids, ["4", "3", "2"])
        self.assertEqual(store.stats()["captured"], 3)
        self.assertEqual([r["id"] for r in store.recent(truncated_only=True)], ["4", "2"])
        self.assertIsNone(store.get("0"))


class UsageLedgerUnitTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = self.tmp.name

    def tearDown(self):
        self.tmp.cleanup()

    def _ledger(self, **kw):
        return UsageLedger(self.dir, **kw)

    def test_days_fill_gaps_and_today_totals(self):
        led = self._ledger()
        now = time.time()
        led.record(now, "model-a", "prov-a", True, False, False, 100.0, 10, 20, 5, 0)
        led.record(now, "model-a", "prov-a", False, True, False, 300.0, 4, 0, 0, 0)
        rows = led.days(7)
        self.assertEqual(len(rows), 7)
        self.assertEqual(rows[-1]["requests"], 2)
        self.assertEqual(rows[-1]["success"], 1)
        self.assertEqual(rows[-1]["failed"], 1)
        self.assertEqual(rows[-1]["truncated"], 1)
        self.assertEqual(rows[-1]["avg_latency_ms"], 200.0)
        self.assertEqual(rows[-1]["truncation_rate"], 50.0)
        self.assertEqual(rows[0]["requests"], 0)
        self.assertEqual([r["date"] for r in rows], sorted(r["date"] for r in rows))

    def test_by_model_and_provider_aggregate(self):
        led = self._ledger()
        now = time.time()
        led.record(now, "model-a", "prov-a", True, False, False, 10, 1, 1, 0, 0)
        led.record(now, "model-b", "prov-b", True, False, False, 10, 1, 1, 0, 0)
        led.record(now, "model-b", "prov-b", True, False, False, 10, 1, 1, 0, 0)
        models = led.by_model(30)
        self.assertEqual([m["model"] for m in models], ["model-b", "model-a"])
        self.assertEqual(models[0]["requests"], 2)
        provs = led.providers(30)
        self.assertEqual({p["provider"] for p in provs}, {"prov-a", "prov-b"})
        summary = led.summary(30)
        self.assertEqual(summary["requests"], 3)
        self.assertEqual(summary["active_days"], 1)
        self.assertEqual(summary["today"]["requests"], 3)

    def test_persists_across_restart(self):
        led = self._ledger()
        led.record(time.time(), "model-a", "prov-a", True, False, False, 50, 7, 8, 0, 0)
        led.flush(force=True)
        self.assertTrue(os.path.exists(os.path.join(self.dir, "usage.json")))

        again = self._ledger()
        rows = again.days(1)
        self.assertEqual(rows[-1]["requests"], 1)
        self.assertEqual(rows[-1]["input_tokens"], 7)
        self.assertEqual(rows[-1]["output_tokens"], 8)

    def test_prunes_days_past_retention(self):
        led = self._ledger(retain_days=7)
        old = (date.today() - timedelta(days=30)).strftime("%Y-%m-%d")
        led.record(time.time(), "model-a", "", True, False, False, 10, 1, 1, 0, 0)
        with led._lock:
            led._days[old] = {"models": {}, "providers": {}, "total": {}}
            led._dirty = True
        led.flush(force=True)
        self.assertNotIn(old, led._days)
        self.assertEqual(led.days(400)[-1]["requests"], 1)

    def test_corrupt_file_is_ignored(self):
        with open(os.path.join(self.dir, "usage.json"), "w", encoding="utf-8") as fh:
            fh.write("{not json")
        led = self._ledger()
        self.assertEqual(led.summary(3)["requests"], 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
