import { Platform } from 'react-native';

/**
 * Platform health integration (Apple Health on iOS, Health Connect on Android).
 *
 * The native modules (`react-native-health` / `react-native-health-connect`)
 * are not installed yet — they need a config plugin + native rebuild. Until
 * then this module keeps the exact same surface the screens are wired to:
 * swap `readNativeHealthBasics` for the real permission request + reads and
 * nothing else changes.
 *
 * In dev builds `requestHealthBasics` resolves with preview data (mirroring
 * the AI Coach preview mode) so the connect → synced → about-you flow can be
 * exercised end to end in the emulator.
 */

export type HealthSex = 'male' | 'female';

export interface HealthBasics {
  weightKg: number | null;
  heightCm: number | null;
  sex: HealthSex | null;
  /** ISO date string (yyyy-mm-dd). */
  dateOfBirth: string | null;
}

export type HealthConnectResult =
  | { status: 'connected'; basics: HealthBasics }
  | { status: 'denied' }
  | { status: 'unavailable' };

const HEALTH_PREVIEW_MODE = __DEV__;

const PREVIEW_BASICS: HealthBasics = {
  weightKg: 78,
  heightCm: 180,
  sex: 'male',
  dateOfBirth: '1998-04-12',
};

export function getHealthProviderLabel(): string {
  return Platform.OS === 'android' ? 'Health Connect' : 'Apple Health';
}

export function getAgeFromDateOfBirth(dateOfBirth: string | null, now = new Date()): number | null {
  if (!dateOfBirth) {
    return null;
  }
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) {
    return null;
  }
  let age = now.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthday) {
    age -= 1;
  }
  return age >= 0 && age <= 120 ? age : null;
}

async function readNativeHealthBasics(): Promise<HealthConnectResult> {
  // Integration point: request HealthKit / Health Connect permissions and
  // read weight, height, biological sex and date of birth here once the
  // native module is installed.
  return { status: 'unavailable' };
}

export async function requestHealthBasics(): Promise<HealthConnectResult> {
  if (HEALTH_PREVIEW_MODE) {
    // Small delay so the connect button's busy state is visible in preview.
    await new Promise((resolve) => setTimeout(resolve, 700));
    return { status: 'connected', basics: PREVIEW_BASICS };
  }

  return readNativeHealthBasics();
}
