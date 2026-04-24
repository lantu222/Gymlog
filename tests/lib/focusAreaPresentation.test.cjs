const assert = require('node:assert/strict');

const {
  getFocusAreaPresentationOptions,
} = require('../../.test-dist/lib/focusAreaPresentation.js');

module.exports = [
  {
    name: 'focus area presentation exposes consistent Step 6 image options',
    run() {
      const options = getFocusAreaPresentationOptions();

      assert.deepEqual(
        options.map((option) => option.area),
        ['glutes', 'legs', 'chest', 'shoulders', 'back', 'arms', 'core', 'conditioning'],
      );
      assert.deepEqual(
        options.map((option) => option.assetKey),
        ['glutes', 'legs', 'chest', 'shoulders', 'back', 'arms', 'core', 'conditioning'],
      );
      assert.equal(options.every((option) => option.title.length > 0), true);
      assert.equal(options.every((option) => option.accessibilityLabel.includes('focus')), true);
    },
  },
];
