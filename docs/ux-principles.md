# GAINER — UX Principles

**Type:** Philosophy — design intent only, no implementation values
**Status:** Design reference. Not an implementation spec.
**Related:** `gainer-philosophy.md`, `ai-trust-system.md`, `retention-philosophy.md`

---

## What the UX Should Feel Like

GAINER should feel like a well-made tool used by someone who knows what they want.

Not impressive. Not feature-rich. Not designed to show off what it can do. Designed to serve the user's training with the smallest possible amount of friction and visual noise. The product should feel like it trusts the user to know why they opened it. It does not try to redirect them, upsell them, or entertain them. It helps them train, and then it gets out of the way.

The emotional register is calm, confident, and focused. A dark, uncluttered interface that communicates: your workout is the thing. The app is the support structure, not the experience.

Users should be able to describe the app's UX the way they describe a good piece of equipment — functional, reliable, nothing wasted. Not the way they describe entertainment software — engaging, surprising, rewarding.

---

## What the UX Should Never Feel Like

**Busy.** Competing calls to action, notification dots, badge counters, and promotional banners all fighting for attention simultaneously. The user came to train, not to manage a dashboard.

**Gamified.** Achievement overlays, confetti animations, XP bars, level-up screens. These mechanics belong to engagement-optimized apps that need manufactured reasons to return. GAINER's reason to return is training progress. The UX should not obscure that with theater.

**Anxious.** Streak countdowns, urgency framing, "you're falling behind" indicators. The UX must never make users feel pressured, guilty, or behind. Training is a practice, not a competition with the app.

**Social-network-adjacent.** Feeds, follower counts, comparison metrics, public profiles. These patterns signal that the primary activity is self-presentation, not training.

**Like it wants something from the user.** Every upgrade prompt, push notification request, rating prompt, and share button positioned in the workout flow is the app wanting something from the user. The correct moment for those interactions is after value has been delivered, not during the delivery.

---

## Workout-Flow-First Philosophy

The workout logging screen is used more frequently than any other surface in the app. It is used with one hand, in a gym environment with noise and distraction, often while holding equipment or mid-rest. It is the most important UX surface GAINER has.

Every other screen exists in service of this one.

**What the workout screen must be:**
- Usable with one thumb
- Fast enough to keep up with the training, not slow enough to interrupt it
- Minimal enough that nothing competes with the current exercise for attention
- Clear enough that the user never has to think about what to do next

**What the workout screen must not be:**
- A dashboard with ancillary information that requires parsing
- An opportunity to surface secondary features
- Dependent on network connectivity to function
- Slower than the pace of training

The hierarchy during a workout session is absolute: the current set is everything. The current exercise is context. Everything else is hidden unless actively sought.

---

## Calm vs Noisy UX

Calm UX has a clear hierarchy. One primary action per screen. Generous breathing room between elements. Motion that serves function — confirming a tap, indicating a state transition — rather than motion that performs. Information that appears when needed and disappears when it is not.

Noisy UX has everything present simultaneously. Multiple calls to action competing for the same tap. Visual rewards that play regardless of whether an achievement occurred. Indicators on elements that do not require attention. Animation as ambient decoration rather than functional feedback.

**The single-focus rule.** At any point in the application, there should be one thing the user is expected to do. The interface communicates what that thing is. Everything else is either hidden, de-emphasized, or absent. When users can identify immediately what they are expected to do, they experience the interface as calm. When they cannot, they experience it as overwhelming.

**Whitespace is not waste.** Blank space between elements is not a failure to fill the screen. It is visual priority assigned to the elements that remain. A screen with generous whitespace communicates confidence in the elements present. A screen without it communicates uncertainty — as if the designers were not sure which elements mattered, so they kept all of them.

---

## Information Density Philosophy

The correct information density varies by context. The same app can and should show more information in some surfaces and less in others — calibrated to what the user needs to accomplish in that moment.

**During a workout session:** minimum viable information. Current exercise name, current set number, target rep range, rest timer if active. Previous set weight and reps for reference. Nothing else unless explicitly sought.

**On the program/session selection screen:** enough to choose confidently. Program name, session structure summary, estimated duration. Not a wall of text describing every exercise.

**On the progress screen:** one primary trend per chart. Exercise history as a clean line over time, not a table of every logged set. Scannable at a glance, requiring no active analysis to understand the direction of travel.

**On the home screen:** what to do next. One recommendation, clearly stated. Supporting context at secondary visual weight. Nothing tertiary.

The underlying principle: show the information required to make the current decision. Do not show information for decisions the user is not currently making.

---

## Hierarchy Principles

Every screen has a primary element and a hierarchy below it. The primary element is the most visually prominent thing on the screen. It is the one action, piece of information, or decision that this screen exists to support. Everything else is subordinate.

**One primary action per screen.** The primary action is visually distinct from secondary actions. Secondary actions are present but de-emphasized — available if needed, not competing for attention. Tertiary actions live in menus or secondary screens, not the main surface.

**Visual weight communicates importance.** Large, high-contrast, centered elements communicate primacy. Small, lower-contrast, peripheral elements communicate secondary status. The visual hierarchy should match the task hierarchy exactly. If it does not, the interface is communicating incorrectly.

**Navigation should be predictable without instruction.** Users should never need to search for the back button, the save action, or the current screen's relationship to where they came from. Consistency in navigation patterns — same gesture, same position, same behavior — removes the cognitive overhead of re-learning structure on each new screen.

---

## Speed vs Complexity Balance

Speed is a UX feature. An interaction that requires three taps when one would do costs the user time and attention in every session, multiplied across every session they ever have. This cost is real even when small. In the context of a workout, where the user's attention should be on their training, the cost is higher than in a low-attention context.

Complexity should appear only where the underlying domain genuinely requires it. Strength programming is complex — it involves periodization, progression models, fatigue management, exercise selection. The complexity is in the domain. The UX's job is to expose that complexity only when the user needs to engage with it, and to hide it otherwise.

**The complexity budget.** Each screen has a limited amount of complexity the user can absorb while maintaining momentum. Spending the entire budget on navigation — figuring out where to go — leaves none for the actual content. Spending none of the budget on navigation — it is obvious — leaves the full budget for the content.

**Optimize for the common case.** Eighty percent of interactions with the workout screen will follow the same pattern: open exercise, enter weight, enter reps, confirm set, rest, repeat. This flow must be zero-friction. Edge cases — adding notes, substituting an exercise, adjusting rest time — should be accessible but not present by default.

---

## How AI Should Appear in the UX

The AI coaching layer has one primary appearance rule: it shows up where the user already is, never where it wants to take the user.

**In the post-session completion screen.** This is the correct place for a coaching insight. The user has finished training. They are in a moment of completion and reflection. A single, specific observation — if one has been earned — appears here. One line or two. Then the session is done.

**In the exercise substitution flow.** When a user chooses to swap an exercise, the AI's intelligence appears through the quality of the suggestions — better matched to movement pattern, equipment, and joint sensitivity than a random list. The AI is invisible here; its intelligence is felt through the result.

**In program recommendations.** The AI's understanding of the user's profile shapes which programs surface at the top and which are presented as less relevant. Again, invisible — the user experiences a recommendation that seems right, not an AI that is explaining itself.

**Nowhere else by default.** There is no AI tab. There is no chat interface. There is no AI widget on the home screen reminding the user that AI coaching is active. The AI exists in the background and surfaces through specific, contextual outputs — not through ambient presence.

**When the AI has no output, the UX reflects that accurately.** A post-session completion screen without an AI insight should look complete, not empty. The absence of a coaching message should feel like everything is fine, not like something failed to load.

---

## When AI Should Remain Invisible

The AI is invisible in every moment except the specific ones where a qualified insight exists and the correct surface is present.

This means the AI is invisible:
- During the workout session (always)
- At app open (always)
- On the home screen unless a session-completing trigger has fired and an insight has cleared the confidence threshold
- When the confidence threshold is not met (the most frequent case)
- When an insight was delivered after the previous session
- When nothing notable has occurred

The invisibility is not a limitation. It is the correct behavior. An AI that announces its presence constantly — through indicators, through widgets, through ambient reminders that it is watching — trains users to filter out that presence. An AI that is silent until it has something specific to say trains users to pay attention when it does.

---

## Minimalism Philosophy

GAINER's minimalism is functional, not aesthetic. It is not about visual style — it is about removing every element that does not serve the user's current task.

**Remove before you add.** Before adding a new UI element, the correct question is: what does this remove? If nothing is removed, complexity is accumulating without offset. Every addition should either replace something less useful or justify its presence with a task that could not previously be completed.

**The subtraction test.** For any element on screen, ask: if this were removed, what would the user be unable to do? If the answer is "nothing meaningful," the element should be removed. If the answer is clear and specific, the element has earned its place.

**Defaults do the heavy lifting.** Minimalism in UX requires excellent defaults. The user who accepts all defaults should have an experience that is correct for them. Options and customization exist for users who need them, but they do not surface to users who do not. A settings screen the user never visits means the defaults worked. This is a success, not a failure.

---

## Consistency Philosophy

Consistency reduces cognitive load. When the same gesture always does the same thing, when the same element always looks the same way, when the same pattern always appears in the same place, users stop noticing the interface. They simply do the thing they came to do.

Inconsistency forces users to re-learn. Each inconsistency is a small tax on attention. In aggregate, inconsistency makes an app feel unreliable — not in the technical sense, but in the experiential sense. Users who cannot predict how the interface will behave develop low-level anxiety about using it.

**Gestural consistency.** Swipe left always does the same kind of thing. Swipe down always does the same kind of thing. Long press always does the same kind of thing. These patterns should not vary by screen.

**Component consistency.** A button that looks a certain way in one screen looks that way on every screen. A card that behaves a certain way in one context behaves that way in every context. Components are not redesigned per-screen; they are used consistently.

**Language consistency.** "Session" and "workout" and "training" are not interchangeable labels — pick one for each concept and use it everywhere. Inconsistent terminology makes users uncertain whether they are looking at the same concept or different ones.

---

## Emotional Tone of the App

The app's emotional register is set in the first moment of each interaction and maintained throughout. GAINER's register is: focused, capable, clean.

**Focused:** The screen communicates what this moment is for. Not ten things. One thing. The interface's confidence in its own focus communicates capability — this product knows what it is and what it is not.

**Capable:** Interactions should feel solid. Taps feel responded to immediately. Transitions feel purposeful. Loading states feel fast or are hidden through optimistic UI. The product should behave like something that was made carefully.

**Clean:** Nothing extra. Dark background that recedes and lets content forward. Typography that is the primary design element. Color used to communicate state and hierarchy, not as decoration. Space between things.

**What the tone is not:**
- Enthusiastic or energetic (that belongs to the training, not the app)
- Serious or clinical (this is a tool for human progress, not software)
- Playful (playfulness in a workout tool interrupts the mindset of training)
- Anxious or urgent (urgency is the antithesis of calm focus)

---

## Progress Visualization Philosophy

Progress visualization is one of the most powerful retention mechanisms available in a fitness app — and one of the most commonly done wrong.

**Honest above all.** Progress charts show what happened. They do not smooth, extrapolate, or highlight only the positive trajectory. A user whose lifts declined for four weeks sees that decline. The app's job is to help them understand why (through the coaching layer) and what to do, not to present an optimistic version of their data.

**One primary metric per chart.** A chart with twelve overlaid lines showing every tracked variable simultaneously is not a progress visualization — it is a data dump. One line. One trend. One story. Additional metrics live in secondary views for users who seek them.

**Scannable without analysis.** A user should be able to look at their progress chart for three seconds and understand the direction of travel. Is this going up? Flat? Down? If the answer requires more than three seconds of interpretation, the visualization is too complex.

**Long range is more valuable than short range.** A chart showing three weeks of data shows noise. A chart showing six months shows signal. The default time range for progress visualization should be long enough to see genuine trends, not short enough to show only recent sessions.

**Progress belongs to the user.** Progress visualization is not a retention mechanic. It is not designed to make the user feel good or bad about their training. It is a clear, honest display of what their data shows. The emotional response to that data — pride, concern, curiosity — is the user's, not the app's to engineer.

---

## Notification UX Philosophy

> **Canonical source.** Notification rules — tiers, timing, interruption rules, opt-in model, and what events qualify for push delivery — are defined and owned by `ai-trust-system.md` §5. This section summarises the UX-relevant principles only; it does not redefine the notification system.

Notifications are the most visible point of contact between the app and the user's attention outside of active sessions. The UX implications:

**Content should be complete, not a tease.** "You have a new insight" requiring the user to open the app to find out what it is converts engagement but destroys trust. The notification should contain the insight itself.

**Settings should be simple.** Two or three categories with clear descriptions. Not twenty toggles. Complexity in notification settings predicts disabled notifications.

**The default is no notifications.** Users opt in to what they want. A user who opted in receives notifications with the context that they asked for them. A user who received them by default is more likely to disable everything. See `ai-trust-system.md` §5 for the full opt-in model, tier definitions, and timing rules.

---

## Anti-Clutter Principles

Clutter in an app is rarely added in one large decision. It accumulates incrementally — one feature here, one metric there, one promotional element, one indicator, one badge counter. Each addition seems justified in isolation. Together, they produce an interface that requires active management rather than simple use.

**The accretion problem.** Features are almost never removed. Teams add features to serve new use cases, and the existing features remain. Over time, the interface contains every decision ever made, including the ones that turned out to be wrong. Anti-clutter requires a deliberate commitment to removal, not just restraint in addition.

**Indicators have a cost even when accurate.** A badge counter on a tab is only valuable if the user needs to know that number at the moment they see it. If they do not need it at that moment, it is not neutral — it is a small tax on attention. Unread indicators, notification dots, and counters should only exist when the information they represent requires action.

**The dashboard problem.** Dashboards tend to grow. Each team that works on the product has a metric they want visible. The product manager wants engagement data visible to users. The AI team wants coaching status visible. The progress team wants recent activity visible. Without active curation, the dashboard becomes a report that takes more time to process than the training it summarizes.

**Ruthless prioritization of the primary view.** The home screen or first view the user sees should contain exactly what they need to begin their next training session. Nothing else. If it also shows yesterday's news, last week's metrics, promotional content, and a progress teaser, the primary task — beginning training — is buried.

---

## Anti-Gamification Principles

> **Canonical source.** The authoritative anti-gamification and anti-bloat prohibition list lives in `gainer-philosophy.md` (Anti-Bloat Principles section). This section applies those principles to UX decisions specifically but does not redefine the canonical list. When in doubt, defer to `gainer-philosophy.md`.

Gamification in fitness apps is a response to a real problem: training is hard and motivation is finite. The solution — making the app feel like a game — addresses the symptom while worsening the underlying condition. Users who train because of gamification are training for the game, not for themselves. When the gamification loses its novelty, the motivation disappears with it.

GAINER addresses the motivation problem differently: by making training itself more intelligent, more personalized, and more clearly progressive. When a user can see that their squat has gone from 60 kg to 95 kg over eight months, that progress is its own motivation. The app does not need to augment it with points.

**What is explicitly excluded from the UX:**
- XP, points, coins, or any abstract currency
- Achievement badges for actions that are not genuine achievements
- Levels, tiers, or ranks
- Leaderboards or competitive comparison metrics
- Progress bars that represent gamification rather than real progression (set completion is real; "profile completeness" is not)
- Confetti, badge-reveal animations, or visual reward sequences for routine actions

**What is acceptable in limited form:**
- Streak counts, if they measure genuine training consistency and are displayed neutrally without pressure
- Milestone acknowledgment, if the milestone is meaningful and the acknowledgment is specific and proportionate
- Personal record notation, because a PR is a genuine achievement that deserves recognition

The difference: acceptable gamification acknowledges real things. Excluded gamification manufactures the feeling of achievement when nothing real occurred.

---

## Why Most Fitness App UX Becomes Overwhelming

Most fitness app UX degrades over time through a predictable process. Understanding it defines what GAINER must actively prevent.

**Feature accretion without accountability.** Each product team ships features. No team is accountable for removing features that are no longer serving their purpose. The interface accumulates every decision ever made. Three years in, the app has a workout tracker, a social layer, a content feed, a nutrition section, a coaching dashboard, a challenges system, and a community forum — none of which talk to each other and all of which compete for the same screen space.

**No-one owns the whole screen.** Individual feature teams optimize for their section. The home screen team wants their widget prominent. The AI team wants their indicator visible. The social team wants their feed accessible. Without a single owner of the complete view who can say "no" to each team's request, the screen fills.

**Metrics without removal criteria.** Dashboard metrics are added because they seem interesting. They are rarely removed because removing a visible metric feels like an admission that it was not valuable. Over time, the progress screen contains metrics the user has never used alongside metrics they check every session — with no visual distinction between them.

**Engagement optimization that fights usability.** Metrics that reward time-in-app produce UX decisions that extend the time required to complete any given task. An app optimizing for engagement will add friction to the direct path to prevent the user from completing their task and leaving. This friction compounds.

**The "just one more thing" problem.** At each design review, small additions seem harmless. A notification dot here. A promotional banner there. A badge for a new feature. Individually, each passes. Together, they describe an interface that no longer feels intentional.

---

## Good vs Bad UX Examples

### Workout screen during an active session

**Good:**
Current exercise name, large. Current set number and target reps. Last session's weight and reps for this exercise as quiet reference. Rest timer if resting. One tap to log a completed set. That is the screen.

Why: the user is mid-training. Nothing competes with the current set for attention. The interface has exactly what is needed and nothing more.

**Bad:**
Current exercise at the top. Exercise video looping in the middle. Motivation quote at the bottom. Tab bar visible. AI coaching status indicator. Progress ring for today's session in the corner. Share button.

Why: each element was probably added by a different team. Together, they describe an interface that does not trust the user to train without entertainment.

---

### Post-session completion screen

**Good:**
Session complete. Summary: duration, exercise count. If an AI insight has cleared the confidence threshold, it appears here — one or two lines, specific. Done button. The user leaves.

Why: the session is complete. The screen reflects completion. One optional insight if earned. Nothing manufactured.

**Bad:**
Confetti animation. "You crushed it! 💪" Achievement unlocked: 10 Sessions badge. Share your workout! Your streak is now 7 days. Upgrade to Premium to unlock advanced stats. Rate this session (1–5 stars). See today's nutrition recommendations.

Why: a series of calls to action that each have their own justification but together describe an app that does not know when the session is over.

---

### Progress visualization

**Good:**
A single line chart for a tracked exercise: weight over time, last six months. A horizontal reference line for personal best. Session dots that can be tapped for detail. No analysis required — the direction of travel is visible in three seconds.

Why: the chart answers one question — is this lift going in the right direction? It answers it immediately without requiring the user to interpret multiple variables.

**Bad:**
A progress screen with twelve cards: recent sessions, body measurements, streak, weekly volume, monthly volume, exercise variety, calories burned estimate, active minutes, heartrate graph from phone integration, friends' activity, AI coaching score, and a "your fitness age" metric.

Why: none of these compete with each other on usefulness, but together they compete for attention in a way that makes each less useful. The screen requires management rather than glance.

---

### Empty state design

**Good:**
No exercises tracked yet. Short, neutral explanation of what tracked exercises are. One clear action: "Track an exercise from your program." Nothing else.

Why: the empty state communicates the current state accurately, explains what the state means, and offers one path forward. It does not apologize, does not over-explain, and does not surface promotional content.

**Bad:**
"Your progress story starts here! ✨ Log your first workout and watch the magic happen! You're just one session away from unlocking insights. Begin your transformation journey today!"

Why: enthusiasm-maximized copy that contains no useful information, uses a lock metaphor implying something is withheld, and treats the empty state as a marketing opportunity.

---

## Interaction Principles

**Primary actions are one tap.** Logging a set, starting a session, confirming a weight — these are primary actions. They should require one deliberate tap. Not two taps plus a confirmation modal.

**Destructive actions require confirmation.** Deleting a workout, discarding a session in progress, removing a tracked exercise. One accidental tap should not be recoverable. These actions require explicit confirmation.

**Feedback is immediate.** When a user taps something, the interface should respond within 100ms, even if the underlying action takes longer. Optimistic updates — treating the action as complete before the server confirms — are preferred over perceived latency.

**Navigation is reversible.** Every forward navigation has a back. The user should be able to retrace their steps without losing their work. Deep navigation paths should not discard state on return.

**States are legible.** Active, inactive, loading, error, empty — each state should be visually distinct and communicative. A user should never have to wonder whether something worked, whether something is loading, or whether something has gone wrong.

---

## Visual Restraint Philosophy

Typography carries the interface. The type hierarchy — size, weight, contrast — communicates importance, de-emphasizes secondary information, and creates the hierarchy that organizes the screen. When the typography is working correctly, the interface needs very little else.

Color communicates state, not decoration. Accent color is used for the primary action and for states that require attention. It is not used to make the interface look colorful. Secondary elements are neutral. Background is dark and recedes. Content is forward.

Icons are functional, not illustrative. An icon that communicates a function clearly — save, navigate, confirm — earns its place. An icon that illustrates a concept decoratively adds visual noise without communicating anything the text beside it does not already say.

Motion serves function. Transition animations confirm navigation — the user went somewhere. State animations confirm actions — the set was logged. Entrance animations give the eye a path through a loading screen. Motion that does not serve any of these functions should not exist.

---

## Anti-Bloat Rules

- No new screen without asking whether the content could live within an existing screen
- No new metric in the progress view without removing one that is less useful
- No new notification type without auditing every existing notification type for necessity
- No promotional content inside the workout flow
- No feature-announcement banners inside active use surfaces
- No "explore more" prompts within task-completion flows
- No rating request during or immediately after a workout
- Settings that apply to fewer than 10% of users belong in an advanced section, not the primary settings screen

---

## MVP UX Priorities

The surfaces that must be excellent at launch, in order of importance:

**1. Workout logging screen.** One-hand usable, fast, minimal. This is used every session. It must be flawless.

**2. Program and session selection.** Clear hierarchy of what to do next. Minimal friction from the home screen to beginning a session.

**3. Post-session completion screen.** Clean, complete-feeling, space for the AI insight if one has been earned. No manufactured celebration.

**4. Progress visualization for tracked exercises.** One clean chart per exercise. Long-range view as default. Honest data, no smoothing.

**5. Home screen prioritization.** One recommended action. Supporting context at secondary weight. Nothing else.

Everything else — settings, profile, program library, advanced analytics — should be functionally sound and visually consistent. But these five surfaces carry the daily experience. They must be held to a higher standard than the rest.

---

## What Should NOT Be Added to the Interface

The following are explicitly excluded, regardless of how reasonable they might seem in isolation:

| Element | Reason excluded |
|---|---|
| Activity feed or social timeline | Social layer is outside GAINER's scope; feeds optimize for time-in-app, not training quality |
| Motivational quotes (static or AI-generated) | Generic; adds visual noise; communicates nothing about the user's actual training |
| Calorie or nutrition metrics | Outside GAINER's domain; adds complexity without supporting the core use case |
| Before/after photo feature | Privacy concerns; creates social anxiety; adjacent to a body-image problem space |
| Leaderboards or friend comparison | Optimizes for social competition, not individual progress |
| Push notification permission prompt during onboarding | User has not yet experienced value; prompt will be declined and channel permanently damaged |
| "Rate our app" prompt inside workout flow | Wrong moment; interrupts training |
| Dashboard widgets for metrics users cannot act on | Displays data without enabling decisions |
| Promotional banners inside active use surfaces | App-interest over user-interest; visible as commercial |
| Animated achievement sequences for routine actions | Gamification theater; dilutes meaning of genuine achievements |
| "Explore premium" CTA inside workout logging | Wrong surface; interrupts the primary task |

---

## Summary

GAINER's UX earns trust the same way its coaching intelligence does: through restraint, specificity, and consistent quality.

The interface that gets out of the way of training is not a minimal interface — it is an interface that understood exactly what the user needed at each moment and chose to show only that. This understanding is the hardest thing to build and the most invisible when it is working correctly.

The test for every UX decision: if the user noticed this element, what would they think? If the answer is "nothing — it was just there when I needed it," the element is working. If the answer requires any explanation of why it is there, it may not belong.

GAINER's interface should be invisible to users who are training. That is not a limitation. That is the goal.
