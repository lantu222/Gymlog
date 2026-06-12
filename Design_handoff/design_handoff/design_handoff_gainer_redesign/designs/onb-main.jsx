/* GAINER Onboarding — refined flow on a canvas, in reading order. */

function App() {
  const board = (id, label, sub, Comp) => (
    <DCArtboard id={id} label={label} width={ONB_W + 24} height={ONB_H + 52}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingTop: 8 }}>
        <Comp />
        <div style={{ width: ONB_W, fontFamily: '"Manrope", system-ui, sans-serif', textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6B6580', lineHeight: 1.4 }}>{sub}</div>
        </div>
      </div>
    </DCArtboard>
  );
  return (
    <DesignCanvas>
      <DCSection id="onb" title="GAINER · Onboarding, refined" subtitle="Same flow you liked — light Home theme, no reward screens, no orb, name moved to sign-in. Read left → right.">
        {board('s1', '01 · Welcome', 'Light theme. Wordmark, promise, 3 quiet feature pills, one CTA.', OnbWelcome)}
        {board('s2', '02 · Where do you train?', 'Selecting a card expands “why it’s great” inline — replaces the old reward screen. No interstitial.', OnbTrain)}
        {board('s3', '03 · What do you want most?', 'Same inline-confirmation pattern. No “Great choice!” screen, no orb.', OnbWant)}
        {board('s4', '04 · Training profile', 'Experience + days + sex, then a calm, factual week preview — no “AI 60% FIT” gauge.', OnbProfile)}
        {board('s5', '05 · Focus areas', 'Image diagrams kept (placeholders here). Pick 1–2.', OnbFocus)}
        {board('s6', '06 · Goal', 'Gain / Maintain / Lean down.', OnbGoal)}
        {board('s7', '07 · Goal weight', 'Current + target weight steppers.', OnbWeight)}
        {board('s8', '08 · Building your plan', 'Calm loader — no orb, no mascot, no hype. Just honest steps.', OnbBuilding)}
        {board('s9', '09 · Plan ready · overview', 'The 4-week structure with real stats. Rebuilt cleanly.', OnbPlanOverview)}
        {board('s10', '10 · Plan ready · day 1', 'The detailed day view that was broken — day tabs, full exercise list, one CTA.', OnbPlanDay)}
        {board('s11', '11 · Save your plan', 'Identity comes from Google sign-in HERE — never mid-questionnaire. Name flows from the account.', OnbAccount)}
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
