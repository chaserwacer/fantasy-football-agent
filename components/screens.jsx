// Draft Room assistant + Matchup preview + Roster
function DraftScreen() {
  const [selected, setSelected] = useState(0);
  const [queue, setQueue] = useState(DRAFT_QUEUE.map(p => p.n));
  const pick = DRAFT_QUEUE[selected] || DRAFT_QUEUE[0] || null;
  const [timer, setTimer] = useState(58);
  useEffect(() => {
    const t = setInterval(() => setTimer(s => s > 0 ? s - 1 : 60), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    setQueue(DRAFT_QUEUE.map(p => p.n));
    setSelected(0);
  }, [DRAFT_QUEUE.length]);

  if (!pick) {
    return (
      <>
        <Masthead
          eyebrow="Priority Queue"
          title="No Live"
          titleEm="Draft Signal"
          right={<><span>{LEAGUE.name}</span><span className="big">Queue unavailable</span></>}
        />
        <div className="content" style={{paddingTop:28}}>
          <div className="card">
            <Eyebrow>Fallback mode</Eyebrow>
            <div style={{fontFamily:"var(--serif)", fontSize:32, lineHeight:1.05, marginTop:8}}>No active priority queue is available yet.</div>
            <div style={{fontSize:14, marginTop:10, maxWidth:560, color:"var(--ink-2)"}}>
              This panel fills when Sleeper trending adds and projection context are available. Return after the next refresh.
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Masthead
        eyebrow={`Priority Queue · Week ${LEAGUE.week}`}
        title="On the"
        titleEm="Clock"
        right={<>
          <span>Priority 1 · {LEAGUE.user?.team || "Your Team"}</span>
          <span className="big" style={{color:"var(--accent)"}}>0:{String(timer).padStart(2,"0")}</span>
        </>}
      />

      <div className="content" style={{paddingTop:28}}>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1.4fr", gap:32}}>
          {/* Left: queue + board */}
          <div>
            <Eyebrow>Your Queue · Round 1</Eyebrow>
            <div style={{marginTop:12, border:"1px solid var(--rule)"}}>
              {(DRAFT_QUEUE || []).map((p,i) => (
                <div key={p.n}
                  onClick={() => setSelected(i)}
                  style={{
                    display:"grid", gridTemplateColumns:"28px 36px 1fr auto auto", gap:12, alignItems:"center",
                    padding:"14px 16px",
                    borderBottom: i < DRAFT_QUEUE.length-1 ? "1px solid var(--rule-2)" : "none",
                    background: selected===i ? "var(--paper-2)" : "transparent",
                    borderLeft: selected===i ? "2px solid var(--accent)" : "2px solid transparent",
                    cursor:"pointer",
                  }}>
                  <span className="mono" style={{fontSize:10, color:"var(--ink-3)"}}>#{p.rank}</span>
                  <PlayerAvatar name={p.n} />
                  <div>
                    <div style={{fontWeight:600, fontSize:13}}>{p.n}</div>
                    <div className="mono" style={{fontSize:11, color:"var(--ink-3)"}}>
                      <span style={{color: POS_COLORS[p.pos], fontWeight:600}}>{p.pos}</span> · {p.team} · ADP {p.adp}
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div className="mono" style={{fontSize:10, color:"var(--ink-3)"}}>TIER</div>
                    <div className="mono" style={{fontSize:13, fontWeight:600}}>{p.tier}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div className="mono" style={{fontSize:10, color:"var(--ink-3)"}}>FIT</div>
                    <Pill kind={p.fit==="High"?"good":""}>{p.fit}</Pill>
                  </div>
                </div>
              ))}
            </div>

            <div style={{marginTop:28}}>
              <Eyebrow>Board · Recent Picks</Eyebrow>
              <div style={{marginTop:12, border:"1px solid var(--rule)"}}>
                {(DRAFT_BOARD || []).map((p,i) => (
                  <div key={p.pk} className={`draft-pick ${p.ours?"ours":""} ${p.status==="onclock"?"best":""}`}>
                    <div>
                      <div className="pk">{p.pk}</div>
                      <div className="mono" style={{fontSize:10, opacity:0.7}}>{p.team}</div>
                    </div>
                    <div>
                      {p.status === "onclock" ? (
                        <div style={{display:"flex", alignItems:"center", gap:10}}>
                          <Dot kind="bad" pulse />
                          <span style={{fontFamily:"var(--serif)", fontSize:18, fontStyle:"italic"}}>On the clock…</span>
                        </div>
                      ) : p.player === "—" ? (
                        <span className="mono" style={{color:"var(--ink-4)", fontSize:12}}>— upcoming</span>
                      ) : (
                        <div style={{display:"flex", gap:10, alignItems:"center"}}>
                          <span style={{fontWeight:600}}>{p.player}</span>
                          <span className="mono" style={{fontSize:11, color: p.status==="past"? "var(--ink-3)":"var(--ink-2)"}}>{p.pos}</span>
                        </div>
                      )}
                    </div>
                    <div className="mono" style={{fontSize:10, opacity:0.6}}>{p.status === "past" ? "✓" : ""}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: recommended pick card */}
          <div style={{position:"sticky", top:20, alignSelf:"start"}}>
            <div className="action-card">
              <div className="eyebrow">Commissioner's Pick · 1.03</div>
              <h3>Draft <span style={{fontStyle:"italic", color:"var(--accent)"}}>{pick.n}</span></h3>
              <div style={{display:"flex", gap:12, marginTop:6}}>
                <Pill solid style={{background:"#ffffff15", color:"var(--paper)", borderColor:"#ffffff30"}}>{pick.pos} · {pick.team}</Pill>
                <Pill solid style={{background:"#ffffff15", color:"var(--paper)", borderColor:"#ffffff30"}}>Tier {pick.tier}</Pill>
                <Pill solid style={{background:"#ffffff15", color:"var(--paper)", borderColor:"#ffffff30"}}>ADP {pick.adp}</Pill>
              </div>
              <div style={{fontSize:13, marginTop:14, lineHeight:1.55, opacity:0.9}}>
                {pick.note} This queue is generated from live trending adds and roster-construction fit.
              </div>
              <div className="copy-box">SELECT: {pick.n} ({pick.pos}, {pick.team}) at pick 1.03</div>
              <div className="foot">
                <button className="btn accent">Copy action</button>
                <a className="btn ghost" href="https://sleeper.com" target="_blank" rel="noreferrer">Open Sleeper ↗</a>
              </div>
            </div>

            <div style={{marginTop:24}}>
              <Eyebrow>Why this pick</Eyebrow>
              <div style={{marginTop:12}}>
                {[
                  { k: "Positional scarcity", v: "RB run from 1.04–1.09 expected; WR hoarding ends pick 1.07." },
                  { k: "Age curve (dynasty)", v: "23.2y old · 6-year startup window at current production curve." },
                  { k: "Target share trend", v: "31% → 34% → 37% past 3 weeks; no competing alpha in NYG." },
                  { k: "Schedule", v: "Soft CB matchups Wks 2, 5, 9, 13 — playoff lean." },
                ].map((x,i) => (
                  <div key={i} style={{display:"grid", gridTemplateColumns:"160px 1fr", gap:16, padding:"12px 0", borderBottom:"1px solid var(--rule-2)"}}>
                    <div className="mono" style={{fontSize:10, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--ink-3)"}}>{x.k}</div>
                    <div style={{fontSize:13, lineHeight:1.5}}>{x.v}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{marginTop:24}}>
              <Eyebrow>If someone else takes him</Eyebrow>
              <div style={{display:"flex", gap:10, marginTop:10, flexWrap:"wrap"}}>
                {DRAFT_QUEUE.slice(1,4).map(p => (
                  <div key={p.n} style={{border:"1px solid var(--rule)", padding:"10px 14px", flex:"1 1 160px"}}>
                    <div className="mono" style={{fontSize:10, color:"var(--ink-3)"}}>PIVOT · {p.pos}</div>
                    <div style={{fontSize:14, fontWeight:600, marginTop:2}}>{p.n}</div>
                    <div className="mono" style={{fontSize:11, color:"var(--ink-3)", marginTop:2}}>ADP {p.adp} · Tier {p.tier}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function MatchupScreen() {
  const myTotal = Number(LEAGUE.myProjection || ROSTER.filter(r => r.slot !== "BN").reduce((s,r) => s+r.proj, 0));
  const oppTotal = Number(LEAGUE.oppProjection || OPP_ROSTER.reduce((s,r) => s+r.proj, 0));
  const spread = myTotal - oppTotal;
  const starters = ROSTER.filter(r => r.slot !== "BN").slice(0, 7);
  const comparisons = starters.map((mine, idx) => {
    const opp = OPP_ROSTER[idx] || { n: "Open Slot", pos: mine.pos, proj: 0 };
    return {
      pos: mine.slot || mine.pos,
      me: mine.n,
      mePts: Number(mine.proj || 0),
      opp: opp.n,
      oppPts: Number(opp.proj || 0),
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
  if (DRAFT_QUEUE?.[0]) keyItems.push({ k: "Top waiver-style add", v: `${DRAFT_QUEUE[0].n} (${DRAFT_QUEUE[0].pos})` });
  keyItems.push({ k: "Final check", v: "Re-run decisions 60 minutes before kickoff." });

  return (
    <>
      <Masthead
        eyebrow={`Matchup Preview · Week ${LEAGUE.week}`}
        title={LEAGUE.user?.team || "Your Team"}
        titleEm={`vs ${LEAGUE.nextOpponent?.team || "Opponent"}`}
        right={<><span>Sunday · 1:00 PM ET</span><span className="big">Win prob {LEAGUE.nextOpponent?.winProb || 50}%</span></>}
      />
      <div className="content" style={{paddingTop:28}}>
        <div className="grid-dash">
          <div>
            <Eyebrow>Projection Spread</Eyebrow>
            <div style={{display:"grid", gridTemplateColumns:"1fr 80px 1fr", alignItems:"center", gap:20, marginTop:14, padding:"20px 0", borderTop:"1px solid var(--ink)", borderBottom:"1px solid var(--ink)"}}>
              <div>
                <div className="mono" style={{fontSize:10, letterSpacing:"0.1em", color:"var(--ink-3)"}}>{LEAGUE.user?.team || "Your Team"} · {LEAGUE.user?.record || "0-0"}</div>
                <div style={{fontFamily:"var(--serif)", fontSize:72, lineHeight:1, letterSpacing:"-0.02em"}}>{myTotal.toFixed(1)}</div>
                <div className="mono" style={{fontSize:11, color:"var(--ink-3)", marginTop:4}}>projected points</div>
              </div>
              <div style={{textAlign:"center", fontFamily:"var(--serif)", fontStyle:"italic", fontSize:28, color:"var(--ink-3)"}}>vs</div>
              <div style={{textAlign:"right"}}>
                <div className="mono" style={{fontSize:10, letterSpacing:"0.1em", color:"var(--ink-3)"}}>{LEAGUE.nextOpponent?.team || "Opponent"} · {LEAGUE.nextOpponent?.record || "0-0"}</div>
                <div style={{fontFamily:"var(--serif)", fontSize:72, lineHeight:1, letterSpacing:"-0.02em"}}>{oppTotal.toFixed(1)}</div>
                <div className="mono" style={{fontSize:11, color:"var(--ink-3)", marginTop:4}}>projected points</div>
              </div>
            </div>

            <div style={{marginTop:28}}>
              <Eyebrow>Position-by-position edge</Eyebrow>
              <div style={{marginTop:12}}>
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
  const healthPct = Math.max(0, 100 - flagged * 8);
  return (
    <>
      <Masthead
        eyebrow={`Roster · ${LEAGUE.user?.team || "My Team"}`}
        title="The"
        titleEm="Team Sheet"
        right={<><span>{ROSTER.length} players · {healthPct}% healthy</span><span className="big">{Number(LEAGUE.myProjection || 0).toFixed(1)} proj</span></>}
      />
      <div className="content" style={{paddingTop:28}}>
        <Eyebrow>Starters · Week 6</Eyebrow>
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
                  {p.n === "Ladd McConkey" && <Pill kind="good">Promote to FLEX</Pill>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

Object.assign(window, { DraftScreen, MatchupScreen, RosterScreen });
