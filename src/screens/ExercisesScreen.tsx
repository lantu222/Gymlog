import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { ExerciseLibraryBrowser } from '../components/ExerciseLibraryBrowser';
import { ScreenHeader } from '../components/ScreenHeader';
import { layout, spacing } from '../theme';
import { ExerciseLibraryItem } from '../types/models';

interface ExercisesScreenProps {
  items: ExerciseLibraryItem[];
  onBack?: () => void;
}

export function ExercisesScreen({ items, onBack }: ExercisesScreenProps) {
  return (
    <>
      <ScreenHeader
        title="Exercise library"
        subtitle="Temporary nested access while the Add Exercise flow is rebuilt under Workout."
        onBack={onBack}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ExerciseLibraryBrowser items={items} />
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
});