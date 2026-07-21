// Metro config.
//
// Sole purpose: force every importer of `three` onto ONE build.
// three ships dual entry points (`import` -> build/three.module.js,
// `require` -> build/three.cjs). Our own ESM imports resolved to the module
// build while @react-three/fiber's CJS entry required the cjs build, so three
// was evaluated twice ("THREE.WARNING: Multiple instances of Three.js being
// imported") — double the classes in memory and a latent instanceof hazard.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const THREE_ENTRY = path.resolve(__dirname, 'node_modules/three/build/three.cjs');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') {
    return { type: 'sourceFile', filePath: THREE_ENTRY };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
