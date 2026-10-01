# Shell split — phase C brief and tools

This branch (`tools/shell-split`) is not meant to merge. It is the shared brief and tool kit for the parallel sessions doing phase C of the App.tsx split. Phase B (#248, squash 82fda64) is the model: read its PR description, and `phase-b-plan.json` (principles, deferred list) for background.

## The rules (same as phase B)

- **Pure refactor, zero behaviour change.** Moved lines are byte-identical: comments, eslint-disable lines and deps arrays, including known-stale ones. They keep the same 2-space indentation as in VinhaApp. No renames, no added or removed useMemo/useCallback, no deps fixes, no dead-code removal, no comment re-homing. A bug you find goes in your PR description's "found, not fixed" list.
- **Same slot.** A hook is called exactly where its first moved line stood, so the flattened hook order is unchanged. No hook goes below an early return (`if (!nativeSplashHidden || !hydrated || !workout.hydrated) return <LaunchScreen />`, and the brand-splash return further down). Below the early return only plain functions are possible: render functions in phase-A style, or factories.
- **Hoisting.** If a VinhaApp `function` declaration becomes a binding returned by a hook or factory call, list every reference to it in App.tsx. Prove that each one is below the call at top level, or inside a closure that cannot run during render before the call. If you cannot prove it, don't move that declaration.
- **Where code goes.** New modules live flat in `src/app/` (readAppWiring reads one level deep). Use `.ts` unless a type forces `.tsx`; a `.ts` module never imports a `.tsx`, App.tsx or `./modules/*`. `src/lib` stays pure. Anything new in `src/lib` gets a `tests/lib` suite registered in `tests/run-tests.cjs`.
- **Test pins.** Re-home a pin on code that moves in a tests-only commit before the move commit. That commit must be green on the unmoved code. Use `readAppWiring()` (tests/helpers/appWiringSource.cjs) or the new file, and the bounded helpers in `tests/helpers/sourceSlices.cjs` (`between`, `functionBody`, `windowBefore`). Never weaken an assertion. An absence pin needs a presence assertion proving its slice covers the code. Move commits touch no test.
- **Commits.** Repo-style descriptive titles. Trailers as your session's attribution reminder says.

## Tools (copy them out of this branch)

```bash
mkdir -p "$SCRATCH/ss" && git fetch -q origin tools/shell-split && git archive origin/tools/shell-split shell-split | tar -x -C "$SCRATCH/ss"
```

All tools run from the repo root and need `node_modules` (run `npm ci --ignore-scripts` once).

| Tool | Use |
|---|---|
| `hook-order.cjs <base> [<head>]` | Flattens VinhaApp's hook calls, inlining every `src/app` use* hook, and compares kind + deps text + body hash + order. Must print OK against the commit you started from. |
| `verify-moves.cjs <base> [<head>]` | Every line removed and not re-added, and every added line that was not moved. The first list may hold only import lines; the second only scaffolding (imports, header doc, Deps interface, signature, `const { … } = deps;`, `return { … };`, shorthand call site). |
| `boundary-audit.cjs <suite-list>` with `RANGES='[[a,b],…]'` | Run at the **unmoved** base. Flags slices whose start or end anchor lies in the line ranges you will move. A slice whose end is in moved code silently grows after the move: this is the phase-B bug class. Suite list: `node -e "…"` listing every `tests/**/*.test.cjs`, or the files `tests/run-tests.cjs` requires. |
| `slice-drift.cjs <suite-list> <out.json>` + `slice-drift-compare.cjs base.json head.json` | Records every slice length per suite at base and head. Run each in its own checkout (`git worktree add`). Review every GREW: an intermediate "to end of file" slice that grew is fine if the final bounded slice did not. |
| `pin-audit.cjs <a-b> <c-d> …` | Run at the unmoved base. Lists every pin (POS) or absence lookup (NEG) whose text covers the given App.tsx line ranges, and whether it reads App.tsx alone or the wiring. |
| `resolve-imports.py <file>` | Resolves merge-conflict blocks that hold only single-line import statements (ours + theirs, de-duplicated). |

Also compare `npx tsc --noEmit -p tsconfig.json --noUnusedLocals`, every TS6xxx code (TS6133 **and** TS6192), against your base. The diagnostics must match exactly.

Full suite: `npx tsc -p tsconfig.test.json && TZ=Europe/Helsinki node tests/run-tests.cjs`, which is what CI runs. In UTC two DST tests fail by design. The machine has 4 CPUs, so a workflow runs 2 agents at a time. Run the full suite once per commit, not in loops.

## Phase C: who owns what

Line numbers are App.tsx at main 82fda64. Re-locate by identifier, because main will move. **Touch only your own identifiers.** Other sessions are moving the rest of VinhaApp at the same time. If something you need to move is not on your list, leave it and say so in your PR.

| Session | Owns | Do first |
|---|---|---|
| **C1 overlay-back-widget** | hand-off/legal holders (~893-925: `handoffLegalDocument`, `legalConsentDueRef`, `legalSheetHeld`, `handoffLegalOpenRef`, `setupHandoffActiveRef`); the BackHandler effects (~991-1095, the route-level back listener and the hand-off-legal back effect); the widget pin-state effect (~3640) and `handleAddHomeWidget`; the hand-off plan, legal consent, first-run tour, `handleServerNoticeSeen`, `appUpdateHeld`, `renderLegalConsent` (~3694-3896); their effects (~3897); `handleSetupHandoffDone`; the widget feed (`widgetSuggestion` … its effect, ~4005-4098); the widget taps (`pendingWidgetTarget` and its two effects, ~4099-4211) | Re-anchor the listener-precedence pins in setupHandoff, settingsSurfaces and onboardingEntryAndSaves ("first listener"), and liveWorkoutWiring (end anchor searched from the start of the file), plus the unasserted end anchors in appUpdateGate and firstRunTourWiring. The render-phase ref writes (`setupHandoffActiveRef.current = …`, the held-plan ref) stay where they are, or move only if order is provably kept. `./modules/home-widget` functions must be injected, not imported from `src/app/*.ts`. |
| **C2 programme-handlers** | session starts and helpers (`handleDeleteCompletedSession` 1340 … `handlePickTodaySession` 2296, **excluding** `navigateToActiveWorkout`, `isActiveSessionFor`, `getWorkoutLoggerFallbackRoute`, `handleDiscardWorkout`, `handleConfirmFinishWorkout`); `programCapLine`; `buildCustomProgrammePlan` … `leaveDeletedProgramme` (2395-2522); the onboarding finishes and photo import (`handleOnboardingPickReadyProgram` 2523 … `handleSetupCompleteToTraining`, ~2936) | A tests-only commit that widens and bounds the App-only pins spanning these: programLimitNotice's exact count of 4 `setRunningCapSheet` blocks, routeHistory's slice ending at `handleOnboardingPickReadyProgram`, audit3Promises' `-1 < n` ordering, programImageImport's slice to end of file, and any remaining next-declaration slices. These are ~1,500 lines of hoisted `function` declarations, so the hoisting rule decides what can move. Splitting into factories (as `createProgrammeDayEdits` did) is expected. |
| **C3 home-derivations** | `homeActivePlanCard` (3105) through `progressWeeklyTarget` (3470); `homeTrainingDayIndexes`, `homeDoneThisWeekSessionIds`, `baseTrainingSchedule`, `homeTrainingSchedule` (3480-3577); `exportablePlans` (4217) through `programsRecommendations` (~4793), with `dismissedTipIds`; `handleEnrolSeason`; `programsCustomItems` (4834) | homeScreenStructure's remaining unbounded spans, and the programFingerprint / runningProgrammeTitle counts that read App.tsx alone. `homeActivePlanCard` has no exported type: derive it (`ReturnType`) rather than hand-writing one. The seven unread Home memos stay (dead-code deletion is a separate PR). |
| **C4 finish-machine** | `completionSummary`, `ratingSheetVisible`, `finishSaveState` state; the finish refs (`summaryExitRouteRef`, `summaryNavigationPendingRef`, `finishInFlightRef`, `completionCountedRef`); `leaveFinishedWorkout`, `maybeAskForRating`; the finishSaveState reset effect (~761) and the route-guard effect (~774-872); `handleDiscardWorkout`, `handleConfirmFinishWorkout` (1185-1339); `finishLoggedWorkoutSave` (below the early return, so a factory, not a hook) | No test pins the route guard's body today. First add a characterization suite (tests/helpers/hookHarness.cjs exists), **or** extract the guard's decision into a pure `src/lib` function with its own `tests/lib` suite, as a separate first commit or PR. historyBelongsToLift pins handler adjacency in App.tsx, so re-home it. |
| **C5 render-tail** | everything from `let content` (5073) to the end of VinhaApp: the onboarding branch (5075-5558), the HomeScreen fallback (5559-5785), the active flags, `shellSafeAreaEdges` and the shell JSX. Render functions only (phase-A style `renderX(deps)`), since this is below the early return. | Upgrade audit3DeadScreens (route guard mapped to "the next element within 900 characters"), and the indentation-literal JSX pins (swapShortlist, exerciseSheet's call site, milestonesScreen's call site, coachDemoMoments, programLimitNotice's fixed file list). C2, C3 and C4 rename nothing, so the JSX keeps its prop names. |
| **C6 small-leaves** | `coachDemoMoment`, `coachDemoQuestion`, `premiumTrialEndsAt`, `analysisSessionId`, `coachLastSession` (2965-3017); `availableEquipmentForDrills`, `routineBlockSeconds`, `routineSecondsForExercises` (3018-3063); the setup readings `setupSelectionKey` … `recommendedReadyContent` (3064-3104); the lead-plan repair effect (~3624, "Home must never say 'find a programme'…"); `templateBuilderDraft` (4937) | routineDrillSwap's hand-written file list has no minimum count, so it goes vacuous once the builders leave App.tsx: fix that first. Re-anchor appWrittenNamesTranslated's templateBuilderDraft slice, which ends at the early return. |

**Not in phase C:**
- the navigation core (`navigationState`, `route`, `navigate`, `replaceRoute`, `resetToRoute`, `resolveTabRoute`, `navigateToTab`, `navigateToGuidedWorkout`, `navigateBack`, `showToast`, `navigateToActiveWorkout`, `isActiveSessionFor`, `getWorkoutLoggerFallbackRoute`);
- the launch gate (splash and font effects ~540-606);
- the top-level state other clusters share;
- the onboarding-reset effect (~887);
- the account-name effect (~3921).

Those are phase D, after C lands.

## Coordination

- **One branch and one PR per session**, from origin/main. Run `/code-review` before opening the PR. Do not merge your PR; the orchestrating session or the user does.
- **When main moves** (another session's PR merged), merge origin/main into your branch; never rebase a pushed branch. Import-block conflicts are mechanical (`resolve-imports.py`). If someone else's change landed in code you moved, port it into your module verbatim, the way #244's `cautionFlags` lines went into `useCoachContext`. Then re-run every check against the new origin/main.
- **Do not post to Slack.** List any bugs you find in the PR description.
