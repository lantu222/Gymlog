const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8').split('\r\n').join('\n');

const KEYS = ['aiLogChatConsent', 'aiLogComposerConsent', 'aiLogPhotoConsent'];

module.exports = [
  {
    name: 'keeping a copy of coach text starts as three separate noes',
    run() {
      // Three, not one. "Keep my conversations" and "keep the photos I import
      // a programme from" are different offers, and one switch for both is one
      // answer put in the reader's mouth twice (user, 2026-09-10).
      const models = read('src', 'types', 'models.ts');
      for (const key of KEYS) {
        assert.match(models, new RegExp(`${key}: boolean;`), `${key} is not a preference`);
      }

      // Off in the seed and off in the provider's empty database. A consent
      // that ships true is not a consent.
      const seed = read('src', 'data', 'seed.ts');
      const provider = read('src', 'state', 'AppProvider.tsx');
      for (const key of KEYS) {
        assert.match(seed, new RegExp(`${key}: false`), `${key} does not start false in the seed`);
        assert.match(provider, new RegExp(`${key}: false`), `${key} does not start false in the provider`);
        assert.doesNotMatch(seed, new RegExp(`${key}: true`));
        assert.doesNotMatch(provider, new RegExp(`${key}: true`));
      }
    },
  },
  {
    name: 'a stored value only counts as consent when it is exactly true',
    run() {
      // The loader is the last place a stored file can lie. `=== true` means a
      // missing field, a null, or the string "true" all read as no — the one
      // direction it is safe to be wrong in, and the rule the rest of
      // storage/database.ts follows for everything it normalises.
      const database = read('src', 'storage', 'database.ts');
      for (const key of KEYS) {
        assert.match(
          database,
          new RegExp(`${key}: input\\?\\.preferences\\?\\.${key} === true`),
          `${key} is not normalised with an identity check`,
        );
      }
    },
  },
  {
    name: 'the consent is asked before the first question, and asked for by name',
    run() {
      const chat = read('src', 'screens', 'AICoachChatScreen.tsx');
      const i18n = read('src', 'lib', 'i18n.ts');

      // It sits inside the online notice — the one moment before anything is
      // sent — rather than on a settings page nobody visits first.
      assert.match(chat, /mustAcknowledgeOnline \? \(/);
      assert.match(chat, /styles\.keepBlock/);

      // Each row is its own tap, and the row reports which one it is. A single
      // toggle writing all three would satisfy every assertion above and none
      // of the point.
      assert.match(chat, /onChangeLogConsent\(\{ \[key\]: !on \}\)/);
      assert.match(chat, /accessibilityRole="checkbox"/);
      assert.doesNotMatch(chat, /onChangeLogConsent\(\{ chat: true, composer: true, photo: true \}\)/);

      // Both languages, three labels and the retention sentence.
      for (const key of [
        'coachChat.keep.title',
        'coachChat.keep.body',
        'coachChat.keep.chat',
        'coachChat.keep.composer',
        'coachChat.keep.photo',
        'coachChat.keep.note',
      ]) {
        const occurrences = i18n.split(`'${key}':`).length - 1;
        assert.equal(occurrences, 2, `${key} is missing one of its two languages`);
      }
    },
  },
  {
    name: 'the server writes nothing down until the reader has said yes',
    run() {
      const endpoint = read('api', 'ai-coach.ts');

      // Absent means no. An older client that has never seen the consent sheet
      // sends nothing, and silence has to read as a refusal or the sheet is
      // decoration.
      assert.match(endpoint, /keepConsent: candidate\.keepConsent === true/);
      assert.doesNotMatch(endpoint, /keepConsent: Boolean\(/);
      assert.doesNotMatch(endpoint, /candidate\.keepConsent \?\?/);

      // Two locks, both the reader's: permission and a label. A copy nobody can
      // name is a copy nobody can delete, so a write without one is refused
      // rather than filed anonymously.
      assert.match(endpoint, /if \(!keepConsent \|\| !logId\) \{/);

      // And the development switch is NOT a third one. It was, until
      // 2026-09-10, which meant a yes bought nothing in production: consent,
      // label, retention and a delete route all built around a folder that
      // nothing ever wrote to. That flag says whether OUR debug log exists;
      // it has no business deciding what the reader allowed.
      const writerAt = endpoint.indexOf('async function keepTranscript(');
      assert.ok(writerAt > 0, 'there is no single writer any more');
      const writer = endpoint.slice(writerAt, endpoint.indexOf('\n}', writerAt));
      assert.doesNotMatch(writer, /AI_COACH_DEBUG_TRANSCRIPTS/);

      // Exactly one place writes a transcript, so there is one condition to
      // keep true rather than a set of them that can drift apart. Counting the
      // word alone stopped working when the forget route arrived and listed
      // the same folder — the write is the one that builds a pathname.
      assert.equal(endpoint.split('`transcripts/${day}').length - 1, 1);
      // The label leads the filename, which is what lets withdrawing find every
      // copy by name instead of opening each one to look inside.
      assert.match(endpoint, /`transcripts\/\$\{day\}\/\$\{logId\}--/);

      // All three routes reach it. Two of them used to be switches that wrote
      // nothing: the reader ticked "Luodut ohjelmat" or "Valokuvat" and
      // neither the client nor the server did anything differently.
      assert.equal(endpoint.split('await keepTranscript(').length - 1, 3);
      for (const kind of ['chat', 'composer', 'photo']) {
        assert.match(endpoint, new RegExp(`kind: '${kind}'`), `no route keeps a ${kind} copy`);
      }

      // And each app-side caller sends its own line of the sheet, as it stands
      // now rather than as it stood when the screen mounted.
      const chat = read('src', 'screens', 'AICoachChatScreen.tsx');
      assert.match(chat, /keepConsent: logConsent\.chat/);
      assert.match(read('src', 'app', 'renderHomeScreens.tsx'), /keepConsent: preferences\.aiLogComposerConsent/);
      assert.match(read('App.tsx'), /keepConsent: preferences\.aiLogPhotoConsent/);
    },
  },
  {
    name: 'withdrawing deletes what was kept, and works whatever the log switch says',
    run() {
      const endpoint = read('api', 'ai-coach.ts');

      // Ahead of every other gate. A reader taking back permission cannot be
      // told to wait for a build, so the forget route reads none of the
      // switches the write path reads.
      const forgetAt = endpoint.indexOf('const forgetLogId = readForgetLogId(req.body)');
      const parseAt = endpoint.indexOf('imageInput = parseImageBody(req.body)');
      assert.ok(forgetAt > 0, 'there is no forget route');
      assert.ok(forgetAt < parseAt, 'the forget route must come before the model paths');
      const forgetBlock = endpoint.slice(forgetAt, parseAt);
      assert.doesNotMatch(forgetBlock, /AI_COACH_DEBUG_TRANSCRIPTS/);

      // The one gate it does keep. There is no account behind this route, and
      // every call lists the whole transcripts prefix before it deletes
      // anything — open, a stranger sending guessed labels buys a full listing
      // per request. Nobody withdraws consent sixty times in ten minutes.
      assert.ok(
        forgetBlock.includes('checkRateLimit(getIpAddress(req))'),
        'the forget route is not rate limited',
      );
      assert.ok(
        endpoint.indexOf('checkRateLimit(getIpAddress(req))') <
          endpoint.indexOf('forgetTranscripts(forgetLogId)'),
        'the rate limit must come before the listing it protects',
      );

      // It pages. A reader who used the coach for a year has more copies than
      // one page holds, and stopping at the first would report success while
      // leaving the rest behind.
      assert.match(endpoint, /while \(cursor\);/);
      assert.match(endpoint, /page\.hasMore \? page\.cursor : undefined/);
      assert.match(endpoint, /blob\.pathname\.includes\(`\/\$\{logId\}--`\)/);

      // The phone gives up its permission whether or not the delete lands: a
      // failed network call must not leave the app still allowed to send.
      const profile = read('src', 'app', 'renderProfileTab.tsx');
      const handlerAt = profile.indexOf('onWithdrawCoachLog={async (line, next) => {');
      assert.ok(handlerAt > 0, 'Settings has no withdrawal handler');
      // To the next prop rather than a character count: the window was a
      // count once, and the first comment added inside the handler pushed the
      // last assertion out of it.
      const handlerEnd = profile.indexOf('onResetAllData=', handlerAt);
      assert.ok(handlerEnd > handlerAt, 'the handler no longer ends where this guard thinks');
      const handler = profile.slice(handlerAt, handlerEnd);
      // Matched on the call rather than on one spelling of its argument: the
      // first version of this guard compared exact strings, so a delete moved
      // above the write with a different argument slipped straight past it.
      assert.ok(
        handler.indexOf('updatePreferences({') < handler.indexOf('forgetAiCoachLog('),
        'the switch must go off before the delete is attempted',
      );
      // The label is cleared only once every line is off, so a later yes mints
      // a new one and two stretches of consent cannot be joined into one.
      assert.ok(handler.includes('allOff') && handler.includes('aiLogId: null'));
      // And only once the delete has landed. Dropping the label after a failed
      // call would leave the copies filed under a name nothing can look up.
      assert.ok(
        handler.includes('allOff && forgotten.ok'),
        'the label must survive a delete that did not succeed',
      );
    },
  },
];
