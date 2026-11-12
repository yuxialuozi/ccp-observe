# -*- coding: utf-8 -*-
"""A tiny mock upstream for trying ccp-observe without a real gateway.

    python proxy/demo_upstream.py --port 9901
    python proxy/proxy.py --upstream http://127.0.0.1:9901 --port 8787

It speaks both wire formats and deliberately truncates a share of tool calls
so the panel has something to show. Never point a real client at this.

    python proxy/demo_upstream.py --truncate-rate 0.2 --latency 400
"""

from __future__ import annotations

import argparse
import json
import random
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# Neutral placeholders — the demo must not assume any vendor's model names.
# Pass your own ids with --model (repeatable) to preview the panel with them.
ANTH_MODELS = ["demo-anthropic-model"]
OAI_MODELS = ["demo-openai-model"]


def _anthropic_events(model: str, truncate: bool, big: bool, cut: str = "gateway"):
    ctx = 42000 if big else random.randint(1500, 26000)
    events = [
        ("message_start", {
            "type": "message_start",
            "message": {
                "id": "msg_demo", "type": "message", "role": "assistant",
                "model": model, "content": [], "stop_reason": None,
                "usage": {"input_tokens": random.randint(200, 1400),
                          "cache_read_input_tokens": ctx,
                          "cache_creation_input_tokens": random.randint(0, 900)},
            },
        }),
        ("content_block_start", {
            "type": "content_block_start", "index": 0,
            "content_block": {"type": "tool_use", "id": "toolu_demo_%d" % random.randint(1, 9999),
                              "name": random.choice(["Read", "Edit", "Bash", "Grep"]), "input": {}},
        }),
    ]
    frag = '{"file_path":"/src/app/main.py","old_string":"def handle_request(request):\\n    return dispatcher(request)"'
    if truncate and cut == "model":
        # The model hit its output budget: it flushes a valid-but-unfinished
        # fragment and then says max_tokens. This is the model's own limit.
        events.append(("content_block_delta", {
            "type": "content_block_delta", "index": 0,
            "delta": {"type": "input_json_delta", "partial_json": frag},
        }))
        events += [
            ("content_block_stop", {"type": "content_block_stop", "index": 0}),
            ("message_delta", {"type": "message_delta", "delta": {"stop_reason": "max_tokens"},
                               "usage": {"output_tokens": 512}}),
            ("message_stop", {"type": "message_stop"}),
        ]
        return events
    if truncate:
        # The stream dies mid-event: nothing closes the block. Gateway side.
        events.append(("content_block_delta", {
            "type": "content_block_delta", "index": 0,
            "delta": {"type": "input_json_delta", "partial_json": frag},
        }))
        return events
    events.append(("content_block_delta", {
        "type": "content_block_delta", "index": 0,
        "delta": {"type": "input_json_delta", "partial_json": frag + ',"new_string":"def handle_request(request):\\n    return dispatcher.dispatch(request)"}'},
    }))
    events += [
        ("content_block_stop", {"type": "content_block_stop", "index": 0}),
        ("message_delta", {"type": "message_delta", "delta": {"stop_reason": "tool_use"},
                           "usage": {"output_tokens": random.randint(40, 900)}}),
        ("message_stop", {"type": "message_stop"}),
    ]
    return events


def _openai_chunks(model: str, truncate: bool, cut: str = "gateway"):
    prompt = random.randint(300, 5000)
    yield {"model": model, "choices": [{"index": 0, "delta": {"role": "assistant", "tool_calls": [
        {"index": 0, "id": "call_demo", "type": "function",
         "function": {"name": random.choice(["shell", "apply_patch", "read_file"]), "arguments": ""}}]}}]}
    frag = '{"cmd":"pytest tests/unit -k \\"gateway\\" --maxfail'
    yield {"choices": [{"index": 0, "delta": {"tool_calls": [
        {"index": 0, "function": {"arguments": frag}}]}}]}
    if truncate and cut == "model":
        # length finish_reason = truncated by the output budget, model side.
        yield {"choices": [{"index": 0, "delta": {}, "finish_reason": "length"}],
               "usage": {"prompt_tokens": prompt, "completion_tokens": 512}}
    elif not truncate:
        yield {"choices": [{"index": 0, "delta": {"tool_calls": [
            {"index": 0, "function": {"arguments": '=1 -q"}'}}]}}]}
        yield {"choices": [{"index": 0, "delta": {}, "finish_reason": "tool_calls"}],
               "usage": {"prompt_tokens": prompt, "completion_tokens": random.randint(30, 500),
                         "prompt_tokens_details": {"cached_tokens": random.randint(0, prompt // 2)}}}
    yield None  # sentinel for [DONE]


class MockUpstream(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    latency = 0
    truncate_rate = 0.18
    truncate_cut = "mixed"      # gateway | model | mixed
    truncate_model = ""         # only this model truncates; empty = all models
    anthropic_models = ANTH_MODELS
    openai_models = OAI_MODELS

    def log_message(self, fmt, *args):
        pass

    def do_GET(self):
        if "/models" in self.path:
            ids = list(dict.fromkeys(MockUpstream.anthropic_models + MockUpstream.openai_models))
            body = json.dumps({"object": "list", "data": [{"id": m, "object": "model"} for m in ids]}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_error(404)

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        try:
            payload = json.loads(self.rfile.read(length) or b"{}")
        except ValueError:
            payload = {}
        if MockUpstream.latency:
            time.sleep(MockUpstream.latency / 1000.0)
        is_anthropic = self.path.rstrip("/").endswith("/messages")
        model = payload.get("model") or (
            MockUpstream.anthropic_models[0] if is_anthropic else MockUpstream.openai_models[0]
        )
        eligible = not MockUpstream.truncate_model or model == MockUpstream.truncate_model
        truncate = eligible and random.random() < MockUpstream.truncate_rate
        cut = MockUpstream.truncate_cut
        if cut == "mixed":
            cut = "model" if random.random() < 0.55 else "gateway"
        big = random.random() < 0.18
        if is_anthropic:
            self._stream_anthropic(model, truncate, big, bool(payload.get("stream", True)), cut)
        else:
            self._stream_openai(model, truncate, cut)

    def _sse_headers(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "close")
        self.close_connection = True
        self.end_headers()

    def _stream_anthropic(self, model, truncate, big, stream, cut="gateway"):
        if not stream:
            body = json.dumps({
                "id": "msg_demo", "type": "message", "role": "assistant", "model": model,
                "content": [{"type": "text", "text": "demo"}],
                "usage": {"input_tokens": random.randint(200, 1500),
                          "output_tokens": random.randint(20, 300)},
            }).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self._sse_headers()
        try:
            for name, obj in _anthropic_events(model, truncate, big, cut):
                self.wfile.write(("event: %s\ndata: %s\n\n" % (name, json.dumps(obj))).encode())
                self.wfile.flush()
                time.sleep(0.02)
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            self.close_connection = True

    def _stream_openai(self, model, truncate, cut="gateway"):
        self._sse_headers()
        try:
            for chunk in _openai_chunks(model, truncate, cut):
                if chunk is None:
                    self.wfile.write(b"data: [DONE]\n\n")
                else:
                    self.wfile.write(("data: %s\n\n" % json.dumps(chunk)).encode())
                self.wfile.flush()
                time.sleep(0.02)
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            self.close_connection = True


def main():
    ap = argparse.ArgumentParser(description="ccp-observe mock upstream (demo only)")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=9901)
    ap.add_argument("--latency", type=int, default=300, help="simulated upstream latency (ms)")
    ap.add_argument("--truncate-rate", type=float, default=0.18)
    ap.add_argument("--truncate-cut", choices=("gateway", "model", "mixed"), default="mixed",
                    help="who cuts the tool call: model (max_tokens) / gateway (stream dies)")
    ap.add_argument("--truncate-model", default="",
                    help="only truncate this model id; other models stay clean")
    ap.add_argument("--model", action="append", default=[], metavar="ID",
                    help="model id to advertise / fall back to (repeatable)")
    args = ap.parse_args()

    MockUpstream.latency = args.latency
    MockUpstream.truncate_rate = max(0.0, min(1.0, args.truncate_rate))
    MockUpstream.truncate_cut = args.truncate_cut
    MockUpstream.truncate_model = args.truncate_model.strip()
    if args.model:
        MockUpstream.anthropic_models = list(args.model)
        MockUpstream.openai_models = list(args.model)
    srv = ThreadingHTTPServer((args.host, args.port), MockUpstream)
    srv.daemon_threads = True
    print("mock upstream on http://%s:%d  (truncate-rate=%.0f%%)" % (args.host, args.port, MockUpstream.truncate_rate * 100))
    ids = list(dict.fromkeys(MockUpstream.anthropic_models + MockUpstream.openai_models))
    print("model ids: %s" % ", ".join(ids))
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
