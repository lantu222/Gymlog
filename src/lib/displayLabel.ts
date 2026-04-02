function collapseWhitespace(value: string | null | undefined) {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

function parseCopySuffix(value: string) {
  const modernMatch = value.match(/^(.*?)(?:\s*\(copy(?:\s+(\d+))?\))$/i);
  if (modernMatch) {
    return {
      core: collapseWhitespace(modernMatch[1]),
      copyIndex: modernMatch[2] ? Number(modernMatch[2]) : 1,
    };
  }

  const legacyMatch = value.match(/^(.*?)(?:\s+copy(?:\s+(\d+))?)$/i);
  if (legacyMatch) {
    return {
      core: collapseWhitespace(legacyMatch[1]),
      copyIndex: legacyMatch[2] ? Number(legacyMatch[2]) : 1,
    };
  }

  return null;
}

function normalizeDisplayKey(value: string) {
  const normalized = collapseWhitespace(value).toLowerCase();
  if (!normalized) {
    return '';
  }

  const copy = parseCopySuffix(normalized);
  if (!copy) {
    return normalized;
  }

  return `${copy.core} (copy${copy.copyIndex > 1 ? ` ${copy.copyIndex}` : ''})`;
}

export function formatDisplayLabel(
  value: string | null | undefined,
  {
    fallback,
    minimumCoreLength = 2,
  }: {
    fallback: string;
    minimumCoreLength?: number;
  },
) {
  const normalized = collapseWhitespace(value);
  if (!normalized) {
    return fallback;
  }

  const copy = parseCopySuffix(normalized);
  const core = copy ? copy.core : normalized;
  if (core.length < minimumCoreLength) {
    return fallback;
  }

  return copy
    ? `${core} (copy${copy.copyIndex > 1 ? ` ${copy.copyIndex}` : ''})`
    : normalized;
}

export function formatWorkoutDisplayLabel(value: string | null | undefined, fallback = 'Custom workout') {
  return formatDisplayLabel(value, { fallback });
}

export function formatLiftDisplayLabel(value: string | null | undefined, fallback = 'Unnamed lift') {
  return formatDisplayLabel(value, { fallback });
}

export function buildDisplayCopyName(
  baseName: string,
  existingNames: string[] = [],
  fallback = 'Custom workout',
) {
  const baseLabel = formatWorkoutDisplayLabel(baseName, fallback);
  const taken = new Set(existingNames.map(normalizeDisplayKey));
  const initialCandidate = `${baseLabel} (copy)`;

  if (!taken.has(normalizeDisplayKey(initialCandidate))) {
    return initialCandidate;
  }

  let index = 2;
  while (taken.has(normalizeDisplayKey(`${baseLabel} (copy ${index})`))) {
    index += 1;
  }

  return `${baseLabel} (copy ${index})`;
}