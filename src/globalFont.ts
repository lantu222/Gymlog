import { StyleSheet, Text, TextInput } from 'react-native';

/**
 * Applies the app typeface (Manrope) as the default font on every Text and
 * TextInput, and — crucially — maps each `fontWeight` to a real static Manrope
 * file instead of one variable font.
 *
 * React Native on Android does not drive a variable font's weight axis: the
 * bundled variable `Manrope.ttf` has an ExtraLight (200) default master, so
 * `fontWeight: '800'` rendered as ExtraLight with a synthetic bold — visibly
 * lighter than the design mocks (which drive the axis via CSS). Bundling the
 * static weights (see App.tsx Font.loadAsync) and selecting the right family
 * here makes weights render exactly like the designs on both platforms.
 *
 * React Native also has no font cascade — screens that set no family at all
 * would otherwise fall back to the platform font (Roboto on Android). This
 * patch is the single lever that unifies the whole app.
 *
 * An explicit non-Manrope family (e.g. JetBrains Mono numerals, or an explicit
 * static `Manrope-SemiBold`) is left untouched. Only the generic `'Manrope'`
 * family and unfamilied text get remapped by weight.
 */
const WEIGHT_TO_FAMILY: Record<string, string> = {
  '100': 'Manrope-Regular',
  '200': 'Manrope-Regular',
  '300': 'Manrope-Regular',
  '400': 'Manrope-Regular',
  '500': 'Manrope-Medium',
  '600': 'Manrope-SemiBold',
  '700': 'Manrope-Bold',
  '800': 'Manrope-ExtraBold',
  '900': 'Manrope-ExtraBold',
  normal: 'Manrope-Regular',
  bold: 'Manrope-Bold',
};

function familyForWeight(weight?: string | number | null): string {
  if (weight === undefined || weight === null) {
    return 'Manrope-Regular';
  }
  return WEIGHT_TO_FAMILY[String(weight)] ?? 'Manrope-Regular';
}

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

    const flat = (StyleSheet.flatten(element.props.style as never) || {}) as {
      fontFamily?: string;
      fontWeight?: string | number;
    };

    // Respect an explicit non-generic family (JetBrains Mono, an explicit
    // static Manrope weight, etc.). Only the generic 'Manrope' base and
    // unfamilied text are weight-mapped.
    if (typeof flat.fontFamily === 'string' && flat.fontFamily !== 'Manrope') {
      return element;
    }

    const family = familyForWeight(flat.fontWeight);

    return {
      ...element,
      props: {
        ...element.props,
        // Append so the resolved static family wins. The static file already
        // carries the weight, so force fontWeight normal to avoid Android
        // synthesizing a second bold on top of it.
        style: [element.props.style, { fontFamily: family, fontWeight: 'normal' as const }],
      },
    };
  };
  (patched as { __gainerFontPatched?: boolean }).__gainerFontPatched = true;

  component.render = patched;
}

applyBaseFont(Text as unknown as RenderableComponent);
applyBaseFont(TextInput as unknown as RenderableComponent);
