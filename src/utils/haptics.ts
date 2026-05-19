import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

async function runSafely(action: () => Promise<void>) {
  if (Platform.OS === 'web') {
    return;
  }

  try {
    await action();
  } catch {
    // Haptics can be unavailable on some devices, emulators, or OS settings.
  }
}

export const haptics = {
  select: () => runSafely(() => Haptics.selectionAsync()),
  success: () => runSafely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => runSafely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  impactLight: () => runSafely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  impactMedium: () => runSafely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
};
