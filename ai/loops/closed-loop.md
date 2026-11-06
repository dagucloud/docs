---
title: Closed Loops
description: Close the loop around a coding agent with a check outside the agent, a route back for what it found, and a limit. Use a command, a reviewer agent, or a person.
---

# Closed Loops

In a closed loop, something outside a coding agent checks each result, and what it found goes back to the agent for another attempt. The agent no longer decides on its own that the work is done. It keeps working from evidence until the check passes or the attempts run out.

The term comes from control engineering. A heater on a timer runs open loop: it never learns the temperature of the room. A thermostat measures the room and corrects, so it runs closed. Closed does not mean unattended, as the word sometimes does in operations. The check can be a person, and for work that ships, one of the checks usually should be.

<picture>
  <source media="(max-width: 640px)" srcset="/loops/loops-closed-portrait.svg" width="480" height="600">
  <img src="/loops/loops-closed.svg" width="720" height="410" alt="A coding agent in a harness.run step produces a result. A signal from outside the agent measures it: a command in repeat_policy, a reviewer agent with output_schema, or a person in a human.task step. A failure takes the route back to the agent with what the check found. A pass lets the next step run. When the limit is reached, the workflow fails or hands the work over." style="width: 100%; height: auto; margin: 16px 0 24px;">
</picture>

## The Three Parts

A closed loop needs all three parts. Take one away and what remains is the agent grading itself, a plain retry, or a loop with no end.

1. **A signal from outside the agent.** A command's exit code, a reviewer's verdict, or a person's decision says whether the work is right. The agent's own report does not count: models that review their own work without outside feedback do not reliably improve it, and often make it worse ([Huang et al.](https://arxiv.org/abs/2310.01798)).
2. **A route back to the agent.** What the signal found reaches the next attempt. An exit code decides whether there is another attempt. The output tells that attempt what to fix.
3. **A limit.** The attempts are bounded, and running out is an outcome the workflow handles: the run fails, or a person takes over.

## Close an Open Loop

This step is an open loop. Codex edits the repository, and the step succeeds when the CLI exits `0`, whether or not the tests pass:

```yaml
working_dir: /srv/repos/app

steps:
  - id: fix
    action: harness.run
    with:
      provider: codex
      sandbox: workspace-write
      prompt: |
        Make `make test` pass. Do not edit files under tests/.
    timeout_sec: 1200
```

The highlighted lines close it:

```yaml{11-12,14-17,19-21}
working_dir: /srv/repos/app

steps:
  - id: fix
    action: harness.run
    with:
      provider: codex
      sandbox: workspace-write
      prompt: |
        Make `make test` pass. Do not edit files under tests/.
        If ${context.paths.artifacts_dir}/test.log exists, it holds the
        output of the last failed `make test`. Read it first.
    timeout_sec: 1200
    repeat_policy:
      repeat: until
      condition: make test > "${context.paths.artifacts_dir}/test.log" 2>&1
      limit: 5

  - id: tests_pass
    depends: [fix]
    run: make test
```

- **Signal.** Dagu runs `condition` after every attempt, and exit code `0` ends the loop. The agent cannot skip the check or report a result in place of it.
- **Route back.** The condition writes the output of `make test` to `test.log`, and two lines of the prompt tell the next attempt to read it. Without them the loop still repeats, but each attempt has to work out for itself what failed.
- **Limit.** `limit: 5` stops the loop, but it does not judge the work: a step that runs out of attempts still ends `Succeeded`. `tests_pass` runs the check once more, which fails the run if the tests still fail.

[Inner Loops](./inner-loop) covers this form in full.

## Close a Gate

A person can close the loop too. This is the release notes gate from [Open Loops](./open-loop#gate-what-ships), where the person could only complete the task or stop the run. `with.push_back` lets them send the draft back:

```yaml{22-29}
working_dir: /srv/repos/app

steps:
  - id: draft
    action: harness.run
    with:
      provider: claude
      model: sonnet
      prompt: |
        Draft release notes for the changes since the last tag.
        Group them as Features, Fixes, and Breaking changes.
    stdout:
      artifact: release-notes.md

  - id: confirm
    depends: [draft]
    action: human.task
    with:
      prompt: Publish these release notes?
      artifacts:
        - release-notes.md
      push_back:
        rewind_to: draft
        form:
          type: object
          required: [feedback]
          properties:
            feedback:
              type: string

  - id: publish
    depends: [confirm]
    run: ./publish-notes.sh "${DAG_RUN_ARTIFACTS_DIR}/release-notes.md"
```

- **Signal.** The person's decision, made with the draft open beside the prompt.
- **Route back.** `push_back` reruns `draft` and every step after it, with the feedback appended to the agent's prompt. No wiring carries it.
- **Limit.** The person. The task opens again after each rerun, and the loop continues only when someone sends the work back. Completing the task or stopping the run ends it.

[Outer Loops](./outer-loop) covers this form in full.

## Choose What Closes It

| Closed by | Signal | Route back | Limit | Guide |
|---|---|---|---|---|
| A command | The exit code of `repeat_policy.condition` | The condition writes its output to a file, and the prompt names the file | `repeat_policy.limit` | [Inner Loops](./inner-loop) |
| A reviewer agent | A verdict that `output_schema` validates | A `review.json` that the next round reads | `repeat_policy.limit` on a `dag.run` step | [When the Check Needs Judgment](./inner-loop#when-the-check-needs-judgment) |
| A person | Completing or pushing back a `human.task` | `with.push_back` appends the feedback to the prompt | The person completes the task or stops the run | [Outer Loops](./outer-loop) |

Use the cheapest one that can decide, and when a run needs more than one, stack them in this order. A command costs little and cannot be talked round. A reviewer agent spends tokens and can be wrong. A person's attention is the scarcest of the three. Run in this order, each one sees only work that the one before it passed.

## Any Command Can Close It

Tests are the common case, not the only one. Anything that exits `0` for good work and non-zero for bad work can be the condition:

| Result | Check |
|---|---|
| Code | `make test`, `go vet ./...`, `tsc --noEmit` |
| A pull request | `gh pr checks --watch --fail-fast` |
| A JSON reply | `check-jsonschema --schemafile schema.json reply.json` |
| A Dagu workflow | `dagu validate workflow.yaml` |
| A performance target | A script that compares a benchmark with a threshold |

The more exactly a check says what is wrong, the more it gives the next attempt. `test -f report.md` can end a loop, but it tells the agent nothing.

This loop closes around a structured reply. The agent never edits a file, and a validator takes the place of the tests:

```yaml
working_dir: /srv/repos/app

steps:
  - id: triage
    action: harness.run
    with:
      provider: codex
      sandbox: read-only
      prompt: |
        Triage the bug report in REPORT.md. Return only one JSON object:
        {"severity": "low|high", "area": "...", "summary": "..."}
        If ${context.paths.artifacts_dir}/errors.txt exists, your last reply
        failed validation with those errors. Fix them.
    stdout:
      artifact: triage.json
    repeat_policy:
      repeat: until
      condition: >-
        check-jsonschema --schemafile triage.schema.json
        "${context.paths.artifacts_dir}/triage.json"
        > "${context.paths.artifacts_dir}/errors.txt" 2>&1
      limit: 3

  - id: valid
    depends: [triage]
    run: check-jsonschema --schemafile triage.schema.json "${DAG_RUN_ARTIFACTS_DIR}/triage.json"
```

Each attempt replaces `triage.json`, so the condition always checks the latest reply. After a bad one, the next attempt reads the validator's message:

```text
Schema validation errors were encountered.
  /…/triage.json::$: 'summary' is a required property
  /…/triage.json::$.severity: 'critical' is not one of ['low', 'high']
```

[`output_schema`](./open-loop#validate-the-shape) checks the same thing as a gate: it fails the step, and a retry sends the same prompt again. The difference between the two is the route back.

## Loops That Only Look Closed

These are easy to build by accident, and most of them finish green.

| Looks closed | What is missing | To close it |
|---|---|---|
| The prompt says "run the tests until they pass" | **Signal.** The agent decides when to stop, and reports its own result. | Make the tests the `repeat_policy` condition. |
| The agent reviews its own work | **Signal.** A model is judging its own output. | Use a command, or a [reviewer from another provider](./inner-loop#when-the-check-needs-judgment). |
| The agent can edit what the check runs | **Signal.** The agent can change the answer. | [Keep the check honest](./inner-loop#keep-the-check-honest). |
| `condition: make test \| tee test.log` | **Signal.** A pipeline exits with the status of its last command, so the check always passes and the loop ends after one attempt. The same goes for `\| tail`. | Redirect with `>`, or set `shell: bash -o pipefail` on the DAG. |
| `condition: make test` | **Route back.** The check can end the loop, but the next attempt is not told what failed. | Write the output to a file, and name the file in the prompt. |
| The prompt says only "implement TASK.md" | **Route back.** The failure reaches the agent, but nothing tells it to act. When the check tests more than the task, the agent can read the failure, call it out of scope, and spend every attempt saying so. | [Say that the check decides](./inner-loop#say-that-the-check-decides). |
| `retry_policy` or `with.fallback` | **Route back.** The next attempt gets the same prompt. | Keep them for crashes and outages, and add `repeat_policy` for the work itself. |
| A test step after the agent | **Route back.** It is a gate: it can fail the run, but it cannot send anything back. | Make the test the condition. |
| `output_schema` | **Route back.** It is a gate: the step fails, and the agent never learns why. | [Run a validator in the condition](#any-command-can-close-it). |
| `human.task` without `with.push_back` | **Route back.** It is a gate: the person can complete the task or stop the run. | [Add `with.push_back`](#close-a-gate). |
| A nightly schedule | **Route back.** Nothing about last night's result reaches tonight's run. | Keep results where the next run reads them, and close a loop inside each run. |
| `repeat_policy` without `limit` | **Limit.** The step repeats until the condition is met or the run stops. | Set `limit`. |
| `limit` with nothing after the loop | **Limit.** Running out ends `Succeeded`, and the run carries on with failing work. | Check again in a later step, or [hand the work to a person](./outer-loop#hand-over-when-the-agent-gives-up). |

Three questions tell you whether a loop is closed:

1. Could the agent change the check's answer?
2. What does the next attempt know that this one did not?
3. What happens when the attempts run out?

Good answers are no, what the check found, and something the workflow handles.

## Closed Loops Nest

One run usually holds several closed loops at different speeds. A command closes the fastest, around each attempt. A person closes a slower one around that, and each push-back starts the fast one again.

- [Inner Loops](./inner-loop): a command or a reviewer agent closes the loop, in minutes, with nobody watching.
- [Outer Loops](./outer-loop): a person closes the loop, in hours or days, around work that already passed the inner loop.
- [Background Loops](./background-loop): a schedule or an event starts the run, and the loops inside it close as usual. What ships changes what the next run finds.

## See Also

- [Open Loops](./open-loop): when a result does not need to go back to the agent.
- [Repetition](/writing-workflows/control-flow#repetition): every `repeat_policy` field.
- [Human Tasks](/writing-workflows/human-tasks#requesting-changes): forms, artifacts, and push-back in full.
