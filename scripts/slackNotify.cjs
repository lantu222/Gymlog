#!/usr/bin/env node
/**
 * Posts a one-line note to a Slack channel through an incoming webhook.
 *
 * The point is the capture, not the tooling: a bug you notice on the phone mid
 * workout has to land somewhere in five seconds or it is gone by the time you
 * are back at a keyboard. Screenshot into #bugs from the phone, and this script
 * is the other half — the one that puts machine-side notes (a release went out,
 * a check failed, a TODO found while reading code) into the same channels
 * without opening Slack.
 *
 *   node scripts/slackNotify.cjs --channel bugs --text "Plan tiles clip at 320dp"
 *   npm run slack:notify -- --channel julkaisut --text "v1.4 on Play"
 *   echo "..." | npm run slack:notify -- --channel bugs
 *   npm run slack:notify -- --channel bugs --text "..." --dry-run
 *
 * Channels are addressed by name or by any of their aliases, in Finnish or
 * English, because the caller is a human in a hurry and "bugit" is what they
 * will type. Each channel reads its URL from its own environment variable, so
 * no webhook is ever committed:
 *
 *   SLACK_WEBHOOK_BUGS · SLACK_WEBHOOK_ROADMAP · SLACK_WEBHOOK_MARKETING
 *   SLACK_WEBHOOK_RELEASES · SLACK_WEBHOOK_GENERAL
 *
 * The routing half is exported and pure, so tests/scripts/slackNotify.test.cjs
 * can check every alias and every failure without a network or a real webhook.
 */
const https = require('node:https');

/**
 * The channel map.
 *
 * Aliases exist so the caller never has to remember the canonical name. They
 * are matched case-insensitively with a leading '#' stripped, because half the
 * time you will type "#bugs" out of habit.
 */
const CHANNELS = [
  { name: 'bugs', aliases: ['bug', 'bugit'], env: 'SLACK_WEBHOOK_BUGS' },
  {
    name: 'roadmap',
    aliases: ['tuotekehitys', 'updates', 'features'],
    env: 'SLACK_WEBHOOK_ROADMAP',
  },
  { name: 'marketing', aliases: ['markkinointi'], env: 'SLACK_WEBHOOK_MARKETING' },
  { name: 'releases', aliases: ['julkaisut'], env: 'SLACK_WEBHOOK_RELEASES' },
  { name: 'general', aliases: ['yleinen', 'misc'], env: 'SLACK_WEBHOOK_GENERAL' },
];

/** Every name and alias a caller may type, for error messages. */
function knownChannelLabels() {
  return CHANNELS.map((channel) =>
    channel.aliases.length > 0
      ? `${channel.name} (${channel.aliases.join(', ')})`
      : channel.name,
  );
}

function normalizeChannelInput(value) {
  return String(value ?? '')
    .trim()
    .replace(/^#+/, '')
    .toLowerCase();
}

/**
 * Name or alias → channel. Throws rather than guessing.
 *
 * There is deliberately no default channel. A typo that silently routes a bug
 * report into #general is worse than a typo that fails: the note is gone either
 * way, but the silent one lets you believe it landed.
 */
function resolveChannel(input) {
  const wanted = normalizeChannelInput(input);
  if (wanted === '') {
    throw new Error(`No channel given. Use --channel <name>. Known: ${knownChannelLabels().join(' · ')}`);
  }

  const match = CHANNELS.find(
    (channel) => channel.name === wanted || channel.aliases.includes(wanted),
  );
  if (!match) {
    throw new Error(`Unknown channel "${input}". Known: ${knownChannelLabels().join(' · ')}`);
  }
  return match;
}

/**
 * The webhook URL for a channel, read from the environment.
 *
 * `env` is passed in rather than read from process.env directly so the tests
 * can cover the missing-variable path without mutating the real environment.
 */
function resolveWebhookUrl(channel, env) {
  const url = env[channel.env];
  if (typeof url !== 'string' || url.trim() === '') {
    throw new Error(
      `${channel.env} is not set, so #${channel.name} has nowhere to post. ` +
        'Create an incoming webhook for that channel and export it.',
    );
  }
  return url.trim();
}

/**
 * The Slack payload.
 *
 * `text` is the whole message on purpose. Blocks and attachments would let this
 * grow into a formatter, and the value here is that a note takes one line to
 * write. The channel is not in the payload because an incoming webhook is bound
 * to its channel at creation — which is also why one variable per channel is
 * the right shape rather than one token plus a channel field.
 */
function buildPayload(text, { source } = {}) {
  const body = String(text ?? '').trim();
  if (body === '') {
    throw new Error('Refusing to post an empty message. Pass --text or pipe text on stdin.');
  }
  return source ? { text: `${body}\n\n_via ${source}_` } : { text: body };
}

/** Minimal flag parser: --key value, --flag, and --key=value. */
function parseArgs(argv) {
  const args = { channel: null, text: null, source: null, dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const [flag, inlineValue] = token.startsWith('--') && token.includes('=')
      ? [token.slice(0, token.indexOf('=')), token.slice(token.indexOf('=') + 1)]
      : [token, null];
    const takeValue = () => {
      if (inlineValue !== null) return inlineValue;
      index += 1;
      return argv[index] ?? null;
    };

    if (flag === '--channel' || flag === '-c') args.channel = takeValue();
    else if (flag === '--text' || flag === '-t') args.text = takeValue();
    else if (flag === '--source') args.source = takeValue();
    else if (flag === '--dry-run') args.dryRun = true;
    else if (flag === '--help' || flag === '-h') args.help = true;
    else if (flag.startsWith('--')) throw new Error(`Unknown flag ${flag}`);
  }
  return args;
}

function postToSlack(url, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const request = https.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (response) => {
        let received = '';
        response.on('data', (chunk) => {
          received += chunk;
        });
        response.on('end', () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(received);
          } else {
            // Slack answers a bad webhook with a plain-text reason
            // ("no_service", "invalid_payload"); pass it straight through.
            reject(new Error(`Slack replied ${response.statusCode}: ${received.trim()}`));
          }
        });
      },
    );
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

function readStdin() {
  if (process.stdin.isTTY) return Promise.resolve('');
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
  });
}

const USAGE = `slackNotify — post a note to a Slack channel

  node scripts/slackNotify.cjs --channel <name> --text "<message>"

Options
  -c, --channel   Channel name or alias (required)
  -t, --text      Message body; omit to read stdin
      --source    Appended as an italic "via ..." footer
      --dry-run   Print what would be sent, post nothing
  -h, --help      This text

Channels
${CHANNELS.map((channel) => `  ${channel.name.padEnd(10)} ${channel.aliases.join(', ').padEnd(28)} ${channel.env}`).join('\n')}
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return;
  }

  const channel = resolveChannel(args.channel);
  const text = args.text ?? (await readStdin());
  const payload = buildPayload(text, { source: args.source });

  if (args.dryRun) {
    // The URL is a secret — a webhook is a bearer credential, so a dry run
    // names the variable it would read and never its value.
    console.log(`[dry-run] → #${channel.name} (via ${channel.env})`);
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const url = resolveWebhookUrl(channel, process.env);
  await postToSlack(url, payload);
  console.log(`Posted to #${channel.name}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  CHANNELS,
  buildPayload,
  knownChannelLabels,
  normalizeChannelInput,
  parseArgs,
  resolveChannel,
  resolveWebhookUrl,
  USAGE,
};
