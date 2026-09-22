/**
 * WCAG 2.x contrast, computed from the colours the app actually paints.
 *
 * The accessibility audit of 2026-09-21 measured every text-on-fill pair by
 * hand and found a dozen under 4.5:1 — white on the light theme's green start
 * button, the light `faint` ink on its own page, white on the dark theme's
 * violets. A number measured by hand is true on the day it is measured. This
 * is the same arithmetic as a function, so a test can hold the tokens to it
 * and the next palette edit is measured when it is made.
 *
 * A test helper, not a src/lib module: nothing in the app decides a colour at
 * run time from a ratio (readableOn is a cheaper light-or-dark question), and
 * a lib module only a test imports is the dead code the dead-code guard
 * exists to catch.
 *
 * Pure: strings in, numbers out. Hex (#RGB, #RRGGBB) and rgba() are read; an
 * rgba foreground is composited over the background first, because that is
 * what the screen shows.
 */

function parseColour(colour) {
  const value = String(colour).trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const digits =
      hex[1].length === 3
        ? hex[1]
            .split('')
            .map((char) => char + char)
            .join('')
        : hex[1];
    return {
      rgb: [0, 2, 4].map((offset) => Number.parseInt(digits.slice(offset, offset + 2), 16)),
      alpha: 1,
    };
  }
  const rgba = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(value);
  if (rgba) {
    return {
      rgb: [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])],
      alpha: rgba[4] === undefined ? 1 : Number(rgba[4]),
    };
  }
  throw new Error(`Unreadable colour: ${colour}`);
}

function toHex(rgb) {
  return `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** `foreground` laid over an opaque `background`, as a solid hex colour. */
function compositeOver(foreground, background) {
  const fg = parseColour(foreground);
  const bg = parseColour(background);
  if (bg.alpha < 1) {
    throw new Error(`The background must be opaque: ${background}`);
  }
  return toHex(fg.rgb.map((channel, index) => channel * fg.alpha + bg.rgb[index] * (1 - fg.alpha)));
}

function relativeLuminance(colour) {
  const linear = (channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = parseColour(colour).rgb;
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/**
 * The contrast ratio of `foreground` on `background`, 1 to 21. `background`
 * must be opaque — composite a translucent wash with `compositeOver` first,
 * over whatever sits under it.
 */
function contrastRatio(foreground, background) {
  const bg = compositeOver(background, '#000000');
  if (parseColour(background).alpha < 1) {
    throw new Error(`The background must be opaque: ${background}`);
  }
  const fg = compositeOver(foreground, bg);
  const lighter = Math.max(relativeLuminance(fg), relativeLuminance(bg));
  const darker = Math.min(relativeLuminance(fg), relativeLuminance(bg));
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG AA: body text needs 4.5:1; large text (18.66px bold, 24px) and UI parts 3:1. */
const WCAG_AA_TEXT = 4.5;
const WCAG_AA_LARGE = 3;

module.exports = { contrastRatio, compositeOver, WCAG_AA_TEXT, WCAG_AA_LARGE };
