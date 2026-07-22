import { useEffect } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

/**
 * Keeps the screen on while a training surface is mounted and the
 * keepScreenAwakeDuringWorkout preference is enabled. Failure-tolerant like
 * the sound/haptics utils — a missing native module must never crash a
 * workout.
 */
export function useKeepScreenAwake(enabled: boolean, tag: string) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let active = false;
    activateKeepAwakeAsync(tag)
      .then(() => {
        active = true;
      })
      .catch(() => {
        // Keep-awake is a comfort feature; ignore activation failures.
      });

    return () => {
      if (active) {
        try {
          void deactivateKeepAwake(tag);
        } catch {
          // Same rule on the way out.
        }
      }
    };
  }, [enabled, tag]);
}
