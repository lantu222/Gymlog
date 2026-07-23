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
      assert.equal(t('en', 'welcome.signUpEmail'), 'Sign up with email');
      assert.equal(t('fi', 'welcome.or'), 'tai');
      assert.notEqual(t('fi', 'welcome.tagline'), t('en', 'welcome.tagline'));
      assert.notEqual(t('fi', 'home.greeting.title'), t('en', 'home.greeting.title'));
      assert.notEqual(t('fi', 'home.adaptSheet.title'), t('en', 'home.adaptSheet.title'));
    },
  },
  {
    name: 'i18n: templates interpolate {name} vars in both languages',
    run() {
      assert.equal(t('en', 'home.hero.sessionsProgress', { done: 2, total: 8 }), '2 of 8 sessions');
      assert.equal(t('fi', 'home.hero.sessionsProgress', { done: 2, total: 8 }), '2/8 treeniä');
      assert.equal(
        t('en', 'home.section.workoutMeta', { count: 4, sets: 11 }),
        '4 exercises · 11 sets',
      );
      // Unknown placeholders stay literal rather than rendering "undefined".
      assert.equal(t('en', 'cards.previous', { value: 80 }), 'Previous 80 {unit}');
    },
  },
  {
    name: 'i18n: unknown language falls back to English',
    run() {
      assert.equal(t('sv', 'welcome.or'), 'or');
      assert.equal(t('sv', 'home.adapt'), 'Adapt');
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
