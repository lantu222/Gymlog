# GAINER — Documentation Architecture

**Type:** Meta-document — documentation structure, ownership, and integrity rules
**Status:** Authoritative. This document governs how all other docs/ files are classified, owned, and used.
**App name:** GAINER (formerly GAINER — rename applies to all future documentation)

---

## Table of Contents

1. [Folder Structure](#1-folder-structure)
2. [Document Classification Table](#2-document-classification-table)
3. [Ownership Table](#3-ownership-table)
4. [Conflict Report](#4-conflict-report)
5. [Archive Recommendations](#5-archive-recommendations)
6. [Missing Documents](#6-missing-documents)
7. [Architecture Stabilization Recommendations](#7-architecture-stabilization-recommendations)
8. [MVP Protection Rules](#8-mvp-protection-rules)
9. [Scope Creep Risks](#9-scope-creep-risks)
10. [Subsystem Boundary Risks](#10-subsystem-boundary-risks)
11. [Launch-Critical Tagging](#11-launch-critical-tagging)
12. [ADR Index](#12-adr-index)

---

## 1. Folder Structure

```
docs/
│
├── documentation-architecture.md    ← This file. Meta-document and master index.
├── README.md                        ← Navigation guide (to be created)
│
├── source-of-truth/                 ← Authoritative implementation logic.
│   │                                   These documents override all conflicting documents.
│   │                                   Every document here has the Source of Truth header.
│   │
│   ├── mvp-scope.md                 ← (was mvp-launch-scope.md) MVP boundary definition
│   ├── onboarding-contract.md       ← (was onboarding-impact-matrix.md) Onboarding input/output
│   ├── recommendation-engine.md     ← (was recommendation-programme-contract.md)
│   ├── workout-content-rules.md     ← (was workout-content-matrix.md)
│   ├── post-session-insight-rules.md← (was post-session-single-insight-mvp.md)
│   ├── progression-system.md        ← (was progression-gating-rules.md)
│   ├── ai-trust-rules.md            ← (was ai-trust-system.md)
│   └── glossary.md                  ← (was glossary.md) Shared terminology
│
├── architecture/                    ← System boundaries, data flow, subsystem responsibilities.
│   │                                   Describes what exists and how layers interact.
│   │
│   ├── system-boundaries.md         ← NEW. Subsystem responsibilities and forbidden operations.
│   ├── system-architecture.md       ← (was system-architecture.md) Five-layer architecture
│   ├── coaching-architecture.md     ← (was coaching-architecture.md) Phased coaching roadmap
│   ├── project-context.md           ← (was project-context.md) Stack and folder structure
│   └── ai-coach-backend.md          ← (was ai-coach-backend.md) Backend setup reference
│
├── adr/                             ← Architecture Decision Records.
│   │                                   Finalized decisions. Read-only after merge.
│   │                                   New decisions require a new ADR, not edits.
│   │
│   ├── ADR-001-no-in-session-ai.md          ← NEW
│   ├── ADR-002-truthful-save-states.md      ← NEW
│   ├── ADR-003-silence-as-default.md        ← NEW
│   ├── ADR-004-double-progression.md        ← NEW
│   └── ADR-005-deterministic-recommendation.md ← NEW
│
├── validation/                      ← Failure cases, regression rules, edge cases, testing logic.
│   │                                   Documents here describe expected behavior under stress.
│   │
│   ├── onboarding-step1-equipment-access.md ← UI change spec + acceptance criteria
│   ├── onboarding-step2-training-goal.md    ← UI change spec + acceptance criteria
│   ├── onboarding-step3-training-profile.md ← UI change spec + acceptance criteria
│   ├── onboarding-step4-focus-areas.md      ← UI change spec + acceptance criteria
│   └── onboarding-step5-bodyweight-progress.md ← UI change spec + acceptance criteria
│
├── product/                         ← Philosophy, UX principles, branding, roadmap.
│   │                                   Informs decisions but does not override specs.
│   │
│   ├── gainer-philosophy.md         ← Core product values and anti-patterns
│   ├── onboarding-philosophy.md     ← Onboarding design intent
│   ├── ux-principles.md             ← UX behavioral rules
│   ├── retention-philosophy.md      ← Retention approach
│   ├── premium-philosophy.md        ← Monetization intent
│   ├── coaching-intelligence-design.md ← GAINER AI behavioral intent (design ref)
│   ├── product-roadmap-phases.md    ← Three-phase implementation roadmap
│   ├── your-plan-ready-review.md    ← Plan-ready screen design intent
│   ├── manual-launch-tasks.md       ← Launch checklist (external tasks)
│   ├── privacy-policy.md            ← Legal document
│   ├── play-data-safety.md          ← Store compliance
│   ├── asset-shortlist-free.md      ← Asset inventory
│   └── asset-strategy-fully-free.md ← Asset sourcing strategy
│
└── archive/                         ← Outdated or conflicting documents.
    │                                   These documents must not influence implementation.
    │                                   All documents here have the Archived header.
    │
    ├── premium-adaptive-coach-plan.md ← Archived: proposes in-session AI (excluded from MVP)
    └── superpowers/                   ← Archived: historical implementation plans
        ├── plans/2026-04-21-recommendation-engine-implementation-plan.md
        ├── plans/2026-04-25-training-plan-user-ready.md
        └── specs/2026-04-21-recommendation-engine-design.md
```

### Naming conventions

- `source-of-truth/` files use noun-phrase names that describe what they own (`mvp-scope`, `progression-system`), not document format names
- `adr/` files are always `ADR-NNN-brief-description.md`, numbered sequentially
- `archive/` files are never renamed — they keep their original names for git history
- `product/` and `architecture/` files keep descriptive names; avoid ambiguous abbreviations

### Physical migration status

> **Note on physical file moves.** The folder structure above reflects the intended final state. Files have not yet been physically moved using `git mv` — this preserves existing cross-references within documents during the transition period. Files are governed by this classification table from the date of this document regardless of their physical location. A migration commit should be executed once all cross-references are updated.

---

## 2. Document Classification Table

| Document | Category | Authority | Notes |
|---|---|---|---|
| `mvp-launch-scope.md` | source-of-truth | **Highest** | MVP boundary definition. Overrides all feature discussions. |
| `onboarding-impact-matrix.md` | source-of-truth | High | Onboarding input/output contract and scoring weights. |
| `recommendation-programme-contract.md` | source-of-truth | High | Programme payload, duration model, progression variables, session composition, copy contract. |
| `workout-content-matrix.md` | source-of-truth | High | Exercise content rules and acceptance matrix by goal/equipment. |
| `post-session-single-insight-mvp.md` | source-of-truth | High | MVP post-session insight spec: 4 types, thresholds, silence rules, pure function contract. |
| `progression-gating-rules.md` | source-of-truth | High | Double progression model, fatigue enum, ACWR thresholds, gating logic. |
| `ai-trust-system.md` | source-of-truth | High | Trust philosophy, notification rules, frequency caps, confidence thresholds. |
| `glossary.md` | source-of-truth | High | Canonical shared terminology. Deprecated term index. |
| `system-architecture.md` | architecture | Medium-High | Five-layer architecture, phase names, data ownership, anti-overengineering rules. |
| `coaching-architecture.md` | architecture | Medium | Phased coaching implementation roadmap. Layer definitions deferred to system-architecture.md. |
| `project-context.md` | architecture | Medium | Stack, folder structure, key decisions, coding rules. |
| `ai-coach-backend.md` | architecture | Medium | Backend configuration and endpoint setup. |
| `documentation-architecture.md` | meta | High | This document. Governs all other documents. |
| `onboarding-step1-equipment-access.md` | validation | Medium | UI spec and acceptance criteria for Step 1. |
| `onboarding-step2-training-goal.md` | validation | Medium | UI spec and acceptance criteria for Step 2. |
| `onboarding-step3-training-profile.md` | validation | Medium | UI spec and acceptance criteria for Step 3. |
| `onboarding-step4-focus-areas.md` | validation | Medium | UI spec and acceptance criteria for Step 4. |
| `onboarding-step5-bodyweight-progress.md` | validation | Medium | UI spec and acceptance criteria for Step 5. |
| `gainer-philosophy.md` | product | Low-Med | Core product values. Anti-gamification canonical source. |
| `onboarding-philosophy.md` | product | Low-Med | Onboarding design intent. Not an implementation spec. |
| `ux-principles.md` | product | Low-Med | UX behavioral rules. References authority docs for specific values. |
| `retention-philosophy.md` | product | Low | Retention design intent. |
| `premium-philosophy.md` | product | Low-Med | Free-tier definition and monetization ethics. Canonical owner of free-tier rules. |
| `coaching-intelligence-design.md` | product | Low | GAINER AI behavioral intent. Superseded by implementation specs on all numeric values. |
| `product-roadmap-phases.md` | product | Low | Three-phase roadmap. Not a feature commitment. |
| `your-plan-ready-review.md` | product | Low | Plan-ready screen redesign intent. Design reference only. |
| `manual-launch-tasks.md` | product | Medium | External launch checklist. Non-implementation tasks. |
| `privacy-policy.md` | product | High (legal) | Legal document. Not a product spec. |
| `play-data-safety.md` | product | High (legal) | Store compliance. Must be accurate. |
| `asset-shortlist-free.md` | product | Low | Asset inventory. |
| `asset-strategy-fully-free.md` | product | Low | Asset sourcing. |
| `premium-adaptive-coach-plan.md` | **archive** | **None** | Proposes in-session GAINER AI. Explicitly excluded from MVP. |
| `superpowers/plans/2026-04-21-*` | **archive** | None | Historical implementation plan. Superseded. |
| `superpowers/plans/2026-04-25-*` | **archive** | None | Historical training-plan spec. Superseded. |
| `superpowers/specs/2026-04-21-*` | **archive** | None | Historical recommendation engine design. Superseded. |

---

## 3. Ownership Table

Every implementation responsibility is owned by exactly one document. If a value, rule, or decision appears in multiple documents, the owner listed here is the authority. Other documents must reference the owner, not restate the value.

| Responsibility | Owner Document | Notes |
|---|---|---|
| **MVP feature boundary** | `mvp-launch-scope.md` | What ships vs what does not. Overrides all other feature discussions. |
| **Onboarding input schema** | `onboarding-impact-matrix.md` | Step 1–5 field names, scoring dimensions, constraint rules. |
| **Onboarding scoring weights** | `onboarding-impact-matrix.md` | Goal fit 35%, frequency 20%, readiness 15%, focus 12%, bodyweight 8%, catalog 10%. |
| **Programme payload fields** | `recommendation-programme-contract.md` | `blockLengthWeeks`, `durationModel`, `phaseLabels`, `weekRoles`, `progressionRules`, etc. |
| **MVP starter phase model** | `recommendation-programme-contract.md` | 4-week baseline/build/build/review roles, plus later 6-8 week duration shapes. |
| **Progression variables by goal** | `recommendation-programme-contract.md` | Load vs reps vs sets vs density by goal type. |
| **Workout content rules by goal** | `workout-content-matrix.md` | Exercise mix, set/rep bias, progression bias by goal type. |
| **Content fit acceptance matrix** | `workout-content-matrix.md` | Which template passes which path. |
| **Post-session insight function contract** | `post-session-single-insight-mvp.md` | `computePostSessionInsight()` signature, return types, silence rules. |
| **MVP insight types** | `post-session-single-insight-mvp.md` | 4 types: `personal_record`, `plateau_detected`, `session_volume_peak`, `return_after_gap`. |
| **MVP confidence threshold** | `post-session-single-insight-mvp.md` | Universal 0.75 for MVP. |
| **No back-to-back insight rule** | `post-session-single-insight-mvp.md` | Session N+1 is silent if N had an insight. |
| **Fatigue signal enum** | `progression-gating-rules.md` | `'normal' \| 'elevated' \| 'high'` |
| **ACWR thresholds** | `progression-gating-rules.md` | 1.3 = elevated, 1.5 = high. |
| **Progression completion rate gate** | `progression-gating-rules.md` | 80% minimum. |
| **Double progression model** | `progression-gating-rules.md` | Rep accumulation then load increment. Increments: 2.5kg beginner, 1.25kg intermediate. |
| **Hold always silent to user** | `progression-gating-rules.md` | Hold decision is never communicated to user directly. |
| **Trust philosophy** | `ai-trust-system.md` | Restraint, specificity, accuracy as trust-building mechanisms. |
| **Notification tier system** | `ai-trust-system.md` | Tier 1/2/3 definitions and allowed delivery surfaces. |
| **Interruption rules** | `ai-trust-system.md` | No output during active workout. Architecturally enforced. |
| **Future per-type confidence targets** | `ai-trust-system.md` | Future thresholds per insight type. |
| **Frequency caps (future)** | `ai-trust-system.md` | 3 per 7-day window, 14-day same-type cooldown, 21-day deload cooldown. |
| **Coaching phase names and session boundaries** | `system-architecture.md` §4.4 | `observation` (0–6), `emerging` (7–20), `active` (21–60), `trusted` (60+). |
| **Five-layer architecture** | `system-architecture.md` | PROFILE → MEMORY → SIGNAL → INTELLIGENCE → DELIVERY. |
| **Data ownership rules** | `system-architecture.md` | AppPreferences, exerciseLogs, WorkoutSession source-of-truth rules. |
| **Anti-overengineering rules** | `system-architecture.md` + `mvp-launch-scope.md` | Dual ownership; both lists apply. |
| **Free-tier definition** | `premium-philosophy.md` | What must remain free forever. |
| **Ethical monetization rules** | `premium-philosophy.md` | What may be charged for and why. |
| **Anti-gamification rules** | `gainer-philosophy.md` | Canonical prohibition list for streaks, badges, points, engagement mechanics. |
| **Canonical shared terminology** | `glossary.md` | Deprecated term index and canonical names. |
| **Subsystem responsibilities** | `architecture/system-boundaries.md` | What each subsystem may and may not do. |

### Duplicate ownership warnings

The following responsibilities appear in more than one document. The owner above is authoritative; the secondary documents must be updated to reference rather than restate.

| Responsibility | Owner | Also appears in | Action required |
|---|---|---|---|
| Coaching phase names | `system-architecture.md` | `ai-trust-system.md`, `coaching-intelligence-design.md` | Secondary docs already reference owner. No further action. |
| Confidence thresholds (MVP) | `post-session-single-insight-mvp.md` | `ai-trust-system.md`, `system-architecture.md` | Marked as future in secondaries. No further action. |
| Completion rate threshold | `progression-gating-rules.md` | `coaching-intelligence-design.md` | `coaching-intelligence-design.md` updated to reference owner. No further action. |
| ACWR threshold values | `progression-gating-rules.md` | `coaching-intelligence-design.md`, `ai-trust-system.md` | Secondary docs reference owner by section. No further action. |
| Anti-gamification rules | `gainer-philosophy.md` | `ux-principles.md` | `ux-principles.md` references owner. No further action. |
| Notification rules | `ai-trust-system.md` | `ux-principles.md`, `onboarding-philosophy.md` | Secondaries reference owner by section. No further action. |
| Onboarding content rules | `onboarding-impact-matrix.md` | `recommendation-programme-contract.md`, `workout-content-matrix.md` | Overlap is legitimate specialization, not duplication. Each doc owns a distinct aspect. |

---

## 4. Conflict Report

### Critical conflicts (resolved)

These conflicts were identified and resolved in a prior documentation pass. Listed here for record.

| Conflict | Documents | Resolution |
|---|---|---|
| Three incompatible coaching phase systems (time-based vs session-based) | `ai-trust-system.md`, `coaching-intelligence-design.md`, `coaching-architecture.md` | Resolved: session-count model in `system-architecture.md` is canonical. All docs updated to reference it. |
| Three different confidence threshold values (0.70/0.75/0.80) | Multiple | Resolved: 0.75 universal for MVP (`post-session-single-insight-mvp.md`); per-type targets are future (`ai-trust-system.md`). |
| Completion rate conflict: 70%, 80%, 90% | Multiple | Resolved: 70% is insight silence gate; 80% is progression gate. 90% was wrong — corrected in `coaching-intelligence-design.md`. |
| `progression_ready` defined but excluded | Multiple | Resolved: marked future/excluded with cross-references. |
| Five-layer architecture in two documents | `system-architecture.md`, `coaching-architecture.md` | Resolved: layer definitions removed from `coaching-architecture.md`. |

### Active conflicts (requiring action)

| ID | Severity | Description | Affected Documents | Recommended Resolution |
|---|---|---|---|---|
| C-01 | **Critical** | `premium-adaptive-coach-plan.md` proposes "set-to-set guidance during logging" and "session adjustment when energy, time, or recovery is off" — both are in-session AI outputs, which are architecturally prohibited. | `premium-adaptive-coach-plan.md` | Archive this document. See §5. |
| C-02 | **Critical** | `coaching-intelligence-design.md` §3 states "In-session: exercise substitution suggestions allowed" — this conflicts with the absolute no-in-session-AI rule in `ai-trust-system.md` §3.5 and `post-session-single-insight-mvp.md`. | `coaching-intelligence-design.md` | Update §3 to remove the in-session exception. No coaching output is allowed during an active session, including substitution suggestions. |
| C-03 | **High** | `your-plan-ready-review.md` references implementation anchors (`renderReview()`, specific asset names) that may be outdated or renamed. It contains no "design reference only" label. | `your-plan-ready-review.md` | Add Type: Design reference label. Verify implementation anchors are current or note they require verification. |
| C-04 | **Medium** | `onboarding-impact-matrix.md` and `recommendation-programme-contract.md` both define content rules for recommendation output. The boundary between "what gets selected" (impact matrix) and "what gets built into the programme" (contract) is clear in intent. | Both | Keep explicit scope statements at the top of each document clarifying the boundary: impact matrix owns *selection*, programme contract owns *construction*. |
| C-05 | **Medium** | `product-roadmap-phases.md` uses "GAINER" throughout. App has been renamed to "GAINER." | `product-roadmap-phases.md` | Update all instances of "GAINER" to "GAINER." |
| C-06 | **Medium** | `premium-adaptive-coach-plan.md` (archived) proposes "GAINER AI actions that can change the plan" during sessions. If future premium docs are created, they must not inherit this proposal. | Future premium docs | When premium documentation is rebuilt, start from `premium-philosophy.md` as the canonical base. Do not reference the archived plan. |
| C-07 | **Low** | `project-context.md` uses "GAINER" in title and throughout. | `project-context.md` | Update to "GAINER." |
| C-08 | **Low** | `superpowers/specs/2026-04-21-recommendation-engine-design.md` uses "GAINER" and contains design decisions that may conflict with current implementation. It has no archive label. | superpowers/specs/ | Archive the entire `superpowers/` folder. See §5. |

### Active conflicts (in-spec ambiguity)

| ID | Severity | Description | Recommendation |
|---|---|---|---|
| C-09 | **Medium** | `coaching-intelligence-design.md` §3 defines a "weekly (opt-in)" coaching cadence with "one forward-looking insight." This is explicitly excluded from MVP (`mvp-launch-scope.md` §4) but is not labeled as future in the design doc. | Add `🔜 Future` marker to the weekly coaching cadence entry. |
| C-10 | **Low** | Multiple documents mention "the specificity test" but none formally define it as a required gate. The test is described consistently but its enforcement status in MVP is implicit. | `post-session-single-insight-mvp.md` or `ai-trust-system.md` should add a formal statement that the specificity test is a required pre-delivery gate in MVP. |

---

## 5. Archive Recommendations

### Immediate archive: `premium-adaptive-coach-plan.md`

**Reason:** This document proposes features that are explicitly excluded from MVP and conflict with core architectural constraints:
- "set-to-set guidance during logging" — in-session AI (architecturally prohibited)
- "smarter rest and next-set recommendations" — in-session AI (architecturally prohibited)
- "session adjustment when energy, time, or recovery is off" — in-session AI (architecturally prohibited)
- "GAINER AI actions that can change the plan" — speculative feature with no current foundation

**Action:** Add the Archived header. Move to `docs/archive/`. Do not reference this document in future implementation work.

**Note:** The premium *philosophy* is correctly documented in `premium-philosophy.md` which is healthy and should remain in `product/`. Only the speculative adaptive coach plan is archived.

---

### Immediate archive: `docs/superpowers/`

**Reason:** The superpowers folder contains historical implementation plans and design specs from April 2026. These predate the current recommendation engine implementation, the coaching architecture, and the full spec suite. They are superseded by current authoritative documents.

**Action:** Add the Archived header to each file. The folder itself remains for git history.

---

### Conditional archive: `coaching-intelligence-design.md`

**Do not archive yet.** This document contains valuable behavioral intent that is not yet fully captured in implementation specs. However, it must be clearly labeled as a design reference that is superseded by the implementation specs on all numeric values.

**Condition for archiving:** When `post-session-insight-rules.md`, `progression-system.md`, and `ai-trust-rules.md` are complete and stable, sections 3–9 of `coaching-intelligence-design.md` will be fully covered by those specs. At that point, the behavioral intent sections can be consolidated into product/coaching-philosophy.md and this document archived.

---

## 6. Missing Documents

These documents are referenced or implied by the current system but do not yet exist.

| Missing Document | Category | Priority | What it should contain |
|---|---|---|---|
| `architecture/system-boundaries.md` | architecture | **High** | Subsystem responsibilities, forbidden operations, data ownership boundaries, flow constraints. Created as part of this restructure. |
| `source-of-truth/ui-state-rules.md` | source-of-truth | **High** | Authoritative rules for save states, loading states, completion states, empty states. Formalizes the truthful-save-state requirement. |
| `validation/save-state-regression.md` | validation | **High** | Test cases for the three most critical launch risks: save truthfulness, navigation context, recommendation personalization. |
| `adr/ADR-001-no-in-session-ai.md` | adr | **High** | Documents the architectural decision to prohibit all AI output during active sessions. Created as part of this restructure. |
| `adr/ADR-002-truthful-save-states.md` | adr | **High** | Documents the requirement that completion UI cannot appear before persistence resolves. Created as part of this restructure. |
| `source-of-truth/onboarding-contract.md` | source-of-truth | Medium | Consolidation of `onboarding-impact-matrix.md` with clearer scope boundary from `recommendation-programme-contract.md`. |
| `product/gainer-brand-voice.md` | product | Low | Tone-of-voice rules for copy, coaching messages, onboarding text. Currently scattered across multiple philosophy docs. |

---

## 7. Architecture Stabilization Recommendations

These recommendations reduce architectural drift and prevent future conflicts.

---

### R-01: One document per owned value

Any numeric threshold, enum, or decision that appears in more than one document must be removed from all but the owner. The owner document is listed in §3. Secondary documents must use a cross-reference: "See `[owner].md` for the authoritative value."

**Most urgent remaining cases:** coaching-intelligence-design.md §3 in-session exception (C-02), weekly cadence (C-09).

---

### R-02: Rename files to match their governed system

The current filenames use inconsistent naming conventions that make it unclear whether a file is a philosophy, a spec, or a contract. When physical moves are executed:

| Current name | Proposed name | Reason |
|---|---|---|
| `mvp-launch-scope.md` | `source-of-truth/mvp-scope.md` | Shorter; category is implied by folder |
| `onboarding-impact-matrix.md` | `source-of-truth/onboarding-contract.md` | "Matrix" implies a table; "contract" implies an implementation boundary |
| `recommendation-programme-contract.md` | `source-of-truth/recommendation-engine.md` | Simpler; MVP 4-week detail and later duration model are in the file |
| `post-session-single-insight-mvp.md` | `source-of-truth/post-session-insight-rules.md` | Cleaner; "MVP" will be outdated as the spec evolves |
| `progression-gating-rules.md` | `source-of-truth/progression-system.md` | Broader scope; gating is one aspect |
| `ai-trust-system.md` | `source-of-truth/ai-trust-rules.md` | Consistent with "rules" naming in source-of-truth/ |
| `workout-content-matrix.md` | `source-of-truth/workout-content-rules.md` | Consistent naming |

---

### R-03: App rename — GAINER → GAINER

Every document that uses "GAINER" as a product name must be updated. "GAINER" is acceptable as an internal package/code identifier (e.g., `@gymlog/database/v1`). It is not acceptable as the user-facing product name in documentation.

**Files requiring name updates:**
- `project-context.md` — title and throughout
- `product-roadmap-phases.md` — title and throughout
- `premium-adaptive-coach-plan.md` — (archived, low priority)
- `superpowers/` files — (archived, no action required)

---

### R-04: Type labels on all documents without them

All documents should have a Type label at the top:

```
**Type:** Philosophy / Design reference / Implementation spec / Architecture reference / ADR / Meta-document
```

**Documents missing this label:**
- `recommendation-programme-contract.md` — add "Implementation spec"
- `onboarding-impact-matrix.md` — add "Implementation spec"
- `workout-content-matrix.md` — add "Implementation spec"
- `project-context.md` — add "Architecture reference"
- `your-plan-ready-review.md` — add "Design reference"
- `product-roadmap-phases.md` — add "Design reference"
- `manual-launch-tasks.md` — add "Operational checklist"
- `ai-coach-backend.md` — add "Architecture reference"
- All five onboarding step files — add "Design reference"
- All superpowers files — add "Archive" (before archiving)

---

### R-05: ADR-first for all new architectural decisions

Any decision that affects more than one subsystem, sets a threshold that must be enforced globally, or creates an architectural constraint must be documented as an ADR before implementation. This prevents the conflict pattern that required the prior consistency audit.

Required format: see `docs/adr/` files for template.

---

## 8. MVP Protection Rules

These rules must be applied whenever a new document is created or an existing document is modified.

---

### Rule 1: No excluded feature may appear without an archive label

Any document proposing a feature from the excluded list must carry the Archived header or clearly mark the section as `🔜 Future (post-launch)`. Unqualified proposals for excluded features create scope creep risk.

**Excluded features that must never appear as active proposals:**
Push notifications, social features, nutrition tracking, wellness tracking, premium paywall, streaks/gamification, calendar integration, AI chatbot interface, in-session coaching, weekly AI summaries, deload recommendations (MVP), long-range analytics, AI program builder, multiple post-session insights, LLM-generated coaching output.

---

### Rule 2: The core launch loop is inviolable

Any document, feature, or system that degrades any step of the core loop is a launch blocker:

```
Onboarding → recommendation → log session → save truthfully → appear in history → show progress
```

If a proposed feature competes with loop quality (e.g., adding a premium prompt inside the logging flow), the loop wins.

---

### Rule 3: Three launch-critical risks are protected concerns

The following risks from `mvp-launch-scope.md` §12 are protected:

1. **Save truthfulness failure** — any change to the save/completion flow must be reviewed against ADR-002
2. **Recommendation does not visibly personalize** — equipment filter changes must be tested against all five equipment options
3. **Navigation context loss** — any routing change must preserve the flows defined in `mvp-launch-scope.md` §2.4

---

### Rule 4: AI features require explicit MVP clearance

A new AI feature may only be added to MVP-scope documents if it meets all three criteria:
- Fully offline (no network dependency)
- Deterministic output (no LLM generation)
- Covered by the silence-default rule (null is a valid and expected output)

AI features that require live backend, LLM generation, or always produce output are post-launch by definition.

---

## 9. Scope Creep Risks

Patterns that historically introduce scope creep in fitness apps, ordered by current risk level for GAINER.

| Risk | Current signal | Mitigation |
|---|---|---|
| **In-session AI creep** | `premium-adaptive-coach-plan.md` proposed it; `coaching-intelligence-design.md` §3 allows substitution suggestions in-session | Archive the plan. Remove the in-session exception from the design doc. ADR-001 is the permanent record. |
| **Notification infrastructure pressure** | Notification system described in detail in `ai-trust-system.md` §5 despite being MVP-excluded | The tier system is forward-looking. Keep descriptions as future intent. Ensure MVP code has zero notification infrastructure. |
| **Premium paywall before value** | Not currently in any active document | Protected by `premium-philosophy.md` canonical free-tier definition. Flag if any doc adds paywall proposals. |
| **Analytics complexity** | No analytics infrastructure defined yet | `mvp-launch-scope.md` §10 defines the minimal right set. Do not add DAU, funnel, or event-tracking systems before launch. |
| **Progressive profiling as onboarding bloat** | Not currently an active risk | Protected by `onboarding-philosophy.md` anti-bloat rules and 5-question maximum. |
| **Weekly coaching summaries** | Mentioned in `coaching-intelligence-design.md` §3 without future marker | Add `🔜 Future` marker to weekly cadence entries. |
| **Progression gating surfaced without data** | `progression-gating-rules.md` specced but not yet implemented | Do not surface progression gating UI until the function is built and tested with real user data. |
| **LLM generation for message templates** | Not currently proposed for MVP | Monitor. Template messages are sufficient for all 4 MVP insight types. |

---

## 10. Subsystem Boundary Risks

Systems where boundary violations are most likely to occur during implementation.

| Boundary | Risk | Protection |
|---|---|---|
| **Coaching output ↔ Session state** | An engineer adds an insight trigger that fires while WorkoutProvider has an active session | ADR-001 (no in-session AI). `computePostSessionInsight()` must only be called after session save. |
| **Recommendation engine ↔ GAINER AI** | GAINER AI begins generating or overriding programme selections | `recommendation-programme-contract.md` §"Product Boundary" explicitly prohibits this. |
| **Save flow ↔ Completion UI** | Completion screen appears optimistically before persistence resolves | ADR-002 (truthful save states). `WorkoutCompletionScreen` must only be entered after successful persistence. |
| **src/lib/ ↔ Storage** | A lib function accesses AsyncStorage directly | CLAUDE.md and `system-architecture.md` §13 prohibit side effects in `src/lib/`. |
| **Progression logic ↔ User-facing messaging** | `evaluateProgressionGating()` return value is shown directly to the user | `progression-gating-rules.md` §display-contract: hold is always silent to user. Function output drives internal logic only. |
| **Onboarding ↔ Recommendation** | Onboarding screens compute recommendation scores directly | Scoring lives in `src/lib/recommendationScoring.ts`. Screens call into lib — they do not contain scoring logic. |

---

## 11. Launch-Critical Tagging

Documents and systems that should receive the Launch Critical header. Failure in any of these blocks the v1 release.

```
# Launch Critical

Failure in this system blocks launch.
```

**Documents to tag:**

| Document | Reason |
|---|---|
| `mvp-launch-scope.md` | Defines the launch boundary. Everything else references it. |
| `post-session-single-insight-mvp.md` | If insight incorrectly fires during a session or delivers a wrong positive, trust is broken on the first impression. |
| `onboarding-impact-matrix.md` | If recommendation does not visibly personalize (launch risk 2), the first-impression fails. |
| `architecture/system-boundaries.md` | Defines what each system may not do. Boundary violations are launch blockers. |
| `adr/ADR-002-truthful-save-states.md` | Save truthfulness is launch risk 1. This ADR is the permanent record of the constraint. |

**Systems to tag in their respective documents:**

| System | Launch-critical behavior |
|---|---|
| `saveCompletedWorkoutSession` and its UI gate | Must not show completion screen before this resolves successfully |
| Equipment filter in recommendation engine | Must produce visibly different results for each of 5 equipment options |
| Origin-aware navigation | Must preserve context through: onboarding → detail → logging → completion |
| Session logging empty-state gate | Must prevent zero-set sessions from showing "saved" state |

---

## 12. ADR Index

Architecture Decision Records are in `docs/adr/`. Each ADR represents a finalized decision. They are read-only after the commit that creates them. Reversing a decision requires a new ADR that supersedes the original.

| ADR | Title | Status | Key constraint |
|---|---|---|---|
| ADR-001 | No In-Session AI | **Accepted** | All GAINER AI output is architecturally prohibited during active sessions |
| ADR-002 | Truthful Save States | **Accepted** | Completion UI cannot appear before persistence resolves |
| ADR-003 | Silence as Default for Coaching | **Accepted** | `null` is the correct and expected return for most sessions |
| ADR-004 | Double Progression Model | **Accepted** | All weighted exercises use rep-accumulation-then-load-increment |
| ADR-005 | Deterministic Recommendation Engine | **Accepted** | Programme selection and construction must not require LLM generation |

---

## Document Header Standards

### Source of Truth header

Add to all documents in `source-of-truth/` and to any document marked as high authority:

```markdown
# Source of Truth

This document is authoritative.
If any other document conflicts with this file, this file takes precedence.
```

### Launch Critical header

Add to documents and sections identified in §11:

```markdown
# Launch Critical

Failure in this system blocks launch.
```

### Archived header

Add to all documents in `archive/`:

```markdown
# Archived

This document is outdated and should not be used for implementation decisions.
See [replacement document] for current guidance.
```

### Future marker

Use inline in documents for features that are designed but not MVP-scope:

```markdown
🔜 Future — not part of MVP. See `mvp-launch-scope.md` §4 for the excluded features list.
```
