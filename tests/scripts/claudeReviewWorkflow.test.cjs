const assert = require('node:assert/strict');
const { spawnSync, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/**
 * Guards for .github/workflows/claude-review.yml and the command it runs,
 * .claude/commands/ci-review.md.
 *
 * The workflow's whole job is that green means "this commit was reviewed".
 * It has failed that twice by passing while doing nothing: once when the
 * review ran in the background and was abandoned, and once — for twenty
 * commits — when the upstream plugin skipped every PR Claude had already
 * commented on. Neither failure shows up anywhere but a green check, so only
 * a test notices a change that brings one back.
 *
 * Comments are stripped before anything is matched: the workflow explains
 * its history at length, and a guard that a comment can satisfy guards
 * nothing.
 */

const ROOT = path.join(__dirname, '..', '..');
const WORKFLOW = '.github/workflows/claude-review.yml';
const COMMAND = '.claude/commands/ci-review.md';
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8').replace(/\r\n/g, '\n');

const isComment = (line) => line.trim().startsWith('#');

// Just enough YAML for this one file: the job header, then one block per
// `      - ` step item. Every scalar the checks need sits at a fixed indent.
function parseWorkflow() {
  const lines = read(WORKFLOW).split('\n');
  const stepsAt = lines.findIndex((line) => line === '    steps:');
  assert.ok(stepsAt > 0, `${WORKFLOW} has no job steps where expected`);

  const job = lines.slice(0, stepsAt).filter((line) => !isComment(line));
  const steps = [];
  let current = null;
  for (const line of lines.slice(stepsAt + 1)) {
    if (line.startsWith('      - ')) {
      current = { lines: [] };
      steps.push(current);
      current.lines.push(`        ${line.slice(8)}`);
    } else if (current) {
      current.lines.push(line);
    }
  }

  return {
    job,
    steps: steps.map(({ lines: stepLines }) => {
      const code = stepLines.filter((line) => !isComment(line));
      const field = (key) => {
        const hit = code.find((line) => line.startsWith(`        ${key}: `));
        return hit === undefined ? undefined : hit.slice(`        ${key}: `.length).trim();
      };
      const runAt = code.findIndex((line) => line === '        run: |');
      let run;
      if (runAt >= 0) {
        const block = [];
        for (const line of code.slice(runAt + 1)) {
          if (line !== '' && !line.startsWith('          ')) break;
          block.push(line.slice(10));
        }
        run = block.join('\n').trim();
      }
      return {
        name: field('name'),
        id: field('id'),
        if: field('if'),
        uses: field('uses'),
        continueOnError: field('continue-on-error'),
        code: code.join('\n'),
        run,
      };
    }),
  };
}

function stepNamed(steps, name) {
  const index = steps.findIndex((step) => step.name === name);
  assert.ok(index >= 0, `${WORKFLOW} has no step named "${name}"`);
  return { index, step: steps[index] };
}

const PRIOR = "Find this commit's review";
const POSTED = "Confirm this commit's review was posted";
const RAN = 'Confirm a review actually ran';
const EXPLAIN = 'Say which kind of red this is';

function actionStep(steps) {
  const index = steps.findIndex((step) => (step.uses ?? '').startsWith('anthropics/claude-code-action@'));
  assert.ok(index >= 0, `${WORKFLOW} no longer runs anthropics/claude-code-action`);
  return { index, step: steps[index] };
}

// The marker as the command tells the reviewer to write it, split around the
// SHA placeholder.
function commandMarker() {
  const match = read(COMMAND).match(/<!-- claude-review head=<full sha> -->/);
  assert.ok(match, `${COMMAND} no longer tells the reviewer to end the summary with the commit marker`);
  return { before: '<!-- claude-review head=', after: ' -->' };
}

// Git for Windows' bash, not the WSL launcher that PowerShell finds first.
function findBash() {
  if (process.platform !== 'win32') return 'bash';
  const execPath = execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim();
  const candidate = path.join(execPath, '..', '..', '..', 'bin', 'bash.exe');
  assert.ok(
    fs.existsSync(candidate),
    `Git Bash not found at ${candidate}; these steps run in bash on the runner and are tested in bash here.`,
  );
  return candidate;
}

/**
 * Runs one step's script the way the runner does (`bash -e`), with `gh`
 * replaced by a function that answers from fixtures: `summaries` for the
 * issue-comment lookup, `findings` for the inline-comment one. The real gh is
 * never reached.
 */
function runStep(script, { summaries = '', findings = '', ghFails = false }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-review-step-'));
  try {
    const output = path.join(dir, 'github_output');
    fs.writeFileSync(output, '');
    fs.writeFileSync(path.join(dir, 'summaries'), summaries);
    fs.writeFileSync(path.join(dir, 'findings'), findings);
    const stub = [
      'gh() {',
      ghFails ? '  echo "HTTP 502" >&2; return 1' : '',
      '  case "$*" in',
      '    *"/issues/"*) cat "$FIXTURES/summaries" ;;',
      '    *"/pulls/"*) cat "$FIXTURES/findings" ;;',
      '    *) echo "unexpected gh call: $*" >&2; return 99 ;;',
      '  esac',
      '}',
    ].join('\n');
    const file = path.join(dir, 'step.sh');
    fs.writeFileSync(file, `${stub}\n${script}\n`);
    const result = spawnSync(findBash(), ['--noprofile', '--norc', '-e', file.replace(/\\/g, '/')], {
      encoding: 'utf8',
      env: {
        ...process.env,
        FIXTURES: dir.replace(/\\/g, '/'),
        GITHUB_OUTPUT: output.replace(/\\/g, '/'),
        REPO: 'lantu222/Gymlog',
        PR: '128',
        HEAD_SHA: 'fcfb466a0000000000000000000000000000beef',
        REVIEWER: 'claude[bot]',
      },
    });
    assert.equal(result.error, undefined, String(result.error));
    return { status: result.status, stdout: result.stdout, stderr: result.stderr, output: fs.readFileSync(output, 'utf8') };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const SUMMARY_URL = 'https://github.com/lantu222/Gymlog/pull/128#issuecomment-1';

module.exports = [
  {
    name: 'claude-review: the review comes from the repo command, not the plugin that skips re-reviews',
    run() {
      const { steps } = parseWorkflow();
      const { step } = actionStep(steps);

      // The upstream plugin stops on any PR Claude has commented on, and
      // exits green. Installing it again brings back twenty silent passes.
      assert.ok(!step.code.includes('code-review@claude-code-plugins'), 'the upstream code-review plugin is installed again');
      assert.ok(!step.code.includes('/code-review:code-review'), 'the prompt runs the upstream plugin command again');

      const prompt = step.code.split('\n').find((line) => line.trim().startsWith('prompt:'));
      assert.ok(prompt, 'the action step has no prompt');
      assert.match(prompt, /prompt: "\/ci-review --comment /, 'the prompt must run /ci-review and post with --comment');
      assert.ok(
        prompt.includes('--head ${{ github.event.pull_request.head.sha }}'),
        'the prompt must name the head commit, or the summary cannot say which commit it covers',
      );
      assert.ok(fs.existsSync(path.join(ROOT, COMMAND)), `${COMMAND} is missing; /ci-review would reach the model as plain text`);
    },
  },
  {
    name: 'claude-review: the command reviews every head commit and says so in a marker',
    run() {
      const command = read(COMMAND);
      // The two upstream eligibility rules that end a run without a word.
      // A re-sync from upstream brings these exact lines back.
      assert.ok(!/Claude has already commented on this PR/.test(command), 'the command skips PRs Claude has commented on again');
      assert.ok(!/does not need code review/.test(command), 'the command lets the model skip a PR it judges trivial again');
      assert.match(command, /Review it even if Claude has commented on this pull request before/);

      // The summary is posted whatever the outcome, and last.
      assert.match(command, /Post it in every case/);
      assert.match(command, /only once every inline comment from step 9 has been posted/);
      commandMarker();
      assert.match(command, /\$ARGUMENTS/, 'the command must read its arguments; the PR and commit come from them');

      // The command also appears as /ci-review in local sessions, where
      // allowed-tools skips the prompt. `gh api` covers DELETE and merge as
      // much as the one read step 7 needs; CI allows Bash wholesale anyway.
      const allowed = command.match(/^allowed-tools: (.*)$/m);
      assert.ok(allowed, `${COMMAND} lost its allowed-tools line`);
      assert.ok(!allowed[1].includes('Bash(gh api'), 'allowed-tools pre-approves gh api, writes included, in local sessions');
    },
  },
  {
    name: 'claude-review: both lookups match the marker the command writes, by the reviewer, for the head commit',
    run() {
      const { steps } = parseWorkflow();
      const { before, after } = commandMarker();
      const marker = `contains("${before}" + env.HEAD_SHA + "${after}")`;
      // The whole condition, so that dropping the author half is caught even
      // though the inline-comment filter below it names the reviewer too.
      const summaryFilter = `select(.user.login == env.REVIEWER and (.body | ${marker}))`;
      for (const name of [PRIOR, POSTED]) {
        const { step } = stepNamed(steps, name);
        assert.ok(step.run.includes(marker), `"${name}" does not look for the marker the command writes`);
        assert.ok(step.run.includes(summaryFilter), `"${name}" accepts the marker from anyone`);
        assert.match(step.code, /HEAD_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
        assert.match(step.code, /REVIEWER: claude\[bot\]/);
        assert.match(step.code, /GH_TOKEN: \$\{\{ github\.token \}\}/);
      }
    },
  },
  {
    name: 'claude-review: steps run in an order where green can only follow a posted review',
    run() {
      const { steps } = parseWorkflow();
      const prior = stepNamed(steps, PRIOR);
      const action = actionStep(steps);
      const ran = stepNamed(steps, RAN);
      const posted = stepNamed(steps, POSTED);
      const explain = stepNamed(steps, EXPLAIN);

      assert.ok(prior.index < action.index, 'the lookup must come before the review it can skip');
      assert.ok(action.index < ran.index && ran.index < posted.index, 'the checks must follow the review');
      assert.ok(posted.index < explain.index, 'the diagnostics come last');

      assert.equal(prior.step.id, 'prior');
      assert.equal(action.step.if, "steps.prior.outputs.url == ''");
      assert.equal(ran.step.if, "steps.prior.outputs.url == ''");

      // No `if` means it runs whenever everything before it passed, including
      // when the review was skipped because this commit already has one.
      // always() would run it after a failure too; continue-on-error would let
      // it fail without turning the check red.
      assert.equal(posted.step.if, undefined, `"${POSTED}" must not be conditional`);
      assert.equal(posted.step.continueOnError, undefined, `"${POSTED}" must be able to fail the job`);
      assert.match(posted.step.run, /\nexit 1$/, `"${POSTED}" must end by failing when nothing matched`);

      // Diagnostics explain; they never decide.
      assert.equal(explain.step.continueOnError, 'true');
    },
  },
  {
    name: 'claude-review: the job reads only, skips drafts, and keeps GH_TOKEN away from the reviewer',
    run() {
      const { job, steps } = parseWorkflow();
      const writes = job.filter((line) => /^\s+[\w-]+: write$/.test(line)).map((line) => line.trim());
      assert.deepEqual(writes, ['id-token: write'], 'the job token gained a write scope');

      assert.ok(job.includes('    if: ${{ !github.event.pull_request.draft }}'), 'drafts are reviewed again, or the skip moved');
      assert.ok(!job.some((line) => line.includes('GH_TOKEN')), 'GH_TOKEN at job level overrides the token the reviewer posts with');
      assert.ok(!actionStep(steps).step.code.includes('GH_TOKEN'), 'GH_TOKEN on the action overrides the token the reviewer posts with');
    },
  },
  {
    name: 'claude-review: diagnostics read denials from the array the execution file actually has',
    run() {
      const { steps } = parseWorkflow();
      const { step } = stepNamed(steps, EXPLAIN);
      // The execution file holds the SDK's raw result: `permission_denials`,
      // an array. The count field only exists in the action's printed summary,
      // so reading it reported 0 denials on runs that had them.
      assert.ok(!step.run.includes('permission_denials_count'), 'diagnostics read a field the execution file does not have');
      assert.match(step.run, /\.permission_denials \/\/ \[\] \| length/);
      // Names only: the log is public and a denied call's input is not.
      assert.ok(!step.run.includes('tool_input'), 'diagnostics would print denied tool input to a public log');
    },
  },
  {
    name: 'claude-review: the posted-review check passes only on a summary for this commit',
    run() {
      const { step } = stepNamed(parseWorkflow().steps, POSTED);

      const reviewed = runStep(step.run, { summaries: `${SUMMARY_URL}\n` });
      assert.equal(reviewed.status, 0, reviewed.stderr);
      assert.match(reviewed.stdout, /was reviewed: https:\/\/github\.com\/lantu222\/Gymlog\/pull\/128#issuecomment-1/);

      const cutOff = runStep(step.run, { findings: '11\n12\n' });
      assert.equal(cutOff.status, 1);
      assert.match(cutOff.stdout, /::error::The review posted 2 inline comments on fcfb466a/);

      const nothing = runStep(step.run, {});
      assert.equal(nothing.status, 1);
      assert.match(nothing.stdout, /::error::Nothing was posted for fcfb466a/);

      const apiDown = runStep(step.run, { ghFails: true });
      assert.notEqual(apiDown.status, 0);
    },
  },
  {
    name: 'claude-review: the lookup skips a reviewed commit and fails rather than guess when GitHub errors',
    run() {
      const { step } = stepNamed(parseWorkflow().steps, PRIOR);

      const found = runStep(step.run, { summaries: `${SUMMARY_URL}\n${SUMMARY_URL}-later\n` });
      assert.equal(found.status, 0, found.stderr);
      assert.equal(found.output, `url=${SUMMARY_URL}\n`, 'one URL, the first, or the output line breaks');

      const none = runStep(step.run, {});
      assert.equal(none.status, 0, none.stderr);
      assert.equal(none.output, 'url=\n');

      // An error read as "no review yet" would only cost a review. An error
      // read as "reviewed" would be the silent green again, so the step fails.
      const apiDown = runStep(step.run, { ghFails: true });
      assert.notEqual(apiDown.status, 0);
      assert.equal(apiDown.output, '');
    },
  },
];
