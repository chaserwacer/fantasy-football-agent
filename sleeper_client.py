from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

import requests


class SleeperApiError(RuntimeError):
    """Raised when Sleeper API data cannot be retrieved."""


@dataclass
class CacheEntry:
    value: Any
    expires_at: float


class TTLCache:
    """Simple in-memory TTL cache for API responses."""

    def __init__(self) -> None:
        self._store: Dict[str, CacheEntry] = {}

    def get(self, key: str) -> Optional[Any]:
        entry = self._store.get(key)
        if not entry:
            return None
        if entry.expires_at < time.time():
            self._store.pop(key, None)
            return None
        return entry.value

    def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        self._store[key] = CacheEntry(value=value, expires_at=time.time() + ttl_seconds)


class SleeperClient:
    """Typed wrapper over the Sleeper public API."""

    BASE_URL = "https://api.sleeper.app/v1"

    def __init__(self, timeout_seconds: int = 15) -> None:
        self._timeout_seconds = timeout_seconds
        self._session = requests.Session()
        self._cache = TTLCache()

    def _cache_key(self, path: str, params: Optional[Dict[str, Any]]) -> str:
        encoded = json.dumps(params or {}, sort_keys=True, separators=(",", ":"))
        return f"{path}?{encoded}"

    def _get_json(
        self,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        ttl_seconds: int = 0,
    ) -> Any:
        key = self._cache_key(path, params)
        if ttl_seconds > 0:
            cached = self._cache.get(key)
            if cached is not None:
                return cached

        url = f"{self.BASE_URL}{path}"
        response = self._session.get(url, params=params, timeout=self._timeout_seconds)
        if response.status_code == 404:
            raise SleeperApiError(f"Sleeper resource not found: {path}")
        if response.status_code >= 400:
            raise SleeperApiError(f"Sleeper request failed ({response.status_code}) for {path}")

        payload = response.json()
        if ttl_seconds > 0:
            self._cache.set(key, payload, ttl_seconds)
        return payload

    def get_state(self) -> Dict[str, Any]:
        return self._get_json("/state/nfl", ttl_seconds=300)

    def get_user_by_username(self, username: str) -> Dict[str, Any]:
        return self._get_json(f"/user/{username}", ttl_seconds=600)

    def get_user_leagues(self, user_id: str, season: int) -> list[Dict[str, Any]]:
        return self._get_json(f"/user/{user_id}/leagues/nfl/{season}", ttl_seconds=300)

    def get_league(self, league_id: str) -> Dict[str, Any]:
        return self._get_json(f"/league/{league_id}", ttl_seconds=300)

    def get_league_users(self, league_id: str) -> list[Dict[str, Any]]:
        return self._get_json(f"/league/{league_id}/users", ttl_seconds=300)

    def get_league_rosters(self, league_id: str) -> list[Dict[str, Any]]:
        return self._get_json(f"/league/{league_id}/rosters", ttl_seconds=180)

    def get_matchups(self, league_id: str, week: int) -> list[Dict[str, Any]]:
        return self._get_json(f"/league/{league_id}/matchups/{week}", ttl_seconds=90)

    def get_players(self) -> Dict[str, Dict[str, Any]]:
        return self._get_json("/players/nfl", ttl_seconds=86400)

    def get_stats(self, season: int, week: int) -> Dict[str, Dict[str, Any]]:
        return self._get_json(
            f"/stats/nfl/{season}/{week}",
            params={"season_type": "regular"},
            ttl_seconds=600,
        )

    def get_projections(self, season: int, week: int) -> Dict[str, Dict[str, Any]]:
        return self._get_json(
            f"/projections/nfl/{season}/{week}",
            params={"season_type": "regular"},
            ttl_seconds=600,
        )

    def get_trending(self, kind: str = "add", lookback_hours: int = 24, limit: int = 25) -> list[Dict[str, Any]]:
        return self._get_json(
            f"/players/nfl/trending/{kind}",
            params={"lookback_hours": lookback_hours, "limit": limit},
            ttl_seconds=120,
        )

    def request_external_json(self, url: str, *, ttl_key: Optional[str] = None, ttl_seconds: int = 0) -> Any:
        key = ttl_key or url
        if ttl_seconds > 0:
            cached = self._cache.get(key)
            if cached is not None:
                return cached

        response = self._session.get(url, timeout=self._timeout_seconds)
        if response.status_code >= 400:
            raise SleeperApiError(f"External request failed ({response.status_code}) for {url}")

        payload = response.json()
        if ttl_seconds > 0:
            self._cache.set(key, payload, ttl_seconds)
        return payload
