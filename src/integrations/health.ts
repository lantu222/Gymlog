import { Platform } from 'react-native';

/**
 * Platform health integration — Health Connect on Android, Apple Health later.
 *
 * This used to fabricate "synced" data in dev builds: every user who tapped
 * Connect was shown 78 kg / 180 cm / male / 12.4.1998 as their own, imported
 * from a service the app never talked to. That is gone. The only values this
 * module ever returns are ones Health Connect actually handed over, and when
 * it hands over nothing, the caller gets nulls and says so.
 *
 * Health Connect stores no gender or date of birth — those fields exist on
 * HealthBasics for a future HealthKit path and stay null on Android. The
 * onboarding copy must not promise them.
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

/**
 * Whether this device can talk to Health Connect at all.
 *
 * Worth knowing *before* the screen offers to connect: a full-width CTA that
 * cannot possibly work is a promise the device will break. `update_required`
 * is separate from `unsupported` because it is the user's to fix — Health
 * Connect is there, it is just older than the SDK we call.
 */
export type HealthAvailability = 'available' | 'update_required' | 'unsupported';

/** True when the connection actually delivered at least one value. */
export function hasAnyHealthBasics(basics: HealthBasics | null): boolean {
  return (
    basics !== null &&
    (basics.weightKg !== null || basics.heightCm !== null || basics.sex !== null || basics.dateOfBirth !== null)
  );
}

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

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

async function readHealthConnectBasics(): Promise<HealthConnectResult> {
  // Lazy require: the module only exists in native builds, and the test build
  // compiles this file for Node where the import would throw at load time.
  const healthConnect = require('react-native-health-connect') as typeof import('react-native-health-connect');
  const { getSdkStatus, initialize, readRecords, requestPermission, SdkAvailabilityStatus } = healthConnect;

  const sdkStatus = await getSdkStatus();
  if (sdkStatus !== SdkAvailabilityStatus.SDK_AVAILABLE) {
    return { status: 'unavailable' };
  }

  const initialized = await initialize();
  if (!initialized) {
    return { status: 'unavailable' };
  }

  const granted = await requestPermission([
    { accessType: 'read', recordType: 'Weight' },
    { accessType: 'read', recordType: 'Height' },
  ]);
  const grantedTypes = new Set(granted.map((permission) => permission.recordType));
  if (!grantedTypes.has('Weight') && !grantedTypes.has('Height')) {
    return { status: 'denied' };
  }

  // Newest record wins; a year is far enough back for "current" body stats.
  const timeRangeFilter = {
    operator: 'between' as const,
    startTime: new Date(Date.now() - 365 * 86400000).toISOString(),
    endTime: new Date().toISOString(),
  };

  let weightKg: number | null = null;
  if (grantedTypes.has('Weight')) {
    const { records } = await readRecords('Weight', { timeRangeFilter, ascendingOrder: false, pageSize: 1 });
    const kilograms = records[0]?.weight?.inKilograms;
    if (typeof kilograms === 'number' && Number.isFinite(kilograms) && kilograms > 0) {
      weightKg = roundTo(kilograms, 1);
    }
  }

  let heightCm: number | null = null;
  if (grantedTypes.has('Height')) {
    const { records } = await readRecords('Height', { timeRangeFilter, ascendingOrder: false, pageSize: 1 });
    const meters = records[0]?.height?.inMeters;
    if (typeof meters === 'number' && Number.isFinite(meters) && meters > 0) {
      heightCm = Math.round(meters * 100);
    }
  }

  return {
    status: 'connected',
    // Health Connect has no gender or birth date; these stay null and the
    // user fills them in on the next screen.
    basics: { weightKg, heightCm, sex: null, dateOfBirth: null },
  };
}

export async function getHealthAvailability(): Promise<HealthAvailability> {
  if (Platform.OS !== 'android') {
    return 'unsupported';
  }

  try {
    const healthConnect = require('react-native-health-connect') as typeof import('react-native-health-connect');
    const { getSdkStatus, SdkAvailabilityStatus } = healthConnect;
    const sdkStatus = await getSdkStatus();
    if (sdkStatus === SdkAvailabilityStatus.SDK_AVAILABLE) {
      return 'available';
    }
    if (sdkStatus === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
      return 'update_required';
    }
    return 'unsupported';
  } catch (error) {
    console.warn('Health Connect status check failed', error);
    return 'unsupported';
  }
}

/**
 * Opens Health Connect's own settings.
 *
 * This is the only place a user can say which apps feed Health Connect —
 * Vinha cannot enumerate or choose sources itself, it only reads whatever
 * landed there. When we import nothing, this is the route out of the dead end:
 * it is where Samsung Health gets switched on as a writer.
 *
 * Returns false when the screen has nowhere to send the user.
 */
export async function openHealthSettings(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  try {
    const healthConnect = require('react-native-health-connect') as typeof import('react-native-health-connect');
    healthConnect.openHealthConnectSettings();
    return true;
  } catch (error) {
    console.warn('Opening Health Connect settings failed', error);
    return false;
  }
}

export async function requestHealthBasics(): Promise<HealthConnectResult> {
  if (Platform.OS !== 'android') {
    // HealthKit is a later integration; claiming otherwise would be the old lie.
    return { status: 'unavailable' };
  }

  try {
    return await readHealthConnectBasics();
  } catch (error) {
    console.warn('Health Connect read failed', error);
    return { status: 'unavailable' };
  }
}
