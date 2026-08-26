// Babel config.
//
// A @babel/plugin-transform-class-static-block entry lived here for three's
// CJS build (static class blocks); three left with the 3D rig 2026-08-26.
// The file stays because babel-preset-expo lives under expo/node_modules
// rather than the root, so it is resolved through `expo` instead of by bare
// name — a bare 'babel-preset-expo' string fails with "Cannot find module"
// from the root config.
module.exports = function (api) {
  api.cache(true);

  return {
    presets: [require.resolve('babel-preset-expo', { paths: [require.resolve('expo/package.json')] })],
  };
};
