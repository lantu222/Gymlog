const assert = require('node:assert/strict');

const {
  getFocusAreaPresentationOptions,
  getOnboardingFocusAreaPresentationOptions,
} = require('../../.test-dist/lib/focusAreaPresentation.js');

module.exports = [
  {
    name: 'focus area presentation exposes consistent Step 4 placeholder options',
    run() {
      const options = getFocusAreaPresentationOptions();
      const onboardingOptions = getOnboardingFocusAreaPresentationOptions();

      assert.deepEqual(
        onboardingOptions.map((option) => option.area),
        ['chest', 'back', 'shoulders', 'arms', 'core', 'quads', 'glutes', 'hamstrings', 'calves', 'mobility'],
      );
      assert.deepEqual(
        onboardingOptions.map((option) => option.assetKey),
        ['chest', 'back', 'shoulders', 'arms', 'core', 'quads', 'glutes', 'hamstrings', 'calves', 'mobility'],
      );
      assert.deepEqual(
        onboardingOptions.map((option) => option.group),
        ['upper', 'upper', 'upper', 'upper', 'upper', 'lower', 'lower', 'lower', 'lower', 'lower'],
      );
      assert.equal(onboardingOptions.some((option) => option.area === 'mobility'), true);
      assert.equal(onboardingOptions.some((option) => option.area === 'core' && option.title === 'Abs'), true);
      assert.equal(onboardingOptions.some((option) => option.area === 'conditioning'), false);
      assert.equal(options.some((option) => option.area === 'conditioning' && option.group === 'legacy'), true);
      assert.equal(options.every((option) => option.title.length > 0), true);
      assert.equal(options.every((option) => option.accessibilityLabel.includes('focus')), true);
    },
  },
];
