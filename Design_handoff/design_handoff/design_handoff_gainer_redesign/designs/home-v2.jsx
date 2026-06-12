/* GAINER — Home v2 (flat, Lyfta-style calm).
   Same content as Home Refined, but the boxes are gone: white background,
   hairline-divided sections, plain text stats, one solid purple Start button
   as the only loud element. Matches Active Workout v2's visual language.
   Reuses home-shared.jsx (HG, StatusBar, BottomNav, HomeIndicator). */

const HV2 = { hairline: '#EFEAF9' };

function WeekFlat() {
  const days = [
    ['M', 'done'], ['T', 'off'], ['W', 'off'], ['T', 'today'], ['F', 'off'], ['S', 'off'], ['S', 'off'],
  ];
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
      {days.map(([d, state], i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12.5, fontWeight: 800,
            background: state === 'done' ? HG.purple : state === 'today' ? HG.purpleLight : 'transparent',
            border: state === 'off' ? `1.5px solid ${HV2.hairline}` : 'none',
            color: state === 'done' ? '#fff' : state === 'today' ? HG.purpleDark : HG.faint,
          }}>
            {state === 'done'
              ? <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, stroke: '#fff', strokeWidth: 3, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d="M5 12l5 5L19 7"/></svg>
              : d}
          </div>
        </div>
      ))}
    </div>
  );
}

function FlatRow({ icon, title, sub, divider }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 0', borderTop: divider ? `1px solid ${HV2.hairline}` : 'none', cursor: 'pointer' }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: '#FAF8FF', border: `1px solid ${HV2.hairline}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: HG.ink }}>{title}</div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: HG.muted, marginTop: 2 }}>{sub}</div>
      </div>
      <svg viewBox="0 0 24 24" style={{ width: 17, height: 17, stroke: HG.faint, strokeWidth: 2.2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', flexShrink: 0 }}><path d="M9 6l6 6-6 6"/></svg>
    </div>
  );
}

function HomeV2() {
  const ic = (path, vb = '0 0 24 24') => (
    <svg viewBox={vb} style={{ width: 19, height: 19, stroke: HG.muted, strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>{path}</svg>
  );
  return (
    <div style={{ width: PHONE_W, height: PHONE_H, borderRadius: 46, background: '#0C0A16', padding: 9, boxShadow: '0 30px 70px rgba(30,18,70,0.30)' }}>
      <div style={{ width: '100%', height: '100%', borderRadius: 38, overflow: 'hidden', position: 'relative', background: '#FFFFFF', display: 'flex', flexDirection: 'column', fontFamily: '"Manrope", system-ui, sans-serif' }}>
        <StatusBar />
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '10px 20px 8px' }}>

          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: HG.ink, letterSpacing: '-0.01em' }}>Welcome back</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: HG.muted, marginTop: 2 }}>Thursday · week 4 of your plan</div>
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', color: '#fff', background: HG.green, padding: '5px 10px', borderRadius: 999 }}>PRO</span>
          </div>

          {/* week — flat circles, no container */}
          <div style={{ marginTop: 18 }}><WeekFlat /></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: HG.muted }}>1 of 3 sessions this week</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: HG.ink }}>🔥 4 day streak</span>
          </div>

          {/* today — soft tinted focal card with real content */}
          <div style={{ marginTop: 20, background: '#FAF8FF', border: `1px solid ${HG.border}`, borderRadius: 22, padding: '18px 18px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: HG.purple }}>TODAY · PUSH DAY</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: HG.muted }}>~50 min</span>
            </div>
            <div style={{ fontSize: 27, fontWeight: 800, color: HG.ink, letterSpacing: '-0.015em', marginTop: 7 }}>Push A</div>

            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column' }}>
              {[['Bench Press', '4 × 6–8'], ['Overhead Press', '3 × 6–8'], ['Incline DB Press', '3 × 8–10']].map(([n, s], i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderTop: i === 0 ? 'none' : `1px solid ${HV2.hairline}` }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: HG.ink }}>{n}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: HG.muted, fontVariantNumeric: 'tabular-nums' }}>{s}</span>
                </div>
              ))}
              <div style={{ fontSize: 12.5, fontWeight: 700, color: HG.purple, padding: '7px 0 0', borderTop: `1px solid ${HV2.hairline}`, cursor: 'pointer' }}>+ 2 more exercises</div>
            </div>

            <div onClick={() => { window.location.href = 'GAINER Active Workout v2.html'; }} style={{ marginTop: 14, height: 52, borderRadius: 999, background: HG.purple, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 16, fontWeight: 800, cursor: 'pointer', boxShadow: '0 10px 24px rgba(124,58,237,0.32)', whiteSpace: 'nowrap' }}>
              Start workout
              <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, stroke: '#fff', strokeWidth: 2.6, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </div>
          </div>

          {/* routines — flat rows */}
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontSize: 15.5, fontWeight: 800, color: HG.ink }}>Routines</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: HG.purple, cursor: 'pointer' }}>See all</span>
            </div>
            <FlatRow
              icon={ic(<><path d="M7 3h7l4 4v14H7z"/><path d="M13 3v5h5"/></>)}
              title="Templates" sub="1 saved" />
            <FlatRow divider
              icon={ic(<><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></>)}
              title="Explore plans" sub="20 ready-made programs" />
            <FlatRow divider
              icon={ic(<path d="M12 5v14M5 12h14"/>)}
              title="Empty workout" sub="Log freestyle" />
          </div>

        </div>
        <BottomNav active="home" />
        <HomeIndicator />
      </div>
    </div>
  );
}

function App() {
  const note = (t, d) => (
    <div style={{ display: 'flex', gap: 11, padding: '11px 0', borderTop: `1px solid ${HG.border}` }}>
      <div style={{ width: 7, height: 7, borderRadius: 999, background: HG.purple, marginTop: 6, flexShrink: 0 }}></div>
      <div><span style={{ fontSize: 14.5, fontWeight: 800, color: HG.ink }}>{t}</span><span style={{ fontSize: 14.5, fontWeight: 500, color: '#3B3550' }}> — {d}</span></div>
    </div>
  );
  return (
    <div style={{ minHeight: '100vh', background: '#DAD5EC', fontFamily: '"Manrope", system-ui, sans-serif', display: 'flex', gap: 56, padding: '56px 64px', boxSizing: 'border-box', alignItems: 'flex-start', justifyContent: 'center', flexWrap: 'wrap' }}>
      <div style={{ width: 400, maxWidth: '100%', paddingTop: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', color: '#5B21B6', textTransform: 'uppercase' }}>GAINER · Home v2</div>
        <h1 style={{ fontSize: 30, fontWeight: 800, color: HG.ink, letterSpacing: '-0.02em', margin: '10px 0 0', lineHeight: 1.12 }}>Boxes out, breathing room in</h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: '#3B3550', marginTop: 14 }}>Same content as before, in the flat language of Active Workout v2: white background, hairline dividers, and exactly one loud element.</p>
        <div style={{ marginTop: 16 }}>
          {note('No cards — except one', 'today’s workout sits on a single soft-tinted surface so it reads as the focal point; everything else stays flat')}
          {note('Week as circles', 'done = filled, today = tinted, rest = outline — no container around it')}
          {note('Today has substance', 'the first three exercises with set schemes are listed right on Home — you know what you’re walking into before you start')}
          {note('One loud element', 'the Start workout pill is still the only solid block on screen; it opens Active Workout v2')}
          {note('Routines as rows', 'Templates / Explore / Empty workout as a simple list, same row pattern as the workout screen')}
        </div>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: HG.muted, marginTop: 16 }}>Old version stays at <strong style={{ color: HG.ink }}>GAINER Home Refined.html</strong> for comparison.</p>
      </div>
      <HomeV2 />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
