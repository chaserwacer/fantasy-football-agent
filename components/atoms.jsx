// Shared small components for Commissioner
const { useState, useEffect, useRef, useMemo } = React;

function Eyebrow({ children, style }) {
  return <div className="eyebrow" style={style}>{children}</div>;
}

function Pill({ children, kind = "", solid, style }) {
  const cls = ["pill", kind, solid ? "solid" : ""].filter(Boolean).join(" ");
  return <span className={cls} style={style}>{children}</span>;
}

function PosTag({ pos, style }) {
  return (
    <span className="mono" style={{
      fontSize: 10, letterSpacing: "0.08em", fontWeight: 600,
      color: POS_COLORS[pos] || "var(--ink-2)",
      ...style
    }}>{pos}</span>
  );
}

function Dot({ kind, pulse }) {
  return <span className={`dot ${kind||""} ${pulse?"pulse":""}`} />;
}

function Confidence({ value, label = "Confidence" }) {
  return (
    <div className="confidence">
      <span className="label">{label}</span>
      <span className="value tnum">{value}<span style={{fontSize:10, color:"var(--ink-3)"}}>%</span></span>
    </div>
  );
}

function Bar({ value, max = 100, kind = "" }) {
  const pct = Math.max(0, Math.min(100, (value/max)*100));
  return (
    <div className="bar-track"><div className={`bar-fill ${kind}`} style={{ width: pct + "%" }} /></div>
  );
}

function PlayerAvatar({ name }) {
  const initials = name.split(/\s+/).filter(Boolean).map(p => p[0]).join("").slice(0,2).toUpperCase();
  return <div className="player-avatar">{initials}</div>;
}

function StatBlock({ label, value, delta, deltaKind, suffix, serif = true }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value tnum" style={{ fontFamily: serif ? "var(--serif)" : "var(--mono)" }}>
        {value}{suffix && <span style={{fontSize: 14, color:"var(--ink-3)", marginLeft: 4}}>{suffix}</span>}
      </div>
      {delta != null && <div className={`delta ${deltaKind||""}`}>{delta}</div>}
    </div>
  );
}

function SectionHead({ eyebrow, title, meta, children }) {
  return (
    <div className="section-head">
      <div>
        {eyebrow && <div className="eyebrow" style={{marginBottom:4}}>{eyebrow}</div>}
        <h2>{title}</h2>
      </div>
      <div className="rule" />
      {meta && <div className="meta">{meta}</div>}
      {children}
    </div>
  );
}

function Sparkline({ points, width = 80, height = 22, color = "var(--ink)" }) {
  if (!points || points.length < 2) return null;
  const min = Math.min(...points), max = Math.max(...points);
  const r = max - min || 1;
  const step = width / (points.length - 1);
  const d = points.map((p,i) => `${i===0?"M":"L"}${(i*step).toFixed(1)},${(height - ((p-min)/r)*height).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} style={{display:"block"}}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.25" />
    </svg>
  );
}

Object.assign(window, { Eyebrow, Pill, PosTag, Dot, Confidence, Bar, PlayerAvatar, StatBlock, SectionHead, Sparkline });
