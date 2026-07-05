import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ExerciseLibraryBrowser } from '../components/ExerciseLibraryBrowser';
import { HG } from '../lightTheme';
import { ExerciseLibraryItem } from '../types/models';

interface ExercisesScreenProps {
  items: ExerciseLibraryItem[];
  trackedIds?: string[];
  onBack?: () => void;
  onOpenExercise?: (item: ExerciseLibraryItem) => void;
  onToggleTracked?: (item: ExerciseLibraryItem) => void;
  onAddToWorkout?: (item: ExerciseLibraryItem) => void;
}

export function ExercisesScreen({
  items,
  trackedIds,
  onOpenExercise,
  onToggleTracked,
  onAddToWorkout,
}: ExercisesScreenProps) {
  return (
    <View style={styles.content}>
      <ExerciseLibraryBrowser
        items={items}
        trackedIds={trackedIds}
        onOpenItem={onOpenExercise}
        onToggleTracked={onToggleTracked}
        onAddToWorkout={onAddToWorkout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    backgroundColor: HG.bg,
  },
});
