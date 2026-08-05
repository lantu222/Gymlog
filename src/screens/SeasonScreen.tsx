import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { I18nKey, t } from '../lib/i18n';
import type { ProgramSeason } from '../lib/programSeasons';
import {
  SEASON_BLOCKS,
  SEASON_WEEKS,
  resolveSeasonWindow,
  seasonBlockIndex,
  seasonProgressRatio,
  seasonWeek,
  seasonWeeksLeft,
} from '../lib/season';
import {
  POINTS_PER_BLOCK,
  POINTS_PER_FULL_WEEK,
  POINTS_PER_RECORD,
  POINTS_PER_WORKOUT,
  SeasonBadge,
  SeasonProgress,
} from '../lib/seasonScoring';
import { Theme, useTheme, useThemedStyles } from '../theming';
import type { AppLanguage } from '../types/models';

/**
 * A season, as a screen.
 *
 * The design builds this on a leaderboard — 1 480 people, rank 412, "+38
 * places a week". None of that exists on a device that only knows its own
 * owner, and this app has already refused to ship invented social proof once.
 * So the series is the one section that waits for accounts, and it says so
 * rather than showing plausible names.
 *
 * Everything else on this screen is real today: the dates and the countdown
 * are the calendar, the points are the reader's own logged sessions against a
 * stated rule, the weekly requirement is their own program's days per week,
 * and every badge has a condition they can check.
 */

const SEASON_GRADIENTS: Record<ProgramSeason, [string, string]> = {
  summer: ['#C4562A', '#7A2410'],
  winter: ['#2E5C93', '#12294B'],
};

const BLOCK_KEYS: Record<(typeof SEASON_BLOCKS)[number], I18nKey> = {
  base: 'season.block.base',
  load: 'season.block.load',
  power: 'season.block.power',
  peak: 'season.block.peak',
};

const BADGE_KEYS: Record<string, I18nKey> = {
  streak12: 'season.badge.streak12',
  finished: 'season.badge.finished',
  record: 'season.badge.record',
};

const BADGE_ICONS: Record<string, string> = {
  streak12: 'M5 19h14M6 15l5-5 3 3 5-6',
  finished: 'M12 3l2.3 4.7 5.2.8-3.8 3.7.9 5.1L12 15l-4.6 2.3.9-5.1L4.5 8.5l5.2-.8z',
  record: 'M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10',
};

export interface SeasonProgramItem {
  id: string;
  name: string;
  blurb: string;
  days: number;
  coverIndex: number;
  fingerprint: number[];
}

interface SeasonScreenProps {
  season: ProgramSeason;
  language?: AppLanguage;
  progress: SeasonProgress;
  badges: SeasonBadge[];
  /** THE season program — one per season, see SEASON_PROGRAM_IDS. */
  seasonProgram: SeasonProgramItem;
  /** True when this is the program the reader is actually running. */
  running: boolean;
  onBack: () => void;
  onOpenProgram: (programId: string) => void;
  onStartToday: () => void;
}

function formatDay(date: Date, language: AppLanguage): string {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  return language === 'fi' ? `${day}.${month}.` : `${day}/${month}`;
}

const COVER_GRADIENTS: Array<[string, string]> = [
  ['#7699FB', '#2D48C0'],
  ['#00B1E0', '#0068A2'],
  ['#D179CA', '#8D1A89'],
  ['#37B976', '#007322'],
  ['#EB7A52', '#A71000'],
];

function ProgramMiniCover({ index, fingerprint }: { index: number; fingerprint: number[] }) {
  const stops = COVER_GRADIENTS[index % COVER_GRADIENTS.length];
  const gid = `season-cov-${index}`;
  const size = 64;
  return (
    <Svg width={size} height={size}>
      <Defs>
        <SvgLinearGradient id={gid} x1="0.2" y1="0" x2="0.9" y2="1">
          <Stop offset="0" stopColor={stops[0]} />
          <Stop offset="1" stopColor={stops[1]} />
        </SvgLinearGradient>
      </Defs>
      <Rect x="0" y="0" width={size} height={size} rx={13} fill={`url(#${gid})`} />
      {fingerprint.map((ratio, bar) => {
        const slot = (size - 14) / Math.max(1, fingerprint.length);
        const width = Math.max(2, slot - 2);
        const height = Math.max(4, ratio * 34);
        return (
          <Rect
            key={bar}
            x={7 + bar * slot}
            y={size - 8 - height}
            width={width}
            height={height}
            rx={1.5}
            fill="#FFFFFF"
            fillOpacity={0.85}
          />
        );
      })}
    </Svg>
  );
}

export function SeasonScreen({
  season,
  language = 'en',
  progress,
  badges,
  seasonProgram,
  running,
  onBack,
  onOpenProgram,
  onStartToday,
}: SeasonScreenProps) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();

  const window = resolveSeasonWindow();
  const week = Math.max(1, seasonWeek(window));
  const weeksLeft = seasonWeeksLeft(window);
  const ratio = seasonProgressRatio(window);
  const blockIndex = seasonBlockIndex(week);
  const gradient = SEASON_GRADIENTS[season];
  const earned = badges.filter((badge) => badge.earned).length;
  const weekRatio =
    progress.thisWeekTarget > 0 ? Math.min(1, progress.thisWeekDone / progress.thisWeekTarget) : 0;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Svg style={StyleSheet.absoluteFill}>
            <Defs>
              <SvgLinearGradient id="seasonHero" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={gradient[0]} />
                <Stop offset="1" stopColor={gradient[1]} />
              </SvgLinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#seasonHero)" />
          </Svg>

          <View style={styles.heroTopRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(language, 'common.back')}
              onPress={onBack}
              hitSlop={10}
              style={styles.backButton}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M15 6l-6 6 6 6" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
            <Text style={styles.heroKicker}>
              {t(language, season === 'winter' ? 'season.winter' : 'season.summer').toUpperCase()} {window.year}
            </Text>
          </View>

          <Text style={styles.heroTitle}>
            {t(language, season === 'winter' ? 'season.winter' : 'season.summer')}
          </Text>
          <Text style={styles.heroDates}>
            {t(language, 'season.range', {
              start: formatDay(window.start, language),
              end: formatDay(new Date(window.end.getTime() - 86_400_000), language),
            })}
            {'  ·  '}
            {t(language, 'season.weeksUnit', { count: SEASON_WEEKS })}
          </Text>
          <Text style={styles.heroLead}>
            {t(language, season === 'winter' ? 'season.winterLead' : 'season.summerLead')}
          </Text>

          {/* The reader's own numbers. Points are workouts and full weeks
              against a stated rule, so the total is checkable by hand. */}
          <View style={styles.heroStats}>
            <View>
              <Text style={styles.heroBigNumber}>{progress.points}</Text>
              <Text style={styles.heroStatLabel}>{t(language, 'season.yourPoints')}</Text>
            </View>
            <View style={styles.heroStatSpacer} />
            <View>
              <Text style={styles.heroMidNumber}>{progress.workouts}</Text>
              <Text style={styles.heroStatLabel}>
                {t(language, 'season.workoutsLogged', { count: progress.workouts }).toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.heroTrack}>
            <View style={[styles.heroTrackFill, { width: `${Math.round(ratio * 100)}%` }]} />
          </View>
          <View style={styles.heroTrackRow}>
            <Text style={styles.heroTrackLabel}>
              {t(language, 'season.week', { week, total: SEASON_WEEKS })}
            </Text>
            <Text style={styles.heroTrackLabel}>
              {t(language, 'season.weeksLeft', { count: weeksLeft })}
            </Text>
          </View>
        </View>

        {/* This week: the requirement, and what a full one is worth. */}
        <View style={styles.weekCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardEyebrow}>{t(language, 'season.thisWeek')}</Text>
            {progress.thisWeekTarget > 0 ? (
              <Text style={styles.weekCount}>
                {t(language, 'season.thisWeekDone', {
                  done: progress.thisWeekDone,
                  target: progress.thisWeekTarget,
                })}
              </Text>
            ) : null}
          </View>
          {progress.thisWeekTarget > 0 ? (
            <>
              <Text style={styles.weekGoal}>
                {t(language, 'season.thisWeekGoal', { count: progress.thisWeekTarget })}
              </Text>
              <View style={styles.weekTrack}>
                <View style={[styles.weekTrackFill, { width: `${Math.round(weekRatio * 100)}%` }]} />
              </View>
              <Text style={styles.weekNote}>
                {t(language, 'season.thisWeekBonus', { count: POINTS_PER_FULL_WEEK })}
              </Text>
            </>
          ) : (
            <Text style={styles.weekGoal}>{t(language, 'season.noTarget')}</Text>
          )}
        </View>

        {/* THE season program. One, not ten.
            Ten season programs meant ten different day counts and therefore
            ten different point ceilings — the ranking would have sorted people
            by how many days their program prescribes. One shared program is
            what makes "week 9" a sentence two people can say to each other. */}
        <Text style={styles.sectionEyebrow}>{t(language, 'season.theProgram')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={seasonProgram.name}
          onPress={() => onOpenProgram(seasonProgram.id)}
          style={({ pressed }) => [styles.card, pressed && styles.pressedRow]}
        >
          <View style={styles.programHeadRow}>
            <ProgramMiniCover index={seasonProgram.coverIndex} fingerprint={seasonProgram.fingerprint} />
            <View style={styles.programCopy}>
              <Text style={styles.programName} numberOfLines={1}>
                {seasonProgram.name}
              </Text>
              <Text style={styles.programMeta}>
                {t(language, 'programs.card.days', { count: seasonProgram.days })}
                {'  ·  '}
                {t(language, 'season.weeksUnit', { count: SEASON_WEEKS })}
              </Text>
              {running ? (
                <View style={[styles.runningPill, { backgroundColor: gradient[0] }]}>
                  <Text style={styles.runningPillText}>{t(language, 'season.running')}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.blockRow}>
            {SEASON_BLOCKS.map((block, index) => (
              <View
                key={block}
                style={[styles.block, index === blockIndex && { backgroundColor: gradient[1] }]}
              >
                <Text style={[styles.blockText, index === blockIndex && styles.blockTextOn]}>
                  {t(language, BLOCK_KEYS[block])}
                </Text>
              </View>
            ))}
          </View>
        </Pressable>
        <Text style={styles.oneProgramNote}>
          {running ? t(language, 'season.oneProgram') : t(language, 'season.notIn')}
        </Text>

        {/* Badges. Each condition is the reader's own log. */}
        <Text style={styles.sectionEyebrow}>
          {t(language, 'season.badges', { earned, total: badges.length })}
        </Text>
        <View style={styles.badgeRow}>
          {badges.map((badge) => (
            <View key={badge.key} style={[styles.badge, !badge.earned && styles.badgeLocked]}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                <Path
                  d={BADGE_ICONS[badge.key]}
                  stroke={badge.earned ? gradient[0] : theme.faint}
                  strokeWidth={1.9}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
              <Text style={[styles.badgeText, badge.earned && { color: gradient[1] }]}>
                {t(language, BADGE_KEYS[badge.key])}
              </Text>
            </View>
          ))}
        </View>

        {/* The series. The one section that needs other people, and the only
            one on this screen that cannot be true yet. */}
        <Text style={styles.sectionEyebrow}>{t(language, 'season.series')}</Text>
        <View style={styles.lockedCard}>
          <View style={styles.lockedRow}>
            <View style={[styles.avatar, { backgroundColor: theme.purple }]}>
              <Text style={styles.avatarText}>{t(language, 'season.you').slice(0, 2).toUpperCase()}</Text>
            </View>
            <Text style={styles.lockedName}>{t(language, 'season.you')}</Text>
            <Text style={styles.lockedPoints}>{t(language, 'season.points', { count: progress.points })}</Text>
          </View>
          <Text style={styles.lockedNote}>{t(language, 'season.seriesLocked')}</Text>
        </View>

        {/* How it works — the scoring rule, stated where the number is. */}
        <Text style={styles.sectionEyebrow}>{t(language, 'season.how')}</Text>
        <View style={styles.card}>
          {(['season.how.1', 'season.how.2', 'season.how.records', 'season.how.3'] as I18nKey[]).map((key, index) => (
            <View key={key} style={styles.howRow}>
              <Text style={[styles.howIndex, { color: gradient[0] }]}>{index + 1}</Text>
              <Text style={styles.howText}>
                {t(language, key, {
                  perWorkout: POINTS_PER_WORKOUT,
                  perWeek: POINTS_PER_FULL_WEEK,
                  perRecord: POINTS_PER_RECORD,
                  perBlock: POINTS_PER_BLOCK,
                })}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.optOut}>{t(language, 'season.optOut')}</Text>
      </ScrollView>

      <View style={styles.ctaBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, running ? 'home.startWorkout' : 'season.join')}
          onPress={onStartToday}
          style={({ pressed }) => [styles.cta, { backgroundColor: gradient[0] }, pressed && styles.pressed]}
        >
          <Text style={styles.ctaText}>
            {t(language, running ? 'home.startWorkout' : 'season.join')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  content: {
    paddingBottom: 210,
  },
  pressed: {
    opacity: 0.85,
  },
  pressedRow: {
    opacity: 0.7,
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 22,
    overflow: 'hidden',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroKicker: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 37,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginTop: 18,
  },
  heroDates: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 6,
  },
  heroLead: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    marginTop: 10,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 20,
  },
  heroStatSpacer: {
    width: 24,
  },
  heroBigNumber: {
    color: '#FFFFFF',
    fontSize: 44,
    lineHeight: 46,
    fontWeight: '800',
    letterSpacing: -1.6,
  },
  heroMidNumber: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  heroTrack: {
    height: 8,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginTop: 18,
    overflow: 'hidden',
  },
  heroTrackFill: {
    height: 8,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  heroTrackRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 7,
  },
  heroTrackLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  sectionEyebrow: {
    color: theme.faint,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginTop: 24,
    marginBottom: 10,
    paddingHorizontal: 22,
  },
  card: {
    marginHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    padding: 14,
  },
  cardEyebrow: {
    color: theme.muted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekCard: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    padding: 14,
  },
  weekCount: {
    color: theme.muted,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '800',
  },
  weekGoal: {
    color: theme.ink,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginTop: 7,
  },
  weekTrack: {
    height: 8,
    borderRadius: 5,
    backgroundColor: theme.bg,
    marginTop: 11,
    overflow: 'hidden',
  },
  weekTrackFill: {
    height: 8,
    borderRadius: 5,
    backgroundColor: theme.purple,
  },
  weekNote: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    marginTop: 9,
  },
  howRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  howIndex: {
    width: 16,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
  },
  howText: {
    flex: 1,
    color: theme.ink,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  programName: {
    color: theme.ink,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  programMeta: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    marginTop: 3,
  },
  blockRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 11,
  },
  block: {
    flex: 1,
    borderRadius: 7,
    backgroundColor: theme.bg,
    paddingVertical: 6,
    alignItems: 'center',
  },
  blockText: {
    color: theme.faint,
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  blockTextOn: {
    color: '#FFFFFF',
  },
  lockedCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    padding: 14,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '800',
  },
  lockedName: {
    flex: 1,
    color: theme.ink,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '800',
  },
  lockedPoints: {
    color: theme.ink,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '800',
  },
  lockedNote: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    marginTop: 10,
  },
  programList: {
    paddingHorizontal: 20,
    gap: 9,
  },
  programHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  runningPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  runningPillText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  programRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 9,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  programCopy: {
    flex: 1,
    minWidth: 0,
  },
  programRowName: {
    color: theme.ink,
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  programBlurb: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  programRowMeta: {
    color: theme.faint,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
  },
  badge: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  badgeLocked: {
    opacity: 0.45,
  },
  badgeText: {
    color: theme.muted,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'center',
    marginTop: 5,
  },
  oneProgramNote: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    marginTop: 10,
    paddingHorizontal: 22,
  },
  optOut: {
    color: theme.muted,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '600',
    marginTop: 22,
    paddingHorizontal: 22,
  },
  ctaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    // Clears the floating tab pill this screen sits behind.
    paddingBottom: 108,
    backgroundColor: theme.bg,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  cta: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    lineHeight: 20,
    fontWeight: '800',
  },
});
