# -*- coding: utf-8 -*-
"""Send demo traffic through a running ccp-observe proxy.

    python proxy/demo_upstream.py --port 9901 &
    python proxy/proxy.py --upstream http://127.0.0.1:9901 &
    python proxy/seed_demo.py --requests 60

Pairs with demo_upstream.py so you can see every panel feature without
configuring a real gateway.
"""

from __future__ import annotations

import argparse
import json
import random
import urllib.error
import urllib.request

# Neutral placeholders. The upstream echoes whatever model you send, so pass
# your real model ids with --model to preview the panel with your own names.
ANTH_MODELS = ["demo-anthropic-model"]
OAI_MODELS = ["demo-openai-model"]


def post(base: str, path: str, payload: dict):
    req = urllib.request.Request(
        base + path,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            resp.read()
            return resp.status
    except urllib.error.HTTPError as exc:
        exc.read()
        return exc.code
    except Exception as exc:  # noqa: BLE001
        print("  ! %s" % exc)
        return 0


def main():
    ap = argparse.ArgumentParser(description="send demo traffic to ccp-observe")
    ap.add_argument("--base", default="http://127.0.0.1:8787")
    ap.add_argument("--requests", type=int, default=40)
    ap.add_argument("--model", action="append", default=[], metavar="ID",
                    help="model id to send (repeatable; defaults to neutral placeholders)")
    args = ap.parse_args()

    anth = list(args.model) or ANTH_MODELS
    oai = list(args.model) or OAI_MODELS

    for i in range(args.requests):
        anthropic = random.random() < 0.62
        if anthropic:
            model = random.choice(anth)
            status = post(args.base, "/v1/messages", {
                "model": model, "stream": True, "max_tokens": 512,
                "messages": [{"role": "user", "content": "demo request %d" % i}],
                "metadata": {"session_id": "demo-session-%d" % (i % 5)},
            })
            kind = "anthropic"
        else:
            model = random.choice(oai)
            status = post(args.base, "/v1/chat/completions", {
                "model": model, "stream": True,
                "messages": [{"role": "user", "content": "demo request %d" % i}],
            })
            kind = "openai"
        print("  %3d/%d %-9s %-20s -> %s" % (i + 1, args.requests, kind, model, status))
        if i % 7 == 0:
            print("        ... 打开 http://127.0.0.1:8787/_ccp/ 查看")


if __name__ == "__main__":
    main()
