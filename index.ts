// First, so the error handlers are in place before the rest of the app's
// modules are evaluated — an error thrown while they load is reported too.
import './src/features/errorReporting/installErrorReporting';
import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
