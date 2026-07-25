// three ships class static blocks (`class Vector2 { static { … } }`) in its
// CJS build, which metro.config.js pins every importer to. Without this file
// that transform is off and the bundle dies with "Static class blocks are not
// enabled" before any app code runs.
//
// babel-preset-expo lives under expo/node_modules rather than the root, so it
// is resolved through `expo` instead of by bare name — a bare 'babel-preset-expo'
// string fails with "Cannot find module" from the root config.
module.exports = function (api) {
  api.cache(true);

  return {
    presets: [require.resolve('babel-preset-expo', { paths: [require.resolve('expo/package.json')] })],
    plugins: [require.resolve('@babel/plugin-transform-class-static-block')],
  };
};
