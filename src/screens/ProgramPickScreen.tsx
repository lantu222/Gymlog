import React from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Pattern, Polygon, Rect, Stop } from 'react-native-svg';

import { HG } from '../lightTheme';
import { HG_DARK } from '../darkTheme';
import { darkTheme, Theme, useTheme, useThemeName } from '../theming';
import { PROGRAM_FOCUS_COLORS, ProgramFocusSegment,
  getProgramFocusQualityLabel,
} from '../lib/programFocusSplit';
import { t } from '../lib/i18n';
import { AppLanguage } from '../types/models';

/**
 * "Pick your program", from design 08b variant D (`coverfixed`).
 *
 * Two programs own the whole screen, divided by one diagonal seam. The chosen
 * half swells (64/58 → 44/36 of the height) so the choice is felt rather than
 * just checked, and the other collapses to its name and key numbers. The CTA is
 * pinned at the bottom on every selection — the design's own argument is that
 * it must never move, because it does not move anywhere else in onboarding.
 *
 * React Native has no `clip-path`, so the seam is drawn: each half's background
 * is an SVG polygon in a 0–100 viewBox with `preserveAspectRatio="none"`, which
 * scales the shape to whatever the phone gives us. The content then sits inside
 * the rectangle that is safely clear of the slant, which is the same thing the
 * design's `safe` height was doing.
 */

const SEAM_PCT = 1.2;
/** Selected-half seam ends, as fractions of the height: [left edge, right edge]. */
const CUT_TOP: [number, number] = [0.64, 0.58];
const CUT_BOTTOM: [number, number] = [0.44, 0.36];
/**
 * Room the pinned CTA needs at the foot of the screen: the 52pt pill, its
 * bottom padding and a gap, so the last line of the chosen card never runs
 * under it.
 */
// 116 put "KATSO VIIKKO" right against the pill when the lower programme was
// the selected one — its block bottom-aligns into this gap (user, 2026-08-19).
const CTA_ROOM = 140;

export interface ProgramPickOption {
  id: string;
  title: string;
  subtitle: string;
  days: number;
  mins: number;
  weeks: number;
  totalWorkouts: number;
  recommended: boolean;
  focus: ProgramFocusSegment[];
}

export interface ProgramPickScreenProps {
  language?: AppLanguage;
  title: string;
  meta: string;
  options: ProgramPickOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  ctaLabel: string;
  onContinue: () => void;
  /**
   * The composed-week preview. Not in the design — the design replaced a screen
   * that had it, and losing the one place the user can see which days they
   * actually get would be a silent subtraction. It rides as a text link under
   * the selected card, in the same treatment as "tap to choose".
   */
  onOpenWeek?: () => void;
  weekLinkLabel?: string;
  /**
   * Which way the top of the screen is painted, so the shell can pick
   * status-bar icons that are visible against it.
   */
  onTopToneChange?: (tone: 'light' | 'dark') => void;
  busy?: boolean;
}

function FocusBar({ focus, light, language }: { focus: ProgramFocusSegment[]; light: boolean; language: AppLanguage }) {
  const styles = stylesFor(useTheme());
  if (focus.length === 0) {
    return null;
  }
  return (
    <View>
      <Text style={[styles.splitLabel, light && styles.splitLabelLight]}>
        {t(language, 'onb.pick.whereWeekGoes')}
      </Text>
      <View style={styles.splitTrack}>
        {focus.map((segment) => (
          <View
            key={segment.quality}
            style={{ flex: segment.pct, backgroundColor: PROGRAM_FOCUS_COLORS[segment.quality], borderRadius: 2 }}
          />
        ))}
      </View>
      <View style={styles.splitLegend}>
        {focus.map((segment) => (
          <View key={segment.quality} style={styles.splitLegendItem}>
            <View style={[styles.splitDot, { backgroundColor: PROGRAM_FOCUS_COLORS[segment.quality] }]} />
            <Text style={[styles.splitLegendText, light && styles.splitLegendTextLight]}>
              {/* getProgramFocusQualityLabel exists and had no caller: the
                  quality is an English identifier, and printing it put
                  "Strength 97% · Conditioning 3%" on the plan-ready screen. */}
              {getProgramFocusQualityLabel(segment.quality, language)}{' '}
              <Text style={[styles.splitPct, light && styles.splitPctLight]}>{segment.pct}%</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Check({ selected }: { selected: boolean }) {
  const theme = useTheme();
  const styles = stylesFor(theme);
  return (
    <View style={[styles.check, selected ? styles.checkOn : styles.checkOff]}>
      {selected ? (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={paletteFor(theme).purple} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M5 12l5 5L19 7" />
        </Svg>
      ) : null}
    </View>
  );
}

/**
 * The diagonal cover. Striped fill plus a scrim, both inside the polygon, so
 * the seam is one shape rather than a stack of clipped rectangles.
 */
function HalfCover({ points, light, id }: { points: string; light: boolean; id: string }) {
  // `light` means "this is the chosen, purple half" — not the theme. The
  // purple is the same in both themes; it is the OTHER half that has to
  // follow the theme, and painting it white on a dark run is what put a
  // white slab under the purple one (user 2026-08-24).
  const C = paletteFor(useTheme());
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
      <Defs>
        <Pattern id={`stripe-${id}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <Rect width="4" height="4" fill={light ? '#6D28D9' : C.quietStripe} />
          <Rect width="2" height="4" fill={light ? '#7C3AED' : C.quietStripeAlt} />
        </Pattern>
        <SvgLinearGradient id={`scrim-${id}`} x1="0" y1="0" x2="0.45" y2="1">
          <Stop offset="0" stopColor={light ? '#5B21B6' : C.quietScrim} stopOpacity={light ? 0.55 : 0.6} />
          <Stop offset="1" stopColor={light ? '#5B21B6' : C.quietScrim} stopOpacity={light ? 0.92 : 0.93} />
        </SvgLinearGradient>
      </Defs>
      <Polygon points={points} fill={`url(#stripe-${id})`} />
      <Polygon points={points} fill={`url(#scrim-${id})`} />
    </Svg>
  );
}

export function ProgramPickScreen({
  language = 'en',
  title,
  meta,
  options,
  selectedId,
  onSelect,
  ctaLabel,
  onContinue,
  onOpenWeek,
  weekLinkLabel,
  onTopToneChange,
  busy = false,
}: ProgramPickScreenProps) {
  const theme = useTheme();
  const styles = stylesFor(theme);
  // Full-bleed: the diagonal runs to the top edge, so the shell hands the
  // status-bar strip back and the screen insets its own copy instead.
  const insets = useSafeAreaInsets();
  const [height, setHeight] = React.useState(0);
  const top = options[0] ?? null;
  const bottom = options[1] ?? null;
  const topSelected = top !== null && selectedId === top.id;

  const [l, r] = topSelected ? CUT_TOP : CUT_BOTTOM;
  const topPoints = `0,0 100,0 100,${r * 100} 0,${l * 100}`;
  const bottomPoints = `0,${l * 100 + SEAM_PCT} 100,${r * 100 + SEAM_PCT} 100,100 0,100`;
  // Rectangles that stay clear of the slant, so no line of type lands in the
  // slanted corner. Same intent as the design's `safe`.
  const topSafePct = Math.min(l, r) * 100 - 3;
  const bottomSafePct = 100 - Math.max(l, r) * 100 - 4;
  // Every pixel belongs to one half or the other; the split is the seam's
  // midpoint, so a tap can never be ambiguous.
  const seamMidPct = ((l + r) / 2) * 100;

  // The tone of what sits UNDER the status bar. That used to be whichever
  // half was selected; it is the title band now, so it follows the theme and
  // stops flipping every time the reader taps the other programme.
  const themeName = useThemeName();
  React.useEffect(() => {
    onTopToneChange?.(themeName === 'dark' ? 'dark' : 'light');
  }, [onTopToneChange, themeName]);

  const onLayout = (event: LayoutChangeEvent) => setHeight(event.nativeEvent.layout.height);

  const renderHalf = (option: ProgramPickOption | null, isTop: boolean) => {
    if (!option) {
      return null;
    }
    const selected = selectedId === option.id;
    const light = selected;
    return (
      <View
        pointerEvents="box-none"
        style={[
          styles.halfContent,
          isTop
            ? {
                top: 0,
                height: `${topSafePct}%`,
                justifyContent: selected ? 'flex-start' : 'center',
                // Was `insets.top + 78`, reserving room for the title that used
                // to float over this half. The title has its own band now, and
                // the split starts below it, so the inset is already spent.
                paddingTop: 18,
              }
            : {
                // Anchored to its TOP edge, not sized from the bottom. As
                // `bottom: CTA_ROOM` + `height: N%`, the box was lifted by the
                // CTA's 116pt on top of the safe fraction — so its top sat
                // 116pt above the seam and the second programme's title landed
                // under the recommended card's slant, hard to read (reported
                // 2026-08-18). Top-anchoring keeps the safe rectangle safe and
                // lets CTA_ROOM only trim the bottom.
                top: `${100 - bottomSafePct}%`,
                bottom: CTA_ROOM,
                justifyContent: selected ? 'flex-end' : 'center',
              },
        ]}
      >
        {/* Everything except the week link ignores touches outright, so the
            WHOLE half is the tap target. The old pass-through relied on plain
            Views not being targets, and it was not true of all of them —
            selection only registered from certain spots (user 2026-08-23).
            The week link renders after this block, interactive. */}
        <View pointerEvents="none">
          <View style={styles.halfHead}>
            <View style={styles.halfHeadCopy}>
              {option.recommended ? (
                <View style={[styles.badge, light ? styles.badgeLight : styles.badgeDark]}>
                  <Text style={[styles.badgeText, light ? styles.badgeTextLight : styles.badgeTextDark]}>
                    {t(language, 'onb.pick.recommended')}
                  </Text>
                </View>
              ) : null}
              {/* No description sentence under the name any more (user
                  2026-08-23, "tyhmää geneeristä ai tekstiä"): the name, the
                  numbers and the focus bar are the card. */}
              <Text style={[styles.name, selected && styles.nameSelected, light && styles.textLight]} numberOfLines={2}>
                {option.title}
              </Text>
            </View>
            <Check selected={selected} />
          </View>

          {selected ? (
            <>
              <View style={styles.statRow}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{t(language, 'onb.pick.daysValue', { count: option.days })}</Text>
                  <Text style={styles.statLabel}>{t(language, 'onb.pick.perWeek')}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{t(language, 'onb.pick.minsValue', { count: option.mins })}</Text>
                  <Text style={styles.statLabel}>{t(language, 'onb.pick.perSession')}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{t(language, 'onb.pick.weeksValue', { count: option.weeks })}</Text>
                  <Text style={styles.statLabel}>
                    {t(language, 'onb.pick.workoutsValue', { count: option.totalWorkouts })}
                  </Text>
                </View>
              </View>
              <View style={styles.splitWrap}>
                <FocusBar focus={option.focus} light language={language} />
              </View>
            </>
          ) : (
            <Text style={styles.compactStats}>
              {[
                t(language, 'onb.pick.daysValue', { count: option.days }),
                t(language, 'onb.pick.minsValue', { count: option.mins }),
                t(language, 'onb.pick.weeksValue', { count: option.weeks }),
                t(language, 'onb.pick.workoutsValue', { count: option.totalWorkouts }),
              ].join('  ·  ')}
            </Text>
          )}
        </View>
        {selected && onOpenWeek && weekLinkLabel ? (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={onOpenWeek} style={styles.weekLink}>
            <Text style={styles.weekLinkText}>{weekLinkLabel}</Text>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M5 12h13M12 5l7 7-7 7" />
            </Svg>
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      {/* The title is its own band, above the split (user 2026-08-24: "voisiko
          ohjelmasi on valmis otsikko jäädä omana osanaan").

          It used to lie ON the top half and flip white when that half was
          selected, which is three of the reports at once: it vanished on the
          light card, it could not follow the theme, and the screen read as
          "too white". A band with its own surface cannot disappear behind
          either choice, because it is not on either of them. */}
      <View style={[styles.titleBand, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      </View>

      <View style={styles.split} onLayout={onLayout}>
      {top ? <HalfCover points={topPoints} light={topSelected} id="top" /> : null}
      {bottom ? <HalfCover points={bottomPoints} light={!topSelected} id="bottom" /> : null}

      {/* Touch targets first, content on top of them. */}
      {top ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: topSelected }}
          accessibilityLabel={top.title}
          onPress={() => onSelect(top.id)}
          style={[styles.hit, { top: 0, height: height > 0 ? (height * seamMidPct) / 100 : '58%' }]}
        />
      ) : null}
      {bottom ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: !topSelected }}
          accessibilityLabel={bottom.title}
          onPress={() => onSelect(bottom.id)}
          style={[styles.hit, { top: height > 0 ? (height * seamMidPct) / 100 : '58%', bottom: 0 }]}
        />
      ) : null}

      {renderHalf(top, true)}
      {renderHalf(bottom, false)}

      {/* Pinned, always. It takes the selected card's contrast so it reads as
          the same surface the choice was made on. */}
      <View style={[styles.ctaWrap, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          disabled={busy}
          onPress={onContinue}
          style={({ pressed }) => [
            styles.cta,
            topSelected ? styles.ctaOnPurple : styles.ctaOnWhite,
            pressed && styles.pressed,
            busy && styles.ctaBusy,
          ]}
        >
          <Text style={[styles.ctaText, topSelected ? styles.ctaTextOnPurple : styles.ctaTextOnWhite]}>
            {ctaLabel}
          </Text>
          <Svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke={topSelected ? '#FFFFFF' : paletteFor(theme).purpleDark}
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M5 12h13M12 5l7 7-7 7" />
          </Svg>
        </Pressable>
      </View>
      </View>
    </View>
  );
}

const PAD = 22;

/**
 * The last screen of onboarding, in two palettes.
 *
 * The selected half is purple in both themes — that is the whole diagonal
 * device and it does not need a dark version. What did need one is the
 * *unselected* half, which was painted white: on a dark run the screen came
 * out purple over a white slab, reported from the phone 2026-08-24.
 *
 * Light values are the originals, same rule as the other onboarding screens.
 */
interface PickPalette {
  bg: string;
  ink: string;
  muted: string;
  faint: string;
  border: string;
  purple: string;
  purpleDark: string;
  purpleLight: string;
  /** The quiet half's diagonal fill: two stripe tones and the scrim over them. */
  quietStripe: string;
  quietStripeAlt: string;
  quietScrim: string;
}

const PICK_LIGHT: PickPalette = {
  bg: HG.bg,
  ink: HG.ink,
  muted: HG.muted,
  faint: HG.faint,
  border: HG.border,
  purple: HG.purple,
  purpleDark: HG.purpleDark,
  purpleLight: HG.purpleLight,
  quietStripe: '#E9E1F8',
  quietStripeAlt: '#DCD1F2',
  quietScrim: '#FFFFFF',
};

const PICK_DARK: PickPalette = {
  bg: HG_DARK.bg,
  ink: HG_DARK.ink,
  muted: HG_DARK.muted,
  faint: HG_DARK.faint,
  border: HG_DARK.border,
  purple: HG_DARK.purple,
  purpleDark: HG_DARK.purpleBright,
  purpleLight: HG_DARK.purpleLight,
  quietStripe: HG_DARK.surfaceSoft,
  quietStripeAlt: HG_DARK.surface,
  quietScrim: HG_DARK.bg,
};

const paletteFor = (theme: Theme): PickPalette => (theme === darkTheme ? PICK_DARK : PICK_LIGHT);
/** Forward reference: the two sheets are built at the foot of the file. */
const stylesFor = (theme: Theme) => (theme === darkTheme ? PICK_STYLES.dark : PICK_STYLES.light);

const makePickStyles = (C: PickPalette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, overflow: 'hidden' },
  hit: { position: 'absolute', left: 0, right: 0 },
  halfContent: { position: 'absolute', left: 0, right: 0, paddingHorizontal: PAD },

  /**
   * The band's own surface, not the screen's: it has to stay legible whichever
   * half is selected, which is the whole reason it stopped being an overlay.
   */
  titleBand: { backgroundColor: C.bg, paddingHorizontal: PAD, paddingBottom: 14 },
  split: { flex: 1, overflow: 'hidden' },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.65, color: C.ink },
  meta: { fontSize: 12.5, fontWeight: '600', marginTop: 4, color: C.muted },
  textLight: { color: '#FFFFFF' },

  halfHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  halfHeadCopy: { flex: 1, minWidth: 0 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, marginBottom: 8 },
  badgeLight: { backgroundColor: 'rgba(255,255,255,0.2)' },
  badgeDark: { backgroundColor: C.purpleLight },
  badgeText: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.3 },
  badgeTextLight: { color: '#FFFFFF' },
  badgeTextDark: { color: C.purpleDark },
  // Bigger since 2026-08-23 ("vain isolla ohjelman nimi") — the description
  // sentence under it is gone, so the name carries the card.
  name: { fontSize: 26, fontWeight: '800', letterSpacing: -0.65, lineHeight: 28, color: C.ink },
  nameSelected: { fontSize: 34, lineHeight: 36, letterSpacing: -0.85 },

  statRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.24)',
  },
  stat: { flex: 1 },
  statValue: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.44, lineHeight: 24 },
  statLabel: { fontSize: 10.5, fontWeight: '700', color: 'rgba(255,255,255,0.72)', marginTop: 2 },

  splitWrap: { marginTop: 14 },
  splitLabel: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.15, color: C.faint, marginBottom: 7 },
  splitLabelLight: { color: 'rgba(255,255,255,0.7)' },
  splitTrack: { flexDirection: 'row', height: 7, gap: 2, borderRadius: 999, overflow: 'hidden' },
  splitLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 13, marginTop: 8 },
  splitLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  splitDot: { width: 8, height: 8, borderRadius: 2 },
  splitLegendText: { fontSize: 11, fontWeight: '700', color: C.muted },
  splitLegendTextLight: { color: 'rgba(255,255,255,0.85)' },
  splitPct: { fontWeight: '800', color: C.ink },
  splitPctLight: { color: '#FFFFFF' },

  weekLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  weekLinkText: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.9, color: '#FFFFFF', textTransform: 'uppercase' },

  compactStats: { fontSize: 12.5, fontWeight: '700', color: C.muted, marginTop: 12 },

  check: { width: 28, height: 28, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: '#FFFFFF' },
  checkOff: { borderWidth: 2, borderColor: C.border },

  ctaWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: PAD },
  cta: {
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaOnPurple: {
    backgroundColor: C.purple,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.34,
    shadowRadius: 28,
    elevation: 8,
  },
  ctaOnWhite: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#230A50',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 26,
    elevation: 8,
  },
  ctaBusy: { opacity: 0.6 },
  ctaText: { fontSize: 16.5, fontWeight: '800' },
  ctaTextOnPurple: { color: '#FFFFFF' },
  ctaTextOnWhite: { color: C.purpleDark },
  pressed: { opacity: 0.9 },
});

const PICK_STYLES = {
  light: makePickStyles(PICK_LIGHT),
  dark: makePickStyles(PICK_DARK),
} as const;
