const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  isSuggestionSilenced,
  silencedSuggestionKinds,
  recordSuggestionAccepted,
  recordSuggestionRejected,
  SUGGESTION_COOLDOWN_DAYS,
} = require('../../.test-dist/lib/coachSuggestions.js');

const NOW = new Date('2026-08-25T09:00:00.000Z');
const daysAgo = (days) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

module.exports = [
  {
    name: 'coach suggestions: a refusal is an answer, not a "later"',
    run() {
      // Nothing said yet: the offer may be made.
      assert.equal(isSuggestionSilenced({}, 'pin_stat_card', NOW), false);
      assert.equal(isSuggestionSilenced(null, 'pin_stat_card', NOW), false);

      // One no buys a month of quiet.
      const once = recordSuggestionRejected({}, 'pin_stat_card', daysAgo(3));
      assert.equal(isSuggestionSilenced(once, 'pin_stat_card', NOW), true);
      assert.equal(
        isSuggestionSilenced(once, 'pin_stat_card', new Date(NOW.getTime() + SUGGESTION_COOLDOWN_DAYS * 86400000)),
        false,
        'after the cooling-off month it may be asked once more',
      );

      // The second no ends it. There is no third offer, ever.
      const twice = recordSuggestionRejected(once, 'pin_stat_card', daysAgo(1));
      assert.equal(twice.pin_stat_card.rejectedCount, 2);
      assert.equal(isSuggestionSilenced(twice, 'pin_stat_card', NOW), true);
      assert.equal(
        isSuggestionSilenced(twice, 'pin_stat_card', new Date(NOW.getTime() + 400 * 86400000)),
        true,
        'two refusals do not expire',
      );

      // Accepting also ends it: the thing is on, and offering to turn on what
      // is already on is the sign that explains a sign.
      const taken = recordSuggestionAccepted({}, 'set_goal', NOW);
      assert.equal(isSuggestionSilenced(taken, 'set_goal', new Date(NOW.getTime() + 400 * 86400000)), true);

      // One kind's answer says nothing about another's.
      assert.equal(isSuggestionSilenced(twice, 'set_goal', NOW), false);
    },
  },
  {
    name: 'coach suggestions: the silenced kinds travel in the context, not a filter after the fact',
    run() {
      const state = recordSuggestionAccepted(
        recordSuggestionRejected({}, 'pin_stat_card', daysAgo(2)),
        'set_goal',
        daysAgo(60),
      );
      assert.deepEqual(silencedSuggestionKinds(state, NOW).sort(), ['pin_stat_card', 'set_goal']);
      assert.deepEqual(silencedSuggestionKinds({}, NOW), []);

      // Dropping a suggestion after it arrives would mean paying for an offer
      // that is thrown away, so the list has to reach the prompt.
      const renderer = fs.readFileSync(path.join(__dirname, '../../src/lib/aiCoachSystemContext.ts'), 'utf8');
      assert.match(renderer, /Do not offer/);
      assert.match(renderer, /silencedSuggestions/);

      const app = fs.readFileSync(path.join(__dirname, '../../App.tsx'), 'utf8');
      assert.match(app, /silencedSuggestions: silencedSuggestionKinds\(preferences\.coachSuggestionState\)/);
      // The memo has to see the state, or the context keeps the answer the
      // reader already gave for a whole session.
      assert.match(app, /preferences\.coachSuggestionState,/);
    },
  },
  {
    name: 'coach suggestions: both answers are recorded, and an unusable offer is never drawn',
    run() {
      const screen = fs.readFileSync(path.join(__dirname, '../../src/screens/AICoachChatScreen.tsx'), 'utf8');

      // Recording only the acceptances would leave a refusal invisible and
      // the same offer would return next week.
      assert.match(screen, /if \(suggestionKind\) \{\s*\n\s*onCoachSuggestionResolved\(suggestionKind, accepted\);/);

      // A button the app cannot carry out is worse than no button: an unknown
      // measurement and an unparseable goal are both dropped.
      assert.match(screen, /if \(!isMeasurementIntentKind\(kind\) \|\| pinnedStatCardKeys\.includes\(kind\)\)/);
      assert.match(screen, /parseGoalIntent\(suggestion\.goalText, language\)/);

      // The weigh-in offer is a switch with nothing to carry, and it must not
      // be offered when it is already on.
      assert.match(screen, /if \(suggestion\.kind === 'weigh_in_reminder'\) \{[\s\S]*?return weighInReminderEnabled/);
      // The toggle has to be in the scheduling hook's dependency list, or
      // turning it on would not re-arm anything until the next cold start.
      const hook = fs.readFileSync(path.join(__dirname, '../../src/hooks/useScheduledNotifications.ts'), 'utf8');
      assert.match(hook, /notificationPrefs\.weighInReminder,/);
      assert.match(hook, /signals\.lastBodyweightAtMs,/);

      const endpoint = fs.readFileSync(path.join(__dirname, '../../api/ai-coach.ts'), 'utf8');
      // One offer per answer, and only for what the app state says is missing.
      assert.match(endpoint, /You may offer one action per answer/);
      assert.match(endpoint, /Never offer what is already on/);
      // An unknown kind is dropped rather than passed to a client that would
      // have to draw a button for it.
      assert.match(
        endpoint,
        /candidate\.kind !== 'pin_stat_card' &&\s*\n\s*candidate\.kind !== 'set_goal' &&\s*\n\s*candidate\.kind !== 'weigh_in_reminder'/,
      );
    },
  },
];
