/* GAINER Onboarding — shared atoms (LIGHT theme, matches Home).
   Reuses window.HG / StatusBar / HomeIndicator from home-shared.jsx. */

const ONB_W = 392, ONB_H = 812;

function OnbPhone({ children }) {
  return (
    <div style={{
      width: ONB_W, height: ONB_H, borderRadius: 46, background: '#0C0A16', padding: 9,
      boxShadow: '0 30px 70px rgba(30,18,70,0.30)',
    }}>
      <div style={{
        width: '100%', height: '100%', borderRadius: 38, overflow: 'hidden',
        background: HG.bg, display: 'flex', flexDirection: 'column',
        fontFamily: '"Manrope", system-ui, sans-serif',
      }}>
        <StatusBar />
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>{children}</div>
        <HomeIndicator />
      </div>
    </div>
  );
}

function Logo({ size = 44 }) {
  return (
    <div style={{ fontSize: size, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1 }}>
      <span style={{ color: HG.ink }}>G</span>
      <span style={{ color: HG.purple }}>AI</span>
      <span style={{ color: HG.ink }}>NER</span>
    </div>
  );
}

function StepBar({ step, total = 5 }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ flex: 1, height: 5, borderRadius: 999, background: i < step ? HG.purple : '#E6DEF6' }}></div>
      ))}
    </div>
  );
}

function StepHeader({ step, total = 5, title }) {
  return (
    <div>
      <StepBar step={step} total={total} />
      <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '0.14em', color: HG.purple, marginTop: 18 }}>STEP {step} OF {total}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: HG.ink, letterSpacing: '-0.02em', marginTop: 6, lineHeight: 1.12 }}>{title}</div>
    </div>
  );
}

function CTA({ label, disabled }) {
  return (
    <div style={{
      height: 56, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 17, fontWeight: 800, letterSpacing: '0.01em',
      background: disabled ? '#E3DAF5' : HG.purple,
      color: disabled ? HG.faint : '#fff',
      boxShadow: disabled ? 'none' : '0 14px 28px rgba(124,58,237,0.32)',
    }}>{label}</div>
  );
}

function BackLink() {
  return <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 700, color: HG.muted, marginTop: 14 }}>Back</div>;
}

// Fixed layout: scrollable content + a PINNED footer so the CTA sits at the
// exact same Y on every screen (no bouncing). The Back zone is always reserved
// (even when empty) so the CTA never shifts whether or not Back is shown.
function OnbScaffold({ children, cta, ctaDisabled, back = false }) {
  return (
    <OnbPhone>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px 10px' }}>{children}</div>
        <div style={{ padding: '8px 22px 14px', flexShrink: 0 }}>
          {cta && <CTA label={cta} disabled={ctaDisabled} />}
          <div style={{ height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {back && <span style={{ fontSize: 15, fontWeight: 700, color: HG.muted }}>Back</span>}
          </div>
        </div>
      </div>
    </OnbPhone>
  );
}

function Chip({ label, color = HG.muted, bg = HG.surfaceSoft }) {
  return <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.04em', color, background: bg, padding: '4px 8px', borderRadius: 999, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</span>;
}

// Selectable option row. selected → purple fill + white text + optional "why" list.
function OptionCard({ icon, title, sub, tag, tagColor, tagBg, selected, why, chips }) {
  if (selected) {
    return (
      <div style={{ background: HG.purple, borderRadius: 18, padding: 16, boxShadow: '0 16px 32px rgba(124,58,237,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          {icon && <div style={{ width: 44, height: 44, borderRadius: 13, background: 'rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>{title}</span>
              {tag && <Chip label={tag} color={HG.purpleDark} bg="#fff" />}
            </div>
            {sub && <div style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginTop: 3 }}>{sub}</div>}
          </div>
          <div style={{ width: 26, height: 26, borderRadius: 999, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: HG.purple, strokeWidth: 3, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d="M5 12l5 5L19 7"/></svg>
          </div>
        </div>
        {why && (
          <div style={{ marginTop: 13, paddingTop: 13, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.7)', marginBottom: 9 }}>WHY IT'S GREAT FOR YOU</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {why.map((w, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, stroke: '#fff', strokeWidth: 2.6, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', flexShrink: 0 }}><path d="M5 12l5 5L19 7"/></svg>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>{w}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {chips && (
          <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            {chips.map((c, i) => <Chip key={i} label={c} color="#fff" bg="rgba(255,255,255,0.18)" />)}
          </div>
        )}
      </div>
    );
  }
  return (
    <div style={{ background: HG.surface, border: `1px solid ${HG.border}`, borderRadius: 18, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        {icon && <div style={{ width: 44, height: 44, borderRadius: 13, background: HG.purpleLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: HG.ink, whiteSpace: 'nowrap' }}>{title}</span>
            {tag && <Chip label={tag} color={tagColor || HG.muted} bg={tagBg || HG.surfaceSoft} />}
          </div>
          {sub && <div style={{ fontSize: 12.5, fontWeight: 600, color: HG.muted, marginTop: 3 }}>{sub}</div>}
          {chips && (
            <div style={{ display: 'flex', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
              {chips.map((c, i) => <Chip key={i} label={c} />)}
            </div>
          )}
        </div>
        <div style={{ width: 26, height: 26, borderRadius: 999, border: `2px solid ${HG.border}`, flexShrink: 0 }}></div>
      </div>
    </div>
  );
}

// Simple line icons used across onboarding
function OnbIcon({ name, color = '#fff', size = 22 }) {
  const s = { width: size, height: size, fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const P = {
    dumbbell: <path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/>,
    home: <g><path d="M4 11l8-6 8 6"/><path d="M6 10v9h12v-9"/></g>,
    run: <g><circle cx="13" cy="5" r="2"/><path d="M5 19l3-5 4 1 2 4M8 14l-1-4 5-2 3 3 3 1"/></g>,
    body: <g><circle cx="12" cy="5" r="2.4"/><path d="M12 8v7M12 9l-5 3M12 9l5 3M9 21l3-6 3 6"/></g>,
    shoe: <path d="M3 16h12l5 1v2H3zM3 16l1-5 3 1 2 3"/>,
    trend: <path d="M4 18l5-6 4 3 7-9"/>,
    heart: <path d="M12 20s-7-4.5-7-9a4 4 0 017-2.5A4 4 0 0119 11c0 4.5-7 9-7 9z"/>,
    star: <path d="M12 4l2.3 5 5.7.5-4.3 3.8 1.3 5.7L12 16l-5.3 3 1.3-5.7L3.7 9.5 9.4 9z"/>,
    trophy: <g><path d="M6 9a6 6 0 0012 0V4H6z"/><path d="M6 5H3v2a3 3 0 003 3M18 5h3v2a3 3 0 01-3 3M9 21h6M12 15v6"/></g>,
    up: <path d="M12 19V5M6 11l6-6 6 6"/>,
    minus: <path d="M5 12h14"/>,
    down: <path d="M12 5v14M6 13l6 6 6-6"/>,
    clock: <g><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></g>,
  };
  return <svg viewBox="0 0 24 24" style={s}>{P[name]}</svg>;
}

Object.assign(window, { ONB_W, ONB_H, OnbPhone, Logo, StepBar, StepHeader, CTA, BackLink, OnbScaffold, Chip, OptionCard, OnbIcon });
