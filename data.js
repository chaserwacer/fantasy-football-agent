// API-backed data hydration for Commissioner.
// The UI boots with fallback values, then refreshes with live Sleeper context from Python.

const DEFAULT_USERNAME = "chaserwacer";

const LEAGUE = {
  name: "Commissioner League",
  format: "Dynasty — Half PPR",
  teams: 12,
  week: 1,
  season: new Date().getFullYear(),
  scoring: ["Half PPR", "4pt Pass TD", "-2 INT", "Sleeper Live Data"],
  user: { handle: DEFAULT_USERNAME, team: "Loading Team", record: "0-0", rank: 0, pointsFor: 0 },
  nextOpponent: { team: "TBD", owner: "unknown", record: "0-0", rank: 0, projSpread: 0, winProb: 50 },
  myProjection: 0,
  oppProjection: 0,
};

const ROSTER = [];
const STARTSIT = [];
const DRAFT_QUEUE = [];
const DRAFT_BOARD = [];
const OPP_ROSTER = [];
const NEWS = [];

const POS_COLORS = {
  QB: "#C44536", RB: "#2B7A4B", WR: "#3A6EA5", TE: "#B88A2F", K: "#6B6760", DEF: "#6B6760", FLEX: "#141413",
};

function replaceArray(target, next) {
  target.length = 0;
  if (Array.isArray(next)) {
    next.forEach((item) => target.push(item));
  }
}

function applyPayload(payload) {
  if (!payload || typeof payload !== "object") return;
  if (payload.LEAGUE) Object.assign(LEAGUE, payload.LEAGUE);
  replaceArray(ROSTER, payload.ROSTER);
  replaceArray(STARTSIT, payload.STARTSIT);
  replaceArray(DRAFT_QUEUE, payload.DRAFT_QUEUE);
  replaceArray(DRAFT_BOARD, payload.DRAFT_BOARD);
  replaceArray(OPP_ROSTER, payload.OPP_ROSTER);
  replaceArray(NEWS, payload.NEWS);
  if (payload.POS_COLORS) Object.assign(POS_COLORS, payload.POS_COLORS);
}

function storedUsername() {
  return localStorage.getItem("cm_username") || DEFAULT_USERNAME;
}

async function loadCommissionerData(options = {}) {
  const username = (options.username || storedUsername() || DEFAULT_USERNAME).trim();
  localStorage.setItem("cm_username", username);

  const query = new URLSearchParams({ username });
  const url = `/api/context?${query.toString()}`;

  try {
    const response = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `Data load failed (${response.status})`);
    }
    const payload = await response.json();
    applyPayload(payload);
    window.dispatchEvent(new CustomEvent("commissioner:data-updated", { detail: { username } }));
    return payload;
  } catch (err) {
    console.error("Commissioner data load failed:", err);
    window.dispatchEvent(new CustomEvent("commissioner:data-error", { detail: { message: String(err) } }));
    return null;
  }
}

function setSleeperUsername(username) {
  const next = (username || "").trim();
  if (!next) return Promise.resolve(null);
  return loadCommissionerData({ username: next });
}

Object.assign(window, {
  LEAGUE,
  ROSTER,
  STARTSIT,
  DRAFT_QUEUE,
  DRAFT_BOARD,
  OPP_ROSTER,
  NEWS,
  POS_COLORS,
  loadCommissionerData,
  setSleeperUsername,
  getSleeperUsername: storedUsername,
});
