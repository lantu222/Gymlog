import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

/**
 * Android's back key, answered by the screen's own back.
 *
 * The shell's route-level listener stands down while onboarding is open —
 * there is no route to pop — so a step that registered nothing let the key
 * fall through to Android's default, which closes the app. From the start
 * path, About you and the catalogue that was every answer so far, gone
 * (2026-09-17).
 *
 * Subscribed once, with the handler read through a ref: a fresh closure per
 * render neither goes stale nor re-subscribes, and re-subscribing is what
 * moves a listener to the front of BackHandler's stack.
 */
export function useHardwareBack(onBack: () => void) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBackRef.current();
      return true;
    });
    return () => subscription.remove();
  }, []);
}
