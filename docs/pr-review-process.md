# PR review process

Owns: how a pull request gets reviewed before it merges, and what to do when
the review does not run.

---

## What happened

Twenty-two PRs have merged into `main`. Exactly one of them was reviewed.

| | |
|---|---|
| PRs opened | 22 (#1–#22), all merged |
| PRs with any review | 1 — PR #3, by `chatgpt-codex-connector[bot]`, 2026-08-17 |
| PRs with no review | 19 (#4–#22) plus #1 and #2, which predate the connector |
| Findings from the one review | 4, all P2 |
| Those findings, verified against `main` today | 4 of 4 fixed |

The review that ran was worth having. Its four findings were all real:

| Finding | Where | State in `main` |
|---|---|---|
| History days built by subtracting fixed 24-hour chunks, so every day before a DST change reads as untrained | `getRecentActivityStrip` | Fixed — `src/lib/completedSessions.ts` steps by calendar date now, with a comment saying why |
| Cardio counted as finishing the day's planned workout, so the widget named tomorrow while Home still offered today | `src/lib/widgetPayload.ts` | Fixed — `completedWorkoutDayStarts` is a separate, narrower set from `completedDayStarts` |
| A prebuilt Android tree kept its old receiver, so the widget picker showed a row with no label | `plugins/withHomeWidget.js` | Fixed — the receiver is patched in place rather than skipped |
| Bar spacing interpolated after the `FrameLayout` start tag closed, emitting attributes as inert text nodes | `plugins/withHomeWidget.js` | Fixed — `${pad}` sits inside the tag |

So the review found four genuine bugs on its single run, and then the repo went
nineteen PRs without one.

Codex was not silent about it. On every one of those PRs it posted:

> You have reached your Codex usage limits for code reviews.

within seconds of the PR opening — four seconds on #4, five on #22. The
information was there the whole time, on every pull request, in plain language.

That is the part worth understanding, because it is the reason this was fixed
with a check rather than with better notifications. A PR comment gates nothing.
It does not appear in the checks list, it does not colour the merge button, and
on a PR that merges 2.9 minutes after it opens it is one more thing scrolled
past on the way to the green button. Nineteen times a bot said "I am not
reviewing this" and nineteen times the PR merged anyway, not because the message
was missing but because nothing was standing in the way.

Being told is not the same as being stopped. That is why the replacement's
signal is a red check: not louder, but in the one place a merge has to look.

## Why quota was not the only problem

Raising the Codex quota would not have fixed this on its own, because most of
these PRs were merged faster than any review can run:

| Open → merge | Count |
|---|---|
| Under 5 minutes | 14 of 20 |
| Under 20 minutes | 16 of 20 |
| Median | 2.9 minutes |

Codex's one review landed 15 minutes after PR #3 opened. Anthropic's managed
Code Review averages 20 minutes. Against a 2.9-minute median merge, an
asynchronous reviewer of any brand misses roughly four PRs in five — it would
still be posting findings onto branches that are already in `main`.

That splits the fix in two, and both halves are needed:

1. **A review that runs before the PR exists**, in the session that wrote the
   code, while the code can still change.
2. **A review on the PR itself**, so a missing one is visible rather than
   assumed.

## 1. Before the PR — `/code-review`

Run `/code-review` in the Claude Code session that produced the change, before
opening the PR. It reviews the branch's commits ahead of upstream plus
uncommitted work, reads `CLAUDE.md` like any session in this repo, and reports
correctness bugs alongside reuse and simplification cleanups.

```text
/code-review              # this branch's changes
/code-review high         # broader coverage, more uncertain findings
/code-review --fix        # apply the findings to the working tree
```

This is the half that fits how this repo actually works. It needs no GitHub
App, no secret, and no quota beyond the plan already in use, and it finishes
while the code is still editable. It is now part of the pre-PR routine in
`CLAUDE.md`.

## 2. On the PR — `.github/workflows/claude-review.yml`

`anthropics/claude-code-action@v1` runs the same review on every PR open, push,
reopen and ready-for-review, and posts findings as inline comments. This is the
direct replacement for the Codex connector.

It fails the check when its credential is missing rather than passing quietly.
A red check that says "no review ran" is the whole point: the failure this
document exists because of was a silent one.

### Setup, once

1. **Install the Claude GitHub App** — <https://github.com/apps/claude>, granted
   access to this repository. This is the identity the review posts as.
2. **Generate a token** — run `claude setup-token` locally. It authenticates
   against the existing Claude subscription, so reviews draw on plan usage
   rather than a separate API bill.
3. **Add the secret** — Settings → Secrets and variables → Actions → New
   repository secret, named `CLAUDE_CODE_OAUTH_TOKEN`.
4. **Optional, and the only thing that makes the gate real** — Settings →
   Branches → branch protection on `main`, requiring the `review` check. Without
   it, a PR can still merge two minutes after opening, ahead of the review, and
   the current merge habit says it will.

With a Claude API key instead of a subscription token, change the workflow's
`claude_code_oauth_token` input to `anthropic_api_key` and name the secret
`ANTHROPIC_API_KEY`. That path bills per token instead of drawing on the plan.

### What it costs

| Path | Billing | Fit here |
|---|---|---|
| `/code-review` in-session | Plan usage already being spent | The default. Runs where it can still change the code |
| This workflow, subscription token | Plan usage, plus GitHub Actions minutes | The PR-side backstop |
| This workflow, API key | Per token, cents to low dollars per PR | Use if the plan's usage is the binding constraint |
| Managed Code Review | $15–25 per review, Team/Enterprise plans only | Not available on an individual plan, and ~$400 for a batch this size |

## The Codex connector is gone

The `chatgpt-codex-connector` GitHub App was uninstalled on 28 August 2026. It
had kept firing on every PR to post its usage-limit comment, including on #24 —
the PR that added the check replacing it. Nothing here depends on it, and a
reviewer that announces on every PR that it is not reviewing is worse than no
reviewer at all.

## Tuning what gets flagged

Both paths read `CLAUDE.md`, so review guidance belongs there and nowhere else
— see its **Code review** section. A root `REVIEW.md` is deliberately absent:
only managed Code Review reads it, so on this setup it would be a file that
looks like it configures reviews without configuring anything.

## A PR that edits the workflow file is never reviewed

`claude-code-action` refuses to run when the workflow file on the PR differs
from the version on the default branch. That is a security property, not a bug:
without it, a PR could rewrite its own reviewer and then be reviewed by the
rewritten version.

The consequence is permanent. Every PR that touches
`.github/workflows/claude-review.yml`, including the one that first added it,
gets no review from this workflow, and the check is red saying so. Review those
by hand, or with `/code-review` before opening them.

The action signals this by exiting **green** with nothing reviewed, which is why
the workflow's last step exists: it checks the action's `execution_file` output
and fails when no review ran. Without that step the exact failure this whole
document is about — an absence that looks like a clean review — would have
survived the switch from Codex intact. It was caught on the first real run.

## When the review does not run

- **Check red, "No CLAUDE_CODE_OAUTH_TOKEN secret"** — setup step 3 has not been
  done, and nothing on the PR has been reviewed.
- **Check red, "exited without reviewing this PR"** — usually the workflow-file
  case above. Otherwise read the action's step in the run log for the reason.
- **Check red, action failure** — read the run log. A failed review is not a
  clean review; re-run it or review the diff by hand before merging.
- **No check at all** — the workflow file did not reach `main`, or Actions is
  disabled for the repository.
