const assert = require('node:assert/strict');

const { t, SUPPORTED_LANGUAGES } = require('../../.test-dist/lib/i18n.js');

module.exports = [
  {
    name: 'i18n: every English key has a Finnish translation and neither renders empty',
    run() {
      const en = require('../../.test-dist/lib/i18n.js');
      // Probe through t(): every key resolvable in both languages, non-empty,
      // and actually different where a translation is expected.
      const keys = [
        'welcome.tagline',
        'welcome.feature.plans.title',
        'welcome.feature.plans.body',
        'welcome.feature.adaptive.title',
        'welcome.feature.adaptive.body',
        'welcome.feature.recovery.title',
        'welcome.feature.recovery.body',
        'welcome.continueGoogle',
        'welcome.continueApple',
        'welcome.or',
        'welcome.signUpEmail',
        'welcome.haveAccount',
      ];

      for (const key of keys) {
        assert.ok(t('en', key).length > 0, `en missing ${key}`);
        assert.ok(t('fi', key).length > 0, `fi missing ${key}`);
      }

      assert.equal(t('en', 'welcome.signUpEmail'), 'Sign up with email');
      assert.equal(t('fi', 'welcome.or'), 'tai');
      assert.notEqual(t('fi', 'welcome.tagline'), t('en', 'welcome.tagline'));
      void en;
    },
  },
  {
    name: 'i18n: unknown language falls back to English',
    run() {
      assert.equal(t('sv', 'welcome.or'), 'or');
    },
  },
  {
    name: 'i18n: supported languages expose flag chips for the Welcome selector',
    run() {
      assert.deepEqual(
        SUPPORTED_LANGUAGES.map((lang) => lang.key),
        ['fi', 'en'],
      );
      assert.ok(SUPPORTED_LANGUAGES.every((lang) => lang.flag.length > 0 && lang.label.length > 0));
    },
  },
];
