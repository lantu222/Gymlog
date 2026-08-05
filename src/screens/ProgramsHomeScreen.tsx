import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { NewProgramSheet } from '../components/NewProgramSheet';
import { CsvLibraryEntry } from '../lib/csvProgramImport';
import { exerciseNameLabel } from '../lib/exerciseNameLabel';
import { HomeDaySessionSummary } from '../lib/homeCalendar';
import { I18nKey, t } from '../lib/i18n';
import { PROGRAM_CATEGORIES, ProgramCategoryKey } from '../lib/programCategories';
import { isValidTarget, StrengthGoalProgress } from '../lib/strengthGoals';
import type { ProgramSeason } from '../lib/programSeasons';
import { localizeSessionName } from '../lib/sessionNameLabel';
import { Theme, useTheme, useThemedStyles } from '../theming';
import type { AppLanguage, WorkoutTemplateDraft } from '../types/models';

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
// Same spread pattern as ProgramDetailScreen's schedule preview.
const TRAINING_DAY_SPREAD: Record<number, number[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 5],
  5: [0, 1, 3, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
};

/**
 * A generic Mon/Wed/Fri-style spread for plans that DO carry fixed weekdays but
 * are missing one, so the chips stay a weekday set rather than a mix.
 *
 * It is never used to invent a whole week any more: with no fixed labels and no
 * schedule of the user's own, this screen showed MA/KE/PE while Home and
 * Progress showed nothing for the same plan — because those two refuse to
 * invent a rhythm and this one did it happily. One of the three was lying.
 */
function weekdayForSession(index: number, sessionCount: number) {
  const spread = TRAINING_DAY_SPREAD[Math.min(6, Math.max(1, sessionCount))] ?? [0, 2, 4];
  return WEEKDAYS[spread[index] ?? Math.min(index, 6)];
}

// Weekday truth (P6): the saved plan's own entry label wins; the generic
// spread is only a fallback for plans without fixed weekdays.
const WEEKDAY_SET = new Set(WEEKDAYS);

// The three-letter codes above are matched against saved plan entries, so they
// stay English; only what the chip shows is translated.
const WEEKDAY_DISPLAY_KEYS: Record<string, I18nKey> = {
  MON: 'setup.day.mon',
  TUE: 'setup.day.tue',
  WED: 'setup.day.wed',
  THU: 'setup.day.thu',
  FRI: 'setup.day.fri',
  SAT: 'setup.day.sat',
  SUN: 'setup.day.sun',
};

function weekdayLabel(code: string, language: AppLanguage) {
  const key = WEEKDAY_DISPLAY_KEYS[code];
  return (key ? t(language, key) : code).toUpperCase();
}

function resolveSessionWeekday(
  dayLabel: string | null | undefined,
  index: number,
  sessionCount: number,
  anyFixedWeekday: boolean,
): string | null {
  const normalized = dayLabel?.trim().slice(0, 3).toUpperCase() ?? '';
  if (WEEKDAY_SET.has(normalized)) {
    return normalized;
  }
  // Only fill a gap in a plan that otherwise has real weekdays. When nothing
  // in the week is scheduled, the answer is "we do not know" — the badge shows
  // the session number and "Muokkaa päiviä" is right above it.
  return anyFixedWeekday ? weekdayForSession(index, sessionCount) : null;
}

// Designed program covers (README "Program Covers"): a per-program hue rendered
// as a gradient, with a single-stroke signature motif. oklch from the mock is
// pre-converted to sRGB here (RN has no oklch). Each Explore card cycles a style
// so the catalog stays visually distinct without photography.
const LAYERS_MOTIF = 'M12 3l8 4.5-8 4.5-8-4.5 8-4.5z M4 12l8 4.5 8-4.5 M4 16.5l8 4.5 8-4.5';
const COVER_STYLES: Array<{ cover: [string, string]; tile: [string, string]; motif: string }> = [
  { cover: ['#7699FB', '#2D48C0'], tile: ['#82A1F6', '#4767D3'], motif: LAYERS_MOTIF }, // hue 268
  { cover: ['#00B1E0', '#0068A2'], tile: ['#15B6DF', '#0083B7'], motif: 'M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10' }, // 222 barbell
  { cover: ['#D179CA', '#8D1A89'], tile: ['#D285CB', '#A644A0'], motif: 'M12 3a9 9 0 100 18 9 9 0 000-18z M12 8a4 4 0 100 8 4 4 0 000-8z' }, // 330 rings
  { cover: ['#37B976', '#007322'], tile: ['#55BD82', '#008D44'], motif: 'M13 2L4 14h7l-1 8 9-12h-7z' }, // 156 bolt
  { cover: ['#EB7A52', '#A71000'], tile: ['#E98664', '#BF4306'], motif: 'M3 10.5 12 3l9 7.5 M5 9.5V20h14V9.5' }, // 40 house
];
const SAVED_TILE: [string, string] = ['#00BAD1', '#0088A8'];

const COVER_W = 274;
const COVER_H = 176;

export interface ProgramsActiveProgram {
  programId: string;
  programType?: 'ready' | 'custom';
  title: string;
  goalLabel: string;
  focusLabel: string;
  weekLabel: string;
  currentWeek: number;
  planTotalWeeks: number;
  sessionsPerWeek: string;
  sessions: HomeDaySessionSummary[];
  nextSession: HomeDaySessionSummary & { label: string };
}

export interface ProgramsExploreItem {
  id: string;
  name: string;
  goal: string;
  blurb: string;
  days: number;
  minutes: number;
  coverIndex: number;
  /** The program's week as bar heights — see lib/programFingerprint. */
  fingerprint: number[];
}

export interface ProgramsCustomItem {
  id: string;
  name: string;
  subtitle: string;
}

interface ProgramsHomeScreenProps {
  activeProgram?: ProgramsActiveProgram | null;
  exploreItems: ProgramsExploreItem[];
  /**
   * Winter and summer, current season first.
   *
   * The one piece of this catalog a global competitor cannot copy per market:
   * October to March in Finland the sun is gone and training moves indoors,
   * and the reason to open a training app in November is not the reason in
   * June. Free, like every ready program — a paywalled reason to come back
   * brings nobody back.
   */
  seasonRows: Array<{ season: ProgramSeason; items: ProgramsExploreItem[] }>;
  /**
   * The whole catalog as cards, not a curated eight.
   *
   * A category tile that says "Voima 8" has to be able to open eight, and the
   * old Explore row was a hand-picked list that no filter could reach past.
   */
  catalogItems: ProgramsExploreItem[];
  categoryCounts: Record<ProgramCategoryKey, number>;
  categoryMembers: Record<ProgramCategoryKey, string[]>;
  /**
   * Most-started programs — null when there is nothing honest to show.
   *
   * Social proof needs other people, and this device only knows what its own
   * owner did. Until a server counts starts these numbers are invented, so
   * they live behind the demo flag and this prop is null in a release build.
   * The row disappears rather than falling back: there is no honest fallback.
   */
  trendingItems: Array<{ id: string; name: string; weeks: number; starts: string }> | null;
  /**
   * The one or two programs the engine picked, each carrying its reason.
   *
   * Empty when the setup answers are missing — a recommendation with nothing
   * behind it is worse than no row. Never labelled AI: aiInfo.never.2 says
   * the model is never used to pick a programme, and it is not.
   */
  /**
   * Strength targets with their progress. Empty until the reader sets one —
   * the app stores a goal CATEGORY from onboarding, never a number, so a bar
   * had nothing behind it before this.
   */
  goals: StrengthGoalProgress[];
  /** Lifts with logged work: you cannot set a target on something never done. */
  goalCandidates: Array<{ name: string; label: string; bestKg: number }>;
  onSetGoal: (exerciseName: string, targetKg: number) => void;
  onRemoveGoal: (exerciseName: string) => void;
  recommendations: Array<{
    id: string;
    name: string;
    goal: string;
    why: string;
    days: number;
    minutes: number;
    coverIndex: number;
    fingerprint: number[];
  }>;
  customPrograms: ProgramsCustomItem[];
  exerciseLibraryCount: number;
  onStartActiveSession: (sessionId: string) => void;
  onOpenActivePlan: () => void;
  onAdjustSchedule: () => void;
  onOpenExploreProgram: (programId: string) => void;
  onOpenCustomProgram: (programId: string) => void;
  onViewAllPrograms: () => void;
  onCreateProgram: () => void;
  onAiAssisted: () => void;
  onImportProgram: (draft: WorkoutTemplateDraft) => Promise<void> | void;
  exerciseLibraryEntries: CsvLibraryEntry[];
  language?: AppLanguage;
  onOpenLibrary: () => void;
}

const WEEK_PHASE_KEYS: I18nKey[] = [
  'programs.phase.base',
  'programs.phase.rhythm',
  'programs.phase.volume',
  'programs.phase.peak',
];

function phaseNote(currentWeek: number, totalWeeks: number, language: AppLanguage): string {
  if (totalWeeks <= 1) {
    return t(language, WEEK_PHASE_KEYS[0]);
  }
  const ratio = (currentWeek - 1) / Math.max(1, totalWeeks - 1);
  const index = Math.min(WEEK_PHASE_KEYS.length - 1, Math.max(0, Math.round(ratio * (WEEK_PHASE_KEYS.length - 1))));
  return t(language, WEEK_PHASE_KEYS[index]);
}

function GradientTile({ stops, size, radius }: { stops: [string, string]; size: number; radius: number }) {
  const gid = `tile-${stops[0]}-${size}`.replace(/[^a-zA-Z0-9]/g, '');
  const glyph = size * 0.42;
  return (
    <Svg width={size} height={size}>
      <Defs>
        <SvgLinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={stops[0]} />
          <Stop offset="1" stopColor={stops[1]} />
        </SvgLinearGradient>
      </Defs>
      <Rect x="0" y="0" width={size} height={size} rx={radius} ry={radius} fill={`url(#${gid})`} />
      <Svg x={(size - glyph) / 2} y={(size - glyph) / 2} width={glyph} height={glyph} viewBox="0 0 24 24">
        <Path
          d={LAYERS_MOTIF}
          stroke="#FFFFFF"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={0.95}
        />
      </Svg>
    </Svg>
  );
}

function ProgramCover({
  style,
  goal,
  days,
  name,
  fingerprint,
  language,
}: {
  style: (typeof COVER_STYLES)[number];
  goal: string;
  days: number;
  name: string;
  language: AppLanguage;
  /**
   * One bar per session, height proportional to that session's working sets.
   *
   * The design this came from called these a fingerprint and then drew a sine
   * wave, so two programs could look identical while claiming to show their
   * shape. These are the real thing: bar count is the days per week and the
   * heights are where the work sits, both readable before a word of the name.
   */
  fingerprint: number[];
}) {
  const styles = useThemedStyles(makeStyles);

  const gid = `cover-${style.cover[0]}`.replace(/[^a-zA-Z0-9]/g, '');
  return (
    <View style={styles.cover}>
      <Svg width={COVER_W} height={COVER_H} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id={gid} x1="0" y1="0" x2="0.7" y2="1">
            <Stop offset="0" stopColor={style.cover[0]} />
            <Stop offset="1" stopColor={style.cover[1]} />
          </SvgLinearGradient>
          <RadialGradient id={`${gid}-hl`} cx="12%" cy="0%" rx="120%" ry="90%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.22} />
            <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
          <SvgLinearGradient id={`${gid}-shade`} x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor="#0C081A" stopOpacity={0.42} />
            <Stop offset="1" stopColor="#0C081A" stopOpacity={0} />
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width={COVER_W} height={COVER_H} fill={`url(#${gid})`} />
        <Rect x="0" y="0" width={COVER_W} height={COVER_H} fill={`url(#${gid}-hl)`} />
        {/* fine diagonal texture */}
        {Array.from({ length: 9 }, (_, i) => (
          <Path key={i} d={`M${-40 + i * 42} ${COVER_H} L${40 + i * 42} 0`} stroke="#FFFFFF" strokeOpacity={0.06} strokeWidth={1} />
        ))}
        {/* The week, as bars. Drawn under the shade gradient so the name stays
            readable over them, and inset from the tag row above. */}
        {fingerprint.length > 0
          ? fingerprint.map((height, index) => {
              const slot = (COVER_W - 32) / fingerprint.length;
              const barWidth = Math.max(4, Math.min(18, slot - 5));
              const maxHeight = 74;
              const barHeight = Math.max(4, height * maxHeight);
              return (
                <Rect
                  key={index}
                  x={16 + index * slot + (slot - barWidth) / 2}
                  // Anchored to the bottom edge rather than floating mid-card.
                  // On device the floating version read as three pale smudges
                  // behind the title: a histogram needs a baseline to be one.
                  y={COVER_H - barHeight}
                  width={barWidth}
                  height={barHeight}
                  rx={2}
                  fill="#FFFFFF"
                  fillOpacity={0.45}
                />
              );
            })
          : null}
        {/* signature motif watermark, bottom-right */}
        <Svg x={COVER_W - 132} y={COVER_H - 128} width={150} height={150} viewBox="0 0 24 24">
          <Path d={style.motif} stroke="#FFFFFF" strokeOpacity={0.16} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
        <Rect x="0" y={COVER_H - 78} width={COVER_W} height={78} fill={`url(#${gid}-shade)`} />
      </Svg>
      <View style={styles.coverTag}>
        <Text style={styles.coverTagText}>{goal}</Text>
      </View>
      <View style={styles.coverBadge}>
        <Text style={styles.coverBadgeText}>{t(language, 'programs.card.daysShort', { count: days })}</Text>
      </View>
      {/* Marks the slot where a real gym photo will land (shot later at 3:2, cropped 4:5). */}
      <View style={styles.coverPhotoMark}>
        <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 8a2 2 0 0 1 2-2h1.5l1.4-1.6a1 1 0 0 1 .75-.4h4.7a1 1 0 0 1 .75.4L16.5 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z"
            stroke="#FFFFFF"
            strokeOpacity={0.85}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <Circle cx={12} cy={12.5} r={3.2} stroke="#FFFFFF" strokeOpacity={0.85} strokeWidth={2} />
        </Svg>
      </View>
      <Text style={styles.coverName} numberOfLines={2}>
        {name}
      </Text>
    </View>
  );
}

export function ProgramsHomeScreen({
  activeProgram = null,
  exploreItems,
  seasonRows,
  catalogItems,
  categoryCounts,
  categoryMembers,
  trendingItems,
  recommendations,
  goals,
  goalCandidates,
  onSetGoal,
  onRemoveGoal,
  customPrograms,
  exerciseLibraryCount,
  onStartActiveSession,
  onOpenActivePlan,
  onAdjustSchedule,
  onOpenExploreProgram,
  onOpenCustomProgram,
  onViewAllPrograms,
  onCreateProgram,
  onAiAssisted,
  onImportProgram,
  exerciseLibraryEntries,
  language = 'en',
  onOpenLibrary,
}: ProgramsHomeScreenProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [picked, setPicked] = useState<ProgramsExploreItem | null>(null);
  // Null is 'All'. Not persisted: a filter is an answer to what you are
  // looking for right now, and a stale one is worse than none.
  const [category, setCategory] = useState<ProgramCategoryKey | null>(null);
  // The goal sheet: which lift, and the number being typed.
  const [goalLift, setGoalLift] = useState<{ name: string; label: string; bestKg: number } | null>(null);
  const [goalTarget, setGoalTarget] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const nextSession = activeProgram?.nextSession ?? null;
  const weekSessions = activeProgram?.sessions ?? [];
  const totalWeeks = Math.max(1, activeProgram?.planTotalWeeks ?? 1);
  const currentWeek = Math.min(Math.max(1, activeProgram?.currentWeek ?? 1), totalWeeks);
  const pickedStyle = picked ? COVER_STYLES[picked.coverIndex % COVER_STYLES.length] : null;

  return (
    <View style={styles.screenBackground}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {activeProgram ? (
          <>
            {/* Full-bleed hero: photo placeholder + accent scrim (photo lands here later). */}
            <View style={styles.hero}>
              <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
                <Defs>
                  <SvgLinearGradient id="programsHeroScrim" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#1E5A38" stopOpacity={0.4} />
                    <Stop offset="0.4" stopColor="#0A0714" stopOpacity={0.2} />
                    <Stop offset="1" stopColor="#080510" stopOpacity={0.9} />
                  </SvgLinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="#241A3E" />
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#programsHeroScrim)" />
              </Svg>
              {/* Photo-slot marker (docs/photo-placeholders.md). */}
              <View style={styles.heroPhotoMark}>
                <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M4 8a2 2 0 0 1 2-2h1.5l1.4-1.6a1 1 0 0 1 .75-.4h4.7a1 1 0 0 1 .75.4L16.5 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z"
                    stroke="#FFFFFF"
                    strokeOpacity={0.8}
                    strokeWidth={2}
                    strokeLinejoin="round"
                  />
                  <Circle cx={12} cy={12.5} r={3.2} stroke="#FFFFFF" strokeOpacity={0.8} strokeWidth={2} />
                </Svg>
              </View>
              <View style={styles.heroContent}>
                <Text style={styles.heroKicker}>{t(language, 'programs.activeProgram')}</Text>
                <Text style={styles.heroTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {activeProgram.title}
                </Text>
                <Text style={styles.heroWeekLine}>
                  <Text style={styles.heroWeekStrong}>{activeProgram.weekLabel}</Text>
                  <Text style={styles.heroWeekNote}>{`  ·  ${phaseNote(currentWeek, totalWeeks, language)}`}</Text>
                </Text>
                <View style={styles.heroSegmentRow}>
                  {Array.from({ length: totalWeeks }, (_, index) => (
                    <View key={index} style={[styles.heroSegment, index < currentWeek ? styles.heroSegmentFilled : styles.heroSegmentEmpty]} />
                  ))}
                </View>
              </View>
            </View>

            {/* THIS WEEK */}
            <View style={styles.weekHeaderRow}>
              <Text style={styles.sectionEyebrow}>
                {t(language, 'programs.thisWeek', { count: activeProgram.sessionsPerWeek })}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(language, 'programs.editDaysA11y')}
                onPress={onOpenActivePlan}
                hitSlop={8}
              >
                <Text style={styles.weekEditLink}>{t(language, 'programs.editDays')}</Text>
              </Pressable>
            </View>
            <View style={styles.weekList}>
              {weekSessions.map((session, index, allSessions) => {
                const anyFixedWeekday = allSessions.some((entry) =>
                  WEEKDAY_SET.has(entry.dayLabel?.trim().slice(0, 3).toUpperCase() ?? ''),
                );
                const isToday = nextSession?.id === session.id;
                const weekday = resolveSessionWeekday(
                  session.dayLabel,
                  index,
                  weekSessions.length,
                  anyFixedWeekday,
                );
                const weekdayText = weekday
                  ? weekdayLabel(weekday, language)
                  : `${index + 1}`;
                const sessionTitle = localizeSessionName(session.title, language);
                const focusLine = session.exercises
                  .slice(0, 3)
                  .map((exercise) => exerciseNameLabel(language, exercise.name))
                  .join(' · ');

                return (
                  <Pressable
                    key={session.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${weekdayText}: ${sessionTitle}${isToday ? `, ${t(language, 'programs.todayA11y')}` : ''}`}
                    onPress={onOpenActivePlan}
                    style={({ pressed }) => [styles.dayRow, isToday && styles.dayRowToday, pressed && styles.pressedRow]}
                  >
                    <View style={[styles.dayBadge, isToday && styles.dayBadgeToday]}>
                      <Text style={[styles.dayBadgeText, isToday && styles.dayBadgeTextToday]}>{weekdayText}</Text>
                    </View>
                    <View style={styles.dayCopy}>
                      <View style={styles.dayTitleRow}>
                        <Text style={styles.dayTitle} numberOfLines={1}>
                          {sessionTitle}
                        </Text>
                        {isToday ? (
                          <View style={styles.todayPill}>
                            <Text style={styles.todayPillText}>{t(language, 'programs.today')}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.dayFocus} numberOfLines={1}>
                        {focusLine}
                      </Text>
                    </View>
                    <Text style={styles.dayDuration}>{session.duration}</Text>
                    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
                      <Path d="m9 6 6 6-6 6" stroke={theme.faint} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(language, 'programs.viewPlan')}
              onPress={onOpenActivePlan}
              style={({ pressed }) => [styles.viewPlanButton, pressed && styles.pressed]}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke={theme.onHighlight} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.viewPlanButtonText}>{t(language, 'programs.viewPlan')}</Text>
            </Pressable>

            <View style={styles.subActionsRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(language, 'programs.swapExercises')}
                onPress={onOpenActivePlan}
                hitSlop={6}
              >
                <Text style={styles.subAction}>{t(language, 'programs.swapExercises')}</Text>
              </Pressable>
              <View style={styles.metaDot} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(language, 'programs.adjustSchedule')}
                onPress={onAdjustSchedule}
                hitSlop={6}
              >
                <Text style={styles.subAction}>{t(language, 'programs.adjustSchedule')}</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.emptyActiveCard}>
            <Text style={styles.emptyActiveTitle}>{t(language, 'programs.noActive')}</Text>
            <Text style={styles.emptyActiveSub}>{t(language, 'programs.noActiveSub')}</Text>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'csv.newProgram')}
          onPress={() => setCreateOpen(true)}
          style={({ pressed }) => [styles.newProgramButton, pressed && styles.pressed]}
        >
          <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
            <Path d="M12 5v14M5 12h14" stroke={theme.highlight} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.newProgramButtonText}>{t(language, 'csv.newProgram')}</Text>
        </Pressable>

        {/* Goals: only ever the reader's own numbers. A lift they have never
            logged shows as not started rather than 0% — an empty bar reads as
            "you have made no progress" when the truth is "you have not
            begun". */}
        {goals.length > 0 || goalCandidates.length > 0 ? (
          <View>
            <View style={styles.sectionHeadRow}>
              <Text style={styles.sectionEyebrow}>{t(language, 'programs.goals')}</Text>
              {goalCandidates.length > 0 ? (
                <Pressable onPress={() => setGoalLift(goalCandidates[0])} hitSlop={8}>
                  <Text style={styles.sectionLink}>{t(language, 'programs.goals.add')}</Text>
                </Pressable>
              ) : null}
            </View>
            {goals.length === 0 ? (
              <Text style={styles.seasonLead}>{t(language, 'programs.goals.empty')}</Text>
            ) : (
              <View style={styles.goalCard}>
                {goals.map((entry, index) => (
                  <Pressable
                    key={entry.goal.exerciseName}
                    accessibilityRole="button"
                    accessibilityLabel={t(language, 'programs.goals.remove', {
                      name: exerciseNameLabel(language, entry.goal.exerciseName),
                    })}
                    onLongPress={() => onRemoveGoal(entry.goal.exerciseName)}
                    style={[styles.goalRow, index > 0 && styles.trendingRowDivider]}
                  >
                    <View style={styles.goalCopy}>
                      <Text style={styles.goalTitle} numberOfLines={1}>
                        {exerciseNameLabel(language, entry.goal.exerciseName)}
                      </Text>
                      <Text style={styles.goalMeta}>
                        {entry.currentKg === null
                          ? t(language, 'programs.goals.notStarted', { target: entry.goal.targetKg })
                          : t(language, 'programs.goals.meta', {
                              current: entry.currentKg,
                              target: entry.goal.targetKg,
                            })}
                      </Text>
                      <View style={styles.goalTrack}>
                        <View
                          style={[
                            styles.goalFill,
                            { width: `${Math.round((entry.ratio ?? 0) * 100)}%` },
                            entry.reached && styles.goalFillReached,
                          ]}
                        />
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ) : null}

        {/* "For you" leads the browse: it is the only row that knows who is
            reading it, and every card can say why it is there. */}
        {recommendations.length > 0 ? (
          <View>
            <View style={styles.sectionHeadRow}>
              <Text style={styles.sectionEyebrow}>{t(language, 'programs.forYou')}</Text>
            </View>
            <Text style={styles.seasonLead}>{t(language, 'programs.forYou.lead')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.exploreRow}
              style={styles.exploreScroll}
            >
              {recommendations.map((item) => {
                const style = COVER_STYLES[item.coverIndex % COVER_STYLES.length];
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={t(language, 'programs.switchTo', { name: item.name })}
                    onPress={() => {
                      const card = catalogItems.find((entry) => entry.id === item.id);
                      if (card) {
                        setPicked(card);
                      }
                    }}
                    style={({ pressed }) => [styles.exploreCard, pressed && styles.pressed]}
                  >
                    <ProgramCover
                      style={style}
                      goal={item.goal}
                      days={item.days}
                      name={item.name}
                      fingerprint={item.fingerprint}
                      language={language}
                    />
                    <View style={styles.exploreBody}>
                      {/* The reason, not a blurb. A card that cannot say why it
                          is here does not belong in this row. */}
                      <Text style={styles.forYouWhy} numberOfLines={3}>
                        {item.why}
                      </Text>
                      <View style={styles.exploreMetaRow}>
                        <Text style={styles.exploreMeta}>{t(language, 'programs.card.days', { count: item.days })}</Text>
                        <View style={styles.metaDot} />
                        <Text style={styles.exploreMeta}>~{item.minutes} min</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* Seasons before the general browse: the row that knows what month
            it is earns the higher position, and the switch rail below is the
            same catalog without an opinion about the weather. */}
        {seasonRows.map((row) => (
          <View key={row.season}>
            <View style={styles.sectionHeadRow}>
              <Text style={styles.sectionEyebrow}>
                {t(language, row.season === 'winter' ? 'programs.season.winter' : 'programs.season.summer')}
              </Text>
              <Text style={styles.seasonCount}>
                {t(language, 'programs.season.count', { count: row.items.length })}
              </Text>
            </View>
            <Text style={styles.seasonLead}>
              {t(language, row.season === 'winter' ? 'programs.season.winterLead' : 'programs.season.summerLead')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.exploreRow}
              style={styles.exploreScroll}
            >
              {row.items.map((item) => {
                const style = COVER_STYLES[item.coverIndex % COVER_STYLES.length];
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={t(language, 'programs.switchTo', { name: item.name })}
                    onPress={() => setPicked(item)}
                    style={({ pressed }) => [styles.exploreCard, pressed && styles.pressed]}
                  >
                    <ProgramCover
                      style={style}
                      goal={item.goal}
                      days={item.days}
                      name={item.name}
                      fingerprint={item.fingerprint}
                      language={language}
                    />
                    <View style={styles.exploreBody}>
                      <Text style={styles.exploreBlurb} numberOfLines={2}>
                        {item.blurb}
                      </Text>
                      <View style={styles.exploreMetaRow}>
                        <Text style={styles.exploreMeta}>{t(language, 'programs.card.days', { count: item.days })}</Text>
                        <View style={styles.metaDot} />
                        <Text style={styles.exploreMeta}>~{item.minutes} min</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ))}

        <View style={styles.sectionHeadRow}>
          <Text style={styles.sectionEyebrow}>{t(language, 'programs.switchProgram')}</Text>
          <Pressable onPress={onViewAllPrograms} hitSlop={8}>
            <Text style={styles.sectionLink}>{t(language, 'programs.viewAll')}</Text>
          </Pressable>
        </View>
        {/* Categories filter the rail below rather than opening a screen: at
            eight programs a flat list was fine, at fifty-five it is not, and a
            filter you can undo in one tap beats a navigation you have to come
            back from. Counts are shown so a tile cannot promise an empty row. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
          style={styles.exploreScroll}
        >
          {[null, ...PROGRAM_CATEGORIES.map((entry) => entry.key)].map((key) => {
            const entry = key ? PROGRAM_CATEGORIES.find((item) => item.key === key) : null;
            const on = category === key;
            const count = key ? categoryCounts[key] : catalogItems.length;
            return (
              <Pressable
                key={key ?? 'all'}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setCategory(key)}
                style={[styles.categoryChip, on && styles.categoryChipOn]}
              >
                <Text style={[styles.categoryChipText, on && styles.categoryChipTextOn]}>
                  {entry ? t(language, entry.labelKey) : t(language, 'programs.cat.all')}
                </Text>
                <Text style={[styles.categoryChipCount, on && styles.categoryChipCountOn]}>{count}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.exploreRow} style={styles.exploreScroll}>
          {(category === null
            ? exploreItems
            : catalogItems.filter((item) => categoryMembers[category]?.includes(item.id))
          ).map((item) => {
            const style = COVER_STYLES[item.coverIndex % COVER_STYLES.length];
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={t(language, 'programs.switchTo', { name: item.name })}
                onPress={() => setPicked(item)}
                style={({ pressed }) => [styles.exploreCard, pressed && styles.pressed]}
              >
                <ProgramCover
                      style={style}
                      goal={item.goal}
                      days={item.days}
                      name={item.name}
                      fingerprint={item.fingerprint}
                      language={language}
                    />
                <View style={styles.exploreBody}>
                  <Text style={styles.exploreBlurb} numberOfLines={2}>
                    {item.blurb}
                  </Text>
                  <View style={styles.exploreMetaRow}>
                    <Text style={styles.exploreMeta}>{t(language, 'programs.card.days', { count: item.days })}</Text>
                    <View style={styles.metaDot} />
                    <Text style={styles.exploreMeta}>~{item.minutes} min</Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {trendingItems && trendingItems.length > 0 ? (
          <View>
            <Text style={styles.sectionEyebrowStandalone}>{t(language, 'programs.trending')}</Text>
            <View style={styles.trendingCard}>
              {trendingItems.map((item, index) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={t(language, 'programs.switchTo', { name: item.name })}
                  onPress={() => {
                    const card = catalogItems.find((entry) => entry.id === item.id);
                    if (card) {
                      setPicked(card);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.trendingRow,
                    index > 0 && styles.trendingRowDivider,
                    pressed && styles.pressedRow,
                  ]}
                >
                  <View style={[styles.trendingRank, index < 3 && styles.trendingRankTop]}>
                    <Text style={[styles.trendingRankText, index < 3 && styles.trendingRankTextTop]}>
                      {index + 1}
                    </Text>
                  </View>
                  <View style={styles.trendingCopy}>
                    <Text style={styles.trendingTitle} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.trendingMeta}>
                      {t(language, 'programs.trending.meta', { weeks: item.weeks, starts: item.starts })}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionEyebrowStandalone}>{t(language, 'programs.yourPrograms')}</Text>
        {customPrograms.map((program) => (
          <Pressable
            key={program.id}
            accessibilityRole="button"
            accessibilityLabel={t(language, 'programs.open', { name: program.name })}
            onPress={() => onOpenCustomProgram(program.id)}
            style={({ pressed }) => [styles.customRow, pressed && styles.pressedRow]}
          >
            <GradientTile stops={SAVED_TILE} size={44} radius={12} />
            <View style={styles.customCopy}>
              <Text style={styles.customTitle} numberOfLines={1}>
                {program.name}
              </Text>
              <Text style={styles.customSubtitle} numberOfLines={1}>
                {program.subtitle}
              </Text>
            </View>
            <Text style={styles.customAction}>{t(language, 'programs.openShort')}</Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'programs.create')}
          onPress={onCreateProgram}
          style={({ pressed }) => [styles.createRow, pressed && styles.pressedRow]}
        >
          <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
            <Path d="M12 5v14M5 12h14" stroke={theme.purple} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.createText}>{t(language, 'programs.create')}</Text>
        </Pressable>

        <Text style={styles.sectionEyebrowStandalone}>{t(language, 'programs.library')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'programs.openLibrary')}
          onPress={onOpenLibrary}
          style={({ pressed }) => [styles.libraryRow, pressed && styles.pressedRow]}
        >
          <View style={styles.libraryIcon}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" stroke={theme.purple} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <View style={styles.libraryCopy}>
            <Text style={styles.libraryTitle}>{t(language, 'programs.exerciseLibrary')}</Text>
            <Text style={styles.librarySubtitle} numberOfLines={1}>
              {t(language, 'programs.library.sub', { count: exerciseLibraryCount })}
            </Text>
          </View>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="m9 6 6 6-6 6" stroke={theme.faint} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>

        <Text style={styles.footerNote}>{t(language, 'programs.footNote')}</Text>
        <View style={styles.bottomSafeFade} />
      </ScrollView>

      {/* Setting a target. Only lifts with logged work are offered — a target
          on something never done cannot have a bar, and offering it would make
          the row's first impression an empty one. */}
      <Modal
        visible={goalLift !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setGoalLift(null)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetScrim} onPress={() => setGoalLift(null)} />
          <View style={styles.sheet}>
            <View style={styles.sheetGrip} />
            {goalLift ? (
              <>
                <Text style={styles.sheetName}>
                  {t(language, 'programs.goals.sheetTitle', { name: goalLift.label })}
                </Text>
                <Text style={styles.sheetExplainer}>
                  {t(language, 'programs.goals.sheetBody', { best: goalLift.bestKg })}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryRow}
                  style={styles.exploreScroll}
                >
                  {goalCandidates.map((candidate) => (
                    <Pressable
                      key={candidate.name}
                      accessibilityRole="button"
                      accessibilityState={{ selected: candidate.name === goalLift.name }}
                      onPress={() => setGoalLift(candidate)}
                      style={[
                        styles.categoryChip,
                        candidate.name === goalLift.name && styles.categoryChipOn,
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          candidate.name === goalLift.name && styles.categoryChipTextOn,
                        ]}
                      >
                        {candidate.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <TextInput
                  value={goalTarget}
                  onChangeText={setGoalTarget}
                  keyboardType="numeric"
                  placeholder={`${Math.round(goalLift.bestKg + 10)}`}
                  placeholderTextColor={theme.faint}
                  style={styles.goalInput}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={!isValidTarget(Number(goalTarget.replace(',', '.')))}
                  onPress={() => {
                    const target = Number(goalTarget.replace(',', '.'));
                    if (!isValidTarget(target)) {
                      return;
                    }
                    onSetGoal(goalLift.name, target);
                    setGoalTarget('');
                    setGoalLift(null);
                  }}
                  style={({ pressed }) => [
                    styles.sheetConfirm,
                    !isValidTarget(Number(goalTarget.replace(',', '.'))) && { opacity: 0.5 },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.sheetConfirmText}>{t(language, 'programs.goals.save')}</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={picked !== null} transparent animationType="slide" onRequestClose={() => setPicked(null)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetScrim} onPress={() => setPicked(null)} />
          <View style={styles.sheet}>
            <View style={styles.sheetGrip} />
            {picked && pickedStyle ? (
              <>
                <View style={styles.sheetHeaderRow}>
                  <GradientTile stops={pickedStyle.tile} size={50} radius={14} />
                  <View style={styles.sheetHeaderCopy}>
                    <Text style={styles.sheetName} numberOfLines={1}>
                      {picked.name}
                    </Text>
                    <Text style={styles.sheetMeta} numberOfLines={1}>
                      {picked.days} days / wk · ~{picked.minutes} min · {picked.goal}
                    </Text>
                  </View>
                </View>
                <Text style={styles.sheetExplainer}>
                  Switching starts a fresh block. Your current{' '}
                  <Text style={styles.sheetExplainerBold}>{activeProgram?.title ?? 'program'}</Text> progress stays saved in
                  your history — you can come back to it anytime.
                </Text>
                <View style={styles.sheetButtonRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t(language, 'common.cancel')}
                    onPress={() => setPicked(null)}
                    style={({ pressed }) => [styles.sheetCancel, pressed && styles.pressed]}
                  >
                    <Text style={styles.sheetCancelText}>{t(language, 'common.cancel')}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t(language, 'programs.switchTo', { name: picked.name })}
                    onPress={() => {
                      const id = picked.id;
                      setPicked(null);
                      onOpenExploreProgram(id);
                    }}
                    style={({ pressed }) => [styles.sheetConfirm, pressed && styles.pressed]}
                  >
                    <Text style={styles.sheetConfirmText}>{t(language, 'programs.switchConfirm')}</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <NewProgramSheet
        language={language}
        visible={createOpen}
        exerciseLibrary={exerciseLibraryEntries}
        onClose={() => setCreateOpen(false)}
        onAiAssisted={onAiAssisted}
        onBuildYourself={onCreateProgram}
        onImportProgram={onImportProgram}
      />
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  screenBackground: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 132,
  },
  hero: {
    height: 320,
    marginHorizontal: -20,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  heroPhotoMark: {
    position: 'absolute',
    top: 52,
    right: 16,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(12,8,26,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContent: {
    padding: 20,
    gap: 7,
  },
  heroKicker: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 1.7,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroWeekLine: {
    marginTop: 1,
  },
  heroWeekStrong: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  heroWeekNote: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  heroSegmentRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 6,
  },
  heroSegment: {
    flex: 1,
    height: 6,
    borderRadius: 999,
  },
  heroSegmentFilled: {
    backgroundColor: theme.surface,
  },
  heroSegmentEmpty: {
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  weekHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 10,
  },
  weekEditLink: {
    color: theme.highlight,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '800',
  },
  weekList: {
    gap: 9,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.purpleSoft,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  dayRowToday: {
    backgroundColor: theme.purpleSoft,
    // Structural, not an action: the row says "this is today", while the
    // badge and pill inside it carry the interactive accent.
    borderColor: theme.purple,
  },
  dayBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeToday: {
    backgroundColor: theme.highlight,
    borderColor: theme.highlight,
  },
  dayBadgeText: {
    color: theme.faint,
    fontSize: 11,
    fontWeight: '800',
  },
  dayBadgeTextToday: {
    color: theme.onHighlight,
  },
  dayCopy: {
    flex: 1,
    gap: 2,
  },
  dayTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dayTitle: {
    color: theme.ink,
    fontSize: 15.5,
    lineHeight: 20,
    fontWeight: '800',
    flexShrink: 1,
  },
  todayPill: {
    borderRadius: 999,
    backgroundColor: theme.highlight,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  todayPillText: {
    color: theme.onHighlight,
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '800',
  },
  dayFocus: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  dayDuration: {
    color: theme.faint,
    fontSize: 12,
    fontWeight: '700',
  },
  viewPlanButton: {
    height: 52,
    borderRadius: 15,
    backgroundColor: theme.highlight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    shadowColor: theme.highlight,
    shadowOpacity: 0.27,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  viewPlanButtonText: {
    color: theme.onHighlight,
    fontSize: 15,
    fontWeight: '800',
  },
  subActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 11,
  },
  subAction: {
    color: theme.muted,
    fontSize: 12.5,
    fontWeight: '700',
  },
  newProgramButton: {
    height: 52,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: theme.highlight,
    backgroundColor: theme.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    marginBottom: 6,
  },
  newProgramButtonText: {
    color: theme.highlight,
    fontSize: 15,
    fontWeight: '800',
  },
  pressed: {
    transform: [{ scale: 0.96 }],
  },
  pressedRow: {
    opacity: 0.7,
  },
  emptyActiveCard: {
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: theme.purple,
    backgroundColor: theme.surface,
    padding: 20,
    gap: 8,
  },
  emptyActiveTitle: {
    color: theme.ink,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
  },
  emptyActiveSub: {
    color: theme.muted,
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: '600',
  },
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 26,
    marginBottom: 11,
    paddingHorizontal: 2,
  },
  sectionEyebrow: {
    color: theme.faint,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  categoryRow: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: theme.surface,
    borderWidth: 1.5,
    borderColor: theme.border,
  },
  categoryChipOn: {
    backgroundColor: theme.purpleLight,
    borderColor: theme.purple,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.ink,
  },
  categoryChipTextOn: {
    color: theme.purple,
    fontWeight: '800',
  },
  categoryChipCount: {
    fontSize: 11.5,
    fontWeight: '800',
    color: theme.faint,
  },
  categoryChipCountOn: {
    color: theme.purple,
  },
  goalInput: {
    marginTop: 14,
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '800',
    color: theme.ink,
  },
  goalCard: {
    marginHorizontal: 20,
    marginBottom: 6,
    borderRadius: 18,
    backgroundColor: theme.surface,
    borderWidth: 1.5,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  goalRow: {
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  goalCopy: {
    gap: 4,
  },
  goalTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: theme.ink,
  },
  goalMeta: {
    fontSize: 11.5,
    fontWeight: '700',
    color: theme.muted,
  },
  goalTrack: {
    marginTop: 4,
    height: 6,
    borderRadius: 999,
    backgroundColor: theme.purpleLight,
    overflow: 'hidden',
  },
  goalFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: theme.purple,
  },
  goalFillReached: {
    backgroundColor: theme.green,
  },
  trendingCard: {
    marginHorizontal: 20,
    marginBottom: 4,
    borderRadius: 18,
    backgroundColor: theme.surface,
    borderWidth: 1.5,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  trendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  trendingRowDivider: {
    borderTopWidth: 1,
    borderTopColor: theme.purpleLight,
  },
  trendingRank: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.purpleLight,
  },
  trendingRankTop: {
    backgroundColor: theme.purple,
  },
  trendingRankText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: theme.purple,
  },
  trendingRankTextTop: {
    color: '#FFFFFF',
  },
  trendingCopy: {
    flex: 1,
    minWidth: 0,
  },
  trendingTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: theme.ink,
  },
  trendingMeta: {
    marginTop: 2,
    fontSize: 11.5,
    fontWeight: '700',
    color: theme.muted,
  },
  forYouWhy: {
    fontSize: 12.5,
    fontWeight: '700',
    lineHeight: 17,
    color: theme.purple,
  },
  seasonCount: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.muted,
  },
  seasonLead: {
    marginTop: -4,
    marginBottom: 10,
    paddingHorizontal: 20,
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 18,
    color: theme.muted,
  },
  sectionEyebrowStandalone: {
    color: theme.faint,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginTop: 26,
    marginBottom: 11,
    paddingHorizontal: 2,
  },
  sectionLink: {
    color: theme.highlight,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '800',
  },
  exploreScroll: {
    marginHorizontal: -20,
  },
  exploreRow: {
    paddingHorizontal: 20,
    paddingVertical: 2,
    gap: 12,
  },
  exploreCard: {
    width: COVER_W,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    overflow: 'hidden',
    shadowColor: theme.purpleBright,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 3,
  },
  cover: {
    width: COVER_W,
    height: COVER_H,
    overflow: 'hidden',
  },
  coverTag: {
    position: 'absolute',
    top: 13,
    left: 13,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.20)',
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  coverTagText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  coverBadge: {
    position: 'absolute',
    top: 13,
    right: 13,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  coverBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  coverPhotoMark: {
    position: 'absolute',
    right: 13,
    bottom: 13,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(12,8,26,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverName: {
    position: 'absolute',
    left: 15,
    right: 15,
    bottom: 13,
    color: '#FFFFFF',
    fontSize: 21,
    lineHeight: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.28)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  exploreBody: {
    paddingHorizontal: 15,
    paddingTop: 13,
    paddingBottom: 15,
  },
  exploreBlurb: {
    color: theme.muted,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '600',
    minHeight: 36,
  },
  exploreMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 11,
  },
  exploreMeta: {
    color: theme.purple,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '800',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 999,
    backgroundColor: theme.faint,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 10,
  },
  customCopy: {
    flex: 1,
    minWidth: 0,
  },
  customTitle: {
    color: theme.ink,
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '800',
  },
  customSubtitle: {
    marginTop: 2,
    color: theme.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  customAction: {
    color: theme.purple,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '800',
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.border,
    borderStyle: 'dashed',
  },
  createText: {
    color: theme.purple,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '800',
  },
  libraryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
  libraryIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  libraryCopy: {
    flex: 1,
    minWidth: 0,
  },
  libraryTitle: {
    color: theme.ink,
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '800',
  },
  librarySubtitle: {
    marginTop: 2,
    color: theme.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  footerNote: {
    marginTop: 18,
    textAlign: 'center',
    color: theme.faint,
    fontSize: 11.5,
    lineHeight: 18,
    fontWeight: '600',
    paddingHorizontal: 10,
  },
  bottomSafeFade: {
    height: 16,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(16,10,32,0.44)',
  },
  sheetScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: theme.surface,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 26,
  },
  sheetGrip: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.border,
    marginBottom: 16,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  sheetHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  sheetName: {
    color: theme.ink,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
  },
  sheetMeta: {
    marginTop: 2,
    color: theme.muted,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '700',
  },
  sheetExplainer: {
    marginTop: 15,
    marginHorizontal: 2,
    color: theme.muted,
    fontSize: 13.5,
    lineHeight: 21,
    fontWeight: '600',
  },
  sheetExplainerBold: {
    color: theme.ink,
    fontWeight: '800',
  },
  sheetButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  sheetCancel: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: theme.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCancelText: {
    color: theme.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  sheetConfirm: {
    flex: 1.4,
    height: 50,
    borderRadius: 14,
    backgroundColor: theme.purple,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.purpleBright,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 4,
  },
  sheetConfirmText: {
    color: theme.surface,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
});
