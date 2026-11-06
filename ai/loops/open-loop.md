---
title: Open Loops
description: Run a coding agent once and use its result as it is. Keep the result reviewable, validate its shape, and gate what ships.
---

# Open Loops

In an open loop, a coding agent runs and its result is used as it is. Nothing the result reveals goes back to the agent. That is the right shape when a person reads the result anyway, when a bad result costs little, or when the next step is cheaper to redo by hand than to explain to an agent.

<picture>
  <source media="(max-width: 640px)" srcset="/loops/loops-open-closed-portrait.svg" width="480" height="760">
  <img src="/loops/loops-open-closed.svg" width="720" height="420" alt="In an open loop, a prompt goes to a coding agent and its result is used as it is: nothing goes back to the agent. In a closed loop, the result goes to a check; a failure goes back to the agent for another attempt, and a pass lets the next step run." style="width: 100%; height: auto; margin: 16px 0 24px;">
</picture>

Open does not mean careless. An open loop still has a schedule, retries, logs, an artifact a person can open, and optionally a gate that stops bad results from moving on. What it lacks is a path for the agent to learn what was wrong.

## A Scheduled Report

A morning digest of yesterday's commits is an open loop: the agent writes it, a person reads it, and nobody sends it back.

```yaml
schedule: "0 7 * * 1-5"
working_dir: /srv/repos/app

steps:
  - id: digest
    action: harness.run
    with:
      provider: codex
      sandbox: read-only
      prompt: |
        Summarize the commits merged in the last 24 hours.
        Use three sections: what changed, risks, follow-ups.
        Reply in Markdown only.
    stdout:
      artifact: digest.md
    timeout_sec: 900
    retry_policy:
      limit: 2
      interval_sec: 60
```

- `sandbox: read-only` is a Codex flag: the agent can read the repository but not change it.
- `stdout.artifact` stores the reply as `digest.md` on the run's **Artifacts** tab, so every morning's digest stays one click away.
- `timeout_sec` bounds the attempt, and `retry_policy` reruns it if the agent process fails, for example on a network error.

Send the digest on with a [notification rule](/web-ui/notifications) or a [mail step](/step-types/mail).

## Validate the Shape

When a later step consumes the result, check its structure with `output_schema`. The step fails unless stdout is exactly one JSON object that matches the schema.

```yaml
type: graph
working_dir: /srv/repos/app

params:
  - name: issue
    type: string
    default: "Checkout returns 500 after the payment step"

steps:
  - id: triage
    action: harness.run
    with:
      provider: claude
      model: sonnet
      prompt: |
        Triage this bug report: ${params.issue}
        Return only one JSON object, with no Markdown fences:
        {"severity": "low|high", "area": "...", "summary": "..."}
    output_schema:
      type: object
      additionalProperties: false
      required: [severity, area, summary]
      properties:
        severity: { type: string, enum: [low, high] }
        area: { type: string }
        summary: { type: string }
    retry_policy:
      limit: 1
      interval_sec: 10

  - id: route
    depends: [triage]
    action: router.route
    with:
      value: ${triage.output.severity}
      routes:
        high: [page_oncall]
        low: [file_ticket]

  - id: page_oncall
    run: ./page.sh '${triage.output.summary}'

  - id: file_ticket
    run: ./ticket.sh '${triage.output.area}' '${triage.output.summary}'
```

`output_schema` is a gate, not a loop. A malformed reply fails the step, and the retry runs the agent again with the same prompt; the agent never learns what was malformed. When that happens often, close the loop: [run a validator in the condition](./closed-loop#any-command-can-close-it) and send its message back.

## Gate What Ships

A [human task](/writing-workflows/human-tasks) without `push_back` is a gate. The person reads the result and completes the task, or stops the run.

```yaml
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

  - id: publish
    depends: [confirm]
    run: ./publish-notes.sh "${DAG_RUN_ARTIFACTS_DIR}/release-notes.md"
```

The run waits at `confirm` without holding a process. The **Actions** tab shows the draft beside the prompt. Completing the task runs `publish`; stopping the run ends it without publishing.

To let the person send the draft back with notes instead, add `with.push_back`. That one field turns the gate into an [outer loop](./outer-loop).

## Retries and Fallbacks Are Not Feedback

Two fields rerun an agent without telling it anything:

| Field | Reruns when | Tells the agent |
|---|---|---|
| `retry_policy` | The attempt fails: the CLI exits non-zero, or its output fails `output_schema` | Nothing |
| `with.fallback` | The provider fails, for example on a rate limit or an outage | Nothing; the next provider gets the same prompt |

Both keep an open loop running through transient failures. Neither makes the result better. A loop is [closed](./closed-loop) only when what a check found reaches the next attempt.

## When to Close the Loop

Close an open loop when:

- People keep fixing the same kind of mistake in the result.
- A command could tell a good result from a bad one: tests, a type checker, a linter, a schema, a benchmark.
- The result feeds something that runs without a person, such as a deploy or a merge.

[Closed Loops](./closed-loop) shows what changes. The next step is an [inner loop](./inner-loop) when a command can decide, and an [outer loop](./outer-loop) when it takes a person.
