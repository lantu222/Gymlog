import type { I18nKey } from './i18n';

/**
 * Which store the reader's phone buys, reviews and manages subscriptions in.
 *
 * Pure: the screens pass Platform.OS in. Everything that used to hard-code
 * Google Play — the listing link, "Manage in Google Play", the payment-method
 * page, the receipts line — asks here instead, so an iPhone never sends the
 * reader to a store their phone cannot open.
 */
export type StorePlatform = 'android' | 'ios';

export function storePlatformOf(os: string): StorePlatform {
  return os === 'ios' ? 'ios' : 'android';
}

export const PLAY_LISTING_URL = 'https://play.google.com/store/apps/details?id=app.vinha';

/**
 * The app's own store page, or null when there is none to link yet: the App
 * Store URL carries an id Apple assigns when the listing is created, so it is
 * configuration (EXPO_PUBLIC_APP_STORE_URL), not a constant.
 */
export function storeListingUrl(platform: StorePlatform, appStoreUrl: string | null | undefined): string | null {
  if (platform === 'android') {
    return PLAY_LISTING_URL;
  }
  const url = (appStoreUrl ?? '').trim();
  return url.startsWith('https://apps.apple.com/') ? url : null;
}

export function manageSubscriptionsUrl(platform: StorePlatform): string {
  return platform === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions';
}

export function paymentMethodsUrl(platform: StorePlatform): string {
  return platform === 'ios' ? 'https://apps.apple.com/account/billing' : 'https://play.google.com/store/paymentmethods';
}

/**
 * App Review wants the system review prompt on iPhone and allows no custom
 * one in front of it (guideline 5.6.1), so the star sheet is Android's alone.
 */
export function usesSystemReviewPrompt(platform: StorePlatform): boolean {
  return platform === 'ios';
}

/** The invite text, with the store link on its own line when there is one. */
export function inviteMessage(text: string, listingUrl: string | null): string {
  return listingUrl ? `${text}\n${listingUrl}` : text;
}

/** Store-specific copy: the Play wording on Android, Apple's on iPhone. */
const APP_STORE_KEYS: Partial<Record<I18nKey, I18nKey>> = {
  'subs.row.play': 'subs.row.appStore',
  'subs.row.playSub': 'subs.row.appStoreSub',
  'subs.foot.play': 'subs.foot.appStore',
  'subs.pay.gplay': 'subs.pay.appleBalance',
  'subs.receipts.sub': 'subs.receipts.subAppStore',
};

export function storeTextKey(key: I18nKey, platform: StorePlatform): I18nKey {
  return platform === 'ios' ? APP_STORE_KEYS[key] ?? key : key;
}

/**
 * Where a "Rate Vinha" press goes on iPhone: the listing's write-review page.
 * Null until the App Store URL is configured — then the row is hidden rather
 * than a button that opens nothing.
 */
export function writeReviewUrl(platform: StorePlatform, appStoreUrl: string | null | undefined): string | null {
  const listing = storeListingUrl(platform, appStoreUrl);
  if (!listing || platform !== 'ios') {
    return listing;
  }
  return `${listing}${listing.includes('?') ? '&' : '?'}action=write-review`;
}
