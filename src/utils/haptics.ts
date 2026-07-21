import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Mirrors the user's "Haptics" preference; AppProvider keeps this in sync so
// every call site is gated centrally instead of threading a flag everywhere.
let enabled = true;

export function setHapticsEnabled(next: boolean) {
  enabled = next;
}

async function runSafely(action: () => Promise<void>) {
  if (Platform.OS === 'web' || !enabled) {
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
