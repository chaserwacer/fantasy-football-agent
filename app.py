from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict

from flask import Flask, jsonify, request, send_from_directory

from commissioner_service import CommissionerService
from sleeper_client import SleeperApiError, SleeperClient


ROOT_DIR = Path(__file__).resolve().parent
DEFAULT_USERNAME = os.getenv("SLEEPER_USERNAME", "chaserwacer")

app = Flask(__name__, static_folder=str(ROOT_DIR), static_url_path="")
service = CommissionerService(SleeperClient())


@app.get("/")
def index() -> Any:
    return send_from_directory(str(ROOT_DIR), "Commissioner.html")


@app.get("/api/health")
def health() -> Any:
    return jsonify({"ok": True})


@app.get("/api/context")
def context() -> Any:
    username = request.args.get("username", DEFAULT_USERNAME).strip() or DEFAULT_USERNAME
    season_raw = request.args.get("season")
    week_raw = request.args.get("week")

    season = int(season_raw) if season_raw and season_raw.isdigit() else None
    week = int(week_raw) if week_raw and week_raw.isdigit() else None

    try:
        payload = service.build_context(username=username, season=season, week=week)
    except SleeperApiError as exc:
        return jsonify({"error": str(exc)}), 502
    except Exception as exc:  # pragma: no cover - defensive fallback
        return jsonify({"error": f"Unexpected server error: {exc}"}), 500

    return jsonify(payload)


@app.post("/api/chat")
def chat() -> Any:
    body: Dict[str, Any] = request.get_json(silent=True) or {}
    message = str(body.get("message") or "").strip()
    username = str(body.get("username") or DEFAULT_USERNAME).strip() or DEFAULT_USERNAME

    season = body.get("season")
    week = body.get("week")
    if not isinstance(season, int):
        season = None
    if not isinstance(week, int):
        week = None

    if not message:
        return jsonify({"error": "message is required"}), 400

    try:
        reply = service.answer_chat(message=message, username=username, season=season, week=week)
    except SleeperApiError as exc:
        return jsonify({"error": str(exc)}), 502
    except Exception as exc:  # pragma: no cover - defensive fallback
        return jsonify({"error": f"Unexpected server error: {exc}"}), 500

    return jsonify({"reply": reply})


@app.get("/<path:filename>")
def static_files(filename: str) -> Any:
    return send_from_directory(str(ROOT_DIR), filename)


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    app.run(host="0.0.0.0", port=port, debug=True)
