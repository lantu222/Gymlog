const assert = require('node:assert/strict');

const { t, I18N_KEYS, SUPPORTED_LANGUAGES } = require('../../.test-dist/lib/i18n.js');

module.exports = [
  {
    name: 'i18n: every English key has a Finnish translation and neither renders empty',
    run() {
      assert.ok(I18N_KEYS.length >= 12, 'key list should cover at least the Welcome surface');

      for (const key of I18N_KEYS) {
        assert.ok(t('en', key).length > 0, `en missing ${key}`);
        assert.ok(t('fi', key).length > 0, `fi missing ${key}`);
      }

      // Spot checks: translations are real, not copies of the English text.
      assert.equal(t('en', 'welcome.continueGoogle'), 'Continue with Google');
      assert.equal(t('fi', 'common.cancel'), 'Peruuta');
      assert.notEqual(t('fi', 'brand.tagline'), t('en', 'brand.tagline'));
      assert.notEqual(t('fi', 'home.startWorkout'), t('en', 'home.startWorkout'));
    },
  },
  {
    name: 'i18n: templates interpolate {name} vars in both languages',
    run() {
      assert.equal(t('en', 'home.hero.sessionsProgress', { done: 2, total: 8 }), '2 sessions logged');
      assert.equal(t('fi', 'home.hero.sessionsProgress', { done: 2, total: 8 }), '2 treeniä kirjattu');
      assert.equal(
        t('en', 'home.section.workoutMeta', { count: 4, sets: 11 }),
        '4 exercises · 11 sets',
      );
      // Unknown placeholders stay literal rather than rendering "undefined".
      assert.equal(t('en', 'guided.autoLoad', {}), 'AUTO +{kg} KG');
    },
  },
  {
    name: 'i18n: unknown language falls back to English',
    run() {
      assert.equal(t('sv', 'common.cancel'), 'Cancel');
      assert.equal(t('sv', 'home.startWorkout'), 'Start workout');
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
