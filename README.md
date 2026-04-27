# Commissioner

Commissioner is a fantasy football co-manager that turns your live Sleeper league into a weekly decision brief — lineup calls, waiver priorities, matchup reads, and an optional AI second opinion. It runs locally as a small Flask service with a single-page React UI.

Commissioner is **read-only**. It never mutates your Sleeper account. Actions are presented as a copyable instruction plus a checklist you execute in the Sleeper app.

![Commissioner dashboard screenshot placeholder](docs/screenshot.png)

## Features

- **Live Sleeper sync** — user, league, roster, matchup, projections, stats, and trending adds.
- **Deterministic start/sit** — ranks bench-vs-starter swaps by projection edge with slot-eligibility awareness.
- **Priority waiver queue** — merges trending adds with roster-construction need bias.
- **Matchup preview** — projected spread, win probability, and position-by-position edge.
- **Optional AI overlay** — OpenAI-backed second opinion on lineup, waivers, and risk (additive to deterministic output).
- **Contextual chat** — `/api/chat` grounded in your current league state.
- **Offseason fallback** — when no active league week exists, picks the most recent viable league automatically.

## Architecture

```
┌──────────────┐    fetch     ┌─────────────────┐   HTTPS   ┌──────────────┐
│ Commissioner │◄────────────►│  Flask (app.py) │◄─────────►│ Sleeper API  │
│  React SPA   │   /api/*     │  Commissioner   │           │ ESPN (team   │
│ (Babel-CDN)  │              │  Service        │           │ strength)    │
└──────────────┘              │                 │◄─────────►│ OpenAI (opt) │
                              └─────────────────┘           └──────────────┘
```

- [`app.py`](app.py) — Flask HTTP layer; serves the static SPA and JSON APIs.
- [`sleeper_client.py`](sleeper_client.py) — typed wrapper over the Sleeper public API with an in-memory TTL cache.
- [`commissioner_service.py`](commissioner_service.py) — orchestration, scoring, roster/matchup/waiver logic.
- [`llm_recommender.py`](llm_recommender.py) — optional OpenAI overlay for recommendations and chat replies.
- [`Commissioner.html`](Commissioner.html), [`components/`](components/), [`data.js`](data.js), [`styles.css`](styles.css) — React SPA compiled in-browser via Babel standalone (no build step).

## Prerequisites

- Python 3.10+
- A Sleeper account with at least one NFL league on the user you query
- *(Optional)* An OpenAI API key to enable the AI overlay

## Run locally

1. Install dependencies:

   ```sh
   python -m pip install -r requirements.txt
   ```

2. Copy the env template and fill in your values:

   ```sh
   cp .env.example .env
   # then edit .env
   ```

   At minimum set `SLEEPER_USERNAME`. All variables are optional — the app falls back to prompting via the UI if no username is configured.

3. Run the app:

   ```sh
   python app.py
   ```

4. Open <http://localhost:8000>.

The frontend reads the username from `localStorage` (key `cm_username`) and falls back to the `SLEEPER_USERNAME` environment variable on the server. Call `window.setSleeperUsername("handle")` from the browser console to switch accounts.

## Configuration

All configuration is via environment variables. See [`.env.example`](.env.example) for a template.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `SLEEPER_USERNAME` | No | *(none)* | Default Sleeper handle used when the client doesn't provide one. |
| `PORT` | No | `8000` | HTTP port for the Flask server. |
| `FLASK_DEBUG` | No | `0` | Set to `1` to enable Flask's reloader/debugger. **Never enable in a deployment reachable from the public internet** — the Werkzeug debugger allows arbitrary code execution. |
| `OPENAI_API_KEY` | No | *(unset)* | If set, enables the AI overlay in `/api/context` and `/api/chat`. |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | Chat-completions model ID. |
| `OPENAI_TIMEOUT_SECONDS` | No | `25` | Per-request timeout (minimum 10s). |
| `COMMISSIONER_HISTORY_PATH` | No | `data/history.json` | File path for the persisted context snapshots and chat history. The parent directory is created on startup. |

If `OPENAI_API_KEY` is missing or empty, the app silently uses deterministic recommendations only — the UI surfaces a hint in the "AI Second Opinion" card.

## API

The Flask server exposes three JSON endpoints plus static assets.

### `GET /api/health`

Liveness probe. Returns `{"ok": true}`.

### `GET /api/diagnostics`

Runs a live upstream health check against Sleeper, ESPN, and OpenAI (if configured) with short timeouts. Powers the **Settings → Run health check** button in the UI.

```json
{
  "overall": "ok",
  "headline": "All required services reachable. App is good to run.",
  "checks": [
    { "name": "Sleeper", "status": "ok", "message": "HTTP 200", "latencyMs": 142, "detail": "…" },
    { "name": "ESPN",    "status": "ok", "message": "HTTP 200", "latencyMs": 210, "detail": "…" },
    { "name": "OpenAI",  "status": "disabled", "message": "OPENAI_API_KEY not set", "latencyMs": null, "detail": "…" }
  ]
}
```

Per-check `status` values: `ok`, `warn` (credentials rejected), `error`, `disabled` (feature off). `overall` is `ok`, `degraded`, or `error`.

### `GET /api/context`

Returns the full dashboard payload — league, roster, start/sit recommendations, waiver queue, matchup, news, and optional LLM overlay.

Query parameters:

| Param | Default | Notes |
| --- | --- | --- |
| `username` | `SLEEPER_USERNAME` | Sleeper username to load. |
| `season` | auto from `/state/nfl` | Optional season override (e.g. `2025`). |
| `week` | auto from `/state/nfl` | Optional week override (1–18). |
| `llm` | `true` | Set `false` / `0` / `off` to skip the OpenAI overlay even if a key is configured. |

The `LLM_RECOMMENDATIONS` sub-object always exists. When disabled, `enabled` is `false` and `summary` explains why (no key, disabled by request, or upstream error).

The `META.source` field is `live` for fresh fetches and `history` when the server served the last persisted snapshot after an upstream failure.

### `POST /api/chat`

Contextual chat grounded in the current league snapshot.

```json
{
  "message": "Who do I start at FLEX?",
  "username": "your_sleeper_handle",
  "season": 2025,
  "week": 6,
  "use_llm": true
}
```

Only `message` is required. When `use_llm` is true and `OPENAI_API_KEY` is set, the server calls OpenAI with a trimmed context; otherwise it returns a deterministic heuristic reply.

### `GET /api/chat/history`

Returns persisted chat turns for a user so prior suggestions survive restarts.

| Param | Default | Notes |
| --- | --- | --- |
| `username` | `SLEEPER_USERNAME` | Sleeper handle. |
| `limit` | `50` | Max turns to return (1–200). |

Response:

```json
{
  "username": "your_handle",
  "messages": [
    { "timestamp": "2026-04-23T17:12:44+00:00", "user_message": "…", "reply": "…", "used_llm": true }
  ]
}
```

## Persistence

Both context snapshots and chat turns are written to a local JSON file (see `COMMISSIONER_HISTORY_PATH`). On startup the UI:

- renders a loading state until the first live fetch completes,
- automatically falls back to the most recent saved snapshot if Sleeper is unreachable, and
- restores the last ~50 chat turns in the Ask Commissioner panel.

The history file contains live league data — keep it out of version control. The default path `data/` is already in [`.gitignore`](.gitignore).

## Caching

Sleeper responses are cached in-process with endpoint-specific TTLs (player catalog: 24h, matchups: 90s, projections: 10m). The full context payload is cached per `(username, season, week, llm_mode)` for 90 seconds to absorb UI refreshes. Restart the server to clear the cache.

## Limitations

- Single-process in-memory cache — not horizontally scalable as-is.
- No authentication. Intended for local or trusted-network use.
- ESPN standings are fetched anonymously and may rate-limit under load.
- When upstream data is missing (for example no published matchup yet), the UI now renders explicit unavailable markers instead of synthetic placeholder stats.

## License

MIT — see [LICENSE](LICENSE).
