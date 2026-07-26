# GAINER - Long-Term Vision

**Type:** Product vision - strategic direction only, no implementation authority
**Status:** Exploratory. Nothing in this document is committed work.
**Scope boundary:** Everything here is **outside** `mvp-launch-scope.md`. This document must not be used to justify MVP scope changes.
**Related:** `product-roadmap-phases.md`, `premium-philosophy.md`, `ai-trust-system.md`, `adr/ADR-001-no-in-session-ai.md`
**Canonical owner of:** long-range product sequencing beyond Phase 3, hardware direction

---

## Purpose Of This Document

`product-roadmap-phases.md` covers Phases 1-3: shipping a trustworthy app. This document records what comes after, so the ambition is written down somewhere without leaking into launch scope.

The core idea: GAINER is not intended to end as a logging app. The intended end state is a training system that spans software and hardware. But the ordering matters more than the ambition, and the ordering is deliberately conservative.

---

## The Sequence

```
1. Gainer app          -> ship, get paying users, get data
2. AI coach            -> recurring value, funded by 1
3. AI movement analysis -> phone camera first, no hardware
4. AI rack             -> fixed hardware, sold to gyms
5. AI gym              -> own facility, last
```

Each stage funds and de-risks the next. No stage begins before the previous one has evidence behind it.

### Stage 1 - Ship GAINER

Publish to Google Play and the App Store. Acquire the first paying users. Fix bugs and iterate on real feedback rather than assumption.

**Milestone: 100 paying, actively-using subscribers.** This number is small on purpose. It is not a revenue target - it is a proof that the product solves a real problem for real people who will pay repeatedly. Investment in later stages should not begin before this is met.

**Second milestone: 500-1000 active paying users.** At this point recurring revenue can fund development of the next stage without external capital.

### Stage 2 - AI Coach

Deepen what already exists in `api/ai-coach.ts` and the GAINER AI preview layer:

- program optimisation
- recovery tracking
- load recommendations

This is the monetisation engine. See `premium-philosophy.md` for what may and may not be charged for.

### Stage 3 - AI Movement Analysis (Phone Only)

The first version of form analysis requires **no** special hardware. The user props a phone to the side and records a set. The system returns:

- depth
- bar path
- knee tracking / valgus
- rep tempo
- suggestions for the next set

This is the critical stage. It is the cheapest possible test of whether computer-vision coaching is useful enough that people want it, and it produces the training data and the model that any future hardware would run. If phone-based analysis is not useful, hardware will not rescue it.

### Stage 4 - AI Rack

A standard power rack augmented with:

- 2-4 cameras
- a depth camera (Intel RealSense class)
- a local GPU machine (RTX class)
- a screen facing the lifter
- speakers

Per-set output on the screen, for example:

```
Depth 91 %
Knees tracked slightly inward
Bar path drifted 4 cm forward
Next set +2.5 kg
Estimated 1RM: 172 kg
```

**Business model:** sell or lease to commercial gyms rather than operating gyms. Indicative pricing discussed: 500-1000 EUR / month / rack. Illustrative scale: 100 gyms x 2 racks. These are unvalidated back-of-envelope figures, not a forecast.

**Connectivity:** analysis should run on the local machine (edge inference). Network is needed only to sync results into the app, which removes the dependency on good connectivity at the site. Where a site has no fibre, 5G or Starlink is sufficient for sync.

### Stage 5 - AI Gym

Own facility, only after the software, the model, the app and the user base already exist.

---

## Development Space (Considered, Not Committed)

A small development space would be needed from Stage 4, not before. Space evaluated during this discussion:

- Antaksentie 3, Vantaa - approx. 56 m2, approx. 980 EUR / month (source: toimitilat.fi listing 10866308)

Intended contents: one rack, a bench, plates, cameras, a workstation, a server, and test subjects. Not open to the public.

**A lease is a fixed monthly liability with no revenue attached.** Signing one before Stage 1 revenue exists inverts the whole sequence this document argues for. Stage 3 needs a phone and a training partner, not a unit.

---

## Open Questions

These are unresolved. They are recorded here so that later decisions are made against them rather than around them.

**1. ADR-001 conflict.** `adr/ADR-001-no-in-session-ai.md` establishes that GAINER produces no AI output during an active workout session. An AI rack that gives feedback after every set is in-session AI by definition. Either the rack is a separate product outside the ADR's boundary, or ADR-001 needs a successor ADR that defines when live feedback is acceptable. This must be resolved before any rack work starts, not after.

**2. Conversion assumptions.** 500-1000 paying users implies a substantially larger install base at realistic free-to-paid conversion rates for consumer fitness apps. The download volume required to reach the milestone has not been estimated.

**3. Competitive landscape.** Camera-based barbell tracking sold to gyms is an existing product category, not an empty one. The competitive position of an AI rack has not been researched. This should be done before hardware spend, not before Stage 3 (phone analysis is worth doing regardless).

**4. Form-feedback quality bar.** Pose estimation that produces numbers is easy. Pose estimation that produces advice a lifter should actually follow is not. The accuracy threshold at which form feedback becomes useful rather than misleading is undefined.

**5. Liability.** Telling a user their technique is safe, or to add load, carries injury-liability exposure that logging does not. Requires legal review before any form-correction feature ships publicly.

**6. Hardware economics.** Bill of materials, installation, support, and warranty per rack are unknown, so the 500-1000 EUR / month figure cannot yet be assessed for margin.

---

## Relationship To The Existing Strategy Documents

`Gainer_Audit/` (dated 4 June 2026) already contains competitive, financial and roadmap analysis. This vision document sits **below** those in authority. Where they disagree, they win, because they were written against the actual codebase.

Known tensions to resolve before acting on anything above:

| Tension | This document assumes | `Gainer_Audit/` says |
|---|---|---|
| Sequencing | Ship -> paying users -> AI coach | `GAINER-TIEKARTTA-12KK.md`: validate **retention** first, with analytics in place, before building AI, backend or premium at all |
| AI coach effort | An incremental next step on `api/ai-coach.ts` | `INVESTMENT-MEMO.md`: premium, sync and AI memory require a near-total backend rebuild; current persistence is a single JSON blob rewritten on every mutation |
| User milestones | 100 -> 500-1000 paying users | `COMPETITIVE-ANALYSIS.md`: models the path to 10,000 paying users in a saturated, low-ARPU category |
| Differentiation | The AI rack is the eventual moat | `COMPETITIVE-ANALYSIS.md`: the near-term wedge is bilingual Finnish/Nordic plus anti-gamification honesty - and the AI coach differentiator is not shipped yet |

The practical reading: the phased ordering in this document is sound in shape, but every stage boundary is further away than it looks. Stage 2 in particular is not a feature - it is an infrastructure project.

---

## What This Document Does Not Authorise

- no change to `mvp-launch-scope.md`
- no hardware purchase
- no lease commitment
- no new dependency in the app
- no AI feature that violates `ai-trust-system.md` or an existing ADR

The next action remains the one in `manual-launch-tasks.md`: get GAINER published.
