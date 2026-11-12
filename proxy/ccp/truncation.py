# -*- coding: utf-8 -*-
"""Streaming truncation detection.

The proxy sees every byte of an SSE response. Both Claude Code (Anthropic
Messages) and Codex (OpenAI Chat Completions) can be cut off mid tool call;
what differs is how the fragment shows up in the wire format:

* Anthropic: ``content_block_start`` opens a ``tool_use`` block, then
  ``input_json_delta`` events stream the JSON in ``partial_json`` strings.
  A real end is signalled by a trailing ``content_block_stop`` and a
  ``message_delta`` carrying ``stop_reason: "tool_use"``. If the stream dies
  first (disconnect, upstream 5xx, or a ``stop_reason`` of ``max_tokens``),
  the accumulated JSON is incomplete.
* OpenAI: ``tool_calls`` arrive as ``choices[].delta.tool_calls[]`` with an
  ``index``; ``function.arguments`` is streamed as string fragments. A
  ``finish_reason`` (``tool_calls`` / ``stop``) closes them.

``TruncationScanner`` accumulates those fragments and, at the end of the
stream, decides whether a tool call was left unfinished.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field

MAX_CAPTURE = 16384


@dataclass
class ToolCallBuffer:
    index: int = 0
    id: str = ""
    name: str = ""
    args: str = ""
    open: bool = True
    complete: bool = False
    stopped: bool = False
    stop_reason: str = ""

    def snippet(self, limit: int = MAX_CAPTURE) -> str:
        text = self.args
        if len(text) > limit:
            return text[: limit // 2] + "\n…[snip]…\n" + text[-(limit // 2):]
        return text

    def as_capture(self) -> dict:
        return {
            "index": self.index,
            "id": self.id,
            "name": self.name,
            "fragment": self.snippet(),
            "bytes": len(self.args),
            "open": self.open,
            "complete": self.complete,
            "stop_reason": self.stop_reason,
        }


@dataclass
class TruncationResult:
    truncated: bool = False
    reason: str = ""
    calls: list[ToolCallBuffer] = field(default_factory=list)

    def detail(self, event_type: str = "") -> dict | None:
        if not self.truncated:
            return None
        return {
            "event": event_type,
            "reason": self.reason,
            "tool_calls": [c.as_capture() for c in self.calls],
        }


def _anth_usage(usage: dict) -> dict:
    out = {}
    if usage.get("input_tokens") is not None:
        out["input_tokens"] = int(usage["input_tokens"])
    if usage.get("output_tokens") is not None:
        out["output_tokens"] = int(usage["output_tokens"])
    if usage.get("cache_read_input_tokens") is not None:
        out["cache_read_tokens"] = int(usage["cache_read_input_tokens"])
    if usage.get("cache_creation_input_tokens") is not None:
        out["cache_write_tokens"] = int(usage["cache_creation_input_tokens"])
    return out


def _oai_usage(usage: dict) -> dict:
    out = {}
    if usage.get("prompt_tokens") is not None:
        out["input_tokens"] = int(usage["prompt_tokens"])
    if usage.get("completion_tokens") is not None:
        out["output_tokens"] = int(usage["completion_tokens"])
    cached = (usage.get("prompt_tokens_details") or {}).get("cached_tokens")
    if cached is not None:
        out["cache_read_tokens"] = int(cached)
    return out


def _responses_usage(usage: dict) -> dict:
    """Usage block of the OpenAI *Responses* API (what Codex speaks).

    Same numbers as chat completions, different key names: input/output
    instead of prompt/completion, and caching lives under *_tokens_details.
    """
    out = {}
    if usage.get("input_tokens") is not None:
        out["input_tokens"] = int(usage["input_tokens"])
    if usage.get("output_tokens") is not None:
        out["output_tokens"] = int(usage["output_tokens"])
    cached = (usage.get("input_tokens_details") or {}).get("cached_tokens")
    if cached is not None:
        out["cache_read_tokens"] = int(cached)
    return out


def _json_complete(text: str) -> bool:
    """True if ``text`` parses as JSON (object or array)."""
    if not text or not text.strip():
        return False
    try:
        parsed = json.loads(text)
    except ValueError:
        return False
    return isinstance(parsed, (dict, list))


def _json_prefix_closes(text: str) -> bool:
    """Best effort: does a truncated JSON object at least look balanced?"""
    depth = 0
    in_str = False
    esc = False
    for ch in text:
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch in "{[":
            depth += 1
        elif ch in "}]":
            depth -= 1
    return depth == 0 and not in_str


class TruncationScanner:
    """Feed decoded bytes via ``feed``; read ``result`` after the stream ends."""

    def __init__(self, protocol: str):
        self.protocol = protocol
        self._buf = ""
        self.calls: dict[int, ToolCallBuffer] = {}
        self.final_reason = ""
        self.aborted = False
        self.saw_done = False
        self.stop_reason = ""
        # Usage/model side-channel so the proxy doesn't decode SSE twice.
        self.usage: dict = {}
        self.model: str = ""

    # -- byte feeding ------------------------------------------------------
    def feed(self, chunk: bytes) -> None:
        if not chunk:
            return
        self._buf += chunk.decode("utf-8", errors="replace")
        while "\n" in self._buf:
            line, self._buf = self._buf.split("\n", 1)
            self._line(line.rstrip("\r"))
        # A well-formed SSE stream always ends with a blank line; a lone
        # trailing "data: {...}" means the connection died mid-event.
        if "data:" in self._buf:
            self.aborted = True

    def _line(self, line: str) -> None:
        if not line or line.startswith(":"):
            return
        if line.startswith("event:"):
            return
        if not line.startswith("data:"):
            return
        data = line[5:].strip()
        if data == "[DONE]":
            self.saw_done = True
            self.final_reason = self.final_reason or "done"
            return
        obj = None
        try:
            obj = json.loads(data)
        except ValueError:
            return
        if self.protocol == "anthropic":
            self._anthropic(obj)
        else:
            self._openai(obj)

    # -- anthropic ---------------------------------------------------------
    def _anthropic(self, obj: dict) -> None:
        etype = obj.get("type")
        if etype == "message_start":
            msg = obj.get("message") or {}
            if isinstance(msg, dict):
                if msg.get("model"):
                    self.model = str(msg["model"])
                usage = msg.get("usage")
                if isinstance(usage, dict):
                    self.usage.update(_anth_usage(usage))
        elif etype == "content_block_start":
            block = obj.get("content_block") or {}
            if block.get("type") == "tool_use":
                idx = int(obj.get("index", len(self.calls)))
                self.calls[idx] = ToolCallBuffer(
                    index=idx,
                    id=str(block.get("id", "")),
                    name=str(block.get("name", "")),
                )
        elif etype == "content_block_delta":
            delta = obj.get("delta") or {}
            if delta.get("type") == "input_json_delta":
                idx = int(obj.get("index", 0))
                call = self.calls.get(idx)
                if call is None:
                    call = self.calls[idx] = ToolCallBuffer(index=idx)
                call.args += str(delta.get("partial_json", ""))
        elif etype == "content_block_stop":
            idx = int(obj.get("index", 0))
            call = self.calls.get(idx)
            if call is not None:
                call.stopped = True
                call.complete = _json_complete(call.args) or not call.args
                call.open = False
        elif etype == "message_delta":
            delta = obj.get("delta") or {}
            if delta.get("stop_reason"):
                self.stop_reason = str(delta["stop_reason"])
            usage = obj.get("usage")
            if isinstance(usage, dict):
                self.usage.update(_anth_usage(usage))
        elif etype == "message_stop":
            self.final_reason = "message_stop"
        elif etype == "error":
            self.aborted = True
            self.final_reason = "error_event"

    # -- openai ------------------------------------------------------------
    def _openai(self, obj: dict) -> None:
        # An SSE payload with a `type` field starting with "response." is the
        # Responses API (Codex), not chat completions — both share the same
        # openai protocol, but the event grammar is entirely different.
        etype = obj.get("type")
        if isinstance(etype, str) and etype.startswith("response."):
            self._responses(obj)
            return
        if obj.get("model"):
            self.model = str(obj["model"])
        usage = obj.get("usage")
        if isinstance(usage, dict):
            self.usage.update(_oai_usage(usage))
        choices = obj.get("choices") or []
        if not isinstance(choices, list):
            return
        for choice in choices:
            if not isinstance(choice, dict):
                continue
            delta = choice.get("delta") or {}
            for tc in delta.get("tool_calls") or []:
                if not isinstance(tc, dict):
                    continue
                idx = int(tc.get("index", 0))
                call = self.calls.get(idx)
                if call is None:
                    call = self.calls[idx] = ToolCallBuffer(index=idx)
                if tc.get("id"):
                    call.id = str(tc["id"])
                fn = tc.get("function") or {}
                if fn.get("name"):
                    call.name = str(fn["name"])
                if fn.get("arguments") is not None:
                    call.args += str(fn["arguments"])
            finish = choice.get("finish_reason")
            if finish:
                self.final_reason = str(finish)
                for call in self.calls.values():
                    if not call.open:
                        continue
                    if finish in ("tool_calls", "stop", "function_call"):
                        call.complete = _json_complete(call.args) or not call.args
                        call.open = False
                        call.stop_reason = str(finish)

    # -- openai responses (Codex) ------------------------------------------
    def _responses(self, obj: dict) -> None:
        """Responses API events: tool calls are `function_call` output items.

        Progress arrives as ``response.function_call_arguments.delta`` and is
        closed by ``...arguments.done``. A cut stream leaves the item in
        ``in_progress``; ``response.incomplete`` means the model ran out of
        output budget (``incomplete_details.reason == "max_output_tokens"``).
        """
        etype = obj.get("type") or ""
        if etype == "response.output_item.added":
            item = obj.get("item") or {}
            if isinstance(item, dict) and item.get("type") == "function_call":
                idx = int(obj.get("output_index", len(self.calls)))
                call = self.calls.get(idx) or ToolCallBuffer(index=idx)
                call.id = str(item.get("call_id") or item.get("id") or "")
                call.name = str(item.get("name") or "")
                self.calls[idx] = call
        elif etype == "response.function_call_arguments.delta":
            # Deltas carry item_id/output_index, not the call index, and the
            # item id is only on the added event — so match the most recent
            # still-open call when the index is absent from our table.
            idx = int(obj.get("output_index", -1))
            call = self.calls.get(idx)
            if call is None:
                call = next((c for c in self.calls.values() if c.open), None)
            if call is not None:
                call.args += str(obj.get("delta") or "")
        elif etype == "response.function_call_arguments.done":
            idx = int(obj.get("output_index", -1))
            call = self.calls.get(idx)
            if call is not None and obj.get("arguments") is not None:
                # `done` carries the full argument string; prefer it over the
                # accumulated deltas in case one was dropped.
                call.args = str(obj["arguments"])
        elif etype == "response.output_item.done":
            item = obj.get("item") or {}
            if isinstance(item, dict) and item.get("type") == "function_call":
                idx = int(obj.get("output_index", -1))
                call = self.calls.get(idx)
                if call is not None:
                    if item.get("arguments") is not None:
                        call.args = str(item["arguments"])
                    call.complete = _json_complete(call.args) or not call.args
                    call.open = False
                    call.stop_reason = "function_call"
        elif etype in ("response.completed", "response.incomplete", "response.failed"):
            resp = obj.get("response") or {}
            if isinstance(resp, dict):
                if resp.get("model"):
                    self.model = str(resp["model"])
                usage = resp.get("usage")
                if isinstance(usage, dict):
                    self.usage.update(_responses_usage(usage))
                details = resp.get("incomplete_details") or {}
                reason = (details.get("reason") or "") if isinstance(details, dict) else ""
                if etype == "response.incomplete" and reason == "max_output_tokens":
                    self.stop_reason = "max_tokens"
                elif etype == "response.failed":
                    self.aborted = True
                    self.final_reason = "error_event"
            if etype == "response.completed":
                self.saw_done = True
                self.final_reason = self.final_reason or "done"
            elif not self.final_reason:
                self.final_reason = "max_tokens" if self.stop_reason == "max_tokens" else etype

    # -- verdict -----------------------------------------------------------
    def finish(self, http_status: int, aborted: bool = False) -> TruncationResult:
        self.aborted = self.aborted or aborted
        calls = [self.calls[k] for k in sorted(self.calls)]
        result = TruncationResult(calls=calls)
        if not calls:
            return result

        unfinished = [c for c in calls if c.open and not c.complete]
        broken = [c for c in calls if c.args and not _json_complete(c.args)]

        if unfinished:
            result.truncated = True
            result.reason = self._reason(http_status)
        elif self.stop_reason == "max_tokens" and any(c.args for c in calls):
            # The model ended on its output budget: the fragment is simply
            # incomplete, which is a model-side limit rather than a bad stream.
            result.truncated = True
            result.reason = "max_tokens"
        elif broken:
            # Calls marked finished but the JSON never parses -> still broken.
            result.truncated = True
            result.reason = "invalid_tool_json"
        return result

    def _reason(self, http_status: int) -> str:
        if self.aborted:
            return "client_aborted"
        if http_status >= 500:
            return "upstream_error_%d" % http_status
        if self.stop_reason == "max_tokens" or self.final_reason in ("length", "max_tokens"):
            return "max_tokens"
        if self.final_reason in ("error_event",):
            return "stream_error"
        if not self.saw_done and self.protocol == "openai" and not self.final_reason:
            return "stream_incomplete"
        return "stream_incomplete"


__all__ = ["TruncationScanner", "TruncationResult", "ToolCallBuffer", "_json_complete"]
