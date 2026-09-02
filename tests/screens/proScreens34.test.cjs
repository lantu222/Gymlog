const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', '..', ...parts), 'utf8');
const survey = read('src', 'screens', 'MembershipEndScreen.tsx');
const chat = read('src', 'screens', 'AICoachChatScreen.tsx');
const i18n = read('src', 'lib', 'i18n.ts');

/**
 * GAINER Pro screens, parts 03 and 04 (design 2026-09-02).
 *
 * 03 — Why did you stop: the kit's picker rows with an orange tick, the box
 * once anything is picked, Send as the single orange action, Skip the quiet
 * link.
 *
 * 04 — the locked chat: the first locked answer keeps its body, every one
 * after it collapses to one line; the free composer is a sentence and a tap,
 * with no lock glyph beside it.
 */
module.exports = [
  {
    name: 'why did you stop: orange tick, box once anything is picked, one orange Send',
    run() {
      const block = survey.slice(survey.indexOf("t(language, 'subs.survey.title')"), survey.indexOf('const makeStyles'));
      assert.match(block, /\{any \? \(\s*<TextInput/, 'the box waits for a pick, any pick');
      assert.doesNotMatch(block, /picked\.includes\('subs\.survey\.r6'\) \? \(\s*<TextInput/);
      assert.match(block, /any \? styles\.surveySendOn : styles\.surveySendQuiet/);
      const styles = survey.slice(survey.indexOf('const makeStyles'));
      assert.match(styles, /surveyCheck: \{[^}]*backgroundColor: theme\.highlight/s);
      assert.match(styles, /surveyRowOn: \{[^}]*borderColor: theme\.highlight/s);
      assert.match(styles, /surveySendOn: \{\s*backgroundColor: theme\.highlight,/);
      // The copy from the design, in both languages.
      for (const line of ["'subs.survey.r2': 'I did not get what I was paying for'", "'subs.survey.r5': 'It kept breaking'", "'subs.survey.r5': 'Se meni rikki toistuvasti'"]) {
        assert.ok(i18n.includes(line), line);
      }
    },
  },
  {
    name: 'locked chat: only the first locked answer keeps its body; the rest are one line',
    run() {
      assert.match(chat, /const firstLockedId = useMemo\(\(\) => messages\.find\(\(message\) => message\.lockedBody\)\?\.id \?\? null, \[messages\]\);/);
      assert.match(chat, /message\.id === firstLockedId \? \(\s*<View key=\{message\.id\} style=\{styles\.lockWrap\}>\s*<ProLockedCard/);
      assert.match(chat, /styles\.lockedCollapsed, pressed && styles\.pressed\]\}\s*>\s*<Text style=\{styles\.lockedCollapsedText\}>\{t\(language, 'coachChat\.locked\.collapsed'\)\}/);
      assert.equal(i18n.split("'coachChat.locked.collapsed': '").length - 1, 2, 'EN and FI');
      // One unlock per bubble: the card is the single press target.
      assert.equal((chat.match(/cta=\{t\(language, 'coachChat\.locked\.cta'\)\}/g) ?? []).length, 1);
    },
  },
  {
    name: 'locked chat: the free composer is a sentence and a tap, without a lock glyph',
    run() {
      const composer = chat.slice(chat.indexOf('styles.composerWrap'), chat.indexOf('function ComposeOutline'));
      assert.match(composer, /\{!proUnlocked \? \(\s*<Pressable[\s\S]{0,400}onPress=\{onOpenPremium\}[\s\S]{0,400}\{t\(language, 'coachChat\.placeholderFree'\)\}/);
      // The lock path that lived on the send button is gone from the composer.
      assert.doesNotMatch(composer, /M6 11h12v9H6zM9 11V8a3 3 0 016 0v3/);
    },
  },
];
