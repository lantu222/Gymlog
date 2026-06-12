/* Onboarding screens 7–11: weight+timeline, building (calm, no orb),
   plan overview, plan day detail, account (Google → name). */

function OnbWeight() {
  const stepper = (label, sub, value, unit) => (
    <div>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: HG.muted, textTransform: 'uppercase' }}>{label}</div>
      {sub && <div style={{ fontSize: 12.5, fontWeight: 600, color: HG.faint, marginTop: 3 }}>{sub}</div>}
      <div style={{ marginTop: 10, background: HG.surface, border: `1px solid ${HG.border}`, borderRadius: 16, padding: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 46, height: 46, borderRadius: 13, background: HG.purpleLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, color: HG.purpleDark }}>−</div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontSize: 30, fontWeight: 800, color: HG.ink }}>{value}</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: HG.muted }}> {unit}</span>
        </div>
        <div style={{ width: 46, height: 46, borderRadius: 13, background: HG.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: '#fff' }}>+</div>
      </div>
    </div>
  );
  return (
    <OnbScaffold cta="Continue" back>
      <StepHeader step={5} title="Set a goal weight" />
        <div style={{ marginTop: 18, background: HG.purpleLight, borderRadius: 14, padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 24, height: 24, borderRadius: 999, background: HG.purple, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: '#fff', strokeWidth: 3, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d="M5 12l5 5L19 7"/></svg>
          </div>
          <span style={{ flex: 1, fontSize: 14.5, fontWeight: 800, color: HG.purpleDark }}>Goal: Gain muscle</span>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: HG.purple }}>Edit</span>
        </div>
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {stepper('Current weight', null, '70.0', 'kg')}
          {stepper('Goal weight', 'Only if you have a target in mind.', '78.0', 'kg')}
        </div>
    </OnbScaffold>
  );
}

// Calm builder — no glowing orb, no mascot, no hype.
function OnbBuilding() {
  const steps = [
    ['Analyzing your inputs', 'Reading your setup and goals', 'active'],
    ['Building your split', '', 'pending'],
    ['Matching exercises', '', 'pending'],
    ['Finalizing your plan', '', 'pending'],
  ];
  return (
    <OnbPhone>
      <div style={{ flex: 1, padding: '0 26px 26px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ marginBottom: 30 }}>
          <Logo size={30} />
          <div style={{ fontSize: 26, fontWeight: 800, color: HG.ink, letterSpacing: '-0.02em', marginTop: 18 }}>Building your plan</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: HG.muted, marginTop: 6 }}>This takes a few seconds.</div>
          <div style={{ marginTop: 18, height: 6, borderRadius: 999, background: '#E6DEF6', overflow: 'hidden' }}>
            <div style={{ width: '32%', height: '100%', background: HG.purple, borderRadius: 999 }}></div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {steps.map(([t, s, state], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, opacity: state === 'pending' ? 0.45 : 1 }}>
              <div style={{ width: 26, height: 26, borderRadius: 999, border: `2px solid ${state === 'pending' ? HG.border : HG.purple}`, background: state === 'active' ? HG.purple : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {state === 'active' && <div style={{ width: 8, height: 8, borderRadius: 999, background: '#fff' }}></div>}
              </div>
              <div>
                <div style={{ fontSize: 15.5, fontWeight: 800, color: HG.ink }}>{t}</div>
                {s && <div style={{ fontSize: 12.5, fontWeight: 600, color: HG.muted, marginTop: 1 }}>{s}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </OnbPhone>
  );
}

function OnbPlanOverview() {
  const weeks = [
    ['Week 1', 'Find your baseline'],
    ['Week 2', 'Build the rhythm'],
    ['Week 3', 'Push your best work'],
    ['Week 4', 'Review and recover'],
  ];
  return (
    <OnbScaffold cta="See day 1">
      <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '0.14em', color: HG.purple }}>YOUR PLAN IS READY</div>
        <div style={{ fontSize: 27, fontWeight: 800, color: HG.ink, letterSpacing: '-0.02em', marginTop: 6 }}>4-Week Progress Plan</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: HG.muted, marginTop: 6 }}>Build muscle · Full gym · Advanced · 6 days / week</div>

        {/* program cover (brand hero) */}
        <div style={{ marginTop: 16, borderRadius: 20, padding: '20px 20px', background: `linear-gradient(135deg, ${HG.purpleDark}, ${HG.purple})`, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -50, right: -30, width: 160, height: 160, borderRadius: 999, background: 'rgba(255,255,255,0.10)' }}></div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.8)' }}>BUILD · FOCUS · PROGRESS</div>
          <div style={{ display: 'flex', gap: 18, marginTop: 14 }}>
            {[['24', 'Workouts'], ['4', 'Weeks'], ['6', 'Per week']].map(([v, l], i) => (
              <div key={i}>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#fff' }}>{v}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.78)', marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 9 }}>
          {weeks.map(([w, d], i) => (
            <div key={i} style={{ background: HG.surface, border: `1px solid ${HG.border}`, borderRadius: 14, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 13 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: HG.purpleLight, color: HG.purpleDark, fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: HG.ink }}>{w}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: HG.muted, marginTop: 1 }}>{d}</div>
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: HG.muted }}>6 workouts</span>
            </div>
          ))}
        </div>
    </OnbScaffold>
  );
}

function OnbPlanDay() {
  const tabs = [['A', 'Upper'], ['B', 'Lower'], ['C', 'Full'], ['D', 'Upper'], ['E', 'Lower'], ['F', 'Full']];
  const ex = [
    ['01', 'Bench Press', 'Chest', '4 sets', '6–8 reps'],
    ['02', 'Overhead Press', 'Shoulders', '4 sets', '6–8 reps'],
    ['03', 'Incline DB Press', 'Chest', '3 sets', '8–10 reps'],
    ['04', 'Lateral Raise', 'Shoulders', '3 sets', '12–15 reps'],
    ['05', 'Triceps Pushdown', 'Triceps', '3 sets', '10–12 reps'],
  ];
  return (
    <OnbScaffold cta="Save plan & start" back>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '0.12em', color: HG.purple }}>DAY 1 OF 6</div>
            <div style={{ fontSize: 25, fontWeight: 800, color: HG.ink, letterSpacing: '-0.01em', marginTop: 4 }}>Upper Focus</div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 800, color: HG.purpleDark, background: HG.purpleLight, padding: '7px 11px', borderRadius: 999 }}>Week 1 of 4</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8, fontSize: 13, fontWeight: 700, color: HG.muted }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><OnbIcon name="clock" color={HG.muted} size={15} /> ~55 min</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><OnbIcon name="trend" color={HG.muted} size={15} /> Advanced</span>
        </div>

        {/* day tabs */}
        <div style={{ display: 'flex', gap: 7, marginTop: 16 }}>
          {tabs.map(([a, l], i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 12, background: i === 0 ? HG.purple : HG.surface, border: i === 0 ? 'none' : `1px solid ${HG.border}` }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: i === 0 ? '#fff' : HG.ink }}>{a}</div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: i === 0 ? 'rgba(255,255,255,0.85)' : HG.muted, marginTop: 1 }}>{l}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: HG.muted, marginTop: 18, marginBottom: 10 }}>5 EXERCISES</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ex.map(([n, name, grp, sets, reps], i) => (
            <div key={i} style={{ background: HG.surface, border: `1px solid ${HG.border}`, borderRadius: 14, padding: '12px 15px', display: 'flex', alignItems: 'center', gap: 13 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: HG.purple, width: 20 }}>{n}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: HG.ink }}>{name}</div>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: HG.muted, textTransform: 'uppercase', marginTop: 2 }}>{grp}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: HG.ink }}>{sets}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: HG.muted, marginTop: 1 }}>{reps}</div>
              </div>
            </div>
          ))}
        </div>
    </OnbScaffold>
  );
}

// Identity comes from sign-in (Google) at the very end — never mid-questionnaire.
function OnbAccount() {
  const provider = (label, mark, primary) => (
    <div style={{
      height: 54, borderRadius: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11,
      background: primary ? HG.surface : 'transparent',
      border: `1.5px solid ${primary ? HG.border : HG.border}`,
      fontSize: 15.5, fontWeight: 800, color: HG.ink,
    }}>{mark}{label}</div>
  );
  const gMark = (
    <div style={{ width: 22, height: 22, borderRadius: 999, background: '#fff', border: `1px solid ${HG.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: HG.purple }}>G</div>
  );
  return (
    <OnbPhone>
      <div style={{ flex: 1, padding: '0 24px 26px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Logo size={30} />
          <div style={{ fontSize: 27, fontWeight: 800, color: HG.ink, letterSpacing: '-0.02em', marginTop: 20, lineHeight: 1.15 }}>Save your plan</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: HG.muted, marginTop: 8, lineHeight: 1.45 }}>Create your account so your plan and progress are always here. We'll use your name from your account.</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {provider('Continue with Google', gMark, true)}
          {provider('Continue with Apple', <span style={{ fontSize: 18 }}></span>, false)}
          <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: HG.muted, marginTop: 6 }}>Use email instead</div>
        </div>
      </div>
    </OnbPhone>
  );
}

Object.assign(window, { OnbWeight, OnbBuilding, OnbPlanOverview, OnbPlanDay, OnbAccount });
