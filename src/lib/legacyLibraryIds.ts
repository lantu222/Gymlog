/**
 * The twenty hand-written library rows that predate the generated library.
 *
 * They lived in `src/data/seed.ts` as `lib_*` entries carrying FINNISH names in
 * the field that is an English id everywhere else — `Takakyykky`, `Maastaveto`,
 * `Kulmasoutu`. Every one of them is a second copy of a row the generated
 * library already has, and their Finnish names are already what
 * `EXERCISE_NAME_FI` returns for the English original: `Barbell Squat` reads
 * "Takakyykky" without any help from `lib_back_squat`.
 *
 * Measured before removing them (2026-09-01), because "unused" is a claim:
 *
 * - Not browsable. `exerciseBrowserItems` filtered every `lib_*` row out.
 * - Zero of the catalog's 275 prescribed names resolved to one.
 * - No free-text exercise name entry exists anywhere in the app — every
 *   `TextInput` is a search field or a kg/reps field.
 * - The CSV importer, the one path that takes a typed name, is handed the
 *   filtered library too.
 *
 * So nothing could reach them, and they only sat in the unfiltered library
 * where a future resolver might have picked one and handed back an id no
 * screen can open.
 *
 * What could NOT be measured from here is whether an install old enough to
 * predate that filter has an exercise logged against one of these ids. A
 * dangling id degrades rather than crashes — history renders
 * `exerciseNameSnapshot`, and `getExerciseTemplateDefaults` takes `undefined` —
 * but it would silently cost that lift its picture, its instructions and its
 * history match. This table is the answer to the one thing the measurement
 * could not settle: fourteen lines of insurance instead of a shrug.
 */

/** Old id → the generated library row it was always a copy of. */
const LEGACY_LIBRARY_IDS: Record<string, string> = {
  lib_bench_press: 'Barbell Bench Press - Medium Grip',
  lib_incline_bench: 'Incline Dumbbell Press',
  lib_barbell_row: 'Bent Over Barbell Row',
  lib_ohp: 'Standing Military Press',
  lib_lateral_raise: 'Side Lateral Raise',
  lib_lat_pulldown: 'Wide-Grip Lat Pulldown',
  lib_pull_up: 'Pullups',
  lib_biceps_curl: 'Dumbbell Bicep Curl',
  lib_triceps_pushdown: 'Triceps Pushdown - Rope Attachment',
  lib_dips: 'Parallel Bar Dip',
  lib_back_squat: 'Barbell Squat',
  lib_deadlift: 'Barbell Deadlift',
  lib_rdl: 'Romanian Deadlift',
  lib_leg_press: 'Leg Press',
  lib_leg_extension: 'Leg Extensions',
  lib_leg_curl: 'Lying Leg Curls',
  lib_calf_raise: 'Standing Calf Raises',
  lib_crunch: 'Crunches',
  lib_plank: 'Plank',
  lib_bike: 'Bicycling',
};

/**
 * The English NAME each retired id pointed at.
 *
 * A name rather than an id, because the generated library's ids are rebuilt
 * from `generatedExerciseLibrary.ts` on every load and a name is the stable
 * thing to match on — the same reason every other layer in this app keys on
 * the English name.
 */
export const LEGACY_LIBRARY_ID_TARGETS = LEGACY_LIBRARY_IDS;

/**
 * Retired id → the live id of the row it named, against a given library.
 *
 * Built per load rather than hard-coded, because the generated library's ids
 * are rebuilt from `generatedExerciseLibrary.ts` every time — a baked id would
 * be right until the generator renumbered.
 *
 * A retired id whose target is missing is left out rather than mapped to
 * nothing: the stored id then stays as it was, which is the same dangling-but-
 * harmless state it would have had anyway, and the suite fails long before a
 * build ships in that condition.
 */
export function buildRetiredLibraryIdRemap(
  library: readonly { id: string; name: string }[],
): Record<string, string> {
  const byName = new Map(library.map((item) => [item.name, item.id]));
  const remap: Record<string, string> = {};
  for (const [oldId, name] of Object.entries(LEGACY_LIBRARY_IDS)) {
    const liveId = byName.get(name);
    if (liveId) {
      remap[oldId] = liveId;
    }
  }
  return remap;
}
