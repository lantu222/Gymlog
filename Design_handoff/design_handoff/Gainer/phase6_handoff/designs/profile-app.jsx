/* GAINER — Profile tab (light theme), interactive.
   Training identity home: identity · lifetime totals · plan · training profile
   · personal records · premium · inline preferences.
   Honest, accumulating milestones — no badges, no streak anxiety, notifications
   off by default (retention philosophy).
   Uses HG / StatusBar / BottomNav / HomeIndicator (home-shared.jsx) and
   LIFTS (progress-data.jsx) for personal records. */

const { useState } = React;

if (!document.getElementById('gainer-pf-anim')) {
  const s = document.createElement('style');
  s.id = 'gainer-pf-anim';
  s.textContent = `
    @keyframes pfUp { from { transform: translateY(16px); } to { transform: translateY(0); } }
    .pf-scroll::-webkit-scrollbar, .pf-rail::-webkit-scrollbar { display: none; }
    .pf-anim { opacity: 1; }
    @media (prefers-reduced-motion: no-preference) {
      .pf-anim { animation: pfUp 460ms cubic-bezier(.22,1,.36,1) both; }
    }
  `;
  document.head.appendChild(s);
}

// ── persona + content (consistent with Progress data) ──
const USER = {
  name: 'Aleksi Virtanen',
  email: 'aleksi.virtanen@gmail.com',
  initials: 'AV',
  since: 'Training since Nov 2025',
};
const LIFETIME = [
  { label: 'Sessions', value: '138', meta: 'logged' },
  { label: 'Weeks active', value: '30', meta: 'of 31' },
  { label: 'Total volume', value: '412 t', meta: 'lifted' },
  { label: 'Best rhythm', value: '12 wk', meta: 'in a row' },
];
const PLAN = { name: 'Push · Pull · Legs', days: '4 sessions / week', goal: 'Build muscle', next: 'Push A' };
const TRAINING = [
  { label: 'Goal', value: 'Build muscle' },
  { label: 'Experience', value: 'Intermediate' },
  { label: 'Equipment', value: 'Full gym' },
];
const FOCUS = ['Chest', 'Shoulders', 'Back', 'Arms'];

function SectionLabel({ children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 2px 11px' }}>
      <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.09em', color: HG.faint }}>{children}</span>
      {right}
    </div>
  );
}
function Card({ children, style, anim, delay, onClick }) {
  return <div onClick={onClick} className={anim ? 'pf-anim' : undefined} style={{ background: HG.surface, border: `1px solid ${HG.border}`, borderRadius: 18, boxShadow: '0 6px 18px rgba(120,80,200,0.06)', animationDelay: delay, ...style }}>{children}</div>;
}
function Chevron() {
  return <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, stroke: HG.faint, strokeWidth: 2.2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', flexShrink: 0 }}><path d="M9 6l6 6-6 6" /></svg>;
}

// ── segmented control ──
function Seg({ options, value, onChange }) {
  return (
    <div style={{ display: 'inline-flex', background: '#EEE8FA', borderRadius: 10, padding: 3, gap: 2 }}>
      {options.map((o) => {
        const on = o.key === value;
        return <div key={o.key} onClick={() => onChange(o.key)} style={{ padding: '6px 14px', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 800, color: on ? HG.purpleDark : HG.muted, background: on ? '#fff' : 'transparent', boxShadow: on ? '0 1px 4px rgba(80,40,160,0.14)' : 'none', transition: 'all 150ms ease' }}>{o.label}</div>;
      })}
    </div>
  );
}

// ── iOS-style toggle ──
function Toggle({ on, onChange }) {
  return (
    <div onClick={() => onChange(!on)} style={{ width: 48, height: 28, borderRadius: 999, background: on ? HG.purple : '#D8D2E6', padding: 3, cursor: 'pointer', transition: 'background 180ms ease', flexShrink: 0 }}>
      <div style={{ width: 22, height: 22, borderRadius: 999, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transform: on ? 'translateX(20px)' : 'translateX(0)', transition: 'transform 180ms cubic-bezier(.3,1.4,.5,1)' }}></div>
    </div>
  );
}

// preference row wrapper
function PrefRow({ label, sub, control, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderBottom: last ? 'none' : `1px solid ${HG.border}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: HG.ink }}>{label}</div>
        {sub && <div style={{ fontSize: 12, fontWeight: 600, color: HG.muted, marginTop: 3, lineHeight: 1.45 }}>{sub}</div>}
      </div>
      {control}
    </div>
  );
}

function ProfileScreen() {
  const [units, setUnits] = useState('kg');
  const [lang, setLang] = useState('en');
  const [theme, setTheme] = useState('light');
  const [notif, setNotif] = useState(false);

  const prs = ['squat', 'deadlift', 'bench', 'ohp'].map((k) => LIFTS.find((l) => l.key === k));

  return (
    <div style={{ width: PHONE_W, height: PHONE_H, borderRadius: 46, background: '#0C0A16', padding: 9, boxShadow: '0 30px 70px rgba(30,18,70,0.3)' }}>
      <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 38, overflow: 'hidden', background: HG.bg, display: 'flex', flexDirection: 'column', fontFamily: '"Manrope", system-ui, sans-serif' }}>
        <StatusBar />

        {/* header */}
        <div style={{ padding: '4px 20px 8px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, color: HG.ink, letterSpacing: '-0.02em' }}>Profile</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: HG.muted, marginTop: 2 }}>Your training identity.</div>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: 13, background: HG.purpleLight, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, stroke: HG.purpleDark, strokeWidth: 2, fill: 'none' }}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" strokeLinecap="round" /></svg>
          </div>
        </div>

        {/* body */}
        <div className="pf-scroll" style={{ flex: 1, overflowY: 'auto', padding: '6px 20px 22px' }}>
          {/* IDENTITY */}
          <Card anim delay="0ms" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
              <div style={{ width: 64, height: 64, borderRadius: 999, background: 'linear-gradient(150deg, #2A1B4E, #5B21B6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '0.02em' }}>{USER.initials}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 19, fontWeight: 800, color: HG.ink }}>{USER.name}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: HG.muted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{USER.email}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${HG.border}` }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: HG.purpleLight, color: HG.purpleDark, fontSize: 12, fontWeight: 800, padding: '5px 11px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: HG.purple }}></span>{USER.since}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: HG.muted, whiteSpace: 'nowrap' }}>· Synced</span>
            </div>
          </Card>

          {/* LIFETIME */}
          <div className="pf-anim" style={{ marginTop: 22, animationDelay: '50ms' }}>
            <SectionLabel>LIFETIME</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {LIFETIME.map((s) => (
                <Card key={s.label} style={{ padding: '14px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: HG.faint, letterSpacing: '0.04em' }}>{s.label.toUpperCase()}</div>
                  <div style={{ fontSize: 25, fontWeight: 800, color: HG.ink, marginTop: 5, letterSpacing: '-0.02em' }}>{s.value}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: HG.muted, marginTop: 2 }}>{s.meta}</div>
                </Card>
              ))}
            </div>
          </div>

          {/* YOUR PLAN */}
          <div className="pf-anim" style={{ marginTop: 22, animationDelay: '100ms' }}>
            <SectionLabel right={<span style={{ fontSize: 12.5, fontWeight: 800, color: HG.purple, cursor: 'pointer' }}>Manage</span>}>YOUR PLAN</SectionLabel>
            <Card style={{ padding: 16, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: HG.purpleLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, stroke: HG.purpleDark, strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" /></svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: HG.ink }}>{PLAN.name}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: HG.muted, marginTop: 2 }}>{PLAN.days} · {PLAN.goal}</div>
                </div>
                <Chevron />
              </div>
              <div style={{ marginTop: 13, paddingTop: 13, borderTop: `1px solid ${HG.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: HG.muted }}>Up next</span>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: HG.ink }}>{PLAN.next}</span>
              </div>
            </Card>
          </div>

          {/* TRAINING PROFILE */}
          <div className="pf-anim" style={{ marginTop: 22, animationDelay: '150ms' }}>
            <SectionLabel right={<span style={{ fontSize: 12.5, fontWeight: 800, color: HG.purple, cursor: 'pointer' }}>Edit</span>}>TRAINING PROFILE</SectionLabel>
            <Card style={{ padding: '4px 16px' }}>
              {TRAINING.map((t, i) => (
                <div key={t.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${HG.border}` }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: HG.muted }}>{t.label}</span>
                  <span style={{ fontSize: 14.5, fontWeight: 800, color: HG.ink }}>{t.value}</span>
                </div>
              ))}
              <div style={{ padding: '13px 0 14px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: HG.muted, marginBottom: 10 }}>Focus areas</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {FOCUS.map((f) => (
                    <span key={f} style={{ fontSize: 13, fontWeight: 700, color: HG.purpleDark, background: HG.purpleLight, padding: '6px 12px', borderRadius: 999 }}>{f}</span>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* PERSONAL RECORDS */}
          <div className="pf-anim" style={{ marginTop: 22, animationDelay: '200ms' }}>
            <SectionLabel right={<span style={{ fontSize: 12.5, fontWeight: 800, color: HG.purple, cursor: 'pointer' }}>Progress</span>}>PERSONAL RECORDS</SectionLabel>
            <Card style={{ padding: '4px 16px' }}>
              {prs.map((l, i) => (
                <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: i === prs.length - 1 ? 'none' : `1px solid ${HG.border}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 800, color: HG.ink }}>{l.name}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: HG.muted, marginTop: 2 }}>{l.bodyPart}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: HG.ink }}>{l.latest} kg</div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: HG.muted, marginTop: 1 }}>× {l.reps} · {l.when}</div>
                  </div>
                </div>
              ))}
            </Card>
          </div>

          {/* PREMIUM */}
          <div className="pf-anim" style={{ marginTop: 22, animationDelay: '250ms' }}>
            <div style={{ borderRadius: 18, padding: 18, background: 'linear-gradient(155deg, #251743 0%, #3A1F7A 60%, #4A2398 100%)', boxShadow: '0 14px 30px rgba(50,25,120,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg viewBox="0 0 24 24" style={{ width: 17, height: 17, fill: '#C9B6FF' }}><path d="M12 2l2.4 6.4L21 9l-5 4.2L17.6 21 12 17.3 6.4 21 8 13.2 3 9l6.6-.6z" /></svg>
                <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: '#C9B6FF' }}>GAINER PREMIUM</span>
              </div>
              <div style={{ fontSize: 19, fontWeight: 800, color: '#fff', marginTop: 10, letterSpacing: '-0.01em' }}>Adaptive Coach</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'rgba(255,255,255,0.78)', marginTop: 6, lineHeight: 1.5 }}>
                Reads your fatigue and progress, then adjusts each week's load for you. The longer you train, the sharper it gets.
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
                <div style={{ height: 44, padding: '0 20px', borderRadius: 13, background: '#fff', color: '#3A1F7A', display: 'flex', alignItems: 'center', fontSize: 14.5, fontWeight: 800, cursor: 'pointer' }}>Try the preview</div>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>Free for 14 days</span>
              </div>
            </div>
          </div>

          {/* PREFERENCES */}
          <div className="pf-anim" style={{ marginTop: 22, animationDelay: '300ms' }}>
            <SectionLabel>PREFERENCES</SectionLabel>
            <Card style={{ padding: '2px 0' }}>
              <PrefRow label="Units" control={<Seg options={[{ key: 'kg', label: 'kg' }, { key: 'lb', label: 'lb' }]} value={units} onChange={setUnits} />} />
              <PrefRow label="Language" control={<Seg options={[{ key: 'fi', label: 'FIN' }, { key: 'en', label: 'ENG' }]} value={lang} onChange={setLang} />} />
              <PrefRow label="Theme" control={<Seg options={[{ key: 'light', label: 'Light' }, { key: 'dark', label: 'Dark' }]} value={theme} onChange={setTheme} />} />
              <PrefRow label="Notifications" sub="Off by default. Only a genuinely useful ping — never guilt or streak pressure." control={<Toggle on={notif} onChange={setNotif} />} last />
            </Card>
          </div>

          {/* ACCOUNT ACTIONS */}
          <div className="pf-anim" style={{ marginTop: 22, animationDelay: '340ms' }}>
            <SectionLabel>ACCOUNT</SectionLabel>
            <Card style={{ padding: '2px 0' }}>
              {[
                { label: 'Export my data', sub: 'Download a local copy.', icon: 'M12 3v12M7 10l5 5 5-5M5 21h14' },
                { label: 'Privacy', sub: 'How your data is handled.', icon: 'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z' },
              ].map((a, i) => (
                <div key={a.label} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 14px', borderBottom: `1px solid ${HG.border}`, cursor: 'pointer' }}>
                  <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, stroke: HG.muted, strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d={a.icon} /></svg>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 800, color: HG.ink }}>{a.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: HG.muted, marginTop: 2 }}>{a.sub}</div>
                  </div>
                  <Chevron />
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 14px', cursor: 'pointer' }}>
                <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, stroke: '#C0392B', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg>
                <span style={{ fontSize: 14.5, fontWeight: 800, color: '#C0392B' }}>Sign out</span>
              </div>
            </Card>
            <div style={{ textAlign: 'center', fontSize: 11.5, fontWeight: 600, color: HG.faint, marginTop: 16 }}>GAINER · v1.0.0</div>
          </div>
        </div>

        <BottomNav active="pf" />
        <HomeIndicator />
      </div>
    </div>
  );
}

function App() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#DAD5EC' }}>
      <ProfileScreen />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
