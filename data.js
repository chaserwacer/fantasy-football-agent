// API-backed data hydration for Commissioner.
// The UI starts empty and renders a loading state until the server returns
// a live Sleeper snapshot, or until a persisted snapshot is rehydrated from
// the server-side history store.

const LEAGUE = {
  name: "",
  format: "",
  teams: 0,
  week: 0,
  season: 0,
  scoring: [],
  user: { handle: "", team: "", record: "", rank: 0, pointsFor: 0 },
  nextOpponent: { team: "", owner: "", record: "", rank: 0, projSpread: 0, winProb: 0 },
  myProjection: 0,
  oppProjection: 0,
};

const ROSTER = [];
const STARTSIT = [];
const DRAFT_QUEUE = [];
const DRAFT_BOARD = [];
const OPP_ROSTER = [];
const NEWS = [];
const LLM_RECOMMENDATIONS = {
  enabled: false,
  provider: "",
  model: "",
  summary: "",
  lineup: [],
  waivers: [],
  matchupFocus: [],
  riskAlerts: [],
  tradeAngles: [],
};

const POS_COLORS = {
  QB: "#C44536", RB: "#2B7A4B", WR: "#3A6EA5", TE: "#B88A2F", K: "#6B6760", DEF: "#6B6760", FLEX: "#141413",
};

const DATA_STATE = { loaded: false, source: "none", fetchedAt: null };

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
  if (payload.LLM_RECOMMENDATIONS) Object.assign(LLM_RECOMMENDATIONS, payload.LLM_RECOMMENDATIONS);
  if (payload.POS_COLORS) Object.assign(POS_COLORS, payload.POS_COLORS);
  DATA_STATE.loaded = true;
  DATA_STATE.source = payload.META?.source || "live";
  DATA_STATE.fetchedAt = payload.META?.fetched_at || new Date().toISOString();
}

function storedUsername() {
  return localStorage.getItem("cm_username") || "";
}

async function loadCommissionerData(options = {}) {
  const username = String(options.username ?? storedUsername()).trim();
  const query = new URLSearchParams();
  if (username) {
    localStorage.setItem("cm_username", username);
    query.set("username", username);
  }
  const url = `/api/context${query.toString() ? `?${query.toString()}` : ""}`;

  try {
    const response = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `Data load failed (${response.status})`);
    }
    const payload = await response.json();
    applyPayload(payload);
    window.dispatchEvent(new CustomEvent("commissioner:data-updated", { detail: { username, source: DATA_STATE.source } }));
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
  LLM_RECOMMENDATIONS,
  POS_COLORS,
  DATA_STATE,
  loadCommissionerData,
  setSleeperUsername,
  getSleeperUsername: storedUsername,
});
