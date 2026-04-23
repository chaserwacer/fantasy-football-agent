// Sidebar + masthead + chat panel + tweaks
const { useState: _u1 } = React;

function Sidebar({ route, setRoute, onOpenChat, badges }) {
  const items = [
    { id: "dashboard", label: "Dashboard", kbd: "1" },
    { id: "startsit", label: "Start / Sit", kbd: "2", count: 2 },
    { id: "matchup", label: "Matchup", kbd: "3" },
    { id: "draft", label: "Draft Room", kbd: "4", count: "LIVE" },
    { id: "roster", label: "Roster", kbd: "5" },
    { id: "settings", label: "Settings", kbd: "6" },
  ];
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">C</span>
        <span className="brand-word">ommissioner</span>
      </div>
      <div className="eyebrow" style={{marginBottom:12}}>Week {LEAGUE.week} · {LEAGUE.season}</div>
      <nav className="nav">
        {items.map(it => (
          <button key={it.id} onClick={() => setRoute(it.id)}
            className={`nav-item ${route===it.id?"active":""}`}>
            <span>{it.label}</span>
            <span className="count">
              {it.count === "LIVE" ? <span style={{display:"inline-flex",alignItems:"center",gap:4}}><Dot kind="bad" pulse/> LIVE</span> : it.count ? it.count : <kbd style={{border:"none",background:"none",padding:0,opacity:0.5}}>{it.kbd}</kbd>}
            </span>
          </button>
        ))}
      </nav>

      <div style={{marginTop:24}}>
        <div className="eyebrow" style={{marginBottom:10}}>League</div>
        <div style={{fontFamily:"var(--serif)", fontSize:20, lineHeight:1.1, letterSpacing:"-0.01em"}}>{LEAGUE.name}</div>
        <div className="mono" style={{fontSize:11, color:"var(--ink-3)", marginTop:4}}>{LEAGUE.format} · {LEAGUE.teams}T</div>
      </div>

      <div className="sidebar-foot">
        <button className="btn ghost" style={{width:"100%", justifyContent:"space-between"}} onClick={onOpenChat}>
          <span style={{display:"flex", alignItems:"center", gap:8}}><Dot kind="good" pulse/> Ask Commissioner</span>
          <kbd>⌘K</kbd>
        </button>
        <div className="user-chip" style={{marginTop:12}}>
          <div className="avatar">C</div>
          <div>
            <div className="user-name">{LEAGUE.user.team}</div>
            <div className="user-meta">@{LEAGUE.user.handle}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Masthead({ eyebrow, title, titleEm, right }) {
  return (
    <div className="masthead">
      <div className="masthead-left">
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}{titleEm && <em> {titleEm}</em>}</h1>
      </div>
      <div className="masthead-right">{right}</div>
    </div>
  );
}

function ChatPanel({ open, onClose }) {
  const INTRO_MSG = { who: "agent", text: "I am synced to your league context. Ask about lineup, waivers, matchup, or trade targets." };
  const [msgs, setMsgs] = useState([INTRO_MSG]);
  const [val, setVal] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgs, open]);

  useEffect(() => {
    if (historyLoaded) return;
    const username = window.getSleeperUsername?.() || LEAGUE.user?.handle || "";
    if (!username) return;
    const query = new URLSearchParams({ username, limit: "50" });
    fetch(`/api/chat/history?${query.toString()}`, { headers: { "Accept": "application/json" } })
      .then(r => r.ok ? r.json() : null)
      .then(body => {
        const entries = Array.isArray(body?.messages) ? body.messages : [];
        if (!entries.length) { setHistoryLoaded(true); return; }
        const prior = entries.flatMap(e => ([
          { who: "user", text: String(e.user_message || "") },
          { who: "agent", text: String(e.reply || ""), used_llm: !!e.used_llm },
        ])).filter(m => m.text);
        setMsgs([INTRO_MSG, ...prior]);
        setHistoryLoaded(true);
      })
      .catch(() => setHistoryLoaded(true));
  }, [historyLoaded, open]);
  const send = async () => {
    if (!val.trim()) return;
    const userMsg = val.trim();
    setMsgs(m => [...m, { who: "user", text: userMsg }]);
    setVal("");
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          username: window.getSleeperUsername?.() || LEAGUE.user?.handle || "",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `Chat request failed (${response.status})`);
      }
      setMsgs(m => [...m, { who: "agent", text: payload.reply || "No response generated." }]);
    } catch (err) {
      setMsgs(m => [...m, { who: "agent", text: `I hit a sync issue: ${String(err)}. Try again in a moment.` }]);
    } finally {
      setIsSending(false);
    }
  };
  return (
    <aside className={`chat-panel ${open?"open":""}`}>
      <div className="chat-head">
        <div style={{display:"flex", alignItems:"center", gap:10}}>
          <Dot kind="good" pulse />
          <div>
            <div style={{fontFamily:"var(--serif)", fontSize:20, fontStyle:"italic", lineHeight:1}}>Commissioner</div>
            <div className="mono" style={{fontSize:10, color:"var(--ink-3)", marginTop:2}}>ONLINE · CONTEXT: WEEK {LEAGUE.week}</div>
          </div>
        </div>
        <button className="btn ghost sm" onClick={onClose}>Close <kbd>Esc</kbd></button>
      </div>
      <div className="chat-scroll" ref={scrollRef}>
        {msgs.map((m,i) => (
          <div key={i} className={`msg ${m.who}`}>
            <div className="who">{m.who === "agent" ? "Commissioner" : LEAGUE.user.handle}</div>
            <div className="body">{m.text}</div>
          </div>
        ))}
      </div>
      <div className="chat-input-wrap">
        <input className="chat-input" placeholder="Ask about a player, matchup, or trade…"
          value={val} onChange={e=>setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !isSending) send(); }} />
        <div style={{display:"flex", gap:6, marginTop:8, flexWrap:"wrap"}}>
          {["Who do I start at FLEX?", "Trade target for TE?", "Waivers this week?"].map(q => (
            <button key={q} className="pill" onClick={() => { setVal(q); }}>{q}</button>
          ))}
          {isSending && <span className="mono" style={{fontSize:11, color:"var(--ink-3)"}}>Thinking…</span>}
        </div>
      </div>
    </aside>
  );
}

function TweaksPanel({ open, format, setFormat, density, setDensity }) {
  return (
    <div className={`tweaks ${open?"open":""}`}>
      <h4>Tweaks</h4>
      <div>
        <div className="mono" style={{fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", opacity:0.6, marginBottom:6}}>League Format</div>
        <div className="row">
          {["Redraft","Dynasty","BestBall"].map(f => (
            <button key={f} className={`tweak-opt ${format===f?"active":""}`} onClick={()=>setFormat(f)}>{f}</button>
          ))}
        </div>
      </div>
      <div>
        <div className="mono" style={{fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", opacity:0.6, marginBottom:6}}>Density</div>
        <div className="row">
          {["Compact","Roomy"].map(d => (
            <button key={d} className={`tweak-opt ${density===d?"active":""}`} onClick={()=>setDensity(d)}>{d}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Sidebar, Masthead, ChatPanel, TweaksPanel });
