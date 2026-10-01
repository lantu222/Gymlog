/**
 * The one place the app touches Sign in with Apple. iPhone only.
 *
 * Apple's identity token lives ten minutes and Apple has no silent refresh, so
 * the token is traded once, at sign-in, for the backup server's Apple session
 * (api/backup.ts). That session is what every later backup sends. Before
 * sending it the phone asks Apple whether the sign-in still stands: a reader
 * who removed Vinha under Settings → Apple ID is signed out here as well.
 *
 * Like googleAuth, the native module is required lazily: a build without it
 * reports `unavailable` instead of crashing on import.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { exchangeAppleSession, renewAppleSession } from './backupApi';
import type { FreshIdTokenResult, GoogleSignInResult } from './googleAuth';

const STORAGE_KEY = '@vinha/account/apple/v1';

/** Apple subjects are kept apart from Google's: the server stores them as `apple:<sub>` too. */
export const APPLE_SUB_PREFIX = 'apple:';

/** Within this of the server's expiry, a backup first trades the session for a fresh one. */
const RENEW_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
/** And within this, the session is not sent at all: it could run out on the way. */
const EXPIRY_MARGIN_MS = 60 * 60 * 1000;

interface StoredAppleSession {
  user: string;
  sessionToken: string;
  expiresAt: string;
}

/** The slice of expo-apple-authentication this file calls, typed by hand like googleAuth's. */
interface AppleAuthModule {
  isAvailableAsync(): Promise<boolean>;
  signInAsync(options: { requestedScopes: number[] }): Promise<{
    user: string;
    identityToken: string | null;
    email: string | null;
    fullName: { givenName: string | null; familyName: string | null } | null;
  }>;
  getCredentialStateAsync(user: string): Promise<number>;
}

// The library's enum values (AppleAuthentication.types).
const SCOPE_FULL_NAME = 0;
const SCOPE_EMAIL = 1;
const CREDENTIAL_AUTHORIZED = 1;
const CREDENTIAL_TRANSFERRED = 3;

function loadModule(): AppleAuthModule | null {
  if (Platform.OS !== 'ios') {
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-apple-authentication') as AppleAuthModule;
  } catch {
    return null;
  }
}

/** Synchronous gate for the screens: an iPhone build that carries the module. */
export function isAppleSignInConfigured(): boolean {
  return loadModule() !== null;
}

async function loadSession(): Promise<StoredAppleSession | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredAppleSession> | null;
    if (
      !parsed ||
      typeof parsed.user !== 'string' ||
      !parsed.user ||
      typeof parsed.sessionToken !== 'string' ||
      !parsed.sessionToken ||
      typeof parsed.expiresAt !== 'string' ||
      !Number.isFinite(Date.parse(parsed.expiresAt))
    ) {
      return null;
    }
    return { user: parsed.user, sessionToken: parsed.sessionToken, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

/** True when this phone's account is an Apple one: the backup token comes from here. */
export async function hasAppleSession(): Promise<boolean> {
  return (await loadSession()) !== null;
}

function fullNameOf(fullName: { givenName: string | null; familyName: string | null } | null): string | null {
  const name = [fullName?.givenName, fullName?.familyName].filter((part): part is string => !!part).join(' ').trim();
  return name || null;
}

/** The email claim from the identity token: Apple sends `email` on the credential only the first time. */
function emailFromIdentityToken(identityToken: string): string | null {
  try {
    const payload = identityToken.split('.')[1];
    if (!payload) {
      return null;
    }
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(globalThis.atob ? globalThis.atob(normalized) : Buffer.from(normalized, 'base64').toString('utf8')) as {
      email?: unknown;
    };
    return typeof decoded.email === 'string' && decoded.email ? decoded.email : null;
  } catch {
    return null;
  }
}

export async function signInWithApple(): Promise<GoogleSignInResult> {
  const module = loadModule();
  if (!module) {
    return { status: 'unavailable' };
  }
  let credential;
  try {
    if (!(await module.isAvailableAsync())) {
      return { status: 'unavailable' };
    }
    credential = await module.signInAsync({ requestedScopes: [SCOPE_FULL_NAME, SCOPE_EMAIL] });
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    return { status: code === 'ERR_REQUEST_CANCELED' ? 'cancelled' : 'failed' };
  }
  if (!credential.identityToken) {
    return { status: 'failed' };
  }
  const session = await exchangeAppleSession(credential.identityToken);
  if (!session.ok) {
    return { status: 'failed' };
  }
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ user: credential.user, sessionToken: session.sessionToken, expiresAt: session.expiresAt }),
    );
  } catch {
    return { status: 'failed' };
  }
  return {
    status: 'signed_in',
    account: {
      sub: `${APPLE_SUB_PREFIX}${credential.user}`,
      email: credential.email ?? emailFromIdentityToken(credential.identityToken),
      name: fullNameOf(credential.fullName),
      idToken: session.sessionToken,
    },
  };
}

/**
 * The Apple session for a background backup, renewed in its last 30 days.
 * `signed_out` when Apple says the sign-in was revoked or the session has run
 * out (months offline): the reader signs in again, which is one Face ID, and
 * the backup hook says so rather than failing silently.
 */
export async function getFreshAppleToken(): Promise<FreshIdTokenResult> {
  const session = await loadSession();
  if (!session) {
    return { status: 'signed_out' };
  }
  const remaining = Date.parse(session.expiresAt) - Date.now();
  if (remaining < EXPIRY_MARGIN_MS) {
    // A phone that stayed offline for months: one Face ID gets a new one.
    return { status: 'signed_out' };
  }
  const module = loadModule();
  if (module) {
    try {
      const state = await module.getCredentialStateAsync(session.user);
      if (state !== CREDENTIAL_AUTHORIZED && state !== CREDENTIAL_TRANSFERRED) {
        return { status: 'signed_out' };
      }
    } catch {
      // Apple could not be asked (offline, most likely). The session itself is
      // still the server's to judge, so the backup goes ahead.
    }
  }
  if (remaining < RENEW_WINDOW_MS) {
    // Sliding, like Google's silent refresh: a reader who keeps training is
    // never timed out. A failed renewal is tried again on the next backup.
    const renewed = await renewAppleSession(session.sessionToken);
    if (renewed.ok) {
      const next = { user: session.user, sessionToken: renewed.sessionToken, expiresAt: renewed.expiresAt };
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Not kept: this backup still uses the fresh one, the next renews again.
      }
      return { status: 'ok', idToken: next.sessionToken };
    }
  }
  return { status: 'ok', idToken: session.sessionToken };
}

/** Apple has no app-side sign-out; forgetting the session is the whole of it. */
export async function signOutApple(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // A session that cannot be removed is still never sent: the account record is gone.
  }
}
