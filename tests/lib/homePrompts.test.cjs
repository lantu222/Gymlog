const assert = require('node:assert/strict');

const {
  SIGN_IN_AFTER_SESSIONS,
  resolveHomePrompt,
} = require('../../.test-dist/lib/homePrompts.js');

module.exports = [
  {
    name: 'home shows one prompt at a time, and sign-in waits for three sessions',
    run() {
      const base = {
        signInAvailable: true,
        signInDismissed: false,
        loggedSessionCount: 0,
        suggestionKey: 'calves',
      };

      // A fresh install with a suggestion gets the suggestion, never the
      // account ask: there is nothing worth backing up yet, and the account
      // ask is the one most likely to be both refused and remembered.
      assert.equal(resolveHomePrompt(base), 'suggestion');
      assert.equal(resolveHomePrompt({ ...base, loggedSessionCount: 2 }), 'suggestion');

      // From the third session the sign-in outranks the suggestion — it
      // guards data that now exists, and it leaves the queue for good once
      // answered, so the suggestion's turn still comes.
      assert.equal(
        resolveHomePrompt({ ...base, loggedSessionCount: SIGN_IN_AFTER_SESSIONS }),
        'signIn',
      );

      // Answered is answered: after a dismissal the suggestion is next.
      assert.equal(
        resolveHomePrompt({ ...base, loggedSessionCount: 5, signInDismissed: true }),
        'suggestion',
      );

      // Signed in (or backup not configured) with nothing to suggest: quiet.
      assert.equal(
        resolveHomePrompt({
          signInAvailable: false,
          signInDismissed: false,
          loggedSessionCount: 9,
          suggestionKey: null,
        }),
        null,
      );
    },
  },
];
