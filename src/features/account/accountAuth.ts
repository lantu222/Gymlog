/**
 * Which sign-in the account backup uses: Google everywhere it is configured,
 * and Sign in with Apple on iPhone — App Review asks for Apple's beside any
 * other third-party sign-in (guideline 4.8).
 *
 * The backup hook talks to this file only. Which provider the phone is
 * signed in with is not stored twice: an Apple session on the phone means an
 * Apple account (appleAuth), anything else is Google.
 */
import {
  getFreshAppleToken,
  hasAppleSession,
  isAppleSignInConfigured,
  signInWithApple,
  signOutApple,
} from './appleAuth';
import type { FreshIdTokenResult, GoogleSignInResult } from './googleAuth';
import { getFreshIdToken as getFreshGoogleToken, isGoogleSignInConfigured, signInWithGoogle, signOutGoogle } from './googleAuth';

export type SignInProvider = 'google' | 'apple';
export type SignInResult = GoogleSignInResult;

/** The providers this build offers, in the order the screens show them: Apple first, as Apple asks. */
export function availableSignInProviders(): SignInProvider[] {
  const providers: SignInProvider[] = [];
  if (isAppleSignInConfigured()) {
    providers.push('apple');
  }
  if (isGoogleSignInConfigured()) {
    providers.push('google');
  }
  return providers;
}

export function isAccountSignInConfigured(): boolean {
  return availableSignInProviders().length > 0;
}

export async function signInWith(provider: SignInProvider): Promise<SignInResult> {
  if (!availableSignInProviders().includes(provider)) {
    return { status: 'unavailable' };
  }
  if (provider === 'apple') {
    return signInWithApple();
  }
  const result = await signInWithGoogle();
  if (result.status === 'signed_in') {
    // A Google account now: a session left from an Apple one must not route its backups.
    await signOutApple();
  }
  return result;
}

export async function getFreshIdToken(): Promise<FreshIdTokenResult> {
  return (await hasAppleSession()) ? getFreshAppleToken() : getFreshGoogleToken();
}

export async function signOutAccount(): Promise<void> {
  await signOutApple();
  if (isGoogleSignInConfigured()) {
    await signOutGoogle();
  }
}
