/**
 * One colour per programme, the same colour everywhere (design: GAINER
 * Hourglass Shape — "pohja kaikille ohjelmille", colour-coded).
 *
 * The browse screen used to colour covers by LIST POSITION (`index % 5`), so
 * the same programme wore a different colour in "Sinulle", in a category sheet
 * and in search results — and the detail hero ignored the system entirely,
 * painting every programme the same violet. Identity, not position: the index
 * is derived from the template id, so HUGE is HUGE-coloured on every surface
 * that shows it, forever.
 */

export interface ProgramCoverStyle {
  /** Browse-card cover gradient (light, lively). */
  cover: [string, string];
  /** Small tile gradient. */
  tile: [string, string];
  /**
   * Detail/day hero gradient — the same hue family driven dark enough that
   * white text passes on it. Hand-tuned rather than computed: a runtime
   * darken can land on a muddy midtone where white sits at ~3:1.
   */
  hero: [string, string];
  /** Single-stroke signature motif path. */
  motif: string;
}

export const LAYERS_MOTIF = 'M12 3l8 4.5-8 4.5-8-4.5 8-4.5z M4 12l8 4.5 8-4.5 M4 16.5l8 4.5 8-4.5';

export const PROGRAM_COVER_STYLES: ProgramCoverStyle[] = [
  {
    cover: ['#7699FB', '#2D48C0'],
    tile: ['#82A1F6', '#4767D3'],
    hero: ['#6B7FE0', '#1D2C7E'],
    motif: LAYERS_MOTIF,
  },
  {
    cover: ['#00B1E0', '#0068A2'],
    tile: ['#15B6DF', '#0083B7'],
    hero: ['#0B93BD', '#02466E'],
    motif: 'M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10',
  },
  {
    cover: ['#D179CA', '#8D1A89'],
    tile: ['#D285CB', '#A644A0'],
    hero: ['#B060AB', '#5C0E59'],
    motif: 'M12 3a9 9 0 100 18 9 9 0 000-18z M12 8a4 4 0 100 8 4 4 0 000-8z',
  },
  {
    cover: ['#37B976', '#007322'],
    tile: ['#55BD82', '#008D44'],
    hero: ['#249A5F', '#014D19'],
    motif: 'M13 2L4 14h7l-1 8 9-12h-7z',
  },
  {
    cover: ['#EB7A52', '#A71000'],
    tile: ['#E98664', '#BF4306'],
    hero: ['#C96040', '#6E0B00'],
    motif: 'M3 10.5 12 3l9 7.5 M5 9.5V20h14V9.5',
  },
];

/**
 * djb2 over the template id. Not a random pick: the SAME id must land on the
 * SAME style on every device, every session, with no stored state.
 */
export function programCoverIndex(templateId: string): number {
  let hash = 5381;
  for (let i = 0; i < templateId.length; i += 1) {
    hash = ((hash << 5) + hash + templateId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % PROGRAM_COVER_STYLES.length;
}

export function programCoverStyle(templateId: string): ProgramCoverStyle {
  return PROGRAM_COVER_STYLES[programCoverIndex(templateId)];
}

/**
 * The emphasis bar's fixed violet ramp (design: GAINER Hourglass Shape).
 *
 * Deliberately NOT the programme's identity hue: the bar is data tied to its
 * own legend, and four shades of one violet stay readable next to any hero
 * colour. Darkest goes to the largest slice. Shared because the detail card
 * and the sheet that edits it must paint the same bar.
 */
export const EMPHASIS_RAMP: Record<string, string> = {
  glutesLegs: '#7C3AED',
  shouldersBack: '#A98BF0',
  chestArms: '#CDBBF8',
  core: '#E6DBFB',
  // Conditioning and mobility are their own work, not a lighter shade of
  // lifting, so they step out of the violet ramp. Half of every "other" slice
  // in the catalog was running and intervals; a programme whose week is
  // genuinely cardio deserves to be told so, not shown a grey bar.
  conditioning: '#2E9E7B',
  mobility: '#4FA8D8',
  other: '#C9C3D6',
};
