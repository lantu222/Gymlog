import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { ConfirmDialog } from '../components/ConfirmDialog';
import { CutSurface } from '../components/CutSurface';
import { ProgramPhotoSlot } from '../components/ProgramPhotoSlot';
import { formatWorkoutDisplayLabel } from '../lib/displayLabel';
import { exerciseNameLabel } from '../lib/exerciseNameLabel';
import { I18nKey, t } from '../lib/i18n';
import { ProgramDetailViewModel } from '../lib/programDetails';
import { progressionRuleLabel } from '../lib/progressionRuleLabel';
import { EQUIPMENT_CHIP_KEYS, missingEquipment } from '../lib/programEquipment';
import { Theme, useThemedStyles } from '../theming';
import { localizeSessionName, localizeWorkoutFocus } from '../lib/sessionNameLabel';
import { layout, radii, spacing } from '../theme';
import type { AppLanguage } from '../types/models';

const DAY_KEYS: I18nKey[] = [
  'setup.day.mon',
  'setup.day.tue',
  'setup.day.wed',
  'setup.day.thu',
  'setup.day.fri',
  'setup.day.sat',
  'setup.day.sun',
];

const ROLE_KEYS: Record<string, I18nKey> = {
  primary: 'detail.role.primary',
  secondary: 'detail.role.secondary',
  accessory: 'detail.role.accessory',
};

const ROLE_TINTS: Record<string, { bg: string; ink: string }> = {
  primary: { bg: '#EDE4FF', ink: '#5B21B6' },
  secondary: { bg: '#E4EEFF', ink: '#2C4E9A' },
  accessory: { bg: '#F2F1F5', ink: '#7A7387' },
};

/**
 * "Ylävartalo · raskas" becomes "YLÄ" on a 44px weekday chip.
 *
 * The first word up to the separator, capped — the chip has to say WHICH day
 * it is, and "Treeni" seven times says nothing.
 */
function shortSessionLabel(name: string, language: AppLanguage) {
  const localized = localizeSessionName(name, language);
  const afterDay = localized.replace(/^[^:]*:\s*/, '');
  const firstWord = afterDay.split(/[\s·|&]+/).filter(Boolean)[0] ?? afterDay;
  return firstWord.slice(0, 3).toUpperCase();
}

const ROLE_LEVEL_KEYS: Record<string, I18nKey> = {
  beginner: 'detail.level.beginner',
  intermediate: 'detail.level.intermediate',
  advanced: 'detail.level.advanced',
};

const PLAN_SURFACE = '#FFFFFF';
const PLAN_SURFACE_SOFT = '#F2ECFF';
const PLAN_TEXT = '#101828';
const PLAN_TEXT_MUTED = '#667085';
const PLAN_BORDER = '#E4D8FF';
const PLAN_PURPLE = '#7C3AED';
const PLAN_PURPLE_DARK = '#5B21B6';
const PLAN_PURPLE_SOFT = '#F1EAFF';
// Green now means one thing only on this screen: a recovery day.
const PLAN_GREEN = '#16A34A';

interface ProgramDetailScreenProps {
  program: ProgramDetailViewModel;
  onBack: () => void;
  onPrimaryAction: () => void;
  onStartSession: (sessionId: string) => void;
  onEdit?: () => void;
  destructiveActionLabel?: string;
  destructiveActionTitle?: string;
  destructiveActionMessage?: string;
  onDestructiveAction?: () => void;
  /**
   * The template's own progression rules, when it has them. Custom programs
   * do not — they are the reader's own sessions with no rule attached, and
   * inventing one for them would be inventing the whole section.
   */
  progressionRules?: {
    primary: string;
    secondary: string;
    accessory: string;
    failureHandling: string;
  } | null;
  /** Who the program is for, already in the reader's language. */
  audience?: string | null;
  /** Training days the reader's own week has, when the setup says. */
  availableDays?: number | null;
  /** Gear the program needs, derived from its exercises. */
  equipment?: string[];
  /** Gear the reader has; null when the setup never said. */
  availableEquipment?: string[] | null;
  /**
   * Why this program, relative to the one being run.
   *
   * The reason was computed for the browse row and stopped there — the screen
   * with room to explain it never received it.
   */
  fitReason?: string | null;
  /**
   * Duplicates this ready program into one of the reader's own.
   *
   * The moment someone wants a ready program CHANGED is the documented buying
   * moment, and until now it existed only for the program you were already
   * running — browse the other fifty-four and the thought had nowhere to go.
   */
  onMakeOwnVersion?: () => void;
  activePlanSummary?: {
    weekLabel: string;
    progressPercent: number;
    sessionsPerWeek: string;
    weeklyMinutes: string;
  } | null;
  language?: AppLanguage;
}

function parseMinutesFromBadges(badges: string[]) {
  const durationBadge = badges.find((badge) => badge.toLowerCase().includes('min'));
  return durationBadge ? Number.parseInt(durationBadge.replace(/\D/g, ''), 10) || 0 : 0;
}

function getWorkoutFocus(session: ProgramDetailViewModel['sessions'][number], language: AppLanguage) {
  const copy = session.focus || session.preview;
  return copy ? localizeWorkoutFocus(copy, language) : t(language, 'detail.defaultFocus');
}

function formatPlanSessionTitle(
  session: ProgramDetailViewModel['sessions'][number],
  index: number,
  programTitle: string,
  language: AppLanguage,
) {
  // The English name is what is stored and matched on; localizeSessionName only
  // rewrites the parts it recognises.
  const sessionName = formatWorkoutDisplayLabel(session.name, 'Workout');
  const normalizedProgram = programTitle.toLowerCase();
  const normalizedSession = sessionName.toLowerCase();

  if (normalizedProgram.includes('full body') && /^minimal\s+[a-z]$/.test(normalizedSession)) {
    return `${t(language, 'detail.day', { index: index + 1 })}. ${t(language, 'facet.fullBody')}`;
  }

  if (/^workout\s+[a-z]$/.test(normalizedSession)) {
    return `${t(language, 'detail.day', { index: index + 1 })}. ${t(language, 'ai.signal.workout')}`;
  }

  if (/^day\s+\d+/i.test(sessionName)) {
    return localizeSessionName(sessionName, language);
  }

  return `${t(language, 'detail.day', { index: index + 1 })}. ${localizeSessionName(sessionName, language)}`;
}

function isWarmupExercise(name: string) {
  return /warm|prep|activation/i.test(name);
}

function isCooldownExercise(name: string) {
  return /cooldown|stretch|breath|recovery/i.test(name);
}

function buildSessionContentSections(session: ProgramDetailViewModel['sessions'][number]) {
  const warmupExercises = session.exercises.filter((exercise) => isWarmupExercise(exercise.name));
  const cooldownExercises = session.exercises.filter((exercise) => isCooldownExercise(exercise.name));
  const workoutExercises = session.exercises.filter(
    (exercise) => !isWarmupExercise(exercise.name) && !isCooldownExercise(exercise.name),
  );

  return [
    {
      titleKey: 'detail.warmup' as I18nKey,
      items: warmupExercises.length
        ? warmupExercises
        : [
            {
              id: `${session.id}:warmup`,
              name: 'Dynamic Warm-Up',
              prescription: '5-8 min',
              role: undefined,
            },
          ],
    },
    {
      titleKey: 'ai.signal.workout' as I18nKey,
      items: workoutExercises,
    },
    {
      titleKey: 'detail.cooldown' as I18nKey,
      items: cooldownExercises.length
        ? cooldownExercises
        : [
            {
              id: `${session.id}:cooldown`,
              name: 'Cooldown Flow',
              prescription: '3-5 min',
              role: undefined,
            },
          ],
    },
  ].filter((section) => section.items.length > 0);
}

function getTrainingDayIndexes(sessionCount: number) {
  if (sessionCount <= 1) {
    return new Set([0]);
  }

  const templates: Record<number, number[]> = {
    2: [0, 3],
    3: [0, 2, 4],
    4: [0, 1, 3, 5],
    5: [0, 1, 2, 4, 5],
  };

  return new Set(templates[sessionCount] ?? [0, 1, 2, 3, 4, 5].slice(0, Math.min(sessionCount, 6)));
}

export function ProgramDetailScreen({
  program,
  onBack,
  onStartSession,
  onEdit,
  progressionRules = null,
  audience = null,
  availableDays = null,
  equipment = [],
  onMakeOwnVersion,
  availableEquipment = null,
  fitReason = null,
  destructiveActionLabel,
  destructiveActionTitle,
  destructiveActionMessage,
  onDestructiveAction,
  activePlanSummary = null,
  language = 'en',
}: ProgramDetailScreenProps) {
  const styles = useThemedStyles(makeStyles);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const { width: heroWidth } = useWindowDimensions();
  /**
   * The one thing that makes a good program the wrong pick: a week without
   * room for it. Only shown when the setup actually says how many days the
   * reader has — guessing would turn a real warning into noise.
   */
  const missingGear = useMemo(
    () => missingEquipment(equipment as never, availableEquipment),
    [availableEquipment, equipment],
  );
  const daysWarning =
    availableDays != null && availableDays > 0 && program.sessions.length > availableDays
      ? t(language, 'detail.daysWarning', {
          count: program.sessions.length,
          have: availableDays,
        })
      : null;
  const displayTitle = formatWorkoutDisplayLabel(program.title, 'Workout plan');
  /**
   * The hero's bars: one per session, height from its exercise count.
   *
   * The same idea the browse covers draw, so a program looks like itself
   * wherever it is met.
   */
  const heroBars = useMemo(() => {
    const counts = program.sessions.map((session) => session.exerciseCount);
    const peak = Math.max(1, ...counts);
    return counts.map((count) => Math.max(0.3, count / peak));
  }, [program.sessions]);
  /** Goal and level, both translated — badges[0..1] are English. */
  const heroPill = useMemo(() => {
    const levelKey = ROLE_LEVEL_KEYS[(program.badges[1] ?? '').toLowerCase()];
    return levelKey ? t(language, levelKey) : null;
  }, [language, program.badges]);
  const trainingDaySessions = useMemo(() => {
    const map = new Map<number, string>();
    const indexes = [...getTrainingDayIndexes(program.sessions.length)].sort((a, b) => a - b);
    indexes.forEach((dayIndex, order) => {
      const session = program.sessions[order];
      if (session) {
        map.set(dayIndex, session.name);
      }
    });
    return map;
  }, [program.sessions]);
  const nextSession = program.sessions[0] ?? null;
  const durationMinutes = parseMinutesFromBadges(program.badges);
  // Eight weeks is the catalog's default block; the strip states the same
  // number the total is derived from rather than two numbers that disagree.
  const blockWeeks = 8;
  const totalSessions = program.sessions.length * blockWeeks;
  const completedSessions = Math.max(0, Math.round(((activePlanSummary?.progressPercent ?? 1) / 100) * totalSessions));
  const progressPercent = activePlanSummary?.progressPercent ?? 1;
  const weekLabel = activePlanSummary?.weekLabel ?? t(language, 'detail.weekFallback');
  const sessionsPerWeek = activePlanSummary?.sessionsPerWeek ?? `${program.sessions.length}`;
  const weeklyMinutes =
    activePlanSummary?.weeklyMinutes ??
    (durationMinutes > 0
      ? `~${durationMinutes * Math.max(1, program.sessions.length)} min`
      : t(language, 'detail.workoutCount', { count: program.sessions.length }));
  const scheduleSlots = useMemo(
    () => {
      const trainingDayIndexes = getTrainingDayIndexes(program.sessions.length);

      return DAY_KEYS.map((dayKey, index) => ({
        dayKey,
        day: t(language, dayKey).toUpperCase(),
        isTraining: trainingDayIndexes.has(index),
      }));
    },
    [language, program.sessions.length],
  );
  const hasDestructiveAction = Boolean(
    destructiveActionLabel && destructiveActionTitle && destructiveActionMessage && onDestructiveAction,
  );

  function handleConfirmDelete() {
    setConfirmVisible(false);
    onDestructiveAction?.();
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* The hero says what the program IS before anything else.
            The screen opened on a header, a photo slot and a stats card —
            three containers before a reader learned whether this was a
            strength program or a cut. */}
        <View style={styles.hero}>
          <Svg width={heroWidth} height={210} style={StyleSheet.absoluteFill}>
            <Defs>
              <SvgLinearGradient id="detailHero" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#7C7AD8" />
                <Stop offset="1" stopColor="#3B2E91" />
              </SvgLinearGradient>
              <SvgLinearGradient id="detailHeroScrim" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#1E1246" stopOpacity={0} />
                <Stop offset="1" stopColor="#1E1246" stopOpacity={0.62} />
              </SvgLinearGradient>
            </Defs>
            <Rect x="0" y="0" width={heroWidth} height={210} fill="url(#detailHero)" />
            {/* The program's week, as bars — the same fingerprint the browse
                cards draw, so a program looks like itself wherever it is met. */}
            {heroBars.map((ratio, index) => {
              const slot = (heroWidth - 28) / Math.max(1, heroBars.length);
              const barWidth = Math.max(6, slot - 6);
              const barHeight = Math.max(10, ratio * 74);
              return (
                <Rect
                  key={index}
                  x={14 + index * slot + (slot - barWidth) / 2}
                  y={210 - barHeight}
                  width={barWidth}
                  height={barHeight}
                  rx={3}
                  fill="#FFFFFF"
                  fillOpacity={0.18}
                />
              );
            })}
            <Rect x="0" y="60" width={heroWidth} height={150} fill="url(#detailHeroScrim)" />
          </Svg>
          <View style={styles.heroTopRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(language, 'common.back')}
              hitSlop={10}
              onPress={onBack}
              style={styles.heroGlass}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M15 6l-6 6 6 6" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
            {program.source === 'custom' && onEdit ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(language, 'plan.edit')}
                hitSlop={10}
                onPress={onEdit}
                style={styles.heroGlass}
              >
                <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M4 20h16M6 16l9.5-9.5a2 2 0 0 0-3-3L3 13v3h3z"
                    stroke="#FFFFFF"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.heroBottom}>
            {heroPill ? (
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>{heroPill}</Text>
              </View>
            ) : null}
            <Text style={styles.heroTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>
              {displayTitle}
            </Text>
          </View>
        </View>

        {fitReason ? (
          <View style={styles.reasonCard}>
            <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.4 7.2 17.9l.9-5.4L4.2 8.7l5.4-.8z"
                stroke={PLAN_PURPLE}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={styles.reasonText}>{fitReason}</Text>
          </View>
        ) : null}

        {program.description ? (
          <Text style={styles.leadCopy}>{program.description}</Text>
        ) : null}

        {/* Four numbers, so the commitment is legible before the button. */}
        <View style={styles.statStrip}>
          {[
            { value: `${program.sessions.length}`, label: 'detail.stat.daysPerWeek' as I18nKey },
            {
              value: durationMinutes > 0 ? `~${durationMinutes}` : '—',
              label: 'detail.stat.session' as I18nKey,
            },
            { value: `${blockWeeks}`, label: 'detail.stat.weeks' as I18nKey },
            { value: `${totalSessions}`, label: 'detail.stat.total' as I18nKey },
          ].map((stat, index) => (
            <React.Fragment key={stat.label}>
              {index > 0 ? <View style={styles.statStripDivider} /> : null}
              <View style={styles.statStripItem}>
                <Text style={styles.statStripValue}>{stat.value}</Text>
                <Text style={styles.statStripLabel}>{t(language, stat.label)}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* The week as seven chips: which days train, and what they are. A
            dot-and-word list said "Treeni / Palautuminen" seven times and
            never named a single session. */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t(language, 'detail.rhythm')}</Text>
          <Text style={styles.sectionMeta}>
            {t(language, 'detail.trainingDays', { count: program.sessions.length })}
          </Text>
        </View>
        <View style={styles.rhythmRow}>
          {scheduleSlots.map((slot, index) => {
            const session = slot.isTraining ? trainingDaySessions.get(index) : null;
            return (
              <View key={slot.dayKey} style={[styles.rhythmDay, slot.isTraining && styles.rhythmDayOn]}>
                <Text style={[styles.rhythmDayName, slot.isTraining && styles.rhythmDayNameOn]}>
                  {slot.day}
                </Text>
                <Text
                  style={[styles.rhythmDayLabel, slot.isTraining && styles.rhythmDayLabelOn]}
                  numberOfLines={1}
                >
                  {session ? shortSessionLabel(session, language) : t(language, 'detail.rest')}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t(language, 'detail.workouts')}</Text>
          <Text style={styles.sectionMeta}>
            {t(language, 'detail.inRotation', { count: program.sessions.length })}
          </Text>
        </View>
        <View style={styles.workoutList}>
          {program.sessions.map((session, index) => {
            const contentSections = buildSessionContentSections(session);

            return (
              <View key={session.id} style={styles.workoutCard}>
                <View style={styles.workoutTopRow}>
                  <View style={styles.workoutIndexTile}>
                    <Text style={styles.workoutIndexText}>{index + 1}</Text>
                  </View>
                  <View style={styles.workoutCopy}>
                    <Text style={styles.workoutName} numberOfLines={1} adjustsFontSizeToFit>
                      {formatPlanSessionTitle(session, index, displayTitle, language)}
                    </Text>
                    <Text style={styles.workoutMeta}>
                      {durationMinutes > 0 ? `~${durationMinutes} min` : t(language, 'detail.flexible')} -{' '}
                      {t(
                        language,
                        session.exerciseCount === 1 ? 'tpl.exerciseOne' : 'tpl.exerciseMany',
                        { count: session.exerciseCount },
                      )}
                    </Text>
                  </View>
                  <Pressable onPress={() => onStartSession(session.id)} style={styles.workoutAction}>
                    <Text style={styles.workoutActionText}>{t(language, 'detail.start')}</Text>
                  </Pressable>
                </View>
                <Text style={styles.workoutFocus} numberOfLines={2}>
                  {getWorkoutFocus(session, language)}
                </Text>
                <View style={styles.sessionContentList}>
                  {contentSections.map((section) => (
                    <View key={`${session.id}:${section.titleKey}`} style={styles.sessionContentSection}>
                      <Text style={styles.sessionContentTitle}>{t(language, section.titleKey)}</Text>
                      {section.items.map((exercise) => (
                        <View key={exercise.id} style={styles.sessionContentRow}>
                          <Text style={styles.sessionContentName} numberOfLines={1}>
                            {exerciseNameLabel(language, exercise.name)}
                          </Text>
                          {/* What the exercise is FOR, read off the template's
                              own role rather than written per program. The list
                              gave five lifts equal weight, so the two that
                              decide the session looked like the two that do
                              not. */}
                          {exercise.role && ROLE_KEYS[exercise.role] ? (
                            <View
                              style={[
                                styles.roleTag,
                                { backgroundColor: ROLE_TINTS[exercise.role]?.bg ?? PLAN_PURPLE_SOFT },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.roleTagText,
                                  { color: ROLE_TINTS[exercise.role]?.ink ?? PLAN_PURPLE_DARK },
                                ]}
                              >
                                {t(language, ROLE_KEYS[exercise.role])}
                              </Text>
                            </View>
                          ) : null}
                          <Text style={styles.sessionContentMeta} numberOfLines={1}>
                            {exercise.prescription}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>

        {/* How the weight goes up.
            The catalog carries these four rules per template and the app had
            never shown one: they were written in English, and the screen's
            answer to English text had been not to render it. 55 templates
            share 69 distinct sentences between them, so they are translated
            the same way exercise names are. */}
        {progressionRules ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t(language, 'detail.progression')}</Text>
            </View>
            <View style={styles.ruleCard}>
              {(
                [
                  ['detail.rule.primary', progressionRules.primary],
                  ['detail.rule.secondary', progressionRules.secondary],
                  ['detail.rule.failure', progressionRules.failureHandling],
                ] as Array<[I18nKey, string]>
              ).map(([labelKey, rule], index) => (
                <View key={labelKey} style={[styles.ruleRow, index > 0 && styles.ruleRowDivider]}>
                  <Text style={styles.ruleIndex}>{index + 1}</Text>
                  <Text style={styles.ruleText}>
                    <Text style={styles.ruleLead}>{t(language, labelKey)} </Text>
                    {progressionRuleLabel(language, rule)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* Who it is for, and the one thing that can make it the wrong pick:
            a week that does not have room for it. */}
        {audience ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t(language, 'detail.forWhom')}</Text>
            </View>
            <View style={styles.ruleCard}>
              <Text style={styles.audienceText}>{audience}</Text>
              {daysWarning ? (
                <View style={styles.warnRow}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M12 4l9 16H3z M12 10v4M12 17v.01"
                      stroke="#D97706"
                      strokeWidth={2.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                  <Text style={styles.warnText}>{daysWarning}</Text>
                </View>
              ) : null}
            </View>
          </>
        ) : null}

        {equipment.length > 0 ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t(language, 'detail.equipment')}</Text>
            </View>
            {/* Derived from the program's own exercises, not from a sentence
                someone wrote. The chips are the names the setup already
                stores, so the two lists compare directly. */}
            <View style={styles.chipWrap}>
              {equipment.map((chip) => (
                <CutSurface key={chip} size="chip" fill={PLAN_SURFACE} style={styles.equipChip}>
                  <Text style={styles.equipChipText}>
                    {t(language, EQUIPMENT_CHIP_KEYS[chip] ?? 'detail.equipment')}
                  </Text>
                </CutSurface>
              ))}
            </View>
            {availableEquipment !== null ? (
              <View style={[styles.gymNote, missingGear.length === 0 && styles.gymNoteOk]}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path
                    d={missingGear.length === 0 ? 'M4 12.5l5 5 11-11' : 'M12 4l9 16H3z M12 10v4M12 17v.01'}
                    stroke={missingGear.length === 0 ? PLAN_GREEN : '#D97706'}
                    strokeWidth={2.3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text style={[styles.gymNoteText, missingGear.length === 0 && styles.gymNoteTextOk]}>
                  {missingGear.length === 0
                    ? t(language, 'detail.equipmentOk')
                    : t(language, 'detail.equipmentMissing', {
                        items: missingGear
                          .map((chip) => t(language, EQUIPMENT_CHIP_KEYS[chip] ?? 'detail.equipment'))
                          .join(', '),
                      })}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}

        {onMakeOwnVersion ? (
          <View style={styles.ownVersionBlock}>
            <Text style={styles.ownVersionNote}>{t(language, 'detail.ownVersion.note')}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={onMakeOwnVersion}
              style={({ pressed }) => [styles.ownVersionButton, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.ownVersionButtonText}>{t(language, 'detail.ownVersion.cta')}</Text>
            </Pressable>
          </View>
        ) : null}

        {hasDestructiveAction ? (
          <Pressable onPress={() => setConfirmVisible(true)} style={styles.destructiveButton}>
            <Text style={styles.destructiveButtonText}>{destructiveActionLabel}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <View style={styles.stickyFooter}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'detail.startNext')}
          disabled={!nextSession}
          onPress={() => {
            if (nextSession) {
              onStartSession(nextSession.id);
            }
          }}
          style={[styles.primaryButton, !nextSession && styles.primaryButtonDisabled]}
        >
          <Text style={styles.primaryButtonText}>{t(language, 'detail.startNext')}</Text>
        </Pressable>
      </View>

      {hasDestructiveAction ? (
        <ConfirmDialog
          visible={confirmVisible}
          title={destructiveActionTitle!}
          message={destructiveActionMessage!}
          confirmLabel={destructiveActionLabel!}
          destructive
          onCancel={() => setConfirmVisible(false)}
          onConfirm={handleConfirmDelete}
        />
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  hero: {
    height: 210,
    marginHorizontal: -20,
    marginTop: -8,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 46,
  },
  heroGlass: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBottom: {
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  heroPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroPillText: {
    color: '#101828',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.9,
    marginTop: 9,
  },
  leadCopy: {
    color: PLAN_TEXT,
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: '600',
    marginTop: 14,
  },
  statStrip: {
    flexDirection: 'row',
    marginTop: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EFEAFB',
    backgroundColor: PLAN_SURFACE,
    paddingVertical: 13,
  },
  statStripItem: {
    flex: 1,
    alignItems: 'center',
  },
  statStripDivider: {
    width: 1,
    backgroundColor: '#F1EBFC',
    marginVertical: 3,
  },
  statStripValue: {
    color: PLAN_TEXT,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  statStripLabel: {
    color: '#9A93AC',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 3,
  },
  rhythmRow: {
    flexDirection: 'row',
    gap: 5,
  },
  rhythmDay: {
    flex: 1,
    borderRadius: 13,
    backgroundColor: '#F2ECFF',
    borderWidth: 1,
    borderColor: '#E9E0FB',
    paddingVertical: 9,
    alignItems: 'center',
  },
  rhythmDayOn: {
    backgroundColor: '#3F2A78',
    borderColor: '#3F2A78',
  },
  rhythmDayName: {
    color: '#9A93AC',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  rhythmDayNameOn: {
    color: 'rgba(255,255,255,0.66)',
  },
  rhythmDayLabel: {
    color: '#B6AEC8',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    marginTop: 6,
  },
  rhythmDayLabelOn: {
    color: '#FFFFFF',
  },
  reasonCard: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E7DBFC',
    backgroundColor: '#F4EFFE',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  reasonText: {
    flex: 1,
    color: '#5C5370',
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '700',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  equipChip: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  equipChipText: {
    color: '#3F3A4B',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  gymNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#F3E4CF',
    backgroundColor: '#FFFBF3',
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  gymNoteOk: {
    borderColor: '#CFEEDA',
    backgroundColor: '#F0FBF3',
  },
  gymNoteText: {
    flex: 1,
    color: '#8A5C22',
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '700',
  },
  gymNoteTextOk: {
    color: '#276B41',
  },
  ruleCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#EFEAFB',
    backgroundColor: PLAN_SURFACE,
    padding: 14,
  },
  ruleRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
  },
  ruleRowDivider: {
    borderTopWidth: 1,
    borderTopColor: '#F5F1FC',
  },
  ruleIndex: {
    width: 14,
    color: PLAN_PURPLE,
    fontSize: 12.5,
    lineHeight: 19,
    fontWeight: '800',
  },
  ruleText: {
    flex: 1,
    color: '#3F3A4B',
    fontSize: 12.5,
    lineHeight: 19,
    fontWeight: '600',
  },
  ruleLead: {
    color: PLAN_TEXT,
    fontWeight: '800',
  },
  audienceText: {
    color: '#3F3A4B',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  warnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F1FC',
  },
  warnText: {
    flex: 1,
    color: '#8A5C22',
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '700',
  },
  roleTag: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  roleTagText: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: layout.bottomTabBarReserve + 82,
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    color: PLAN_TEXT,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  sectionMeta: {
    color: PLAN_TEXT_MUTED,
    fontSize: 12,
    fontWeight: '800',
  },
  workoutList: {
    gap: spacing.sm,
  },
  workoutCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: PLAN_BORDER,
    backgroundColor: PLAN_SURFACE,
    padding: spacing.md,
    gap: spacing.sm,
  },
  workoutTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  workoutIndexTile: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PLAN_SURFACE_SOFT,
  },
  workoutIndexText: {
    color: PLAN_PURPLE,
    fontSize: 20,
    fontWeight: '900',
  },
  workoutCopy: {
    flex: 1,
    gap: 3,
  },
  workoutName: {
    color: PLAN_TEXT,
    fontSize: 17,
    fontWeight: '900',
  },
  workoutMeta: {
    color: PLAN_TEXT_MUTED,
    fontSize: 12,
    fontWeight: '800',
  },
  workoutAction: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    justifyContent: 'center',
    // Actions wear the app purple; green here stays for recovery days only.
    backgroundColor: PLAN_PURPLE_SOFT,
  },
  workoutActionText: {
    color: PLAN_PURPLE,
    fontSize: 13,
    fontWeight: '900',
  },
  workoutFocus: {
    color: PLAN_TEXT_MUTED,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  sessionContentList: {
    overflow: 'hidden',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: PLAN_BORDER,
    backgroundColor: '#FAF8FF',
  },
  sessionContentSection: {
    borderBottomWidth: 1,
    borderBottomColor: PLAN_BORDER,
  },
  sessionContentTitle: {
    backgroundColor: '#ECE7F2',
    color: PLAN_TEXT,
    fontSize: 14,
    fontWeight: '900',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sessionContentRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: PLAN_SURFACE,
    borderTopWidth: 1,
    borderTopColor: '#F0E8FF',
  },
  sessionContentName: {
    flex: 1,
    color: PLAN_TEXT,
    fontSize: 13,
    fontWeight: '800',
  },
  sessionContentMeta: {
    color: PLAN_TEXT_MUTED,
    fontSize: 12,
    fontWeight: '800',
  },
  ownVersionBlock: {
    marginTop: 26,
  },
  ownVersionNote: {
    color: theme.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    marginBottom: 12,
  },
  ownVersionButton: {
    height: 50,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: theme.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownVersionButtonText: {
    color: theme.purple,
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '800',
  },
  destructiveButton: {
    minHeight: 48,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  destructiveButtonText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '900',
  },
  stickyFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    backgroundColor: 'rgba(247, 243, 255, 0.96)',
    borderTopWidth: 1,
    borderTopColor: PLAN_BORDER,
  },
  primaryButton: {
    minHeight: 58,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PLAN_PURPLE,
    shadowColor: PLAN_PURPLE,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
});
