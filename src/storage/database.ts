import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizeSeasonEnrolments } from '../lib/seasonEnrolment';
import { normalizeStrengthGoals } from '../lib/strengthGoals';
import { normalizeCancelSurveyAnswer } from '../lib/cancelSurvey';
import { isSubscriptionTermKey } from '../lib/subscriptionView';
import { createEmptyDatabase } from '../data/seed';
import { resolveDeviceLanguage } from './deviceLocale';
import { normalizeExerciseLog } from '../lib/exerciseLog';
import { buildLegacyTemplateSessions, getLegacyTemplateSessionId } from '../lib/workoutTemplateSessions';
import {
  AppDatabase,
  AppPreferences,
  ExerciseTemplate,
  MeasurementEntry,
  SetupCautionFlag,
  WorkoutTemplate,
  WorkoutTemplateSessionRecord,
} from '../types/models';

const CAUTION_AREAS = ['neck', 'shoulders', 'elbows', 'wrists', 'lower_back', 'hips', 'knees', 'ankles'] as const;
const CAUTION_LEVELS = ['info', 'careful', 'avoid'] as const;

function normalizeSetupCautionFlags(value: unknown, fallback: SetupCautionFlag[]): SetupCautionFlag[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const flags: SetupCautionFlag[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const area = (entry as { area?: unknown }).area;
    const level = (entry as { level?: unknown }).level;
    if (!CAUTION_AREAS.includes(area as (typeof CAUTION_AREAS)[number])) {
      continue;
    }
    if (!CAUTION_LEVELS.includes(level as (typeof CAUTION_LEVELS)[number])) {
      continue;
    }
    if (flags.some((flag) => flag.area === area)) {
      continue;
    }
    const refinements = (entry as { refinements?: unknown }).refinements;
    flags.push({
      area: area as SetupCautionFlag['area'],
      level: level as SetupCautionFlag['level'],
      refinements: Array.isArray(refinements)
        ? refinements
            .filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
            .slice(0, 6)
        : [],
    });
  }

  return flags.slice(0, CAUTION_AREAS.length);
}

const STORAGE_KEY = '@vinha/database/v1';
/**
 * The key this app used before the rename. Read once, on a first load that
 * finds nothing under the new one, and then written forward.
 *
 * Nobody has shipped, so in principle this is dead code. It is here because
 * the cost of being wrong about that is every workout somebody ever logged,
 * and the cost of being right is four lines.
 */
const LEGACY_STORAGE_KEY = '@gymlog/database/v1';
/**
 * Where an unreadable database is put before an empty one takes its place.
 *
 * Overwriting is not optional — the app cannot open without a database — but
 * throwing the old bytes away is. Whatever could not be parsed is still every
 * workout that person logged, and a support mail can only ever be answered from
 * the copy. One slot: a second corruption after the first is not a longer
 * history to recover, and an unbounded pile of them is a storage leak.
 */
const CORRUPT_STORAGE_KEY = '@vinha/database/corrupt';
/**
 * Preferences, on their own key.
 *
 * Everything used to live in one blob, so changing the theme or the language —
 * one field — serialized every logged session, set and measurement the reader
 * owned, on the JS thread, before the toggle could settle. The cost grew with
 * the training history, which is why the app felt fine at first and slow later.
 *
 * The blob still carries a copy: a full save writes the whole database and the
 * preferences it holds are current, so nothing there goes stale. This key is
 * simply the newer one, and the load overlays it on top.
 */
const PREFERENCES_STORAGE_KEY = '@vinha/preferences/v1';

function normalizeJointSwapPreference(rawValue: unknown, fallbackValue: 'neutral' | 'prefer' | 'prioritize') {
  if (rawValue === 'neutral' || rawValue === 'prefer' || rawValue === 'prioritize') {
    return rawValue;
  }

  if (rawValue === true) {
    return 'prefer';
  }

  if (rawValue === false) {
    return 'neutral';
  }

  return fallbackValue;
}

/**
 * The reader's set of running programmes, migrated forward.
 *
 * Databases written before programmes became a set have no `activePlanIds` at
 * all — only the single `activePlanId`. Seeding the list from it means an
 * existing reader opens the new build already running exactly the programme
 * they were running before, with one slot of the cap used rather than zero.
 */
function normalizeActivePlanIds(rawValue: unknown, legacyActivePlanId: unknown): string[] {
  if (Array.isArray(rawValue)) {
    const ids = rawValue.filter((value: unknown): value is string => typeof value === 'string' && value.length > 0);
    // Stored duplicates would silently eat a cap slot.
    return Array.from(new Set(ids));
  }

  return typeof legacyActivePlanId === 'string' && legacyActivePlanId.length > 0 ? [legacyActivePlanId] : [];
}

function normalizeTemplateSessions(
  template: any,
  templateExercises: ExerciseTemplate[],
): WorkoutTemplateSessionRecord[] {
  const rawSessions = Array.isArray(template?.sessions) ? template.sessions : [];
  const fallbackSessions = buildLegacyTemplateSessions(
    { id: String(template?.id ?? ''), name: String(template?.name ?? 'Workout') },
    templateExercises,
  );

  const sessions = rawSessions.length ? rawSessions : fallbackSessions;

  return sessions
    .map((session: any, index: number) => ({
      id: typeof session?.id === 'string' && session.id.trim().length ? session.id : `${template.id}_session_${index + 1}`,
      name: typeof session?.name === 'string' && session.name.trim().length ? session.name.trim() : index === 0 ? String(template?.name ?? 'Workout') : `Session ${index + 1}`,
      orderIndex: typeof session?.orderIndex === 'number' ? session.orderIndex : index,
      exerciseIds: Array.isArray(session?.exerciseIds)
        ? session.exerciseIds.filter((value: unknown): value is string => typeof value === 'string')
        : [],
    }))
    .sort((left: WorkoutTemplateSessionRecord, right: WorkoutTemplateSessionRecord) => left.orderIndex - right.orderIndex);
}

function mergeExerciseLibrary(
  inputLibrary: AppDatabase['exerciseLibrary'] | null | undefined,
  fallbackLibrary: AppDatabase['exerciseLibrary'],
) {
  const merged = new Map<string, AppDatabase['exerciseLibrary'][number]>();

  fallbackLibrary.forEach((item) => {
    merged.set(item.id, item);
  });

  if (Array.isArray(inputLibrary)) {
    inputLibrary.forEach((item) => {
      if (!item || typeof item.id !== 'string' || !item.id.trim().length) {
        return;
      }

      merged.set(item.id, {
        ...merged.get(item.id),
        ...item,
      });
    });
  }

  return Array.from(merged.values());
}

/**
 * The reader's hand-picked session for one day.
 *
 * No fallback: this is deliberately not carried forward from defaults. It
 * describes one calendar day, and a value that cannot be read is a value that
 * has no day — so it becomes "no override" and the rotation answers, which is
 * what it does on every other day anyway.
 */
function normalizeTodaySession(value: unknown): { dayStart: number; sessionId: string } | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const raw = value as { dayStart?: unknown; sessionId?: unknown };
  if (typeof raw.dayStart !== 'number' || !Number.isFinite(raw.dayStart) || typeof raw.sessionId !== 'string') {
    return null;
  }
  return raw.sessionId ? { dayStart: raw.dayStart, sessionId: raw.sessionId } : null;
}

/**
 * A stored training cycle, or the fallback when the stored value cannot be one.
 *
 * A cycle with no training day in it would stop the app dead — every day a rest
 * day, forever — so an all-false pattern is read as "no cycle" rather than
 * honoured. The length cap is a sanity bound, not a product rule: nothing can
 * write a 400-day rhythm through the editor, but a corrupt file could.
 */
function normalizeTrainingCycle(
  value: unknown,
  fallbackValue: { pattern: boolean[]; anchorDayStart: number } | null,
): { pattern: boolean[]; anchorDayStart: number } | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'object' || value === undefined) {
    return fallbackValue;
  }
  const raw = value as { pattern?: unknown; anchorDayStart?: unknown };
  if (!Array.isArray(raw.pattern) || typeof raw.anchorDayStart !== 'number' || !Number.isFinite(raw.anchorDayStart)) {
    return fallbackValue;
  }
  const pattern = raw.pattern.slice(0, 60).map((day) => day === true);
  if (!pattern.some(Boolean)) {
    return null;
  }
  return { pattern, anchorDayStart: raw.anchorDayStart };
}

function boolOr(value: unknown, fallbackValue: boolean): boolean {
  return typeof value === 'boolean' ? value : fallbackValue;
}

export function normalizeDatabase(input: Partial<AppDatabase> | null | undefined): AppDatabase {
  // Defaults for missing fields only. The empty database is the right source:
  // the demo seed's fabricated plan id would otherwise become the fallback for
  // a stored database that had no activePlanId of its own.
  const fallback = createEmptyDatabase();

  const rawExerciseTemplates: ExerciseTemplate[] = Array.isArray(input?.exerciseTemplates)
    ? input.exerciseTemplates.map((exercise: any) => ({
        id: String(exercise?.id ?? ''),
        workoutTemplateId: String(exercise?.workoutTemplateId ?? ''),
        workoutTemplateSessionId:
          typeof exercise?.workoutTemplateSessionId === 'string' ? exercise.workoutTemplateSessionId : '',
        name: typeof exercise?.name === 'string' ? exercise.name : 'Exercise',
        targetSets: typeof exercise?.targetSets === 'number' ? exercise.targetSets : 3,
        repMin: typeof exercise?.repMin === 'number' ? exercise.repMin : 6,
        repMax: typeof exercise?.repMax === 'number' ? exercise.repMax : 8,
        restSeconds: typeof exercise?.restSeconds === 'number' ? exercise.restSeconds : null,
        trackedDefault: typeof exercise?.trackedDefault === 'boolean' ? exercise.trackedDefault : true,
        orderIndex: typeof exercise?.orderIndex === 'number' ? exercise.orderIndex : 0,
        libraryItemId: typeof exercise?.libraryItemId === 'string' || exercise?.libraryItemId === null ? exercise.libraryItemId : null,
        persistedExerciseTemplateId:
          typeof exercise?.persistedExerciseTemplateId === 'string' || exercise?.persistedExerciseTemplateId === null
            ? exercise.persistedExerciseTemplateId
            : undefined,
      }))
    : [];

  const rawTemplates: WorkoutTemplate[] = Array.isArray(input?.workoutTemplates)
    ? input.workoutTemplates.map((template: any) => {
        const templateId = String(template?.id ?? '');
        const templateExercises = rawExerciseTemplates.filter((exercise) => exercise.workoutTemplateId === templateId);
        const sessions = normalizeTemplateSessions(template, templateExercises);

        return {
          id: templateId,
          name: typeof template?.name === 'string' && template.name.trim().length ? template.name.trim() : 'Workout',
          exerciseIds: Array.isArray(template?.exerciseIds)
            ? template.exerciseIds.filter((value: unknown): value is string => typeof value === 'string')
            : templateExercises.map((exercise) => exercise.id),
          sessions,
          createdAt: typeof template?.createdAt === 'string' ? template.createdAt : new Date().toISOString(),
          updatedAt: typeof template?.updatedAt === 'string' ? template.updatedAt : new Date().toISOString(),
          // Anything stored before this field existed was written by the
          // editor or by freestyle logging, and there is no way to tell which
          // after the fact. 'authored' is the safe default: it counts, which
          // is how those rows already behaved.
          origin: template?.origin === 'freestyle' ? 'freestyle' : 'authored',
        };
      })
    : [];

  const normalizedExerciseTemplates = rawExerciseTemplates.map((exercise) => {
    const template = rawTemplates.find((item) => item.id === exercise.workoutTemplateId);
    const resolvedSessionId =
      template?.sessions.find((session) => session.id === exercise.workoutTemplateSessionId)?.id ??
      template?.sessions.find((session) => session.exerciseIds.includes(exercise.id))?.id ??
      template?.sessions[0]?.id ??
      getLegacyTemplateSessionId(exercise.workoutTemplateId);

    return {
      ...exercise,
      workoutTemplateSessionId: resolvedSessionId,
    };
  });

  const normalizedTemplates = rawTemplates.map((template) => {
    const templateExercises = normalizedExerciseTemplates.filter((exercise) => exercise.workoutTemplateId === template.id);
    const sessions = template.sessions.map((session) => ({
      ...session,
      exerciseIds: templateExercises
        .filter((exercise) => exercise.workoutTemplateSessionId === session.id)
        .sort((left, right) => left.orderIndex - right.orderIndex)
        .map((exercise) => exercise.id),
    }));

    return {
      ...template,
      sessions,
      exerciseIds: sessions.flatMap((session) => session.exerciseIds),
    };
  });

  return {
    workoutTemplates: normalizedTemplates,
    exerciseTemplates: normalizedExerciseTemplates,
    workoutPlans: Array.isArray(input?.workoutPlans)
      ? input.workoutPlans.map((plan: any) => ({
          ...plan,
          entries: Array.isArray(plan?.entries)
            ? plan.entries.map((entry: any) => ({
                ...entry,
                workoutTemplateSessionId:
                  typeof entry?.workoutTemplateSessionId === 'string' && entry.workoutTemplateSessionId.trim().length
                    ? entry.workoutTemplateSessionId
                    : null,
              }))
            : [],
        }))
      : [],
    exerciseLibrary: mergeExerciseLibrary(input?.exerciseLibrary, fallback.exerciseLibrary),
    workoutSessions: Array.isArray(input?.workoutSessions)
      ? input.workoutSessions.map((session: any) => ({
          id: String(session?.id ?? ''),
          workoutTemplateId: String(session?.workoutTemplateId ?? ''),
          workoutTemplateSessionId:
            typeof session?.workoutTemplateSessionId === 'string' && session.workoutTemplateSessionId.trim().length
              ? session.workoutTemplateSessionId
              : null,
          workoutNameSnapshot:
            typeof session?.workoutNameSnapshot === 'string' && session.workoutNameSnapshot.trim().length
              ? session.workoutNameSnapshot.trim()
              : 'Workout',
          sessionNotes:
            typeof session?.sessionNotes === 'string' && session.sessionNotes.trim().length
              ? session.sessionNotes.trim()
              : null,
          feel:
            session?.feel === 'easy' || session?.feel === 'right' || session?.feel === 'hard' || session?.feel === 'too_hard'
              ? session.feel
              : null,
          performedAt: typeof session?.performedAt === 'string' ? session.performedAt : new Date().toISOString(),
          startedAt: typeof session?.startedAt === 'string' ? session.startedAt : undefined,
          durationMinutes:
            typeof session?.durationMinutes === 'number' && Number.isFinite(session.durationMinutes)
              ? session.durationMinutes
              : undefined,
          setsCompleted:
            typeof session?.setsCompleted === 'number' && Number.isFinite(session.setsCompleted)
              ? session.setsCompleted
              : undefined,
          exercisesCompleted:
            typeof session?.exercisesCompleted === 'number' && Number.isFinite(session.exercisesCompleted)
              ? session.exercisesCompleted
              : undefined,
          exercisesSkipped:
            typeof session?.exercisesSkipped === 'number' && Number.isFinite(session.exercisesSkipped)
              ? session.exercisesSkipped
              : undefined,
          exercisesSwapped:
            typeof session?.exercisesSwapped === 'number' && Number.isFinite(session.exercisesSwapped)
              ? session.exercisesSwapped
              : undefined,
          totalVolumeKg:
            typeof session?.totalVolumeKg === 'number' && Number.isFinite(session.totalVolumeKg)
              ? session.totalVolumeKg
              : undefined,
          trackedExercisesUpdated:
            typeof session?.trackedExercisesUpdated === 'number' && Number.isFinite(session.trackedExercisesUpdated)
              ? session.trackedExercisesUpdated
              : undefined,
          noteCount:
            typeof session?.noteCount === 'number' && Number.isFinite(session.noteCount)
              ? session.noteCount
              : undefined,
          sessionInsertedCount:
            typeof session?.sessionInsertedCount === 'number' && Number.isFinite(session.sessionInsertedCount)
              ? session.sessionInsertedCount
              : undefined,
          legacyShapeMismatches: Array.isArray(session?.legacyShapeMismatches)
            ? session.legacyShapeMismatches.filter((value: unknown): value is string => typeof value === 'string')
            : undefined,
        }))
      : [],
    cardioSessions: Array.isArray(input?.cardioSessions)
      ? input.cardioSessions
          .map((session: any) => {
            if (typeof session?.id !== 'string' || !session.id) {
              return null;
            }
            const performedAt = typeof session?.performedAt === 'string' ? session.performedAt : null;
            const durationSec =
              typeof session?.durationSec === 'number' && Number.isFinite(session.durationSec)
                ? Math.max(0, Math.round(session.durationSec))
                : null;
            if (!performedAt || durationSec === null) {
              return null;
            }
            const activityType = ['run', 'tread-run', 'tread-walk', 'cycle-in', 'cycle-out', 'row'].includes(
              session?.activityType,
            )
              ? session.activityType
              : 'run';
            return {
              id: session.id,
              activityType,
              startedAt: typeof session?.startedAt === 'string' ? session.startedAt : performedAt,
              performedAt,
              durationSec,
              distanceKm:
                typeof session?.distanceKm === 'number' && Number.isFinite(session.distanceKm) && session.distanceKm > 0
                  ? session.distanceKm
                  : null,
              feel: ['easy', 'steady', 'hard', 'max'].includes(session?.feel) ? session.feel : null,
            };
          })
          .filter((session): session is NonNullable<typeof session> => session !== null)
      : [],
    exerciseLogs: Array.isArray(input?.exerciseLogs)
      ? input.exerciseLogs
          .map((log) => normalizeExerciseLog(log))
          .filter((log): log is NonNullable<typeof log> => Boolean(log))
      : [],
    bodyweightEntries: Array.isArray(input?.bodyweightEntries) ? input.bodyweightEntries : [],
    measurementEntries: Array.isArray(input?.measurementEntries)
      ? input.measurementEntries
          .map((entry: any) => {
            const kind =
              entry?.kind === 'bodyfat' ||
              entry?.kind === 'shoulders' ||
              entry?.kind === 'chest' ||
              entry?.kind === 'waist' ||
              entry?.kind === 'hips' ||
              entry?.kind === 'thighs'
                ? entry.kind
                : null;
            const unit = entry?.unit === 'cm' || entry?.unit === 'in' || entry?.unit === '%' ? entry.unit : null;
            const value = typeof entry?.value === 'number' && Number.isFinite(entry.value) ? entry.value : null;
            const recordedAt = typeof entry?.recordedAt === 'string' ? entry.recordedAt : null;
            const id = typeof entry?.id === 'string' && entry.id.trim().length ? entry.id : null;

            if (!kind || !unit || value === null || !recordedAt || !id) {
              return null;
            }

            return {
              id,
              kind,
              unit,
              value,
              recordedAt,
            } satisfies MeasurementEntry;
          })
          .filter((entry): entry is MeasurementEntry => Boolean(entry))
      : [],
    preferences: {
      appLanguage:
        input?.preferences?.appLanguage === 'fi' || input?.preferences?.appLanguage === 'en'
          ? input.preferences.appLanguage
          : fallback.preferences.appLanguage,
      // App is kg-only: any legacy 'lb' preference normalizes to kg on load.
      unitPreference: 'kg',
      defaultRestSeconds:
        typeof input?.preferences?.defaultRestSeconds === 'number'
          ? input.preferences.defaultRestSeconds
          : fallback.preferences.defaultRestSeconds,
      autoFocusNextInput:
        typeof input?.preferences?.autoFocusNextInput === 'boolean'
          ? input.preferences.autoFocusNextInput
          : fallback.preferences.autoFocusNextInput,
      keepScreenAwakeDuringWorkout:
        typeof input?.preferences?.keepScreenAwakeDuringWorkout === 'boolean'
          ? input.preferences.keepScreenAwakeDuringWorkout
          : fallback.preferences.keepScreenAwakeDuringWorkout,
      soundCuesEnabled:
        typeof input?.preferences?.soundCuesEnabled === 'boolean'
          ? input.preferences.soundCuesEnabled
          : fallback.preferences.soundCuesEnabled,
      darkThemeEnabled:
        typeof input?.preferences?.darkThemeEnabled === 'boolean'
          ? input.preferences.darkThemeEnabled
          : fallback.preferences.darkThemeEnabled,
      hapticsEnabled:
        typeof input?.preferences?.hapticsEnabled === 'boolean'
          ? input.preferences.hapticsEnabled
          : fallback.preferences.hapticsEnabled,
      // null and [] are distinct: null = never customized, [] = cleared by the user.
      homeStatCardKeys: Array.isArray(input?.preferences?.homeStatCardKeys)
        ? input.preferences.homeStatCardKeys.filter(
            (key: unknown): key is string => typeof key === 'string' && key.length > 0,
          )
        : fallback.preferences.homeStatCardKeys,
      notificationPrefs: {
        pushEnabled:
          typeof input?.preferences?.notificationPrefs?.pushEnabled === 'boolean'
            ? input.preferences.notificationPrefs.pushEnabled
            : fallback.preferences.notificationPrefs.pushEnabled,
        level: ['quiet', 'normal', 'motivating'].includes(input?.preferences?.notificationPrefs?.level as string)
          ? (input!.preferences!.notificationPrefs!.level as 'quiet' | 'normal' | 'motivating')
          : fallback.preferences.notificationPrefs.level,
        personalRecords:
          typeof input?.preferences?.notificationPrefs?.personalRecords === 'boolean'
            ? input.preferences.notificationPrefs.personalRecords
            : fallback.preferences.notificationPrefs.personalRecords,
        weeklySummary:
          typeof input?.preferences?.notificationPrefs?.weeklySummary === 'boolean'
            ? input.preferences.notificationPrefs.weeklySummary
            : fallback.preferences.notificationPrefs.weeklySummary,
        comebackNudge:
          typeof input?.preferences?.notificationPrefs?.comebackNudge === 'boolean'
            ? input.preferences.notificationPrefs.comebackNudge
            : fallback.preferences.notificationPrefs.comebackNudge,
        sessionReminders:
          typeof input?.preferences?.notificationPrefs?.sessionReminders === 'boolean'
            ? input.preferences.notificationPrefs.sessionReminders
            : fallback.preferences.notificationPrefs.sessionReminders,
        // "HH:MM" 24h. A malformed value would silently move every reminder, so
        // anything that is not a real clock time falls back to the default.
        reminderTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(
          input?.preferences?.notificationPrefs?.reminderTime as string,
        )
          ? (input!.preferences!.notificationPrefs!.reminderTime as string)
          : fallback.preferences.notificationPrefs.reminderTime,
        restAlerts: boolOr(input?.preferences?.notificationPrefs?.restAlerts, fallback.preferences.notificationPrefs.restAlerts),
        restWarning: boolOr(input?.preferences?.notificationPrefs?.restWarning, fallback.preferences.notificationPrefs.restWarning),
        sessionOngoing: boolOr(input?.preferences?.notificationPrefs?.sessionOngoing, fallback.preferences.notificationPrefs.sessionOngoing),
        idleNudge: boolOr(input?.preferences?.notificationPrefs?.idleNudge, fallback.preferences.notificationPrefs.idleNudge),
        restAlertsAsked: boolOr(input?.preferences?.notificationPrefs?.restAlertsAsked, fallback.preferences.notificationPrefs.restAlertsAsked),
      },
      trainingBreak:
        input?.preferences?.trainingBreak &&
        ['injury', 'holiday', 'other'].includes(input.preferences.trainingBreak.reason as string) &&
        typeof input.preferences.trainingBreak.startedAt === 'string'
          ? {
              reason: input.preferences.trainingBreak.reason as 'injury' | 'holiday' | 'other',
              note:
                typeof input.preferences.trainingBreak.note === 'string' ? input.preferences.trainingBreak.note : null,
              startedAt: input.preferences.trainingBreak.startedAt,
            }
          : fallback.preferences.trainingBreak,
      promoProUntil:
        typeof input?.preferences?.promoProUntil === 'string'
          ? input.preferences.promoProUntil
          : fallback.preferences.promoProUntil,
      mockSubscriptionTerm: isSubscriptionTermKey(input?.preferences?.mockSubscriptionTerm)
        ? input.preferences.mockSubscriptionTerm
        : fallback.preferences.mockSubscriptionTerm,
      mockSubscriptionCancelled:
        typeof input?.preferences?.mockSubscriptionCancelled === 'boolean'
          ? input.preferences.mockSubscriptionCancelled
          : fallback.preferences.mockSubscriptionCancelled,
      mockSubscriptionPurchasedAt:
        typeof input?.preferences?.mockSubscriptionPurchasedAt === 'string'
          ? input.preferences.mockSubscriptionPurchasedAt
          : fallback.preferences.mockSubscriptionPurchasedAt,
      cancelSurveyAnswer: normalizeCancelSurveyAnswer(input?.preferences?.cancelSurveyAnswer),
      featureVotedIds: Array.isArray(input?.preferences?.featureVotedIds)
        ? input.preferences.featureVotedIds.filter(
            (id: unknown): id is string => typeof id === 'string' && id.length > 0,
          )
        : fallback.preferences.featureVotedIds,
      aiCoachFreeQuota:
        input?.preferences?.aiCoachFreeQuota &&
        typeof input.preferences.aiCoachFreeQuota.weekStart === 'string' &&
        typeof input.preferences.aiCoachFreeQuota.used === 'number' &&
        Number.isFinite(input.preferences.aiCoachFreeQuota.used)
          ? {
              weekStart: input.preferences.aiCoachFreeQuota.weekStart,
              used: Math.max(0, Math.round(input.preferences.aiCoachFreeQuota.used)),
            }
          : fallback.preferences.aiCoachFreeQuota,
      adaptiveCoachPremiumUnlocked:
        typeof input?.preferences?.adaptiveCoachPremiumUnlocked === 'boolean'
          ? input.preferences.adaptiveCoachPremiumUnlocked
          : fallback.preferences.adaptiveCoachPremiumUnlocked,
      automatedProgressionEnabled:
        typeof input?.preferences?.automatedProgressionEnabled === 'boolean'
          ? input.preferences.automatedProgressionEnabled
          : fallback.preferences.automatedProgressionEnabled,
      aiSetupCompleted:
        typeof input?.preferences?.aiSetupCompleted === 'boolean'
          ? input.preferences.aiSetupCompleted
          : fallback.preferences.aiSetupCompleted,
      hasOpenedAppBefore:
        typeof input?.preferences?.hasOpenedAppBefore === 'boolean'
          ? input.preferences.hasOpenedAppBefore
          : fallback.preferences.hasOpenedAppBefore,
      homeWidgetPromptDismissed:
        typeof input?.preferences?.homeWidgetPromptDismissed === 'boolean'
          ? input.preferences.homeWidgetPromptDismissed
          : fallback.preferences.homeWidgetPromptDismissed,
      accountBackupPromptDismissed:
        typeof input?.preferences?.accountBackupPromptDismissed === 'boolean'
          ? input.preferences.accountBackupPromptDismissed
          : fallback.preferences.accountBackupPromptDismissed,
      aiOnlineNoticeAcknowledged:
        typeof input?.preferences?.aiOnlineNoticeAcknowledged === 'boolean'
          ? input.preferences.aiOnlineNoticeAcknowledged
          : fallback.preferences.aiOnlineNoticeAcknowledged,
      // A stored install that predates this flag has already been through
      // onboarding, so the hand-off has had its turn — without this, the flag
      // reads false on the next launch and an old install gets ambushed by a
      // step meant for a first run.
      setupHandoffCompleted:
        typeof input?.preferences?.setupHandoffCompleted === 'boolean'
          ? input.preferences.setupHandoffCompleted
          : input?.preferences?.onboardingCompleted === true
            ? true
            : fallback.preferences.setupHandoffCompleted,
      entryFlowCompleted:
        typeof input?.preferences?.entryFlowCompleted === 'boolean'
          ? input.preferences.entryFlowCompleted
          : fallback.preferences.entryFlowCompleted,
      trainingFirstRunDismissed:
        typeof input?.preferences?.trainingFirstRunDismissed === 'boolean'
          ? input.preferences.trainingFirstRunDismissed
          : fallback.preferences.trainingFirstRunDismissed,
      selectedSignInMethod:
        input?.preferences?.selectedSignInMethod === 'apple' ||
        input?.preferences?.selectedSignInMethod === 'email' ||
        input?.preferences?.selectedSignInMethod === null
          ? input.preferences.selectedSignInMethod
          : fallback.preferences.selectedSignInMethod,
      selectedAccessTier:
        input?.preferences?.selectedAccessTier === 'free' ||
        input?.preferences?.selectedAccessTier === 'premium' ||
        input?.preferences?.selectedAccessTier === null
          ? input.preferences.selectedAccessTier
          : fallback.preferences.selectedAccessTier,
      profileName:
        typeof input?.preferences?.profileName === 'string' && input.preferences.profileName.trim().length
          ? input.preferences.profileName.trim().slice(0, 32)
          : input?.preferences?.profileName === null
            ? null
            : fallback.preferences.profileName,
      setupCurrentWeightKg:
        typeof input?.preferences?.setupCurrentWeightKg === 'number' || input?.preferences?.setupCurrentWeightKg === null
          ? input.preferences.setupCurrentWeightKg
          : fallback.preferences.setupCurrentWeightKg,
      bodyweightGoalKg:
        typeof input?.preferences?.bodyweightGoalKg === 'number' || input?.preferences?.bodyweightGoalKg === null
          ? input.preferences.bodyweightGoalKg
          : fallback.preferences.bodyweightGoalKg,
      onboardingCompleted:
        typeof input?.preferences?.onboardingCompleted === 'boolean'
          ? input.preferences.onboardingCompleted
          : fallback.preferences.onboardingCompleted,
      setupCompleted:
        typeof input?.preferences?.setupCompleted === 'boolean'
          ? input.preferences.setupCompleted
          : fallback.preferences.setupCompleted,
      setupGender:
        input?.preferences?.setupGender === 'male' ||
        input?.preferences?.setupGender === 'female' ||
        input?.preferences?.setupGender === 'unspecified' ||
        input?.preferences?.setupGender === null
          ? input.preferences.setupGender
          : fallback.preferences.setupGender,
      setupAge:
        typeof input?.preferences?.setupAge === 'number' && Number.isFinite(input.preferences.setupAge)
          ? Math.max(0, Math.min(100, Math.round(input.preferences.setupAge)))
          : fallback.preferences.setupAge,
      setupHeightCm:
        typeof input?.preferences?.setupHeightCm === 'number' && Number.isFinite(input.preferences.setupHeightCm)
          ? Math.max(0, Math.min(300, Math.round(input.preferences.setupHeightCm)))
          : fallback.preferences.setupHeightCm,
      setupAgeRange:
        input?.preferences?.setupAgeRange === 'unspecified' ||
        input?.preferences?.setupAgeRange === '18' ||
        input?.preferences?.setupAgeRange === '19_25' ||
        input?.preferences?.setupAgeRange === '26_30' ||
        input?.preferences?.setupAgeRange === '31_40' ||
        input?.preferences?.setupAgeRange === '41_plus' ||
        input?.preferences?.setupAgeRange === null
          ? input.preferences.setupAgeRange
          : fallback.preferences.setupAgeRange,
      setupGoal:
        input?.preferences?.setupGoal === 'strength' ||
        input?.preferences?.setupGoal === 'muscle' ||
        input?.preferences?.setupGoal === 'general' ||
        input?.preferences?.setupGoal === 'run_mobility' ||
        input?.preferences?.setupGoal === 'lean_athletic' ||
        input?.preferences?.setupGoal === 'general_fitness'
          ? input.preferences.setupGoal
          : fallback.preferences.setupGoal,
      setupGoals:
        Array.isArray(input?.preferences?.setupGoals) &&
        input.preferences.setupGoals.length > 0
          ? input.preferences.setupGoals.filter(
              (value: unknown): value is 'strength' | 'muscle' | 'general' | 'run_mobility' | 'lean_athletic' | 'general_fitness' =>
                value === 'strength' ||
                value === 'muscle' ||
                value === 'general' ||
                value === 'run_mobility' ||
                value === 'lean_athletic' ||
                value === 'general_fitness',
            )
          : input?.preferences?.setupGoal === 'strength' ||
              input?.preferences?.setupGoal === 'muscle' ||
              input?.preferences?.setupGoal === 'general' ||
              input?.preferences?.setupGoal === 'run_mobility' ||
              input?.preferences?.setupGoal === 'lean_athletic' ||
              input?.preferences?.setupGoal === 'general_fitness'
            ? [input.preferences.setupGoal]
            : fallback.preferences.setupGoals,
      setupLevel:
        input?.preferences?.setupLevel === 'beginner' ||
        input?.preferences?.setupLevel === 'advanced' ||
        input?.preferences?.setupLevel === 'pro'
          ? input.preferences.setupLevel
          : // Legacy tier name from before the beginner/advanced/pro rename;
            // the old middle tier maps onto the new middle tier.
            (input?.preferences?.setupLevel as string | null | undefined) === 'intermediate'
            ? 'advanced'
            : fallback.preferences.setupLevel,
      setupDaysPerWeek:
        input?.preferences?.setupDaysPerWeek === 2 ||
        input?.preferences?.setupDaysPerWeek === 3 ||
        input?.preferences?.setupDaysPerWeek === 4 ||
        input?.preferences?.setupDaysPerWeek === 5 ||
        input?.preferences?.setupDaysPerWeek === 6
          ? input.preferences.setupDaysPerWeek
          : fallback.preferences.setupDaysPerWeek,
      setupEquipment:
        input?.preferences?.setupEquipment === 'gym' ||
        input?.preferences?.setupEquipment === 'minimal' ||
        input?.preferences?.setupEquipment === 'home'
          ? input.preferences.setupEquipment
          : fallback.preferences.setupEquipment,
      setupTrainingEnvironment:
        input?.preferences?.setupTrainingEnvironment === 'full_gym' ||
        input?.preferences?.setupTrainingEnvironment === 'home_gym' ||
        input?.preferences?.setupTrainingEnvironment === 'minimal_equipment' ||
        input?.preferences?.setupTrainingEnvironment === 'bodyweight_only' ||
        input?.preferences?.setupTrainingEnvironment === 'running_hybrid'
          ? input.preferences.setupTrainingEnvironment
          : fallback.preferences.setupTrainingEnvironment,
      setupSecondaryOutcomes:
        Array.isArray(input?.preferences?.setupSecondaryOutcomes)
          ? input.preferences.setupSecondaryOutcomes.filter(
              (value: unknown): value is 'consistency' | 'mobility' | 'conditioning' | 'muscle' | 'strength' =>
                value === 'consistency' ||
                value === 'mobility' ||
                value === 'conditioning' ||
                value === 'muscle' ||
                value === 'strength',
            )
          : fallback.preferences.setupSecondaryOutcomes,
      setupEquipmentItems:
        Array.isArray(input?.preferences?.setupEquipmentItems)
          ? input.preferences.setupEquipmentItems
              .filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
              .slice(0, 24)
          : fallback.preferences.setupEquipmentItems,
      setupFocusAreas:
        Array.isArray(input?.preferences?.setupFocusAreas)
          ? input.preferences.setupFocusAreas.filter(
              (
                value: unknown,
              ): value is
                | 'bodyweight'
                | 'glutes'
                | 'legs'
                | 'quads'
                | 'hamstrings'
                | 'calves'
                | 'chest'
                | 'shoulders'
                | 'back'
                | 'arms'
                | 'core'
                | 'mobility'
                | 'conditioning' =>
                value === 'bodyweight' ||
                value === 'glutes' ||
                value === 'legs' ||
                value === 'quads' ||
                value === 'hamstrings' ||
                value === 'calves' ||
                value === 'chest' ||
                value === 'shoulders' ||
                value === 'back' ||
                value === 'arms' ||
                value === 'core' ||
                value === 'mobility' ||
                value === 'conditioning',
            )
          : fallback.preferences.setupFocusAreas,
      setupCautionFlags: normalizeSetupCautionFlags(
        input?.preferences?.setupCautionFlags,
        fallback.preferences.setupCautionFlags,
      ),
      setupGuidanceMode:
        input?.preferences?.setupGuidanceMode === 'done_for_me' ||
        input?.preferences?.setupGuidanceMode === 'guided_editable' ||
        input?.preferences?.setupGuidanceMode === 'self_directed'
          ? input.preferences.setupGuidanceMode
          : fallback.preferences.setupGuidanceMode,
      setupScheduleMode:
        input?.preferences?.setupScheduleMode === 'app_managed' ||
        input?.preferences?.setupScheduleMode === 'self_managed'
          ? input.preferences.setupScheduleMode
          : fallback.preferences.setupScheduleMode,
      setupWeeklyMinutes:
        typeof input?.preferences?.setupWeeklyMinutes === 'number' || input?.preferences?.setupWeeklyMinutes === null
          ? input.preferences.setupWeeklyMinutes
          : fallback.preferences.setupWeeklyMinutes,
      setupAvailableDays:
        Array.isArray(input?.preferences?.setupAvailableDays)
          ? input.preferences.setupAvailableDays.filter(
              (value: unknown): value is 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' =>
                value === 'mon' ||
                value === 'tue' ||
                value === 'wed' ||
                value === 'thu' ||
                value === 'fri' ||
                value === 'sat' ||
                value === 'sun',
            )
          : fallback.preferences.setupAvailableDays,
      trainingCycle: normalizeTrainingCycle(input?.preferences?.trainingCycle, fallback.preferences.trainingCycle),
      todaySession: normalizeTodaySession(input?.preferences?.todaySession),
      setupTrainingFeel:
        input?.preferences?.setupTrainingFeel === 'easy' ||
        input?.preferences?.setupTrainingFeel === 'steady' ||
        input?.preferences?.setupTrainingFeel === 'challenging' ||
        input?.preferences?.setupTrainingFeel === 'intense'
          ? input.preferences.setupTrainingFeel
          : fallback.preferences.setupTrainingFeel,
      setupWorkoutVariety:
        input?.preferences?.setupWorkoutVariety === 'stable' ||
        input?.preferences?.setupWorkoutVariety === 'balanced' ||
        input?.preferences?.setupWorkoutVariety === 'varied' ||
        input?.preferences?.setupWorkoutVariety === 'fresh'
          ? input.preferences.setupWorkoutVariety
          : fallback.preferences.setupWorkoutVariety,
      setupFreeWeightsPreference:
        input?.preferences?.setupFreeWeightsPreference === 'avoid' ||
        input?.preferences?.setupFreeWeightsPreference === 'neutral' ||
        input?.preferences?.setupFreeWeightsPreference === 'prefer' ||
        input?.preferences?.setupFreeWeightsPreference === 'love'
          ? input.preferences.setupFreeWeightsPreference
          : fallback.preferences.setupFreeWeightsPreference,
      setupBodyweightPreference:
        input?.preferences?.setupBodyweightPreference === 'avoid' ||
        input?.preferences?.setupBodyweightPreference === 'neutral' ||
        input?.preferences?.setupBodyweightPreference === 'prefer' ||
        input?.preferences?.setupBodyweightPreference === 'love'
          ? input.preferences.setupBodyweightPreference
          : fallback.preferences.setupBodyweightPreference,
      setupMachinesPreference:
        input?.preferences?.setupMachinesPreference === 'avoid' ||
        input?.preferences?.setupMachinesPreference === 'neutral' ||
        input?.preferences?.setupMachinesPreference === 'prefer' ||
        input?.preferences?.setupMachinesPreference === 'love'
          ? input.preferences.setupMachinesPreference
          : fallback.preferences.setupMachinesPreference,
      setupShoulderFriendlySwaps: normalizeJointSwapPreference(
        input?.preferences?.setupShoulderFriendlySwaps,
        fallback.preferences.setupShoulderFriendlySwaps,
      ),
      setupElbowFriendlySwaps: normalizeJointSwapPreference(
        input?.preferences?.setupElbowFriendlySwaps,
        fallback.preferences.setupElbowFriendlySwaps,
      ),
      setupKneeFriendlySwaps: normalizeJointSwapPreference(
        input?.preferences?.setupKneeFriendlySwaps,
        fallback.preferences.setupKneeFriendlySwaps,
      ),
      aiPlannerGoal:
        input?.preferences?.aiPlannerGoal === 'strength' ||
        input?.preferences?.aiPlannerGoal === 'muscle' ||
        input?.preferences?.aiPlannerGoal === 'fat_loss' ||
        input?.preferences?.aiPlannerGoal === 'fitness'
          ? input.preferences.aiPlannerGoal
          : fallback.preferences.aiPlannerGoal,
      aiPlannerDaysPerWeek:
        input?.preferences?.aiPlannerDaysPerWeek === 1 ||
        input?.preferences?.aiPlannerDaysPerWeek === 2 ||
        input?.preferences?.aiPlannerDaysPerWeek === 3 ||
        input?.preferences?.aiPlannerDaysPerWeek === 4
          ? input.preferences.aiPlannerDaysPerWeek
          : fallback.preferences.aiPlannerDaysPerWeek,
      aiPlannerExperience:
        input?.preferences?.aiPlannerExperience === 'beginner' ||
        input?.preferences?.aiPlannerExperience === 'intermediate' ||
        input?.preferences?.aiPlannerExperience === 'advanced'
          ? input.preferences.aiPlannerExperience
          : fallback.preferences.aiPlannerExperience,
      aiPlannerSessionMinutes:
        input?.preferences?.aiPlannerSessionMinutes === 30 ||
        input?.preferences?.aiPlannerSessionMinutes === 45 ||
        input?.preferences?.aiPlannerSessionMinutes === 60 ||
        input?.preferences?.aiPlannerSessionMinutes === 75 ||
        input?.preferences?.aiPlannerSessionMinutes === 90
          ? input.preferences.aiPlannerSessionMinutes
          : fallback.preferences.aiPlannerSessionMinutes,
      aiPlannerEquipment:
        input?.preferences?.aiPlannerEquipment === 'full_gym' ||
        input?.preferences?.aiPlannerEquipment === 'home_gym' ||
        input?.preferences?.aiPlannerEquipment === 'minimal' ||
        input?.preferences?.aiPlannerEquipment === 'bodyweight'
          ? input.preferences.aiPlannerEquipment
          : fallback.preferences.aiPlannerEquipment,
      aiPlannerRecovery:
        input?.preferences?.aiPlannerRecovery === 'low' ||
        input?.preferences?.aiPlannerRecovery === 'moderate' ||
        input?.preferences?.aiPlannerRecovery === 'high'
          ? input.preferences.aiPlannerRecovery
          : fallback.preferences.aiPlannerRecovery,
      aiPlannerMustInclude:
        typeof input?.preferences?.aiPlannerMustInclude === 'string'
          ? input.preferences.aiPlannerMustInclude
          : fallback.preferences.aiPlannerMustInclude,
      aiPlannerAvoid:
        typeof input?.preferences?.aiPlannerAvoid === 'string'
          ? input.preferences.aiPlannerAvoid
          : fallback.preferences.aiPlannerAvoid,
      aiPlannerLimitations:
        typeof input?.preferences?.aiPlannerLimitations === 'string'
          ? input.preferences.aiPlannerLimitations
          : fallback.preferences.aiPlannerLimitations,
      aiCoachTemplateId:
        typeof input?.preferences?.aiCoachTemplateId === 'string' || input?.preferences?.aiCoachTemplateId === null
          ? input.preferences.aiCoachTemplateId
          : fallback.preferences.aiCoachTemplateId,
      aiCoachSetupHash:
        typeof input?.preferences?.aiCoachSetupHash === 'string' || input?.preferences?.aiCoachSetupHash === null
          ? input.preferences.aiCoachSetupHash
          : fallback.preferences.aiCoachSetupHash,
      aiCoachPlanGeneratedAt:
        typeof input?.preferences?.aiCoachPlanGeneratedAt === 'string' || input?.preferences?.aiCoachPlanGeneratedAt === null
          ? input.preferences.aiCoachPlanGeneratedAt
          : fallback.preferences.aiCoachPlanGeneratedAt,
      lastInsightSessionId:
        typeof input?.preferences?.lastInsightSessionId === 'string' || input?.preferences?.lastInsightSessionId === null
          ? input.preferences.lastInsightSessionId
          : fallback.preferences.lastInsightSessionId,
      lastInsightType:
        input?.preferences?.lastInsightType === 'personal_record' ||
        input?.preferences?.lastInsightType === 'plateau_detected' ||
        input?.preferences?.lastInsightType === 'session_volume_peak' ||
        input?.preferences?.lastInsightType === 'return_after_gap' ||
        input?.preferences?.lastInsightType === null
          ? input.preferences.lastInsightType
          : fallback.preferences.lastInsightType,
      recommendedProgramId:
        typeof input?.preferences?.recommendedProgramId === 'string' || input?.preferences?.recommendedProgramId === null
          ? input.preferences.recommendedProgramId
          : fallback.preferences.recommendedProgramId,
      trackedExerciseLibraryItemIds:
        Array.isArray(input?.preferences?.trackedExerciseLibraryItemIds)
          ? input.preferences.trackedExerciseLibraryItemIds.filter(
              (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0,
            )
          : fallback.preferences.trackedExerciseLibraryItemIds,
      // Hand-typed numbers in stored JSON: normalised rather than trusted,
      // so a corrupt entry cannot make a progress bar draw past its box.
      strengthGoals: normalizeStrengthGoals(input?.preferences?.strengthGoals),
      seasonEnrolments: normalizeSeasonEnrolments(input?.preferences?.seasonEnrolments),
      dismissedTipIds:
        Array.isArray(input?.preferences?.dismissedTipIds)
          ? input.preferences.dismissedTipIds.filter((value: unknown): value is string => typeof value === 'string')
          : fallback.preferences.dismissedTipIds,
      activePlanId:
        typeof input?.preferences?.activePlanId === 'string' || input?.preferences?.activePlanId === null
          ? input.preferences.activePlanId
          : fallback.preferences.activePlanId,
      dismissedCompletionPlanIds:
        Array.isArray(input?.preferences?.dismissedCompletionPlanIds)
          ? input.preferences.dismissedCompletionPlanIds.filter(
              (value: unknown): value is string => typeof value === 'string',
            )
          : fallback.preferences.dismissedCompletionPlanIds,
      dismissedCardSuggestionKeys:
        Array.isArray(input?.preferences?.dismissedCardSuggestionKeys)
          ? input.preferences.dismissedCardSuggestionKeys.filter(
              (value: unknown): value is string => typeof value === 'string',
            )
          : fallback.preferences.dismissedCardSuggestionKeys,
      activePlanIds: normalizeActivePlanIds(
        input?.preferences?.activePlanIds,
        input?.preferences?.activePlanId,
      ),
      programsTabEnabled:
        typeof input?.preferences?.programsTabEnabled === 'boolean'
          ? input.preferences.programsTabEnabled
          : fallback.preferences.programsTabEnabled,
    },
  };
}

/**
 * A first launch starts empty.
 *
 * This used to write createSeedDatabase(), which carries six invented sessions,
 * their logs, and a bodyweight trend. A brand-new user opened the app to
 * personal records they had never lifted and a history they had never trained —
 * the app lied about the one thing it exists to record. The seed stays as a
 * fixture for tests and demos; it must never reach a real install.
 */
export async function loadDatabase() {
  const raw = (await AsyncStorage.getItem(STORAGE_KEY)) ?? (await AsyncStorage.getItem(LEGACY_STORAGE_KEY));

  if (!raw) {
    // Nothing stored means nobody has chosen a language yet, so the phone
    // decides. A Finnish device used to open a Finnish-first app in English
    // and the reader's first act was correcting it.
    const empty = normalizeDatabase(createEmptyDatabase(resolveDeviceLanguage()));
    await saveDatabase(empty);
    return empty;
  }

  try {
    const database = normalizeDatabase(JSON.parse(raw) as Partial<AppDatabase>);
    return { ...database, preferences: await loadStoredPreferences(database.preferences) };
  } catch {
    // Unreadable storage is a corrupt install, not a new one — but inventing
    // history to paper over it would be the same lie.
    //
    // The bytes are kept first. This branch used to write the empty database
    // straight over the only copy of everything the reader had logged, so a
    // half-written blob or one bad field cost them the lot with nothing left to
    // read afterwards. Set the key aside and the loss is recoverable by hand;
    // the app still opens either way, which is what the overwrite was for.
    try {
      await AsyncStorage.setItem(CORRUPT_STORAGE_KEY, raw);
    } catch {
      // Out of space, most likely — the same condition that truncated the
      // write in the first place. Opening the app still matters more.
    }
    const empty = normalizeDatabase(createEmptyDatabase(resolveDeviceLanguage()));
    await saveDatabase(empty);
    return empty;
  }
}

/**
 * The preferences key, when it has been written, over the ones the blob holds.
 *
 * A missing key is the normal case for an install that predates the split, and
 * an unreadable one is not worth losing a whole database over — both fall back
 * to the blob's own copy, which a full save keeps current.
 */
async function loadStoredPreferences(fallback: AppPreferences): Promise<AppPreferences> {
  try {
    const raw = await AsyncStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return fallback;
    }
    // Reuses the one normalizer rather than a second copy of the same field
    // defaults: an empty database carrying these preferences comes back with
    // every missing field filled the same way a stored one would.
    const parsed = JSON.parse(raw) as Partial<AppPreferences>;
    return normalizeDatabase({ preferences: { ...fallback, ...parsed } }).preferences;
  } catch {
    return fallback;
  }
}

/**
 * One field's worth of writing, for the changes that are one field.
 *
 * The caller keeps the in-memory database as the single source of truth; this
 * only makes the small write cheap. Anything that touches sessions, logs or
 * templates still goes through saveDatabase.
 */
export async function savePreferences(preferences: AppPreferences) {
  await AsyncStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
}

export async function saveDatabase(database: AppDatabase) {
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...database,
      exerciseLibrary: [],
    }),
  );
}

export async function resetDatabase() {
  const empty = normalizeDatabase(createEmptyDatabase());
  await saveDatabase(empty);
  // Reset has to mean reset: leaving the pre-rename blob behind would let it
  // come back if the new key were ever cleared on its own. The quarantined copy
  // goes for a second reason — somebody who asks for their data to be erased is
  // not asking for a copy of it to survive under another name.
  await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
  await AsyncStorage.removeItem(CORRUPT_STORAGE_KEY);
  // The preferences key outlives the blob otherwise, and a reset that leaves
  // the old language and theme behind is not the reset that was asked for.
  await AsyncStorage.removeItem(PREFERENCES_STORAGE_KEY);
  return empty;
}
