import { useCallback, useEffect, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView } from 'react-native';

import { TourSurface } from '../../lib/firstRunTour';
import { TourTargetRegistry, viewportOf } from './tourTargets';

/**
 * A screen's list, as the tour's scroller: the ref, the offset it is at, and
 * the scroll handler that keeps the ring following the page.
 *
 * Home is the only surface since 2026-10-03; the hook keeps the settle and
 * offset logic in one place. Spread the result onto the ScrollView; a screen that already keeps
 * a ref to its list uses the returned one instead.
 */
export function useTourScroller(surface: TourSurface, tourTargets: TourTargetRegistry | undefined) {
  const ref = useRef<ScrollView>(null);
  const offsetRef = useRef(0);

  useEffect(() => {
    if (!tourTargets) {
      return;
    }
    tourTargets.registerScroller(surface, {
      viewport: viewportOf(ref),
      getOffset: () => offsetRef.current,
      scrollToOffset: (offset, animated) => ref.current?.scrollTo({ y: offset, animated }),
      scrollToEnd: (animated) => ref.current?.scrollToEnd({ animated }),
    });
    return () => tourTargets.registerScroller(surface, null);
  }, [surface, tourTargets]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      offsetRef.current = event.nativeEvent.contentOffset.y;
      tourTargets?.notifyScroll();
    },
    [tourTargets],
  );

  return { ref, onScroll, scrollEventThrottle: 32 as const };
}
