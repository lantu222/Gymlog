/**
 * "Yritän kasvattaa rinnanympärystä" typed into the coach chat is a goal the
 * user is stating, not a question. This reads that intent out of a message so
 * the chat can offer to save it — the coach then ties every later answer to
 * it. Offer only: nothing is saved without a tap.
 *
 * Same narrowness as measurementIntent: a goal word, a body-part word, and no
 * question mark. A missed goal costs one repeat; a false positive would nag
 * about saving a goal the reader never meant.
 */
import type { AppLanguage } from '../types/models';
import { KIND_WORDS, MeasurementIntentKind } from './measurementIntent';

export interface GoalIntent {
  /** The goal in the user's own words, trimmed. */
  text: string;
  kind: MeasurementIntentKind;
  targetValue: number | null;
  unit: 'cm' | 'kg' | '%' | null;
}

const GOAL_WORDS = /tavoit|haluan|haluaisin|yritän|aion|\bgoal\b|\btarget\b|i want|aim to|trying to|want to/i;

/**
 * Growth/change verbs — "haluan kasvattaa rinnanympärystä" is a goal, but
 * "haluan tietää rinnanympärykseni" is a question in statement's clothing.
 */
const DIRECTION_WORDS =
  /kasvat|isomma|nosta|lisä|pienen|pudott|laske|polt|kiinte|grow|bigger|increase|build|gain|lose|drop|cut|reach|tavoite?paino|tavoitteeni on|tavoite on|goal is|target is/i;

const NUMBER = /(\d{1,3}(?:[.,]\d{1,2})?)\s*(cm|kg|%)/i;

/**
 * Goal sentences inflect: "kasvattaa rintaa", "laskea painoa". The reading
 * parser's KIND_WORDS match nominative forms only, so goals add the
 * partitives on top rather than loosening the logger's matching.
 */
const EXTRA_KIND_WORDS: Array<{ kind: MeasurementIntentKind; pattern: RegExp }> = [
  { kind: 'bodyweight', pattern: /\bpainoa\b|\bpainoani\b/i },
  { kind: 'chest', pattern: /\brintaa\b|\brintaani\b/i },
  { kind: 'arms', pattern: /\bhauista\b|käsivarsia/i },
  { kind: 'thighs', pattern: /\breisiä\b/i },
  { kind: 'hips', pattern: /lantiota/i },
  { kind: 'calves', pattern: /pohkeita/i },
  { kind: 'shoulders', pattern: /hartioita/i },
];

function unitFor(kind: MeasurementIntentKind): 'cm' | 'kg' | '%' {
  if (kind === 'bodyweight') return 'kg';
  if (kind === 'bodyfat') return '%';
  return 'cm';
}

export function parseGoalIntent(text: string, _language: AppLanguage = 'fi'): GoalIntent | null {
  const message = text.trim();
  if (!message || message.includes('?')) {
    return null;
  }
  // A number with a unit implies the direction: "tavoite rinnanympärys 104 cm"
  // needs no verb to be a goal.
  if (!GOAL_WORDS.test(message) || !(DIRECTION_WORDS.test(message) || NUMBER.test(message))) {
    return null;
  }
  const match =
    KIND_WORDS.find((entry) => entry.pattern.test(message)) ?? EXTRA_KIND_WORDS.find((entry) => entry.pattern.test(message));
  if (!match) {
    return null;
  }

  // A target number is optional, and only counts with an explicit matching
  // unit: "tavoite rinta 104 cm" carries a target, "tavoite rinta 104 kg" is
  // a bench press dream and keeps the goal without the number.
  const number = message.match(NUMBER);
  let targetValue: number | null = null;
  if (number) {
    const value = Number(number[1].replace(',', '.'));
    if (Number.isFinite(value) && number[2].toLowerCase() === unitFor(match.kind)) {
      targetValue = Math.round(value * 10) / 10;
    }
  }

  return {
    text: message,
    kind: match.kind,
    targetValue,
    unit: targetValue !== null ? unitFor(match.kind) : null,
  };
}
