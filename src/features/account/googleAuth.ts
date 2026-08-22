/**
 * The one place the app touches Google Sign-In.
 *
 * Two gates decide whether the feature exists in this build:
 * - EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID — without it there is no OAuth client to
 *   sign in against, and every screen treats the feature as absent. No dead
 *   buttons: a build without the id shows no sign-in card anywhere.
 * - The native module itself. It arrives with a prebuild; a dev client built
 *   before it is added would crash on a top-level import, so the require is
 *   lazy and a missing module reports `unavailable` instead of throwing.
 */
export interface GoogleAccount {
  /** Google's stable subject — the backup key. Never shown to the user. */
  sub: string;
  email: string | null;
  name: string | null;
  /** Short-lived ID token the backup endpoint verifies. */
  idToken: string;
}

export type GoogleSignInResult =
  | { status: 'signed_in'; account: GoogleAccount }
  | { status: 'cancelled' }
  | { status: 'unavailable' }
  | { status: 'failed' };

const WEB_CLIENT_ID = (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '').trim();

export function isGoogleSignInConfigured(): boolean {
  return WEB_CLIENT_ID.length > 0;
}

/**
 * The slice of the library this file actually calls, typed by hand: the
 * package ships ESM-only types that a CJS-mode `typeof import` cannot name,
 * and the lazy require below erases them anyway.
 */
interface GoogleSigninModule {
  GoogleSignin: {
    configure(options: { webClientId: string }): void;
    hasPlayServices(options?: { showPlayServicesUpdateDialog?: boolean }): Promise<boolean>;
    signIn(): Promise<
      | { type: 'success'; data: { idToken: string | null; user: { id: string; email: string | null; name: string | null } } }
      | { type: 'cancelled'; data: null }
    >;
    signInSilently(): Promise<
      | { type: 'success'; data: { idToken: string | null; user: { id: string; email: string | null; name: string | null } } }
      | { type: 'noSavedCredentialFound'; data: null }
    >;
    signOut(): Promise<unknown>;
  };
}

let configured = false;

function loadModule(): GoogleSigninModule | null {
  if (!isGoogleSignInConfigured()) {
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const loaded = require('@react-native-google-signin/google-signin') as GoogleSigninModule;
    if (!configured) {
      loaded.GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
      configured = true;
    }
    return loaded;
  } catch {
    // The build predates the native module (no prebuild yet).
    return null;
  }
}

function decodeSubFromIdToken(idToken: string): string | null {
  try {
    const payload = idToken.split('.')[1];
    if (!payload) {
      return null;
    }
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(globalThis.atob ? globalThis.atob(normalized) : Buffer.from(normalized, 'base64').toString('utf8')) as {
      sub?: string;
    };
    return typeof decoded.sub === 'string' && decoded.sub ? decoded.sub : null;
  } catch {
    return null;
  }
}

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  const module = loadModule();
  if (!module) {
    return { status: 'unavailable' };
  }
  try {
    await module.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await module.GoogleSignin.signIn();
    if (response.type === 'cancelled') {
      return { status: 'cancelled' };
    }
    const idToken = response.data.idToken;
    if (!idToken) {
      return { status: 'failed' };
    }
    const sub = decodeSubFromIdToken(idToken) ?? response.data.user.id;
    return {
      status: 'signed_in',
      account: {
        sub,
        email: response.data.user.email ?? null,
        name: response.data.user.name ?? null,
        idToken,
      },
    };
  } catch {
    return { status: 'failed' };
  }
}

/**
 * A fresh short-lived ID token for a background backup, without UI. Returns
 * null when the session is gone — the caller downgrades to signed-out and the
 * next backup asks the user to sign in again, rather than failing silently
 * forever.
 */
export async function getFreshIdToken(): Promise<string | null> {
  const module = loadModule();
  if (!module) {
    return null;
  }
  try {
    const response = await module.GoogleSignin.signInSilently();
    if (response.type !== 'success') {
      return null;
    }
    return response.data.idToken ?? null;
  } catch {
    return null;
  }
}

export async function signOutGoogle(): Promise<void> {
  const module = loadModule();
  if (!module) {
    return;
  }
  try {
    await module.GoogleSignin.signOut();
  } catch {
    // Signing out of a session that is already gone is still signed out.
  }
}
