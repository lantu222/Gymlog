# Slack workflow

A place to put things down so they stop occupying your head.

The problem this solves is not communication — it is a one-person project with
no inbox. A bug spotted on the phone mid-workout, a competitor detail noticed in
the car, a "the plan tiles clip at 320dp" seen while scrolling: each of these is
gone within the hour unless it lands somewhere in five seconds. Slack on the
phone is already open, already syncs, and already takes a screenshot in two
taps.

## The two directions

They are separate systems with separate setup, and confusing them wastes an
evening.

**Phone → Slack → Claude.** You post; Claude reads the channel later through the
Slack connector and works from it. **This needs no webhooks and no tooling at
all.** Post from the Slack app, then say "read #bugs" in a session. This is the
direction that carries most of the value.

**Machine → Slack.** `npm run slack:notify`, below. For notes that originate at
the keyboard: a release went out, a check failed. This is the only direction
that needs a webhook, and it is optional — skip this whole setup until you
actually want the machine to report something.

## Channels

| Channel | Also answers to | For | Environment variable |
|---|---|---|---|
| `bugs` | `bug`, `bugit` | Defects. Screenshot plus a line. | `SLACK_WEBHOOK_BUGS` |
| `marketing` | `markkinointi` | Store copy, screenshots, competitor notes. | `SLACK_WEBHOOK_MARKETING` |
| `releases` | `julkaisut` | What shipped, in the user's language. | `SLACK_WEBHOOK_RELEASES` |

Each channel's first message is its own template — open it on the phone and
copy the shape.

Aliases exist because the caller is in a hurry and `bugit` is what gets typed.
Names match case-insensitively with a leading `#` stripped.

There is **no default channel**. An unknown name is an error that lists the
alternatives, not a fallback: a typo that quietly reroutes a bug report loses it
exactly as thoroughly as dropping it, but lets you believe it landed.

The table matches the workspace exactly, and should stay that way. Offering a
destination nobody receives at is the same failure as a typo.

## Webhook setup (only for machine → Slack)

A webhook is a URL that accepts a POST and turns it into a message in one
specific channel. It exists because the script has no Slack login — it runs in a
terminal or in CI, where no one is signed in and no OAuth flow can happen. The
URL *is* the credential: anyone holding it can post to that channel, and nothing
else. That is why each channel gets its own, and why none of them is ever
committed.

One channel at a time, roughly two minutes each:

1. Go to **https://api.slack.com/apps** and sign in with the `styxon` workspace.
2. **Create New App → From scratch.** Name it something like `Vinha notify` and
   pick the `styxon` workspace. One app covers all three channels.
3. In the left sidebar, open **Incoming Webhooks** and turn the toggle **On**.
4. Click **Add New Webhook to Workspace** at the bottom, choose `#bugs`, and
   **Allow**. You land back on a list with a URL starting
   `https://hooks.slack.com/services/…` — copy it.
5. Repeat step 4 for `#marketing` and `#releases`. Same app, three webhooks; the
   channel is baked into the URL, which is why one URL cannot serve two
   channels.

Then export them. In PowerShell, for the current session:

```powershell
$env:SLACK_WEBHOOK_BUGS = "https://hooks.slack.com/services/…"
```

To make them persist across reboots, set them once as user-level variables:

```powershell
[Environment]::SetEnvironmentVariable('SLACK_WEBHOOK_BUGS', 'https://hooks.slack.com/services/…', 'User')
```

Open a new terminal after that — a running shell does not see variables set
after it started.

Only the channels you actually post to from the machine need a variable. A
missing one fails with the variable's name in the message, so you can add them
as you go.

**Never commit a webhook URL** and never paste one into a chat, an issue, or a
screenshot. If one leaks, delete it in the same Incoming Webhooks screen and add
a new one; nothing else has to change.

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
never its value. It needs no webhook at all, so use it to check wiring before
setting anything up:

```bash
npm run slack:notify -- --channel julkaisut --text "v1.4 on Play" --dry-run
```

## Notes

The message is one `text` field, deliberately. Slack renders `text` on the phone
lock screen; anything moved into blocks or attachments stops appearing there,
and the lock screen is the surface this whole workflow exists for.

Adding a channel means four steps: create it in Slack first, then the `CHANNELS`
table in `scripts/slackNotify.cjs`, the table above, and the alias map in
`tests/scripts/slackNotify.test.cjs` — which is spelled out by hand rather than
derived from the source, so that moving an alias to the wrong row fails.
