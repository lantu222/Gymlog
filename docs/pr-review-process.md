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

`anthropics/claude-code-action@v1` reviews the head commit on every PR open,
push, reopen and ready-for-review, and posts findings as inline comments. This
is the direct replacement for the Codex connector.

The review instructions are `.claude/commands/ci-review.md`, this repo's copy of
the upstream code-review plugin's command (`anthropics/claude-code`,
`plugins/code-review/commands/code-review.md` at `db8834b`). The copy differs in
three ways: it reviews a PR that Claude has already commented on, it does not
skip a change it judges trivial, and it always ends with a summary comment that
names the commit:

```
## Code review

No issues found. Checked for bugs and CLAUDE.md compliance.

Commit <sha>

<!-- claude-review head=<sha> -->
```

**Green means that comment exists for the head commit**, posted by
`claude[bot]`. "Confirm this commit's review was posted", the step after the
action, looks for it on the PR and fails without it. The action's own success
only means the model ran without an error, and on 2026-09-16 that turned out to
mean nothing (see below).

The rest of the job:

- A **draft** is not reviewed; the check shows as skipped until the PR is
  marked ready, and `ready_for_review` starts the review.
- A **commit that already has its summary** (a re-run of a green job, a
  reopen) is not reviewed again. The job goes green and links the comment.
- **One review per PR at a time.** A push cancels the review of the commit it
  replaced; that run shows as cancelled.
- A **missing credential** fails the first step rather than passing quietly.

A red check that says "not reviewed" is the whole point: the failure this
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
| This workflow, subscription token | Plan usage, plus GitHub Actions minutes. One commit's review cost $1.45–7.22 at API prices on 14–16 Sep, and every push gets one | The PR-side backstop |
| This workflow, API key | Per token: the same $1.45–7.22 for each commit reviewed | Use if the plan's usage is the binding constraint |
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

`.claude/commands/ci-review.md` is protected differently. The action replaces
`.claude/` in the checkout with the default branch's copy before it starts, so
a PR that edits the command is reviewed by the version already on `main`, and
its own change first runs on the next PR after it merges.

The action signals this by exiting **green** with nothing reviewed, which is why
the workflow's last step exists: it checks the action's `execution_file` output
and fails when no review ran. Without that step the exact failure this whole
document is about — an absence that looks like a clean review — would have
survived the switch from Codex intact. It was caught on the first real run.

## The review was started and abandoned

Every green `review` check before 28 August 2026 meant less than it looked.
`show_full_output` was switched on for one PR to find out why nothing was ever
posted, and #29's run answered it:

```
"permission_denials": [],
"num_turns": 3,
"result": "I'll wait for the background agent's completion notification rather than polling.",
"subagent_stats": { "spawned": 1, "started_in_background": 1, "completed": 0 }
```

The review skill runs itself as a background subagent. In a one-shot SDK run
there is nothing to come back to: the parent finishes its turn, the process
exits, and the unfinished review goes with it. Three turns, five cents, nothing
posted — against the two minutes and sixty-seven cents the same review costs
when it actually runs.

`CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: '1'` forces it into the foreground so the
run waits. `show_full_output` came back out in the same change: this repository
is public, and one review's text in a world-readable log was the price agreed
for the diagnostic, not a standing arrangement.

An earlier run had reported `permission_denials: 11`, and that looked like the
answer until a run with zero denials failed in exactly the same way. Worth
recording as a wrong turn: a plausible number in a log is not a cause.

## Green checks that reviewed nothing (found 2026-09-16)

From 28 August to 16 September, **56 pushes across 27 PRs** got a green
`review` check from a run whose model stopped within 70 seconds and posted
nothing. Every completed review took at least 110 seconds. **25 PRs were
merged at a commit that only such a run had checked.**

| When the run stopped | Pushes | PRs |
|---|---|---|
| After the PR's first "No issues found" summary | 38 | 19: #32, #33, #35, #37, #38, #40, #44, #45, #60, #68, #69, #75, #82, #84, #85, #88, #90, #111, #128 |
| Before any summary | 16 | 9: #33, #40, #52, #61, #62, #66, #83, #85, #92 |
| The abandoned background review, above | 2 | #26, #29 |

The upstream plugin's first step launches a small agent to decide whether the
PR needs a review at all. Two of its stop conditions are:

> The pull request does not need code review (e.g. automated PR, trivial
> change that is obviously correct)
>
> Claude has already commented on this PR

The one issue comment the plugin posts is its `## Code review` / "No issues
found" summary; findings go inline. So once a PR's review came back clean, it
was not reviewed again: every one of the 38 later pushes stopped, and no
completed review ran after a summary on any PR. They cost $0.05–0.40 each,
against $1.45–7.22 for a completed review on 14–16 September. Why the other 16
stopped is not in the log; the plugin's first step has both conditions above,
and the repo's command has neither. PRs whose reviews kept finding things were
mostly reviewed on every push, which is why nobody noticed: #127 had four
inline findings across three commits and was reviewed each time.

PR #128 shows the break exactly:

| Commit | Run | Turns | Time | Cost | Posted |
|---|---|---|---|---|---|
| `b63bbff` | 35072390467 | 17 | 312 s | $1.80 | "No issues found", 08:16 |
| `668be56` | 35085944167 | 19 | 52 s | $0.21 | nothing |
| `0e7e165` | 35088217352 | 2 | 19 s | $0.09 | nothing |
| `cbe22c0` | 35088438041 | 4 | 21 s | $0.10 | nothing |
| `fcfb466` | 35089245092 | 3 | 20 s | $0.10 | nothing |

All five are green. The run log hides the model's output, so the skip decision
itself is not visible. The evidence is the plugin's own step 1, the timing
(after a summary, every run stopped), and the comments: every bot comment near
one of the 60 short runs came from a longer run that was still finishing.
"Confirm a review actually ran" passed on all of them because it checks that
the model ran, and it had.

What changed:

1. **The review is this repo's command**, `.claude/commands/ci-review.md`,
   without the "already commented" and "trivial change" stops. Drafts are
   skipped by the workflow instead, visibly.
2. **Every review ends with a summary naming its commit**, findings or not.
3. **"Confirm this commit's review was posted"** fails the job unless that
   summary exists for the head commit. Run against #128 as it stands, it fails
   `668be56`, `0e7e165`, `cbe22c0` and `fcfb466`. It fails `b63bbff` too, but
   only because that summary was posted before the marker existed.
4. **The diagnostics step read denials from a field the execution file does not
   have.** The file holds the SDK's raw result, where denials are a
   `permission_denials` array; `permission_denials_count` exists only in the
   summary the action prints. The step said `denials=0` on every run, including
   runs whose printed summary said 1. Of the 35 real reviews from 14–16
   September, 27 had at least one denial (24 had exactly one). The step now
   prints the denied tool names (names only, because the log is public). The
   first runs to print them named the Skill tool; see "What the reviewer may
   run" below. It also blames the allowlist for an
   error only when at least half the turns were denied, because otherwise a
   healthy run's one denial would be named as the cause of every failure.

A turn-count threshold was considered and dropped. A skip took 2 to 19 turns and
completed reviews on 14–16 September took 10 to 43, so the ranges overlap, and
the comment is direct evidence where a turn count is only a guess.

### What those pushes let through

Reviewed on 16 September, after the fact. For each of the 25 PRs, the last
commit a completed review saw was replayed onto the merge parent
(`git merge-tree`), and the difference from the merge commit is what no
review read. Six needed nothing: four differences were conflict resolutions
only (#45, #68, #75, #90), one was empty (#111), and one only deleted a
document (#61). The other 19 were reviewed. Nine findings had already been
fixed by later work, and nine were still in `main`:

| PR | Still in `main` on 16 September |
|---|---|
| #33 | Dragging a programme day re-deals the sessions without rotating the week, so Home's next session and the calendar name different days |
| #33 | The programme page's week strip pairs days with sessions by position, which is wrong once an empty day is dragged above a trained one |
| #33 | MIN / SESSION on the reader's own programmes leaves out the warm-up and cool-down that Home and the player count |
| #40 | The duration axis steps by 22.5 minutes for any maximum between 61 and 90 |
| #40 | A Home card or coach link to a lift that is not a target lift opens Progress with nothing expanded |
| #69 | Strong & Lean Female says the upper body goes heavy with the barbell once; the pull day opens with a 4 × 10 barbell row too |
| #92 | The hand-off shows the tracking dialog when every site it would offer is already on Home |
| #92 | The back key does not close a policy or terms page opened over the hand-off |
| #92 | `/api/transcripts` returns kept photos whole, so a few of them push the response past Vercel's 4.5 MB limit (debug reader only) |

Five more PRs (#24, #25, #28, #30, #54) merged on a red check. They changed only
this workflow and this document, which the review never runs on.

The first two runs under the new check, on #135 (`f4689c0`) and #136
(`870de1b`), were reviewed and green: "Commit … was reviewed" in the log, and
the summary on the PR with its marker.

## What the reviewer may run (2026-09-16)

The reviewer's Bash was unrestricted, and the action hands it the Claude GitHub
App's token. That is how `gh pr comment` posts the summary, and the same token
is written into the checkout's git remote. Only the instructions stopped a
confused run from pushing, merging, or calling the API with it.

`--allowedTools` now names Bash commands one by one:

- **Reading the PR:** `gh pr view`, `gh pr diff`, `gh pr list`,
  `gh issue view`, `gh issue list`, `gh search`.
- **Reading the code:** `git diff`, `log`, `show`, `blame`, `ls-files`,
  `status`, `rev-parse`, and `cat`, `head`, `tail`, `wc`, `ls`, `grep`. These
  reach nothing that Read and Grep do not; they are listed because subagents
  reach for them first. `git grep` and `rg` are left out: each can start
  another program (`-O`, `--pre`), and Grep does their job.
- **Writing:** `gh pr comment`, for the summary, and nothing else.

`gh api` is gone. The review used it for one thing: the inline comments
already on the PR, so that it does not post a finding twice. The workflow now
lists those with its read-only token into `.ci-review/inline-comments.jsonl`,
and the command reads that file.

This stops a confused run, not one built to get around the list. git's own
`-c` options can still start a program, and that program would hold the app
token as well. The PRs here come from the owner's own sessions, and a PR from
a fork gets no secrets, so the job stops at its first step.

Both first runs had one denial, and the diagnostics named it: the Skill tool,
which the model reached for instead of just following the command. The
earlier runs' single denials were counted but not named, and were most likely
the same. The command now says not to use Skill.

When a run's last step prints `Denied tools: Bash(<program>) xN`, the review
wanted a command the list does not have. Add it only if it cannot write, and
add it to the reviewed list in `tests/scripts/claudeReviewWorkflow.test.cjs`
in the same change. A PR that changes the list edits the workflow, so its own
check is red; the list is first exercised on the PR after it.

## When the review does not run

- **Check red, "No CLAUDE_CODE_OAUTH_TOKEN secret"** — setup step 3 has not been
  done, and nothing on the PR has been reviewed.
- **Check red, "exited without reviewing this PR"** — usually the workflow-file
  case above. Otherwise read the action's step in the run log for the reason.
- **Check red, "Nothing was posted for `<sha>`"** — the model ran and left no
  trace on the PR. This commit has not been reviewed. The last step of the log
  shows turns, cost and denied tools. Re-run the job. If the denied tools
  include `Bash(...)`, see "What the reviewer may run" above.
- **Check red, "posted N inline comments on `<sha>` but no summary"** — the
  review found things and stopped before it finished. Read the comments first,
  then re-run the job.
- **Check skipped** — the PR is a draft. It is reviewed once it is marked ready.
- **Check cancelled** — a newer push replaced this commit, and that push has its
  own run.
- **Check red, action failure** — read the run log. A failed review is not a
  clean review; re-run it or review the diff by hand before merging. Since
  2026-09-03 the run's last step names the case for you: tool denials, a
  one-turn usage-limit error, or something else.
- **No check at all** — the workflow file did not reach `main`, or Actions is
  disabled for the repository.

## A red check can still be hiding findings (2026-09-03)

Two different failures produced the same silent red the same afternoon, and
one of them had reviewed the PR properly first.

`--allowedTools` is an **allowlist**. The workflow named only the
inline-comment tool, so every read the reviewer attempted — the diff, the
files around it — was denied. One run spent 39 turns and $7.76 being refused,
posted two real findings anyway, and then errored. The check went red on a
review that had worked, and the findings sat unread on the PR. The allowlist
now carries the tools a reviewer needs; nothing in it can write, because the
checkout is read-only and comments go through the MCP server.

The second was a one-turn error with zero denials straight after that
expensive run. It had posted nothing.

I read that as a usage limit, and it was not: Anthropic's status page had
"elevated errors" open for three models at the time. **A one-turn error means
the model never got going — upstream refused the request — and a usage limit
and a provider incident look identical from inside the run.** Check
<https://status.anthropic.com> before concluding anything about budget. The
run's last step says the same thing now, because the wrong half of that guess
sends you looking for a quota problem that does not exist.

**So: a red review check is not evidence that nothing was found.** Read the
comments before deciding. And read them from all three places — the check
being red or green says nothing about where the bot put them:

```bash
gh api repos/lantu222/Gymlog/pulls/<n>/comments -q '.[] | .path + ":" + (.line|tostring) + "\n" + .body'
gh api repos/lantu222/Gymlog/issues/<n>/comments -q '.[] | .body'
gh api repos/lantu222/Gymlog/pulls/<n>/reviews  -q '.[] | .body'
```

This is not hypothetical. On 2026-09-03 the first of those commands turned up
**15 unread findings across PRs #46–#51**, all merged. Eleven were still live
bugs, including the one where a search-ranking fix never reached the app's
main picker — the whole point of the PR that shipped it.
