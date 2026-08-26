import { formatWorkoutDisplayLabel } from '../lib/displayLabel';
import { t } from '../lib/i18n';
import { AppLanguage } from '../types/models';

/**
 * The goal tag on a program cover.
 *
 * Returned hardcoded English until an emulator pass found "Muscle" and
 * "Strength" sitting on cards in a Finnish app, directly under category chips
 * reading "Lihaskasvu" and "Voima". It reuses those same keys now, so the tag
 * and the chip that filters for it cannot say different words.
 */
export function formatGoalLabel(goalType: string, language: AppLanguage = 'en') {
  if (goalType === 'hypertrophy') {
    return t(language, 'programs.cat.muscle');
  }
  if (goalType === 'strength') {
    return t(language, 'programs.cat.strength');
  }
  return t(language, 'programs.cat.balanced');
}

function getExerciseFocusName(name: string) {
  const normalized = name.toLowerCase();
  if (/(squat|lunge|leg press|leg extension|quad)/.test(normalized)) {
    return 'Lower Focus';
  }
  if (/(deadlift|hip thrust|glute|leg curl|hamstring)/.test(normalized)) {
    return 'Posterior Focus';
  }
  if (/(bench|press|push-up|fly|dip)/.test(normalized)) {
    return 'Push Focus';
  }
  if (/(row|pull-up|pulldown|face pull)/.test(normalized)) {
    return 'Pull Focus';
  }
  if (/(run|mobility|stretch|yoga|conditioning|hiit)/.test(normalized)) {
    return 'Conditioning Focus';
  }
  return 'Full Body Focus';
}

export function formatHomeSessionTitle(name: string, exercises: Array<{ name?: string; exerciseName?: string }>) {
  const displayName = formatWorkoutDisplayLabel(name, 'Workout');
  if (!/^(minimal\s+[abc]|workout\s+[abc]|day\s+\d+|session\s+\d+)$/i.test(displayName.trim())) {
    // The full name, never sliced. A 20-character cap with hand-appended dots
    // lived here and cut "Day 1: Full Body + H|IIT" at exactly the H — and
    // because every surface builds its titles from this one card, the cut
    // rode through translation onto Home, Profile and the plan screen alike,
    // surviving three rounds of display fixes and one data-repair built on
    // the wrong theory (2026-08-25). Screens own their own line counts now;
    // an assembly layer has no business abbreviating.
    return displayName;
  }

  const primaryName = exercises[0]?.name ?? exercises[0]?.exerciseName ?? '';
  return getExerciseFocusName(primaryName);
}
