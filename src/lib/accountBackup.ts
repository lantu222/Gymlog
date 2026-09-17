/**
 * The shape of a cloud backup — built here, parsed here, and nowhere else.
 *
 * The payload is the two AsyncStorage stores that matter: the app database
 * (minus the exercise library, which is regenerated on every load exactly as
 * the local save path strips it) and the workout history. The active session
 * is deliberately not backed up: a mid-workout snapshot restored onto another
 * phone is a workout the reader is not doing.
 *
 * Restore goes through the same normalizers as a local load, so a backup from
 * an older app version is handled the way an older local database is — with
 * defaults, not a crash.
 */
import { gunzipSync, gzipSync, strFromU8 } from 'fflate';

import type { AppDatabase, AppPreferences } from '../types/models';
import type { WorkoutHistoryStore } from '../features/workout/workoutTypes';
import { includeLeadInRunningSet, ONBOARDING_PLAN_PREFIX } from './activeProgramSet';
import { base64ToBytes, bytesToBase64 } from './base64';
import { DEVICE_ONLY_PREFERENCE_FIELDS, keepDeviceEntitlement } from './proEntitlement';
import { countAuthoredPrograms } from './programSlots';
import { utf8Encode } from './utf8';

export const ACCOUNT_BACKUP_VERSION = 1;

/**
 * Above this many characters of JSON, the upload is compressed.
 *
 * The endpoint caps a request body (4 MB, under Vercel's 4.5 MB), and the
 * history grows about 8 KB a session with nothing trimmed — plain JSON stopped
 * fitting at roughly 250 sessions under the old 2 MB cap, after which every
 * backup failed. Training logs are the same keys over and over and gzip to a
 * tenth of their size or less, so a compressed backup fits thousands of
 * sessions.
 *
 * Below the threshold the body stays plain JSON, exactly as before: every
 * build that can restore a backup today can still restore those.
 */
export const ACCOUNT_BACKUP_COMPRESS_ABOVE_CHARS = 1_000_000;

/** The one encoding a compressed backup uses. */
export const ACCOUNT_BACKUP_ENCODING = 'gzip-base64';

interface CompressedAccountBackup {
  encoding: typeof ACCOUNT_BACKUP_ENCODING;
  data: string;
}

export interface AccountBackupPayload {
  version: typeof ACCOUNT_BACKUP_VERSION;
  exportedAt: string;
  database: Omit<AppDatabase, 'exerciseLibrary'>;
  workoutHistory: WorkoutHistoryStore;
}

/** What one side of the restore question holds, counted the same way on both sides. */
export interface BackupContents {
  workoutCount: number;
  cardioCount: number;
  customProgramCount: number;
  /**
   * Catalog programmes taken up (a plan and no template row of their own), so
   * a phone whose only programme is an adopted one does not read as having none.
   */
  readyProgramCount: number;
  bodyweightCount: number;
  measurementCount: number;
}

/** What the restore dialog says, so the reader knows what they are accepting. */
export interface AccountBackupSummary extends BackupContents {
  exportedAt: string;
}

export function buildAccountBackupPayload(
  database: AppDatabase,
  workoutHistory: WorkoutHistoryStore,
  exportedAt: string,
): AccountBackupPayload {
  const { exerciseLibrary: _stripped, ...rest } = database;
  return {
    version: ACCOUNT_BACKUP_VERSION,
    exportedAt,
    // The coach-log deletes this phone still owes are its own errand, and
    // their labels are what the delete route asks for: they do not leave the
    // phone in a backup. A restore keeps the device's list either way
    // (DEVICE_ONLY_PREFERENCE_FIELDS).
    database: { ...rest, preferences: { ...rest.preferences, pendingAiLogDeletions: [] } },
    workoutHistory,
  };
}

/**
 * Whether a server response is a backup this app can restore. Shape-checks
 * only what this module itself relies on; field-level repair belongs to the
 * normalizers the restore path already runs.
 */
export function parseAccountBackupPayload(raw: unknown): AccountBackupPayload | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const candidate = raw as Partial<AccountBackupPayload>;
  if (candidate.version !== ACCOUNT_BACKUP_VERSION) {
    return null;
  }
  if (typeof candidate.exportedAt !== 'string' || !candidate.exportedAt) {
    return null;
  }
  if (!candidate.database || typeof candidate.database !== 'object') {
    return null;
  }
  if (!candidate.workoutHistory || typeof candidate.workoutHistory !== 'object') {
    return null;
  }
  return candidate as AccountBackupPayload;
}

/** The request body for an upload: plain JSON, or its compressed envelope once it is large. */
export function encodeAccountBackupBody(payload: AccountBackupPayload): string {
  const json = JSON.stringify(payload);
  if (json.length <= ACCOUNT_BACKUP_COMPRESS_ABOVE_CHARS) {
    return json;
  }
  const envelope: CompressedAccountBackup = {
    encoding: ACCOUNT_BACKUP_ENCODING,
    // Not fflate's strToU8: its no-TextEncoder fallback mangles emoji (lib/utf8).
    data: bytesToBase64(gzipSync(utf8Encode(json), { level: 6 })),
  };
  return JSON.stringify(envelope);
}

/**
 * What the server handed back, unwrapped when it is a compressed envelope.
 *
 * Anything else passes through untouched for `parseAccountBackupPayload` to
 * judge. An envelope that does not decompress to JSON comes back as null, so
 * it is refused like any other wrong-shaped download rather than thrown.
 */
export function decodeAccountBackupBody(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || (raw as { encoding?: unknown }).encoding !== ACCOUNT_BACKUP_ENCODING) {
    return raw;
  }
  const data = (raw as { data?: unknown }).data;
  if (typeof data !== 'string') {
    return null;
  }
  const bytes = base64ToBytes(data);
  if (!bytes) {
    return null;
  }
  try {
    return JSON.parse(strFromU8(gunzipSync(bytes)));
  } catch {
    return null;
  }
}

export function countBackupContents(
  database: Partial<
    Pick<AppDatabase, 'workoutSessions' | 'cardioSessions' | 'bodyweightEntries' | 'measurementEntries' | 'workoutTemplates' | 'workoutPlans'>
  >,
): BackupContents {
  const count = (list: unknown) => (Array.isArray(list) ? list.length : 0);
  const templates = Array.isArray(database.workoutTemplates) ? database.workoutTemplates : [];
  const templateIds = new Set(templates.map((template) => template.id));
  const readyIds = new Set<string>();
  for (const plan of Array.isArray(database.workoutPlans) ? database.workoutPlans : []) {
    if (!plan || typeof plan.id !== 'string' || plan.id.startsWith(ONBOARDING_PLAN_PREFIX)) {
      continue;
    }
    for (const entry of Array.isArray(plan.entries) ? plan.entries : []) {
      if (typeof entry?.workoutTemplateId === 'string' && !templateIds.has(entry.workoutTemplateId)) {
        readyIds.add(entry.workoutTemplateId);
      }
    }
  }
  return {
    workoutCount: count(database.workoutSessions),
    cardioCount: count(database.cardioSessions),
    // Authored programmes only. Every freestyle workout leaves a template
    // behind, and the dialog counted each one as a programme: a reader with
    // one plan and forty free workouts was told the backup held 41.
    customProgramCount: countAuthoredPrograms(templates),
    readyProgramCount: readyIds.size,
    bodyweightCount: count(database.bodyweightEntries),
    measurementCount: count(database.measurementEntries),
  };
}

export function describeAccountBackup(payload: AccountBackupPayload): AccountBackupSummary {
  return { exportedAt: payload.exportedAt, ...countBackupContents(payload.database as Partial<AppDatabase>) };
}

/**
 * What the restore-or-keep question shows: both sides, counted alike, so the
 * reader is not choosing between a number and a blank. Counting only this
 * phone's workouts made a phone of two hundred weigh-ins read "0 workouts",
 * and "Restore backup" look free.
 *
 * `workoutInProgress`: a restore puts away a workout or run that is still
 * going, so it is named too.
 *
 * `keepingLocalShrinksCloud` is the automatic backup's own line
 * (autoBackupWouldShrinkLog). Past it, "Use the data on this phone" is asked a
 * second time, naming what the cloud copy holds — one tap used to replace a
 * full history with a phone that had just been set up.
 */
export interface RestoreChoiceSummary {
  cloud: AccountBackupSummary;
  local: BackupContents & { workoutInProgress: boolean };
  keepingLocalShrinksCloud: boolean;
}

export function describeRestoreChoice(payload: AccountBackupPayload, local: AppDatabase, liveSession = false): RestoreChoiceSummary {
  return {
    cloud: describeAccountBackup(payload),
    local: { ...countBackupContents(local), workoutInProgress: liveSession },
    keepingLocalShrinksCloud: autoBackupWouldShrinkLog(countBackupItems(local), countBackupItems(payload.database)),
  };
}

/**
 * Whether a template is the programme setup wrote and nobody has touched
 * since: onboarding's own plan points at it, and its `updatedAt` never moved
 * (the same test findReplaceableOnboardingTemplateId uses).
 */
function isUntouchedOnboardingTemplate(
  template: AppDatabase['workoutTemplates'][number],
  planIds: ReadonlySet<string>,
): boolean {
  return (
    template.origin !== 'freestyle' &&
    template.createdAt === template.updatedAt &&
    planIds.has(`${ONBOARDING_PLAN_PREFIX}${template.id}`)
  );
}

/**
 * Whether the device has anything a restore would overwrite. A fresh install
 * restores without asking; a device with logged work gets the choice.
 *
 * What setup writes by itself is not logged work. A new phone is set up
 * before anyone thinks of signing in, and setup leaves a programme and the
 * weigh-in from its About form behind — so every new phone was asked
 * restore-or-keep, and "Use the data on this phone" replaced a year of
 * history with those two things (user decision 2026-09-17: such a phone
 * counts as empty). An edited programme, a second weigh-in, or one whose
 * weight is not setup's number is the reader's own, and asks.
 *
 * So does a workout or run in progress (`liveSession`). A restore replaces
 * the player's store and puts the live session away; once a setup-only phone
 * counted as empty, signing in mid-workout threw that workout out unasked.
 */
export function hasLocalDataWorthKeeping(database: AppDatabase, liveSession = false): boolean {
  if (
    liveSession ||
    database.workoutSessions.length > 0 ||
    database.cardioSessions.length > 0 ||
    // Measurements are logged by hand like the rest; a phone holding only
    // those was overwritten on sign-in without being asked.
    database.measurementEntries.length > 0
  ) {
    return true;
  }
  // Setup's own plan is onboarding's. Any other plan is a programme the
  // reader took up: adopting a ready programme writes a plan and no
  // template, so this is the only place it shows, and a phone running one
  // was restored over unasked. The running set is read through the plans:
  // an id with no plan behind it is not a programme — every fresh install
  // carries the seed's `plan_push_pull_legs` that way.
  const plans = database.workoutPlans ?? [];
  if (plans.some((plan) => !plan.id.startsWith(ONBOARDING_PLAN_PREFIX))) {
    return true;
  }
  const planIds = new Set(plans.map((plan) => plan.id));
  if (database.workoutTemplates.some((template) => !isUntouchedOnboardingTemplate(template, planIds))) {
    return true;
  }
  const setupWeight = database.preferences?.setupCurrentWeightKg ?? null;
  const weighIns = database.bodyweightEntries;
  if (weighIns.length > 1 || (weighIns.length === 1 && weighIns[0].weight !== setupWeight)) {
    return true;
  }
  return false;
}

/**
 * Preferences that are this phone's answer to a privacy question, and so are
 * not taken from a backup: whether usage statistics leave the phone, whether
 * the coach may keep a copy of what it is asked, and the label those copies
 * carry. A restore replaced them with whatever the other phone had said — a
 * reader who had switched statistics off on this phone found them on again,
 * and a "no" to the coach log became a "yes" nobody gave here.
 *
 * The consents default to no, so this phone's answer is the safe one. Usage
 * statistics default to yes: a new phone has "said" yes only because nobody
 * asked it, and taking its value turned the old phone's "no" into a yes. For
 * that one, either side's no wins.
 */
export const DEVICE_PRIVACY_PREFERENCE_FIELDS = [
  'usageStatisticsEnabled',
  'aiLogId',
  'aiLogChatConsent',
  'aiLogComposerConsent',
  'aiLogPhotoConsent',
] as const;

type DevicePrivacyField = (typeof DEVICE_PRIVACY_PREFERENCE_FIELDS)[number];

export function keepDevicePrivacyChoices<T extends Pick<AppPreferences, DevicePrivacyField>>(
  restored: T,
  device: Pick<AppPreferences, DevicePrivacyField>,
): T {
  const kept = { ...restored };
  for (const field of DEVICE_PRIVACY_PREFERENCE_FIELDS) {
    (kept as Record<string, unknown>)[field] = device[field];
  }
  kept.usageStatisticsEnabled = restored.usageStatisticsEnabled !== false && device.usageStatisticsEnabled !== false;
  return kept;
}

/**
 * The preferences a restore commits: the backup's, minus what belongs to
 * this phone (entitlement and meters, privacy answers), with the lead
 * programme counted in the running set the way a load counts it — the restore
 * normalized the backup but skipped that step, so a backup from before
 * activateOnboardingPlan restored with the cap undercounting by one.
 */
export function preferencesForRestore(
  restored: AppPreferences,
  device: AppPreferences,
  plans: ReadonlyArray<{ id: string; entries: ReadonlyArray<unknown> }>,
): AppPreferences {
  return includeLeadInRunningSet(keepDevicePrivacyChoices(keepDeviceEntitlement(restored, device), device), plans);
}

/**
 * A cheap summary of everything a backup carries, which changes when the
 * reader changes anything worth backing up.
 *
 * The automatic backup used to watch five counts, so a corrected workout, an
 * edited programme, a name taught to the book, a goal or a setting never
 * reached the cloud copy. The whole payload is megabytes, so it is not
 * serialized for this: the collections that are only ever added to or
 * removed from (exercise logs, a programme's exercise rows — which move with
 * their template's `updatedAt` — and the player's history) are counted, and
 * the small ones are hashed in full.
 *
 * Meters and privacy answers are left out: they are not restored anyway, and
 * each coach question would otherwise upload the whole history again.
 */
export function accountBackupFingerprint(database: AppDatabase, history: WorkoutHistoryStore): string {
  const hash = createHash();
  const preferences: Record<string, unknown> = { ...database.preferences };
  for (const field of [...DEVICE_ONLY_PREFERENCE_FIELDS, ...DEVICE_PRIVACY_PREFERENCE_FIELDS]) {
    delete preferences[field];
  }
  hash.add(JSON.stringify(preferences));
  hash.add(JSON.stringify(database.exerciseNameBook ?? null));
  hash.add(JSON.stringify(database.workoutPlans ?? null));
  hash.add(JSON.stringify(database.bodyweightEntries ?? null));
  hash.add(JSON.stringify(database.measurementEntries ?? null));
  hash.add(JSON.stringify(database.cardioSessions ?? null));
  for (const template of database.workoutTemplates ?? []) {
    hash.add(`${template.id}|${template.updatedAt}|${template.name}|${template.origin}`);
  }
  // Only the name, notes and feel of a saved workout can be edited.
  for (const session of database.workoutSessions ?? []) {
    hash.add(`${session.id}|${session.workoutNameSnapshot}|${session.sessionNotes ?? ''}|${session.feel ?? ''}`);
  }
  const newest = history.sessions?.[0];
  hash.add(
    [
      database.exerciseTemplates?.length ?? 0,
      database.exerciseLogs?.length ?? 0,
      history.sessions?.length ?? 0,
      newest ? `${newest.sessionId}@${newest.performedAt}` : '',
      Object.keys(history.slotHistory ?? {}).length,
      history.lastSelectedTemplateId ?? '',
    ].join('|'),
  );
  return hash.digest();
}

/** cyrb53, fed piece by piece so no multi-megabyte string is ever built. */
function createHash() {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  const feed = (code: number) => {
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  };
  return {
    add(text: string) {
      for (let index = 0; index < text.length; index += 1) {
        feed(text.charCodeAt(index));
      }
      // A separator, so ["ab", "c"] and ["a", "bc"] differ.
      feed(0x1f);
    },
    digest(): string {
      let a = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
      a ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
      let b = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
      b ^= Math.imul(a ^ (a >>> 13), 3266489909);
      return (4294967296 * (2097151 & b) + (a >>> 0)).toString(36);
    },
  };
}

/**
 * How much of the log a database holds, for the shrink guard: workouts,
 * cardio, bodyweight, measurements and programmes. Missing arrays (an old
 * backup) count as none.
 */
export function countBackupItems(
  database: Partial<Pick<AppDatabase, 'workoutSessions' | 'cardioSessions' | 'bodyweightEntries' | 'measurementEntries' | 'workoutTemplates'>>,
): number {
  return (
    (database.workoutSessions?.length ?? 0) +
    (database.cardioSessions?.length ?? 0) +
    (database.bodyweightEntries?.length ?? 0) +
    (database.measurementEntries?.length ?? 0) +
    (database.workoutTemplates?.length ?? 0)
  );
}

/**
 * Whether an automatic backup would replace a cloud copy holding far more of
 * the log than this phone does.
 *
 * The automatic backup fires on any change. A phone whose database
 * was set aside as unreadable opens empty and still signed in; the reader
 * redoes setup or logs one workout, and eight seconds later the one full copy
 * left was replaced by that. Less than half of a copy of at least three
 * things is not a reader tidying their history — the automatic path stops,
 * and "Back up now" stays the reader's own decision.
 *
 * Counted over everything the backup watches (countBackupItems), not workouts
 * alone: a reader with two workouts and a year of weigh-ins was never
 * protected by a workout count (PR #119 review).
 */
export function autoBackupWouldShrinkLog(localItemCount: number, lastBackupItemCount: number | null): boolean {
  if (lastBackupItemCount === null || lastBackupItemCount < 3) {
    return false;
  }
  return localItemCount * 2 < lastBackupItemCount;
}

/** What this phone knows about the cloud copy (its stored account). */
export interface BackupSyncState {
  lastBackupAt: string | null;
  lastBackupItemCount: number | null;
  /** Set by "Delete cloud backup"; only the reader's own backup lifts it. */
  autoBackupPaused: boolean;
}

/**
 * What a backup does before it touches the network: stay out, read the cloud
 * copy first, or upload.
 *
 * "Back up now" used to upload without either check, so a phone whose
 * database had been set aside as unreadable — open, empty, still signed in —
 * replaced the one good copy with nothing when the reader pressed it to be
 * safe. Now a shrinking upload reads the copy first and, from there, asks
 * (decideAfterLook). The automatic backup does not ask, so it stays out.
 */
export function planBackup(input: {
  interactive: boolean;
  sync: BackupSyncState;
  localItemCount: number;
}): 'skip' | 'look' | 'upload' {
  const { interactive, sync, localItemCount } = input;
  if (!interactive && sync.autoBackupPaused) {
    // The reader deleted the cloud copy. Writing it back eight seconds after
    // the next weigh-in would undo that without a word.
    return 'skip';
  }
  if (!sync.lastBackupAt || sync.lastBackupItemCount === null) {
    // Never synced (what is there has not been seen), or synced before the
    // size of the copy was kept (nothing to compare against).
    return 'look';
  }
  if (autoBackupWouldShrinkLog(localItemCount, sync.lastBackupItemCount)) {
    return interactive ? 'look' : 'skip';
  }
  return 'upload';
}

export type BackupLookResult = { kind: 'backup'; itemCount: number } | { kind: 'none' } | { kind: 'unreachable' };

/**
 * What a backup does once it has read the cloud copy.
 *
 * - 'settle': never synced and the reader is here — sign-in's own question.
 * - 'ask': this upload would shrink the copy — the restore-or-keep question.
 * - 'hold': the same, unattended — keep the copy and remember its size.
 * - 'upload', or 'fail' when nothing may be written.
 *
 * Unattended, a phone that has never synced uploads only onto a confirmed
 * "no backup"; a copy it has not seen is not overwritten by nobody's decision.
 */
export function decideAfterLook(input: {
  interactive: boolean;
  neverSynced: boolean;
  remote: BackupLookResult;
  localItemCount: number;
}): 'settle' | 'ask' | 'hold' | 'upload' | 'fail' {
  const { interactive, neverSynced, remote, localItemCount } = input;
  if (neverSynced) {
    if (interactive) {
      return 'settle';
    }
    return remote.kind === 'none' ? 'upload' : 'fail';
  }
  if (remote.kind === 'unreachable') {
    return 'fail';
  }
  if (remote.kind === 'backup' && autoBackupWouldShrinkLog(localItemCount, remote.itemCount)) {
    return interactive ? 'ask' : 'hold';
  }
  return 'upload';
}
