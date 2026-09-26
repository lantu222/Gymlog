/**
 * What state a channel-backed notification surface is in, for the reader.
 *
 * Android's app-wide permission and a channel's own importance are two
 * separate switches: a reader can grant Vinha permission to notify and still
 * mute one channel (Settings -> Apps -> Vinha -> Notifications -> Rest
 * alerts -> Off). Code that asked only `getPermissionsAsync` could not tell
 * the two apart, so a muted channel read as "allowed" in one place and a
 * refused permission's own copy showed for a muted channel in another
 * (#bugs, 2026-09-26). This is the one place that tells them apart, so a
 * screen can say which is actually true instead of guessing from one flag.
 *
 * Pure: the native reads (getPermissionsAsync, getNotificationChannelAsync)
 * stay in src/utils; this only resolves what they already found.
 */
export type NotificationAccessState = 'granted' | 'denied' | 'channelMuted';

export function resolveNotificationAccessState(input: {
  /** The OS notification permission for the app. */
  permissionGranted: boolean;
  /** The one channel this surface cares about, switched off in system settings. */
  channelMuted: boolean;
}): NotificationAccessState {
  // A refused permission is the coarser problem: nothing on any channel can
  // reach the reader, whatever a single channel's own importance says.
  if (!input.permissionGranted) {
    return 'denied';
  }
  return input.channelMuted ? 'channelMuted' : 'granted';
}
