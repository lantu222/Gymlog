export interface ReadyProgramCollection {
  key: string;
  label: string;
  description: string;
  recommendedFor: string;
  templateIds: string[];
}

export const READY_PROGRAM_COLLECTIONS: ReadyProgramCollection[] = [
  {
    key: 'starter',
    label: 'Starter picks',
    description: 'Simple, repeatable programs for getting momentum fast.',
    recommendedFor: 'New lifters, comeback phases, and anyone who wants low-friction structure.',
    templateIds: [
      'tpl_2_day_minimal_full_body_v1',
      'tpl_2_day_beginner_strength_v1',
      'tpl_2_day_mobility_reset_v1',
      'tpl_2_day_yoga_recovery_v1',
      'tpl_3_day_full_body_v1',
      'tpl_3_day_upper_lower_lite_v1',
      'tpl_3_day_strength_base_v1',
      'tpl_4_day_muscle_builder_v1',
    ],
  },
  {
    key: 'strength',
    label: 'Build strength',
    description: 'Programs built around heavier anchor lifts and clearer performance targets.',
    recommendedFor: 'Lifters who care most about the numbers on squat, press, and hinge patterns.',
    templateIds: [
      'tpl_2_day_beginner_strength_v1',
      'tpl_3_day_strength_base_v1',
      'tpl_4_day_powerbuilding_v1',
      'tpl_4_day_strength_size_v1',
    ],
  },
  {
    key: 'muscle',
    label: 'Build muscle',
    description: 'Higher weekly volume and more specialization without losing progression rails.',
    recommendedFor: 'Hypertrophy-focused lifters who want upper/lower or hybrid splits.',
    templateIds: [
      'tpl_3_day_push_pull_legs_v1',
      'tpl_4_day_upper_lower_v1',
      'tpl_4_day_muscle_builder_v1',
      'tpl_5_day_hybrid_v1',
    ],
  },
  {
    key: 'balanced',
    label: 'Balanced weekly rhythm',
    description: 'Programs that keep practice frequent while recovery stays predictable.',
    recommendedFor: 'General training blocks where you want progression without a very narrow focus.',
    templateIds: [
      'tpl_2_day_minimal_full_body_v1',
      'tpl_2_day_mobility_reset_v1',
      'tpl_2_day_yoga_recovery_v1',
      'tpl_3_day_full_body_v1',
      'tpl_3_day_run_mobility_v1',
      'tpl_3_day_upper_lower_lite_v1',
      'tpl_4_day_upper_lower_v1',
    ],
  },
];

export function getReadyProgramCollection(collectionKey: string | null | undefined) {
  if (!collectionKey || collectionKey === 'all') {
    return null;
  }

  return READY_PROGRAM_COLLECTIONS.find((collection) => collection.key === collectionKey) ?? null;
}
