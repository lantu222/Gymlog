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

/**
 * Every write to the session row goes through here, one at a time, so that
 * "is this still the session I renewed?" and the write that follows it cannot
 * be split by a sign-out landing between them.
 */
let storageQueue: Promise<unknown> = Promise.resolve();
function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = storageQueue.then(task, task);
  storageQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * Bumped by every sign-out. A sign-in or a renewal notes it when it starts and
 * writes its session only if it is unchanged: one that finished after the
 * reader signed out (Reset), or after another account signed in, used to put
 * its session back (account audit, 2026-10-03).
 */
let signOutEpoch = 0;

/**
 * The name Apple gave for a sign-in that has not finished. Apple returns the
 * full name on the first authorization only — a later one carries none — so a
 * failed exchange or write would lose it for good. Kept here for the retry, and
 * on disk in the session's own row while that row holds no session (no new key:
 * the row is already the one this file owns, and a sign-out empties it).
 */
let pendingName: { user: string; name: string } | null = null;

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

async function rememberPendingName(user: string, name: string, epoch: number): Promise<void> {
  pendingName = { user, name };
  await exclusive(async () => {
    try {
      // Never over a session: that row is somebody's sign-in. Memory holds the name then.
      if (epoch === signOutEpoch && (await loadSession()) === null) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ pendingName }));
      }
    } catch {
      // Memory still holds it for a retry in this run.
    }
  });
}

async function pendingNameOf(user: string): Promise<string | null> {
  if (pendingName && pendingName.user === user) {
    return pendingName.name;
  }
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const kept = (raw ? (JSON.parse(raw) as { pendingName?: { user?: unknown; name?: unknown } } | null) : null)?.pendingName;
    if (kept && kept.user === user && typeof kept.name === 'string' && kept.name) {
      return kept.name;
    }
  } catch {
    // No kept name.
  }
  return null;
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
  const epoch = signOutEpoch;
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
  // The name is on this authorization only. Kept before anything that can
  // fail, and handed on once the sign-in has worked.
  const authorizedName = fullNameOf(credential.fullName);
  if (authorizedName) {
    await rememberPendingName(credential.user, authorizedName, epoch);
  }
  if (!credential.identityToken) {
    return { status: 'failed' };
  }
  const session = await exchangeAppleSession(credential.identityToken);
  if (!session.ok) {
    return { status: 'failed' };
  }
  // Read before the row is overwritten: a pending name kept on disk is in it.
  const keptName = authorizedName ?? (await pendingNameOf(credential.user));
  const written = await exclusive(async (): Promise<'written' | 'superseded' | 'failed'> => {
    if (epoch !== signOutEpoch) {
      // The reader signed out (Reset) while this was on its way: not theirs to keep.
      return 'superseded';
    }
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ user: credential.user, sessionToken: session.sessionToken, expiresAt: session.expiresAt }),
      );
      return 'written';
    } catch {
      return 'failed';
    }
  });
  if (written === 'superseded') {
    return { status: 'cancelled' };
  }
  if (written === 'failed') {
    return { status: 'failed' };
  }
  // The session row just written replaced the pending record; the name leaves
  // with the account, which the hook stores.
  const name = keptName;
  pendingName = null;
  return {
    status: 'signed_in',
    account: {
      sub: `${APPLE_SUB_PREFIX}${credential.user}`,
      email: credential.email ?? emailFromIdentityToken(credential.identityToken),
      name,
      idToken: session.sessionToken,
    },
  };
}

/**
 * The Apple session for a background backup, renewed in its last 30 days.
 * `signed_out` when Apple says the sign-in was revoked or the session has run
 * out (months offline): the reader signs in again, which is one Face ID, and
 * the backup hook says so rather than failing silently.
 *
 * `expectedUser` is the Apple user of the account the caller is acting for. A
 * session that is another user's is not this account's: it is never sent for
 * it, whatever left it on the phone.
 */
export async function getFreshAppleToken(expectedUser: string): Promise<FreshIdTokenResult> {
  const epoch = signOutEpoch;
  const session = await loadSession();
  if (!session || session.user !== expectedUser) {
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
      // Written only if this is still the session that was renewed: a sign-out
      // or another account's sign-in since the request went out has moved on,
      // and the old one must not come back.
      const outcome = await exclusive(async (): Promise<'written' | 'moved' | 'unkept'> => {
        if (epoch !== signOutEpoch) {
          return 'moved';
        }
        const current = await loadSession();
        if (!current || current.user !== session.user || current.sessionToken !== session.sessionToken) {
          return 'moved';
        }
        try {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          return 'written';
        } catch {
          return 'unkept';
        }
      });
      if (outcome === 'moved') {
        // Nothing of this call's is left standing; whoever asked is acting for
        // a sign-in that is no longer there, or another call renewed first.
        const now = epoch === signOutEpoch ? await loadSession() : null;
        if (now && now.user === expectedUser && Date.parse(now.expiresAt) - Date.now() >= EXPIRY_MARGIN_MS) {
          return { status: 'ok', idToken: now.sessionToken };
        }
        return { status: 'error' };
      }
      // 'unkept': not saved. This backup still uses the fresh one, the next renews again.
      return { status: 'ok', idToken: next.sessionToken };
    }
  }
  return { status: 'ok', idToken: session.sessionToken };
}

/**
 * Renews the session of this Apple user when it is inside its renewal window,
 * whether or not anything needs backing up. The renewal used to ride on a
 * backup only, so a phone that sat unused for the whole window ran the session
 * out and was signed out at its next change. A failure here is nothing: it is
 * tried again at the next foreground, and never signs anyone out.
 */
export async function renewAppleSessionIfDue(expectedUser: string): Promise<void> {
  try {
    const session = await loadSession();
    if (!session || session.user !== expectedUser) {
      return;
    }
    const remaining = Date.parse(session.expiresAt) - Date.now();
    if (remaining >= RENEW_WINDOW_MS || remaining < EXPIRY_MARGIN_MS) {
      return;
    }
    await getFreshAppleToken(expectedUser);
  } catch {
    // Offline or busy: the next foreground tries again.
  }
}

/** Apple has no app-side sign-out; forgetting the session is the whole of it. */
export async function signOutApple(): Promise<void> {
  // Synchronously, before any await: whatever is still on its way no longer
  // gets to write.
  signOutEpoch += 1;
  pendingName = null;
  await exclusive(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // A session that cannot be removed is still never sent: the account record is gone.
    }
  });
}
