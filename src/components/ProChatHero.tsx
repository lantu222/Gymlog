import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { t } from '../lib/i18n';
import { ProChatChart, ProChatLine, ProChatScript } from '../lib/proChatHero';
import { PW } from '../lightTheme';
import { Theme, useThemedStyles } from '../theming';
import { AppLanguage } from '../types/models';
import { queryReduceMotion } from '../utils/reduceMotion';

/**
 * The Pro page's hero: a short conversation with the coach that types itself
 * out, then rewinds and starts over (design: "Vinha Pro v4 — AI-chat hero").
 *
 * It replaces v3's static headline because the thing being sold is a coach that
 * has read your log, and no sentence describes that as well as watching it
 * happen. The script comes from lib/proChatHero and is built from this reader's
 * own lift — see that file for why a generic demo was not an option.
 *
 * Two departures from the mock, both deliberate:
 *
 *   · The conversation does not end on a lock. The mock closed with "the rest
 *     of this answer is in Pro / 3 of 3 free questions used". The quota line is
 *     simply false for a reader who has not spent theirs, and withholding
 *     inside the hero of a page whose only job is to close puts a second wall
 *     in front of someone who already walked through the first one. The
 *     paywall moments on Home and in the chat withhold, in the place where the
 *     reader actually hit the limit.
 *
 *   · One projected bar, not three. The app computes a single next step.
 *
 *   · No composer. The mock ends the card with a "Message your coach…" pill,
 *     which is a decoration — it takes no focus and opens no keyboard — and it
 *     was the ~58dp that pushed the bottom of this hero under the fold on a
 *     6.4" phone, behind the pinned plan footer. A conversation the reader can
 *     watch already says the coach is something you talk to; an input that
 *     does nothing says it again, below the fold, for the price of the whole
 *     card fitting (user decision, measured on a Galaxy A54).
 *
 * Under reduce motion the whole conversation is shown at once and nothing
 * animates — the content is never the thing the animation is hiding.
 */

type Styles = ReturnType<typeof makeStyles>;

interface ProChatHeroProps {
  script: ProChatScript;
  language: AppLanguage;
}

/**
 * Milliseconds per character while the coach "types".
 *
 * 16 read as a machine dumping text (reported from the phone). 24 is closer to
 * someone composing an answer, which is the impression the hero is for.
 */
const CPS = 24;
/** How long a user bubble sits before the coach starts. */
const USER_BEAT = 950;
/** The coach's thinking dots, before any text appears. */
const THINK = 950;
/** How long a finished answer is left readable. */
const READ_BEAT = 2600;
const READ_BEAT_CHART = 1900;
/** The rewind: fade the thread out, then hold empty before looping. */
const REWIND = 900;
const REST = 500;
/** One tick. 60ms is four characters of typing — smooth enough, cheap enough. */
const TICK = 60;
/** How many bubbles the box holds. The fourth pushes the first out. */
const VISIBLE_BEATS = 3;

const HERO_W = 460;
const HERO_H = 620;

const HERO_INK = '#FFFFFF';
const BADGE_INK = '#241743';
/** The coach speaks on a light card; its ink is fixed to that card, not themed. */
const COACH_SURFACE = '#FBF8FF';
const COACH_INK = '#241743';
const COACH_MUTED = '#6B5B95';
const BAR_HISTORY = '#CFC0F0';

interface Beat {
  line: ProChatLine;
  text: string;
  /** When the bubble appears. */
  show: number;
  /** When characters start landing (coach only). */
  typeStart: number;
  /** When the last character lands. */
  typeEnd: number;
}

interface Timeline {
  beats: Beat[];
  rewindAt: number;
  clearAt: number;
  cycle: number;
}

/**
 * The whole loop is laid out once, and every frame is derived from one clock.
 * A chain of setTimeouts drifts, and each link is a separate thing that can be
 * left running after unmount.
 */
function buildTimeline(beats: Array<{ line: ProChatLine; text: string }>): Timeline {
  const laid: Beat[] = [];
  let at = 0;

  for (const { line, text } of beats) {
    if (line.who === 'user') {
      laid.push({ line, text, show: at, typeStart: at, typeEnd: at });
      at += USER_BEAT;
    } else {
      const typeStart = at + THINK;
      const typeEnd = typeStart + text.length * CPS;
      laid.push({ line, text, show: at, typeStart, typeEnd });
      at = typeEnd + (line.chart ? READ_BEAT_CHART : READ_BEAT);
    }
  }

  const rewindAt = at;
  const clearAt = rewindAt + REWIND;
  return { beats: laid, rewindAt, clearAt, cycle: clearAt + REST };
}

function Bars({ chart, styles }: { chart: ProChatChart; styles: Styles }) {
  const max = Math.max(...chart.bars);
  const min = Math.min(...chart.bars);
  // A floor of 30% keeps the earliest bar visible: a series that only spans
  // 60→95 would otherwise start at zero height and read as missing data.
  const span = Math.max(max - min, 1);
  const historyCount = chart.bars.length - chart.projected;

  return (
    <View style={styles.bars}>
      {chart.bars.map((value, index) => (
        <View
          key={`${index}-${value}`}
          style={[
            styles.bar,
            { height: `${30 + ((value - min) / span) * 70}%` },
            index >= historyCount && styles.barPlan,
          ]}
        />
      ))}
    </View>
  );
}

function Dots({ styles }: { styles: Styles }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, { toValue: 3, duration: 1000, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <View style={styles.dotsBubble}>
      {[0, 1, 2].map((index) => (
        <Animated.View
          key={index}
          style={[
            styles.dot,
            {
              opacity: anim.interpolate({
                // Each dot peaks a third of a beat after the one before it.
                inputRange: [index * 0.5, index * 0.5 + 0.4, index * 0.5 + 0.8, 3],
                outputRange: [0.3, 1, 0.3, 0.3],
                extrapolate: 'clamp',
              }),
            },
          ]}
        />
      ))}
    </View>
  );
}

export function ProChatHero({ script, language }: ProChatHeroProps) {
  const styles = useThemedStyles(makeStyles);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [cycle, setCycle] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(1)).current;

  const timeline = useMemo(
    () =>
      buildTimeline(
        script.lines.map((line) => ({ line, text: t(language, line.key, line.vars) })),
      ),
    [language, script],
  );

  useEffect(() => {
    let cancelled = false;
    void queryReduceMotion().then((enabled) => {
      if (!cancelled) {
        setReduceMotion(enabled);
      }
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      return undefined;
    }
    const started = Date.now();
    const id = setInterval(() => {
      const total = Date.now() - started;
      setElapsed(total % timeline.cycle);
      setCycle(Math.floor(total / timeline.cycle));
    }, TICK);
    return () => clearInterval(id);
  }, [reduceMotion, timeline.cycle]);

  const rewinding = !reduceMotion && elapsed >= timeline.rewindAt;

  // The thread fades as a whole rather than bubble by bubble: one driven value
  // instead of one per message, and the erase reads as a rewind either way.
  useEffect(() => {
    if (reduceMotion) {
      fade.setValue(1);
      return;
    }
    Animated.timing(fade, {
      toValue: rewinding ? 0 : 1,
      duration: rewinding ? REWIND - 150 : 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [fade, reduceMotion, rewinding]);

  /**
   * A rolling window, not the whole transcript.
   *
   * The thread is a fixed box, so the four beats have to fit or `overflow:
   * hidden` cuts one. Showing the last three and letting the oldest fall out
   * is what a chat does anyway, and it is the only version that neither clips
   * a bubble nor leaves the box mostly empty on a tall phone.
   */
  const shown = reduceMotion
    ? timeline.beats
    : timeline.beats.filter((beat) => elapsed >= beat.show && elapsed < timeline.clearAt);
  const visible = reduceMotion ? shown : shown.slice(-VISIBLE_BEATS);

  // One shared pop, replayed whenever a new bubble lands, so the newest message
  // arrives rather than appearing. Per-bubble values would mean N animations
  // running for a hero nobody is looking at directly.
  const count = visible.length;
  useEffect(() => {
    if (reduceMotion || count === 0) {
      return;
    }
    pop.setValue(0);
    Animated.timing(pop, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [count, cycle, pop, reduceMotion]);

  return (
    <View style={styles.hero}>
      <Svg
        style={StyleSheet.absoluteFill}
        width={HERO_W}
        height={HERO_H}
        viewBox={`0 0 ${HERO_W} ${HERO_H}`}
        preserveAspectRatio="none"
      >
        <Defs>
          <SvgLinearGradient id="proChatHeroGradient" x1="0" y1="0" x2="0.42" y2="1">
            <Stop offset="0" stopColor={PW.sheetTop} />
            <Stop offset="0.58" stopColor={PW.sheetMid} />
            <Stop offset="1" stopColor={PW.sheetBottom} />
          </SvgLinearGradient>
        </Defs>
        <Rect width={HERO_W} height={HERO_H} fill="url(#proChatHeroGradient)" />
      </Svg>

      <View style={styles.heroTop}>
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>{t(language, 'pro.page.eyebrow')}</Text>
        </View>
        {/*
          The chip is the whole honesty of this hero. Without a log to draw on
          the conversation runs on sample figures, and the headline directly
          above it promises the reader's own numbers.
        */}
        {script.personal ? null : (
          <View style={styles.exampleChip}>
            <Text style={styles.exampleChipText}>{t(language, 'pro.v4.example')}</Text>
          </View>
        )}
      </View>

      <Text style={styles.heroTitle}>
        {t(language, 'pro.v4.hero.title')}
        {'\n'}
        <Text style={styles.heroTitleAccent}>{t(language, 'pro.v4.hero.titleAccent')}</Text>
      </Text>

      <Animated.View
        style={[styles.thread, { opacity: fade }]}
        accessibilityLabel={timeline.beats.map((beat) => beat.text).join('. ')}
      >
        {visible.map((beat, index) => {
          const mine = beat.line.who === 'user';
          const thinking = !reduceMotion && elapsed < beat.typeStart && !mine;
          const shown = reduceMotion || mine
            ? beat.text
            : beat.text.slice(0, Math.max(0, Math.floor((elapsed - beat.typeStart) / CPS)));
          const settled = reduceMotion || elapsed >= beat.typeEnd;
          const newest = index === visible.length - 1;
          const enter = newest && !reduceMotion
            ? {
                opacity: pop,
                transform: [{ translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [7, 0] }) }],
              }
            : null;

          if (thinking) {
            return (
              <Animated.View key={`${cycle}-${index}`} style={[styles.row, styles.rowCoach, enter]}>
                <Dots styles={styles} />
              </Animated.View>
            );
          }

          return (
            <Animated.View
              key={`${cycle}-${index}`}
              style={[styles.row, mine ? styles.rowUser : styles.rowCoach, enter]}
            >
              <View style={[styles.bubble, mine ? styles.bubbleUser : styles.bubbleCoach]}>
                <Text style={[styles.bubbleText, mine ? styles.bubbleTextUser : styles.bubbleTextCoach]}>
                  {shown}
                </Text>
                {beat.line.chart && settled ? (
                  <>
                    <Bars chart={beat.line.chart} styles={styles} />
                    <View style={styles.legend}>
                      <Text style={styles.legendText}>
                        {/* The lift is named in the conversation directly
                            above; repeating it here cost the legend a second
                            line, and that line cost the card its fit. */}
                        {t(language, 'pro.v4.chart.label', {
                          count: beat.line.chart.sessions,
                        })}
                      </Text>
                      <View style={styles.legendSwatch} />
                      <Text style={styles.legendText}>{t(language, 'pro.v4.chart.plan')}</Text>
                    </View>
                  </>
                ) : null}
              </View>
            </Animated.View>
          );
        })}
      </Animated.View>

    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  hero: {
    borderRadius: 22,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroBadge: {
    backgroundColor: theme.gold,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  heroBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.9,
    color: BADGE_INK,
  },
  exampleChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  exampleChipText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.78)',
  },
  heroTitle: {
    fontSize: 24.5,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 29,
    color: HERO_INK,
    marginTop: 12,
  },
  heroTitleAccent: {
    color: theme.gold,
  },
  thread: {
    /**
     * Fixed, so the page below does not jump as bubbles land and clear — and
     * tall enough that the fullest state (four bubbles, one carrying the
     * chart) fits without `overflow: hidden` guillotining the oldest one
     * mid-word. Measured on a 1080x2400 device in Finnish, which wraps longer
     * than English: 270dp of content, 330 for the wrap that is one line worse.
     *
     * The design faded the top out with a CSS mask instead. RN has no
     * mask-image and no masking library here, and an Svg gradient laid over
     * the top does not work either: the hero gradient runs diagonally, so a
     * single stop colour reads as a grey band rather than a fade (tried, seen
     * on device, reverted). Fitting the content is the honest fix.
     */
    height: 330,
    marginTop: 13,
    /**
     * Bottom-anchored, so the newest bubble always sits at the bottom of the
     * card. A fixed box with a conversation that grows is empty somewhere for
     * the ~1.6s the first question is alone; top-anchoring only moved that
     * emptiness below the last bubble, where it read as a bigger dead slab
     * (both seen on a Galaxy A54). Down here the gap sits under the headline,
     * on the darkest part of the gradient.
     */
    justifyContent: 'flex-end',
    gap: 7,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  rowCoach: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '90%',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 11,
  },
  bubbleUser: {
    maxWidth: '78%',
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderBottomRightRadius: 4,
  },
  bubbleCoach: {
    backgroundColor: COACH_SURFACE,
    borderBottomLeftRadius: 4,
    shadowColor: '#0F0828',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  bubbleText: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  bubbleTextUser: {
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
  },
  bubbleTextCoach: {
    fontWeight: '600',
    color: COACH_INK,
  },
  dotsBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COACH_SURFACE,
    borderRadius: 14,
    borderBottomLeftRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: BADGE_INK,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    // Left-aligned rather than stretched. With a full history the bars fill the
    // row either way; with two logged workouts they used to spread into three
    // wide blocks, which reads as a broken chart rather than a short one — and
    // the reader who sees it is the new one, on their first look at the page.
    justifyContent: 'flex-start',
    gap: 2.5,
    height: 30,
    marginTop: 9,
  },
  bar: {
    flex: 1,
    /**
     * Sparse data should look sparse, not inflated.
     *
     * The cap is set just above what a full series works out to on its own —
     * ~15dp for sixteen bars in this bubble — so it never bites on the case it
     * is not for. At two logged workouts it turns three 89dp slabs into three
     * bars, which is what "not much history yet" should look like.
     */
    maxWidth: 18,
    borderRadius: 2,
    backgroundColor: BAR_HISTORY,
  },
  barPlan: {
    backgroundColor: theme.gold,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    // The lift name is the reader's own and can be long ("Penkkipunnerrus"),
    // so the row wraps instead of pushing "= SUUNNITELMA" out of the bubble —
    // reported from the phone, where it did exactly that.
    flexWrap: 'wrap',
  },
  legendText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: COACH_MUTED,
    flexShrink: 1,
  },
  legendSwatch: {
    width: 7,
    height: 7,
    borderRadius: 2,
    backgroundColor: theme.gold,
  },
});
