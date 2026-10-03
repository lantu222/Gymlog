/**
 * Which build this is, registered before the app's own modules load (lib/appUpdateGate).
 *
 * Imported by index.ts right after the error handlers and before App: a crash while App's import
 * graph is evaluated is the case the crash key exists for, and its report reads the version and
 * platform from here. Registered at the bottom of App.tsx, after that graph, such a report said
 * neither (bug hunt 2026-10-03).
 *
 * Read from the app config the native build was made from, so it is the version the store shows;
 * the theme's copy (a module with no imports) is only the fallback for a run that has no config.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { appInfo } from '../../theme';
import { registerAppIdentity } from './appUpdateSignal';

registerAppIdentity(Constants.expoConfig?.version ?? appInfo.version, Platform.OS);
