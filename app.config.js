/**
 * app.json plus the one value that cannot live in it: the iOS Google
 * Sign-In URL scheme, derived from EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.
 *
 * Without that id an iOS build still prebuilds, and googleAuth.ts treats
 * sign-in as absent on iOS — no dead buttons, and no native crash from a
 * missing URL scheme. Android is untouched: its plugin entry stays as
 * app.json writes it unless the id is set.
 */
const IOS_CLIENT_ID = (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '').trim();
const GOOGLE_PLUGIN = '@react-native-google-signin/google-signin';

/** `123-abc.apps.googleusercontent.com` → `com.googleusercontent.apps.123-abc` */
function iosUrlScheme(clientId) {
  const suffix = '.apps.googleusercontent.com';
  const id = clientId.endsWith(suffix) ? clientId.slice(0, -suffix.length) : clientId;
  return `com.googleusercontent.apps.${id}`;
}

module.exports = ({ config }) => {
  if (!IOS_CLIENT_ID) {
    return config;
  }
  return {
    ...config,
    plugins: config.plugins.map((plugin) => {
      const [name, options] = Array.isArray(plugin) ? plugin : [plugin, undefined];
      return name === GOOGLE_PLUGIN ? [GOOGLE_PLUGIN, { ...options, iosUrlScheme: iosUrlScheme(IOS_CLIENT_ID) }] : plugin;
    }),
  };
};

module.exports.iosUrlScheme = iosUrlScheme;
