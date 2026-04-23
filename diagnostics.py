from __future__ import annotations

import os
import time
from typing import Any, Dict, List, Optional

import requests


SLEEPER_PROBE_URL = "https://api.sleeper.app/v1/state/nfl"
ESPN_PROBE_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/standings"
OPENAI_MODELS_URL = "https://api.openai.com/v1/models"


def _probe(name: str, url: str, *, headers: Optional[Dict[str, str]] = None, timeout: float = 6.0) -> Dict[str, Any]:
    started = time.monotonic()
    try:
        response = requests.get(url, headers=headers or {}, timeout=timeout)
    except requests.exceptions.Timeout:
        return {"name": name, "status": "error", "message": f"Timed out after {timeout:.0f}s", "latencyMs": None}
    except requests.exceptions.RequestException as exc:
        return {"name": name, "status": "error", "message": f"Connection failed: {exc}", "latencyMs": None}

    latency_ms = int((time.monotonic() - started) * 1000)
    if 200 <= response.status_code < 300:
        return {"name": name, "status": "ok", "message": f"HTTP {response.status_code}", "latencyMs": latency_ms}
    if response.status_code in (401, 403):
        return {
            "name": name,
            "status": "warn",
            "message": f"HTTP {response.status_code} — credentials rejected",
            "latencyMs": latency_ms,
        }
    return {
        "name": name,
        "status": "error",
        "message": f"HTTP {response.status_code}",
        "latencyMs": latency_ms,
    }


def check_sleeper() -> Dict[str, Any]:
    result = _probe("Sleeper", SLEEPER_PROBE_URL)
    result["detail"] = "Public API — no credentials required."
    return result


def check_espn() -> Dict[str, Any]:
    result = _probe("ESPN", ESPN_PROBE_URL)
    result["detail"] = "Used for external team-strength signals. Optional — app runs without it."
    return result


def check_openai() -> Dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return {
            "name": "OpenAI",
            "status": "disabled",
            "message": "OPENAI_API_KEY not set",
            "detail": "App will run in deterministic-only mode without AI overlays.",
            "latencyMs": None,
        }
    result = _probe("OpenAI", OPENAI_MODELS_URL, headers={"Authorization": f"Bearer {api_key}"})
    result["detail"] = f"Model: {os.getenv('OPENAI_MODEL', 'gpt-4o-mini') or 'gpt-4o-mini'}"
    return result


def run_all() -> Dict[str, Any]:
    checks: List[Dict[str, Any]] = [check_sleeper(), check_espn(), check_openai()]

    if any(c["status"] == "error" and c["name"] == "Sleeper" for c in checks):
        overall = "error"
        headline = "Sleeper is unreachable — the app cannot pull live league data."
    elif any(c["status"] == "error" for c in checks):
        overall = "degraded"
        headline = "App can run, but one or more optional signals are unavailable."
    elif any(c["status"] == "warn" for c in checks):
        overall = "degraded"
        headline = "App can run, but credentials were rejected for a service."
    else:
        overall = "ok"
        headline = "All required services reachable. App is good to run."

    return {"overall": overall, "headline": headline, "checks": checks}
