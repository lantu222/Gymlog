# GAINER — Documentation Index

This is the navigation hub for all GAINER documentation.

**App name:** GAINER (package identifier: `gymlog` — internal only)
**Documentation architecture:** See `documentation-architecture.md` for classification, ownership, and conflict rules.

---

## Quick Reference: Where to Find Things

| I need to know... | Go to |
|---|---|
| What ships in MVP and what does not | `mvp-launch-scope.md` |
| How onboarding answers become a recommendation | `onboarding-impact-matrix.md` |
| How the 4-week programme is structured | `recommendation-4-week-programme-contract.md` |
| What content a workout session must contain | `workout-content-matrix.md` |
| How post-session coaching insights work | `post-session-single-insight-mvp.md` |
| When and how load should increase | `progression-gating-rules.md` |
| When the AI should and should not speak | `ai-trust-system.md` |
| What each system may and may not do | `architecture/system-boundaries.md` |
| Why a major architectural decision was made | `adr/` |
| What a term means | `glossary.md` |
| The five-layer coaching architecture | `system-architecture.md` |
| Product values and anti-patterns | `product/gainer-philosophy.md` |
| Onboarding design intent | `product/onboarding-philosophy.md` |
| What to do before launch (external tasks) | `manual-launch-tasks.md` |

---

## Folder Structure

### `source-of-truth/` (proposed — see documentation-architecture.md)

Authoritative implementation logic. These documents override all conflicting documents.

> Currently these files are at the `docs/` root. The folder structure is the target state for a migration commit. Classification applies now regardless of physical location.

| Document | Owns |
|---|---|
| `mvp-launch-scope.md` | MVP feature boundary |
| `onboarding-impact-matrix.md` | Onboarding input schema, scoring weights |
| `recommendation-4-week-programme-contract.md` | Programme payload, progression variables |
| `workout-content-matrix.md` | Content rules by goal and equipment |
| `post-session-single-insight-mvp.md` | Post-session insight function, 4 types, silence rules |
| `progression-gating-rules.md` | Double progression, fatigue enum, ACWR thresholds |
| `ai-trust-system.md` | Trust philosophy, notification rules, confidence thresholds |
| `glossary.md` | Canonical shared terminology |

### `architecture/`

System boundaries, data flow, subsystem responsibilities.

| Document | Covers |
|---|---|
| `architecture/system-boundaries.md` | What each subsystem may and may not do |
| `system-architecture.md` | Five-layer coaching architecture, phase names |
| `coaching-architecture.md` | Phased coaching implementation roadmap |
| `project-context.md` | Stack, folder structure, key decisions |
| `ai-coach-backend.md` | Backend configuration and endpoint setup |

### `adr/`

Architecture Decision Records. Finalized decisions. Read-only after merge.

| ADR | Decision |
|---|---|
| `ADR-001-no-in-session-ai.md` | No AI output during active workout sessions |
| `ADR-002-truthful-save-states.md` | Completion UI requires confirmed persistence |
| `ADR-003-silence-as-default.md` | `null` is the correct default for coaching output |
| `ADR-004-double-progression.md` | All weighted exercises use double progression |
| `ADR-005-deterministic-recommendation.md` | Programme selection requires no LLM |

### `validation/`

Failure cases, regression rules, edge cases, acceptance criteria.

| Document | Covers |
|---|---|
| `onboarding-step1-equipment-access.md` | Step 1 UI spec and acceptance criteria |
| `onboarding-step2-training-goal.md` | Step 2 UI spec and acceptance criteria |
| `onboarding-step3-training-profile.md` | Step 3 UI spec and acceptance criteria |
| `onboarding-step4-focus-areas.md` | Step 4 UI spec and acceptance criteria |
| `onboarding-step5-bodyweight-progress.md` | Step 5 UI spec and acceptance criteria |

### `product/`

Philosophy, UX principles, branding, roadmap. Informs decisions but does not override specs.

| Document | Covers |
|---|---|
| `gainer-philosophy.md` | Core product values |
| `onboarding-philosophy.md` | Onboarding design intent |
| `ux-principles.md` | UX behavioral rules |
| `retention-philosophy.md` | Retention approach |
| `premium-philosophy.md` | Monetization ethics and free-tier definition |
| `coaching-intelligence-design.md` | GAINER AI behavioral intent (design reference) |
| `product-roadmap-phases.md` | Three-phase implementation roadmap |
| `your-plan-ready-review.md` | Plan-ready screen design intent |
| `manual-launch-tasks.md` | External launch checklist |

### `archive/`

Documents that must not influence implementation decisions.

| Document | Why archived |
|---|---|
| `premium-adaptive-coach-plan.md` | Proposes in-session AI (ADR-001 violation) |
| `superpowers/plans/` | Historical implementation plans, superseded |
| `superpowers/specs/` | Historical design specs, superseded |

---

## Document Authority Hierarchy

When documents conflict, this hierarchy resolves the conflict:

```
1. docs/adr/                     ← Highest. Finalized architectural decisions.
2. docs/source-of-truth/ files   ← Authoritative implementation specs.
3. docs/architecture/ files      ← System boundaries and data flow.
4. docs/validation/ files        ← Acceptance criteria and edge cases.
5. docs/product/ files           ← Design intent. Does not override specs.
6. docs/archive/ files           ← Ignored for implementation.
```

---

## Key Rules

1. **Every implementation responsibility has one owner.** See `documentation-architecture.md` §3.
2. **Source-of-truth files are marked with the Source of Truth header.**
3. **Archived files are marked with the Archived header.**
4. **New architectural decisions require an ADR before implementation.**
5. **The MVP boundary is in `mvp-launch-scope.md`. It is not negotiated inline.**
