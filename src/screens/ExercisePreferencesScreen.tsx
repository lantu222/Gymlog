import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FitnessPhotoSurface } from '../components/FitnessPhotoSurface';
import { BadgePill, SurfaceCard } from '../components/MainScreenPrimitives';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  EXERCISE_MODALITY_OPTIONS,
  getExerciseModalityPreferenceTitle,
  getTrainingFeelHint,
  getTrainingFeelTitle,
  getWorkoutVarietyHint,
  getWorkoutVarietyTitle,
  summarizeExercisePreferences,
  TRAINING_FEEL_OPTIONS,
  WORKOUT_VARIETY_OPTIONS,
} from '../lib/tailoring';
import { colors, layout, radii, spacing } from '../theme';
import { AppPreferences, ExerciseModalityPreference, TrainingFeelPreference, WorkoutVarietyPreference } from '../types/models';

interface ExercisePreferencesScreenProps {
  preferences: AppPreferences;
  onBack: () => void;
  onChange: (patch: Partial<AppPreferences>) => void | Promise<void>;
}

function getHeroPhotoKey(preferences: AppPreferences) {
  if (preferences.setupTrainingFeel === 'intense' || preferences.setupWorkoutVariety === 'fresh') {
    return 'hiit' as const;
  }

  if (preferences.setupBodyweightPreference === 'love' || preferences.setupBodyweightPreference === 'prefer') {
    return 'running' as const;
  }

  return 'strength' as const;
}

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

function QuestionOption({
  label,
  hint,
  active,
  onPress,
}: {
  label: string;
  hint: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.questionOption, active && styles.questionOptionActive]}>
      <Text style={[styles.questionOptionLabel, active && styles.questionOptionLabelActive]}>{label}</Text>
      <Text style={[styles.questionOptionHint, active && styles.questionOptionHintActive]}>{hint}</Text>
    </Pressable>
  );
}

function PreferenceRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ExerciseModalityPreference;
  onChange: (nextValue: ExerciseModalityPreference) => void;
}) {
  return (
    <View style={styles.preferenceRow}>
      <Text style={styles.preferenceRowLabel}>{label}</Text>
      <View style={styles.preferenceSegmentRow}>
        {EXERCISE_MODALITY_OPTIONS.map((option) => {
          const active = option === value;
          return (
            <Pressable
              key={option}
              onPress={() => onChange(option)}
              style={[styles.preferenceSegment, active && styles.preferenceSegmentActive]}
            >
              <Text style={[styles.preferenceSegmentText, active && styles.preferenceSegmentTextActive]}>
                {getExerciseModalityPreferenceTitle(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ExercisePreferencesScreen({
  preferences,
  onBack,
  onChange,
}: ExercisePreferencesScreenProps) {
  const trainingFeel = preferences.setupTrainingFeel;
  const workoutVariety = preferences.setupWorkoutVariety;
  const heroPhoto = getHeroPhotoKey(preferences);

  return (
    <>
      <ScreenHeader title="Exercise preferences" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FitnessPhotoSurface variant={heroPhoto} style={styles.heroSurface}>
          <View style={styles.heroContent}>
            <Text style={styles.heroKicker}>Tailoring</Text>

            <View style={styles.heroBadgeRow}>
              <BadgePill accent="neutral" label={getTrainingFeelTitle(trainingFeel)} />
              <BadgePill accent="neutral" label={getWorkoutVarietyTitle(workoutVariety)} />
            </View>

            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Set the training tone</Text>
              <Text style={styles.heroMeta}>
                {summarizeExercisePreferences({
                  trainingFeel,
                  workoutVariety,
                  freeWeights: preferences.setupFreeWeightsPreference,
                  bodyweight: preferences.setupBodyweightPreference,
                  machines: preferences.setupMachinesPreference,
                })}
              </Text>
            </View>
          </View>
        </FitnessPhotoSurface>

        <SectionLabel label="Question 1" />

        <SurfaceCard accent="neutral" emphasis="standard" style={styles.questionCard}>
          <View style={styles.questionHeader}>
            <Text style={styles.questionTitle}>How hard should training feel?</Text>
            <Text style={styles.questionBody}>Pick the default feel for the week.</Text>
          </View>

          <View style={styles.questionGrid}>
            {TRAINING_FEEL_OPTIONS.map((option) => (
              <QuestionOption
                key={option}
                label={getTrainingFeelTitle(option)}
                hint={getTrainingFeelHint(option)}
                active={trainingFeel === option}
                onPress={() => void onChange({ setupTrainingFeel: option as TrainingFeelPreference })}
              />
            ))}
          </View>
        </SurfaceCard>

        <SectionLabel label="Question 2" />

        <SurfaceCard accent="neutral" emphasis="standard" style={styles.questionCard}>
          <View style={styles.questionHeader}>
            <Text style={styles.questionTitle}>How much variety do you want?</Text>
            <Text style={styles.questionBody}>Keep the week tighter or let it rotate more.</Text>
          </View>

          <View style={styles.questionGrid}>
            {WORKOUT_VARIETY_OPTIONS.map((option) => (
              <QuestionOption
                key={option}
                label={getWorkoutVarietyTitle(option)}
                hint={getWorkoutVarietyHint(option)}
                active={workoutVariety === option}
                onPress={() => void onChange({ setupWorkoutVariety: option as WorkoutVarietyPreference })}
              />
            ))}
          </View>
        </SurfaceCard>

        <SectionLabel label="Training modes" />

        <SurfaceCard accent="neutral" emphasis="standard" style={styles.preferenceCard}>
          <PreferenceRow
            label="Free weights"
            value={preferences.setupFreeWeightsPreference}
            onChange={(nextValue) => void onChange({ setupFreeWeightsPreference: nextValue })}
          />
          <PreferenceRow
            label="Bodyweight"
            value={preferences.setupBodyweightPreference}
            onChange={(nextValue) => void onChange({ setupBodyweightPreference: nextValue })}
          />
          <PreferenceRow
            label="Machines"
            value={preferences.setupMachinesPreference}
            onChange={(nextValue) => void onChange({ setupMachinesPreference: nextValue })}
          />
        </SurfaceCard>

        <SurfaceCard accent="neutral" emphasis="flat" style={styles.nextCard}>
          <Text style={styles.nextKicker}>Also in tailoring</Text>
          <Text style={styles.nextTitle}>Equipment and joint-friendly swaps</Text>
          <Text style={styles.nextBody}>Tune equipment rules and quick swaps next from Plan settings.</Text>
        </SurfaceCard>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: layout.bottomTabBarReserve,
    gap: spacing.lg,
  },
  heroSurface: {
    minHeight: 282,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.lg,
    gap: spacing.md,
  },
  heroKicker: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  heroCopy: {
    gap: spacing.xs,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -1,
    maxWidth: '80%',
  },
  heroMeta: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    maxWidth: '86%',
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  questionCard: {
    gap: spacing.md,
  },
  questionHeader: {
    gap: 2,
  },
  questionTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  questionBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  questionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  questionOption: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 96,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(10, 14, 19, 0.82)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    gap: 4,
  },
  questionOptionActive: {
    borderColor: '#F4FAFF',
    backgroundColor: '#F4FAFF',
  },
  questionOptionLabel: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  questionOptionLabelActive: {
    color: '#0B0F14',
  },
  questionOptionHint: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  questionOptionHintActive: {
    color: '#44515C',
  },
  preferenceCard: {
    gap: spacing.md,
  },
  preferenceRow: {
    gap: spacing.sm,
  },
  preferenceRowLabel: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  preferenceSegmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  preferenceSegment: {
    minHeight: 42,
    minWidth: 76,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(10, 14, 19, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  preferenceSegmentActive: {
    borderColor: '#F4FAFF',
    backgroundColor: '#F4FAFF',
  },
  preferenceSegmentText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '900',
  },
  preferenceSegmentTextActive: {
    color: '#0B0F14',
  },
  nextCard: {
    gap: 4,
  },
  nextKicker: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  nextTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  nextBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
});
