import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ConfirmDialog } from '../components/ConfirmDialog';
import { InlineTip } from '../components/InlineTip';
import { BadgePill, SectionHeaderBlock, SurfaceAccent, SurfaceCard } from '../components/MainScreenPrimitives';
import { ScreenHeader } from '../components/ScreenHeader';
import { WorkoutSceneGraphic } from '../components/WorkoutSceneGraphic';
import { formatWorkoutDisplayLabel } from '../lib/displayLabel';
import { ProgramDetailViewModel } from '../lib/programDetails';
import { getWorkoutFlowPhasePreview } from '../lib/workoutFlow';
import { colors, layout, radii, spacing } from '../theme';
import { WorkoutPhasePreview } from '../components/WorkoutPhasePreview';

interface ProgramDetailScreenProps {
  program: ProgramDetailViewModel;
  onBack: () => void;
  onPrimaryAction: () => void;
  onStartSession: (sessionId: string) => void;
  onEdit?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  destructiveActionLabel?: string;
  destructiveActionTitle?: string;
  destructiveActionMessage?: string;
  onDestructiveAction?: () => void;
  inlineTip?: {
    title: string;
    body: string;
    accent?: SurfaceAccent;
    onDismiss: () => void;
  } | null;
}

function getSessionVisualVariant(index: number, total: number) {
  if (index === 0) {
    return 'today' as const;
  }

  if (index === total - 1) {
    return 'build' as const;
  }

  return 'plan' as const;
}

export function ProgramDetailScreen({
  program,
  onBack,
  onPrimaryAction,
  onStartSession,
  onEdit,
  secondaryActionLabel,
  onSecondaryAction,
  destructiveActionLabel,
  destructiveActionTitle,
  destructiveActionMessage,
  onDestructiveAction,
  inlineTip,
}: ProgramDetailScreenProps) {
  const [confirmVisible, setConfirmVisible] = useState(false);
  const displayTitle = formatWorkoutDisplayLabel(program.title, 'Workout');
  const kickoffSession = program.sessions[0] ?? null;
  const kickoffPhasePreview = kickoffSession
    ? getWorkoutFlowPhasePreview(
        kickoffSession.exercises.map((exercise) => ({
          exerciseName: exercise.name,
          role: exercise.role,
        })),
      )
    : [];
  const heroFitSection = program.infoSections.find((section) => section.kicker.toLowerCase() === 'why it fits') ?? null;
  const remainingInfoSections = heroFitSection
    ? program.infoSections.filter((section) => section.kicker !== heroFitSection.kicker)
    : program.infoSections;

  const hasDestructiveAction = Boolean(
    destructiveActionLabel && destructiveActionTitle && destructiveActionMessage && onDestructiveAction,
  );

  function handleConfirmDelete() {
    setConfirmVisible(false);
    onDestructiveAction?.();
  }

  return (
    <>
      <ScreenHeader
        title={displayTitle}
        subtitle={program.subtitle}
        onBack={onBack}
        rightActionLabel={program.source === 'custom' && onEdit ? 'Edit' : undefined}
        onRightActionPress={program.source === 'custom' ? onEdit : undefined}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {inlineTip ? (
          <InlineTip
            title={inlineTip.title}
            body={inlineTip.body}
            accent={inlineTip.accent}
            onDismiss={inlineTip.onDismiss}
          />
        ) : null}
        <SurfaceCard accent="blue" emphasis="hero" style={styles.heroCard}>
          <View style={styles.heroIntroRow}>
            <View style={styles.heroIntroCopy}>
              <Text style={styles.heroKicker}>Start here</Text>
              <Text style={styles.heroDescription}>{program.description}</Text>
            </View>
            <WorkoutSceneGraphic variant="plan" accent="blue" style={styles.heroVisual} />
          </View>

          <WorkoutPhasePreview phases={kickoffPhasePreview} compact />

          <View style={styles.heroSignalRow}>
            {kickoffSession ? (
              <View style={styles.heroSignalCard}>
                <Text style={styles.heroSignalLabel}>Starts with</Text>
                <Text style={styles.heroSignalValue}>{formatWorkoutDisplayLabel(kickoffSession.name, 'Session')}</Text>
                <Text style={styles.heroSignalMeta}>
                  {kickoffSession.exerciseCount} {kickoffSession.exerciseCount === 1 ? 'exercise' : 'exercises'}
                  {kickoffSession.statusLine ? ` | ${kickoffSession.statusLine}` : ''}
                </Text>
                {kickoffSession.focus ? <Text style={styles.heroSignalBody}>{kickoffSession.focus}</Text> : null}
              </View>
            ) : null}

            {heroFitSection ? (
              <View style={styles.heroSignalCard}>
                <Text style={styles.heroSignalLabel}>{heroFitSection.kicker}</Text>
                <Text style={styles.heroSignalValue}>Why now</Text>
                <Text style={styles.heroSignalBody}>{heroFitSection.body}</Text>
              </View>
            ) : null}
          </View>

          {kickoffSession ? (
            <View style={styles.heroKickoffRow}>
              {kickoffSession.exercises.slice(0, 3).map((exercise, index) => (
                <View key={exercise.id} style={styles.kickoffExercisePill}>
                  <Text style={styles.kickoffExercisePillText}>
                    {index + 1}. {exercise.name}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.badgeRow}>
            {program.badges.map((badge) => (
              <View key={badge} style={styles.badge}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            ))}
          </View>

          {program.tailoringBadges.length ? (
            <View style={styles.tailoringBadgeRow}>
              {program.tailoringBadges.map((badge) => (
                <BadgePill key={badge} accent="orange" label={badge} />
              ))}
            </View>
          ) : null}

          {program.highlights.length ? (
            <View style={styles.highlightGrid}>
              {program.highlights.map((highlight) => (
                <View key={`${highlight.label}:${highlight.value}`} style={styles.highlightCard}>
                  <Text style={styles.highlightLabel}>{highlight.label}</Text>
                  <Text style={styles.highlightValue} numberOfLines={1}>{highlight.value}</Text>
                  {highlight.detail ? <Text style={styles.highlightDetail}>{highlight.detail}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.heroActions}>
            <Pressable onPress={onPrimaryAction} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{program.primaryActionLabel}</Text>
            </Pressable>
            {secondaryActionLabel && onSecondaryAction ? (
              <Pressable onPress={onSecondaryAction} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>{secondaryActionLabel}</Text>
              </Pressable>
            ) : null}
            {hasDestructiveAction ? (
              <Pressable onPress={() => setConfirmVisible(true)} style={styles.destructiveButton}>
                <Text style={styles.destructiveButtonText}>{destructiveActionLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </SurfaceCard>

        {program.progressionSummary ? (
          <SurfaceCard accent="blue" emphasis="standard" style={styles.infoCard}>
            <Text style={styles.sectionKicker}>Progression</Text>
            <Text style={styles.infoText}>{program.progressionSummary}</Text>
          </SurfaceCard>
        ) : null}

        {remainingInfoSections.map((section) => (
          <SurfaceCard key={section.kicker} accent="blue" emphasis="standard" style={styles.infoCard}>
            <Text style={styles.sectionKicker}>{section.kicker}</Text>
            <Text style={styles.infoText}>{section.body}</Text>
          </SurfaceCard>
        ))}

        <SectionHeaderBlock
          accent="blue"
          kicker="Sessions"
          title="Program sessions"
          subtitle="Start with the first session or jump straight to the exact session you want."
        />

        <View style={styles.sessionList}>
          {program.sessions.map((session, index) => (
            <SurfaceCard key={session.id} accent="blue" emphasis="standard" style={styles.sessionCard}>
              <View style={styles.sessionTopRow}>
                <WorkoutSceneGraphic
                  variant={getSessionVisualVariant(index, program.sessions.length)}
                  accent="blue"
                  compact
                  style={styles.sessionVisual}
                />
                <View style={styles.sessionHeader}>
                  <View style={styles.sessionCopy}>
                    <Text style={styles.sessionName}>{formatWorkoutDisplayLabel(session.name, 'Session')}</Text>
                    <Text style={styles.sessionMeta}>{session.exerciseCount} {session.exerciseCount === 1 ? 'exercise' : 'exercises'}</Text>
                    {session.statusLine ? <Text style={styles.sessionStatus}>{session.statusLine}</Text> : null}
                  </View>
                  <Pressable onPress={() => onStartSession(session.id)} style={styles.sessionButton}>
                    <Text style={styles.sessionButtonText}>{program.sessionActionLabel}</Text>
                  </Pressable>
                </View>
              </View>

              <Text style={styles.sessionPreview}>{session.preview}</Text>
              {session.focus ? <Text style={styles.sessionFocus}>{session.focus}</Text> : null}

              <View style={styles.exerciseList}>
                {session.exercises.map((exercise) => (
                  <View key={exercise.id} style={styles.exerciseRow}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <Text style={styles.exercisePrescription}>{exercise.prescription}</Text>
                  </View>
                ))}
              </View>
            </SurfaceCard>
          ))}
        </View>
      </ScrollView>
      {hasDestructiveAction ? (
        <ConfirmDialog
          visible={confirmVisible}
          title={destructiveActionTitle!}
          message={destructiveActionMessage!}
          confirmLabel={destructiveActionLabel!}
          destructive
          onCancel={() => setConfirmVisible(false)}
          onConfirm={handleConfirmDelete}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: layout.bottomTabBarReserve,
    gap: spacing.lg,
  },
  heroCard: {
    gap: spacing.md,
  },
  heroIntroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  heroVisual: {
    width: 122,
    height: 96,
  },
  heroIntroCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  heroKicker: {
    color: '#9ACCFF',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  heroDescription: {
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '700',
  },
  heroSignalRow: {
    gap: spacing.sm,
  },
  heroSignalCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.20)',
    backgroundColor: 'rgba(11, 15, 20, 0.38)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 3,
  },
  heroSignalLabel: {
    color: '#9ACCFF',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroSignalValue: {
    color: colors.textPrimary,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  heroSignalMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  heroSignalBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  heroKickoffRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  kickoffExercisePill: {
    minHeight: 28,
    maxWidth: '100%',
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(15, 21, 29, 0.72)',
    justifyContent: 'center',
  },
  kickoffExercisePillText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tailoringBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  badge: {
    minHeight: 30,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  badgeText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  highlightGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  highlightCard: {
    flexGrow: 1,
    minWidth: 96,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.16)',
    backgroundColor: 'rgba(11, 15, 20, 0.34)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  highlightLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  highlightValue: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
  highlightDetail: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  heroActions: {
    gap: spacing.sm,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentAlt,
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.32)',
  },
  primaryButtonText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18, 24, 33, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.18)',
  },
  secondaryButtonText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  destructiveButton: {
    minHeight: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: 'rgba(191, 74, 105, 0.34)',
  },
  destructiveButtonText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  infoCard: {
    gap: spacing.xs,
  },
  sectionKicker: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  infoText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  sessionList: {
    gap: spacing.md,
  },
  sessionCard: {
    gap: spacing.md,
  },
  sessionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sessionVisual: {
    width: 94,
  },
  sessionHeader: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  sessionCopy: {
    flex: 1,
    gap: 2,
  },
  sessionName: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  sessionMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sessionStatus: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  sessionButton: {
    minHeight: 42,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentAlt,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  sessionButtonText: {
    color: '#0B141D',
    fontSize: 13,
    fontWeight: '900',
  },
  sessionPreview: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  sessionFocus: {
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  exerciseList: {
    gap: spacing.sm,
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.14)',
    backgroundColor: 'rgba(12, 17, 24, 0.44)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  exerciseName: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  exercisePrescription: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
});
