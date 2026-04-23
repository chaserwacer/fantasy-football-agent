// Start/Sit screen with action card + checklist
function StartSitScreen() {
  const [selected, setSelected] = useState(0);
  const [checked, setChecked] = useState({});
  const [copied, setCopied] = useState(false);
  const rec = STARTSIT[selected] || null;
  const aiLineup = LLM_RECOMMENDATIONS?.lineup || [];
  const aiRecForSlot = aiLineup.find((item) => item.slot === rec?.slot) || aiLineup[0] || null;

  if (!rec) {
    return (
      <>
        <Masthead
          eyebrow="Start / Sit · Weekly Decision Brief"
          title="The"
          titleEm="Lineup Desk"
          right={<><span>0 decisions</span><span className="big">No edge yet</span></>}
        />
        <div className="content" style={{paddingTop:28}}>
          <div className="card">
            <Eyebrow>Awaiting stronger signal</Eyebrow>
            <div style={{fontFamily:"var(--serif)", fontSize:34, lineHeight:1.05, marginTop:10}}>No high-confidence start/sit edge is available right now.</div>
            <div style={{marginTop:12, fontSize:14, color:"var(--ink-2)", maxWidth:560}}>
              This usually means your projected starters are already optimal or player projection deltas are still inside the noise band.
              Check back closer to kickoff when practice and injury updates settle.
            </div>
          </div>
        </div>
      </>
    );
  }

  const actionText = `Set ${rec.recommendStart} as ${rec.slot} starter. Bench ${rec.recommendSit}. Projected edge +${rec.edge.replace("+","")} pts @ ${rec.confidence}% confidence.`;
  const copy = () => { navigator.clipboard?.writeText(actionText); setCopied(true); setTimeout(()=>setCopied(false), 1500); };

  const steps = [
    { n: "01", t: "Open Sleeper → League → My Team", h: "Navigate to your roster view." },
    { n: "02", t: `Tap ${rec.recommendSit}'s card, choose "Move to Bench"`, h: `Current ${rec.slot} slot will empty.` },
    { n: "03", t: `Tap ${rec.recommendStart}'s card (currently on BN), choose "Move to ${rec.slot}"`, h: "Confirm the slot change." },
    { n: "04", t: "Verify lineup locked before kickoff", h: "Sleeper shows a green checkmark when saved." },
  ];

  return (
    <>
      <Masthead
        eyebrow={`Start / Sit · Week ${LEAGUE.week} · Decision Brief`}
        title="The"
        titleEm="Lineup Desk"
        right={<><span>{STARTSIT.length} decisions</span><span className="big">{STARTSIT.length - Object.keys(checked).filter(k=>checked[k]).length} open</span></>}
      />

      {/* Decision tabs */}
      <div className="content" style={{paddingTop:28}}>
        <div style={{display:"flex", gap:0, borderBottom:"1px solid var(--rule)", marginBottom:28}}>
          {STARTSIT.map((s,i) => (
            <button key={i} onClick={()=>setSelected(i)}
              style={{
                padding:"14px 20px",
                borderBottom: selected===i ? "2px solid var(--ink)" : "2px solid transparent",
                marginBottom:-1,
                fontFamily:"var(--serif)", fontSize:20, letterSpacing:"-0.01em",
                color: selected===i ? "var(--ink)" : "var(--ink-3)",
                whiteSpace: "nowrap",
              }}>
              {s.slot} — {s.recommendStart.split(" ").slice(-1)[0]} <span style={{color:"var(--ink-4)"}}>over</span> {s.recommendSit.split(" ").slice(-1)[0]}
            </button>
          ))}
        </div>

        {/* Head-to-head comparison */}
        <div className="grid-dash" style={{alignItems:"start"}}>
          <div>
            <Eyebrow>The Read</Eyebrow>
            <div style={{fontFamily:"var(--serif)", fontSize:44, lineHeight:1.02, letterSpacing:"-0.02em", marginTop:8}}>
              Start <span style={{color:"var(--accent)", fontStyle:"italic"}}>{rec.recommendStart}</span>.<br/>
              Bench {rec.recommendSit}.
            </div>
            <div style={{display:"flex", gap:18, marginTop:20, alignItems:"center"}}>
              <Confidence value={rec.confidence} />
              <div>
                <div className="eyebrow">Projected Edge</div>
                <div className="mono" style={{fontSize:22, fontWeight:600, marginTop:2}}>{rec.edge} pts</div>
              </div>
              <div>
                <div className="eyebrow">Boom / Bust</div>
                <div className="mono" style={{fontSize:14, fontWeight:600, marginTop:2}}>
                  <span style={{color:"var(--good)"}}>{rec.boom}%</span> / <span style={{color:"var(--bad)"}}>{rec.bust}%</span>
                </div>
              </div>
            </div>

            <div style={{marginTop:32}}>
              <Eyebrow>Rationale</Eyebrow>
              <ol style={{listStyle:"none", counterReset:"r", marginTop:10}}>
                {rec.rationale.map((r,i) => (
                  <li key={i} style={{display:"grid", gridTemplateColumns:"32px 1fr", gap:12, padding:"12px 0", borderBottom:"1px solid var(--rule-2)"}}>
                    <span className="mono" style={{fontSize:10, color:"var(--ink-3)", paddingTop:3}}>0{i+1}</span>
                    <span style={{fontSize:14, lineHeight:1.55}}>{r}</span>
                  </li>
                ))}
              </ol>
            </div>

            {rec.caution && (
              <div style={{marginTop:20, padding:"14px 16px", borderLeft:"2px solid var(--warn)", background:"var(--paper-2)"}}>
                <div className="eyebrow" style={{color:"var(--warn)"}}>Caution</div>
                <div style={{fontSize:13, marginTop:4}}>{rec.caution}</div>
              </div>
            )}

            {aiRecForSlot && (
              <div style={{marginTop:20, padding:"14px 16px", borderLeft:"2px solid var(--accent)", background:"var(--paper-2)"}}>
                <div className="eyebrow" style={{color:"var(--accent)"}}>
                  AI Second Opinion {LLM_RECOMMENDATIONS?.model ? `(${LLM_RECOMMENDATIONS.model})` : ""}
                </div>
                <div style={{fontSize:13, marginTop:4, lineHeight:1.55}}>
                  {aiRecForSlot.recommendStart} over {aiRecForSlot.recommendSit} at {aiRecForSlot.slot} ({aiRecForSlot.confidence}% confidence).
                </div>
                {(aiRecForSlot.rationale || []).slice(0, 2).map((line, idx) => (
                  <div key={idx} style={{fontSize:12, marginTop:6, color:"var(--ink-2)"}}>{line}</div>
                ))}
                {aiRecForSlot.risk && (
                  <div style={{fontSize:12, marginTop:8, color:"var(--warn)"}}>Risk note: {aiRecForSlot.risk}</div>
                )}
              </div>
            )}

            <div style={{marginTop:36}}>
              <Eyebrow>Side by side</Eyebrow>
              <table className="data" style={{marginTop:12}}>
                <thead><tr>
                  <th></th><th>Player</th><th className="num">Proj</th><th className="num">Snap%</th><th className="num">Tgt%</th><th className="num">Def Rank</th><th className="num">Implied Tm</th>
                </tr></thead>
                <tbody>
                  <tr>
                    <td style={{width:20}}><Pill solid>Start</Pill></td>
                    <td style={{fontFamily:"var(--sans)", fontWeight:600}}>{rec.recommendStart}</td>
                    <td className="num">{Number(rec.startMetrics?.proj || 0).toFixed(1)}</td>
                    <td className="num">{Math.round(Number(rec.startMetrics?.snap || 0) * 100)}%</td>
                    <td className="num">{Math.round(Number(rec.startMetrics?.share || 0) * 100)}%</td>
                    <td className="num"><span style={{color:"var(--good)"}}>Strong</span></td>
                    <td className="num">Live</td>
                  </tr>
                  <tr>
                    <td><Pill>Sit</Pill></td>
                    <td style={{fontFamily:"var(--sans)"}}>{rec.recommendSit}</td>
                    <td className="num">{Number(rec.sitMetrics?.proj || 0).toFixed(1)}</td>
                    <td className="num">{Math.round(Number(rec.sitMetrics?.snap || 0) * 100)}%</td>
                    <td className="num">{Math.round(Number(rec.sitMetrics?.share || 0) * 100)}%</td>
                    <td className="num"><span style={{color:"var(--bad)"}}>Lower</span></td>
                    <td className="num">Live</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Action card + checklist */}
          <div style={{position:"sticky", top:20}}>
            <div className="action-card">
              <div className="eyebrow">Action · Execute in Sleeper</div>
              <h3>Set {rec.slot} → {rec.recommendStart.split(" ").slice(-1)[0]}</h3>
              <div style={{fontSize:13, opacity:0.85, lineHeight:1.55}}>
                Commissioner is read-only with Sleeper. Copy this action or follow the checklist below to apply in the app.
              </div>
              <div className="copy-box">{actionText}</div>
              <div className="foot">
                <button className="btn accent" onClick={copy}>{copied ? "✓ Copied" : "Copy action"}</button>
                <a className="btn ghost" href="https://sleeper.com" target="_blank" rel="noreferrer">Open Sleeper ↗</a>
              </div>
            </div>

            <div style={{marginTop:24}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6}}>
                <Eyebrow>Step-by-step</Eyebrow>
                <span className="mono" style={{fontSize:11, color:"var(--ink-3)"}}>{Object.keys(checked).filter(k=>checked[k]).length} / {steps.length}</span>
              </div>
              <ul className="checklist">
                {steps.map((s,i) => (
                  <li key={i} className={checked[i]?"done":""} onClick={()=>setChecked(c => ({...c, [i]:!c[i]}))}>
                    <span className="box">{checked[i] && <span style={{fontSize:11}}>✓</span>}</span>
                    <div>
                      <span className="n">STEP {s.n}</span>
                      <div className="step">{s.t}</div>
                      {s.h && <span className="hint">{s.h}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

window.StartSitScreen = StartSitScreen;
