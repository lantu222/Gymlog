import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { ConfirmDialog } from '../components/ConfirmDialog';
import { CutSurface } from '../components/CutSurface';
import { ProgramPhotoSlot } from '../components/ProgramPhotoSlot';
import { formatWorkoutDisplayLabel } from '../lib/displayLabel';
import { I18nKey, t } from '../lib/i18n';
import {
} from '../lib/homeSessionHero';
import { ProgramDetailViewModel } from '../lib/programDetails';
import { progressionRuleLabel } from '../lib/progressionRuleLabel';
import { EQUIPMENT_CHIP_KEYS, missingEquipment } from '../lib/programEquipment';
import { EmphasisSheet } from '../components/EmphasisSheet';
import { EMPHASIS_AREA_KEYS, emphasisAreaForExercise, resolveProgramEmphasis } from '../lib/programEmphasis';
import { WEEKDAY_KEYS } from '../lib/programTrainingDays';
import { EMPHASIS_RAMP, programCoverStyle } from '../lib/programVisualIdentity';
import { Theme, useTheme, useThemedStyles } from '../theming';
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

/*
 * This screen used to carry its own palette — nine PLAN_* constants and about
 * thirty inline hexes, all light. Under the dark theme it kept every one of
 * them: white cards, near-black body copy on a near-black page. The colours
 * below now come from the theme, and the handful that stay fixed (the hero
 * gradient, white on that gradient) are fixed because they sit on a painted
 * surface that does not change.
 */
/**
 * How far up the hero's left edge the seam cuts.
 *
 * Shallower than the browse card's 0.82: at 210px tall the same ratio would
 * carve nearly forty pixels off the corner and start eating the back button.
 */
/**
 * The programme hero. Raised from 210 so the painted area comes well down the
 * page instead of ending just under the title.
 */
const HERO_HEIGHT = 262;
const HERO_SEAM_RATIO = 0.92;


interface ProgramDetailScreenProps {
  program: ProgramDetailViewModel;
  onBack: () => void;
  onPrimaryAction: () => void;
  onStartSession: (sessionId: string) => void;
  /** The day row's destination — the day view (design screen 2). */
  onOpenSession?: (sessionId: string) => void;
  /** The catalog's declared block length. Null for a programme with none. */
  programBlockWeeks?: number | null;
  /** Monday-first indexes the plan currently trains on, when it names days. */
  trainingDayIndexes?: number[] | null;
  /** Commits a finished rhythm change. Absent = the strip is read-only. */
  onSaveRhythm?: (dayIndexes: number[]) => void;
  /**
   * Writes new set counts (design screen 3). Present only for programmes whose
   * sets are the reader's to change — a catalog template is immutable at
   * runtime, so a ready programme gets no stepper rather than a stepper that
   * silently does nothing.
   */
  onSaveEmphasis?: (updates: Array<{ sessionId: string; exerciseId: string; sets: number }>) => void;
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
  onPrimaryAction,
  onOpenSession,
  programBlockWeeks = null,
  trainingDayIndexes = null,
  onSaveRhythm,
  onSaveEmphasis,
  onEdit,
  progressionRules = null,
  audience = null,
  availableDays = null,
  equipment = [],
  availableEquipment = null,
  fitReason = null,
  destructiveActionLabel,
  destructiveActionTitle,
  destructiveActionMessage,
  onDestructiveAction,
  activePlanSummary = null,
  language = 'en',
}: ProgramDetailScreenProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  // The programme's own colour, the same one its browse cover wears.
  const identity = programCoverStyle(program.id, program.title);
  const [emphasisSheetVisible, setEmphasisSheetVisible] = useState(false);
  // Flat, in a fixed order: the sheet returns set counts by index, so this
  // list is the contract between the two.
  const emphasisRows = useMemo(
    () =>
      program.sessions.flatMap((session) =>
        session.exercises.map((exercise) => ({
          sessionId: session.id,
          exerciseId: exercise.id,
          area: emphasisAreaForExercise(exercise.name),
          role: exercise.role as string,
          sets: exercise.sets,
        })),
      ),
    [program.sessions],
  );
  const emphasis = useMemo(
    () =>
      resolveProgramEmphasis(
        program.sessions.map((session) => ({
          exercises: session.exercises.map((exercise) => ({ name: exercise.name, sets: exercise.sets })),
        })),
      ),
    [program.sessions],
  );
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
  const durationMinutes = parseMinutesFromBadges(program.badges);
  // Eight weeks is the catalog's default block; the strip states the same
  // number the total is derived from rather than two numbers that disagree.
  /**
   * How long the block runs — only when the programme actually declares it.
   *
   * This was a hardcoded 8, so a one-week, one-session programme advertised
   * "8 VIIKKOA · 8 TREENIÄ". A programme the reader built has no declared
   * length: it runs until they stop. The strip drops both numbers rather than
   * inventing a commitment, which is the same rule the description and the
   * duration already follow.
   */
  const blockWeeks = programBlockWeeks ?? null;
  const totalSessions = blockWeeks === null ? null : program.sessions.length * blockWeeks;
  const progressPercent = activePlanSummary?.progressPercent ?? 1;
  const weekLabel = activePlanSummary?.weekLabel ?? t(language, 'detail.weekFallback');
  const sessionsPerWeek = activePlanSummary?.sessionsPerWeek ?? `${program.sessions.length}`;
  const weeklyMinutes =
    activePlanSummary?.weeklyMinutes ??
    (durationMinutes > 0
      ? `~${durationMinutes * Math.max(1, program.sessions.length)} min`
      : t(language, 'detail.workoutCount', { count: program.sessions.length }));
  /**
   * The rhythm the strip shows: the plan's own days when it names them, the
   * derived spread otherwise.
   */
  const committedDays = useMemo(() => {
    if (trainingDayIndexes && trainingDayIndexes.length > 0) {
      return [...trainingDayIndexes].sort((left, right) => left - right);
    }
    return [...getTrainingDayIndexes(program.sessions.length)].sort((left, right) => left - right);
  }, [program.sessions.length, trainingDayIndexes]);

  /**
   * A half-finished move is never written.
   *
   * Moving a day is two taps: one off, one on. Between them the week is short
   * a session, and a plan that trains three days must not be persisted as
   * training two because a thumb left the screen. The draft lives here, is
   * committed only when the count is whole again, and is dropped when the
   * screen goes away — the reader gets Monday back rather than a week they
   * never chose.
   */
  const [draftDays, setDraftDays] = useState<number[] | null>(null);
  useEffect(() => () => setDraftDays(null), []);
  const shownDays = draftDays ?? committedDays;
  const rhythmIncomplete = draftDays !== null && draftDays.length !== committedDays.length;

  const toggleRhythmDay = (index: number) => {
    if (!onSaveRhythm) {
      return;
    }
    const base = draftDays ?? committedDays;
    const next = base.includes(index)
      ? base.filter((day) => day !== index)
      : [...base, index].sort((left, right) => left - right);

    if (next.length === committedDays.length) {
      setDraftDays(null);
      onSaveRhythm(next);
      return;
    }
    setDraftDays(next);
  };

  const trainingDaySessions = useMemo(() => {
    const map = new Map<number, string>();
    shownDays.forEach((dayIndex, order) => {
      const session = program.sessions[order];
      if (session) {
        map.set(dayIndex, session.name);
      }
    });
    return map;
  }, [program.sessions, shownDays]);

  const scheduleSlots = useMemo(
    () =>
      DAY_KEYS.map((dayKey, index) => ({
        dayKey,
        day: t(language, dayKey).toUpperCase(),
        isTraining: shownDays.includes(index),
      })),
    [language, shownDays],
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
          <Svg width={heroWidth} height={HERO_HEIGHT} style={StyleSheet.absoluteFill}>
            <Defs>
              {/* The same seam the browse cards carry, at hero scale (design:
                  GAINER Boost-tyyli, frame D). Clipped inside the SVG for the
                  same reason: overflow clips to the rectangle, and the
                  gradient, the bars and the scrim would all run past the
                  slope. */}
              <ClipPath id="detailHeroSeam">
                <Path d={`M0 0 H${heroWidth} V${HERO_HEIGHT} L0 ${HERO_HEIGHT * HERO_SEAM_RATIO} Z`} />
              </ClipPath>
              <SvgLinearGradient id="detailHero" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={identity.hero[0]} />
                <Stop offset="1" stopColor={identity.hero[1]} />
              </SvgLinearGradient>
              <SvgLinearGradient id="detailHeroScrim" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#1E1246" stopOpacity={0} />
                <Stop offset="1" stopColor="#1E1246" stopOpacity={0.62} />
              </SvgLinearGradient>
            </Defs>
            <G clipPath="url(#detailHeroSeam)">
            <Rect x="0" y="0" width={heroWidth} height={HERO_HEIGHT} fill="url(#detailHero)" />
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
                  y={HERO_HEIGHT - barHeight}
                  width={barWidth}
                  height={barHeight}
                  rx={3}
                  fill="#FFFFFF"
                  fillOpacity={0.18}
                />
              );
            })}
            <Rect x="0" y="60" width={heroWidth} height={150} fill="url(#detailHeroScrim)" />
            </G>
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
                stroke={theme.purple}
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
            ...(blockWeeks !== null && totalSessions !== null
              ? [
                  { value: `${blockWeeks}`, label: 'detail.stat.weeks' as I18nKey },
                  { value: `${totalSessions}`, label: 'detail.stat.total' as I18nKey },
                ]
              : [{ value: `${program.sessions.length}`, label: 'detail.stat.perWeek' as I18nKey }]),
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

        {/* Who it is for, first.

            It sat fourth, under the day list and the progression rules — so
            the reader worked through how a programme runs before finding out
            whether it was meant for them, which is the question they opened
            it with (user 2026-08-26, "nostetaan kenelle osio ylös").

            It still carries the one thing that can make it the wrong pick: a
            week that does not have room for it. */}
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
                      stroke={theme.amber}
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
            const chip = (
              <>
                <Text style={[styles.rhythmDayName, slot.isTraining && styles.rhythmDayNameOn]}>
                  {slot.day}
                </Text>
                <Text
                  style={[styles.rhythmDayLabel, slot.isTraining && styles.rhythmDayLabelOn]}
                  numberOfLines={1}
                >
                  {session ? shortSessionLabel(session, language) : t(language, 'detail.rest')}
                </Text>
              </>
            );
            if (!onSaveRhythm) {
              return (
                <View key={slot.dayKey} style={[styles.rhythmDay, slot.isTraining && styles.rhythmDayOn]}>
                  {chip}
                </View>
              );
            }
            return (
              <Pressable
                key={slot.dayKey}
                accessibilityRole="button"
                onPress={() => toggleRhythmDay(index)}
                style={({ pressed }) => [
                  styles.rhythmDay,
                  slot.isTraining && styles.rhythmDayOn,
                  pressed && styles.rhythmDayPressed,
                ]}
              >
                {chip}
              </Pressable>
            );
          })}
        </View>
        {rhythmIncomplete ? (
          /* Both directions. The copy assumed a day had been removed, so
             adding one first read "Valitse vielä -1 päivä". */
          <Text style={styles.rhythmHint}>
            {t(
              language,
              (draftDays?.length ?? 0) < committedDays.length
                ? 'detail.rhythm.pickAnother'
                : 'detail.rhythm.dropOne',
              { count: Math.abs(committedDays.length - (draftDays?.length ?? 0)) },
            )}
          </Text>
        ) : null}

        {/* The one thing a reader comes to a programme page to do.
            It used to live in a footer pinned to the bottom of the screen,
            where the floating tab bar covered it completely: the button was
            rendered, and all you could see of it was a violet sliver above the
            nav pill. Here it sits in the flow, right after the week it
            describes, and nothing can be painted on top of it. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={program.primaryActionLabel}
          onPress={onPrimaryAction}
          style={({ pressed }) => [styles.adoptButton, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.adoptButtonText}>{program.primaryActionLabel}</Text>
        </Pressable>

        {emphasis ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.emphasisTitle}>{t(language, 'detail.emphasis.title')}</Text>
              {onSaveEmphasis ? (
                <Pressable hitSlop={8} onPress={() => setEmphasisSheetVisible(true)}>
                  <Text style={styles.emphasisEdit}>{t(language, 'detail.emphasis.edit')}</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.emphasisCard}>
              <View style={styles.emphasisBar}>
                {emphasis.slices.map((slice) => (
                  <View
                    key={slice.area}
                    style={[
                      styles.emphasisSegment,
                      { flex: slice.sets, backgroundColor: EMPHASIS_RAMP[slice.area] },
                    ]}
                  />
                ))}
              </View>
              <View style={styles.emphasisLegend}>
                {emphasis.slices.map((slice) => (
                  <View key={slice.area} style={styles.emphasisLegendItem}>
                    <View style={[styles.emphasisDot, { backgroundColor: EMPHASIS_RAMP[slice.area] }]} />
                    <Text style={styles.emphasisLegendText}>
                      {t(language, EMPHASIS_AREA_KEYS[slice.area])}{' '}
                      <Text style={styles.emphasisLegendPercent}>{slice.percent} %</Text>
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t(language, 'detail.workouts')}</Text>
          {/* The hero's pencil is gone, but the template editor is only
              reachable from here — dropping the affordance entirely would
              orphan a whole screen. It is a quiet text action beside the list
              it edits instead of a glass button over the artwork. */}
          {program.source === 'custom' && onEdit ? (
            <Pressable hitSlop={8} onPress={onEdit}>
              <Text style={styles.emphasisEdit}>{t(language, 'plan.edit')}</Text>
            </Pressable>
          ) : null}
        </View>
        {/* Compact rows now (design: "päivärivi vie tänne") — the full
            content moved to the day view, where roles, rests and the warm-up
            have the room the inline list never gave them. The row still keeps
            its quick Aloita, because starting today's session is the most
            common thing done here. */}
        <View style={styles.workoutList}>
          {program.sessions.map((session, index) => (
            <Pressable
              key={session.id}
              onPress={() => (onOpenSession ?? onStartSession)(session.id)}
              style={({ pressed }) => [styles.workoutCard, pressed && styles.workoutCardPressed]}
            >
              <View style={styles.workoutTopRow}>
                {/* No index tile: the row's own title already says "Päivä 1",
                    so the big numeral was the same fact twice, at the size of
                    the more important one. */}
                <View style={styles.workoutCopy}>
                  <Text style={styles.workoutName} numberOfLines={1} adjustsFontSizeToFit>
                    {formatPlanSessionTitle(session, index, displayTitle, language)}
                  </Text>
                  <Text style={styles.workoutMeta}>
                    {t(
                      language,
                      session.exerciseCount === 1 ? 'tpl.exerciseOne' : 'tpl.exerciseMany',
                      { count: session.exerciseCount },
                    )}
                    {session.totalSets > 0 ? ` · ${session.totalSets} ${t(language, 'detail.day.sets').toLowerCase()}` : ''}
                    {durationMinutes > 0 ? ` · ~${durationMinutes} min` : ''}
                  </Text>
                </View>
                {/* An eye, not a chevron and not a start button: the row is a
                    look at the day, and the day view has the real start. Two
                    starts a thumb-width apart is how you begin the wrong
                    session. */}
                <Svg viewBox="0 0 24 24" width={19} height={19}>
                  <Path
                    d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z"
                    stroke={theme.purple}
                    strokeWidth={1.9}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                  <Circle cx={12} cy={12} r={2.6} stroke={theme.purple} strokeWidth={1.9} fill="none" />
                </Svg>
              </View>
            </Pressable>
          ))}
        </View>

        {/* "Tee tästä oma versio" stood here. It asked the reader to
            understand that catalog programmes are fixed and theirs are not,
            before they could change one lift — and the reader looking for a
            way to drop an exercise never found it (user 2026-08-26). The copy
            still happens; it happens underneath the change that needed it. */}

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
                <CutSurface key={chip} size="chip" fill={theme.surface} style={styles.equipChip}>
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
                    stroke={missingGear.length === 0 ? theme.green : theme.amber}
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

        {/* "Make my own version" used to sit here. Removed on request: it was
            the only action a reader could actually see on this screen, so a
            programme page read as an invitation to fork rather than to train.
            Home's Adapt sheet still offers the copy for a programme you are
            already running. */}
        {hasDestructiveAction ? (
          <Pressable onPress={() => setConfirmVisible(true)} style={styles.destructiveButton}>
            <Text style={styles.destructiveButtonText}>{destructiveActionLabel}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {onSaveEmphasis ? (
        <EmphasisSheet
          visible={emphasisSheetVisible}
          language={language}
          exercises={emphasisRows}
          onClose={() => setEmphasisSheetVisible(false)}
          onSave={(sets) => {
            setEmphasisSheetVisible(false);
            onSaveEmphasis(
              emphasisRows
                .map((row, index) => ({ ...row, sets: sets[index] ?? row.sets }))
                // Only what actually changed: a save that rewrites every
                // exercise touches rows the reader never moved.
                .filter((row, index) => row.sets !== emphasisRows[index].sets)
                .map((row) => ({ sessionId: row.sessionId, exerciseId: row.exerciseId, sets: row.sets })),
            );
          }}
        />
      ) : null}

      {hasDestructiveAction ? (
        <ConfirmDialog
          language={language}
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
    height: HERO_HEIGHT,
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
    color: theme.ink,
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
    borderColor: theme.border,
    backgroundColor: theme.surface,
    paddingVertical: 13,
  },
  statStripItem: {
    flex: 1,
    alignItems: 'center',
  },
  statStripDivider: {
    width: 1,
    backgroundColor: theme.border,
    marginVertical: 3,
  },
  statStripValue: {
    color: theme.ink,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  statStripLabel: {
    color: theme.faint,
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
    backgroundColor: theme.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.border,
    paddingVertical: 9,
    alignItems: 'center',
  },
  rhythmDayOn: {
    backgroundColor: theme.purpleDark,
    borderColor: theme.purpleDark,
  },
  rhythmDayPressed: {
    opacity: 0.7,
  },
  rhythmHint: {
    color: theme.purple,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 8,
  },
  rhythmDayName: {
    color: theme.faint,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  rhythmDayNameOn: {
    color: 'rgba(255,255,255,0.66)',
  },
  rhythmDayLabel: {
    color: theme.muted,
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
    borderColor: theme.border,
    backgroundColor: theme.surfaceSoft,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  reasonText: {
    flex: 1,
    color: theme.muted,
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
    color: theme.ink,
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
    borderColor: theme.amberBorder,
    backgroundColor: theme.amberSoft,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  gymNoteOk: {
    borderColor: theme.green,
    backgroundColor: theme.greenSoft,
  },
  gymNoteText: {
    flex: 1,
    color: theme.amberInk,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '700',
  },
  gymNoteTextOk: {
    color: theme.greenInk,
  },
  ruleCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    padding: 14,
  },
  ruleRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
  },
  ruleRowDivider: {
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  ruleIndex: {
    width: 14,
    color: theme.purple,
    fontSize: 12.5,
    lineHeight: 19,
    fontWeight: '800',
  },
  ruleText: {
    flex: 1,
    color: theme.ink,
    fontSize: 12.5,
    lineHeight: 19,
    fontWeight: '600',
  },
  ruleLead: {
    color: theme.ink,
    fontWeight: '800',
  },
  audienceText: {
    color: theme.ink,
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
    borderTopColor: theme.border,
  },
  warnText: {
    flex: 1,
    color: theme.amberInk,
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
    // The +82 was clearance for the pinned footer that used to sit here.
    paddingBottom: layout.bottomTabBarReserve,
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
    color: theme.ink,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  sectionMeta: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  workoutList: {
    gap: spacing.sm,
  },
  workoutCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  workoutCardPressed: {
    transform: [{ scale: 0.985 }],
  },
  emphasisEdit: {
    color: theme.purple,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '800',
  },
  emphasisTitle: {
    color: theme.faint,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  emphasisCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    padding: 14,
  },
  emphasisBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    gap: 2,
  },
  emphasisSegment: {
    height: '100%',
  },
  emphasisLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: 8,
    marginTop: 11,
  },
  emphasisLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emphasisDot: {
    width: 9,
    height: 9,
    borderRadius: 3,
  },
  emphasisLegendText: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  emphasisLegendPercent: {
    color: theme.ink,
    fontWeight: '800',
  },
  workoutTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  workoutCopy: {
    flex: 1,
    gap: 3,
  },
  workoutName: {
    color: theme.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  workoutMeta: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  workoutAction: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    justifyContent: 'center',
    // Actions wear the app purple; green here stays for recovery days only.
    backgroundColor: theme.purpleSoft,
  },
  workoutActionText: {
    color: theme.purple,
    fontSize: 13,
    fontWeight: '900',
  },
  destructiveButton: {
    minHeight: 48,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.dangerSoft,
    borderWidth: 1,
    borderColor: theme.dangerBorder,
  },
  destructiveButtonText: {
    color: theme.danger,
    fontSize: 14,
    fontWeight: '900',
  },
  adoptButton: {
    marginTop: 22,
    minHeight: 62,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: theme.purple,
    shadowColor: theme.purple,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },
  adoptButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
});
