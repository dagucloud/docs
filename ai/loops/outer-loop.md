---
title: Outer Loops
description: Let a person close the loop around a coding agent. Push work back with feedback that reruns the agent, review the plan before the code, and take over when the agent runs out of attempts.
---

# Outer Loops

An outer loop is [closed](./closed-loop) by a person. Work that passed the inner loop's checks reaches a [human task](/writing-workflows/human-tasks). The person completes it, or pushes it back with feedback. A push-back reruns the coding agent and every step after it, with the feedback added to the agent's prompt, and the task opens again with the new result.

<picture>
  <source media="(max-width: 640px)" srcset="/loops/loops-outer-portrait.svg" width="480" height="560">
  <img src="/loops/loops-outer.svg" width="720" height="330" alt="Work that passes the inner loop reaches a person in a human.task step. Completing the task lets the workflow ship. Pushing it back reruns the coding agent, and every step after it, with the person's feedback appended to the agent's prompt; the inner loop runs again before the task reopens." style="width: 100%; height: auto; margin: 16px 0 24px;">
</picture>

The person's attention is the scarcest thing in the loop. The workflow should spend it only on work that machines have already checked, show it the evidence, and make sending work back as cheap as accepting it.

## Push Back to the Agent

```yaml
working_dir: /srv/repos/app

steps:
  - id: base
    run: git rev-parse HEAD
    output: BASE

  - id: implement
    depends: [base]
    action: harness.run
    with:
      provider: claude
      model: sonnet
      permission_mode: acceptEdits
      allowed_tools: "Bash(make test)"
      add_dir: ${context.paths.artifacts_dir}
      prompt: |
        Implement the change described in TASK.md.
        If ${context.paths.artifacts_dir}/test.log exists, it holds the
        output of the last failed `make test`. Read it first.
    repeat_policy:
      repeat: until
      condition: make test > "${context.paths.artifacts_dir}/test.log" 2>&1
      limit: 5

  - id: evidence
    depends: [implement]
    run: |
      make test
      git diff ${BASE} > "${DAG_RUN_ARTIFACTS_DIR}/change.diff"

  - id: review
    depends: [evidence]
    action: human.task
    with:
      prompt: |
        Review the change for TASK.md. The tests pass.
        Complete the task to open a pull request, or request changes.
      artifacts:
        - change.diff
        - test.log
      push_back:
        rewind_to: implement
        form:
          type: object
          required: [feedback]
          properties:
            feedback:
              type: string
              title: What should change?

  - id: open_pr
    depends: [review]
    run: git push -u origin HEAD && gh pr create --fill
```

`implement` is the [inner loop](./inner-loop): it repeats until `make test` passes. `evidence` fails the run if the inner loop ran out of attempts, and otherwise saves the diff. The run then waits at `review` without holding a process, for minutes or for days.

The reviewer opens the run from **Cockpit**, reads `change.diff` and `test.log` on the **Actions** tab, and chooses:

- **Complete task**: `open_pr` runs.
- **Request changes**: the feedback form opens. Submitting it sends the work back.

### What a Push-back Does

1. `implement`, `evidence`, and `review` reset to `Not Started`.
2. The run resumes from the queue. `implement` runs again as a fresh inner loop: `${context.step.repeat_index}` starts at `0`, and up to five attempts run until `make test` passes.
3. Every attempt of that inner loop gets the feedback appended to its prompt:

   ```text
   Implement the change described in TASK.md.
   If /…/test.log exists, it holds the
   output of the last failed `make test`. Read it first.

   ## Push-back Context

   Push-back iteration: 1
   Previous stdout log: /…/implement.20261106.004626.876.034sOFZe.out

   Reviewer feedback:
   - feedback: Handle the empty input case
   ```

4. `evidence` saves a new diff, and `review` opens again with the iteration count and the earlier feedback shown on the task.

No wiring carries the feedback: `harness.run` steps receive it automatically. The previous stdout is passed as a path, not inlined, because agent output can be large. Other steps receive it as environment variables; see [Push-back Context](/writing-workflows/human-in-the-loop#push-back-context).

## Review the Plan First

A wrong plan produces a lot of wrong code, and reading a plan takes minutes where reading a diff takes an hour. Put the first checkpoint on the plan:

```yaml
working_dir: /srv/repos/app

steps:
  - id: plan
    action: harness.run
    with:
      provider: claude
      model: opus
      disallowed_tools: "Edit Write"
      prompt: |
        Read TASK.md and the code it touches. Write an implementation plan:
        the files to change, the approach, the risks, and how to test it.
        Do not change any files. Reply with the plan in Markdown only.
    stdout:
      artifact: plan.md

  - id: approve_plan
    depends: [plan]
    action: human.task
    with:
      prompt: Approve the plan, or send it back with what to change.
      artifacts:
        - plan.md
      push_back:
        rewind_to: plan
        form:
          type: object
          required: [feedback]
          properties:
            feedback:
              type: string

  - id: implement
    depends: [approve_plan]
    action: harness.run
    with:
      provider: codex
      sandbox: workspace-write
      prompt: |
        Implement the approved plan in ${context.paths.artifacts_dir}/plan.md.
        If ${context.paths.artifacts_dir}/test.log exists, it holds the
        output of the last failed `make test`. Read it first.
    repeat_policy:
      repeat: until
      condition: make test > "${context.paths.artifacts_dir}/test.log" 2>&1
      limit: 5

  - id: tests_pass
    depends: [implement]
    run: make test

  - id: review
    depends: [tests_pass]
    action: human.task
    with:
      prompt: Review the implementation of the approved plan.
      artifacts:
        - plan.md
        - test.log
      push_back:
        rewind_to: implement
        form:
          type: object
          required: [feedback]
          properties:
            feedback:
              type: string

  - id: open_pr
    depends: [review]
    run: git push -u origin HEAD && gh pr create --fill
```

The run has two outer loops, each with its own rewind target:

- At `approve_plan`, a push-back reruns only the planner. A rerun replaces `plan.md` with the new plan.
- At `review`, a push-back reruns `implement` and `tests_pass`, and leaves the approved plan alone.

The planner and the implementer are different agents. Claude Code plans without edit tools, and Codex implements inside its `workspace-write` sandbox.

## Hand Over When the Agent Gives Up

Not every task fits in five attempts. Instead of failing the run, route the work to a person when the inner loop runs out, or when the agent itself says it is stuck:

```yaml
type: graph
working_dir: /srv/repos/app

steps:
  - id: prepare
    run: rm -f "${DAG_RUN_ARTIFACTS_DIR}/blocked.md"

  - id: implement
    depends: [prepare]
    action: harness.run
    with:
      provider: claude
      model: sonnet
      permission_mode: acceptEdits
      allowed_tools: "Bash(make test)"
      add_dir: ${context.paths.artifacts_dir}
      prompt: |
        Implement the change described in TASK.md.
        If ${context.paths.artifacts_dir}/test.log exists, read it first.
        If you cannot finish without a decision from a person, write your
        question to ${context.paths.artifacts_dir}/blocked.md and stop.
    repeat_policy:
      repeat: until
      condition: test -f "${context.paths.artifacts_dir}/blocked.md" || make test > "${context.paths.artifacts_dir}/test.log" 2>&1
      limit: 5

  - id: check
    depends: [implement]
    run: |
      if [ -f "${DAG_RUN_ARTIFACTS_DIR}/blocked.md" ]; then result=blocked
      elif make test > /dev/null 2>&1; then result=pass
      else result=fail
      fi
      echo "result=$result" >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: result

  - id: route
    depends: [check]
    action: router.route
    with:
      value: ${steps.check.outputs.result}
      routes:
        pass: [open_pr]
        fail: [rescue]
        blocked: [rescue]

  - id: rescue
    action: human.task
    with:
      prompt: |
        The agent stopped (${steps.check.outputs.result}).
        Read its question or the last test output, then give it guidance.
        Stop the run to abandon the task.
      artifacts:
        - blocked.md
        - test.log
      push_back:
        rewind_to: prepare
        form:
          type: object
          required: [guidance]
          properties:
            guidance:
              type: string
              title: Guidance for the agent

  - id: open_pr
    run: git push -u origin HEAD && gh pr create --fill
```

- The condition ends the inner loop early when the agent writes `blocked.md`, so a stuck agent does not spend its remaining attempts.
- `check` turns the outcome into a value, and `route` sends `pass` straight on and `fail` or `blocked` to `rescue`.
- A push-back from `rescue` reruns `prepare`, which clears the old question, and then the whole inner loop, with the guidance in the agent's prompt.
- When the work passes, `rescue` is skipped and nobody is asked anything.

Giving the agent a sanctioned way to stop is not only a convenience. When agents have an explicit "needs a person" exit, they cheat on impossible tests far less often ([Zhong et al.](https://arxiv.org/abs/2510.20270)).

## Reach the Reviewer

A run that waits for a person is only as fast as the person finds out:

| Surface | How |
|---|---|
| [Cockpit](/web-ui/cockpit) | The **Review** column lists every run waiting for a person. |
| [Notification rules](/web-ui/notifications) | Include the **Waiting** event. |
| [Wait handler](/writing-workflows/lifecycle-handlers) | `handler_on.wait` runs a step, with the waiting step names in `DAG_WAITING_STEPS`. Post them to chat. |
| [MCP](/mcp/tools#deciding-waiting-steps) | Ask an MCP client what is waiting, then complete or push back from the chat with `dagu_execute`. |
| CLI | [`dagu human-task complete`](/getting-started/cli#human-task-complete) and [`dagu human-task push-back`](/getting-started/cli#human-task-push-back). |

From a script, pass `--expected-iteration` with the iteration that was reviewed. A late or repeated push-back then fails instead of sending back work that has already been redone.

## Things to Know

- Human tasks run only in root DAGs. An inner loop in a child workflow is fine; the task that reviews it belongs to the root.
- A waiting run holds no process and has no timeout. It stays open until someone acts or the run is stopped.
- Completions and push-backs resume the run through the queue, so a scheduler must be running: `dagu scheduler`, or `dagu start-all`.
- The feedback of one push-back is limited to 16 KiB.
- A push-back discards the results of every step it resets, including other human tasks downstream.

## See Also

- [Human Tasks](/writing-workflows/human-tasks): forms, artifacts, completion, and push-back in full.
- [Inner Loops](./inner-loop): the automated loop that runs before the person sees the work.
- [Background Loops](./background-loop): outer loops that a schedule or an event starts.
