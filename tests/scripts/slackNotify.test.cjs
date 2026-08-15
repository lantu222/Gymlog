const assert = require('node:assert/strict');

const {
  CHANNELS,
  buildPayload,
  normalizeChannelInput,
  parseArgs,
  resolveChannel,
  resolveWebhookUrl,
  USAGE,
} = require('../../scripts/slackNotify.cjs');

/**
 * The routing half of scripts/slackNotify.cjs, which is the half that can be
 * wrong without anyone noticing: a note posted to the wrong channel looks
 * exactly like a note posted correctly, from the sending end.
 *
 * No network here. The script keeps resolution pure precisely so this file can
 * cover every alias and every refusal without a real webhook.
 */
module.exports = [
  {
    name: 'slackNotify: every channel resolves by its own name',
    run() {
      for (const channel of CHANNELS) {
        assert.equal(resolveChannel(channel.name).name, channel.name);
      }
      assert.equal(CHANNELS.length, 5, 'adding a channel is a decision — update the docs with it');
    },
  },
  {
    name: 'slackNotify: every alias resolves to its channel, in both languages',
    run() {
      // The whole table, spelled out rather than derived from CHANNELS. A test
      // that maps over the same array it is checking passes when someone moves
      // an alias to the wrong row, which is the one mistake that matters.
      const expected = {
        bug: 'bugs',
        bugit: 'bugs',
        tuotekehitys: 'roadmap',
        updates: 'roadmap',
        features: 'roadmap',
        markkinointi: 'marketing',
        julkaisut: 'releases',
        yleinen: 'general',
        misc: 'general',
      };
      for (const [alias, channel] of Object.entries(expected)) {
        assert.equal(resolveChannel(alias).name, channel, `${alias} should route to ${channel}`);
      }

      // And no alias is claimed twice, which would make routing depend on
      // table order rather than on what the caller typed.
      const all = CHANNELS.flatMap((channel) => [channel.name, ...channel.aliases]);
      assert.equal(new Set(all).size, all.length, 'a name or alias is used by two channels');
    },
  },
  {
    name: 'slackNotify: the caller may type #Bugs, bugs, or "  BUGIT  "',
    run() {
      assert.equal(normalizeChannelInput('#Bugs'), 'bugs');
      assert.equal(normalizeChannelInput('  BUGIT  '), 'bugit');
      assert.equal(normalizeChannelInput('##general'), 'general');
      assert.equal(resolveChannel('#Bugs').name, 'bugs');
      assert.equal(resolveChannel('  JULKAISUT ').name, 'releases');
    },
  },
  {
    name: 'slackNotify: an unknown channel fails loudly and never falls back',
    run() {
      // There is no default channel on purpose. Routing a bug report to
      // #general on a typo loses it just as thoroughly as dropping it, but
      // lets the sender believe it landed.
      assert.throws(() => resolveChannel('buggs'), /Unknown channel "buggs"/);
      // The refusal has to name the alternatives — the caller is at a terminal
      // mid-task and should not have to open this file to recover.
      assert.throws(() => resolveChannel('buggs'), /bugs \(bug, bugit\)/);
      assert.throws(() => resolveChannel(''), /No channel given/);
      assert.throws(() => resolveChannel(undefined), /No channel given/);
    },
  },
  {
    name: 'slackNotify: each channel reads its own environment variable',
    run() {
      const expected = {
        bugs: 'SLACK_WEBHOOK_BUGS',
        roadmap: 'SLACK_WEBHOOK_ROADMAP',
        marketing: 'SLACK_WEBHOOK_MARKETING',
        releases: 'SLACK_WEBHOOK_RELEASES',
        general: 'SLACK_WEBHOOK_GENERAL',
      };
      for (const [name, env] of Object.entries(expected)) {
        assert.equal(resolveChannel(name).env, env);
      }

      const url = resolveWebhookUrl(resolveChannel('bugit'), {
        SLACK_WEBHOOK_BUGS: ' https://hooks.slack.test/bugs ',
      });
      assert.equal(url, 'https://hooks.slack.test/bugs', 'the URL should be trimmed');
    },
  },
  {
    name: 'slackNotify: a missing webhook names the variable to set',
    run() {
      // "Request failed" would send the reader to the network. The variable
      // name is the actual fix, so it is the actual message.
      assert.throws(
        () => resolveWebhookUrl(resolveChannel('bugs'), {}),
        /SLACK_WEBHOOK_BUGS is not set/,
      );
      // An empty or blank value is the same failure as an absent one — this is
      // what an unset variable looks like after a shell expands it.
      assert.throws(
        () => resolveWebhookUrl(resolveChannel('roadmap'), { SLACK_WEBHOOK_ROADMAP: '   ' }),
        /SLACK_WEBHOOK_ROADMAP is not set/,
      );
    },
  },
  {
    name: 'slackNotify: the payload is the message, and never an empty one',
    run() {
      assert.deepEqual(buildPayload('Plan tiles clip at 320dp'), {
        text: 'Plan tiles clip at 320dp',
      });
      // Surrounding whitespace is stripped so a piped file does not post a
      // message with a trailing newline glued to it.
      assert.deepEqual(buildPayload('  spaced  '), { text: 'spaced' });

      // Empty is a refusal, not an empty post. A stdin pipe that produced
      // nothing is the common way to get here, and a blank line in the channel
      // reads as a bug in the channel.
      assert.throws(() => buildPayload(''), /Refusing to post an empty message/);
      assert.throws(() => buildPayload('   \n  '), /Refusing to post an empty message/);
      assert.throws(() => buildPayload(null), /Refusing to post an empty message/);
    },
  },
  {
    name: 'slackNotify: --source becomes a footer, not a second message',
    run() {
      const payload = buildPayload('Release build green', { source: 'CI' });
      assert.match(payload.text, /^Release build green/);
      assert.match(payload.text, /_via CI_$/);
      // One field. Slack renders `text` on the phone lock screen, and anything
      // moved into blocks stops appearing there — which is the surface this
      // whole workflow exists for.
      assert.deepEqual(Object.keys(payload), ['text']);
    },
  },
  {
    name: 'slackNotify: flags parse in both --key value and --key=value form',
    run() {
      const spaced = parseArgs(['--channel', 'bugs', '--text', 'hello there']);
      assert.equal(spaced.channel, 'bugs');
      assert.equal(spaced.text, 'hello there');
      assert.equal(spaced.dryRun, false);

      const inline = parseArgs(['--channel=julkaisut', '--text=v1.4 on Play', '--dry-run']);
      assert.equal(inline.channel, 'julkaisut');
      assert.equal(inline.text, 'v1.4 on Play');
      assert.equal(inline.dryRun, true);

      const short = parseArgs(['-c', 'bugit', '-t', 'crash on resume']);
      assert.equal(short.channel, 'bugit');
      assert.equal(short.text, 'crash on resume');

      // A message that looks like a flag is still a message: --text consumes
      // the next token whatever it is.
      assert.equal(parseArgs(['--text', '--dry-run']).text, '--dry-run');

      // A misspelled flag must not be swallowed. Silently ignoring --chanel
      // would post to nothing and report success.
      assert.throws(() => parseArgs(['--chanel', 'bugs']), /Unknown flag --chanel/);
    },
  },
  {
    name: 'slackNotify: the webhook URL is a credential and stays out of output',
    run() {
      // A dry run prints the payload and the variable NAME. Printing the URL
      // would put a bearer credential into terminal scrollback and CI logs —
      // anyone holding a Slack webhook URL can post to that channel.
      const source = require('node:fs').readFileSync(
        require('node:path').join(__dirname, '..', '..', 'scripts', 'slackNotify.cjs'),
        'utf8',
      );
      const dryRunBlock = source.slice(
        source.indexOf('if (args.dryRun) {'),
        source.indexOf('const url = resolveWebhookUrl(channel, process.env);'),
      );
      assert.ok(dryRunBlock.length > 0, 'the dry-run branch moved — move this guard with it');
      assert.doesNotMatch(dryRunBlock, /\burl\b/, 'the dry-run branch must not touch the URL');
      assert.match(dryRunBlock, /channel\.env/, 'it should name the variable instead');

      // resolveWebhookUrl is only reached on the real path, after the dry-run
      // branch has returned.
      assert.ok(
        source.indexOf('if (args.dryRun) {') <
          source.indexOf('const url = resolveWebhookUrl(channel, process.env);'),
      );
    },
  },
  {
    name: 'slackNotify: the usage text lists every channel it can route to',
    run() {
      // The help output is the documentation most people will actually read.
      // If a channel is added to the table and not to the help, the one person
      // using this at 2am will not know it exists.
      for (const channel of CHANNELS) {
        assert.ok(USAGE.includes(channel.name), `usage omits ${channel.name}`);
        assert.ok(USAGE.includes(channel.env), `usage omits ${channel.env}`);
        for (const alias of channel.aliases) {
          assert.ok(USAGE.includes(alias), `usage omits alias ${alias}`);
        }
      }
    },
  },
];
