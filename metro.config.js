// Metro config.
//
// Plain Expo defaults. A `three` single-entry override lived here while the
// 3D exercise rig did (see git history); the rig and its dependencies were
// removed 2026-08-26 ("poistetaan kaikki 3d videot"), and the file stays so
// the next override has a documented home.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
