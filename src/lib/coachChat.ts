import { FatigueResult } from './fatigueModel';
import { exerciseNameLabel } from './exerciseNameLabel';
import { formatShortDate } from './format';
import { t } from './i18n';
import { WeeklyReadRow } from './proInsights';
import { localizeSessionName } from './sessionNameLabel';
import { AICoachTrainingContext } from '../types/aiCoach';
import { AppLanguage } from '../types/models';
import { removeTrailingZeros } from './format';

/**
 * The AI tab's opening state (design: Vinha AI Tab).
 *
 * The design's rule for the middle button is "the door is always open — the
 * quota runs out, not the quality", and the chat has to prove it read the log
 * before the user types anything. Everything here is deterministic: the
 * context strip, the opening line and the Pro "what I noticed" card are
 * computed from logged sets, never from a model call. That keeps the most
 * expensive-looking part of the app free to render.
 */

export type ChipTone = 'plan' | 'warn' | 'alert';

export interface CoachContextChip {
  key: string;
  label: string;
  tone: ChipTone;
}

export interface CoachNoticedItem {
  key: string;
  tone: ChipTone;
  title: string;
  body: string;
  /** The question this item asks on the user's behalf when tapped. */
  question: string;
}

export interface CoachChatIntroInput {
  /** Today's planned session title, already localized. Null on a rest day. */
  todaySessionTitle: string | null;
  sessionsThisWeek: number;
  weeklyRead: WeeklyReadRow[];
  fatigue: FatigueResult | null;
}

export interface CoachContextRow {
  key: 'lastSession' | 'lift' | 'rhythm';
  label: string;
  value: string;
}

/**
 * One slide of the opening ticker. A slide with a `question` is an offer —
 * tapping it asks the coach on the reader's behalf; a slide without one is
 * a fact from the log, read out and left alone.
 */
export interface CoachTickerRow {
  key: string;
  label: string;
  value: string;
  question?: string;
  tone?: ChipTone;
}

/**
 * What the coach can already see, before you type anything.
 *
 * The tab opened onto most of a screen of nothing: the greeting sat at the
 * bottom and the middle was empty. Filling it with an illustration would be
 * noise in the one place there could be proof, so it is filled with the
 * reader's own numbers instead â which is also the claim Pro is sold on.
 *
 * Every row is read from the log. A row whose data does not exist is left out
 * rather than shown empty, so a fresh account gets a short readout or none,
 * and never a made-up one.
 */
export function buildCoachContextReadout(
  context: AICoachTrainingContext,
  language: AppLanguage,
): CoachContextRow[] {
  const rows: CoachContextRow[] = [];

  const session = context.recentCompletedSessions[0];
  if (session) {
    const detail = [
      formatShortDate(session.performedAt, language),
      session.setsCompleted !== null
        ? session.setsCompleted === 1
          ? t(language, 'coachChat.readout.setsOne')
          : t(language, 'coachChat.readout.sets', { count: session.setsCompleted })
        : null,
    ]
      .filter(Boolean)
      .join(' · ');
    rows.push({
      key: 'lastSession',
      label: t(language, 'coachChat.readout.lastSession'),
      // The session's stored name is the catalog's English ("Day 2: Deadlift &
      // Press"); the lift row below already translated its lift, and this row
      // read English beside it. Same treatment History gives the same name.
      value: [localizeSessionName(session.title, language), detail].filter(Boolean).join(' · '),
    });
  }

  const topSet = context.latestTopSets[0];
  if (topSet) {
    // latestReps is every set's reps as a list ("5,5,5,5"). The top set is one
    // set, so the row takes the first rather than printing the whole session.
    const reps = `${topSet.reps}`.split(',')[0]?.trim();
    const name = exerciseNameLabel(language, topSet.exerciseName);
    rows.push({
      key: 'lift',
      label: t(language, 'coachChat.readout.lift'),
      value:
        topSet.weight !== null
          ? `${name} · ${removeTrailingZeros(topSet.weight)} ${context.unitPreference} × ${reps}`
          : `${name} · ${reps}`,
    });
  }

  if (context.sessionsLast30Days > 0) {
    rows.push({
      key: 'rhythm',
      label: t(language, 'coachChat.readout.rhythm'),
      value: t(language, 'coachChat.readout.rhythmValue', {
        week: context.sessionsThisWeek,
        month: context.sessionsLast30Days,
      }),
    });
  }

  return rows;
}

/**
 * The strip above the thread. At most three chips, and each one is a fact:
 * what is planned today, which lift is stuck, whether recovery is running low.
 * An empty strip is correct for a user with no history — better than inventing
 * a status to fill the row.
 */
export function buildCoachContextChips(
  input: CoachChatIntroInput,
  language: AppLanguage,
): CoachContextChip[] {
  const chips: CoachContextChip[] = [];

  if (input.todaySessionTitle) {
    chips.push({
      key: 'today',
      tone: 'plan',
      label: t(language, 'coachChat.chip.today', { session: input.todaySessionTitle }),
    });
  }

  const stalled = input.weeklyRead.find((row) => row.tone === 'amber' && row.key !== 'recovery');
  if (stalled) {
    chips.push({ key: stalled.key, tone: 'warn', label: `${stalled.name} · ${stalled.status}` });
  }

  // Recovery only speaks when the fatigue model is confident — the same rule
  // the weekly read follows, so the two cannot disagree.
  const recovery = input.weeklyRead.find((row) => row.key === 'recovery');
  if (recovery && recovery.tone !== 'green') {
    chips.push({ key: 'recovery', tone: 'alert', label: `${recovery.name} · ${recovery.status}` });
  }

  return chips.slice(0, 3);
}

/**
 * The line the coach opens with. It names what it can see and offers the two
 * obvious next moves; it never claims a trend it has not got the data for.
 */
export function buildCoachOpeningLine(input: CoachChatIntroInput, language: AppLanguage): string {
  const stalled = input.weeklyRead.find((row) => row.tone === 'amber' && row.key !== 'recovery');

  if (stalled && input.todaySessionTitle) {
    return t(language, 'coachChat.open.stalledAndPlan', {
      count: input.sessionsThisWeek,
      lift: stalled.name.toLowerCase(),
      session: input.todaySessionTitle,
    });
  }
  if (stalled) {
    return t(language, 'coachChat.open.stalled', { lift: stalled.name.toLowerCase() });
  }
  if (input.todaySessionTitle) {
    return t(language, 'coachChat.open.plan', { session: input.todaySessionTitle });
  }
  if (input.sessionsThisWeek > 0) {
    return t(language, 'coachChat.open.logged', { count: input.sessionsThisWeek });
  }
  return t(language, 'coachChat.open.fresh');
}

/**
 * The Pro difference in the design is not "unlimited" — it is initiative: the
 * coach speaks first. These are the findings it opens with, taken straight
 * from the weekly read so the card can never claim something the Progress tab
 * does not also show.
 *
 * The design's card ends in "Apply both to next week". That button is NOT
 * built here: nothing in the app can rewrite a programme (every coach action
 * is a navigation link), so a button claiming it would be the exact dead
 * promise this codebase keeps having to remove. Each item instead asks the
 * coach about itself, which is real.
 */
export function buildCoachNoticed(
  weeklyRead: WeeklyReadRow[],
  language: AppLanguage,
): CoachNoticedItem[] {
  const items: CoachNoticedItem[] = [];

  for (const row of weeklyRead) {
    if (items.length >= 2) {
      break;
    }
    if (row.tone === 'amber' || row.tone === 'red') {
      items.push({
        key: row.key,
        tone: row.tone === 'red' ? 'alert' : 'warn',
        title: `${row.name} · ${row.status}`,
        body: row.locked ? row.locked.body : row.meta,
        question: t(language, 'coachChat.ask.about', { subject: row.name.toLowerCase() }),
      });
    }
  }

  // A green row is worth opening with too — progress the user has earned is a
  // finding, not filler. Only used when there is room left.
  for (const row of weeklyRead) {
    if (items.length >= 2) {
      break;
    }
    if (row.tone === 'green' && row.key !== 'recovery') {
      items.push({
        key: row.key,
        tone: 'plan',
        title: `${row.name} · ${row.status}`,
        body: row.meta,
        question: t(language, 'coachChat.ask.about', { subject: row.name.toLowerCase() }),
      });
    }
  }

  return items;
}

/**
 * Everything the coach has to say before the first question, as one rotating
 * sequence — today's line first, then what it noticed, then the readout.
 *
 * These were three stacked surfaces (ticker, "things I noticed" card, opening
 * bubble) and together they pushed the conversation off the screen (user,
 * 2026-08-23). Folded into one stage: the noticed items keep their question,
 * so the tap that used to live on the card lives on the slide.
 */
export function buildCoachOpeningRows(input: {
  openingLine: string;
  noticed: CoachNoticedItem[];
  readout: CoachContextRow[];
  language: AppLanguage;
}): CoachTickerRow[] {
  const rows: CoachTickerRow[] = [];
  if (input.openingLine.trim()) {
    rows.push({ key: 'today', label: t(input.language, 'coachChat.readout.today'), value: input.openingLine });
  }
  for (const item of input.noticed) {
    rows.push({
      key: `noticed-${item.key}`,
      label: t(input.language, 'coachChat.readout.noticed'),
      value: `${item.title} — ${item.body}`,
      question: item.question,
      tone: item.tone,
    });
  }
  for (const row of input.readout) {
    rows.push({ key: row.key, label: row.label, value: row.value });
  }
  return rows;
}
