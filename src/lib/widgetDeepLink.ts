/**
 * The links the home-screen widget hands back to the app.
 *
 * The widget cannot navigate — it can only ask Android to open a URL. So each
 * tap target carries a slug, and the app resolves that slug against live state
 * when it opens. Deliberately not an id: the file the widget reads can be half
 * an hour old, and a session id baked into a link would name whatever was true
 * when it was written.
 *
 * Kept as a pure function so the parsing is covered by tests rather than by
 * building the APK and tapping things.
 */
import type { HomeWidgetTarget } from './widgetPayload';

/**
 * Matches the `scheme` in app.json and LINK_PREFIX in
 * plugins/withHomeWidget.js, which is where the URL is actually built — the
 * launcher process cannot import this file.
 */
export const WIDGET_LINK_PREFIX = 'vinha://widget/';

const TARGETS: HomeWidgetTarget[] = ['session', 'suggestion', 'calendar', 'home', 'programs', 'schedule'];

/**
 * The target a URL asks for, or null when the URL is not one of ours.
 *
 * Returns null rather than a default on anything unrecognised: an unknown slug
 * means a newer widget is talking to an older app, and guessing a destination
 * for it would be worse than opening where the reader left off.
 */
export function parseWidgetDeepLink(url: string | null | undefined): HomeWidgetTarget | null {
  if (typeof url !== 'string' || url.length === 0) {
    return null;
  }

  const lower = url.trim().toLowerCase();
  if (!lower.startsWith(WIDGET_LINK_PREFIX)) {
    return null;
  }

  // Tolerate a trailing slash, a query string or a fragment — none of them are
  // ours, but a launcher or an OS version appending one must not break the tap.
  const slug = lower.slice(WIDGET_LINK_PREFIX.length).split(/[/?#]/)[0] ?? '';
  return TARGETS.find((target) => target === slug) ?? null;
}
