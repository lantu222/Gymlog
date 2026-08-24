/**
 * "Rinnanympärys on 90 cm" typed into the coach chat is a measurement the
 * reader wants logged, not a question (user, 2026-08-23). This reads that
 * intent out of a message so the chat can offer to log it — offer, because
 * the coach never writes anything without a tap.
 *
 * Deliberately narrow: a body-part word, a number, and no question mark.
 * "Should my chest be 100 cm?" is a question and parses to nothing; a
 * missed statement costs one manual entry, a false positive would offer to
 * log a number the reader never meant.
 */
import type { AppLanguage, MeasurementKind } from '../types/models';

export type MeasurementIntentKind = MeasurementKind | 'bodyweight';

export interface MeasurementIntent {
  kind: MeasurementIntentKind;
  value: number;
  unit: 'cm' | 'kg' | '%';
}

export const KIND_WORDS: Array<{ kind: MeasurementIntentKind; pattern: RegExp }> = [
  { kind: 'bodyfat', pattern: /rasvaprosent|rasva-?%|body ?fat/i },
  { kind: 'bodyweight', pattern: /\bpaino(ni)?\b|\bpainan\b|\bweigh(t|s)?\b|\bbodyweight\b/i },
  { kind: 'chest', pattern: /rinna(n|t)?\s*ympär|\brinta\b|\bchest\b/i },
  { kind: 'waist', pattern: /vyötärö|\bwaist\b/i },
  { kind: 'hips', pattern: /lantio|\bhips?\b/i },
  { kind: 'thighs', pattern: /\breisi|\breiden|\breidet|\bthighs?\b/i },
  { kind: 'calves', pattern: /\bpohje|\bpohkee|\bcalf\b|\bcalves\b/i },
  { kind: 'arms', pattern: /\bhauis|käsivar|olkavar|\barms?\b|\bbiceps?\b/i },
  { kind: 'shoulders', pattern: /\bhartia|\bolkapä|\bshoulders?\b/i },
];

const NUMBER = /(\d{1,3}(?:[.,]\d{1,2})?)\s*(cm|kg|%)?/i;

const RANGE: Record<MeasurementIntent['unit'], [number, number]> = {
  cm: [15, 250],
  kg: [25, 300],
  '%': [2, 70],
};

function unitFor(kind: MeasurementIntentKind): MeasurementIntent['unit'] {
  if (kind === 'bodyweight') return 'kg';
  if (kind === 'bodyfat') return '%';
  return 'cm';
}

export function parseMeasurementIntent(text: string, _language: AppLanguage = 'fi'): MeasurementIntent | null {
  const message = text.trim();
  if (!message || message.includes('?')) {
    return null;
  }
  // A goal is not a reading: "tavoite 100 cm" must not be logged as today's chest.
  if (/tavoit|goal|target|pitäisi|should|haluaisin|haluan|yritän|aion|want|aim|trying/i.test(message)) {
    return null;
  }

  const match = KIND_WORDS.find((entry) => entry.pattern.test(message));
  if (!match) {
    return null;
  }

  const number = message.match(NUMBER);
  if (!number) {
    return null;
  }
  const value = Number(number[1].replace(',', '.'));
  const unit = (number[2]?.toLowerCase() as MeasurementIntent['unit'] | undefined) ?? unitFor(match.kind);
  if (unit !== unitFor(match.kind)) {
    // "rinta 80 kg" is a bench press, not a chest measurement.
    return null;
  }
  const [min, max] = RANGE[unit];
  if (!Number.isFinite(value) || value < min || value > max) {
    return null;
  }

  return { kind: match.kind, value: Math.round(value * 10) / 10, unit };
}
