import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { HomeDaySessionSummary } from '../lib/homeCalendar';
import { HG3 } from '../lightTheme';
import type { WorkoutTemplateDraft } from '../types/models';

// Program accent (design_handoff_programs_redesign, hue 150; oklch approximated in hex).
const ACCENT = '#16A34A';
const ACCENT_SOFT = '#EAF7EF';
const ACCENT_LINE = '#8AD4AC';

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

function weekdayForSession(index: number, sessionCount: number) {
  const spread = TRAINING_DAY_SPREAD[Math.min(6, Math.max(1, sessionCount))] ?? [0, 2, 4];
  return WEEKDAYS[spread[index] ?? Math.min(index, 6)];
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
}

export interface ProgramsCustomItem {
  id: string;
  name: string;
  subtitle: string;
}

interface ProgramsHomeScreenProps {
  activeProgram?: ProgramsActiveProgram | null;
  exploreItems: ProgramsExploreItem[];
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
  onOpenLibrary: () => void;
}

const WEEK_PHASE_NOTE = ['Lay the base', 'Build the rhythm', 'Push the volume', 'Peak & test'];

function phaseNote(currentWeek: number, totalWeeks: number): string {
  if (totalWeeks <= 1) {
    return WEEK_PHASE_NOTE[0];
  }
  const ratio = (currentWeek - 1) / Math.max(1, totalWeeks - 1);
  const index = Math.min(WEEK_PHASE_NOTE.length - 1, Math.max(0, Math.round(ratio * (WEEK_PHASE_NOTE.length - 1))));
  return WEEK_PHASE_NOTE[index];
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

function ProgramCover({ style, goal, days, name }: { style: (typeof COVER_STYLES)[number]; goal: string; days: number; name: string }) {
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
        <Text style={styles.coverBadgeText}>{days}d / wk</Text>
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
  onOpenLibrary,
}: ProgramsHomeScreenProps) {
  const [picked, setPicked] = useState<ProgramsExploreItem | null>(null);
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
                <Text style={styles.heroKicker}>ACTIVE PROGRAM</Text>
                <Text style={styles.heroTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {activeProgram.title}
                </Text>
                <Text style={styles.heroWeekLine}>
                  <Text style={styles.heroWeekStrong}>{activeProgram.weekLabel}</Text>
                  <Text style={styles.heroWeekNote}>{`  ·  ${phaseNote(currentWeek, totalWeeks)}`}</Text>
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
              <Text style={styles.sectionEyebrow}>{`THIS WEEK · ${activeProgram.sessionsPerWeek} DAYS / WEEK`}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Edit training days" onPress={onOpenActivePlan} hitSlop={8}>
                <Text style={styles.weekEditLink}>Edit days</Text>
              </Pressable>
            </View>
            <View style={styles.weekList}>
              {weekSessions.map((session, index) => {
                const isToday = nextSession?.id === session.id;
                const weekday = weekdayForSession(index, weekSessions.length);
                const focusLine = session.exercises
                  .slice(0, 3)
                  .map((exercise) => exercise.name)
                  .join(' · ');

                return (
                  <Pressable
                    key={session.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${weekday}: ${session.title}${isToday ? ', today' : ''}`}
                    onPress={onOpenActivePlan}
                    style={({ pressed }) => [styles.dayRow, isToday && styles.dayRowToday, pressed && styles.pressedRow]}
                  >
                    <View style={[styles.dayBadge, isToday && styles.dayBadgeToday]}>
                      <Text style={[styles.dayBadgeText, isToday && styles.dayBadgeTextToday]}>{weekday}</Text>
                    </View>
                    <View style={styles.dayCopy}>
                      <View style={styles.dayTitleRow}>
                        <Text style={styles.dayTitle} numberOfLines={1}>
                          {session.title}
                        </Text>
                        {isToday ? (
                          <View style={styles.todayPill}>
                            <Text style={styles.todayPillText}>TODAY</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.dayFocus} numberOfLines={1}>
                        {focusLine}
                      </Text>
                    </View>
                    <Text style={styles.dayDuration}>{session.duration}</Text>
                    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
                      <Path d="m9 6 6 6-6 6" stroke={HG3.faint} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View the full plan"
              onPress={onOpenActivePlan}
              style={({ pressed }) => [styles.viewPlanButton, pressed && styles.pressed]}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.viewPlanButtonText}>View full plan</Text>
            </Pressable>

            <View style={styles.subActionsRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="Swap exercises" onPress={onOpenActivePlan} hitSlop={6}>
                <Text style={styles.subAction}>Swap exercises</Text>
              </Pressable>
              <View style={styles.metaDot} />
              <Pressable accessibilityRole="button" accessibilityLabel="Adjust schedule" onPress={onAdjustSchedule} hitSlop={6}>
                <Text style={styles.subAction}>Adjust schedule</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.emptyActiveCard}>
            <Text style={styles.emptyActiveTitle}>No active program</Text>
            <Text style={styles.emptyActiveSub}>Pick a ready program below or build your own to get a weekly plan.</Text>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New program"
          onPress={() => setCreateOpen(true)}
          style={({ pressed }) => [styles.newProgramButton, pressed && styles.pressed]}
        >
          <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
            <Path d="M12 5v14M5 12h14" stroke={ACCENT} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.newProgramButtonText}>New program</Text>
        </Pressable>

        <View style={styles.sectionHeadRow}>
          <Text style={styles.sectionEyebrow}>SWITCH PROGRAM</Text>
          <Pressable onPress={onViewAllPrograms} hitSlop={8}>
            <Text style={styles.sectionLink}>View all</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.exploreRow} style={styles.exploreScroll}>
          {exploreItems.map((item) => {
            const style = COVER_STYLES[item.coverIndex % COVER_STYLES.length];
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`Switch to ${item.name}`}
                onPress={() => setPicked(item)}
                style={({ pressed }) => [styles.exploreCard, pressed && styles.pressed]}
              >
                <ProgramCover style={style} goal={item.goal} days={item.days} name={item.name} />
                <View style={styles.exploreBody}>
                  <Text style={styles.exploreBlurb} numberOfLines={2}>
                    {item.blurb}
                  </Text>
                  <View style={styles.exploreMetaRow}>
                    <Text style={styles.exploreMeta}>{item.days} days / week</Text>
                    <View style={styles.metaDot} />
                    <Text style={styles.exploreMeta}>~{item.minutes} min</Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.sectionEyebrowStandalone}>YOUR PROGRAMS</Text>
        {customPrograms.map((program) => (
          <Pressable
            key={program.id}
            accessibilityRole="button"
            accessibilityLabel={`Open ${program.name}`}
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
            <Text style={styles.customAction}>Open</Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create a program"
          onPress={onCreateProgram}
          style={({ pressed }) => [styles.createRow, pressed && styles.pressedRow]}
        >
          <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
            <Path d="M12 5v14M5 12h14" stroke={HG3.purple} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.createText}>Create a program</Text>
        </Pressable>

        <Text style={styles.sectionEyebrowStandalone}>LIBRARY</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open the exercise library"
          onPress={onOpenLibrary}
          style={({ pressed }) => [styles.libraryRow, pressed && styles.pressedRow]}
        >
          <View style={styles.libraryIcon}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" stroke={HG3.purple} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <View style={styles.libraryCopy}>
            <Text style={styles.libraryTitle}>Exercise library</Text>
            <Text style={styles.librarySubtitle} numberOfLines={1}>
              {exerciseLibraryCount} exercises · browse &amp; swap into your plan
            </Text>
          </View>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="m9 6 6 6-6 6" stroke={HG3.faint} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>

        <Text style={styles.footerNote}>One program at a time. Finish a block, then repeat, edit, or switch.</Text>
        <View style={styles.bottomSafeFade} />
      </ScrollView>

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
                    accessibilityLabel="Cancel"
                    onPress={() => setPicked(null)}
                    style={({ pressed }) => [styles.sheetCancel, pressed && styles.pressed]}
                  >
                    <Text style={styles.sheetCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Switch to ${picked.name}`}
                    onPress={() => {
                      const id = picked.id;
                      setPicked(null);
                      onOpenExploreProgram(id);
                    }}
                    style={({ pressed }) => [styles.sheetConfirm, pressed && styles.pressed]}
                  >
                    <Text style={styles.sheetConfirmText}>Switch program</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <NewProgramSheet
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

const styles = StyleSheet.create({
  screenBackground: {
    flex: 1,
    backgroundColor: HG3.bg,
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
    backgroundColor: '#FFFFFF',
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
    color: ACCENT,
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
    borderColor: HG3.border,
    backgroundColor: HG3.purpleSoft,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  dayRowToday: {
    backgroundColor: ACCENT_SOFT,
    borderColor: ACCENT_LINE,
  },
  dayBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: HG3.surface,
    borderWidth: 1,
    borderColor: HG3.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeToday: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  dayBadgeText: {
    color: HG3.faint,
    fontSize: 11,
    fontWeight: '800',
  },
  dayBadgeTextToday: {
    color: '#FFFFFF',
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
    color: HG3.ink,
    fontSize: 15.5,
    lineHeight: 20,
    fontWeight: '800',
    flexShrink: 1,
  },
  todayPill: {
    borderRadius: 999,
    backgroundColor: ACCENT,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  todayPillText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '800',
  },
  dayFocus: {
    color: HG3.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  dayDuration: {
    color: HG3.faint,
    fontSize: 12,
    fontWeight: '700',
  },
  viewPlanButton: {
    height: 52,
    borderRadius: 15,
    backgroundColor: ACCENT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    shadowColor: ACCENT,
    shadowOpacity: 0.27,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  viewPlanButtonText: {
    color: '#FFFFFF',
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
    color: HG3.muted,
    fontSize: 12.5,
    fontWeight: '700',
  },
  newProgramButton: {
    height: 52,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: ACCENT,
    backgroundColor: HG3.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    marginBottom: 6,
  },
  newProgramButtonText: {
    color: ACCENT,
    fontSize: 15,
    fontWeight: '800',
  },
  pressed: {
    transform: [{ scale: 0.96 }],
  },
  pressedRow: {
    opacity: 0.7,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    color: HG3.ink,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    color: HG3.muted,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: HG3.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCard: {
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: HG3.purple,
    backgroundColor: HG3.surface,
    overflow: 'hidden',
    shadowColor: HG3.purpleBright,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.13,
    shadowRadius: 28,
    elevation: 4,
  },
  activeTop: {
    paddingHorizontal: 17,
    paddingTop: 20,
    paddingBottom: 18,
  },
  activeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeEyebrow: {
    color: HG3.purple,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  activeWeekLabel: {
    color: HG3.muted,
    fontSize: 13.5,
    lineHeight: 17,
    fontWeight: '800',
  },
  activeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginTop: 12,
  },
  activeTitleCopy: {
    flex: 1,
    minWidth: 0,
  },
  activeTitle: {
    color: HG3.ink,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  activePhase: {
    marginTop: 3,
    color: HG3.purple,
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '800',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 15,
  },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: 999,
  },
  segmentFilled: {
    backgroundColor: HG3.purple,
  },
  segmentEmpty: {
    backgroundColor: HG3.purpleSoft,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 12,
  },
  chip: {
    borderRadius: 999,
    backgroundColor: HG3.purpleSoft,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  chipText: {
    color: HG3.purple,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  nextStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: HG3.border,
    backgroundColor: HG3.purpleSoft,
    paddingVertical: 16,
    paddingHorizontal: 17,
  },
  nextCopy: {
    flex: 1,
    minWidth: 0,
  },
  nextEyebrow: {
    color: HG3.faint,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  nextTitle: {
    marginTop: 3,
    color: HG3.ink,
    fontSize: 17.5,
    lineHeight: 22,
    fontWeight: '800',
  },
  nextMeta: {
    marginTop: 2,
    color: HG3.muted,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '600',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 44,
    borderRadius: 13,
    backgroundColor: HG3.purple,
    paddingHorizontal: 17,
    shadowColor: HG3.purpleBright,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  startButtonText: {
    color: HG3.surface,
    fontSize: 14.5,
    lineHeight: 18,
    fontWeight: '800',
  },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderTopWidth: 1,
    borderTopColor: HG3.border,
    paddingVertical: 12,
    paddingHorizontal: 17,
  },
  manageText: {
    flex: 1,
    color: HG3.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  emptyActiveCard: {
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: HG3.purple,
    backgroundColor: HG3.surface,
    padding: 20,
    gap: 8,
  },
  emptyActiveTitle: {
    color: HG3.ink,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
  },
  emptyActiveSub: {
    color: HG3.muted,
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: '600',
  },
  emptyActiveButton: {
    marginTop: 8,
    height: 50,
    borderRadius: 14,
    backgroundColor: HG3.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActiveButtonText: {
    color: HG3.surface,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
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
    color: HG3.faint,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  sectionEyebrowStandalone: {
    color: HG3.faint,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginTop: 26,
    marginBottom: 11,
    paddingHorizontal: 2,
  },
  sectionLink: {
    color: HG3.purple,
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
    borderColor: HG3.border,
    backgroundColor: HG3.surface,
    overflow: 'hidden',
    shadowColor: HG3.purpleBright,
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
    color: HG3.muted,
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
    color: HG3.purple,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '800',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 999,
    backgroundColor: HG3.faint,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HG3.border,
    backgroundColor: HG3.surface,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 10,
  },
  customCopy: {
    flex: 1,
    minWidth: 0,
  },
  customTitle: {
    color: HG3.ink,
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '800',
  },
  customSubtitle: {
    marginTop: 2,
    color: HG3.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  customAction: {
    color: HG3.purple,
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
    borderColor: HG3.border,
    borderStyle: 'dashed',
  },
  createText: {
    color: HG3.purple,
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
    borderColor: HG3.border,
    backgroundColor: HG3.surface,
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
  libraryIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: HG3.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  libraryCopy: {
    flex: 1,
    minWidth: 0,
  },
  libraryTitle: {
    color: HG3.ink,
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '800',
  },
  librarySubtitle: {
    marginTop: 2,
    color: HG3.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  footerNote: {
    marginTop: 18,
    textAlign: 'center',
    color: HG3.faint,
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
    backgroundColor: HG3.surface,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 26,
  },
  sheetGrip: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: HG3.border,
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
    color: HG3.ink,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
  },
  sheetMeta: {
    marginTop: 2,
    color: HG3.muted,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '700',
  },
  sheetExplainer: {
    marginTop: 15,
    marginHorizontal: 2,
    color: HG3.muted,
    fontSize: 13.5,
    lineHeight: 21,
    fontWeight: '600',
  },
  sheetExplainerBold: {
    color: HG3.ink,
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
    backgroundColor: HG3.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCancelText: {
    color: HG3.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  sheetConfirm: {
    flex: 1.4,
    height: 50,
    borderRadius: 14,
    backgroundColor: HG3.purple,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: HG3.purpleBright,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 4,
  },
  sheetConfirmText: {
    color: HG3.surface,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
});
