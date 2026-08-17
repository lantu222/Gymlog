import { NativeModule, requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

/**
 * The app's side of the home-screen widget's "add me" flow.
 *
 * Optional on purpose: the module only exists on Android, and a JS bundle
 * running anywhere else (or an older native build that predates it) must
 * degrade to "not supported" rather than throw.
 */
declare class HomeWidgetNativeModule extends NativeModule {
  isSupported(): Promise<boolean>;
  isAdded(): Promise<boolean>;
  requestPin(): Promise<boolean>;
  refresh(): Promise<boolean>;
}

const native = requireOptionalNativeModule<HomeWidgetNativeModule>('HomeWidget');

/** True when this device can show the system's "add widget" dialog. */
export async function isHomeWidgetSupported(): Promise<boolean> {
  if (Platform.OS !== 'android' || !native) {
    return false;
  }
  try {
    return await native.isSupported();
  } catch {
    return false;
  }
}

/** True when the widget is already sitting on a home screen. */
export async function isHomeWidgetAdded(): Promise<boolean> {
  if (Platform.OS !== 'android' || !native) {
    return false;
  }
  try {
    return await native.isAdded();
  } catch {
    return false;
  }
}

/**
 * Opens the system dialog. Resolves with whether the dialog was shown, which
 * is not the same as the user accepting it — Android does not say. Callers
 * must not report success on the strength of this.
 */
export async function requestPinHomeWidget(): Promise<boolean> {
  if (Platform.OS !== 'android' || !native) {
    return false;
  }
  try {
    return await native.requestPin();
  } catch {
    return false;
  }
}

/**
 * Redraws the widgets now, instead of whenever Android next gets round to it.
 *
 * Android's own floor is 30 minutes, and that was documented as the price of
 * having no native module at all. It is the wrong price to keep paying now that
 * there is one: the widget spent that window insisting a reader with a full
 * training history should "create your first program", because a payload
 * version bump made the file it had unreadable and nothing asked it to look
 * again.
 *
 * Broadcasting APPWIDGET_UPDATE from outside the app is blocked; sending it to
 * our own receivers, by explicit component, is not.
 */
export async function refreshHomeWidget(): Promise<boolean> {
  if (Platform.OS !== 'android' || !native) {
    return false;
  }
  try {
    return await native.refresh();
  } catch {
    return false;
  }
}
