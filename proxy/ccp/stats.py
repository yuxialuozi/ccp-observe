# -*- coding: utf-8 -*-
"""In-memory request ledger + aggregation used by the panel APIs.

Every request the proxy handles produces exactly one ``RequestRecord``.
Aggregates are computed on read from the ledger so there is a single source
of truth; history is capped by ``history_limit`` (default 500 records).
"""

from __future__ import annotations

import threading
import time
from collections import OrderedDict
from datetime import datetime, timedelta, timezone
from typing import Any


def _now_iso(ts: float | None = None) -> str:
    moment = datetime.fromtimestamp(ts if ts is not None else time.time(), tz=timezone.utc)
    return moment.astimezone().isoformat(timespec="milliseconds")


def _pct(part: float, whole: float) -> float:
    if whole <= 0:
        return 0.0
    return round(part * 100.0 / whole, 2)


def _percentile(values: list[float], q: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    idx = min(len(ordered) - 1, max(0, int(round(q * (len(ordered) - 1)))))
    return round(ordered[idx], 1)


# Truncation reasons are grouped by *who* can act on them. This is the whole
# point of the panel: "could not be parsed as JSON" alone never says whether
# the model, the gateway or the local link is at fault.
REASON_INFO = {
    "max_tokens": ("输出被 max_tokens 截断", "model"),
    "invalid_tool_json": ("tool_use JSON 不合法", "model"),
    "client_aborted": ("客户端提前断开", "local"),
    "stream_incomplete": ("流未正常结束", "gateway"),
    "stream_error": ("上游流内报错", "gateway"),
    "done": ("流已结束", "gateway"),
}

OWNER_LABEL = {"model": "模型侧", "gateway": "网关侧", "local": "本地链路"}

OWNER_ADVICE = {
    "model": "模型在输出工具调用时被截断或生成了非法 JSON。先提高 max_tokens，"
             "再考虑降低温度、缩小工具 schema，或换一个模型对比同一批请求。",
    "gateway": "截断发生在流结束前，请求并没有正常收尾。优先检查上游/网关的"
               "流式支持、空闲超时与 5xx；同一上游换直连对比可以快速定位。",
    "local": "客户端或本地链路主动断开。检查代理超时、编辑器/IDE 卡顿、"
             "以及本机网络是否在长流式响应中途中断。",
}


def reason_owner(reason: str) -> str:
    if reason in REASON_INFO:
        return REASON_INFO[reason][1]
    if reason.startswith("upstream_error_"):
        return "gateway"
    return "gateway"


def reason_label(reason: str) -> str:
    if reason in REASON_INFO:
        return REASON_INFO[reason][0]
    if reason.startswith("upstream_error_"):
        return "上游 " + reason.rsplit("_", 1)[-1]
    return reason or "未知原因"


class RequestRecord:
    """One proxied request. Field names mirror the panel's `recent` rows."""

    __slots__ = (
        "id", "started_at", "time", "model", "requested_model", "status",
        "ok", "attempts", "duration_ms", "input_tokens", "output_tokens",
        "cache_read_tokens", "cache_write_tokens", "session", "protocol",
        "path", "truncated", "retried_ok", "error", "stream", "body_snippet",
        "truncation", "provider_id", "provider_name", "upstream_protocol",
        "translated", "route_source",
    )

    def __init__(self, **kw: Any):
        for slot in self.__slots__:
            setattr(self, slot, kw.get(slot))

    def as_dict(self) -> dict:
        out = {slot: getattr(self, slot) for slot in self.__slots__}
        out["started_at_ms"] = int(float(self.started_at or 0) * 1000)
        out["time"] = self.time or _now_iso(self.started_at)
        return out


class MetricsStore:
    """Thread-safe ledger with the aggregations the panel needs."""

    def __init__(self, history_limit: int = 500):
        self._lock = threading.RLock()
        self._records: "OrderedDict[str, RequestRecord]" = OrderedDict()
        self._seq = 0
        self._history_limit = max(1, history_limit)
        self._last_truncation_ts: float | None = None
        self._models_seen: "OrderedDict[str, float]" = OrderedDict()
        self._started_at = time.time()
        self._inflight = 0

    # -- lifecycle ---------------------------------------------------------
    def limit(self, value: int) -> None:
        with self._lock:
            self._history_limit = max(1, int(value))
            self._trim()

    def next_id(self) -> str:
        with self._lock:
            self._seq += 1
            return "r%06d" % self._seq

    def begin(self) -> None:
        with self._lock:
            self._inflight += 1

    def abort(self) -> None:
        with self._lock:
            self._inflight = max(0, self._inflight - 1)

    def add(self, record: RequestRecord) -> None:
        with self._lock:
            self._inflight = max(0, self._inflight - 1)
            self._records[record.id] = record
            if record.model and record.model != "unknown":
                self._models_seen[record.model] = record.started_at or time.time()
                # keep insertion order sorted by recency without a full scan
                self._models_seen.move_to_end(record.model)
            if record.truncated and record.started_at:
                self._last_truncation_ts = max(self._last_truncation_ts or 0, record.started_at)
            self._trim()

    def _trim(self) -> None:
        while len(self._records) > self._history_limit:
            self._records.popitem(last=False)

    # -- queries -----------------------------------------------------------
    def records(self) -> list[RequestRecord]:
        with self._lock:
            return list(self._records.values())

    def record(self, rid: str) -> RequestRecord | None:
        with self._lock:
            return self._records.get(rid)

    def recent(self, limit: int = 100, model: str | None = None) -> list[dict]:
        rows = []
        with self._lock:
            items = list(reversed(self._records.values()))
        for rec in items:
            if model and rec.model != model:
                continue
            rows.append(rec.as_dict())
            if len(rows) >= limit:
                break
        return rows

    def truncations(self, model: str | None = None, limit: int = 100) -> list[dict]:
        out = []
        with self._lock:
            items = list(reversed(self._records.values()))
        for rec in items:
            if not rec.truncated:
                continue
            if model and rec.model != model:
                continue
            reason = (rec.truncation or {}).get("reason") or "unknown"
            out.append({
                "id": rec.id,
                "time": rec.time,
                "started_at_ms": int(float(rec.started_at or 0) * 1000),
                "model": rec.model,
                "status": rec.status,
                "path": rec.path,
                "protocol": rec.protocol,
                "session": rec.session,
                "reason": reason,
                "reason_label": reason_label(reason),
                "owner": reason_owner(reason),
                "truncation": rec.truncation or {},
            })
            if len(out) >= limit:
                break
        return out

    def errors(self, limit: int = 100) -> list[dict]:
        out = []
        with self._lock:
            items = list(reversed(self._records.values()))
        for rec in items:
            if rec.ok:
                continue
            out.append({
                "id": rec.id,
                "time": rec.time,
                "status": rec.status,
                "path": rec.path,
                "model": rec.model,
                "protocol": rec.protocol,
                "attempts": rec.attempts,
                "error": rec.error,
                "request_summary": rec.body_snippet,
            })
            if len(out) >= limit:
                break
        return out

    def total_requests(self) -> int:
        with self._lock:
            return self._seq

    # -- aggregation -------------------------------------------------------
    def _aggregate(self, records: list[RequestRecord]) -> dict:
        total = len(records)
        success = sum(1 for r in records if r.ok)
        failed = total - success
        retried_ok = sum(1 for r in records if r.retried_ok)
        truncated = sum(1 for r in records if r.truncated)
        tokens_in = sum(int(r.input_tokens or 0) for r in records)
        tokens_out = sum(int(r.output_tokens or 0) for r in records)
        cache_read = sum(int(r.cache_read_tokens or 0) for r in records)
        latencies = [float(r.duration_ms) for r in records if r.duration_ms is not None]
        avg_latency = round(sum(latencies) / len(latencies), 1) if latencies else 0.0
        attempts = sum(int(r.attempts or 1) for r in records)

        # Truncation attribution: which side of the link produced the cut.
        reasons: dict[str, int] = {}
        owners = {"model": 0, "gateway": 0, "local": 0}
        for rec in records:
            if not rec.truncated:
                continue
            reason = (rec.truncation or {}).get("reason") or "unknown"
            reasons[reason] = reasons.get(reason, 0) + 1
            owners[reason_owner(reason)] += 1
        top_reason = max(reasons, key=reasons.get) if reasons else None
        # Share of truncations the model itself caused — this is the number
        # that tells a user "switch model" is the right move.
        model_share = _pct(owners["model"], truncated) if truncated else 0.0

        return {
            "requests": total,
            "success": success,
            "failed": failed,
            "success_rate": _pct(success, total),
            "failure_rate": _pct(failed, total),
            "retried_ok": retried_ok,
            "retry_success_rate": _pct(retried_ok, max(1, retried_ok + failed)),
            "truncated": truncated,
            "truncation_rate": _pct(truncated, total),
            "truncation_owners": owners,
            "truncation_model_share": model_share,
            "truncation_reasons": [
                {
                    "reason": reason,
                    "label": reason_label(reason),
                    "owner": reason_owner(reason),
                    "count": count,
                    "ratio": _pct(count, truncated),
                }
                for reason, count in sorted(reasons.items(), key=lambda kv: -kv[1])
            ],
            "top_truncation_reason": top_reason,
            "input_tokens": tokens_in,
            "output_tokens": tokens_out,
            "cache_read_tokens": cache_read,
            "avg_latency_ms": avg_latency,
            "p50_latency_ms": _percentile(latencies, 0.5),
            "p95_latency_ms": _percentile(latencies, 0.95),
            "attempts": attempts,
        }

    def model_names(self) -> list[str]:
        """Known models, most recently used first."""
        with self._lock:
            names = list(self._models_seen.keys())
        names.reverse()
        return names

    def _model_aggregates(self) -> dict[str, dict]:
        grouped: dict[str, list[RequestRecord]] = {}
        with self._lock:
            items = list(self._records.values())
        for rec in items:
            # Requests that never revealed a model (e.g. a probe to /models)
            # still count in the overall totals, but they are not models and
            # must not become a sidebar card.
            if not rec.model or rec.model == "unknown":
                continue
            grouped.setdefault(rec.model, []).append(rec)
        return grouped

    def _health(self, agg: dict) -> dict:
        trunc = agg["truncation_rate"]
        fail = agg["failure_rate"]
        # Degrade on both truncation and hard failures; failure weighs more.
        score = max(0.0, 100.0 - trunc * 1.6 - fail * 2.4)
        # Small-sample smoothing: the first couple of requests can't be
        # called critical on their own, so clamp the score and the level.
        if agg["requests"] < 3:
            score = max(score, 72.0)
        if fail >= 25 or trunc >= 40:
            level = "critical"
        elif fail > 0 or trunc > 0 or agg["avg_latency_ms"] > 30000:
            level = "warn"
        else:
            level = "ok"
        if agg["requests"] < 3 and level == "critical":
            level = "warn"

        # One sentence that names the culprit instead of restating the number.
        hint = ""
        if agg["truncated"]:
            owner = max(agg["truncation_owners"], key=agg["truncation_owners"].get)
            reason = agg.get("top_truncation_reason") or ""
            hint = "%s为主：%s" % (
                OWNER_LABEL.get(owner, owner),
                reason_label(reason),
            )
        elif fail > 0:
            hint = "请求失败，网关侧优先排查"
        elif agg["retried_ok"]:
            hint = "靠重试补回，网关侧不稳定"
        return {"score": round(score, 1), "level": level, "hint": hint}

    def stats(self) -> dict:
        records = self.records()
        overall = self._aggregate(records)
        now = time.time()
        with self._lock:
            models_seen = list(self._models_seen.keys())
            last_trunc = self._last_truncation_ts
            inflight = self._inflight
            started = self._started_at
        grouped = self._model_aggregates()
        for name in models_seen:
            grouped.setdefault(name, [])

        per_model = []
        for name, recs in grouped.items():
            agg = self._model_aggregates_for(recs)
            agg["model"] = name
            agg["health"] = self._health(agg)
            agg["last_seen"] = _now_iso(max((r.started_at or 0) for r in recs)) if recs else None
            per_model.append(agg)
        per_model.sort(key=lambda m: (m["requests"], m["model"]), reverse=True)

        active_model = None
        if models_seen:
            active_model = models_seen[-1]
        elif per_model:
            active_model = per_model[0]["model"]

        proto = {"anthropic": 0, "openai": 0, "other": 0}
        for rec in records:
            key = rec.protocol if rec.protocol in ("anthropic", "openai") else "other"
            proto[key] += 1
        proto_total = sum(proto.values()) or 1

        return {
            "generated_at": _now_iso(),
            "uptime_s": round(now - started, 1),
            "inflight": inflight,
            "active_model": active_model,
            "overall": overall,
            "models": per_model,
            "diagnosis": self._diagnose(overall, per_model),
            "protocol_mix": {
                "anthropic": proto["anthropic"],
                "openai": proto["openai"],
                "other": proto["other"],
                "anthropic_ratio": round(proto["anthropic"] * 100.0 / proto_total, 1),
                "openai_ratio": round(proto["openai"] * 100.0 / proto_total, 1),
            },
            "last_truncation_at": _now_iso(last_trunc) if last_trunc else None,
            "last_truncation_ms": int(last_trunc * 1000) if last_trunc else None,
            "recent_truncations": self.truncations(limit=8),
            "status": self._status(overall, last_trunc),
        }

    def _model_aggregates_for(self, recs: list[RequestRecord]) -> dict:
        return self._aggregate(recs)

    def _diagnose(self, overall: dict, per_model: list[dict]) -> dict:
        """Answer the only question that matters: whose fault is it?

        The heuristic is comparative. Truncation that is concentrated in one
        model while the others stay clean points at that model; truncation
        spread across every model points at the shared path (gateway or the
        local link), because a model cannot break its siblings.
        """
        truncated = overall["truncated"]
        if not truncated:
            if overall["failed"] and not overall["success"]:
                return {
                    "owner": "gateway",
                    "level": "error",
                    "headline": "所有请求都失败了，先看网关",
                    "detail": OWNER_ADVICE["gateway"],
                }
            return {
                "owner": None,
                "level": "ok",
                "headline": "暂无截断",
                "detail": "流式响应都完整收尾。保持关注即可。",
            }

        owners = overall["truncation_owners"]
        top_owner = max(owners, key=owners.get)
        # Models that carried traffic and how many of them truncated.
        noisy = [m for m in per_model if m["truncated"] > 0]
        clean = [m for m in per_model if m["requests"] >= 3 and m["truncated"] == 0]

        if len(noisy) == 1 and len(clean) >= 1:
            name = noisy[0]["model"]
            owner = "model"
            headline = "问题集中在 %s" % name
            detail = ("其他模型同期没有截断，因此更像是这个模型自身的问题，"
                      "而不是网关或本地网络。") + OWNER_ADVICE["model"]
        elif len(noisy) >= 2 and top_owner == "model":
            owner = "model"
            headline = "多个模型都在截断"
            detail = ("多个模型同时出现 tool_use 截断，优先排除共享因素："
                      "max_tokens 是否过小、工具 schema 是否过大；若仍复现，再对比上游直连。")
        elif top_owner == "local":
            owner = "local"
            headline = "截断来自客户端断开"
            detail = OWNER_ADVICE["local"]
        else:
            owner = "gateway"
            headline = "截断发生在网关或上游"
            detail = OWNER_ADVICE["gateway"]

        level = "error" if overall["truncation_rate"] >= 40 else "warn"
        return {
            "owner": owner,
            "level": level,
            "headline": headline,
            "detail": detail,
            "top_reason": overall.get("top_truncation_reason"),
            "top_reason_label": reason_label(overall.get("top_truncation_reason") or ""),
            "model_share": overall["truncation_model_share"],
        }

    def _status(self, overall: dict, last_trunc: float | None) -> dict:
        if overall["failed"] > 0:
            # A failure is only "live" if it happened in the recent window.
            recent_fail = any(
                not r.ok and (time.time() - (r.started_at or 0)) < 300
                for r in self.records()
            )
            if recent_fail:
                return {"level": "error", "label": "失败"}
        if last_trunc and (time.time() - last_trunc) < 900:
            return {"level": "warn", "label": "截断"}
        if overall["failed"] > 0 or overall["retried_ok"] > 0:
            return {"level": "warn", "label": "重试"}
        return {"level": "ok", "label": "正常"}

    # -- time buckets ------------------------------------------------------
    def buckets(self, model: str, granularity: str = "day", limit: int = 30) -> list[dict]:
        """Aggregate a model's requests into day/week/month buckets (local time)."""
        now = datetime.now().astimezone()
        if granularity == "week":
            anchor = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
            step = timedelta(days=7)
        elif granularity == "month":
            anchor = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            step = None
        else:
            anchor = now.replace(hour=0, minute=0, second=0, microsecond=0)
            step = timedelta(days=1)

        def key_of(dt: datetime) -> datetime:
            if granularity == "month":
                return dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            if granularity == "week":
                day = dt.replace(hour=0, minute=0, second=0, microsecond=0)
                return day - timedelta(days=day.weekday())
            return dt.replace(hour=0, minute=0, second=0, microsecond=0)

        def label_of(dt: datetime) -> str:
            if granularity == "month":
                return dt.strftime("%Y-%m")
            if granularity == "week":
                return dt.strftime("%m-%d") + " 周"
            return dt.strftime("%m-%d")

        def next_bucket(dt: datetime) -> datetime:
            if granularity == "month":
                return (dt.replace(day=28) + timedelta(days=4)).replace(day=1)
            return dt + step

        # Build the bucket skeleton so empty periods still show up.
        buckets: "OrderedDict[datetime, list[RequestRecord]]" = OrderedDict()
        cursor = anchor
        skeleton = []
        for _ in range(limit):
            skeleton.append(cursor)
            cursor = next_bucket(cursor)
        for dt in reversed(skeleton):
            buckets[dt] = []

        with self._lock:
            items = [r for r in self._records.values() if (r.model or "unknown") == model]
        for rec in items:
            if not rec.started_at:
                continue
            dt = datetime.fromtimestamp(rec.started_at).astimezone()
            bucket = key_of(dt)
            if bucket in buckets:
                buckets[bucket].append(rec)

        rows = []
        for dt, recs in buckets.items():
            agg = self._aggregate(recs)
            rows.append({
                "bucket": dt.isoformat(),
                "label": label_of(dt),
                "requests": agg["requests"],
                "success": agg["success"],
                "failed": agg["failed"],
                "truncated": agg["truncated"],
                "input_tokens": agg["input_tokens"],
                "output_tokens": agg["output_tokens"],
                "avg_latency_ms": agg["avg_latency_ms"],
            })
        return rows

    def context_series(self, model: str, limit: int = 200) -> list[dict]:
        """Chronological input+cache token points for the context chart."""
        with self._lock:
            items = list(self._records.values())
        points = []
        for rec in items:
            if (rec.model or "unknown") != model:
                continue
            if rec.input_tokens is None and rec.cache_read_tokens is None:
                continue
            points.append({
                "ts": int(float(rec.started_at or 0) * 1000),
                "time": rec.time,
                "input": int(rec.input_tokens or 0),
                "cache_read": int(rec.cache_read_tokens or 0),
                "output": int(rec.output_tokens or 0),
                "context": int(rec.input_tokens or 0) + int(rec.cache_read_tokens or 0),
                "truncated": bool(rec.truncated),
                "status": rec.status,
                "id": rec.id,
            })
        points.sort(key=lambda p: p["ts"])
        return points[-limit:]


__all__ = [
    "MetricsStore", "RequestRecord", "_now_iso", "_pct",
    "reason_label", "reason_owner", "OWNER_ADVICE", "OWNER_LABEL",
]
