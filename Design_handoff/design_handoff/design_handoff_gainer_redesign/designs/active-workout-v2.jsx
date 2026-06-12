/* GAINER — Active Workout v2 (Lyfta-style flat logging).
   No heavy focus card: one light scroll list. Per exercise: thumb + name,
   rest-timer link, SET / PREVIOUS / KG / REPS / ✓ table, + Add set.
   Other exercises are compact rows (thumb, name, n/m done) that expand on tap.
   Finish lives in the header; rest is a slim bottom bar, not a fullscreen takeover.
   Reuses home-shared.jsx (HG palette, StatusBar, HomeIndicator). */

const { useState, useEffect, useRef } = React;

const AW2 = {
  hairline: '#EFEAF9',
  inputBorder: '#E2DBF2',
  doneTint: '#F4EEFF',
};

// one-time keyframes
if (!document.getElementById('gainer-aw2-anim')) {
  const s = document.createElement('style');
  s.id = 'gainer-aw2-anim';
  s.textContent = `
    @keyframes aw2RestIn { from { transform: translateY(120%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes aw2Expand { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
    .aw2-input::placeholder { color: #B9B1CC; font-weight: 700; }
    .aw2-input:focus { outline: none; border-color: #7C3AED !important; background: #fff !important; }
    @media (prefers-reduced-motion: reduce) { .aw2-rest, .aw2-expand { animation: none !important; } }
  `;
  document.head.appendChild(s);
}

// ── data ──────────────────────────────────────────────────────
const mkSet = (pkg, preps) => ({ pkg, preps, kg: '', reps: '', done: false });
const INITIAL = [
  { name: 'Bench Press',      icon: 'bench',    rest: 120, expanded: true,  sets: [mkSet(60, 8), mkSet(60, 8), mkSet(60, 7), mkSet(55, 8)] },
  { name: 'Overhead Press',   icon: 'ohp',      rest: 120, expanded: false, sets: [mkSet(40, 8), mkSet(40, 7), mkSet(37.5, 8)] },
  { name: 'Incline DB Press', icon: 'incline',  rest: 90,  expanded: false, sets: [mkSet(24, 10), mkSet(24, 9), mkSet(22, 10)] },
  { name: 'Lateral Raise',    icon: 'lateral',  rest: 60,  expanded: false, sets: [mkSet(10, 14), mkSet(10, 13), mkSet(9, 15)] },
  { name: 'Triceps Pushdown', icon: 'pushdown', rest: 60,  expanded: false, sets: [mkSet(30, 12), mkSet(30, 11), mkSet(27.5, 12)] },
];

// exercise thumbnail — neutral placeholder (illustration slot)
function ExThumb({ icon, size = 46 }) {
  const s = { width: size * 0.52, height: size * 0.52, stroke: HG.muted, strokeWidth: 1.9, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  const art = {
    bench:    <svg viewBox="0 0 24 24" style={s}><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/></svg>,
    ohp:      <svg viewBox="0 0 24 24" style={s}><path d="M6 4v5M18 4v5M6 6.5h12"/><circle cx="12" cy="13" r="2.4"/><path d="M9 21c0-2.4 1.2-3.6 3-3.6s3 1.2 3 3.6"/></svg>,
    incline:  <svg viewBox="0 0 24 24" style={s}><path d="M3 18L15 8M3 18h18"/><path d="M14 5v4M18 3v4"/></svg>,
    lateral:  <svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="6" r="2.2"/><path d="M12 9v6M12 11L5 8.5M12 11l7-2.5M12 15l-3 6M12 15l3 6"/></svg>,
    pushdown: <svg viewBox="0 0 24 24" style={s}><path d="M8 3h8M12 3v8M9 14l3-3 3 3M9 19h6"/></svg>,
  };
  return (
    <div style={{ width: size, height: size, borderRadius: 12, background: '#FAF8FF', border: `1px solid ${AW2.hairline}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {art[icon] || art.bench}
    </div>
  );
}

function DotsMenu({ onAddNote }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
      <div onClick={() => setOpen((v) => !v)} style={{ width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: open ? '#F1EDFA' : 'transparent' }}>
        <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, fill: HG.purple }}><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: 38, right: 0, zIndex: 20, background: '#fff', border: `1px solid ${AW2.hairline}`, borderRadius: 14, boxShadow: '0 12px 30px rgba(40,24,90,0.16)', padding: 6, minWidth: 168 }}>
          <div onClick={() => { setOpen(false); onAddNote(); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 14, fontWeight: 700, color: HG.ink }}>
            <svg viewBox="0 0 24 24" style={{ width: 17, height: 17, stroke: HG.muted, strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>
            Add note
          </div>
        </div>
      )}
    </div>
  );
}

const fmtClock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const fmtRest = (s) => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min` : `${s}s`);

const COLS = '34px 1fr 64px 64px 40px';

// ── one exercise section (expanded) ───────────────────────────
function ExerciseSection({ ex, exIdx, onPatch, onCheck }) {
  const [restMenu, setRestMenu] = useState(false);
  const doneCount = ex.sets.filter((s) => s.done).length;
  const patchSet = (i, patch) => {
    const sets = ex.sets.map((s, j) => (j === i ? { ...s, ...patch } : s));
    onPatch({ sets });
  };

  const header = (
    <div onClick={() => onPatch({ expanded: !ex.expanded })} style={{ display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer' }}>
      <ExThumb icon={ex.icon} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16.5, fontWeight: 800, color: HG.ink, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.name}</div>
        {!ex.expanded && (
          <div style={{ fontSize: 12.5, fontWeight: 600, color: doneCount === ex.sets.length ? HG.green : HG.muted, marginTop: 2 }}>
            {doneCount}/{ex.sets.length} done
          </div>
        )}
      </div>
      <DotsMenu onAddNote={() => onPatch({ expanded: true, showNotes: true })} />
    </div>
  );

  if (!ex.expanded) return <div style={{ padding: '13px 20px' }}>{header}</div>;

  return (
    <div className="aw2-expand" style={{ padding: '13px 20px 6px', animation: 'aw2Expand 240ms ease both' }}>
      {header}

      {/* notes (via ⋯ menu) + rest timer */}
      {ex.showNotes && (
        <input className="aw2-input" autoFocus placeholder="Notes…" value={ex.note || ''} onChange={(e) => onPatch({ note: e.target.value })}
          style={{ width: '100%', height: 38, borderRadius: 10, border: `1.5px solid ${AW2.inputBorder}`, background: '#FCFBFF', padding: '0 12px', fontSize: 13.5, fontWeight: 600, color: HG.ink, fontFamily: 'inherit', marginTop: 11, textAlign: 'left' }} />
      )}
      <div style={{ position: 'relative', marginTop: 11 }}>
        <div onClick={() => setRestMenu((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
          <svg viewBox="0 0 24 24" style={{ width: 17, height: 17, stroke: HG.purple, strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
            <circle cx="12" cy="13.5" r="7"/><path d="M10 2.5h4M12 2.5v4M12 10.5v3.5l2.2 1.6"/>
            {!ex.rest && <path d="M4 4l16 17" strokeWidth="2.4"/>}
          </svg>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: HG.purple }}>Rest Timer: {ex.rest ? fmtRest(ex.rest) : 'Off'}</span>
          <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: HG.purple, strokeWidth: 2.4, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', transform: restMenu ? 'rotate(180deg)' : 'none', transition: 'transform 180ms ease' }}><path d="M6 9l6 6 6-6"/></svg>
        </div>
        {restMenu && (
          <div style={{ position: 'absolute', top: 26, left: 0, zIndex: 20, background: '#fff', border: `1px solid ${AW2.hairline}`, borderRadius: 14, boxShadow: '0 12px 30px rgba(40,24,90,0.16)', padding: 6, minWidth: 150 }}>
            {[0, 30, 60, 90, 120, 150, 180].map((v) => {
              const sel = (ex.rest || 0) === v;
              return (
                <div key={v} onClick={() => { onPatch({ rest: v }); setRestMenu(false); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 14, fontWeight: sel ? 800 : 600, color: sel ? HG.purpleDark : HG.ink, background: sel ? HG.purpleLight : 'transparent' }}>
                  {v === 0 ? 'Off' : fmtRest(v)}
                  {sel && <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, stroke: HG.purpleDark, strokeWidth: 2.8, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d="M5 12l5 5L19 7"/></svg>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* table header */}
      <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 10, marginTop: 14, alignItems: 'center' }}>
        {['SET', 'PREVIOUS', 'KG', 'REPS', ''].map((h, i) => (
          <div key={i} style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.07em', color: HG.faint, textAlign: i >= 2 ? 'center' : 'left' }}>{h}</div>
        ))}
      </div>

      {/* set rows */}
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 4 }}>
        {ex.sets.map((s, i) => {
          const inputStyle = {
            width: '100%', height: 36, borderRadius: 9, border: `1.5px solid ${s.done ? 'transparent' : AW2.inputBorder}`,
            background: s.done ? 'transparent' : '#FCFBFF', textAlign: 'center', fontSize: 15, fontWeight: 800,
            color: HG.ink, fontFamily: 'inherit', padding: 0,
          };
          return (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: COLS, gap: 10, alignItems: 'center',
              padding: '5px 8px', margin: '0 -8px', borderRadius: 12,
              background: s.done ? AW2.doneTint : 'transparent', transition: 'background 200ms ease',
            }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: HG.ink, paddingLeft: 4 }}>{i + 1}</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: HG.faint, whiteSpace: 'nowrap' }}>{s.pkg != null ? `${s.pkg} kg × ${s.preps}` : '—'}</div>
              <input className="aw2-input" inputMode="decimal" placeholder={s.pkg != null ? String(s.pkg) : '0'} value={s.kg}
                onChange={(e) => patchSet(i, { kg: e.target.value })} style={inputStyle} />
              <input className="aw2-input" inputMode="numeric" placeholder={s.preps != null ? String(s.preps) : '0'} value={s.reps}
                onChange={(e) => patchSet(i, { reps: e.target.value })} style={inputStyle} />
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div onClick={() => onCheck(exIdx, i)} style={{
                  width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  background: s.done ? HG.purple : '#EFEBF9', transition: 'background 180ms ease',
                }}>
                  <svg viewBox="0 0 24 24" style={{ width: 17, height: 17, stroke: s.done ? '#fff' : '#B9B1CC', strokeWidth: 3, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d="M5 12l5 5L19 7"/></svg>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* add set */}
      <div onClick={() => onPatch({ sets: [...ex.sets, mkSet(ex.sets[ex.sets.length - 1].pkg, ex.sets[ex.sets.length - 1].preps)] })}
        style={{ height: 38, borderRadius: 999, background: '#F1EDFA', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13.5, fontWeight: 800, color: HG.ink, marginTop: 10, cursor: 'pointer' }}>
        <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, stroke: HG.ink, strokeWidth: 2.6, fill: 'none', strokeLinecap: 'round' }}><path d="M12 5v14M5 12h14"/></svg>
        Add set
      </div>
    </div>
  );
}

// ── slim bottom rest bar ──────────────────────────────────────
function RestBar({ total, remaining, onAdjust, onSkip }) {
  const frac = Math.max(0, remaining / total);
  const pill = (label, onClick, solid) => (
    <div onClick={onClick} style={{
      height: 36, padding: '0 14px', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
      background: solid ? '#fff' : 'rgba(255,255,255,0.16)', color: solid ? HG.purpleDark : '#fff',
    }}>{label}</div>
  );
  return (
    <div className="aw2-rest" style={{
      position: 'absolute', left: 14, right: 14, bottom: 34, zIndex: 6, borderRadius: 20, overflow: 'hidden',
      background: HG.purpleDark, boxShadow: '0 14px 34px rgba(60,22,144,0.45)',
      animation: 'aw2RestIn 380ms cubic-bezier(.22,1,.36,1) both',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
        <svg viewBox="0 0 24 24" style={{ width: 19, height: 19, stroke: '#fff', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', flexShrink: 0 }}>
          <circle cx="12" cy="13.5" r="7"/><path d="M10 2.5h4M12 2.5v4M12 10.5v3.5l2.2 1.6"/>
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.65)' }}>REST</div>
          <div style={{ fontSize: 21, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{fmtClock(remaining)}</div>
        </div>
        <div style={{ display: 'flex', gap: 7 }}>
          {pill('−15s', () => onAdjust(-15))}
          {pill('+15s', () => onAdjust(15))}
          {pill('Skip', onSkip, true)}
        </div>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.18)' }}>
        <div style={{ height: '100%', width: `${frac * 100}%`, background: '#fff', transition: 'width 1s linear' }}></div>
      </div>
    </div>
  );
}

// ── screen ────────────────────────────────────────────────────
function ActiveWorkoutV2() {
  const [exs, setExs] = useState(INITIAL);
  const [elapsed, setElapsed] = useState(31);
  const [rest, setRest] = useState(null); // { total, remaining }

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed((e) => e + 1);
      setRest((r) => {
        if (!r) return r;
        if (r.remaining <= 1) return null;
        return { ...r, remaining: r.remaining - 1 };
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const patchEx = (idx, patch) => setExs((xs) => xs.map((x, i) => (i === idx ? { ...x, ...patch } : x)));

  const checkSet = (exIdx, setIdx) => {
    setExs((xs) => xs.map((x, i) => {
      if (i !== exIdx) return x;
      const sets = x.sets.map((s, j) => {
        if (j !== setIdx) return s;
        if (s.done) return { ...s, done: false };
        // commit placeholder values when left empty (Lyfta behavior)
        return { ...s, done: true, kg: s.kg || (s.pkg != null ? String(s.pkg) : ''), reps: s.reps || (s.preps != null ? String(s.preps) : '') };
      });
      return { ...x, sets };
    }));
    const s = exs[exIdx].sets[setIdx];
    const r = exs[exIdx].rest;
    if (!s.done && r) setRest({ total: r, remaining: r });
  };

  const doneSets = exs.flatMap((x) => x.sets).filter((s) => s.done);
  const volume = doneSets.reduce((acc, s) => acc + (parseFloat(s.kg) || 0) * (parseInt(s.reps, 10) || 0), 0);

  return (
    <div style={{ width: 392, height: 812, borderRadius: 46, background: '#0C0A16', padding: 9, boxShadow: '0 30px 70px rgba(30,18,70,0.3)' }}>
      <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 38, overflow: 'hidden', background: '#FFFFFF', display: 'flex', flexDirection: 'column', fontFamily: '"Manrope", system-ui, sans-serif' }}>
        <StatusBar />

        {/* header: collapse · title · Finish */}
        <div style={{ padding: '4px 18px 10px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" style={{ width: 23, height: 23, stroke: HG.ink, strokeWidth: 2.2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', cursor: 'pointer' }}><path d="M6 9l6 6 6-6"/></svg>
          <div style={{ flex: 1 }}></div>
          <div style={{ height: 38, padding: '0 20px', borderRadius: 999, background: HG.purple, color: '#fff', display: 'flex', alignItems: 'center', fontSize: 14.5, fontWeight: 800, cursor: 'pointer', boxShadow: '0 6px 16px rgba(124,58,237,0.28)' }}>Finish</div>
        </div>

        {/* scroll */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingBottom: 18 }}>
          {/* stats */}
          <div style={{ margin: '4px 18px 6px', border: `1px solid ${AW2.hairline}`, borderRadius: 16, display: 'flex', padding: '13px 6px' }}>
            {[['Duration', fmtClock(elapsed), HG.purple], ['Volume', `${volume % 1 ? volume.toFixed(1) : volume} kg`, HG.ink], ['Sets', String(doneSets.length), HG.ink]].map(([l, v, c], i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: HG.muted }}>{l}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: c, marginTop: 3, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{v}</div>
              </div>
            ))}
          </div>

          {/* exercises — flat list with hairline dividers */}
          {exs.map((ex, i) => (
            <div key={i} style={{ borderTop: i === 0 ? 'none' : `1px solid ${AW2.hairline}` }}>
              <ExerciseSection ex={ex} exIdx={i} onPatch={(p) => patchEx(i, p)} onCheck={checkSet} />
            </div>
          ))}

          {/* footer actions */}
          <div style={{ padding: '14px 18px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ height: 46, borderRadius: 999, background: HG.purpleLight, color: HG.purpleDark, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 14.5, fontWeight: 800, cursor: 'pointer' }}>
              <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: HG.purpleDark, strokeWidth: 2.6, fill: 'none', strokeLinecap: 'round' }}><path d="M12 5v14M5 12h14"/></svg>
              Add exercise
            </div>
            <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#D64545', cursor: 'pointer' }}>Cancel workout</div>
          </div>
        </div>

        {rest && (
          <RestBar total={rest.total} remaining={rest.remaining}
            onAdjust={(d) => setRest((r) => r && { total: Math.max(r.total + d, 1), remaining: Math.max(r.remaining + d, 1) })}
            onSkip={() => setRest(null)} />
        )}
        <HomeIndicator />
      </div>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────
function App() {
  const note = (t, d) => (
    <div style={{ display: 'flex', gap: 11, padding: '11px 0', borderTop: `1px solid ${HG.border}` }}>
      <div style={{ width: 7, height: 7, borderRadius: 999, background: HG.purple, marginTop: 6, flexShrink: 0 }}></div>
      <div><span style={{ fontSize: 14.5, fontWeight: 800, color: HG.ink }}>{t}</span><span style={{ fontSize: 14.5, fontWeight: 500, color: '#3B3550' }}> — {d}</span></div>
    </div>
  );
  return (
    <div style={{ minHeight: '100vh', background: '#DAD5EC', fontFamily: '"Manrope", system-ui, sans-serif', display: 'flex', gap: 56, padding: '56px 64px', boxSizing: 'border-box', alignItems: 'flex-start', justifyContent: 'center', flexWrap: 'wrap' }}>
      <div style={{ width: 410, maxWidth: '100%', paddingTop: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', color: '#5B21B6', textTransform: 'uppercase' }}>GAINER · Active Workout v2</div>
        <h1 style={{ fontSize: 30, fontWeight: 800, color: HG.ink, letterSpacing: '-0.02em', margin: '10px 0 0', lineHeight: 1.12 }}>Flat list, light touch</h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: '#3B3550', marginTop: 14 }}>Lyfta-style structure in GAINER's language: no focus card, just one continuous list you scroll and log.</p>
        <div style={{ marginTop: 16 }}>
          {note('No box', 'exercises are flat sections with hairline dividers — far less chrome, more rows on screen')}
          {note('PREVIOUS column', 'last session\u2019s kg × reps inline; checking an empty row commits those values')}
          {note('Everything editable', 'kg / reps are real inputs; + Add set appends a row; tap a compact row to expand it')}
          {note('Finish in header', 'no pinned footer — content runs to the bottom like Lyfta')}
          {note('Rest is a slim bar', 'checking a set slides up a small countdown bar (−15s / +15s / Skip) instead of a fullscreen takeover')}
        </div>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: HG.muted, marginTop: 16 }}>Thumbnails are placeholders — drop in real exercise illustrations later. Old version stays at <strong style={{ color: HG.ink }}>GAINER Active Workout.html</strong> for comparison.</p>
      </div>
      <ActiveWorkoutV2 />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
