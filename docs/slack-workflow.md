# Slack workflow

A place to put things down so they stop occupying your head.

The problem this solves is not communication — it is a one-person project with
no inbox. A bug spotted on the phone mid-workout, a feature idea in the car, a
"the plan tiles clip at 320dp" noticed while scrolling: each of these is gone
within an hour unless it lands somewhere in five seconds. Slack on the phone is
already open, already syncs, and already takes a screenshot with two taps.

Two directions, and only one of them needs tooling:

- **Phone → Slack.** Screenshot, share into `#bugs`, type a word. No tooling.
  This is the direction that carries most of the value.
- **Machine → Slack.** `npm run slack:notify`, below. For notes that originate
  at the keyboard: a release went out, a check failed, a TODO found while
  reading code.

## Channels

| Channel | Also answers to | Environment variable |
|---|---|---|
| `bugs` | `bug`, `bugit` | `SLACK_WEBHOOK_BUGS` |
| `roadmap` | `tuotekehitys`, `updates`, `features` | `SLACK_WEBHOOK_ROADMAP` |
| `marketing` | `markkinointi` | `SLACK_WEBHOOK_MARKETING` |
| `releases` | `julkaisut` | `SLACK_WEBHOOK_RELEASES` |
| `general` | `yleinen`, `misc` | `SLACK_WEBHOOK_GENERAL` |

Aliases exist because the caller is a human in a hurry, and `bugit` is what
gets typed. Names are matched case-insensitively with a leading `#` stripped.

There is **no default channel**. An unknown name is an error, not a fallback to
`#general`: a typo that silently reroutes a bug report loses it just as
thoroughly as dropping it, but lets you believe it landed.

## Setup

Each channel needs its own [incoming webhook](https://api.slack.com/messaging/webhooks).
A webhook is bound to one channel when it is created, which is why the script
takes one variable per channel rather than one token plus a channel argument.

Export them from your shell profile — **never commit a webhook URL**. Anyone
holding one can post to that channel:

```bash
export SLACK_WEBHOOK_BUGS="https://hooks.slack.com/services/…"
export SLACK_WEBHOOK_ROADMAP="https://hooks.slack.com/services/…"
```

Only the channels you actually post to from the machine need a variable. The
script fails with the variable's name when one is missing, so you can add them
as you need them.

## Usage

```bash
npm run slack:notify -- --channel bugs --text "Plan tiles clip at 320dp"
```

| Flag | |
|---|---|
| `-c`, `--channel` | Channel name or alias. Required. |
| `-t`, `--text` | The message. Omit to read stdin. |
| `--source` | Appended as an italic `via …` footer. |
| `--dry-run` | Print what would be sent; post nothing. |
| `-h`, `--help` | The channel table, from the same source as this page. |

Piping works, so anything that produces a line can report itself:

```bash
npm run test:unit 2>&1 | tail -1 | npm run slack:notify -- --channel bugs --source CI
```

`--dry-run` prints the payload and the **name** of the variable it would read,
never its value. Check a new channel with it before trusting it:

```bash
npm run slack:notify -- --channel julkaisut --text "v1.4 on Play" --dry-run
```

## Notes

The message is one `text` field, deliberately. Slack renders `text` on the phone
lock screen; anything moved into blocks or attachments stops appearing there,
and the lock screen is the surface this whole workflow exists for.

Adding a channel means three edits: the `CHANNELS` table in
`scripts/slackNotify.cjs`, the table above, and the alias map in
`tests/scripts/slackNotify.test.cjs` — which is spelled out by hand rather than
derived from the source, so that moving an alias to the wrong row fails.
