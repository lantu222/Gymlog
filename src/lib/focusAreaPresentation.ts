import type { SetupFocusArea } from '../types/models';

export type FocusAreaAssetKey =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'arms'
  | 'core'
  | 'quads'
  | 'glutes'
  | 'hamstrings'
  | 'calves'
  | 'mobility'
  | 'legs'
  | 'conditioning';

export interface FocusAreaPresentationOption {
  area: SetupFocusArea;
  title: string;
  assetKey: FocusAreaAssetKey;
  accessibilityLabel: string;
  group: 'upper' | 'lower' | 'performance' | 'legacy';
}

const FOCUS_AREA_PRESENTATION_OPTIONS: FocusAreaPresentationOption[] = [
  {
    area: 'chest',
    title: 'Chest',
    assetKey: 'chest',
    accessibilityLabel: 'Chest focus',
    group: 'upper',
  },
  {
    area: 'back',
    title: 'Back',
    assetKey: 'back',
    accessibilityLabel: 'Back focus',
    group: 'upper',
  },
  {
    area: 'shoulders',
    title: 'Shoulders',
    assetKey: 'shoulders',
    accessibilityLabel: 'Shoulders focus',
    group: 'upper',
  },
  {
    area: 'arms',
    title: 'Arms',
    assetKey: 'arms',
    accessibilityLabel: 'Arms focus',
    group: 'upper',
  },
  {
    area: 'core',
    title: 'Abs',
    assetKey: 'core',
    accessibilityLabel: 'Abs focus',
    group: 'upper',
  },
  {
    area: 'quads',
    title: 'Quads',
    assetKey: 'quads',
    accessibilityLabel: 'Quads focus',
    group: 'lower',
  },
  {
    area: 'glutes',
    title: 'Glutes',
    assetKey: 'glutes',
    accessibilityLabel: 'Glutes focus',
    group: 'lower',
  },
  {
    area: 'hamstrings',
    title: 'Hamstrings',
    assetKey: 'hamstrings',
    accessibilityLabel: 'Hamstrings focus',
    group: 'lower',
  },
  {
    area: 'calves',
    title: 'Calves',
    assetKey: 'calves',
    accessibilityLabel: 'Calves focus',
    group: 'lower',
  },
  {
    area: 'mobility',
    title: 'Mobility',
    assetKey: 'mobility',
    accessibilityLabel: 'Mobility focus',
    group: 'lower',
  },
  {
    area: 'legs',
    title: 'Legs',
    assetKey: 'legs',
    accessibilityLabel: 'Legs focus',
    group: 'legacy',
  },
  {
    area: 'conditioning',
    title: 'Conditioning',
    assetKey: 'conditioning',
    accessibilityLabel: 'Conditioning focus',
    group: 'legacy',
  },
];

export function getFocusAreaPresentationOptions() {
  return FOCUS_AREA_PRESENTATION_OPTIONS;
}

export function getOnboardingFocusAreaPresentationOptions() {
  return FOCUS_AREA_PRESENTATION_OPTIONS.filter((option) => option.group === 'upper' || option.group === 'lower');
}
