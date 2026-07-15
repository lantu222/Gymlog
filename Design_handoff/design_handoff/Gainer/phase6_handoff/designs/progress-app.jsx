/* GAINER — Progress tab (light theme), interactive.
   Tabs: Overview / Tracked / Measures. Clean data, no AI, no gamification —
   honest visible progress per the retention philosophy.
   Uses HG / StatusBar / BottomNav / HomeIndicator (home-shared.jsx),
   data (progress-data.jsx) and charts (progress-charts.jsx). */

const { useState, useMemo, useRef } = React;

if (!document.getElementById('gainer-pr-anim')) {
  const s = document.createElement('style');
  s.id = 'gainer-pr-anim';
  s.textContent = `
    @keyframes prUp { from { transform: translateY(16px); } to { transform: translateY(0); } }
    .pr-scroll::-webkit-scrollbar, .pr-rail::-webkit-scrollbar { display: none; }
    .pr-anim { opacity: 1; }
    @media (prefers-reduced-motion: no-preference) {
      .pr-anim { animation: prUp 460ms cubic-bezier(.22,1,.36,1) both; }
    }
  `;
  document.head.appendChild(s);
}

const byKey = Object.fromEntries(LIFTS.map((l) => [l.key, l]));

function Badge({ signal }) {
  const s = SIGNALS[signal];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: s.bg, color: s.fg, fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0 }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: s.dot }}></span>{s.label}
    </span>
  );
}

function Card({ children, style, anim, delay }) {
  return <div className={anim ? 'pr-anim' : undefined} style={{ background: HG.surface, border: `1px solid ${HG.border}`, borderRadius: 18, boxShadow: '0 6px 18px rgba(120,80,200,0.06)', animationDelay: delay, ...style }}>{children}</div>;
}

function SectionLabel({ children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 2px 11px' }}>
      <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.09em', color: HG.faint }}>{children}</span>
      {right}
    </div>
  );
}

// ── Training rhythm: sessions-per-week bars over recent weeks ──
function RhythmCard() {
  const { weeks, weeksInRow, thisWeekDone, thisWeekPlanned } = RHYTHM;
  const maxSessions = Math.max(4, ...weeks);
  const lastIdx = weeks.length - 1;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 30, fontWeight: 800, color: HG.ink, letterSpacing: '-0.02em', lineHeight: 1 }}>{weeksInRow}</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: HG.muted }}>weeks in a row</span>
        </div>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: HG.purple, whiteSpace: 'nowrap' }}>{thisWeekDone}/{thisWeekPlanned} this week</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 56 }}>
        {weeks.map((n, i) => {
          const isCurrent = i === lastIdx;
          const h = Math.max(8, (n / maxSessions) * 56);
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
              <div title={`${n} sessions`} style={{
                height: h, borderRadius: 7,
                background: isCurrent ? HG.purpleLight : HG.purple,
                border: isCurrent ? `1.5px dashed ${HG.purple}` : 'none',
                boxSizing: 'border-box',
              }}></div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: HG.faint }}>10 weeks ago</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: HG.faint }}>This week</span>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: HG.muted, marginTop: 12, lineHeight: 1.5 }}>
        At least one session every week for {weeksInRow} weeks. Bars show sessions per week.
      </div>
    </div>
  );
}

// ── OVERVIEW ──────────────────────────────────────────────────
function Overview() {
  const [metric, setMetric] = useState('volume');
  const [range, setRange] = useState('3m');
  const hero = byKey.squat;
  const heroAccent = SIGNALS[hero.signal].dot;
  const m = OVERVIEW[metric];
  const pts = m[range];
  const first = pts[0].value, last = pts[pts.length - 1].value;
  const metricDelta = +(last - first).toFixed(1);

  return (
    <>
      {/* HERO — key lift progression */}
      <Card anim delay="0ms" style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: HG.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Working weight · {hero.name}</span>
          <Badge signal={hero.signal} />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
          <span style={{ fontSize: 46, fontWeight: 800, color: HG.ink, letterSpacing: '-0.03em', lineHeight: 1 }}>{hero.latest}</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: HG.muted, whiteSpace: 'nowrap' }}>kg × {hero.reps}</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#157A3A', marginTop: 7 }}>
          +{(hero.latest - hero.start).toFixed(1)} kg since you started · {hero.start} → {hero.latest} kg
        </div>
        <div style={{ marginTop: 6 }}>
          <LineChart points={hero.logs} accent={heroAccent} height={142} />
        </div>
      </Card>

      {/* TRAINING RHYTHM — weekly consistency over time (not a daily streak) */}
      <div className="pr-anim" style={{ marginTop: 22, animationDelay: '60ms' }}>
        <SectionLabel>TRAINING RHYTHM</SectionLabel>
        <Card style={{ padding: 16 }}>
          <RhythmCard />
        </Card>
      </div>

      {/* MONTH STATS */}
      <div className="pr-anim" style={{ marginTop: 22, animationDelay: '110ms' }}>
        <SectionLabel>THIS MONTH</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {MONTH_STATS.map((s) => (
            <Card key={s.label} style={{ padding: '13px 12px' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: HG.faint, letterSpacing: '0.04em' }}>{s.label.toUpperCase()}</div>
              <div style={{ fontSize: 21, fontWeight: 800, color: HG.ink, marginTop: 5, letterSpacing: '-0.02em' }}>{s.value}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: HG.muted, marginTop: 2 }}>{s.meta}</div>
            </Card>
          ))}
        </div>
      </div>

      {/* TREND */}
      <div className="pr-anim" style={{ marginTop: 22, animationDelay: '160ms' }}>
        <SectionLabel>TREND</SectionLabel>
        <Card style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: HG.ink }}>{last}{m.suffix}</span>
              <DeltaPill delta={metricDelta} unit={m.suffix.trim()} goodWhenUp={metric !== 'bodyweight' ? true : true} />
            </div>
          </div>
          <div className="pr-rail" style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 12 }}>
            <Segmented small options={OVERVIEW_METRICS} value={metric} onChange={setMetric} />
          </div>
          <LineChart points={pts} accent="#7C3AED" height={150} />
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
            <Segmented small options={RANGES} value={range} onChange={setRange} />
          </div>
        </Card>
      </div>

      {/* ACTIVITY */}
      <div className="pr-anim" style={{ marginTop: 22, animationDelay: '210ms' }}>
        <SectionLabel right={<span style={{ fontSize: 12.5, fontWeight: 800, color: HG.purple }}>{CAL.monthLabel}</span>}>ACTIVITY</SectionLabel>
        <Card style={{ padding: 16 }}>
          <ActivityCalendar cal={CAL} />
        </Card>
      </div>
    </>
  );
}

// ── TRACKED ───────────────────────────────────────────────────
function Tracked() {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(null);

  const list = LIFTS.filter((l) => (filter === 'all' || l.signal === filter) && (!query || l.name.toLowerCase().includes(query.toLowerCase())));

  return (
    <>
      <div style={{ height: 44, borderRadius: 13, background: HG.surface, border: `1px solid ${HG.border}`, display: 'flex', alignItems: 'center', gap: 10, padding: '0 13px', marginBottom: 11 }}>
        <svg viewBox="0 0 24 24" style={{ width: 17, height: 17, stroke: HG.faint, strokeWidth: 2, fill: 'none', strokeLinecap: 'round' }}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tracked lifts..." style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, fontWeight: 600, color: HG.ink, fontFamily: 'inherit' }} />
      </div>

      <div className="pr-rail" style={{ display: 'flex', gap: 8, overflowX: 'auto', marginLeft: -20, marginRight: -20, padding: '0 20px 14px' }}>
        {FILTERS.map((f) => {
          const on = f.key === filter;
          return <div key={f.key} onClick={() => setFilter(f.key)} style={{ flexShrink: 0, height: 32, padding: '0 14px', borderRadius: 999, display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 13, fontWeight: 700, background: on ? HG.purple : HG.surface, color: on ? '#fff' : HG.ink, border: `1px solid ${on ? HG.purple : HG.border}` }}>{f.label}</div>;
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {list.length === 0 && (
          <div style={{ textAlign: 'center', padding: '34px 10px' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: HG.ink }}>Nothing here</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: HG.muted, marginTop: 4 }}>No lifts match this filter.</div>
          </div>
        )}
        {list.map((l) => {
          const isOpen = open === l.key;
          return (
            <Card key={l.key} style={{ padding: 14, cursor: 'pointer' }}>
              <div onClick={() => setOpen(isOpen ? null : l.key)} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15.5, fontWeight: 800, color: HG.ink }}>{l.name}</span>
                  </div>
                  <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Badge signal={l.signal} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: HG.muted }}>{l.latest} kg × {l.reps} · {l.when}</span>
                  </div>
                </div>
                <Sparkline points={l.logs} color={SIGNALS[l.signal].dot} />
                <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, stroke: HG.faint, strokeWidth: 2.2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }}><path d="M6 9l6 6 6-6" /></svg>
              </div>
              {isOpen && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${HG.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 700, color: HG.muted, marginBottom: 4 }}>
                    <span>{l.bodyPart}</span>
                    <span style={{ color: '#157A3A' }}>+{(l.latest - l.start).toFixed(1)} kg · {l.start} → {l.latest} kg</span>
                  </div>
                  <LineChart points={l.logs} accent={SIGNALS[l.signal].dot} height={140} />
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}

// ── MEASURES ──────────────────────────────────────────────────
function MeasureIcon({ name }) {
  const s = { width: 18, height: 18, stroke: HG.purpleDark, strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (name === 'scale') return <svg viewBox="0 0 24 24" style={s}><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M8 8l4 4M8 8h4" /></svg>;
  if (name === 'drop') return <svg viewBox="0 0 24 24" style={s}><path d="M12 3c3 4 6 7 6 11a6 6 0 01-12 0c0-4 3-7 6-11z" /></svg>;
  return <svg viewBox="0 0 24 24" style={s}><rect x="3" y="8" width="18" height="8" rx="2" /><path d="M7 8v4M11 8v4M15 8v4M19 8v4" /></svg>;
}

function Measures() {
  const [sel, setSel] = useState('bodyweight');
  const [range, setRange] = useState('3m');
  const m = MEASURES.find((x) => x.key === sel);
  const histPts = m.hist.map((v, i) => ({ label: ['', '', '', '', '', '', 'now'][i] || '', value: v }));

  return (
    <>
      {/* selected measure detail */}
      <Card anim style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: HG.muted }}>{m.label}</span>
          <DeltaPill delta={m.delta} unit={m.unit} goodWhenUp={!['waist', 'bodyfat'].includes(m.key)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
          <span style={{ fontSize: 42, fontWeight: 800, color: HG.ink, letterSpacing: '-0.03em', lineHeight: 1 }}>{m.value}</span>
          <span style={{ fontSize: 17, fontWeight: 800, color: HG.muted }}>{m.unit}</span>
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: HG.muted, marginTop: 6 }}>Tracked against your own baseline · last 3 months</div>
        <div style={{ marginTop: 8 }}>
          <LineChart points={histPts} accent="#7C3AED" height={132} highlightLast />
        </div>
      </Card>

      <div className="pr-anim" style={{ marginTop: 22, animationDelay: '60ms' }}>
        <SectionLabel>ALL MEASURES</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {MEASURES.map((x) => {
            const on = x.key === sel;
            return (
              <div key={x.key} onClick={() => setSel(x.key)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', background: HG.surface, borderRadius: 14, cursor: 'pointer', border: `1.5px solid ${on ? HG.purple : HG.border}` }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: HG.purpleLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MeasureIcon name={x.icon} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: HG.ink }}>{x.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: HG.muted, marginTop: 2 }}>{x.value} {x.unit}</div>
                </div>
                <Sparkline points={x.hist} color={(['waist', 'bodyfat'].includes(x.key) ? (x.delta < 0 ? '#37C46B' : '#E0922F') : (x.delta > 0 ? '#37C46B' : '#E0922F'))} w={58} h={28} />
                <DeltaPill delta={x.delta} unit={x.unit} goodWhenUp={!['waist', 'bodyfat'].includes(x.key)} />
              </div>
            );
          })}
        </div>
      </div>

      {/* progress photos */}
      <div className="pr-anim" style={{ marginTop: 22, animationDelay: '120ms' }}>
        <SectionLabel right={<span style={{ fontSize: 12.5, fontWeight: 800, color: HG.purple }}>Add</span>}>PROGRESS PHOTOS</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {['Front', 'Side', 'Back'].map((p) => (
            <div key={p} style={{ aspectRatio: '3/4', borderRadius: 14, border: `1.5px dashed ${HG.border}`, background: HG.surfaceSoft, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, stroke: HG.faint, strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.2" /></svg>
              <span style={{ fontSize: 12, fontWeight: 700, color: HG.muted }}>{p}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: HG.faint, marginTop: 10, textAlign: 'center', lineHeight: 1.5 }}>Same light, pose and distance every time for a clean comparison.</div>
      </div>
    </>
  );
}

// ── SCREEN ────────────────────────────────────────────────────
const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'tracked', label: 'Tracked' },
  { key: 'measures', label: 'Measures' },
];

function ProgressScreen() {
  const [tab, setTab] = useState('overview');
  const scrollRef = useRef(null);
  const setTabReset = (t) => { setTab(t); if (scrollRef.current) scrollRef.current.scrollTop = 0; };

  return (
    <div style={{ width: PHONE_W, height: PHONE_H, borderRadius: 46, background: '#0C0A16', padding: 9, boxShadow: '0 30px 70px rgba(30,18,70,0.3)' }}>
      <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 38, overflow: 'hidden', background: HG.bg, display: 'flex', flexDirection: 'column', fontFamily: '"Manrope", system-ui, sans-serif' }}>
        <StatusBar />

        {/* header */}
        <div style={{ padding: '4px 20px 10px', flexShrink: 0 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: HG.ink, letterSpacing: '-0.02em' }}>Progress</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: HG.muted, marginTop: 2 }}>The training you've built — honest and yours.</div>
          <div style={{ marginTop: 14, display: 'flex', background: '#EEE8FA', borderRadius: 12, padding: 3 }}>
            {TABS.map((t) => {
              const on = t.key === tab;
              return <div key={t.key} onClick={() => setTabReset(t.key)} style={{ flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 9, cursor: 'pointer', fontSize: 14, fontWeight: 800, color: on ? HG.purpleDark : HG.muted, background: on ? '#fff' : 'transparent', boxShadow: on ? '0 1px 5px rgba(80,40,160,0.16)' : 'none', transition: 'all 160ms ease' }}>{t.label}</div>;
            })}
          </div>
        </div>

        {/* body */}
        <div ref={scrollRef} className="pr-scroll" key={tab} style={{ flex: 1, overflowY: 'auto', padding: '6px 20px 22px' }}>
          {tab === 'overview' && <Overview />}
          {tab === 'tracked' && <Tracked />}
          {tab === 'measures' && <Measures />}
        </div>

        <BottomNav active="pr" />
        <HomeIndicator />
      </div>
    </div>
  );
}

function App() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#DAD5EC' }}>
      <ProgressScreen />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
