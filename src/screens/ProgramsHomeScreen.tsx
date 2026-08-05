import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
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
import { I18nKey, t } from '../lib/i18n';
import type { CampaignTarget, ProgramCampaign } from '../lib/programCampaigns';
import { PROGRAM_CATEGORIES, ProgramCategoryKey } from '../lib/programCategories';
import { isValidTarget, StrengthGoalProgress } from '../lib/strengthGoals';
import type { ProgramSeason } from '../lib/programSeasons';
import { orderSeasonTiles, currentSeasonTile } from '../lib/programSeasonTiles';
import { Theme, useTheme, useThemedStyles } from '../theming';
import type { WorkoutLevel } from '../features/workout/workoutTypes';
import type { AppLanguage, WorkoutTemplateDraft } from '../types/models';

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

/** Seasons get the same header treatment as a category, in their own hue. */
const SEASON_SHEET_TINTS = {
  winter: { bg: '#DEEBFF', border: '#C9D7FA', ink: '#0086BE' },
  summer: { bg: '#FFE5CD', border: '#F0D1B7', ink: '#A76D00' },
} as const;

/**
 * Gold, silver, bronze — then plain numbers.
 *
 * A ranked list where every rank looks the same is a list with a number
 * column, not a ranking. Three metals is the one visual convention everyone
 * already reads without a legend, and it stops at three on purpose: a fourth
 * metal would be inventing a rank that does not exist.
 */
const MEDALS: Array<{ stops: [string, string]; ink: string }> = [
  { stops: ['#F8DA86', '#B8860B'], ink: '#4E3400' },
  { stops: ['#E9EEF4', '#98A2AE'], ink: '#39414C' },
  { stops: ['#EBB88E', '#A0662F'], ink: '#432408' },
];

function RankMedal({ index }: { index: number }) {
  const styles = useThemedStyles(makeStyles);
  const medal = MEDALS[index];
  if (!medal) {
    return (
      <View style={styles.trendingRank}>
        <Text style={styles.trendingRankText}>{index + 1}</Text>
      </View>
    );
  }
  const gid = `medal-${index}`;
  return (
    <View style={styles.trendingMedal}>
      <Svg width={36} height={36}>
        <Defs>
          <SvgLinearGradient id={gid} x1="0.2" y1="0" x2="0.8" y2="1">
            <Stop offset="0" stopColor={medal.stops[0]} />
            <Stop offset="1" stopColor={medal.stops[1]} />
          </SvgLinearGradient>
        </Defs>
        <Circle cx={18} cy={18} r={17} fill={`url(#${gid})`} />
        {/* The rim: without it the disc reads as a flat coloured dot. */}
        <Circle cx={18} cy={18} r={14} stroke="#FFFFFF" strokeOpacity={0.42} strokeWidth={1.2} fill="none" />
      </Svg>
      <Text style={[styles.trendingMedalText, { color: medal.ink }]}>{index + 1}</Text>
    </View>
  );
}

// Tall enough for a two-line title, two lines of body AND the pill under
// them. At 186 the CTA was clipped by the card's own bottom edge.
const CAMPAIGN_H = 216;

const COVER_W = 274;
const COVER_H = 176;

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
  /**
   * Level and block length, which the browse cards never carried.
   *
   * The level is the single fact that decides whether a program is for this
   * reader at all, and the catalog screen did not show it anywhere. The sheet
   * filters on it.
   */
  level: WorkoutLevel;
  weeks: number;
}

export interface ProgramsCustomItem {
  id: string;
  name: string;
  subtitle: string;
}

/** A program with real logged work behind it. See lib/programContinue. */
export interface ProgramsContinueItem extends ProgramsExploreItem {
  sessionCount: number;
  daysSince: number;
}

interface ProgramsHomeScreenProps {
  /** The running program's name — the switch sheet says what you leave. */
  activeProgramTitle?: string | null;
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
  recommendations: Array<
    ProgramsExploreItem & {
      /** Short, and carrying the number: "Sopii 3 päivään". */
      why: string;
    }
  >;
  /** The rotating hero. Empty hides it — see lib/programCampaigns. */
  campaigns: ProgramCampaign[];
  /** Programs with logged work that are not the active one. */
  continueItems: ProgramsContinueItem[];
  /** How many programs each season block holds, for the four tiles. */
  seasonTileCounts: Record<ProgramSeason, number>;
  customPrograms: ProgramsCustomItem[];
  exerciseLibraryCount: number;
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
  width = COVER_W,
  height = COVER_H,
  compact = false,
}: {
  style: (typeof COVER_STYLES)[number];
  goal: string;
  days: number;
  name: string;
  language: AppLanguage;
  /**
   * Covers come in three sizes now, and that is the point.
   *
   * Every row on this page used one 274×176 card, so five sections of real
   * variety read as five copies of the same screen — the reader's own
   * criticism, and a fair one. A browse page tells you what matters by how big
   * it draws it, and a page where everything is the same size has said nothing.
   */
  width?: number;
  height?: number;
  /** Drops the goal tag and photo marker — there is no room at 104px tall. */
  compact?: boolean;
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

  const gid = `cover-${style.cover[0]}-${width}x${height}`.replace(/[^a-zA-Z0-9]/g, '');
  const shadeHeight = Math.min(78, height * 0.55);
  const barCeiling = Math.max(18, height * 0.42);
  return (
    <View style={[styles.cover, { width, height }]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
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
        <Rect x="0" y="0" width={width} height={height} fill={`url(#${gid})`} />
        <Rect x="0" y="0" width={width} height={height} fill={`url(#${gid}-hl)`} />
        {/* fine diagonal texture */}
        {Array.from({ length: Math.ceil(width / 30) }, (_, i) => (
          <Path key={i} d={`M${-40 + i * 42} ${height} L${40 + i * 42} 0`} stroke="#FFFFFF" strokeOpacity={0.06} strokeWidth={1} />
        ))}
        {/* The week, as bars. Drawn under the shade gradient so the name stays
            readable over them, and inset from the tag row above. */}
        {fingerprint.length > 0
          ? fingerprint.map((barRatio, index) => {
              const slot = (width - 32) / fingerprint.length;
              const barWidth = Math.max(3, Math.min(18, slot - 5));
              const barHeight = Math.max(4, barRatio * barCeiling);
              return (
                <Rect
                  key={index}
                  x={16 + index * slot + (slot - barWidth) / 2}
                  // Anchored to the bottom edge rather than floating mid-card.
                  // On device the floating version read as three pale smudges
                  // behind the title: a histogram needs a baseline to be one.
                  y={height - barHeight}
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
        <Svg x={width - height * 0.75} y={height - height * 0.73} width={height * 0.85} height={height * 0.85} viewBox="0 0 24 24">
          <Path d={style.motif} stroke="#FFFFFF" strokeOpacity={0.16} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
        <Rect x="0" y={height - shadeHeight} width={width} height={shadeHeight} fill={`url(#${gid}-shade)`} />
      </Svg>
      {compact ? null : (
        <View style={styles.coverTag}>
          <Text style={styles.coverTagText}>{goal}</Text>
        </View>
      )}
      <View style={styles.coverBadge}>
        <Text style={styles.coverBadgeText}>{t(language, 'programs.card.daysShort', { count: days })}</Text>
      </View>
      {/* Marks the slot where a real gym photo will land (shot later at 3:2, cropped 4:5). */}
      {compact ? null : (
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
      )}
      <Text style={[styles.coverName, compact && styles.coverNameCompact]} numberOfLines={2}>
        {name}
      </Text>
    </View>
  );
}

/**
 * The rotating campaign hero.
 *
 * Swipeable AND self-advancing: auto-rotation is what makes the top of the page
 * feel alive, but a card that moves under your thumb while you are reading it
 * is hostile, so touching it stops the timer for good. The pause control makes
 * that explicit rather than magic.
 */
function CampaignHero({
  campaigns,
  language,
  onOpen,
}: {
  campaigns: ProgramCampaign[];
  language: AppLanguage;
  onOpen: (target: CampaignTarget) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  // pagingEnabled snaps to the ScrollView's OWN width, so the slide must be
  // exactly that: full-bleed slides inside a padded page drifted 40px per
  // page and left the next card peeking in at an angle.
  const slideWidth = Math.max(240, windowWidth - 40);
  const scrollRef = useRef<ScrollView | null>(null);
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (!running || campaigns.length < 2) {
      return;
    }
    const timer = setInterval(() => {
      setIndex((current) => {
        const next = (current + 1) % campaigns.length;
        scrollRef.current?.scrollTo({ x: next * slideWidth, animated: true });
        return next;
      });
    }, 4200);
    return () => clearInterval(timer);
  }, [campaigns.length, running, slideWidth]);

  if (campaigns.length === 0) {
    return null;
  }

  const onMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
    setIndex(Math.max(0, Math.min(campaigns.length - 1, page)));
  };

  return (
    <View style={styles.campaignBlock}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        onScrollBeginDrag={() => setRunning(false)}
        style={styles.campaignScroll}
      >
        {campaigns.map((campaign) => {
          const gid = `camp-${campaign.key}`.replace(/[^a-zA-Z0-9]/g, '');
          return (
            <Pressable
              key={campaign.key}
              accessibilityRole="button"
              accessibilityLabel={t(language, campaign.ctaKey)}
              onPress={() => onOpen(campaign.target)}
              style={({ pressed }) => [styles.campaignSlide, { width: slideWidth }, pressed && styles.pressed]}
            >
              <Svg width={slideWidth} height={CAMPAIGN_H} style={StyleSheet.absoluteFill}>
                <Defs>
                  <SvgLinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor={campaign.gradient[0]} />
                    <Stop offset="1" stopColor={campaign.gradient[1]} />
                  </SvgLinearGradient>
                </Defs>
                <Rect x="0" y="0" width={slideWidth} height={CAMPAIGN_H} rx={24} fill={`url(#${gid})`} />
                <Svg x={slideWidth - 120} y={38} width={140} height={140} viewBox="0 0 24 24">
                  <Path
                    d={LAYERS_MOTIF}
                    stroke="#FFFFFF"
                    strokeOpacity={0.18}
                    strokeWidth={1.3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </Svg>
              </Svg>
              <Text style={styles.campaignKicker}>{t(language, campaign.kickerKey)}</Text>
              <Text style={styles.campaignTitle} numberOfLines={2}>
                {t(language, campaign.titleKey)}
              </Text>
              <Text style={styles.campaignBody} numberOfLines={2}>
                {t(language, campaign.bodyKey, { count: campaign.count })}
              </Text>
              <View style={styles.campaignCta}>
                <Text style={styles.campaignCtaText}>{t(language, campaign.ctaKey)}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.campaignFooter}>
        <View style={styles.campaignDots}>
          {campaigns.map((campaign, dot) => (
            <View key={campaign.key} style={[styles.campaignDot, dot === index && styles.campaignDotOn]} />
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, running ? 'programs.campaign.pause' : 'programs.campaign.play')}
          onPress={() => setRunning((value) => !value)}
          hitSlop={10}
          style={styles.campaignPause}
        >
          <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
            {running ? (
              <Path d="M9 5v14M15 5v14" stroke={theme.muted} strokeWidth={2.4} strokeLinecap="round" />
            ) : (
              <Path d="M7 4.5v15l13-7.5z" stroke={theme.muted} strokeWidth={2.2} strokeLinejoin="round" fill="none" />
            )}
          </Svg>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Level badges, from the category design.
 *
 * The level is the one fact that decides whether a program is for this reader
 * at all, and no browse card carried it anywhere on this screen. A row that
 * says "5 days, ~70 min" without saying "Edistynyt" is describing the workload
 * and hiding the prerequisite.
 */
const LEVEL_STYLES: Record<WorkoutLevel, { bg: string; ink: string; key: I18nKey }> = {
  beginner: { bg: '#E8F7EE', ink: '#007633', key: 'programs.level.beginner' },
  intermediate: { bg: '#EFE7FF', ink: '#5B21B6', key: 'programs.level.intermediate' },
  advanced: { bg: '#FFE1DB', ink: '#A52A24', key: 'programs.level.advanced' },
};

const LEVEL_FILTERS: Array<{ level: WorkoutLevel | null; key: I18nKey }> = [
  { level: null, key: 'programs.level.all' },
  { level: 'beginner', key: 'programs.level.beginner' },
  { level: 'intermediate', key: 'programs.level.intermediate' },
  { level: 'advanced', key: 'programs.level.advanced' },
];

/** The 74x74 cover on a sheet row: gradient plus the program's own week. */
function RowCover({ style, fingerprint }: { style: (typeof COVER_STYLES)[number]; fingerprint: number[] }) {
  const gid = `row-${style.cover[0]}`.replace(/[^a-zA-Z0-9]/g, '');
  const size = 74;
  return (
    <Svg width={size} height={size}>
      <Defs>
        <SvgLinearGradient id={gid} x1="0.2" y1="0" x2="0.9" y2="1">
          <Stop offset="0" stopColor={style.cover[0]} />
          <Stop offset="1" stopColor={style.cover[1]} />
        </SvgLinearGradient>
      </Defs>
      <Rect x="0" y="0" width={size} height={size} rx={14} fill={`url(#${gid})`} />
      {fingerprint.map((ratio, index) => {
        const slot = (size - 16) / Math.max(1, fingerprint.length);
        const barWidth = Math.max(2, slot - 2.5);
        const barHeight = Math.max(4, ratio * 42);
        return (
          <Rect
            key={index}
            x={8 + index * slot}
            y={size - 9 - barHeight}
            width={barWidth}
            height={barHeight}
            rx={1.5}
            fill="#FFFFFF"
            fillOpacity={0.85}
          />
        );
      })}
    </Svg>
  );
}

/**
 * What a category tile opens.
 *
 * The first build put a horizontal rail under the tiles, which gave all nine
 * categories the same eight-card shape and no way to narrow further. A sheet
 * carries what a rail cannot: what the category is FOR, the level of every
 * program in it, a filter on that level, and a sentence per program saying
 * what the training actually is. Browsing stays behind it, and closing is one
 * gesture.
 *
 * Seasons use the same sheet. Two mechanisms for "show me this subset" is one
 * too many, and the season rail's "Poista suodatin" link — which emptied the
 * section instead of narrowing it — was the price of having a second one.
 */
function ProgramSheet({
  visible,
  onClose,
  language,
  title,
  focus,
  tint,
  icon,
  items,
  onPick,
  onViewAll,
}: {
  visible: boolean;
  onClose: () => void;
  language: AppLanguage;
  title: string;
  focus: string;
  tint: { bg: string; border: string; ink: string };
  icon: string;
  items: ProgramsExploreItem[];
  onPick: (item: ProgramsExploreItem) => void;
  onViewAll: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const [level, setLevel] = useState<WorkoutLevel | null>(null);

  // A filter left over from the last category would silently hide programs in
  // the next one, and the reader would have no idea why "Voima 8" opened three
  // rows.
  useEffect(() => {
    if (!visible) {
      setLevel(null);
    }
  }, [visible]);

  const shown = level === null ? items : items.filter((item) => item.level === level);

  /**
   * A definite height, not a cap.
   *
   * `maxHeight` does not bound a ScrollView's flex sizing here — the list laid
   * out against its own content and pushed the CTA off the bottom of the
   * screen. A computed row-count height did not fix it either: the sheet is
   * anchored to the bottom edge, so whatever it cannot fit is lost at the
   * bottom rather than the top, and the button is the last thing in it.
   *
   * One fixed height — and the CTA is taken out of the flex flow entirely
   * (see catSheetCta). `flex: 1` on the list still handed it more than the
   * leftover space on device, and a button that three separate layout fixes
   * could not keep on screen does not belong in the flow at all.
   */
  const sheetHeight = Math.round(windowHeight * 0.84);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={styles.sheetScrim} onPress={onClose} />
        {/* A percentage maxHeight inside a Modal does not bound this on
            Android — the list grew to its content and pushed the CTA off the
            bottom of the screen. Measured, so it cannot. */}
        <View style={[styles.catSheet, { height: sheetHeight }]}>
          <View style={styles.sheetGrip} />
          <View style={styles.catSheetHead}>
            <View style={[styles.catSheetIcon, { backgroundColor: tint.bg, borderColor: tint.border }]}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                <Path d={icon} stroke={tint.ink} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <View style={styles.catSheetCopy}>
              <Text style={styles.catSheetTitle} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.catSheetFocus} numberOfLines={2}>
                {t(language, 'programs.sheet.count', { count: items.length, focus })}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.sectionLink}>{t(language, 'programs.sheet.close')}</Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.levelRow}
            style={styles.levelScroll}
          >
            {LEVEL_FILTERS.map((entry) => {
              const on = level === entry.level;
              return (
                <Pressable
                  key={entry.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => setLevel(entry.level)}
                  style={[styles.levelChip, on && { backgroundColor: tint.ink, borderColor: tint.ink }]}
                >
                  <Text style={[styles.levelChipText, on && styles.levelChipTextOn]}>
                    {t(language, entry.key)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView style={styles.catSheetList} contentContainerStyle={styles.catSheetListInner}>
            {shown.length === 0 ? (
              <Text style={styles.catSheetEmpty}>{t(language, 'programs.sheet.empty')}</Text>
            ) : (
              shown.map((item) => {
                const style = COVER_STYLES[item.coverIndex % COVER_STYLES.length];
                const levelStyle = LEVEL_STYLES[item.level];
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={t(language, 'programs.switchTo', { name: item.name })}
                    onPress={() => onPick(item)}
                    style={({ pressed }) => [styles.sheetRow, pressed && styles.pressedRow]}
                  >
                    <RowCover style={style} fingerprint={item.fingerprint} />
                    <View style={styles.sheetRowCopy}>
                      <View style={styles.sheetRowTitleLine}>
                        <Text style={styles.sheetRowName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <View style={[styles.levelBadge, { backgroundColor: levelStyle.bg }]}>
                          <Text style={[styles.levelBadgeText, { color: levelStyle.ink }]}>
                            {t(language, levelStyle.key).toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.sheetRowBlurb} numberOfLines={2}>
                        {item.blurb}
                      </Text>
                      <View style={styles.exploreMetaRow}>
                        <Text style={styles.exploreMeta}>
                          {t(language, 'programs.card.days', { count: item.days })}
                        </Text>
                        <View style={styles.metaDot} />
                        <Text style={styles.exploreMeta}>~{item.minutes} min</Text>
                        {item.weeks > 0 ? (
                          <>
                            <View style={styles.metaDot} />
                            <Text style={styles.exploreMeta}>
                              {t(language, 'programs.weeks', { count: item.weeks })}
                            </Text>
                          </>
                        ) : null}
                      </View>
                    </View>
                    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="m9 6 6 6-6 6"
                        stroke={theme.faint}
                        strokeWidth={2.2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <View style={styles.catSheetCta}>
            <Pressable
              accessibilityRole="button"
              onPress={onViewAll}
              style={({ pressed }) => [styles.sheetConfirm, pressed && styles.pressed]}
            >
              <Text style={styles.sheetConfirmText}>
                {t(language, 'programs.sheet.viewAll', { count: items.length })}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function ProgramsHomeScreen({
  activeProgramTitle = null,
  seasonRows,
  catalogItems,
  categoryCounts,
  categoryMembers,
  trendingItems,
  recommendations,
  campaigns,
  continueItems,
  seasonTileCounts,
  goals,
  goalCandidates,
  onSetGoal,
  onRemoveGoal,
  customPrograms,
  exerciseLibraryCount,
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
  /**
   * Which sheet is open, if any.
   *
   * Categories and seasons used to be two separate pieces of state driving two
   * inline rails that behaved differently — the season one even had a "Poista
   * suodatin" link that emptied the section rather than narrowing it. One
   * state, one sheet, one way to close it.
   */
  const [sheet, setSheet] = useState<
    | { kind: 'category'; key: ProgramCategoryKey }
    // The tile's own label travels with the block, so tapping "Syksy" opens a
    // sheet that says Syksy rather than one that says Talvi.
    | { kind: 'season'; season: ProgramSeason; labelKey: I18nKey }
    | null
  >(null);
  // The goal sheet: which lift, and the number being typed.
  const [goalLift, setGoalLift] = useState<{ name: string; label: string; bestKg: number } | null>(null);
  const [goalTarget, setGoalTarget] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  // Where the season rows begin, measured rather than guessed — a hero CTA
  // that says "Open the season" has to actually arrive there.

  /**
   * Every campaign slide and season tile goes somewhere real.
   *
   * Handled here rather than in App: three of the four targets are this
   * screen's own state, and routing them up only to have them come back as
   * props would make the filter forget itself on every navigation.
   */
  const handleCampaignTarget = (target: CampaignTarget) => {
    switch (target.kind) {
      case 'category':
        setSheet({ kind: 'category', key: target.category });
        break;
      case 'create':
        setCreateOpen(true);
        break;
      case 'library':
        onOpenLibrary();
        break;
      case 'season':
        setSheet({
          kind: 'season',
          season: target.season,
          labelKey:
            target.season === 'winter' ? 'programs.seasonTile.winter' : 'programs.seasonTile.summer',
        });
        break;
    }
  };

  const pickedStyle = picked ? COVER_STYLES[picked.coverIndex % COVER_STYLES.length] : null;

  // The open sheet's contents, drawn from the same sources the tiles count.
  const sheetCategory = sheet?.kind === 'category' ? PROGRAM_CATEGORIES.find((entry) => entry.key === sheet.key) : null;
  const sheetItems =
    sheet === null
      ? []
      : sheet.kind === 'category'
        ? catalogItems.filter((item) => categoryMembers[sheet.key]?.includes(item.id))
        : (seasonRows.find((row) => row.season === sheet.season)?.items ?? []);

  return (
    <View style={styles.screenBackground}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* The active program used to lead this screen: a 320px photo hero,
            the whole week as rows, and a View-full-plan button. It lives on
            Home now, where the reader already is when they wonder what today
            is. Keeping a copy here would have given the same week two owners,
            and this tab is for finding a program, not for running one. */}
        {/* The rotating hero, at the top of browsing. I cut this from the first
            build arguing the app has no campaigns; the argument was wrong,
            because a campaign slot needs somewhere real to send you rather than
            a marketing department. Every slide opens a set that exists and
            states its size. */}
        <CampaignHero campaigns={campaigns} language={language} onOpen={handleCampaignTarget} />

        {/* Categories as tiles. The first build made these text chips, which
            was a silent substitution rather than a decision: on a row you scan
            instead of read, colour and shape land before a word does, and nine
            identical grey pills are read one at a time. */}
        <View style={styles.sectionHeadRow}>
          <Text style={styles.sectionEyebrow}>{t(language, 'programs.browse')}</Text>
          <Pressable onPress={onViewAllPrograms} hitSlop={8}>
            <Text style={styles.sectionLink}>{t(language, 'programs.viewAll')}</Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tileRow}
          style={styles.exploreScroll}
        >
          {PROGRAM_CATEGORIES.map((entry) => {
            return (
              <Pressable
                key={entry.key}
                accessibilityRole="button"
                accessibilityLabel={`${t(language, entry.labelKey)}, ${categoryCounts[entry.key]}`}
                onPress={() => setSheet({ kind: 'category', key: entry.key })}
                style={({ pressed }) => [styles.catTileWrap, pressed && styles.pressed]}
              >
                <View
                  style={[
                    styles.catTile,
                    { backgroundColor: entry.tint.bg, borderColor: entry.tint.border },
                  ]}
                >
                  <Svg width={30} height={30} viewBox="0 0 24 24" fill="none">
                    <Path
                      d={entry.icon}
                      stroke={entry.tint.ink}
                      strokeWidth={1.9}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                  <View style={[styles.catTileCount, { backgroundColor: entry.tint.ink }]}>
                    <Text style={styles.catTileCountText}>{categoryCounts[entry.key]}</Text>
                  </View>
                </View>
                <Text style={styles.catTileLabel} numberOfLines={2}>
                  {t(language, entry.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* The rail that used to live here is a sheet now. Nine categories
            sharing one horizontal rail gave every one of them the same
            eight-card shape, no way to narrow further, and nowhere to say what
            the category is FOR or what level its programs are. */}

        {/* Pick up where you left off — built from logged sessions, so it is
            empty on a fresh install and the row simply is not there. */}
        {continueItems.length > 0 ? (
          <View>
            <Text style={styles.sectionEyebrowStandalone}>{t(language, 'programs.continue')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.exploreRow}
              style={styles.exploreScroll}
            >
              {continueItems.map((item) => {
                const style = COVER_STYLES[item.coverIndex % COVER_STYLES.length];
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={t(language, 'programs.switchTo', { name: item.name })}
                    onPress={() => setPicked(item)}
                    style={({ pressed }) => [styles.continueCard, pressed && styles.pressed]}
                  >
                    <ProgramCover
                      style={style}
                      goal={item.goal}
                      days={item.days}
                      name={item.name}
                      fingerprint={item.fingerprint}
                      language={language}
                      width={252}
                      height={92}
                      compact
                    />
                    <View style={styles.continueBody}>
                      <View style={styles.continueCopy}>
                        <Text style={styles.continueWhen}>
                          {item.daysSince === 0
                            ? t(language, 'programs.continue.today')
                            : item.daysSince === 1
                              ? t(language, 'programs.continue.yesterday')
                              : t(language, 'programs.continue.days', { count: item.daysSince })}
                        </Text>
                        <Text style={styles.continueMeta} numberOfLines={1}>
                          {t(language, 'programs.continue.sessions', { count: item.sessionCount })}
                        </Text>
                      </View>
                      <View style={styles.continuePlay}>
                        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                          <Path d="M7 4.5v15l13-7.5z" fill={theme.onHighlight} />
                        </Svg>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

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

        {/* Four season tiles over two blocks. The reference asks for four and
            the catalog has two; the month range on each tile makes the mapping
            visible instead of inventing two empty seasons to fill the row. */}
        {/* "Poista suodatin" used to sit here, and it did not remove a
            filter — with nothing selected the section has no rail at all, so
            the link read as "remove the seasons". The tile opens a sheet now
            and the sheet closes itself. */}
        <Text style={styles.sectionEyebrowStandalone}>{t(language, 'programs.seasons')}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tileRow}
          style={styles.exploreScroll}
        >
          {orderSeasonTiles().map((tile) => {
            const gid = `season-${tile.key}`;
            const isNow = tile.key === currentSeasonTile();
            return (
              <Pressable
                key={tile.key}
                accessibilityRole="button"
                accessibilityLabel={t(language, tile.labelKey)}
                onPress={() => setSheet({ kind: 'season', season: tile.block, labelKey: tile.labelKey })}
                style={({ pressed }) => [styles.seasonTile, pressed && styles.pressed]}
              >
                <Svg width={168} height={150} style={StyleSheet.absoluteFill}>
                  <Defs>
                    <SvgLinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
                      <Stop offset="0" stopColor={tile.gradient[0]} />
                      <Stop offset="1" stopColor={tile.gradient[1]} />
                    </SvgLinearGradient>
                  </Defs>
                  <Rect x="0" y="0" width={168} height={150} rx={20} fill={`url(#${gid})`} />
                  <Svg x={92} y={58} width={104} height={104} viewBox="0 0 24 24">
                    <Path
                      d={LAYERS_MOTIF}
                      stroke="#FFFFFF"
                      strokeOpacity={0.2}
                      strokeWidth={1.4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </Svg>
                </Svg>
                {isNow ? (
                  <View style={styles.seasonNowPill}>
                    <Text style={styles.seasonNowText}>{t(language, 'programs.seasonTile.now')}</Text>
                  </View>
                ) : null}
                <View style={styles.seasonTileBody}>
                  <Text style={styles.seasonTileMonths}>{t(language, tile.monthsKey)}</Text>
                  <Text style={styles.seasonTileLabel}>{t(language, tile.labelKey)}</Text>
                  <Text style={styles.seasonTileCount}>
                    {t(language, 'programs.season.count', { count: seasonTileCounts[tile.block] ?? 0 })}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* "For you" leads the browse: it is the only row that knows who is
            reading it, and every card can say why it is there. */}
        {recommendations.length > 0 ? (
          <View>
            <View style={styles.sectionHeadRow}>
              <Text style={styles.sectionEyebrow}>{t(language, 'programs.forYou')}</Text>
            </View>
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
                    style={({ pressed }) => [styles.recCard, pressed && styles.pressed]}
                  >
                    <ProgramCover
                      style={style}
                      goal={item.goal}
                      days={item.days}
                      name={item.name}
                      fingerprint={item.fingerprint}
                      language={language}
                      width={186}
                      height={104}
                      compact
                    />
                    <View style={styles.recBody}>
                      {/* What the training IS comes first. The card used to
                          carry only the reason — "Sama tavoite, eri jako" —
                          which describes this card's relationship to another
                          program and tells the reader nothing about the
                          training they would be doing. */}
                      <Text style={styles.exploreBlurb} numberOfLines={3}>
                        {item.blurb}
                      </Text>
                      <Text style={styles.exploreMeta}>
                        {t(language, 'programs.card.days', { count: item.days })} · ~{item.minutes} min
                        {item.weeks > 0 ? ` · ${t(language, 'programs.weeks', { count: item.weeks })}` : ''}
                      </Text>
                      {/* And the reason stays, as one short line with the
                          number in it rather than a sentence. */}
                      <Text style={styles.forYouWhy} numberOfLines={2}>
                        {`★ ${item.why}`}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* The old "Vaihda ohjelmaa" rail lived here: the whole 55-program
            catalog, always open, in the same card size as four other rows. It
            is gone because the tiles above now are the way in, and a rail that
            is always there makes a menu above it look decorative. */}

        {trendingItems && trendingItems.length > 0 ? (
          <View>
            <View style={styles.sectionHeadRow}>
              <Text style={styles.sectionEyebrow}>{t(language, 'programs.trending')}</Text>
              <Pressable onPress={onViewAllPrograms} hitSlop={8}>
                <Text style={styles.sectionLink}>{t(language, 'programs.trending.all')}</Text>
              </Pressable>
            </View>
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
                  <RankMedal index={index} />
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
        {/* The only "new program" entry on the page now. It opens the sheet
            rather than the editor, so removing the duplicate button at the top
            did not remove the AI and CSV routes with it. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'programs.create')}
          onPress={() => setCreateOpen(true)}
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
                      {t(language, 'programs.switchSheet.meta', {
                        days: picked.days,
                        minutes: picked.minutes,
                        goal: picked.goal,
                      })}
                    </Text>
                  </View>
                </View>
                {/* This sheet shipped in English inside a Finnish screen, with
                    an "or 'program'" fallback that named nothing. */}
                <Text style={styles.sheetExplainer}>
                  {activeProgramTitle
                    ? t(language, 'programs.switchSheet.body', { name: activeProgramTitle })
                    : t(language, 'programs.switchSheet.bodyNoActive')}
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

      <ProgramSheet
        visible={sheet !== null}
        onClose={() => setSheet(null)}
        language={language}
        title={
          sheet === null
            ? ''
            : sheet.kind === 'category'
              ? t(language, sheetCategory?.labelKey ?? 'programs.cat.strength')
              : t(language, sheet.labelKey)
        }
        focus={
          sheet === null
            ? ''
            : sheet.kind === 'category'
              ? t(language, sheetCategory?.focusKey ?? 'programs.catFocus.strength')
              : t(
                  language,
                  sheet.season === 'winter'
                    ? 'programs.seasonFocus.winter'
                    : 'programs.seasonFocus.summer',
                )
        }
        tint={
          sheet?.kind === 'category' && sheetCategory
            ? sheetCategory.tint
            : sheet?.kind === 'season' && sheet.season === 'winter'
              ? SEASON_SHEET_TINTS.winter
              : SEASON_SHEET_TINTS.summer
        }
        icon={sheet?.kind === 'category' && sheetCategory ? sheetCategory.icon : LAYERS_MOTIF}
        items={sheetItems}
        onPick={(item) => {
          setSheet(null);
          setPicked(item);
        }}
        onViewAll={() => {
          setSheet(null);
          onViewAllPrograms();
        }}
      />

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
  pressed: {
    transform: [{ scale: 0.96 }],
  },
  pressedRow: {
    opacity: 0.7,
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
    gap: 13,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  trendingRowDivider: {
    borderTopWidth: 1,
    borderTopColor: theme.purpleLight,
  },
  trendingRank: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.purpleLight,
  },
  trendingMedal: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendingMedalText: {
    position: 'absolute',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  trendingRankText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: theme.purple,
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
    fontSize: 11.5,
    fontWeight: '800',
    lineHeight: 15,
    color: theme.purple,
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
  // ── Rotating campaign hero ───────────────────────────────────────────
  campaignBlock: {
    marginTop: 22,
  },
  campaignScroll: {
    flexGrow: 0,
  },
  campaignSlide: {
    height: CAMPAIGN_H,
    paddingHorizontal: 22,
    // Centred, not top-aligned. Titles run one line or two depending on the
    // slide, and a fixed top padding left a one-line slide with a third of the
    // card empty under its own button.
    justifyContent: 'center',
  },
  campaignKicker: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  campaignTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 8,
    paddingRight: 90,
  },
  campaignBody: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
    paddingRight: 84,
  },
  campaignCta: {
    alignSelf: 'flex-start',
    marginTop: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  campaignCtaText: {
    color: '#191036',
    fontSize: 12.5,
    lineHeight: 15,
    fontWeight: '800',
  },
  campaignFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginTop: 10,
    minHeight: 26,
  },
  campaignDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  campaignDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.border,
  },
  campaignDotOn: {
    width: 18,
    backgroundColor: theme.purple,
  },
  campaignPause: {
    position: 'absolute',
    right: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  // ── Category tiles ───────────────────────────────────────────────────
  tileRow: {
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  catTileWrap: {
    width: 78,
    alignItems: 'center',
  },
  catTile: {
    width: 70,
    height: 70,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catTileCount: {
    position: 'absolute',
    top: -5,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catTileCountText: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  catTileLabel: {
    marginTop: 7,
    color: theme.muted,
    fontSize: 11.5,
    lineHeight: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  // ── Continue cards (252 × 92 cover) ──────────────────────────────────
  continueCard: {
    width: 252,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    overflow: 'hidden',
  },
  continueBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  continueCopy: {
    flex: 1,
  },
  continueWhen: {
    color: theme.ink,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
  },
  continueMeta: {
    color: theme.muted,
    fontSize: 11.5,
    lineHeight: 15,
    marginTop: 2,
  },
  continuePlay: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.highlight,
  },
  // ── Recommendation cards (158 × 104 cover) ───────────────────────────
  recCard: {
    width: 186,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    overflow: 'hidden',
  },
  recBody: {
    paddingHorizontal: 11,
    paddingVertical: 10,
    gap: 6,
  },
  // ── Season tiles (168 × 150) ─────────────────────────────────────────
  seasonTile: {
    width: 168,
    height: 150,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  seasonTileBody: {
    padding: 14,
  },
  seasonTileMonths: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  seasonTileLabel: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginTop: 3,
  },
  seasonTileCount: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 11.5,
    lineHeight: 15,
    marginTop: 2,
  },
  seasonNowPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  seasonNowText: {
    color: '#191036',
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 1,
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
  // Size comes from props now — three card sizes on the page instead of one.
  cover: {
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
  // A 21px title on a 104px cover eats the card; the small covers get their
  // own scale rather than the same one shrunk by luck.
  coverNameCompact: {
    fontSize: 14.5,
    lineHeight: 17,
    left: 11,
    right: 11,
    bottom: 9,
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
    color: theme.muted,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '700',
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
  // ── Category / season sheet ──────────────────────────────────────────
  catSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: theme.surface,
    paddingTop: 10,
  },
  catSheetHead: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  catSheetIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catSheetCopy: {
    flex: 1,
    minWidth: 0,
  },
  catSheetTitle: {
    color: theme.ink,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  catSheetFocus: {
    color: theme.muted,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 1,
  },
  levelScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  levelRow: {
    gap: 8,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  levelChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  levelChipText: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },
  levelChipTextOn: {
    color: '#FFFFFF',
  },
  catSheetList: {
    flex: 1,
    minHeight: 0,
  },
  catSheetListInner: {
    paddingHorizontal: 18,
    // Clears the pinned CTA below.
    paddingBottom: 108,
    gap: 10,
  },
  catSheetEmpty: {
    color: theme.muted,
    fontSize: 13,
    lineHeight: 18,
    paddingVertical: 24,
    textAlign: 'center',
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  sheetRowCopy: {
    flex: 1,
    minWidth: 0,
  },
  sheetRowTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sheetRowName: {
    flexShrink: 1,
    color: theme.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  levelBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  levelBadgeText: {
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sheetRowBlurb: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    marginTop: 3,
  },
  catSheetCta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.surface,
    paddingHorizontal: 18,
    paddingTop: 12,
    // Clears the gesture bar: the sheet's bottom IS the screen's bottom, so
    // the button's own padding is the only thing keeping it reachable.
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: theme.border,
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
