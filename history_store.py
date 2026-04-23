from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


class HistoryStore:
    """File-backed store for context snapshots and chat turns.

    Context snapshots are indexed by (username, season, week) so that when the
    app restarts, the most recent snapshot for a user can be rehydrated as a
    stale-but-visible view while the next live fetch is in flight. Chat history
    is kept per-username so previous AI replies survive restarts.
    """

    def __init__(self, path: Path) -> None:
        self._path = path
        self._lock = threading.Lock()
        self._path.parent.mkdir(parents=True, exist_ok=True)

    def _read(self) -> Dict[str, Any]:
        if not self._path.exists():
            return {"contexts": {}, "chats": {}}
        try:
            with self._path.open("r", encoding="utf-8") as handle:
                data = json.load(handle)
        except (OSError, json.JSONDecodeError):
            return {"contexts": {}, "chats": {}}
        data.setdefault("contexts", {})
        data.setdefault("chats", {})
        return data

    def _write(self, data: Dict[str, Any]) -> None:
        tmp = self._path.with_suffix(self._path.suffix + ".tmp")
        with tmp.open("w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2, sort_keys=True)
        os.replace(tmp, self._path)

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _context_key(username: str, season: int, week: int) -> str:
        return f"{username.lower()}::{season}::{week}"

    def save_context(self, *, username: str, season: int, week: int, payload: Dict[str, Any]) -> None:
        snapshot = dict(payload)
        meta = dict(snapshot.get("META") or {})
        meta["fetched_at"] = self._now_iso()
        meta["source"] = "live"
        snapshot["META"] = meta

        with self._lock:
            data = self._read()
            key = self._context_key(username, season, week)
            data["contexts"][key] = snapshot
            self._write(data)

    def latest_context(self, username: str) -> Optional[Dict[str, Any]]:
        key_prefix = f"{username.lower()}::"
        with self._lock:
            data = self._read()
            candidates = [
                (k, v) for k, v in data["contexts"].items() if k.startswith(key_prefix)
            ]
        if not candidates:
            return None

        def sort_key(entry: tuple[str, Dict[str, Any]]) -> tuple[str, int, int]:
            key, snapshot = entry
            try:
                _, season_str, week_str = key.split("::")
                season = int(season_str)
                week = int(week_str)
            except ValueError:
                season = 0
                week = 0
            fetched_at = str((snapshot.get("META") or {}).get("fetched_at") or "")
            return fetched_at, season, week

        candidates.sort(key=sort_key, reverse=True)
        _, snapshot = candidates[0]
        snapshot = dict(snapshot)
        meta = dict(snapshot.get("META") or {})
        meta["source"] = "history"
        snapshot["META"] = meta
        return snapshot

    def append_chat(self, *, username: str, user_message: str, reply: str, used_llm: bool) -> None:
        entry = {
            "timestamp": self._now_iso(),
            "user_message": user_message,
            "reply": reply,
            "used_llm": bool(used_llm),
        }
        with self._lock:
            data = self._read()
            key = username.lower()
            history: List[Dict[str, Any]] = list(data["chats"].get(key) or [])
            history.append(entry)
            if len(history) > 100:
                history = history[-100:]
            data["chats"][key] = history
            self._write(data)

    def list_chats(self, username: str, limit: int = 50) -> List[Dict[str, Any]]:
        with self._lock:
            data = self._read()
            history = list(data["chats"].get(username.lower()) or [])
        if limit > 0:
            history = history[-limit:]
        return history
