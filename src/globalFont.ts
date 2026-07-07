import { Text, TextInput } from 'react-native';

import { typography } from './theme';

/**
 * Applies the app typeface (Manrope) as the default font family on every Text
 * and TextInput, so screens that never set `fontFamily` explicitly still render
 * in the redesign typeface instead of the platform default (Roboto on Android).
 *
 * React Native has no font cascade: `typography.fontFamily` only affects styles
 * that reference it directly. Most screens (onboarding, home, profile) set no
 * family at all, which is why they drifted to the system font. Injecting the
 * base family here is the single lever that unifies the whole app.
 *
 * The base style is placed FIRST in the style array, so any explicit
 * `fontFamily` in a component's own styles (e.g. the workout logger) still wins.
 */
const baseFont = { fontFamily: typography.fontFamily } as const;

type RenderableComponent = {
  render?: (...args: unknown[]) => { props?: { style?: unknown } } | null;
};

function applyBaseFont(component: RenderableComponent) {
  const original = component.render;

  // Text/TextInput are forwardRef components with a `render` function. Class
  // components keep render on the prototype, so `component.render` is undefined
  // and we safely skip them.
  if (typeof original !== 'function' || (original as { __gainerFontPatched?: boolean }).__gainerFontPatched) {
    return;
  }

  const patched = function patchedRender(this: unknown, ...args: unknown[]) {
    const element = original.apply(this, args);
    if (!element || !element.props) {
      return element;
    }

    return {
      ...element,
      props: {
        ...element.props,
        style: [baseFont, element.props.style],
      },
    };
  };
  (patched as { __gainerFontPatched?: boolean }).__gainerFontPatched = true;

  component.render = patched;
}

applyBaseFont(Text as unknown as RenderableComponent);
applyBaseFont(TextInput as unknown as RenderableComponent);
