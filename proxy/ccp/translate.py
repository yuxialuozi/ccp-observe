# -*- coding: utf-8 -*-
"""Wire-format translation between Anthropic Messages and OpenAI Chat.

This is the "protocol compatibility" layer: when a provider is declared with
the other dialect, the proxy rewrites the request on the way out and the
response on the way back, so a Claude Code request can be served by an
OpenAI-only gateway and vice versa.

Only the subset both formats actually share is translated (text, images,
tool calls, usage, stop reasons). Anything else passes through untouched —
a lossy guess is worse than a visible upstream error.
"""

from __future__ import annotations

import json

STOP_PASSTHROUGH = {"stop", "length", "tool_calls", "content_filter", "function_call"}


# --------------------------------------------------------------- request out

def _text_of(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(str(block.get("text") or ""))
        return "".join(parts)
    return ""


def _anth_image_to_oai(block: dict) -> dict | None:
    source = block.get("source") or {}
    if source.get("type") == "base64":
        url = "data:%s;base64,%s" % (source.get("media_type") or "image/png", source.get("data") or "")
    elif source.get("type") == "url":
        url = source.get("url") or ""
    else:
        return None
    return {"type": "image_url", "image_url": {"url": url}}


def anthropic_to_openai(body: dict) -> dict:
    out: dict = {"model": body.get("model")}
    messages: list[dict] = []

    system = body.get("system")
    system_text = _text_of(system)
    if system_text:
        messages.append({"role": "system", "content": system_text})

    for msg in body.get("messages") or []:
        role = msg.get("role") or "user"
        content = msg.get("content")
        if isinstance(content, str):
            messages.append({"role": role, "content": content})
            continue
        texts: list[str] = []
        parts: list[dict] = []
        tool_calls: list[dict] = []
        tool_results: list[dict] = []
        for block in content or []:
            if not isinstance(block, dict):
                continue
            btype = block.get("type")
            if btype == "text":
                texts.append(str(block.get("text") or ""))
            elif btype == "image" and role == "user":
                img = _anth_image_to_oai(block)
                if img:
                    parts.append(img)
            elif btype == "tool_use":
                tool_calls.append({
                    "id": block.get("id") or "call_%d" % len(tool_calls),
                    "type": "function",
                    "function": {
                        "name": block.get("name") or "tool",
                        "arguments": json.dumps(block.get("input") or {}, ensure_ascii=False),
                    },
                })
            elif btype == "tool_result":
                content_text = block.get("content")
                if isinstance(content_text, list):
                    content_text = _text_of(content_text)
                tool_results.append({
                    "role": "tool",
                    "tool_call_id": block.get("tool_use_id") or "",
                    "content": str(content_text or ""),
                })
        if tool_results:
            messages.extend(tool_results)
            if texts:
                messages.append({"role": "user", "content": "".join(texts)})
            continue
        if tool_calls:
            entry: dict = {"role": "assistant", "content": "".join(texts) or None,
                           "tool_calls": tool_calls}
            messages.append(entry)
            continue
        if parts:
            messages.append({"role": role, "content": parts + (
                [{"type": "text", "text": "".join(texts)}] if texts else [])})
        elif texts:
            messages.append({"role": role, "content": "".join(texts)})

    out["messages"] = messages
    if body.get("max_tokens") is not None:
        out["max_tokens"] = body["max_tokens"]
    for key in ("temperature", "top_p"):
        if body.get(key) is not None:
            out[key] = body[key]
    if body.get("stop_sequences"):
        out["stop"] = body["stop_sequences"]
    if body.get("stream"):
        out["stream"] = True
        out["stream_options"] = {"include_usage": True}

    tools = body.get("tools") or []
    converted = []
    for tool in tools:
        if not isinstance(tool, dict) or not tool.get("name"):
            continue
        converted.append({
            "type": "function",
            "function": {
                "name": tool.get("name"),
                "description": tool.get("description") or "",
                "parameters": tool.get("input_schema") or {"type": "object", "properties": {}},
            },
        })
    if converted:
        out["tools"] = converted
        choice = body.get("tool_choice")
        if isinstance(choice, dict):
            ctype = choice.get("type")
            if ctype == "auto":
                out["tool_choice"] = "auto"
            elif ctype == "any":
                out["tool_choice"] = "required"
            elif ctype == "tool" and choice.get("name"):
                out["tool_choice"] = {"type": "function",
                                      "function": {"name": choice["name"]}}
        elif isinstance(choice, str) and choice in ("auto", "none", "required"):
            out["tool_choice"] = choice
    return out


def openai_to_anthropic(body: dict) -> dict:
    out: dict = {"model": body.get("model")}
    system_parts: list[str] = []
    messages: list[dict] = []

    for msg in body.get("messages") or []:
        role = msg.get("role") or "user"
        content = msg.get("content")
        if role == "system":
            system_parts.append(_text_of(content) if not isinstance(content, str) else content)
            continue
        if role == "tool":
            messages.append({
                "role": "user",
                "content": [{
                    "type": "tool_result",
                    "tool_use_id": msg.get("tool_call_id") or "",
                    "content": _text_of(content) if not isinstance(content, str) else content,
                }],
            })
            continue
        if role == "assistant":
            blocks: list[dict] = []
            text = _text_of(content) if not isinstance(content, str) else content
            if text:
                blocks.append({"type": "text", "text": text})
            for call in msg.get("tool_calls") or []:
                fn = call.get("function") or {}
                try:
                    args = json.loads(fn.get("arguments") or "{}")
                except ValueError:
                    args = {"_raw": fn.get("arguments")}
                blocks.append({
                    "type": "tool_use",
                    "id": call.get("id") or "toolu_%d" % len(blocks),
                    "name": fn.get("name") or "tool",
                    "input": args if isinstance(args, dict) else {"_raw": args},
                })
            if blocks:
                messages.append({"role": "assistant", "content": blocks})
            continue
        # user
        if isinstance(content, str):
            messages.append({"role": "user", "content": content})
            continue
        parts: list[dict] = []
        for part in content or []:
            if not isinstance(part, dict):
                continue
            if part.get("type") == "text":
                parts.append({"type": "text", "text": part.get("text") or ""})
            elif part.get("type") == "image_url":
                url = (part.get("image_url") or {}).get("url") or ""
                if url.startswith("data:"):
                    head, _, data = url.partition(",")
                    media = head[5:].split(";", 1)[0] or "image/png"
                    parts.append({"type": "image", "source": {
                        "type": "base64", "media_type": media, "data": data}})
                elif url:
                    parts.append({"type": "image", "source": {"type": "url", "url": url}})
        if parts:
            messages.append({"role": "user", "content": parts})

    out["messages"] = messages
    if system_parts:
        out["system"] = "\n\n".join(s for s in system_parts if s)
    max_tokens = body.get("max_tokens") or body.get("max_completion_tokens")
    out["max_tokens"] = int(max_tokens) if max_tokens else 4096
    for key in ("temperature", "top_p"):
        if body.get(key) is not None:
            out[key] = body[key]
    stop = body.get("stop")
    if isinstance(stop, str):
        stop = [stop]
    if stop:
        out["stop_sequences"] = stop
    if body.get("stream"):
        out["stream"] = True

    tools = []
    for tool in body.get("tools") or []:
        if not isinstance(tool, dict):
            continue
        fn = tool.get("function") or {}
        if not fn.get("name"):
            continue
        tools.append({
            "name": fn["name"],
            "description": fn.get("description") or "",
            "input_schema": fn.get("parameters") or {"type": "object", "properties": {}},
        })
    if tools:
        out["tools"] = tools
        choice = body.get("tool_choice")
        if choice == "auto":
            out["tool_choice"] = {"type": "auto"}
        elif choice == "required":
            out["tool_choice"] = {"type": "any"}
        elif choice == "none":
            pass
        elif isinstance(choice, dict) and (choice.get("function") or {}).get("name"):
            out["tool_choice"] = {"type": "tool", "name": choice["function"]["name"]}
    return out


# -------------------------------------------------------------- response back

def _anthropic_stop_to_openai(stop: str | None) -> str:
    return {
        "end_turn": "stop",
        "stop_sequence": "stop",
        "max_tokens": "length",
        "tool_use": "tool_calls",
    }.get(stop or "", "stop")


def _openai_stop_to_anthropic(finish: str | None) -> str:
    return {
        "stop": "end_turn",
        "length": "max_tokens",
        "tool_calls": "tool_use",
        "function_call": "tool_use",
        "content_filter": "end_turn",
    }.get(finish or "", "end_turn")


def _usage_to_openai(usage: dict | None) -> dict:
    usage = usage or {}
    out = {"prompt_tokens": int(usage.get("input_tokens") or 0),
           "completion_tokens": int(usage.get("output_tokens") or 0),
           "total_tokens": int(usage.get("input_tokens") or 0) + int(usage.get("output_tokens") or 0)}
    cached = usage.get("cache_read_tokens")
    if cached is not None:
        out["prompt_tokens_details"] = {"cached_tokens": int(cached)}
    return out


def _usage_to_anthropic(usage: dict | None) -> dict:
    usage = usage or {}
    out = {"input_tokens": int(usage.get("prompt_tokens") or 0),
           "output_tokens": int(usage.get("completion_tokens") or 0)}
    cached = (usage.get("prompt_tokens_details") or {}).get("cached_tokens")
    if cached is not None:
        out["cache_read_input_tokens"] = int(cached)
    return out


def anthropic_response_to_openai(obj: dict) -> dict:
    """Non-streaming Anthropic message -> OpenAI chat completion."""
    texts: list[str] = []
    tool_calls: list[dict] = []
    for block in obj.get("content") or []:
        if block.get("type") == "text":
            texts.append(str(block.get("text") or ""))
        elif block.get("type") == "tool_use":
            tool_calls.append({
                "id": block.get("id") or "",
                "type": "function",
                "function": {"name": block.get("name") or "tool",
                             "arguments": json.dumps(block.get("input") or {}, ensure_ascii=False)},
            })
    message: dict = {"role": "assistant", "content": "".join(texts) or None}
    if tool_calls:
        message["tool_calls"] = tool_calls
    return {
        "id": obj.get("id") or "chatcmpl-translated",
        "object": "chat.completion",
        "created": 0,
        "model": obj.get("model") or "",
        "choices": [{
            "index": 0,
            "message": message,
            "finish_reason": _anthropic_stop_to_openai(obj.get("stop_reason")),
        }],
        "usage": _usage_to_openai(obj.get("usage")),
    }


def openai_response_to_anthropic(obj: dict) -> dict:
    """Non-streaming OpenAI chat completion -> Anthropic message."""
    choice = (obj.get("choices") or [{}])[0]
    message = choice.get("message") or {}
    content: list[dict] = []
    text = message.get("content")
    if isinstance(text, str) and text:
        content.append({"type": "text", "text": text})
    for call in message.get("tool_calls") or []:
        fn = call.get("function") or {}
        try:
            args = json.loads(fn.get("arguments") or "{}")
        except ValueError:
            args = {}
        content.append({
            "type": "tool_use",
            "id": call.get("id") or "toolu_translated",
            "name": fn.get("name") or "tool",
            "input": args if isinstance(args, dict) else {},
        })
    return {
        "id": obj.get("id") or "msg_translated",
        "type": "message",
        "role": "assistant",
        "model": obj.get("model") or "",
        "content": content or [{"type": "text", "text": ""}],
        "stop_reason": _openai_stop_to_anthropic(choice.get("finish_reason")),
        "stop_sequence": None,
        "usage": _usage_to_anthropic(obj.get("usage")),
    }


# ------------------------------------------------------------ streaming shim

def _sse(event: str | None, payload) -> bytes:
    data = json.dumps(payload, ensure_ascii=False)
    if event:
        return ("event: %s\ndata: %s\n\n" % (event, data)).encode("utf-8")
    return ("data: %s\n\n" % data).encode("utf-8")


class OpenAIToAnthropicStream:
    """Turn an OpenAI ``chat.completion.chunk`` SSE stream into Anthropic events."""

    name = "openai->anthropic"

    def __init__(self, model: str = ""):
        self.model = model
        self._buf = ""
        self._started = False
        self._block_index = -1
        self._open_tool: dict[int, int] = {}   # openai tool index -> anthropic block index
        self._text_open = False
        self._finished = False
        self._usage: dict = {}

    def _start(self) -> bytes:
        if self._started:
            return b""
        self._started = True
        return _sse("message_start", {
            "type": "message_start",
            "message": {
                "id": "msg_translated", "type": "message", "role": "assistant",
                "model": self.model, "content": [], "stop_reason": None,
                "usage": {"input_tokens": 0, "output_tokens": 0},
            },
        })

    def _close_text(self) -> bytes:
        if not self._text_open:
            return b""
        self._text_open = False
        return _sse("content_block_stop", {"type": "content_block_stop", "index": self._block_index})

    def _close_tools(self) -> bytes:
        out = b""
        for _, block_index in sorted(self._open_tool.items()):
            out += _sse("content_block_stop",
                        {"type": "content_block_stop", "index": block_index})
        self._open_tool.clear()
        return out

    def _handle_chunk(self, obj: dict) -> bytes:
        out = self._start()
        if obj.get("model"):
            self.model = obj["model"]
        if isinstance(obj.get("usage"), dict) and obj["usage"]:
            self._usage = obj["usage"]
        choices = obj.get("choices") or []
        if not choices:
            return out
        choice = choices[0] or {}
        delta = choice.get("delta") or {}

        text = delta.get("content")
        if isinstance(text, str) and text:
            if not self._text_open:
                out += self._close_tools()
                self._block_index += 1
                self._text_open = True
                out += _sse("content_block_start", {
                    "type": "content_block_start", "index": self._block_index,
                    "content_block": {"type": "text", "text": ""},
                })
            out += _sse("content_block_delta", {
                "type": "content_block_delta", "index": self._block_index,
                "delta": {"type": "text_delta", "text": text},
            })

        for tc in delta.get("tool_calls") or []:
            idx = int(tc.get("index", 0))
            fn = tc.get("function") or {}
            if idx not in self._open_tool:
                out += self._close_text()
                self._block_index += 1
                self._open_tool[idx] = self._block_index
                out += _sse("content_block_start", {
                    "type": "content_block_start", "index": self._block_index,
                    "content_block": {
                        "type": "tool_use", "id": tc.get("id") or "toolu_%d" % idx,
                        "name": fn.get("name") or "tool", "input": {},
                    },
                })
            block_index = self._open_tool[idx]
            if fn.get("arguments"):
                out += _sse("content_block_delta", {
                    "type": "content_block_delta", "index": block_index,
                    "delta": {"type": "input_json_delta",
                              "partial_json": str(fn.get("arguments"))},
                })

        finish = choice.get("finish_reason")
        if finish:
            out += self._finish(finish)
        return out

    def _finish(self, finish: str) -> bytes:
        if self._finished:
            return b""
        self._finished = True
        out = self._close_text() + self._close_tools()
        usage = _usage_to_anthropic(self._usage)
        out += _sse("message_delta", {
            "type": "message_delta",
            "delta": {"stop_reason": _openai_stop_to_anthropic(finish)},
            "usage": usage,
        })
        out += _sse("message_stop", {"type": "message_stop"})
        return out

    def feed(self, chunk: bytes) -> bytes:
        self._buf += chunk.decode("utf-8", errors="replace")
        out = b""
        while "\n" in self._buf:
            line, self._buf = self._buf.split("\n", 1)
            line = line.rstrip("\r")
            if not line.startswith("data:"):
                continue
            data = line[5:].strip()
            if data == "[DONE]":
                out += self._start() + self._finish("stop")
                continue
            try:
                obj = json.loads(data)
            except ValueError:
                continue
            if isinstance(obj, dict):
                out += self._handle_chunk(obj)
        return out

    def close(self) -> bytes:
        # If the upstream never sent a terminal marker the stream was cut
        # short. Synthesising a clean finish here would launder a truncation
        # into a success, so emit nothing and let the block stay open.
        if not self._started or self._finished:
            return b""
        return b""


class AnthropicToOpenAIStream:
    """Turn an Anthropic Messages SSE stream into OpenAI chunks."""

    name = "anthropic->openai"

    def __init__(self, model: str = ""):
        self.model = model
        self._buf = ""
        self._role_sent = False
        self._finished = False
        self._tool_blocks: dict[int, int] = {}   # anthropic block -> openai tool index
        self._usage: dict = {}

    def _role_chunk(self) -> bytes:
        if self._role_sent:
            return b""
        self._role_sent = True
        return _sse(None, {
            "id": "chatcmpl-translated", "object": "chat.completion.chunk",
            "created": 0, "model": self.model,
            "choices": [{"index": 0, "delta": {"role": "assistant"}, "finish_reason": None}],
        })

    def _delta(self, delta: dict, finish: str | None = None, usage: dict | None = None) -> bytes:
        payload = {
            "id": "chatcmpl-translated", "object": "chat.completion.chunk",
            "created": 0, "model": self.model,
            "choices": [{"index": 0, "delta": delta, "finish_reason": finish}],
        }
        if usage is not None:
            payload["usage"] = usage
        return _sse(None, payload)

    def _handle(self, obj: dict) -> bytes:
        etype = obj.get("type")
        if etype == "message_start":
            msg = obj.get("message") or {}
            if msg.get("model"):
                self.model = msg["model"]
            self._usage.update(msg.get("usage") or {})
            out = self._role_chunk()
        elif etype == "content_block_start":
            block = obj.get("content_block") or {}
            idx = int(obj.get("index", 0))
            if block.get("type") == "tool_use":
                tool_index = len(self._tool_blocks)
                self._tool_blocks[idx] = tool_index
                out = self._delta({"tool_calls": [{
                    "index": tool_index,
                    "id": block.get("id") or "call_%d" % tool_index,
                    "type": "function",
                    "function": {"name": block.get("name") or "tool", "arguments": ""},
                }]})
            else:
                out = self._role_chunk()
        elif etype == "content_block_delta":
            delta = obj.get("delta") or {}
            idx = int(obj.get("index", 0))
            if delta.get("type") == "text_delta":
                out = self._delta({"content": delta.get("text") or ""})
            elif delta.get("type") == "input_json_delta":
                tool_index = self._tool_blocks.get(idx, 0)
                out = self._delta({"tool_calls": [{
                    "index": tool_index,
                    "function": {"arguments": delta.get("partial_json") or ""},
                }]})
            else:
                out = b""
        elif etype == "message_delta":
            delta = obj.get("delta") or {}
            self._usage.update(obj.get("usage") or {})
            self._stop_reason = delta.get("stop_reason")
            out = b""
        elif etype == "message_stop":
            out = self._finish()
        elif etype == "error":
            out = self._delta({"content": ""}, finish="stop")
        else:
            out = b""
        return out

    def _finish(self) -> bytes:
        if self._finished:
            return b""
        self._finished = True
        finish = _anthropic_stop_to_openai(getattr(self, "_stop_reason", None))
        out = self._delta({}, finish=finish, usage=_usage_to_openai(self._usage))
        out += _sse(None, {"id": "chatcmpl-translated", "object": "chat.completion.chunk",
                           "created": 0, "model": self.model,
                           "choices": [{"index": 0, "delta": {}, "finish_reason": None}]})
        # OpenAI clients look for the terminator; without it some SDKs hang
        # waiting for more chunks.
        out += b"data: [DONE]\n\n"
        return out

    def feed(self, chunk: bytes) -> bytes:
        self._buf += chunk.decode("utf-8", errors="replace")
        out = b""
        while "\n" in self._buf:
            line, self._buf = self._buf.split("\n", 1)
            line = line.rstrip("\r")
            if not line.startswith("data:"):
                continue
            data = line[5:].strip()
            if not data or data == "[DONE]":
                continue
            try:
                obj = json.loads(data)
            except ValueError:
                continue
            if isinstance(obj, dict):
                out += self._handle(obj)
        return out

    def close(self) -> bytes:
        # Same rule as the other direction: no terminal event in, no terminal
        # event out. A synthesised stop_reason would hide a truncated stream.
        if self._finished:
            return b""
        return self._role_chunk()


def make_stream(upstream_protocol: str, client_protocol: str, model: str = ""):
    """Return the streaming shim for a translation, or ``None``."""
    if upstream_protocol == client_protocol:
        return None
    if upstream_protocol == "openai" and client_protocol == "anthropic":
        return OpenAIToAnthropicStream(model)
    if upstream_protocol == "anthropic" and client_protocol == "openai":
        return AnthropicToOpenAIStream(model)
    return None


__all__ = [
    "anthropic_to_openai", "openai_to_anthropic",
    "anthropic_response_to_openai", "openai_response_to_anthropic",
    "make_stream", "OpenAIToAnthropicStream", "AnthropicToOpenAIStream",
]
