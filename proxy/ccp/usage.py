# -*- coding: utf-8 -*-
"""Persistent daily usage ledger.

``MetricsStore`` is a ring buffer sized for the panel's request list: it holds
the last N requests and therefore forgets yesterday. Usage is the one number a
user *does* look back on, so it gets its own store: per day, per model, per
provider, kept on disk and merged as traffic arrives.

The file is rewritten atomically on a debounce, so a busy proxy does not pay a
JSON write per request but a crash loses at most ``flush_interval`` seconds.
"""

from __future__ import annotations

import json
import os
import threading
import time
from datetime import date, datetime, timedelta

USAGE_FILE = "usage.json"

# Keep a quarter of a year; enough for a chart, small enough to stay tiny.
DEFAULT_RETAIN_DAYS = 120


def _day_of(ts: float) -> str:
    return datetime.fromtimestamp(ts).astimezone().strftime("%Y-%m-%d")


def _empty_row() -> dict:
    return {
        "requests": 0, "success": 0, "failed": 0, "truncated": 0,
        "retried_ok": 0, "input_tokens": 0, "output_tokens": 0,
        "cache_read_tokens": 0, "cache_write_tokens": 0,
        "duration_ms": 0.0,
    }


class UsageLedger:
    """Day-bucketed totals that survive a restart."""

    def __init__(self, base_dir: str, retain_days: int = DEFAULT_RETAIN_DAYS,
                 flush_interval: float = 5.0):
        self._base = base_dir
        self._path = os.path.join(base_dir, USAGE_FILE)
        self._lock = threading.RLock()
        self._retain = max(7, int(retain_days))
        self._flush_interval = max(0.0, float(flush_interval))
        self._dirty = False
        self._last_flush = 0.0
        # {"YYYY-MM-DD": {"models": {name: row}, "providers": {name: row}, "total": row}}
        self._days: dict[str, dict] = {}
        self._load()

    # -- persistence -------------------------------------------------------
    def _load(self) -> None:
        try:
            with open(self._path, "r", encoding="utf-8") as fh:
                stored = json.load(fh)
        except (OSError, ValueError):
            return
        days = stored.get("days") if isinstance(stored, dict) else None
        if not isinstance(days, dict):
            return
        for key, value in days.items():
            if isinstance(value, dict) and isinstance(value.get("models"), dict):
                self._days[str(key)] = value
        self._prune()

    def flush(self, force: bool = False) -> None:
        with self._lock:
            if not self._dirty:
                return
            if not force and (time.time() - self._last_flush) < self._flush_interval:
                return
            self._prune()
            payload = {"version": 1, "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
                       "days": self._days}
            tmp = self._path + ".tmp"
            try:
                os.makedirs(self._base, exist_ok=True)
                with open(tmp, "w", encoding="utf-8") as fh:
                    json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
                os.replace(tmp, self._path)
                self._dirty = False
                self._last_flush = time.time()
            except OSError:
                pass

    def _prune(self) -> None:
        cutoff = (date.today() - timedelta(days=self._retain)).strftime("%Y-%m-%d")
        for key in [k for k in self._days if k < cutoff]:
            del self._days[key]

    # -- write -------------------------------------------------------------
    def record(self, ts: float, model: str, provider: str, ok: bool,
               truncated: bool, retried_ok: bool, duration_ms: float,
               input_tokens, output_tokens, cache_read, cache_write) -> None:
        """Fold one finished request into today's rows."""
        day = _day_of(ts)
        with self._lock:
            bucket = self._days.setdefault(day, {"models": {}, "providers": {}, "total": _empty_row()})
            targets = [
                bucket["total"],
                bucket["models"].setdefault(model or "unknown", _empty_row()),
            ]
            if provider:
                targets.append(bucket["providers"].setdefault(provider, _empty_row()))
            for row in targets:
                row["requests"] += 1
                if ok:
                    row["success"] += 1
                else:
                    row["failed"] += 1
                if truncated:
                    row["truncated"] += 1
                if retried_ok:
                    row["retried_ok"] += 1
                row["input_tokens"] += int(input_tokens or 0)
                row["output_tokens"] += int(output_tokens or 0)
                row["cache_read_tokens"] += int(cache_read or 0)
                row["cache_write_tokens"] += int(cache_write or 0)
                row["duration_ms"] += float(duration_ms or 0)
            self._dirty = True
        self.flush()

    # -- read --------------------------------------------------------------
    def days(self, limit: int = 30) -> list[dict]:
        """Newest-last list of daily totals, gaps filled with zeros."""
        limit = max(1, min(400, int(limit)))
        with self._lock:
            snapshot = dict(self._days)
        today = date.today()
        out = []
        for offset in range(limit - 1, -1, -1):
            key = (today - timedelta(days=offset)).strftime("%Y-%m-%d")
            bucket = snapshot.get(key) or {}
            row = dict(_empty_row())
            row.update(bucket.get("total") or {})
            out.append({**self._finish(row), "date": key})
        return out

    def by_model(self, days: int = 30) -> list[dict]:
        windows = self.days(days)
        start = windows[0]["date"] if windows else ""
        with self._lock:
            snapshot = dict(self._days)
        totals: dict[str, dict] = {}
        for key, bucket in snapshot.items():
            if key < start:
                continue
            for name, row in (bucket.get("models") or {}).items():
                acc = totals.setdefault(name, _empty_row())
                for field, value in row.items():
                    acc[field] = acc.get(field, 0) + value
        rows = [{**self._finish(row), "model": name} for name, row in totals.items()]
        rows.sort(key=lambda r: (r["requests"], r["model"]), reverse=True)
        return rows

    def providers(self, days: int = 30) -> list[dict]:
        windows = self.days(days)
        start = windows[0]["date"] if windows else ""
        with self._lock:
            snapshot = dict(self._days)
        totals: dict[str, dict] = {}
        for key, bucket in snapshot.items():
            if key < start:
                continue
            for name, row in (bucket.get("providers") or {}).items():
                acc = totals.setdefault(name, _empty_row())
                for field, value in row.items():
                    acc[field] = acc.get(field, 0) + value
        rows = [{**self._finish(row), "provider": name} for name, row in totals.items()]
        rows.sort(key=lambda r: (r["requests"], r["provider"]), reverse=True)
        return rows

    def summary(self, days: int = 30) -> dict:
        windows = self.days(days)
        total = _empty_row()
        for row in windows:
            for field in total:
                if field == "duration_ms":
                    continue
                total[field] = total.get(field, 0) + row.get(field, 0)
            # `days()` already folded duration into an average; rebuild the
            # total so the window average is not computed from averages.
            total["duration_ms"] += (row.get("avg_latency_ms") or 0.0) * (row.get("requests") or 0)
        finished = self._finish(total)
        finished["days"] = len(windows)
        finished["active_days"] = sum(1 for r in windows if r["requests"])
        today = windows[-1] if windows else {}
        finished["today"] = {k: today.get(k) for k in (
            "requests", "success", "failed", "truncated",
            "input_tokens", "output_tokens", "cache_read_tokens", "avg_latency_ms")}
        return finished

    @staticmethod
    def _finish(row: dict) -> dict:
        out = dict(row)
        requests = out.get("requests") or 0
        out["avg_latency_ms"] = round((out.get("duration_ms") or 0.0) / requests, 1) if requests else 0.0
        out.pop("duration_ms", None)
        out["success_rate"] = round(out["success"] * 100.0 / requests, 2) if requests else 0.0
        out["truncation_rate"] = round(out["truncated"] * 100.0 / requests, 2) if requests else 0.0
        return out


__all__ = ["UsageLedger", "USAGE_FILE"]
