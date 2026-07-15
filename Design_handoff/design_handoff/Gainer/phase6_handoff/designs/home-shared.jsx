/* Shared atoms for GAINER Home explorations.
   Palette taken verbatim from src/screens/HomeScreen.tsx (HOME_* constants). */

const { useState } = React;

const HG = {
  bg: '#F7F3FF', surface: '#FFFFFF', surfaceSoft: '#F2ECFF',
  ink: '#101828', muted: '#667085', faint: '#9A93AC',
  border: '#E4D8FF', shadow: '#D8C7FF',
  purple: '#7C3AED', purpleDark: '#5B21B6', purpleLight: '#EFE7FF',
  green: '#16A34A', greenSoft: '#E8F7EE', blue: '#0A84FF',
};
const HD = {
  bg: '#17132B', surface: '#221B40', card: '#241D45',
  ink: '#F4F1FF', muted: '#A79FC4', faint: '#7C739E',
  border: 'rgba(255,255,255,0.09)', purple: '#9B6DFF', purpleSoft: 'rgba(155,109,255,0.16)',
  green: '#37D08A', greenSoft: 'rgba(55,208,138,0.15)',
};

const PHONE_W = 392;
const PHONE_H = 812;

function StatusBar({ dark }) {
  const c = dark ? HD.ink : HG.ink;
  return (
    <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 26px', flexShrink: 0 }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: c }}>9:41</span>
      <div style={{ width: 52, height: 8, borderRadius: 4, background: dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)' }}></div>
      <div style={{ width: 17, height: 11, borderRadius: 2, border: `1.5px solid ${c}`, opacity: 0.85 }}></div>
    </div>
  );
}

function HomeIndicator({ dark }) {
  return (
    <div style={{ height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <div style={{ width: 130, height: 5, borderRadius: 3, background: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.26)' }}></div>
    </div>
  );
}

// Minimal stroke icons for the bottom tab bar
function NavIcon({ name, color }) {
  const s = { width: 24, height: 24, fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (name === 'home') return <svg viewBox="0 0 24 24" style={s}><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/></svg>;
  if (name === 'dumbbell') return <svg viewBox="0 0 24 24" style={s}><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/></svg>;
  if (name === 'chart') return <svg viewBox="0 0 24 24" style={s}><path d="M4 19V5M4 19h16M8 16l3-4 3 2 4-6"/></svg>;
  if (name === 'profile') return <svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.4 3-5.5 7-5.5s7 2.1 7 5.5"/></svg>;
  return null;
}

// one-time keyframes for the Start sheet
if (typeof document !== 'undefined' && !document.getElementById('gainer-fab-anim')) {
  const s = document.createElement('style');
  s.id = 'gainer-fab-anim';
  s.textContent = `
    @keyframes fabScrim { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fabSheet { from { transform: translateY(105%); } to { transform: translateY(0); } }
    @keyframes fabRow { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    @media (prefers-reduced-motion: reduce) {
      .fab-scrim, .fab-sheet, .fab-row { animation: none !important; }
    }
  `;
  document.head.appendChild(s);
}

// Action row inside the Start sheet
function SheetRow({ icon, title, sub, accent, delay, onClick, P }) {
  return (
    <div className="fab-row" onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 15px', borderRadius: 16, cursor: 'pointer',
      background: accent ? (P.purpleLight || P.purpleSoft) : (P.surfaceSoft || P.card),
      border: `1px solid ${accent ? P.purple : P.border}`,
      animation: `fabRow 380ms cubic-bezier(.22,1,.36,1) both`, animationDelay: delay,
    }}>
      <div style={{ width: 44, height: 44, borderRadius: 13, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: accent ? P.purple : (P.purpleLight || P.purpleSoft) }}>
        {icon(accent ? '#fff' : P.purple)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15.5, fontWeight: 800, color: P.ink }}>{title}</div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: P.muted, marginTop: 2 }}>{sub}</div>
      </div>
      <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, stroke: P.faint, strokeWidth: 2.2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', flexShrink: 0 }}><path d="M9 6l6 6-6 6"/></svg>
    </div>
  );
}

const COACH_CHIPS = [
  { q: 'Keep today\u2019s plan', a: 'Good call. Push A is well within your recent range \u2014 4 working sets of bench at 72.5 kg, then accessories. No changes needed today.' },
  { q: 'Add 2.5 kg to squats', a: 'You hit 92.5 kg \u00d7 5 cleanly and bar speed was strong. Bumping to 95 kg \u00d7 5 today is a sensible step \u2014 stop the set if the last rep slows down.' },
  { q: 'I\u2019m a bit tired', a: 'Then we keep it honest: same lifts, drop one working set per movement and hold the weight. Recovery is part of the program, not a detour.' },
];

function StartSheet({ P, onClose }) {
  const [view, setView] = useState('menu'); // menu | coach
  const [reply, setReply] = useState(null);
  const ic = (color) => ({
    dumbbell: <svg viewBox="0 0 24 24" style={{ width: 23, height: 23, stroke: color, strokeWidth: 2.2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/></svg>,
    bolt: <svg viewBox="0 0 24 24" style={{ width: 23, height: 23, stroke: color, strokeWidth: 2.2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>,
    spark: <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, fill: color }}><path d="M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2z"/></svg>,
  });

  return (
    <div className="fab-scrim" onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 50, borderRadius: 38, overflow: 'hidden',
      background: 'rgba(16,10,32,0.42)', backdropFilter: 'blur(2px)',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      animation: 'fabScrim 220ms ease both',
    }}>
      <div className="fab-sheet" onClick={(e) => e.stopPropagation()} style={{
        background: P.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
        padding: '12px 18px calc(18px + env(safe-area-inset-bottom))', boxShadow: '0 -16px 40px rgba(20,10,50,0.28)',
        animation: 'fabSheet 360ms cubic-bezier(.22,1,.36,1) both',
      }}>
        <div style={{ width: 40, height: 5, borderRadius: 3, background: P.border, margin: '0 auto 14px' }}></div>

        {view === 'menu' && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 2px 14px' }}>
              <span style={{ fontSize: 19, fontWeight: 800, color: P.ink, letterSpacing: '-0.01em' }}>Start training</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: P.muted }}>Thursday</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <SheetRow P={P} accent delay="40ms" icon={(c) => ic(c).dumbbell} title="Start today’s session" sub="Push A · 6 exercises · ~52 min" onClick={() => { window.location.href = 'GAINER Active Workout.html'; }} />
              <SheetRow P={P} delay="100ms" icon={(c) => ic(c).bolt} title="Quick session" sub="Empty session — add exercises as you go" onClick={() => { window.location.href = 'GAINER Active Workout.html'; }} />
              <SheetRow P={P} delay="160ms" icon={(c) => ic(c).spark} title="Ask AI Coach" sub="Adjust today’s load or get a suggestion" onClick={() => setView('coach')} />
            </div>
          </>
        )}

        {view === 'coach' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 2px 14px' }}>
              <div onClick={() => { setView('menu'); setReply(null); }} style={{ width: 34, height: 34, borderRadius: 10, background: P.surfaceSoft || P.card, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, stroke: P.ink, strokeWidth: 2.2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d="M15 6l-6 6 6 6"/></svg>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: P.purple }}><path d="M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2z"/></svg>
                <span style={{ fontSize: 18, fontWeight: 800, color: P.ink }}>AI Coach</span>
              </div>
            </div>

            <div style={{ background: P.surfaceSoft || P.card, borderRadius: 16, padding: '14px 15px', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: P.ink, lineHeight: 1.55 }}>
                {reply || 'You\u2019ve trained 3\u00d7 this week and squats just hit a new best. Want to keep today\u2019s plan, or should I adjust the load?'}
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
              {COACH_CHIPS.map((c) => (
                <span key={c.q} onClick={() => setReply(c.a)} style={{ fontSize: 13, fontWeight: 700, color: P.purpleDark || P.purple, background: P.purpleLight || P.purpleSoft, padding: '8px 13px', borderRadius: 999, cursor: 'pointer' }}>{c.q}</span>
              ))}
            </div>

            <div style={{ marginTop: 10, height: 48, borderRadius: 14, background: P.surfaceSoft || P.card, border: `1px solid ${P.border}`, display: 'flex', alignItems: 'center', gap: 10, padding: '0 6px 0 15px' }}>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: P.faint }}>Ask anything about today…</span>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: P.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, stroke: '#fff', strokeWidth: 2.4, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function BottomNav({ dark, active = 'home' }) {
  const P = dark ? HD : HG;
  const [open, setOpen] = useState(false);
  const item = (name, label, key) => {
    const on = key === active;
    const col = on ? P.purple : (dark ? P.faint : P.muted);
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <NavIcon name={name} color={col} />
        <span style={{ fontSize: 11, fontWeight: on ? 800 : 600, color: col }}>{label}</span>
      </div>
    );
  };
  return (
    <>
      {open && <StartSheet P={P} onClose={() => setOpen(false)} />}
      <div style={{
        flexShrink: 0, height: 76, display: 'flex', alignItems: 'center', position: 'relative', zIndex: 41,
        padding: '0 14px', background: dark ? P.surface : P.surface,
        borderTop: `1px solid ${P.border}`,
      }}>
        {item('home', 'Home', 'home')}
        {item('dumbbell', 'Exercises', 'ex')}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div onClick={() => setOpen((v) => !v)} style={{
            width: 54, height: 54, borderRadius: 999, background: P.purple, marginTop: -26, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 10px 22px ${dark ? 'rgba(155,109,255,0.5)' : 'rgba(124,58,237,0.45)'}`,
            border: `4px solid ${P.surface}`,
          }}>
            <svg viewBox="0 0 24 24" style={{ width: 26, height: 26, stroke: '#fff', strokeWidth: 2.6, strokeLinecap: 'round', transform: open ? 'rotate(45deg)' : 'rotate(0)', transition: 'transform 280ms cubic-bezier(.3,1.3,.5,1)' }}><path d="M12 5v14M5 12h14"/></svg>
          </div>
        </div>
        {item('chart', 'Progress', 'pr')}
        {item('profile', 'Profile', 'pf')}
      </div>
    </>
  );
}

// Week consistency strip — only an "actionable" signal (training rhythm)
function WeekStrip({ dark, days, caption }) {
  const P = dark ? HD : HG;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
        {days.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: '100%', height: 6, borderRadius: 999,
              background: d.state === 'done' ? P.purple : d.state === 'planned' ? (dark ? HD.purpleSoft : HG.purpleLight) : (dark ? 'rgba(255,255,255,0.07)' : '#ECE7F8'),
              border: d.state === 'planned' ? `1.5px dashed ${P.purple}` : 'none', boxSizing: 'border-box',
            }}></div>
            <span style={{ fontSize: 10, fontWeight: 700, color: d.today ? P.purple : (dark ? P.faint : P.faint) }}>{d.label}</span>
          </div>
        ))}
      </div>
      {caption && <div style={{ fontSize: 12.5, fontWeight: 600, color: dark ? P.muted : HG.muted, marginTop: 12 }}>{caption}</div>}
    </div>
  );
}

const WEEK = [
  { label: 'M', state: 'done', today: false },
  { label: 'T', state: 'empty', today: false },
  { label: 'W', state: 'empty', today: false },
  { label: 'T', state: 'planned', today: true },
  { label: 'F', state: 'empty', today: false },
  { label: 'S', state: 'empty', today: false },
  { label: 'S', state: 'empty', today: false },
];

function PhoneFrame({ children, dark, navActive = 'home' }) {
  const P = dark ? HD : HG;
  return (
    <div style={{
      width: PHONE_W, height: PHONE_H, borderRadius: 46, background: '#0C0A16', padding: 9,
      boxShadow: '0 30px 70px rgba(30,18,70,0.30)',
    }}>
      <div style={{
        width: '100%', height: '100%', borderRadius: 38, overflow: 'hidden', position: 'relative',
        background: P.bg, display: 'flex', flexDirection: 'column',
        fontFamily: '"Manrope", system-ui, sans-serif',
      }}>
        <StatusBar dark={dark} />
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>{children}</div>
        <BottomNav dark={dark} active={navActive} />
        <HomeIndicator dark={dark} />
      </div>
    </div>
  );
}

Object.assign(window, { HG, HD, PHONE_W, PHONE_H, StatusBar, HomeIndicator, BottomNav, WeekStrip, WEEK, PhoneFrame, NavIcon });
