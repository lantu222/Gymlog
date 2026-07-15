/* GAINER — Premium paywall (light theme), interactive.
   Frames the purchase as unlocking the Adaptive Coach (the live +2.5 kg layer).
   Benefit hero (coach-diff mock) + lanes + plan toggle (yearly/monthly) + Free vs
   Premium table + trial CTA. Standalone modal — no bottom nav.
   Uses HG / StatusBar / HomeIndicator from home-shared.jsx. */

const { useState } = React;

if (!document.getElementById('gainer-pm-anim')) {
  const s = document.createElement('style');
  s.id = 'gainer-pm-anim';
  s.textContent = `
    @keyframes pmUp { from { transform: translateY(16px); } to { transform: translateY(0); } }
    @keyframes pmFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
    .pm-scroll::-webkit-scrollbar { display: none; }
    .pm-anim { opacity: 1; }
    @media (prefers-reduced-motion: no-preference) {
      .pm-anim { animation: pmUp 480ms cubic-bezier(.22,1,.36,1) both; }
    }
  `;
  document.head.appendChild(s);
}

const PLANS = {
  yearly:  { perMonth: '5,99 €', billed: 'Billed 71,99 € / year', save: 'SAVE 40%', cadence: '/mo' },
  monthly: { perMonth: '9,99 €', billed: 'Billed monthly', save: null, cadence: '/mo' },
};

const LANES = [
  { live: true,  title: 'Adaptive set coach', body: 'After each set GAINER reads your effort and sets the next load — +2.5 kg when you’re flying, back off when you’re not.',
    icon: (c) => <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, fill: c }}><path d="M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2z"/></svg> },
  { live: true,  title: 'Smart rest timing', body: 'Rest shifts with the set instead of a fixed timer every round.',
    icon: (c) => <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, stroke: c, strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}><circle cx="12" cy="13" r="8"/><path d="M12 13V9M12 2h0M9 2h6"/></svg> },
  { live: false, title: 'Session adjustments', body: 'Bad day? It shortens or softens the session so you still train.',
    icon: (c) => <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, stroke: c, strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d="M4 7h16M4 12h10M4 17h7"/></svg> },
  { live: false, title: 'Weekly adaptation', body: 'Hard weeks, missed sessions, and good runs reshape the next week.',
    icon: (c) => <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, stroke: c, strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d="M4 19V5M4 19h16M8 15l3-4 3 2 4-6"/></svg> },
];

const ROWS = [
  { label: 'Manual logging', free: true, prem: 'Included' },
  { label: 'Ready-made plans', free: true, prem: 'Included' },
  { label: 'Progress & measures', free: true, prem: 'Included' },
  { label: 'Adaptive set coach', free: false, prem: 'Live' },
  { label: 'Smart rest timing', free: false, prem: 'Live' },
  { label: 'Session adjustments', free: false, prem: 'Soon' },
  { label: 'Weekly adaptation', free: false, prem: 'Soon' },
];

function Check({ c }) {
  return <svg viewBox="0 0 24 24" style={{ width: 17, height: 17, stroke: c, strokeWidth: 2.6, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d="M5 13l4 4L19 7"/></svg>;
}

// Hero progression chart — honest squat climb + coach's next step (dashed).
function HeroChart() {
  const HIST = [60, 62.5, 65, 67.5, 70, 72.5, 72.5, 75, 77.5, 80, 82.5, 85, 87.5, 90, 90, 92.5];
  const PROJ = 95;
  const all = HIST.concat([PROJ]);
  const N = all.length;
  const W = 300, H = 118, padL = 8, padR = 50, padT = 16, padB = 18;
  const min = 58, max = 97;
  const x = (i) => padL + (i / (N - 1)) * (W - padL - padR);
  const y = (v) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
  const histLine = HIST.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const area = `${x(0)},${H - padB} ${histLine} ${x(HIST.length - 1)},${H - padB}`;
  const grid = [60, 75, 90];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 118, display: 'block' }}>
      <defs>
        <linearGradient id="heroArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {grid.map((g) => (
        <g key={g}>
          <line x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          <text x={W - padR + 6} y={y(g) + 3.5} fontSize="9.5" fontWeight="700" fill="rgba(255,255,255,0.45)" fontFamily="Manrope, sans-serif">{g}</text>
        </g>
      ))}
      <polygon points={area} fill="url(#heroArea)" />
      <polyline points={histLine} fill="none" stroke="#fff" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
      {/* coach's next step — dashed */}
      <line x1={x(HIST.length - 1)} y1={y(HIST[HIST.length - 1])} x2={x(N - 1)} y2={y(PROJ)} stroke="#37D08A" strokeWidth="2.6" strokeDasharray="3 3" strokeLinecap="round" />
      <circle cx={x(HIST.length - 1)} cy={y(HIST[HIST.length - 1])} r="3.4" fill="#fff" />
      <circle cx={x(N - 1)} cy={y(PROJ)} r="5" fill="#37D08A" stroke="#241743" strokeWidth="2.5" />
      <text x={x(N - 1) - 4} y={y(PROJ) - 9} fontSize="11" fontWeight="800" fill="#fff" textAnchor="end" fontFamily="Manrope, sans-serif">95 kg</text>
    </svg>
  );
}

function PlanCard({ id, plan, selected, onSelect }) {
  const on = selected === id;
  return (
    <div onClick={() => onSelect(id)} style={{
      position: 'relative', flex: 1, padding: '15px 15px 14px', borderRadius: 18, cursor: 'pointer',
      background: on ? HG.purpleLight : HG.surface, border: `2px solid ${on ? HG.purple : HG.border}`,
      transition: 'all 160ms ease',
    }}>
      {plan.save && (
        <div style={{ position: 'absolute', top: -10, right: 12, background: HG.green, color: '#fff', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.04em', padding: '3px 9px', borderRadius: 999 }}>{plan.save}</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 19, height: 19, borderRadius: 999, border: `2px solid ${on ? HG.purple : HG.faint}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {on && <div style={{ width: 9, height: 9, borderRadius: 999, background: HG.purple }}></div>}
        </div>
        <span style={{ fontSize: 14, fontWeight: 800, color: HG.ink, textTransform: 'capitalize' }}>{id}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 11 }}>
        <span style={{ fontSize: 27, fontWeight: 800, color: HG.ink, letterSpacing: '-0.02em' }}>{plan.perMonth}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: HG.muted }}>{plan.cadence}</span>
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: HG.muted, marginTop: 4 }}>{plan.billed}</div>
    </div>
  );
}

function PremiumScreen() {
  const [plan, setPlan] = useState('yearly');
  const p = PLANS[plan];
  const trialSub = plan === 'yearly'
    ? 'Then 71,99 € / year (5,99 €/mo). Cancel anytime.'
    : 'Then 9,99 € / month. Cancel anytime.';

  return (
    <div style={{ width: PHONE_W, height: PHONE_H, borderRadius: 46, background: '#0C0A16', padding: 9, boxShadow: '0 30px 70px rgba(30,18,70,0.3)' }}>
      <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 38, overflow: 'hidden', background: HG.bg, display: 'flex', flexDirection: 'column', fontFamily: '"Manrope", system-ui, sans-serif' }}>
        <StatusBar />

        {/* top bar */}
        <div style={{ padding: '2px 18px 6px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: HG.surface, border: `1px solid ${HG.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg viewBox="0 0 24 24" style={{ width: 19, height: 19, stroke: HG.ink, strokeWidth: 2.2, fill: 'none', strokeLinecap: 'round' }}><path d="M6 6l12 12M18 6L6 18"/></svg>
          </div>
          <span style={{ fontSize: 13.5, fontWeight: 800, color: HG.purple, cursor: 'pointer' }}>Restore</span>
        </div>

        <div className="pm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '4px 18px 16px' }}>
          {/* HERO */}
          <div className="pm-anim" style={{ borderRadius: 22, padding: '20px 18px 18px', background: 'linear-gradient(158deg, #241743 0%, #3A1F7A 58%, #4A2398 100%)', boxShadow: '0 18px 36px rgba(50,25,120,0.32)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: '#C9B6FF' }}><path d="M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2z"/></svg>
              <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.12em', color: '#C9B6FF', whiteSpace: 'nowrap' }}>GAINER PREMIUM</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', marginTop: 11, letterSpacing: '-0.02em', lineHeight: 1.12 }}>Keep progressing —<br/>without the guesswork</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'rgba(255,255,255,0.78)', marginTop: 9, lineHeight: 1.5 }}>The Adaptive Coach reads every set and sets your next load. The longer you train, the sharper it gets.</div>

            {/* progression data — what the coach builds over time */}
            <div style={{ marginTop: 16, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 16, padding: '13px 14px 11px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.07em', color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>BACK SQUAT · WORKING WEIGHT</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(55,208,138,0.2)', color: '#7DEBB4', fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                  <svg viewBox="0 0 12 12" style={{ width: 9, height: 9, fill: '#7DEBB4' }}><path d="M6 3l4 5H2z"/></svg>+2.5 kg
                </span>
              </div>
              <div style={{ marginTop: 6 }}><HeroChart /></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4 }}>
                <span style={{ width: 14, height: 0, borderTop: '2px dashed #37D08A', display: 'inline-block' }}></span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,0.66)' }}>Coach’s next step · 60 → 95 kg in 16 weeks</span>
              </div>
            </div>
          </div>

          {/* LANES */}
          <div className="pm-anim" style={{ marginTop: 22, animationDelay: '60ms' }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.09em', color: HG.faint, padding: '0 2px 11px' }}>WHAT PREMIUM ADDS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {LANES.map((l) => (
                <div key={l.title} style={{ display: 'flex', alignItems: 'flex-start', gap: 13, background: HG.surface, border: `1px solid ${HG.border}`, borderRadius: 16, padding: 14 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: HG.purpleLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{l.icon(HG.purple)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: HG.ink }}>{l.title}</span>
                      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.04em', padding: '2px 8px', borderRadius: 999, color: l.live ? HG.green : HG.muted, background: l.live ? HG.greenSoft : HG.surfaceSoft }}>{l.live ? 'LIVE' : 'SOON'}</span>
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: HG.muted, marginTop: 4, lineHeight: 1.5 }}>{l.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PLAN SELECT */}
          <div className="pm-anim" style={{ marginTop: 22, animationDelay: '120ms' }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.09em', color: HG.faint, padding: '0 2px 14px' }}>CHOOSE YOUR PLAN</div>
            <div style={{ display: 'flex', gap: 11 }}>
              <PlanCard id="yearly" plan={PLANS.yearly} selected={plan} onSelect={setPlan} />
              <PlanCard id="monthly" plan={PLANS.monthly} selected={plan} onSelect={setPlan} />
            </div>
          </div>

          {/* COMPARE */}
          <div className="pm-anim" style={{ marginTop: 22, animationDelay: '180ms' }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.09em', color: HG.faint, padding: '0 2px 11px' }}>FREE VS PREMIUM</div>
            <div style={{ background: HG.surface, border: `1px solid ${HG.border}`, borderRadius: 18, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 64px 72px', padding: '12px 16px', borderBottom: `1px solid ${HG.border}`, background: HG.surfaceSoft }}>
                <span></span>
                <span style={{ fontSize: 12, fontWeight: 800, color: HG.muted, textAlign: 'center' }}>Free</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: HG.purple, textAlign: 'center' }}>Premium</span>
              </div>
              {ROWS.map((r, i) => (
                <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '1fr 64px 72px', alignItems: 'center', padding: '12px 16px', borderBottom: i === ROWS.length - 1 ? 'none' : `1px solid ${HG.border}` }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: HG.ink }}>{r.label}</span>
                  <span style={{ display: 'flex', justifyContent: 'center' }}>
                    {r.free ? <Check c={HG.green} /> : <span style={{ width: 12, height: 2, borderRadius: 2, background: HG.faint }}></span>}
                  </span>
                  <span style={{ display: 'flex', justifyContent: 'center' }}>
                    {r.prem === 'Soon'
                      ? <span style={{ fontSize: 11, fontWeight: 800, color: HG.muted }}>Soon</span>
                      : <Check c={HG.purple} />}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontSize: 11.5, fontWeight: 600, color: HG.faint, marginTop: 16, textAlign: 'center', lineHeight: 1.6 }}>
            Free stays fully usable forever. Cancel anytime — your data and logs are always yours.
          </div>
        </div>

        {/* PINNED CTA */}
        <div style={{ flexShrink: 0, padding: '12px 18px 8px', background: HG.surface, borderTop: `1px solid ${HG.border}`, boxShadow: '0 -8px 22px rgba(80,40,160,0.06)' }}>
          <div style={{ height: 54, borderRadius: 16, background: HG.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', boxShadow: '0 10px 22px rgba(124,58,237,0.34)' }}>
            <span style={{ fontSize: 16.5, fontWeight: 800, color: '#fff' }}>Start 7-day free trial</span>
          </div>
          <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: HG.muted, marginTop: 9 }}>
            {trialSub}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: HG.faint, cursor: 'pointer' }}>Terms</span>
            <span style={{ width: 3, height: 3, borderRadius: 999, background: HG.faint }}></span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: HG.faint, cursor: 'pointer' }}>Privacy</span>
          </div>
        </div>

        <HomeIndicator />
      </div>
    </div>
  );
}

function App() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#DAD5EC' }}>
      <PremiumScreen />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
