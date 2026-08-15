import { SetupDaysPerWeek, UnitPreference } from '../types/models';
import { I18nKey } from './i18n';
import { PremiumHeroChart } from './premiumHeroChart';
import { PLATEAU_STALL_SESSIONS } from './proInsights';

/**
 * The script behind the Pro page's chat hero (design: "Vinha Pro v4").
 *
 * The hero plays a short conversation with the coach and loops. The whole
 * point is that it is *this reader's* conversation: their heaviest-tracked
 * lift, their real working weights, their real weekly frequency. A generic
 * demo with someone else's 92,5 kg would be an ad running inside the app —
 * the headline says "an answer from your numbers", and the numbers underneath
 * it have to be that or the headline is the lie.
 *
 * When the log cannot support it — a fresh install, a lift with two sessions —
 * the same script runs on sample figures and `personal` comes back false. The
 * screen puts an EXAMPLE chip on the hero in that case. Sample data labelled as
 * sample is honest; sample data presented as yours is the seed-data bug this
 * codebase already paid for once.
 *
 * Pure: no React, no storage, no i18n lookups. Lines carry keys and variables,
 * and the screen renders them.
 */

export type ProChatSpeaker = 'user' | 'coach';

export interface ProChatChart {
  /**
   * Working weights in the reader's unit, oldest → newest, with the coach's
   * projected step appended as the final entry.
   */
  bars: number[];
  /**
   * How many trailing bars are plan rather than logged history. Exactly one:
   * the app computes a single next step (latest + the tier's increment), and
   * drawing three would be inventing two of them.
   */
  projected: number;
  /** Sessions of real history behind the chart, excluding the projection. */
  sessions: number;
}

export interface ProChatLine {
  who: ProChatSpeaker;
  key: I18nKey;
  vars?: Record<string, string | number>;
  /** Drawn inside this bubble, under the text. Only ever on a coach line. */
  chart?: ProChatChart;
}

export interface ProChatScript {
  lines: ProChatLine[];
  /** The lift the conversation is about, already display-formatted. */
  liftName: string;
  /** True when every figure came from this reader's own log. */
  personal: boolean;
}

/**
 * The hero is 392pt wide and the bars are 2.5pt apart; past sixteen they stop
 * being readable as a trend and become texture.
 */
export const PRO_CHAT_MAX_BARS = 16;

/** Figures for the unlabelled-as-yours case. Plausible, and never presented as real. */
const EXAMPLE = {
  points: [60, 62.5, 65, 65, 67.5, 70, 70, 72.5, 75, 77.5, 80, 82.5, 85, 87.5, 90, 92.5, 92.5, 92.5],
  latest: 92.5,
  projectedNext: 95,
  daysPerWeek: 2 as SetupDaysPerWeek,
};

/** How many sessions in a row have sat on the current working weight. */
export function countTrailingStall(points: number[]): number {
  if (points.length === 0) {
    return 0;
  }
  const latest = points[points.length - 1];
  let count = 0;
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (points[index] !== latest) {
      break;
    }
    count += 1;
  }
  return count;
}

function buildChart(points: number[], projectedNext: number): ProChatChart {
  // The tail, not the head: the last sixteen sessions are the ones the
  // conversation is about, and an eighteen-month-old first session compresses
  // everything after it into a flat line.
  const history = points.slice(Math.max(0, points.length - (PRO_CHAT_MAX_BARS - 1)));
  return {
    bars: [...history, projectedNext],
    projected: 1,
    sessions: history.length,
  };
}

/**
 * @param heroChart This reader's richest tracked lift, or null when no lift has
 *   two logged working weights yet.
 * @param unitPreference Carried into the lines so the copy can say kg or lb.
 * @param daysPerWeek From onboarding. Null when they never answered, which
 *   swaps the second exchange for one that needs no figure.
 * @param exampleLiftName Passed in already translated, so this stays pure.
 */
export function buildProChatHeroScript(
  heroChart: PremiumHeroChart | null,
  unitPreference: UnitPreference,
  daysPerWeek: SetupDaysPerWeek | null,
  exampleLiftName: string,
): ProChatScript {
  const personal = heroChart !== null;
  const points = heroChart ? heroChart.points : EXAMPLE.points;
  const latest = heroChart ? heroChart.latest : EXAMPLE.latest;
  const projectedNext = heroChart ? heroChart.projectedNext : EXAMPLE.projectedNext;
  const liftName = heroChart ? heroChart.liftName : exampleLiftName;
  // The example carries a frequency of its own so the second exchange is the
  // same shape in both cases — a reader comparing the two should not find the
  // sample richer than their own.
  const days = personal ? daysPerWeek : EXAMPLE.daysPerWeek;

  const stall = countTrailingStall(points);
  const stalled = stall >= PLATEAU_STALL_SESSIONS;
  const chart = buildChart(points, projectedNext);

  const lines: ProChatLine[] = stalled
    ? [
        {
          who: 'user',
          key: 'pro.v4.line.stalled.q',
          vars: { lift: liftName, weight: latest, unit: unitPreference, count: stall },
        },
        {
          who: 'coach',
          key: 'pro.v4.line.stalled.a',
          vars: { weight: latest, unit: unitPreference, next: projectedNext },
          chart,
        },
      ]
    : [
        {
          who: 'user',
          key: 'pro.v4.line.rising.q',
          vars: { lift: liftName },
        },
        {
          who: 'coach',
          key: 'pro.v4.line.rising.a',
          vars: {
            from: points[0],
            to: latest,
            unit: unitPreference,
            sessions: points.length,
            next: projectedNext,
          },
          chart,
        },
      ];

  // The follow-up. It exists to show the coach holding a thread rather than
  // answering one question well — that is the difference between a chatbot and
  // something worth 59,90 a year.
  if (days !== null) {
    lines.push(
      { who: 'user', key: 'pro.v4.line.days.q', vars: { days } },
      { who: 'coach', key: 'pro.v4.line.days.a', vars: { days, lift: liftName } },
    );
  } else {
    lines.push(
      { who: 'user', key: 'pro.v4.line.missed.q' },
      { who: 'coach', key: 'pro.v4.line.missed.a', vars: { lift: liftName } },
    );
  }

  return { lines, liftName, personal };
}
