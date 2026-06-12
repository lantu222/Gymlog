/* Onboarding screens 4–6: Step 3 (training profile), Step 4 (focus), Step 5 (goal) */

// Calm training-profile summary — NO "AI building 60% FIT" gauge / theater.
function OnbProfile() {
  const row = (title, sub, value) => (
    <div style={{ background: HG.surface, border: `1px solid ${HG.border}`, borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 26, height: 26, borderRadius: 999, background: HG.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, stroke: '#fff', strokeWidth: 3, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d="M5 12l5 5L19 7"/></svg>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15.5, fontWeight: 800, color: HG.ink }}>{title}</div>
        {sub && <div style={{ fontSize: 12, fontWeight: 600, color: HG.muted, marginTop: 1 }}>{sub}</div>}
      </div>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: HG.purple }}>Edit</span>
    </div>
  );
  const days = [['Mon', 1], ['Tue', 1], ['Wed', 1], ['Thu', 0], ['Fri', 1], ['Sat', 1], ['Sun', 1]];
  return (
    <OnbScaffold cta="Continue" back>
      <StepHeader step={3} title="Training profile" />
      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 9 }}>
        {row('Advanced', '3+ years of serious training')}
        {row('6+ days / week')}
        {row('Male', 'Male-focused programs')}
      </div>

      {/* calm, factual plan preview */}
      <div style={{ marginTop: 14, background: HG.surface, border: `1px solid ${HG.border}`, borderRadius: 16, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: HG.muted, marginBottom: 12 }}>YOUR WEEK</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
          {days.map(([d, on], i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 30, height: 30, borderRadius: 999, background: on ? HG.purpleLight : HG.surfaceSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {on ? <OnbIcon name="dumbbell" color={HG.purple} size={15} /> : <OnbIcon name="clock" color={HG.faint} size={14} />}
              </div>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: HG.faint }}>{d}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', marginTop: 16, paddingTop: 14, borderTop: `1px solid ${HG.surfaceSoft}` }}>
          {[['Per week', '6 days'], ['Session', '60–75 min'], ['Level', 'Advanced']].map(([l, v], i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: HG.ink }}>{v}</div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: HG.muted, marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </OnbScaffold>
  );
}

// Image-diagram placeholders kept (real body renders drop in here).
function BodyTile({ name, selected }) {
  return (
    <div style={{
      borderRadius: 14, overflow: 'hidden', position: 'relative', aspectRatio: '1 / 1',
      border: selected ? `2px solid ${HG.purple}` : `1px solid ${HG.border}`,
      background: `repeating-linear-gradient(135deg, ${HG.surfaceSoft} 0 8px, #EBE3FA 8px 16px)`,
    }}>
      {/* simple body-silhouette placeholder (basic shapes only) */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
        <svg viewBox="0 0 40 48" style={{ width: 34, height: 40, fill: HG.purple, opacity: 0.55 }}>
          <circle cx="20" cy="8" r="5"/>
          <rect x="11" y="15" width="18" height="20" rx="6"/>
        </svg>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '8px 10px', background: 'linear-gradient(to top, rgba(247,243,255,0.95), rgba(247,243,255,0))', fontSize: 13, fontWeight: 800, color: HG.ink }}>{name}</div>
      <div style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 999, border: `2px solid ${selected ? HG.purple : HG.border}`, background: selected ? HG.purple : 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {selected && <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, stroke: '#fff', strokeWidth: 3.2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d="M5 12l5 5L19 7"/></svg>}
      </div>
    </div>
  );
}

function OnbFocus() {
  const groups = ['Chest', 'Back', 'Shoulders', 'Arms', 'Abs', 'Quads', 'Glutes', 'Hamstrings', 'Calves'];
  const sel = ['Chest', 'Arms'];
  return (
    <OnbScaffold cta="Continue" back>
      <StepHeader step={4} title="What to focus on?" />
      <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 9 }}>
        {groups.map((g) => <BodyTile key={g} name={g} selected={sel.includes(g)} />)}
      </div>
      <div style={{ marginTop: 14, background: HG.surface, border: `1px solid ${HG.border}`, borderRadius: 14, padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: HG.purpleLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <OnbIcon name="trend" color={HG.purple} size={17} />
        </div>
        <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: HG.muted, lineHeight: 1.35 }}>We prioritise these in your program.</div>
        <Chip label="Pick 1–2" color={HG.purpleDark} bg={HG.purpleLight} />
      </div>
    </OnbScaffold>
  );
}

function OnbGoal() {
  return (
    <OnbScaffold cta="Continue" back>
      <StepHeader step={5} title="What's your goal?" />
      <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <OptionCard icon={<OnbIcon name="up" color="#fff" />} title="Gain muscle" sub="Build size and get stronger" selected />
        <OptionCard icon={<OnbIcon name="minus" color={HG.purple} />} title="Maintain" sub="Stay at your current weight" />
        <OptionCard icon={<OnbIcon name="down" color={HG.purple} />} title="Lean down" sub="Lose fat and get leaner" />
      </div>
    </OnbScaffold>
  );
}

Object.assign(window, { OnbProfile, OnbFocus, OnbGoal });
