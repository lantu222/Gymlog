import { getComparableLogSets } from './exerciseLog';
import { ExerciseLog, UnitPreference } from '../types/models';

const KG_TO_LB = 2.20462;

export function formatDate(dateString: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateString));
}

export function formatShortDate(dateString: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
  }).format(new Date(dateString));
}

export function formatWeekday(dateString: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
  }).format(new Date(dateString));
}

export function formatSessionDate(dateString: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString));
}

export function formatTime(dateString: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString));
}

export function convertWeightFromKg(value: number, unitPreference: UnitPreference) {
  return unitPreference === 'kg' ? value : value * KG_TO_LB;
}

export function convertWeightToKg(value: number, unitPreference: UnitPreference) {
  return unitPreference === 'kg' ? value : value / KG_TO_LB;
}

export function formatWeight(value: number | null | undefined, unitPreference: UnitPreference = 'kg') {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }

  return `${removeTrailingZeros(convertWeightFromKg(value, unitPreference))} ${unitPreference}`;
}

export function formatWeightInputValue(value: number | null | undefined, unitPreference: UnitPreference) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '';
  }

  return removeTrailingZeros(convertWeightFromKg(value, unitPreference));
}

export function formatVolume(value: number, unitPreference: UnitPreference = 'kg') {
  if (!value) {
    return `0 ${unitPreference}`;
  }

  return `${removeTrailingZeros(convertWeightFromKg(value, unitPreference))} ${unitPreference}`;
}

export function formatDurationMinutes(totalMinutes: number) {
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

export function formatRepRange(repMin: number, repMax: number) {
  return repMin === repMax ? `${repMin}` : `${repMin}-${repMax}`;
}

export function formatTargetSets(targetSets: number, repMin: number, repMax: number) {
  return `${targetSets} x ${formatRepRange(repMin, repMax)}`;
}

export function formatReps(repsPerSet: number[]) {
  return repsPerSet.length ? repsPerSet.join(',') : '-';
}

export function formatLogSetSummary(
  log?: Pick<ExerciseLog, 'weight' | 'repsPerSet' | 'sets' | 'skipped'> | null,
  unitPreference: UnitPreference = 'kg',
) {
  if (!log || log.skipped) {
    return '-';
  }

  const sets = getComparableLogSets(log);
  if (sets.length === 0) {
    return '-';
  }

  const usesSingleWeight = sets.every((set) => Math.abs(set.weight - sets[0].weight) < 0.0001);
  if (usesSingleWeight) {
    return `${formatWeight(sets[0].weight, unitPreference)} - ${sets.map((set) => set.reps).join(',')}`;
  }

  return sets
    .map((set) => `${removeTrailingZeros(convertWeightFromKg(set.weight, unitPreference))}x${set.reps}`)
    .join(', ');
}

export function formatLogResult(
  log?: Pick<ExerciseLog, 'weight' | 'repsPerSet' | 'sets' | 'skipped'> | null,
  unitPreference: UnitPreference = 'kg',
) {
  if (!log) {
    return 'No previous result';
  }

  if (log.skipped) {
    return 'Skipped';
  }

  return formatLogSetSummary(log, unitPreference);
}

export function formatWeightTrend(
  latestWeight: number | null,
  previousWeight: number | null,
  unitPreference: UnitPreference,
) {
  if (latestWeight === null || previousWeight === null) {
    return 'No previous weight';
  }

  const delta = convertWeightFromKg(latestWeight - previousWeight, unitPreference);
  if (Math.abs(delta) < 0.05) {
    return 'No change';
  }

  const direction = delta > 0 ? '+' : '';
  return `${direction}${removeTrailingZeros(delta)} ${unitPreference}`;
}

export function parseNumberInput(value: string) {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function removeTrailingZeros(value: number) {
  return value % 1 === 0 ? `${value}` : value.toFixed(1).replace(/\.0$/, '');
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
