---
title: Inner Loops
description: Run a coding agent until a command passes. Feed each failure back to the next attempt, keep the check out of the agent's reach, and bound the loop.
---

# Inner Loops

An inner loop runs a coding agent until a command says the work is right. The agent makes an attempt, a check such as the test suite runs, and a failure goes back to the agent with the check's output. The loop is closed by a machine, so it can run while nobody watches, and it ends on evidence instead of on the agent's claim that it has finished.

<picture>
  <source media="(max-width: 640px)" srcset="/loops/loops-inner-portrait.svg" width="480" height="470">
  <img src="/loops/loops-inner.svg" width="720" height="440" alt="A harness.run step makes an attempt, then its repeat_policy condition runs a check. A failing check writes its output to a feedback file and the step runs again with the next repeat_index, reading that file. A passing check lets dependent steps run. When the limit is reached first, the workflow fails or hands the work to a person." style="width: 100%; height: auto; margin: 16px 0 24px;">
</picture>

## Run Until a Check Passes

Put a `repeat_policy` on the `harness.run` step and make the check its condition:

```yaml
working_dir: /srv/repos/app

steps:
  - id: fix
    action: harness.run
    with:
      provider: claude
      model: sonnet
      permission_mode: acceptEdits
      allowed_tools: "Bash(make test)"
      add_dir: ${context.paths.artifacts_dir}
      prompt: |
        Make `make test` pass. Do not edit files under tests/.
        Earlier attempts: ${context.step.repeat_index}.
        If ${context.paths.artifacts_dir}/test.log exists, it holds the
        output of the last failed `make test`. Read it before changing code.
    timeout_sec: 1200
    repeat_policy:
      repeat: until
      condition: make test > "${context.paths.artifacts_dir}/test.log" 2>&1
      limit: 5

  - id: tests_pass
    depends: [fix]
    run: make test
```

What happens:

1. Claude Code makes an attempt. `permission_mode`, `allowed_tools`, and `add_dir` are Claude Code flags: it may edit files, run `make test` itself, and read the run's artifact directory, which is outside the repository. Nothing else is allowed, because nobody is there to answer a permission prompt.
2. After the attempt, Dagu runs the condition. A condition without `expected` is a command, and exit code `0` means met. `repeat: until` stops at the first met check.
3. A failing check leaves its output in `test.log` in the run's artifact directory. The next attempt starts with `${context.step.repeat_index}` one higher and reads that file, so it knows what failed instead of guessing.
4. `limit: 5` allows at most five attempts. `timeout_sec` bounds each attempt.
5. `tests_pass` runs the check once more after the loop.

`tests_pass` matters. When the limit is reached before the check passes, the repeating step still ends `Succeeded`: the limit stops the loop, it does not judge the work. Without a check after the loop, the run would carry on with failing code.

| How the loop ends | `fix` | `tests_pass` | Run |
|---|---|---|---|
| The check passes on some attempt | Succeeded | Succeeded | Continues |
| Five attempts and the check still fails | Succeeded | Failed | Failed |

An attempt where the agent CLI itself exits non-zero does not end the loop either: the condition still decides whether another attempt runs.

`test.log` lives in the artifact directory, not in the repository, so the agent cannot commit it and a reviewer can open it from the run's **Artifacts** tab.

## What Each Attempt Sees

Each repeat starts a new agent process. Nothing carries over in the agent's memory, so each attempt starts with a fresh context window, which is the core of the [Ralph](https://ghuntley.com/ralph/) technique. What carries over is on disk:

- **The working tree.** The previous attempt's edits are still there. The next attempt continues from them.
- **The feedback file.** Whatever the condition wrote, such as `test.log`.
- **The prompt, resolved again.** Dagu resolves `with`, `stdin`, and step `env` again for every repeat, so `${context.step.repeat_index}` counts up. The condition sees the index of the attempt that just finished.

For work that spans many attempts, ask the agent to keep notes:

```yaml
    with:
      prompt: |
        Work through PLAN.md one item at a time.
        Before you stop, append what you did and what is left to
        ${context.paths.artifacts_dir}/progress.md. Read it first if it exists.
```

Short notes in a file are cheaper and more reliable than a long session that has to remember everything.

## Keep the Check Honest

The agent cannot change the condition, which lives in the workflow file. It can change what the condition runs. Agents that keep failing a test sometimes edit the test or special-case it, so do not rely on the prompt alone.

Record where the work started, and fail the run when test files changed:

```yaml
working_dir: /srv/repos/app

steps:
  - id: base
    run: git rev-parse HEAD
    output: BASE

  - id: fix
    depends: [base]
    action: harness.run
    with:
      provider: claude
      model: sonnet
      permission_mode: acceptEdits
      allowed_tools: "Bash(make test)"
      add_dir: ${context.paths.artifacts_dir}
      prompt: |
        Make `make test` pass. Do not edit files under tests/.
        If ${context.paths.artifacts_dir}/test.log exists, read it first.
    repeat_policy:
      repeat: until
      condition: make test > "${context.paths.artifacts_dir}/test.log" 2>&1
      limit: 5

  - id: tests_untouched
    depends: [fix]
    run: git diff --exit-code --stat ${BASE} -- tests/

  - id: tests_pass
    depends: [tests_untouched]
    run: make test
```

`git diff --exit-code` fails when anything under `tests/` differs from where the run started, committed or not. Stronger options, in order of effort:

- Run the agent in a [container sandbox](/step-types/harness/sandbox/) that mounts the test directory read-only.
- Keep acceptance tests outside the repository the agent works in, and run them only in the step after the loop.

## A Loop Body with Several Steps

When one attempt is several steps, such as implement, check, and commit, put them in a child workflow and repeat the `dag.run` step:

```yaml
params:
  - name: repo
    default: /srv/repos/app

steps:
  - id: attempts
    action: dag.run
    with:
      dag: attempt
      params:
        repo: ${params.repo}
        round: ${context.step.repeat_index}
        state: ${context.paths.artifacts_dir}
    repeat_policy:
      repeat: until
      limit: 4

---
name: attempt
working_dir: ${params.repo}
params:
  - name: repo
    type: string
  - name: round
    default: "0"
  - name: state
    type: string

steps:
  - id: implement
    action: harness.run
    with:
      provider: codex
      sandbox: workspace-write
      prompt: |
        Implement the change described in TASK.md. This is round ${params.round}.
        If ${params.state}/check.log exists, it holds the last failure.

  - id: check
    depends: [implement]
    run: make lint test > "${params.state}/check.log" 2>&1

  - id: commit
    depends: [check]
    run: git add -A && git commit -m "Implement TASK.md (round ${params.round})"
```

`repeat: until` without a condition repeats until an attempt succeeds. Here an attempt is a whole child run: it succeeds only when `implement`, `check`, and `commit` all succeed.

This form differs from the single step in three ways:

- **No check after the loop is needed.** When the last allowed attempt fails, the `dag.run` step fails, and so does the run.
- **Each attempt is its own run.** Every round has its own child run, logs, and status, so a reviewer can open round 2 and see exactly what the agent did and what failed.
- **Values reach the child as `params`.** A child step has no repeat index of its own, so the parent passes `round`, and passes its own artifact directory as `state` so that feedback survives from one child run to the next. A child does not inherit the parent's working directory, so it declares `working_dir` from a parameter.

## When the Check Needs Judgment

Some criteria have no command: readable naming, a sound design, a complete migration. For those, let a second agent review and make its verdict the check. This is the evaluator-optimizer pattern: one agent writes, another grades.

```yaml
params:
  - name: repo
    default: /srv/repos/app

steps:
  - id: rounds
    action: dag.run
    with:
      dag: round
      params:
        repo: ${params.repo}
        round: ${context.step.repeat_index}
        state: ${context.paths.artifacts_dir}
    repeat_policy:
      repeat: until
      limit: 3

---
name: round
working_dir: ${params.repo}
params:
  - name: repo
    type: string
  - name: round
    default: "0"
  - name: state
    type: string

steps:
  - id: implement
    action: harness.run
    with:
      provider: codex
      sandbox: workspace-write
      prompt: |
        Implement TASK.md. This is round ${params.round}.
        If ${params.state}/review.json exists, fix every issue it lists.

  - id: test
    depends: [implement]
    run: make test

  - id: review
    depends: [test]
    action: harness.run
    with:
      provider: claude
      model: opus
      disallowed_tools: "Edit Write"
      prompt: |
        Review the uncommitted changes against TASK.md. The tests pass.
        List only issues that must be fixed before merge.
        Return only one JSON object: {"approved": true|false, "issues": ["..."]}
    stdout: ${params.state}/review-${params.round}.json
    output_schema:
      type: object
      required: [approved, issues]
      properties:
        approved: { type: boolean }
        issues: { type: array, items: { type: string } }

  - id: verdict
    depends: [review]
    run: |
      cp "${params.state}/review-${params.round}.json" "${params.state}/review.json"
      test "${review.output.approved}" = "true"
```

- **Tests run before the review.** A command is cheaper and more reliable than a reviewer, so the reviewer only sees work that already passes.
- **The reviewer uses a different provider.** Models favour output from their own model. Codex writes and Claude Code reviews here; any two of the [supported providers](/step-types/harness/#supported-providers) work.
- **The reviewer cannot edit.** `disallowed_tools: "Edit Write"` is a Claude Code flag that keeps it a reviewer.
- **The verdict is validated.** `output_schema` rejects anything but the declared JSON, so `verdict` reads a real boolean.
- **Only blocking issues count.** A reviewer asked for every possible improvement never approves. Ask for what must change before merge.
- **Every review is kept.** Each round writes `review-<round>.json` to the parent's artifact directory, and `review.json` is the latest, which the next round reads.

A reviewer agent is still a model judging work, and it can be wrong. Keep tests first, and keep a person on the outer loop for anything that ships: [Outer Loops](./outer-loop).

## Limits and Budgets

| Bound | Field | Notes |
|---|---|---|
| Attempts | `repeat_policy.limit` | 3 to 5 is a sound default. Most of the gain comes in the first few rounds. |
| Time per attempt | `timeout_sec` on the step | Stops an agent that hangs or wanders. |
| Time for the whole run | `timeout_sec` at the top of the DAG | Bounds every loop in the run together. |
| Spend per attempt | Provider flags, such as Claude Code's `max_budget_usd` | Worst case for the loop is the limit times the per-attempt cap. |
| Pause between attempts | `repeat_policy.interval_sec`, `backoff` | Spreads attempts out under rate limits. |
| Provider outages | `with.fallback` | Moves the attempt to another provider; see [Fallbacks](/step-types/harness/#fallbacks). |

Built-in CLI providers do not report token usage to Dagu, so the step records them under `notReported` in [model usage](/step-types/llm/#model-usage). Cap spend with the provider's own flags, and keep `limit` small.

## Choosing a Form

| | Single `harness.run` step | Repeated `dag.run` step |
|---|---|---|
| Check | One command | Several steps, a reviewer agent, a commit |
| Running out of attempts | Add a check after the loop | The step fails by itself |
| Inspecting an attempt | One step log with every attempt | One child run per attempt |
| Repeat index | `${context.step.repeat_index}` | Passed to the child as a parameter |

## See Also

- [Outer Loops](./outer-loop): send passing work to a person, and let them push it back.
- [Repetition](/writing-workflows/control-flow#repetition): every `repeat_policy` field.
- [Harness](/step-types/harness/): providers, flags, structured output, and fallbacks.
- [Sub-DAGs](/writing-workflows/sub-dags): parameters, working directories, and child results.
