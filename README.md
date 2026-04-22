# Commissioner (Python + Sleeper)

Commissioner is now a Python-backed fantasy football co-manager app.
The UI remains the provided design, but data and recommendations are now loaded from live Sleeper API context.

## What this build does

- Loads your Sleeper user and league context.
- Picks a viable league automatically (with offseason fallback logic).
- Builds roster, matchup, start/sit, and waiver-priority data.
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

## API endpoints

- GET /api/health
- GET /api/context?username=...
- POST /api/chat
