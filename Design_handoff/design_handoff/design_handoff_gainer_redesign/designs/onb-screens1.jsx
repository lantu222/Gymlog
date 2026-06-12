/* Onboarding screens 1–3: Welcome, Step 1 (train), Step 2 (want most) */

function OnbWelcome() {
  const feature = (icon, title, sub) => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8 }}>
      <div style={{ width: 52, height: 52, borderRadius: 999, border: `1.5px solid ${HG.border}`, background: HG.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: HG.purpleDark, textTransform: 'uppercase', lineHeight: 1.3 }}>{title}</div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: HG.muted, lineHeight: 1.35 }}>{sub}</div>
    </div>
  );
  return (
    <OnbPhone>
      <div style={{ flex: 1, padding: '0 24px 22px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <Logo size={52} />
          <div style={{ fontSize: 18, fontWeight: 700, color: HG.muted, textAlign: 'center', lineHeight: 1.4 }}>You go to the gym.<br/>We handle the rest.</div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          {feature(<OnbIcon name="dumbbell" color={HG.purple} size={22} />, 'AI-built plans', 'Smart programs built for you.')}
          {feature(<OnbIcon name="trend" color={HG.purple} size={22} />, 'Adaptive', 'We adjust as you improve.')}
          {feature(<OnbIcon name="heart" color={HG.purple} size={22} />, 'Recovery aware', 'Optimized training & rest.')}
        </div>
        <CTA label="Start free" />
        <div style={{ textAlign: 'center', fontSize: 14.5, fontWeight: 700, color: HG.muted, marginTop: 16 }}>I already have an account</div>
      </div>
    </OnbPhone>
  );
}

function OnbTrain() {
  return (
    <OnbScaffold cta="Continue" back>
      <StepHeader step={1} title="Where do you train?" />
      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 11 }}>
        <OptionCard
          icon={<OnbIcon name="dumbbell" color="#fff" />}
          title="Full Gym" tag="Most flexible" sub="Machines, barbells and dumbbells." selected
          why={['Adaptive plan', 'Most exercise variety', 'Weekly rhythm', 'Recovery aware']}
        />
        <OptionCard icon={<OnbIcon name="home" color={HG.purple} />} title="Home Gym" sub="Train at home with your own equipment." />
        <OptionCard icon={<OnbIcon name="run" color={HG.purple} />} title="Minimal Equipment" tag="Efficient" tagColor={HG.green} tagBg={HG.greenSoft} sub="Bands, dumbbells or a bench." />
        <OptionCard icon={<OnbIcon name="body" color={HG.purple} />} title="Bodyweight Only" tag="Beginner" tagColor={HG.blue} tagBg="#E1ECFB" sub="No equipment. Train anywhere." />
      </div>
    </OnbScaffold>
  );
}

function OnbWant() {
  return (
    <OnbScaffold cta="Continue" back>
      <StepHeader step={2} title="What do you want most?" />
      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 11 }}>
        <OptionCard icon={<OnbIcon name="dumbbell" color={HG.purple} />} title="Get stronger" sub="Heavy lifts and progressive strength." chips={['Lower reps', 'Longer rest', 'Strength']} />
        <OptionCard
          icon={<OnbIcon name="trend" color="#fff" />}
          title="Build muscle" sub="Higher volume to build size and definition." selected
          why={['Higher volume training', 'Progressive overload', 'Muscle-focused split']}
        />
        <OptionCard icon={<OnbIcon name="run" color={HG.purple} />} title="Lean & athletic" sub="Build strength while staying lean." chips={['Hybrid', 'Conditioning']} />
        <OptionCard icon={<OnbIcon name="heart" color={HG.purple} />} title="General fitness" sub="Balanced training for overall health." chips={['Sustainable', 'Flexible']} />
      </div>
    </OnbScaffold>
  );
}

Object.assign(window, { OnbWelcome, OnbTrain, OnbWant });
