import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BadgePill, SectionHeaderBlock, SurfaceCard } from '../components/MainScreenPrimitives';
import { ScreenHeader } from '../components/ScreenHeader';
import { WorkoutSceneGraphic } from '../components/WorkoutSceneGraphic';
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

  return (
    <>
      <ScreenHeader
        title="Exercise preferences"
        subtitle="Short answers first. Shape how the week should feel before the logger adapts around it."
        onBack={onBack}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SurfaceCard accent="blue" emphasis="hero" style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroKicker}>Tailoring</Text>
              <Text style={styles.heroTitle}>Set the training tone</Text>
              <Text style={styles.heroBody}>
                Pick the feel, the variety, and the training styles you want more or less of.
              </Text>
            </View>
            <WorkoutSceneGraphic variant="build" accent="blue" compact style={styles.heroGraphic} />
          </View>

          <View style={styles.badgeRow}>
            <BadgePill accent="blue" label={getTrainingFeelTitle(trainingFeel)} />
            <BadgePill accent="blue" label={getWorkoutVarietyTitle(workoutVariety)} />
          </View>

          <Text style={styles.heroSummary}>
            {summarizeExercisePreferences({
              trainingFeel,
              workoutVariety,
              freeWeights: preferences.setupFreeWeightsPreference,
              bodyweight: preferences.setupBodyweightPreference,
              machines: preferences.setupMachinesPreference,
            })}
          </Text>
        </SurfaceCard>

        <SectionHeaderBlock
          accent="blue"
          kicker="Question 1"
          title="How hard should training feel?"
          subtitle="Choose the default tone. Adaptive Coach can still adjust set by set later."
        />

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

        <SectionHeaderBlock
          accent="blue"
          kicker="Question 2"
          title="How much variety do you want?"
          subtitle="Keep the week tighter or let it rotate more from block to block."
        />

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

        <SectionHeaderBlock
          accent="orange"
          kicker="Training modes"
          title="How do you like to train?"
          subtitle="Use simple preferences instead of a big form."
        />

        <SurfaceCard accent="orange" emphasis="standard" style={styles.preferenceCard}>
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
          <Text style={styles.nextKicker}>Also in Tailoring</Text>
          <Text style={styles.nextTitle}>Equipment and joint-friendly swaps</Text>
          <Text style={styles.nextBody}>
            Open Plan settings to tune equipment rules and shoulder, elbow, or knee-friendly quick swaps.
          </Text>
        </SurfaceCard>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: layout.bottomTabBarReserve,
    gap: spacing.md,
  },
  heroCard: {
    gap: spacing.md,
  },
  heroRow: {
    gap: spacing.md,
  },
  heroCopy: {
    gap: spacing.xs,
  },
  heroKicker: {
    color: '#9ACCFF',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  heroTitle: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  heroBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  heroGraphic: {
    width: '100%',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  heroSummary: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
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
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(17, 25, 34, 0.82)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  questionOptionActive: {
    borderColor: 'rgba(150, 216, 255, 0.36)',
    backgroundColor: 'rgba(34, 56, 74, 0.92)',
  },
  questionOptionLabel: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  questionOptionLabelActive: {
    color: '#D8F0FF',
  },
  questionOptionHint: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  questionOptionHintActive: {
    color: '#BFE1FF',
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
    backgroundColor: 'rgba(11, 16, 22, 0.46)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  preferenceSegmentActive: {
    borderColor: 'rgba(255, 167, 112, 0.28)',
    backgroundColor: 'rgba(240, 106, 57, 0.18)',
  },
  preferenceSegmentText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '900',
  },
  preferenceSegmentTextActive: {
    color: '#FFD2BE',
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
