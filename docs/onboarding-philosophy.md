# GAINER — Onboarding Philosophy

**Type:** Philosophy — design intent only, no implementation values
**Status:** Design reference. Not an implementation spec.
**Related:** `gainer-philosophy.md`, `coaching-intelligence-design.md`, `ai-trust-system.md`

---

## The Purpose of Onboarding

Onboarding has one primary job: get the user to their first training session with enough confidence that they come back for a second.

It is not a data collection exercise. It is not a feature tour. It is not a commitment ceremony. It is the first moment a new user decides whether GAINER is worth their time — and that decision is made mostly by feel, not by feature completeness.

The secondary job is to collect the minimum information needed to make the first recommendation genuinely useful. Not comprehensive. Useful.

Everything else onboarding might try to achieve — thorough profiling, preference calibration, notification setup, social connection — is a distraction from these two jobs and should be deferred.

---

## What Onboarding Should Achieve Psychologically

By the time onboarding ends, the user should feel three things:

**Understood.** The app received what they told it and responded in a way that reflects it. If they said they train three days a week and are intermediate level, the program they see should clearly match that. Understanding is demonstrated through response, not through confirmation messages.

**Capable.** They know what to do next. Not "explore the app" or "set up your profile" — they know what their first session is. The onboarding should terminate at a clear starting point, not an open-ended home screen.

**Respected.** The process was brief. It did not waste their time with questions that have no visible effect, features they did not ask about, or upsells they did not expect. A user who finishes onboarding feeling that it was efficient has been told something important about the product.

What the user should not feel:
- Interrogated (too many questions)
- Uncertain (unclear what the app will do with their answers)
- Overwhelmed (too many choices, too much information)
- Suspicious (data collected with no visible purpose)
- Tired (cognitive load that should have been spread over time)

---

## What Data Is Actually Valuable

Valuable onboarding data is data that immediately improves the quality of the first recommendation. The test is simple: if removing this data point would make the recommendation worse, it belongs in onboarding. If removing it would make no difference to the user's first four weeks, it does not.

**Immediately valuable:**

| Data | Why it belongs in onboarding |
|---|---|
| Primary goal | Determines program category (strength, muscle, general) |
| Experience level | Determines program complexity and progression expectations |
| Equipment access | Filters programs to only viable options |
| Days per week available | Matches program frequency to reality |
| Focus areas (optional) | Refines recommendation within the matched category |

**Valuable but deferrable:**
- Joint sensitivity preferences (ask when the user first substitutes an exercise)
- Preferred training days (inferred from usage patterns within 2 weeks)
- Coaching style preference (inferred from how the user responds to early coaching)
- Current bodyweight (useful for progression context, but not needed before session one)

**Not valuable in onboarding:**
- Everything else.

The list of deferrable and not-valuable data is much longer than the list of immediately valuable data. This is intentional. The bias must be toward collecting less, not more.

---

## What Questions Are Unnecessary Friction

Any question where the answer cannot be used to improve the user's experience in the first four weeks is unnecessary friction. Examples:

**Questions to eliminate:**
- "How many hours of sleep do you get per night?" — not actionable in the current system
- "What is your stress level?" — creates anxiety, no current use
- "What is your height?" — not used in program recommendation
- "What is your exact date of birth?" — age range is sufficient where relevant
- "Do you have any injuries?" — the correct substitute is asking about joint sensitivity when it becomes relevant, not collecting injury history upfront
- "What is your body fat percentage?" — most users don't know; those who do get no benefit from sharing it here
- "How motivated are you to train? (1–10)" — creates performance anxiety, produces no signal
- "What is your nutrition approach?" — outside GAINER's scope
- "Do you want to share your progress with friends?" — social features may not exist; asking pre-emptively implies they do
- "Would you like to enable notifications?" — ask after the user has seen value, not before

**Why these questions hurt:**

Beyond the friction cost, irrelevant questions communicate something damaging: the app does not know which of its own questions matter. When a user answers a question and then sees no visible effect of that answer, they conclude — correctly — that the product is not paying attention to what they said. Trust erodes before the first session is logged.

---

## How Onboarding Affects AI Personalization

Onboarding data seeds the `UserFitnessProfile`. This profile is the prior the AI uses until observed behavioral data becomes sufficient to refine or override it.

Onboarding data is most important in weeks one through eight. After that, behavioral signals — training time patterns, exercise completion rates, progression outcomes, adherence — begin to carry more weight than stated preferences.

The implications for onboarding design:

**Onboarding data shapes weeks 1–8.** It must be accurate enough to make the first program recommendation appropriate. If it is not, the user may start on the wrong program and churn before the behavioral data accumulates.

**Onboarding data is a starting point, not a permanent label.** The system should be designed to revise its understanding as behavior emerges. A user who said "intermediate" but trains like a beginner should drift toward beginner recommendations within four weeks.

**Stated preferences are hypotheses.** The user's stated preference for "challenging" training feel is a hypothesis about themselves. Their actual session completion rates will confirm or contradict it. The AI should treat onboarding answers as priors, not facts.

**Missing onboarding data is handled by conservative defaults.** If a user skips a question, the system uses the safest assumption (shorter sessions, lower volume, more general program) rather than failing to recommend. The user can always refine later.

---

## How Onboarding Builds Trust

Onboarding is the first opportunity to demonstrate that GAINER is different from other fitness apps. That demonstration happens through action, not messaging.

**Show the effect of each answer.** When the user selects "full gym," the programs shown should visibly differ from what they would see with "home." When they select "beginner," the complexity of the recommendation should be clearly appropriate for that level. The user sees that their answers mattered.

**Recommend something specific, not a category.** Ending onboarding with "here are your programs" is generic. Ending with "based on what you told us, this is the best starting point for you — here's why" is specific. Specificity builds trust.

**Do not collect what you cannot immediately use.** If a user provides data and then sees that it had no effect, trust is broken. The solution is not to fake the effect — it is to not collect the data until the system can genuinely use it.

**Do not upsell before value.** Presenting a premium paywall during or immediately after onboarding communicates that the product's primary goal is revenue, not the user's training. Show the product works first. The conversion opportunity follows from demonstrated value.

---

## Progressive Profiling Philosophy

Not all profile data should be collected at the same time. Progressive profiling is the practice of collecting additional information at the moment it becomes relevant, rather than upfront.

**Day 1 (onboarding):** Goal, level, equipment, frequency. Enough to recommend a program.

**Week 1 (post-first-session):** Nothing mandatory. Optionally offer to refine based on how the first session felt.

**When relevant (contextual):** Joint sensitivity flags, asked the first time a user attempts to substitute an exercise. Preferred training days, offered after two weeks of inferred pattern. Coaching intensity preference, surfaced after the first AI insight is delivered.

**Month 2 (review):** A lightweight profile check — "does your program still match what you want?" — as part of a natural check-in, not a mandatory screen.

**Always available (settings):** Any preference can be updated at any time. Progressive profiling does not mean the user is locked out of refining their profile — it means they are not required to complete it before starting.

The progressive model respects two facts: users cannot answer questions accurately about a product they have not yet used, and users are more willing to provide information once they have seen that the product uses it well.

---

## How Onboarding Should Feel Emotionally

**Not a form.** Forms create the feeling of bureaucracy. Onboarding should feel like a focused conversation with someone who knows fitness and knows what they need to ask.

**Not a tutorial.** Feature tours and UI overlays communicate that the product is complex. GAINER's onboarding should not explain the app — it should put the user in the app.

**Not a quiz.** Questions should not feel like tests with right and wrong answers. The user is not being assessed. They are being heard.

**Confident and brief.** Each screen should feel purposeful. The user should never wonder "why are they asking me this?" The consequence of each question should be visible.

**Warm but not gushing.** "Welcome to GAINER" is sufficient. "Welcome to the journey of a lifetime where you will transform yourself and unlock your true potential!" is not. The tone of onboarding sets expectations for the product's voice. Set the right expectations.

---

## How to Avoid Generic Fitness-App Onboarding

Generic fitness app onboarding has recognizable patterns. GAINER avoids each of them.

**Generic pattern: Collect everything upfront.**
Every metric, preference, and goal is captured in a 10-screen questionnaire before the user sees the product. The completion rate of this questionnaire is the first failure signal of the product.

**GAINER alternative:** Five decisions maximum in core onboarding. Everything else is progressive.

---

**Generic pattern: The motivation screen.**
"How committed are you?" or "Set your intention for this journey." These screens collect no useful data and create performance anxiety. Users who answer "low commitment" get no different experience than users who answer "high commitment."

**GAINER alternative:** Do not ask about motivation. Motivation is a behavior, not a declaration. The system observes it through adherence signals.

---

**Generic pattern: The feature tour.**
A swipeable introduction to every app section, complete with animation and copy explaining what each tab does. Users skip these immediately. They have never been demonstrated to improve retention.

**GAINER alternative:** No feature tour. Put the user in the app. The first session teaches the product better than any walkthrough.

---

**Generic pattern: Asking for permissions and notifications immediately.**
Notification permission dialogs presented before the user has seen any value are declined by the majority of users. Once declined, they are extremely difficult to recover.

**GAINER alternative:** Ask for notification permission after the user has completed their first session and seen a genuine coaching insight. The value of the notification is now demonstrated. For the full notification rule system — tiers, timing, interruption rules, and what qualifies as a Tier 1 event — see `ai-trust-system.md` §5.

---

**Generic pattern: The social setup screen.**
"Connect with friends," "find people you know," or "share your goals publicly." These screens signal that the app is a social network wearing a fitness app costume.

**GAINER alternative:** No social setup in onboarding. Social features, if they exist, are discovered through use, not mandated in the initial flow.

---

## What the User Should Feel After Onboarding

Specific to GAINER, by the end of onboarding the user should be able to think each of the following:

- "I know what I'm going to do in my first session."
- "The program it recommended makes sense for me."
- "That was quick — I appreciate that."
- "It seems like this is actually going to adapt to how I train."

They should not be able to think:
- "That was a lot of questions — I hope I answered them right."
- "I'm not sure what this app does differently from the others I've tried."
- "I haven't started training yet and I'm already tired."
- "It asked me things it clearly doesn't use."

---

## What the AI Should Already Understand After Onboarding

By the end of onboarding, `buildUserFitnessProfile()` should return a `UserFitnessProfile` containing:

- The user's primary training goal
- Their estimated experience level
- Their equipment context
- How many days per week they can train
- Their focus area preferences (if selected)
- Joint sensitivity flags (if set — typically not in MVP onboarding)
- Their training feel preference (intensity level)
- Their unit preference

With this profile, the AI can:
- Recommend an appropriate program from the catalog
- Set correct progression expectations (slower for beginners, faster for intermediate)
- Filter exercise substitutions by equipment
- Configure initial volume recommendations
- Apply joint sensitivity filters to exercise selection

The AI cannot yet do anything that requires behavioral data: predict deload timing, identify plateau patterns, recognize individual recovery speed, or understand training time preferences. That intelligence accumulates through sessions. Onboarding does not need to collect the inputs for it.

---

## Onboarding Principles

**1. Five decisions maximum.**
Core onboarding should require no more than five meaningful choices. If a sixth is genuinely necessary, one of the first five is probably asking for something that could be inferred or deferred.

**2. Every question has a visible consequence.**
The user should see or understand how their answer affects what they experience. If the consequence is invisible, the question should be removed.

**3. Defaults are correct for most users.**
No question should require the user to think hard to answer correctly. Default selections should work for the majority of users. The goal is to let users who need a different answer change it — not to force every user to actively configure.

**4. Skipping is always allowed.**
Any question can be skipped. Skipped questions produce conservative defaults. The system never blocks progress because a question was not answered.

**5. Nothing collected before it is used.**
If a data point will not affect the user's experience in the first 30 days, it does not belong in onboarding.

**6. Onboarding ends at training, not at a home screen.**
The final step of onboarding is the first program or session — not a dashboard to explore. The user should arrive at an action, not an interface.

**7. Trust is demonstrated, not declared.**
Do not write copy explaining how the app will personalize to the user. Show it by making the recommendation visibly match what they said.

---

## Anti-Friction Rules

- No open text fields in core onboarding flow
- No more than one selection per screen
- No screens that require reading more than two sentences to understand
- No back-navigation that requires re-answering previous questions
- No mandatory email or account creation before the user has seen the product work
- No payment prompt before value has been demonstrated
- No "tell us more about yourself" profile completion nudge within the first week
- No loading states between simple selection screens

---

## Anti-Bloat Rules

- Do not ask about features that do not yet exist
- Do not collect nutrition, sleep, or stress data
- Do not ask for exact age when age range is sufficient
- Do not ask for body composition metrics before they are used in recommendations
- Do not create a "profile completeness" percentage — it implies the profile is incomplete, which implies the user has not done enough
- Do not ask for social connections during onboarding
- Do not ask permission to send notifications before the first session is complete

---

## MVP Onboarding Priorities

The absolute minimum onboarding that produces a useful first recommendation:

1. **What's your main training goal?** → seeds primaryGoal
2. **What's your experience level?** → seeds level
3. **Where do you train?** → seeds equipment and trainingEnvironment
4. **How many days per week can you train?** → seeds daysPerWeek
5. **→ Program recommendation, with brief explanation of why it was selected**

Optional fifth step before recommendation:
- **Any areas you want to focus on?** → seeds focusAreas (multi-select, skippable)

This is enough. A user who answers these five questions arrives at a recommended program that is meaningfully matched to their situation. That is the job of onboarding.

Everything else — training feel preference, joint sensitivity, weekly minutes, modality preferences — is collected through progressive profiling as the context arises.

---

## What Should NOT Be Asked During Onboarding

The following are explicitly excluded from onboarding, regardless of their eventual value to the system:

| Question | Why excluded |
|---|---|
| "How many hours of sleep do you get?" | Not actionable in current system |
| "What is your current stress level?" | Creates anxiety, no current use |
| "What is your exact height and weight?" | Not needed for program recommendation; bodyweight is progressive |
| "Do you have any injuries?" | Joint sensitivity flags are a better, lower-friction proxy |
| "What is your body fat percentage?" | Most users don't know; not used in MVP recommendations |
| "How motivated are you to change?" | Not a useful signal; creates performance anxiety |
| "What is your nutrition approach?" | Outside GAINER's scope |
| "Would you like to connect with friends?" | Social layer does not exist |
| "What are your preferred training days?" | Inferred from usage within two weeks |
| "How long do you want your sessions to be?" | Estimable from daysPerWeek and goal; refinable later |
| "What is your personality type?" | Not actionable |
| "Do you want to enable notifications?" | Ask after first coaching insight is delivered |
| "How did you hear about us?" | Marketing data, not coaching data; use a separate attribution flow |

---

## Summary

GAINER's onboarding succeeds when the user finishes it thinking "I know what to do, and this app understood what I need." It fails when they finish thinking "that took a while" or "I wonder if I answered that right."

The way to achieve the first outcome is the same way GAINER achieves trust everywhere else in the product: restraint. Ask less. Use what you ask. Show the consequence. Let the rest accumulate through use.

Onboarding is not the place to demonstrate comprehensiveness. It is the place to demonstrate that GAINER respects the user's time and knows what actually matters.
