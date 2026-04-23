# Commissioner (Python + Sleeper)

Commissioner is now a Python-backed fantasy football co-manager app.
The UI remains the provided design, but data and recommendations are now loaded from live Sleeper API context.

## What this build does

- Loads your Sleeper user and league context.
- Picks a viable league automatically (with offseason fallback logic).
- Builds roster, matchup, start/sit, and waiver-priority data.
- Preserves deterministic recommendation logic and adds an optional OpenAI AI overlay.
- Uses external team-performance context (ESPN standings win%).
- Provides read-only action guidance so you can execute actions manually in Sleeper.
- Supports contextual chat replies from your current league state.

## Run locally

1. Install dependencies:

   python -m pip install -r requirements.txt

2. Run the app:

   python app.py

3. Open:

   http://localhost:8000

## Username configuration

Default Sleeper username is set to `chaserwacer`.

Override with environment variable:

PowerShell:

$env:SLEEPER_USERNAME = "your_username"
python app.py

## OpenAI configuration (optional)

To enable AI overlays on top of deterministic recommendations:

PowerShell:

$env:OPENAI_API_KEY = "your_openai_key"
$env:OPENAI_MODEL = "gpt-4o-mini"
python app.py

Notes:

- If `OPENAI_API_KEY` is missing, the app uses deterministic recommendations only.
- `OPENAI_MODEL` is optional (defaults to `gpt-4o-mini`).
- `OPENAI_TIMEOUT_SECONDS` is optional (defaults to `25`).

## API endpoints

- GET /api/health
- GET /api/context?username=...&llm=true
- POST /api/chat

### Context payload additions

`GET /api/context` now includes `LLM_RECOMMENDATIONS`:

- `enabled`: whether AI overlay is active
- `summary`: short AI perspective for the current week
- `lineup`: additive start/sit ideas
- `waivers`: additive waiver targets
- `matchupFocus`, `riskAlerts`, `tradeAngles`: extra strategic viewpoints

Use `llm=false` (query param) or `use_llm=false` (chat body) to force deterministic-only responses.
