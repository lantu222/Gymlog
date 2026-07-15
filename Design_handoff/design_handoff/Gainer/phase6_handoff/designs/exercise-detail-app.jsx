/* GAINER — Exercise detail (light theme), interactive.
   Opens when an exercise in the Exercises list is tapped. Real data shape from
   generatedExerciseLibrary (name / bodyPart / equipment / category /
   primaryMuscles / secondaryMuscles / instructions / imageUrls) plus the user's
   own history for this lift (from progress-data bench trend).
   Uses HG / StatusBar / HomeIndicator (home-shared.jsx) and LineChart (progress-charts.jsx). */

const { useState } = React;

if (!document.getElementById('gainer-xd-anim')) {
  const s = document.createElement('style');
  s.id = 'gainer-xd-anim';
  s.textContent = `
    @keyframes xdUp { from { transform: translateY(16px); } to { transform: translateY(0); } }
    @keyframes xdShimmer { 0% { background-position: -200px 0; } 100% { background-position: 200px 0; } }
    @keyframes xdToast { from { opacity: 0; transform: translate(-50%, 14px); } to { opacity: 1; transform: translate(-50%, 0); } }
    .xd-scroll::-webkit-scrollbar { display: none; }
    .xd-anim { opacity: 1; }
    @media (prefers-reduced-motion: no-preference) {
      .xd-anim { animation: xdUp 460ms cubic-bezier(.22,1,.36,1) both; }
    }
  `;
  document.head.appendChild(s);
}

const EXERCISE = {
  name: 'Barbell Bench Press',
  sub: 'Medium grip',
  bodyPart: 'Chest',
  equipment: 'Barbell',
  category: 'Compound',
  level: 'Beginner',
  image: 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Barbell_Bench_Press_-_Medium_Grip/0.jpg',
  primary: ['Chest'],
  secondary: ['Front delts', 'Triceps'],
  instructions: [
    'Lie back on a flat bench. With a medium grip — forearms vertical at the bottom — lift the bar from the rack and hold it locked over you. This is your start position.',
    'Breathe in and lower the bar slowly until it touches your mid-chest.',
    'After a brief pause, press the bar back up as you breathe out — drive through the chest, lock out, and squeeze at the top. Lowering should take about twice as long as pressing.',
    'Repeat for the prescribed reps, keeping the bar path consistent.',
    'When finished, rack the bar safely.',
  ],
};

// the user's own history for this lift (bench trend from progress-data)
const BENCH = [50, 50, 52.5, 55, 55, 57.5, 60, 60, 62.5, 65, 65, 67.5, 70, 70, 72.5, 72.5];
const M = ['Nov', 'Nov', 'Dec', 'Dec', 'Jan', 'Jan', 'Feb', 'Feb', 'Mar', 'Mar', 'Apr', 'Apr', 'May', 'May', 'Jun', 'Jun'];
const BENCH_POINTS = BENCH.map((v, i) => ({ label: M[i], value: v }));
const HISTORY = [
  { label: 'Personal best', value: '72.5 kg', meta: '× 6 · this week' },
  { label: 'Last done', value: '3 days', meta: 'ago · Push A' },
  { label: 'Sessions', value: '24', meta: 'logged' },
];

function HeroImage({ src }) {
  const [state, setState] = useState('load');
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/10', borderRadius: 20, overflow: 'hidden', background: HG.surfaceSoft }}>
      {state !== 'ok' && (
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(100deg, ${HG.surfaceSoft} 30%, #FBF8FF 50%, ${HG.surfaceSoft} 70%)`, backgroundSize: '400px 100%', animation: state === 'load' ? 'xdShimmer 1.1s linear infinite' : 'none' }}>
          {state === 'err' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg viewBox="0 0 24 24" style={{ width: 30, height: 30, stroke: HG.faint, strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/></svg>
            </div>
          )}
        </div>
      )}
      <img src={src} alt="Barbell Bench Press" onLoad={() => setState('ok')} onError={() => setState('err')}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: state === 'ok' ? 1 : 0, transition: 'opacity 280ms ease' }} />
      {/* play hint — form video affordance */}
      <div style={{ position: 'absolute', right: 12, bottom: 12, height: 34, padding: '0 13px 0 10px', borderRadius: 999, background: 'rgba(16,10,32,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: '#fff' }}><path d="M8 5v14l11-7z"/></svg>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>Form video</span>
      </div>
    </div>
  );
}

function Chip({ children, filled }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 800, padding: '5px 11px', borderRadius: 999, whiteSpace: 'nowrap',
      color: filled ? '#fff' : HG.purpleDark, background: filled ? HG.purple : HG.purpleLight }}>{children}</span>
  );
}

function SectionLabel({ children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 2px 11px' }}>
      <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.09em', color: HG.faint }}>{children}</span>
      {right}
    </div>
  );
}

function ExerciseDetail() {
  const [fav, setFav] = useState(false);
  const [added, setAdded] = useState(false);
  const [toast, setToast] = useState(null);

  const flash = (m) => { setToast(m); clearTimeout(window.__xdT); window.__xdT = setTimeout(() => setToast(null), 1700); };
  const toggleAdd = () => { setAdded((a) => !a); flash(added ? 'Removed from workout' : 'Added to your workout'); };
  const toggleFav = () => { setFav((f) => !f); flash(fav ? 'Removed from favorites' : '★ Added to favorites'); };

  return (
    <div style={{ width: PHONE_W, height: PHONE_H, borderRadius: 46, background: '#0C0A16', padding: 9, boxShadow: '0 30px 70px rgba(30,18,70,0.3)' }}>
      <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 38, overflow: 'hidden', background: HG.bg, display: 'flex', flexDirection: 'column', fontFamily: '"Manrope", system-ui, sans-serif' }}>
        <StatusBar />

        {/* top bar */}
        <div style={{ padding: '2px 18px 8px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: HG.surface, border: `1px solid ${HG.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg viewBox="0 0 24 24" style={{ width: 19, height: 19, stroke: HG.ink, strokeWidth: 2.2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d="M15 6l-6 6 6 6"/></svg>
          </div>
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.06em', color: HG.faint, whiteSpace: 'nowrap' }}>EXERCISE</span>
          <div onClick={toggleFav} style={{ width: 38, height: 38, borderRadius: 12, background: HG.surface, border: `1px solid ${HG.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg viewBox="0 0 24 24" style={{ width: 19, height: 19, fill: fav ? '#F4B740' : 'none', stroke: fav ? '#F4B740' : HG.muted, strokeWidth: 2, strokeLinejoin: 'round' }}><path d="M12 3l2.6 5.5 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.5l1.1-6L3.4 9.3l6-.8z"/></svg>
          </div>
        </div>

        <div className="xd-scroll" style={{ flex: 1, overflowY: 'auto', padding: '4px 18px 18px' }}>
          {/* hero */}
          <div className="xd-anim"><HeroImage src={EXERCISE.image} /></div>

          {/* title + chips */}
          <div className="xd-anim" style={{ marginTop: 15, padding: '0 2px', animationDelay: '40ms' }}>
            <div style={{ fontSize: 25, fontWeight: 800, color: HG.ink, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{EXERCISE.name}</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: HG.muted, marginTop: 3 }}>{EXERCISE.sub}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
              <Chip filled>{EXERCISE.bodyPart}</Chip>
              <Chip>{EXERCISE.equipment}</Chip>
              <Chip>{EXERCISE.category}</Chip>
              <Chip>{EXERCISE.level}</Chip>
            </div>
          </div>

          {/* your history */}
          <div className="xd-anim" style={{ marginTop: 24, animationDelay: '90ms' }}>
            <SectionLabel right={<span style={{ fontSize: 12.5, fontWeight: 800, color: HG.purple, cursor: 'pointer', whiteSpace: 'nowrap' }}>All history</span>}>YOUR HISTORY</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {HISTORY.map((h) => (
                <div key={h.label} style={{ background: HG.surface, border: `1px solid ${HG.border}`, borderRadius: 14, padding: '12px 12px' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: HG.faint, letterSpacing: '0.03em' }}>{h.label.toUpperCase()}</div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: HG.ink, marginTop: 5, letterSpacing: '-0.02em' }}>{h.value}</div>
                  <div style={{ fontSize: 10.5, fontWeight: 600, color: HG.muted, marginTop: 2 }}>{h.meta}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, background: HG.surface, border: `1px solid ${HG.border}`, borderRadius: 16, padding: '14px 14px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: HG.ink }}>Working weight</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#157A3A' }}>+22.5 kg · 8 months</span>
              </div>
              <LineChart points={BENCH_POINTS} accent="#7C3AED" height={140} />
            </div>
          </div>

          {/* target muscles */}
          <div className="xd-anim" style={{ marginTop: 24, animationDelay: '140ms' }}>
            <SectionLabel>TARGET MUSCLES</SectionLabel>
            <div style={{ background: HG.surface, border: `1px solid ${HG.border}`, borderRadius: 16, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', color: HG.faint }}>PRIMARY</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {EXERCISE.primary.map((m) => <Chip key={m} filled>{m}</Chip>)}
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', color: HG.faint, marginTop: 15 }}>SECONDARY</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {EXERCISE.secondary.map((m) => <Chip key={m}>{m}</Chip>)}
              </div>
            </div>
          </div>

          {/* how to perform */}
          <div className="xd-anim" style={{ marginTop: 24, animationDelay: '190ms' }}>
            <SectionLabel>HOW TO PERFORM</SectionLabel>
            <div style={{ background: HG.surface, border: `1px solid ${HG.border}`, borderRadius: 18, padding: '6px 16px' }}>
              {EXERCISE.instructions.map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 13, padding: '14px 0', borderBottom: i === EXERCISE.instructions.length - 1 ? 'none' : `1px solid ${HG.border}` }}>
                  <div style={{ width: 26, height: 26, borderRadius: 999, background: HG.purpleLight, color: HG.purpleDark, fontSize: 12.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: HG.ink, lineHeight: 1.55 }}>{step}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontSize: 11.5, fontWeight: 600, color: HG.faint, marginTop: 16, textAlign: 'center', lineHeight: 1.6 }}>
            Form cues are general guidance — adjust to how your body moves.
          </div>
        </div>

        {/* toast */}
        {toast && (
          <div key={toast} style={{ position: 'absolute', left: '50%', bottom: 92, transform: 'translateX(-50%)', background: 'rgba(20,12,38,0.94)', color: '#fff', padding: '8px 15px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', animation: 'xdToast 240ms ease both', boxShadow: '0 8px 20px rgba(20,10,40,0.3)', zIndex: 5 }}>{toast}</div>
        )}

        {/* pinned CTA */}
        <div style={{ flexShrink: 0, padding: '12px 18px 10px', background: HG.surface, borderTop: `1px solid ${HG.border}`, boxShadow: '0 -8px 22px rgba(80,40,160,0.06)' }}>
          <div onClick={toggleAdd} style={{ height: 54, borderRadius: 16, background: added ? HG.greenSoft : HG.green, border: added ? `1.5px solid ${HG.green}` : 'none', color: added ? HG.green : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', boxShadow: added ? 'none' : '0 10px 22px rgba(22,163,74,0.3)' }}>
            <svg viewBox="0 0 24 24" style={{ width: 19, height: 19, stroke: added ? HG.green : '#fff', strokeWidth: 2.6, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>{added ? <path d="M5 13l4 4L19 7"/> : <path d="M12 5v14M5 12h14"/>}</svg>
            <span style={{ fontSize: 16, fontWeight: 800 }}>{added ? 'Added to workout' : 'Add to workout'}</span>
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
      <ExerciseDetail />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
