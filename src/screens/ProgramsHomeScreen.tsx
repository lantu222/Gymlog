import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { HomeDaySessionSummary } from '../lib/homeCalendar';
import { HG3 } from '../lightTheme';

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
  nextSession: HomeDaySessionSummary & { label: string };
}

export interface ProgramsExploreItem {
  id: string;
  name: string;
  badge: string;
  description: string;
  metaLabel: string;
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
  onOpenExploreProgram: (programId: string) => void;
  onOpenCustomProgram: (programId: string) => void;
  onViewAllPrograms: () => void;
  onCreateProgram: () => void;
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

function LayersIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3l8.5 4.5L12 12 3.5 7.5z" stroke={color} strokeWidth={1.9} strokeLinejoin="round" />
      <Path d="M4 12l8 4.3 8-4.3" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 16.3l8 4.3 8-4.3" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ProgramsHomeScreen({
  activeProgram = null,
  exploreItems,
  customPrograms,
  exerciseLibraryCount,
  onStartActiveSession,
  onOpenActivePlan,
  onOpenExploreProgram,
  onOpenCustomProgram,
  onViewAllPrograms,
  onCreateProgram,
  onOpenLibrary,
}: ProgramsHomeScreenProps) {
  const nextSession = activeProgram?.nextSession ?? null;
  const nextFocus = nextSession
    ? nextSession.exercises
        .slice(0, 3)
        .map((exercise) => exercise.name)
        .join(' · ')
    : '';
  const totalWeeks = Math.max(1, activeProgram?.planTotalWeeks ?? 1);
  const currentWeek = Math.min(Math.max(1, activeProgram?.currentWeek ?? 1), totalWeeks);

  return (
    <View style={styles.screenBackground}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Programs</Text>
            <Text style={styles.headerSubtitle}>Your plan, and the programs behind it.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search the exercise library"
            onPress={onOpenLibrary}
            hitSlop={8}
            style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5" stroke={HG3.purple} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
        </View>

        {activeProgram && nextSession ? (
          <View style={styles.activeCard}>
            <View style={styles.activeHeaderRow}>
              <Text style={styles.activeEyebrow}>ACTIVE PROGRAM</Text>
              <Text style={styles.activeWeekLabel}>{activeProgram.weekLabel}</Text>
            </View>

            <View style={styles.activeTitleRow}>
              <View style={styles.activeIconTile}>
                <LayersIcon color={HG3.surface} size={22} />
              </View>
              <View style={styles.activeTitleCopy}>
                <Text style={styles.activeTitle} numberOfLines={2}>
                  {activeProgram.title}
                </Text>
                <Text style={styles.activePhase}>
                  Week {currentWeek}: {phaseNote(currentWeek, totalWeeks)}
                </Text>
              </View>
            </View>

            <View style={styles.segmentRow}>
              {Array.from({ length: totalWeeks }, (_, index) => (
                <View
                  key={index}
                  style={[styles.segment, index < currentWeek ? styles.segmentFilled : styles.segmentEmpty]}
                />
              ))}
            </View>

            <View style={styles.tagRow}>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{activeProgram.sessionsPerWeek} days / week</Text>
              </View>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{activeProgram.goalLabel}</Text>
              </View>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{activeProgram.focusLabel}</Text>
              </View>
            </View>

            <View style={styles.activeDivider} />

            <View style={styles.nextRow}>
              <View style={styles.nextCopy}>
                <Text style={styles.nextEyebrow}>NEXT SESSION</Text>
                <Text style={styles.nextTitle} numberOfLines={1}>
                  {nextSession.title} · Today
                </Text>
                <Text style={styles.nextMeta} numberOfLines={1}>
                  {nextFocus ? `${nextFocus} · ` : ''}
                  {nextSession.duration}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Start ${nextSession.title}`}
                onPress={() => onStartActiveSession(nextSession.id)}
                style={({ pressed }) => [styles.startButton, pressed && styles.pressed]}
              >
                <Text style={styles.startButtonText}>Start</Text>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path d="M5 12h14M13 6l6 6-6 6" stroke={HG3.surface} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View plan, edit days and swap exercises"
              onPress={onOpenActivePlan}
              style={({ pressed }) => [styles.viewPlanRow, pressed && styles.pressed]}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" stroke={HG3.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.viewPlanText}>View plan, edit days &amp; swap exercises</Text>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="m9 6 6 6-6 6" stroke={HG3.faint} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
          </View>
        ) : (
          <View style={styles.emptyActiveCard}>
            <Text style={styles.emptyActiveTitle}>No active program</Text>
            <Text style={styles.emptyActiveSub}>Pick a ready program below or build your own to get a weekly plan.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create a program"
              onPress={onCreateProgram}
              style={({ pressed }) => [styles.emptyActiveButton, pressed && styles.pressed]}
            >
              <Text style={styles.emptyActiveButtonText}>Create a program</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.sectionHeadRow}>
          <Text style={styles.sectionEyebrow}>EXPLORE PROGRAMS</Text>
          <Pressable onPress={onViewAllPrograms} hitSlop={8}>
            <Text style={styles.sectionLink}>View all</Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.exploreRow}
          style={styles.exploreScroll}
        >
          {exploreItems.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.name}`}
              onPress={() => onOpenExploreProgram(item.id)}
              style={({ pressed }) => [styles.exploreCard, pressed && styles.pressed]}
            >
              <View style={styles.exploreBadgeRow}>
                <View style={styles.exploreBadge}>
                  <Text style={styles.exploreBadgeText}>{item.badge}</Text>
                </View>
                <LayersIcon color={HG3.purpleBright} size={18} />
              </View>
              <Text style={styles.exploreTitle} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.exploreDescription} numberOfLines={2}>
                {item.description}
              </Text>
              <Text style={styles.exploreMeta}>{item.metaLabel}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.sectionEyebrowStandalone}>YOUR PROGRAMS</Text>
        {customPrograms.map((program) => (
          <Pressable
            key={program.id}
            accessibilityRole="button"
            accessibilityLabel={`Open ${program.name}`}
            onPress={() => onOpenCustomProgram(program.id)}
            style={({ pressed }) => [styles.customRow, pressed && styles.pressed]}
          >
            <View style={styles.customIcon}>
              <LayersIcon color={HG3.purple} size={20} />
            </View>
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
          style={({ pressed }) => [styles.createRow, pressed && styles.pressed]}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M12 5v14M5 12h14" stroke={HG3.purple} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.createText}>Create a program</Text>
        </Pressable>

        <Text style={styles.sectionEyebrowStandalone}>LIBRARY</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open the exercise library"
          onPress={onOpenLibrary}
          style={({ pressed }) => [styles.libraryRow, pressed && styles.pressed]}
        >
          <View style={styles.libraryIcon}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
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
    paddingTop: 20,
    paddingBottom: 132,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  headerCopy: {
    flex: 1,
    gap: 3,
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
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '600',
  },
  searchButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: HG3.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCard: {
    marginTop: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: HG3.border,
    backgroundColor: HG3.surface,
    padding: 18,
    shadowColor: HG3.purpleBright,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  activeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeEyebrow: {
    color: HG3.purple,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  activeWeekLabel: {
    color: HG3.muted,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '700',
  },
  activeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginTop: 14,
  },
  activeIconTile: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: HG3.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTitleCopy: {
    flex: 1,
    minWidth: 0,
  },
  activeTitle: {
    color: HG3.ink,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  activePhase: {
    marginTop: 2,
    color: HG3.purple,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 16,
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
    backgroundColor: HG3.border,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  tag: {
    borderRadius: 999,
    backgroundColor: HG3.purpleSoft,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  tagText: {
    color: HG3.purple,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '700',
  },
  activeDivider: {
    height: 1,
    backgroundColor: HG3.border,
    marginTop: 18,
    marginBottom: 16,
  },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nextCopy: {
    flex: 1,
    minWidth: 0,
  },
  nextEyebrow: {
    color: HG3.faint,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  nextTitle: {
    marginTop: 4,
    color: HG3.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  nextMeta: {
    marginTop: 2,
    color: HG3.muted,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '600',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 13,
    backgroundColor: HG3.purple,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  startButtonText: {
    color: HG3.surface,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  viewPlanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: HG3.border,
  },
  viewPlanText: {
    flex: 1,
    color: HG3.ink,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '700',
  },
  emptyActiveCard: {
    marginTop: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: HG3.border,
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 26,
    marginBottom: 12,
  },
  sectionEyebrow: {
    color: HG3.faint,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  sectionEyebrowStandalone: {
    color: HG3.faint,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 26,
    marginBottom: 12,
  },
  sectionLink: {
    color: HG3.purple,
    fontSize: 13.5,
    lineHeight: 17,
    fontWeight: '700',
  },
  exploreScroll: {
    marginHorizontal: -20,
  },
  exploreRow: {
    paddingHorizontal: 20,
    gap: 12,
  },
  exploreCard: {
    width: 220,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HG3.border,
    backgroundColor: HG3.surface,
    padding: 15,
    shadowColor: HG3.purpleBright,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  exploreBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  exploreBadge: {
    borderRadius: 999,
    backgroundColor: HG3.purpleSoft,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  exploreBadgeText: {
    color: HG3.purple,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  exploreTitle: {
    color: HG3.ink,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  exploreDescription: {
    marginTop: 5,
    color: HG3.muted,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '600',
    minHeight: 34,
  },
  exploreMeta: {
    marginTop: 10,
    color: HG3.purple,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '700',
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: HG3.border,
    backgroundColor: HG3.surface,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  customIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: HG3.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customCopy: {
    flex: 1,
    minWidth: 0,
  },
  customTitle: {
    color: HG3.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  customSubtitle: {
    marginTop: 2,
    color: HG3.muted,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '600',
  },
  customAction: {
    color: HG3.purple,
    fontSize: 13.5,
    lineHeight: 17,
    fontWeight: '700',
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HG3.border,
    borderStyle: 'dashed',
    paddingVertical: 15,
  },
  createText: {
    color: HG3.purple,
    fontSize: 14.5,
    lineHeight: 18,
    fontWeight: '800',
  },
  libraryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 15,
    backgroundColor: HG3.purpleSoft,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  libraryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: HG3.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  libraryCopy: {
    flex: 1,
    minWidth: 0,
  },
  libraryTitle: {
    color: HG3.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  librarySubtitle: {
    marginTop: 2,
    color: HG3.muted,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '600',
  },
  footerNote: {
    marginTop: 22,
    textAlign: 'center',
    color: HG3.faint,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '600',
  },
  bottomSafeFade: {
    height: 16,
  },
});
