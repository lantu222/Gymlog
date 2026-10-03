// First, so the error handlers are in place before the rest of the app's
// modules are evaluated. An error thrown while they load is handed to the
// reporter, which stores it under its own key (analyticsClient CRASH_KEY) and
// sends it on the next launch if the reader's statistics switch allows; the
// write is issued, not guaranteed to finish before the process ends.
import './src/features/errorReporting/installErrorReporting';
import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
