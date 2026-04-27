// Matchup preview + Roster + Settings
function MatchupScreen() {
  const myTotal = Number(LEAGUE.myProjection || ROSTER.filter(r => r.slot !== "BN").reduce((s,r) => s+r.proj, 0));
  const oppTotal = Number(LEAGUE.oppProjection || OPP_ROSTER.reduce((s,r) => s+r.proj, 0));
  const spread = myTotal - oppTotal;
  const hasOpponentProjection = OPP_ROSTER.length > 0;
  const starters = ROSTER.filter(r => r.slot !== "BN").slice(0, 7);
  const comparisons = starters.slice(0, OPP_ROSTER.length).map((mine, idx) => {
    const opp = OPP_ROSTER[idx];
    return {
      pos: mine.slot || mine.pos,
      me: mine.n,
      mePts: Number(mine.proj || 0),
      opp: opp?.n || "",
      oppPts: Number(opp?.proj || 0),
    };
  });
  const readTitle = OPP_ROSTER.length
    ? (spread >= 0 ? "You are currently favored in this matchup." : "You are currently a projection underdog.")
    : "No official matchup projection is published yet.";
  const readBody = OPP_ROSTER.length
    ? "Treat this as an early probability signal. Projection swings near kickoff are normal once inactives and role changes are confirmed."
    : "Sleeper has not yet surfaced a complete opponent lineup for this week. Keep monitoring as the slate firms up.";

  const keyItems = [];
  if (STARTSIT?.[0]) keyItems.push({ k: `Apply top lineup call: ${STARTSIT[0].slot}`, v: `${STARTSIT[0].recommendStart} over ${STARTSIT[0].recommendSit}` });
  if (STARTSIT?.[1]) keyItems.push({ k: `Secondary call: ${STARTSIT[1].slot}`, v: `${STARTSIT[1].recommendStart} over ${STARTSIT[1].recommendSit}` });
  if (WAIVERS?.[0]) keyItems.push({ k: "Top waiver-style add", v: `${WAIVERS[0].n} (${WAIVERS[0].pos})` });
  keyItems.push({ k: "Final check", v: "Re-run decisions 60 minutes before kickoff." });
  const winProb = Number.isFinite(Number(LEAGUE.nextOpponent?.winProb)) ? Number(LEAGUE.nextOpponent.winProb) : null;
  const matchupStamp = LEAGUE.nextOpponent?.record ? `Opponent record ${LEAGUE.nextOpponent.record}` : "Matchup timing unavailable";

  return (
    <>
      <Masthead
        eyebrow={`Matchup Preview · Week ${LEAGUE.week}`}
        title={LEAGUE.user?.team || "-"}
        titleEm={`vs ${LEAGUE.nextOpponent?.team || "Opponent unavailable"}`}
        right={<><span>{matchupStamp}</span><span className="big">Win prob {winProb != null ? `${winProb}%` : "n/a"}</span></>}
      />
      <div className="content" style={{paddingTop:28}}>
        <div className="grid-dash">
          <div>
            <Eyebrow>Projection Spread</Eyebrow>
            <div style={{display:"grid", gridTemplateColumns:"1fr 80px 1fr", alignItems:"center", gap:20, marginTop:14, padding:"20px 0", borderTop:"1px solid var(--ink)", borderBottom:"1px solid var(--ink)"}}>
              <div>
                <div className="mono" style={{fontSize:10, letterSpacing:"0.1em", color:"var(--ink-3)"}}>{LEAGUE.user?.team || "-"} · {LEAGUE.user?.record || "-"}</div>
                <div style={{fontFamily:"var(--serif)", fontSize:72, lineHeight:1, letterSpacing:"-0.02em"}}>{myTotal.toFixed(1)}</div>
                <div className="mono" style={{fontSize:11, color:"var(--ink-3)", marginTop:4}}>projected points</div>
              </div>
              <div style={{textAlign:"center", fontFamily:"var(--serif)", fontStyle:"italic", fontSize:28, color:"var(--ink-3)"}}>vs</div>
              <div style={{textAlign:"right"}}>
                <div className="mono" style={{fontSize:10, letterSpacing:"0.1em", color:"var(--ink-3)"}}>{LEAGUE.nextOpponent?.team || "Opponent unavailable"} · {LEAGUE.nextOpponent?.record || "-"}</div>
                <div style={{fontFamily:"var(--serif)", fontSize:72, lineHeight:1, letterSpacing:"-0.02em"}}>{hasOpponentProjection ? oppTotal.toFixed(1) : "-"}</div>
                <div className="mono" style={{fontSize:11, color:"var(--ink-3)", marginTop:4}}>projected points</div>
              </div>
            </div>

            <div style={{marginTop:28}}>
              <Eyebrow>Position-by-position edge</Eyebrow>
              <div style={{marginTop:12}}>
                {!comparisons.length && (
                  <div style={{padding:"12px 0", color:"var(--ink-3)", fontSize:13}}>
                    Opponent starter slots are not published yet for this matchup.
                  </div>
                )}
                {comparisons.map((m,i) => {
                  const diff = m.mePts - m.oppPts;
                  const favoredMe = diff >= 0;
                  return (
                    <div key={i} style={{display:"grid", gridTemplateColumns:"60px 1fr 60px 1fr 60px", gap:12, padding:"12px 0", borderBottom:"1px solid var(--rule-2)", alignItems:"center"}}>
                      <div className="mono" style={{fontSize:11, color:"var(--ink-3)", letterSpacing:"0.08em"}}>{m.pos}</div>
                      <div style={{display:"flex", gap:10, alignItems:"center", justifyContent: favoredMe ? "flex-start" : "flex-end"}}>
                        <span style={{fontSize:13, fontWeight: favoredMe?600:400, color: favoredMe?"var(--ink)":"var(--ink-3)"}}>{m.me}</span>
                        <span className="mono" style={{fontSize:11, color:"var(--ink-3)"}}>{m.mePts.toFixed(1)}</span>
                      </div>
                      <div className="mono" style={{fontSize:12, textAlign:"center", color: Math.abs(diff) < 1 ? "var(--ink-3)" : (diff > 0 ? "var(--good)" : "var(--bad)"), fontWeight:600}}>
                        {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                      </div>
                      <div style={{display:"flex", gap:10, alignItems:"center", justifyContent: favoredMe ? "flex-end" : "flex-start", flexDirection: favoredMe ? "row" : "row-reverse"}}>
                        <span className="mono" style={{fontSize:11, color:"var(--ink-3)"}}>{m.oppPts.toFixed(1)}</span>
                        <span style={{fontSize:13, fontWeight: !favoredMe?600:400, color: !favoredMe?"var(--ink)":"var(--ink-3)"}}>{m.opp}</span>
                      </div>
                      <div style={{textAlign:"right"}}>
                        {Math.abs(diff) >= 2 && <Pill kind={favoredMe?"good":"bad"}>{favoredMe?"edge":"deficit"}</Pill>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <div className="card dark">
              <Eyebrow style={{color:"#ffffff80"}}>The Read</Eyebrow>
              <div style={{fontFamily:"var(--serif)", fontSize:28, marginTop:8, lineHeight:1.1}}>
                {readTitle}
              </div>
              <div style={{fontSize:13, marginTop:14, lineHeight:1.6, opacity:0.9}}>
                {readBody}
              </div>
            </div>

            <div style={{marginTop:24}}>
              <Eyebrow>Keys to the game</Eyebrow>
              <ol style={{listStyle:"none", marginTop:12}}>
                {keyItems.slice(0,4).map((x,i) => (
                  <li key={i} style={{display:"grid", gridTemplateColumns:"24px 1fr", gap:10, padding:"12px 0", borderBottom:"1px solid var(--rule-2)"}}>
                    <span className="mono" style={{fontSize:10, color:"var(--ink-3)", paddingTop:3}}>0{i+1}</span>
                    <div>
                      <div style={{fontSize:13, fontWeight:600}}>{x.k}</div>
                      <div style={{fontSize:12, color:"var(--ink-3)", marginTop:2}}>{x.v}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function RosterScreen() {
  const starters = ROSTER.filter(r => r.slot !== "BN");
  const bench = ROSTER.filter(r => r.slot === "BN");
  const flagged = ROSTER.filter(r => r.status !== "healthy").length;
  const healthPct = ROSTER.length ? Math.round(((ROSTER.length - flagged) / ROSTER.length) * 100) : 0;
  const flexSwap = (STARTSIT || []).find((item) => item.slot === "FLEX");
  return (
    <>
      <Masthead
        eyebrow={`Roster · ${LEAGUE.user?.team || "My Team"}`}
        title="The"
        titleEm="Team Sheet"
        right={<><span>{ROSTER.length} players · {healthPct}% healthy</span><span className="big">{Number(LEAGUE.myProjection || 0).toFixed(1)} proj</span></>}
      />
      <div className="content" style={{paddingTop:28}}>
        <Eyebrow>Starters · Week {LEAGUE.week}</Eyebrow>
        <table className="data" style={{marginTop:12}}>
          <thead><tr>
            <th style={{width:40}}>Slot</th><th>Player</th><th>Team</th><th></th>
            <th className="num">Proj</th><th className="num">Snap%</th><th className="num">Tgt%</th><th className="num">Trend</th>
          </tr></thead>
          <tbody>
            {starters.map((p,i) => (
              <tr key={i}>
                <td><span style={{color: POS_COLORS[p.pos], fontWeight:600}}>{p.slot}</span></td>
                <td style={{fontFamily:"var(--sans)", fontWeight:600}}>{p.n}</td>
                <td>{p.team}</td>
                <td>{p.status === "questionable" && <Pill kind="warn">Q · {p.note}</Pill>}</td>
                <td className="num">{p.proj.toFixed(1)}</td>
                <td className="num">{p.snap ? (p.snap*100).toFixed(0) + "%" : "—"}</td>
                <td className="num">{p.share ? (p.share*100).toFixed(0) + "%" : "—"}</td>
                <td className="num" style={{color: p.trend > 0 ? "var(--good)" : p.trend < 0 ? "var(--bad)" : "var(--ink-3)"}}>
                  {p.trend > 0 ? "+" : ""}{p.trend.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <Eyebrow style={{marginTop:32}}>Bench</Eyebrow>
        <table className="data" style={{marginTop:12}}>
          <thead><tr>
            <th style={{width:40}}>Pos</th><th>Player</th><th>Team</th>
            <th className="num">Proj</th><th className="num">Snap%</th><th className="num">Trend</th><th></th>
          </tr></thead>
          <tbody>
            {bench.map((p,i) => (
              <tr key={i}>
                <td><span style={{color: POS_COLORS[p.pos], fontWeight:600}}>{p.pos}</span></td>
                <td style={{fontFamily:"var(--sans)", fontWeight:600}}>{p.n}</td>
                <td>{p.team}</td>
                <td className="num">{p.proj.toFixed(1)}</td>
                <td className="num">{p.snap ? (p.snap*100).toFixed(0) + "%" : "—"}</td>
                <td className="num" style={{color: p.trend > 0 ? "var(--good)" : p.trend < 0 ? "var(--bad)" : "var(--ink-3)"}}>
                  {p.trend > 0 ? "+" : ""}{p.trend.toFixed(1)}
                </td>
                <td style={{textAlign:"right"}}>
                  {flexSwap?.recommendStart === p.n && <Pill kind="good">Promote to FLEX</Pill>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SettingsScreen() {
  const [state, setState] = useState({ loading: false, result: null, error: "" });

  const statusMeta = {
    ok: { dot: "good", label: "OK", color: "var(--good)" },
    warn: { dot: "warn", label: "WARN", color: "var(--warn)" },
    error: { dot: "bad", label: "ERROR", color: "var(--bad)" },
    disabled: { dot: "", label: "OFF", color: "var(--ink-3)" },
  };

  const overallMeta = {
    ok: { dot: "good", label: "Ready" },
    degraded: { dot: "warn", label: "Degraded" },
    error: { dot: "bad", label: "Blocked" },
  };

  const run = async () => {
    setState({ loading: true, result: null, error: "" });
    try {
      const response = await fetch("/api/diagnostics", { headers: { "Accept": "application/json" } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || `Health check failed (${response.status})`);
      }
      setState({ loading: false, result: body, error: "" });
    } catch (err) {
      setState({ loading: false, result: null, error: String(err.message || err) });
    }
  };

  const result = state.result;
  const overall = result ? overallMeta[result.overall] || overallMeta.error : null;

  return (
    <>
      <Masthead
        eyebrow="Settings · Diagnostics"
        title="The"
        titleEm="Control Room"
        right={<>
          <span>Health check</span>
          <span className="big">{result ? (overall?.label || "Unknown") : state.loading ? "Running…" : "Not run"}</span>
        </>}
      />
      <div className="content" style={{paddingTop:28}}>
        <div className="card">
          <Eyebrow>Connection Health</Eyebrow>
          <div style={{fontFamily:"var(--serif)", fontSize:28, lineHeight:1.1, marginTop:8}}>
            Run a live probe of every upstream the app depends on.
          </div>
          <div style={{fontSize:13, color:"var(--ink-2)", marginTop:10, maxWidth:620, lineHeight:1.55}}>
            Checks Sleeper (required for league data), ESPN (optional team-strength signal), and OpenAI (optional AI overlay).
            Each probe uses a short timeout so this is safe to run at any time.
          </div>
          <div style={{display:"flex", gap:10, marginTop:18, alignItems:"center"}}>
            <button className="btn primary" onClick={run} disabled={state.loading}>
              {state.loading ? "Checking…" : "Run health check"}
            </button>
            {result && (
              <span style={{display:"flex", alignItems:"center", gap:8, fontSize:13}}>
                <Dot kind={overall?.dot} /> {result.headline}
              </span>
            )}
          </div>
          {state.error && (
            <div style={{marginTop:14, padding:"12px 14px", borderLeft:"2px solid var(--bad)", background:"var(--paper-2)", color:"var(--bad)", fontSize:13}}>
              {state.error}
            </div>
          )}
        </div>

        {result && (
          <div style={{marginTop:24}}>
            <Eyebrow>Probe Results</Eyebrow>
            <table className="data" style={{marginTop:12}}>
              <thead><tr>
                <th style={{width:32}}></th>
                <th>Service</th>
                <th>Status</th>
                <th>Message</th>
                <th className="num">Latency</th>
                <th>Detail</th>
              </tr></thead>
              <tbody>
                {result.checks.map((c, i) => {
                  const meta = statusMeta[c.status] || statusMeta.error;
                  return (
                    <tr key={i}>
                      <td><Dot kind={meta.dot} /></td>
                      <td style={{fontFamily:"var(--sans)", fontWeight:600}}>{c.name}</td>
                      <td><span className="mono" style={{fontSize:11, fontWeight:600, color:meta.color, letterSpacing:"0.08em"}}>{meta.label}</span></td>
                      <td style={{fontSize:13}}>{c.message}</td>
                      <td className="num">{c.latencyMs != null ? `${c.latencyMs} ms` : "—"}</td>
                      <td style={{fontSize:12, color:"var(--ink-3)"}}>{c.detail || ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{marginTop:32}}>
          <Eyebrow>Environment</Eyebrow>
          <div style={{marginTop:12, border:"1px solid var(--rule)"}}>
            {[
              { k: "Username (client)", v: window.getSleeperUsername?.() || "(not set — pass ?username= or set SLEEPER_USERNAME)" },
              { k: "Data source", v: window.DATA_STATE?.source || "none" },
              { k: "Last fetched", v: window.DATA_STATE?.fetchedAt || "—" },
              { k: "AI overlay", v: LLM_RECOMMENDATIONS?.enabled ? `enabled (${LLM_RECOMMENDATIONS?.model || "model unknown"})` : "disabled" },
            ].map((row, i) => (
              <div key={i} style={{display:"grid", gridTemplateColumns:"220px 1fr", gap:16, padding:"12px 16px", borderBottom: i < 3 ? "1px solid var(--rule-2)" : "none"}}>
                <div className="mono" style={{fontSize:10, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--ink-3)"}}>{row.k}</div>
                <div style={{fontSize:13}}>{row.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { MatchupScreen, RosterScreen, SettingsScreen });
