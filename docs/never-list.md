# The never list: what makes a reader uninstall Vinha

Each line is an invariant a test must hold on every PR. The owner test is in
brackets. A new feature that touches one of these areas extends the owner test
rather than adding a parallel check.

## N1 A logged set is never lost

- A set the reader logged (reps/weight/seconds entered and ticked) survives:
  the app killed at any point, a phone restart, an app update, a failed save,
  resume, swap, superset edits, add/remove exercise mid-workout, correction of
  a logged set, finishing, and discarding only by explicit discard.
- After a successful save the session is in history with exactly the logged
  sets; after a failed save the session is still resumable and nothing is shown
  as saved.
  [workout lifecycle invariant: `tests/features/workout/workoutLifecycleInvariant.test.cjs`]

## N2 A workout can always be started and saved

- Starting any ready/custom programme day, freestyle or cardio never throws and
  never produces an unsaveable session; a save that fails says so and can be
  retried.
  [workout lifecycle invariant: `tests/features/workout/workoutLifecycleInvariant.test.cjs`;
  every ready programme day is also walked start to save in the same file]

## N3 The app opens on any data it ever wrote

- Every stored shape any released version wrote (both AsyncStorage keys,
  chunked via largeItem) loads without crashing; malformed/partial/truncated
  values degrade to safe defaults for that field only and never wipe readable
  data (the 273-workout "opened like a fresh install" class).
  [storage load invariant]

## N4 Sign-in never loops, locks out or leaks

- No account's data reaches another account's cloud copy without a yes; a
  revoked/deleted account has no access; INVALID_TOKEN/5xx/network never sign
  out; a fresh sign-in after deletion works.
  [account-safety invariant: `tests/features/account/accountSafetyInvariant.test.cjs`]

## N5 A backup restores what was backed up

- export, upload, download, restore gives back the same workouts, programmes,
  bodyweight, measurements, cardio, name book and settings (device-only fields
  excepted), across versions; a restore never silently drops newer local data
  without the reader choosing it.
  [backup round-trip invariant: next]

## N6 Success is never claimed before it happened

- Saved / backed up / deleted / restored states appear only after the write
  resolved (CLAUDE.md rule). Covered inside each invariant above; for the
  workout save, the lifecycle invariant checks that the finished mark, the
  completion summary and the summary route only appear once the session is on
  disk.

## Running the workout lifecycle invariant

```powershell
npx tsc -p tsconfig.test.json
node tests/run-tests.cjs
```

To reproduce a failure the test prints the shortest sequence and the
`WORKOUT_INVARIANT_SEED` / `WORKOUT_INVARIANT_SEQUENCES` / `WORKOUT_INVARIANT_REPLAY`
values that rerun it. `WORKOUT_INVARIANT_STATS=1` prints what the sequences
reached. Behaviours the driver found on main and lets through are named in the
test (`completed-session-blocks-start`, `freestyle-board-saved-twice`);
`WORKOUT_INVARIANT_STRICT=<name>` (or `all`) turns one into a failing invariant.
