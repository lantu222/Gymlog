import type { SetupFocusArea } from '../types/models';

export type FocusAreaAssetKey =
  | 'glutes'
  | 'legs'
  | 'chest'
  | 'shoulders'
  | 'back'
  | 'arms'
  | 'core'
  | 'conditioning';

export interface FocusAreaPresentationOption {
  area: SetupFocusArea;
  title: string;
  assetKey: FocusAreaAssetKey;
  accessibilityLabel: string;
}

const FOCUS_AREA_PRESENTATION_OPTIONS: FocusAreaPresentationOption[] = [
  {
    area: 'glutes',
    title: 'Glutes',
    assetKey: 'glutes',
    accessibilityLabel: 'Glutes focus',
  },
  {
    area: 'legs',
    title: 'Legs',
    assetKey: 'legs',
    accessibilityLabel: 'Legs focus',
  },
  {
    area: 'chest',
    title: 'Chest',
    assetKey: 'chest',
    accessibilityLabel: 'Chest focus',
  },
  {
    area: 'shoulders',
    title: 'Shoulders',
    assetKey: 'shoulders',
    accessibilityLabel: 'Shoulders focus',
  },
  {
    area: 'back',
    title: 'Back',
    assetKey: 'back',
    accessibilityLabel: 'Back focus',
  },
  {
    area: 'arms',
    title: 'Arms',
    assetKey: 'arms',
    accessibilityLabel: 'Arms focus',
  },
  {
    area: 'core',
    title: 'Core',
    assetKey: 'core',
    accessibilityLabel: 'Core focus',
  },
  {
    area: 'conditioning',
    title: 'Conditioning',
    assetKey: 'conditioning',
    accessibilityLabel: 'Conditioning focus',
  },
];

export function getFocusAreaPresentationOptions() {
  return FOCUS_AREA_PRESENTATION_OPTIONS;
}
