// Dashboard — Home screen
function DashboardScreen({ onOpenChat, setRoute }) {
  const topCall = STARTSIT[0];
  const aiTopCall = (LLM_RECOMMENDATIONS?.lineup || [])[0] || null;
  const aiTopWaiver = (LLM_RECOMMENDATIONS?.waivers || [])[0] || null;
  const aiSummary = String(LLM_RECOMMENDATIONS?.summary || "").trim();
  const leadAction = topCall
    ? `Start ${topCall.recommendStart} at ${topCall.slot}. Sit ${topCall.recommendSit}.`
    : "No clear lineup edge yet.";
  const leadBody = topCall
    ? (topCall.rationale || []).join(" ")
    : "Commissioner is waiting on additional game-state inputs before issuing a high-confidence lineup call.";
  const pendingCount = (STARTSIT?.length || 0) + (DRAFT_QUEUE?.length ? 1 : 0);

  return (
    <>
      <Masthead
        eyebrow={`Volume VI · No. ${LEAGUE.week} · Sunday edition`}
        title="The"
        titleEm="Dispatch"
        right={<>
          <span>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})}</span>
          <span className="big">{pendingCount} decisions pending</span>
        </>}
      />

      {/* Top recommendation */}
      <div className="content" style={{paddingTop:28}}>
        <div className="rec">
          <div>
            <Eyebrow style={{marginBottom:10}}>Lead Recommendation · Week {LEAGUE.week}</Eyebrow>
            <div className="lead">
              {topCall ? (
                <>Start <em>{topCall.recommendStart.split(" ").slice(-1)[0]}</em> at {topCall.slot}.<br/>Sit {topCall.recommendSit}.</>
              ) : (
                <>No locked <em>lineup edge</em> yet.<br/>Check back before inactives.</>
              )}
            </div>
            <div className="sub">{leadBody}</div>
            <div style={{display:"flex", gap:10, marginTop:18}}>
              <button className="btn primary" onClick={() => setRoute("startsit")}>Review the call →</button>
              <button className="btn ghost" onClick={onOpenChat}>Ask Commissioner</button>
            </div>
          </div>
          <div className="aside">
            <Confidence value={topCall?.confidence || 50} />
            <div style={{textAlign:"right"}}>
              <div className="mono" style={{fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--ink-3)"}}>Projected Edge</div>
              <div style={{fontFamily:"var(--serif)", fontSize:42, lineHeight:1, letterSpacing:"-0.02em"}}>{topCall?.edge || "+0.0"}</div>
              <div className="mono" style={{fontSize:11, color:"var(--ink-3)"}}>pts over sit</div>
            </div>
          </div>
        </div>

        {(LLM_RECOMMENDATIONS?.enabled || aiSummary) && (
          <div className="card" style={{marginTop:18}}>
            <Eyebrow>AI Second Opinion {LLM_RECOMMENDATIONS?.model ? `(${LLM_RECOMMENDATIONS.model})` : ""}</Eyebrow>
            {aiSummary && (
              <div style={{fontSize:14, marginTop:8, color:"var(--ink-2)", lineHeight:1.55}}>{aiSummary}</div>
            )}
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginTop:14}}>
              <div style={{padding:"12px", border:"1px solid var(--rule-2)", background:"var(--paper-2)"}}>
                <div className="mono" style={{fontSize:10, letterSpacing:"0.08em", color:"var(--ink-3)"}}>AI LINEUP</div>
                <div style={{fontSize:13, marginTop:6}}>
                  {aiTopCall
                    ? `${aiTopCall.recommendStart} over ${aiTopCall.recommendSit} at ${aiTopCall.slot} (${aiTopCall.confidence}% confidence)`
                    : "No additional lineup swap from the model this cycle."}
                </div>
              </div>
              <div style={{padding:"12px", border:"1px solid var(--rule-2)", background:"var(--paper-2)"}}>
                <div className="mono" style={{fontSize:10, letterSpacing:"0.08em", color:"var(--ink-3)"}}>AI WAIVER</div>
                <div style={{fontSize:13, marginTop:6}}>
                  {aiTopWaiver
                    ? `${aiTopWaiver.player} (${aiTopWaiver.pos}, ${aiTopWaiver.team}) - priority ${aiTopWaiver.priority}`
                    : "No additive waiver target identified by the model."}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Three-up: Team pulse / Matchup / News */}
      <SectionHead eyebrow="Briefing" title="The week in three reads" meta={`Updated ${new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}`} />
      <div className="content">
        <div className="grid-3">
          {/* Team pulse */}
          <div className="card">
            <Eyebrow>Team Pulse</Eyebrow>
            <div style={{fontFamily:"var(--serif)", fontSize:24, marginTop:6, letterSpacing:"-0.01em"}}>{LEAGUE.user?.team || "Your team"}, <em>weekly pulse</em>.</div>
            <StatBlock
              label="Projected this week"
              value={Number(LEAGUE.myProjection || 0).toFixed(1)}
              delta={`${(LEAGUE.nextOpponent?.projSpread || 0) >= 0 ? "+" : ""}${Number(LEAGUE.nextOpponent?.projSpread || 0).toFixed(1)} vs opponent`}
              deltaKind={(LEAGUE.nextOpponent?.projSpread || 0) >= 0 ? "up" : "down"}
            />
            <StatBlock label="Record" value={LEAGUE.user?.record || "0-0"} delta={`${LEAGUE.user?.rank || "-"}th of ${LEAGUE.teams || "-"}`} deltaKind="" />
            <StatBlock
              label="Roster health"
              value={String(Math.max(0, 100 - (ROSTER.filter(p => p.status !== "healthy").length * 8)))}
              suffix="%"
              delta={`${ROSTER.filter(p => p.status !== "healthy").length} flagged player(s)`}
              deltaKind=""
            />
          </div>

          {/* Matchup */}
          <div className="card dark">
            <Eyebrow style={{color:"#ffffff80"}}>Next Opponent · Week {LEAGUE.week}</Eyebrow>
            <div style={{fontFamily:"var(--serif)", fontSize:24, marginTop:6, letterSpacing:"-0.01em"}}>vs {LEAGUE.nextOpponent?.team || "TBD"}</div>
            <div className="mono" style={{fontSize:11, opacity:0.7, marginTop:4}}>{LEAGUE.nextOpponent?.record || "0-0"} · #{LEAGUE.nextOpponent?.rank || "-"} seed · @{LEAGUE.nextOpponent?.owner || "unknown"}</div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginTop:24}}>
              <div>
                <div className="mono" style={{fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", opacity:0.6}}>Win Prob</div>
                <div style={{fontFamily:"var(--serif)", fontSize:40, lineHeight:1, marginTop:4}}>{LEAGUE.nextOpponent?.winProb || 50}<span style={{fontSize:16, opacity:0.6}}>%</span></div>
              </div>
              <div>
                <div className="mono" style={{fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", opacity:0.6}}>Spread</div>
                <div style={{fontFamily:"var(--serif)", fontSize:40, lineHeight:1, marginTop:4}}>{Number(LEAGUE.nextOpponent?.projSpread || 0).toFixed(1)}</div>
              </div>
            </div>
            <div style={{marginTop:20, fontSize:13, lineHeight:1.55, opacity:0.85}}>
              Use this read as a weekly risk profile, not a lock. The biggest swing remains your FLEX slot and late injury updates.
            </div>
          </div>

          {/* News */}
          <div className="card">
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline"}}>
              <Eyebrow>Wire</Eyebrow>
              <span className="mono" style={{fontSize:10, color:"var(--ink-3)"}}>LIVE</span>
            </div>
            <div style={{marginTop:10}}>
              {NEWS.slice(0,4).map((n,i) => (
                <div key={i} style={{padding:"12px 0", borderBottom: i<3 ? "1px solid var(--rule-2)" : "none"}}>
                  <div style={{display:"flex", gap:8, alignItems:"baseline"}}>
                    <span className="mono" style={{fontSize:10, color: n.impact==="your-team" ? "var(--accent)" : "var(--ink-3)", fontWeight:600, letterSpacing:"0.08em"}}>{n.tag}</span>
                    <span className="mono" style={{fontSize:10, color:"var(--ink-4)"}}>{n.time} ago</span>
                  </div>
                  <div style={{fontSize:13, marginTop:4}}>
                    {n.player && <span style={{fontWeight:600}}>{n.player} </span>}
                    <span style={{color:"var(--ink-2)"}}>{n.body}</span>
                  </div>
                </div>
              ))}
              {!NEWS.length && (
                <div style={{padding:"12px 0", color:"var(--ink-3)", fontSize:13}}>
                  No fresh news signals available yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Decisions queue */}
      <SectionHead eyebrow="Decisions" title="Pending this week" meta="3 items" />
      <div className="content">
        <table className="data">
          <thead>
            <tr>
              <th style={{width:32}}></th>
              <th>Decision</th>
              <th>Subject</th>
              <th className="num">Edge</th>
              <th className="num">Confidence</th>
              <th className="num">Deadline</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(STARTSIT || []).map((rec, idx) => (
              <tr key={idx} onClick={()=>setRoute("startsit")} style={{cursor:"pointer"}}>
                <td><Dot kind={idx === 0 ? "bad" : "warn"} /></td>
                <td style={{fontFamily:"var(--serif)", fontSize:16, letterSpacing:"-0.01em"}}>Start / Sit — {rec.slot}</td>
                <td>{rec.recommendStart} over {rec.recommendSit}</td>
                <td className="num">{rec.edge}</td>
                <td className="num">{rec.confidence}%</td>
                <td className="num">Before kickoff</td>
                <td style={{textAlign:"right"}}><button className="btn ghost sm">Review →</button></td>
              </tr>
            ))}
            {DRAFT_QUEUE?.[0] && (
              <tr style={{cursor:"pointer"}}>
                <td><Dot kind="good" /></td>
                <td style={{fontFamily:"var(--serif)", fontSize:16, letterSpacing:"-0.01em"}}>Waiver Claim</td>
                <td>FA: {DRAFT_QUEUE[0].n} ({DRAFT_QUEUE[0].pos}, {DRAFT_QUEUE[0].team})</td>
                <td className="num">{DRAFT_QUEUE[0].fit}</td>
                <td className="num">{DRAFT_QUEUE[0].tier}</td>
                <td className="num">Waiver run</td>
                <td style={{textAlign:"right"}}><button className="btn ghost sm">Review queue →</button></td>
              </tr>
            )}
            {!STARTSIT?.length && (
              <tr>
                <td><Dot kind="warn" /></td>
                <td style={{fontFamily:"var(--serif)", fontSize:16, letterSpacing:"-0.01em"}}>No immediate edge</td>
                <td>Commissioner is waiting for stronger projection deltas.</td>
                <td className="num">+0.0</td>
                <td className="num">50%</td>
                <td className="num">Live</td>
                <td style={{textAlign:"right"}}><button className="btn ghost sm" onClick={onOpenChat}>Ask →</button></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

window.DashboardScreen = DashboardScreen;
