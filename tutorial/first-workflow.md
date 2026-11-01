# Your First Workflow

<p class="tutorial-meta">Lesson 1 of 9 · 4 minutes</p>

A workflow is a YAML file with a list of steps. Each step runs a command, and `depends` says which steps must finish before it starts.

## The workflow

```bash
curl -fsSLO https://docs.dagu.sh/tutorial/dags/tutorial-01-first-workflow.yaml
```

<<< @/public/tutorial/dags/tutorial-01-first-workflow.yaml

- `id` names a step. Other steps refer to it by this name.
- `run` is the shell command the step runs.
- `depends` lists the steps that must succeed first. `lint` and `test` both wait for `checkout`, and `package` waits for both of them.
- `type: graph` is the default. Steps that do not depend on each other run in parallel, so `lint` and `test` start together.

## Watch it run

<RunReplay run="tutorial-01-first-workflow" />

`lint` and `test` start at the same time. `package` starts only after the slower `test` finishes.

## Run it yourself

```bash
dagu start tutorial-01-first-workflow.yaml
```

The command prints each step with its status and output, then the result. To run it from the Web UI instead, open **Workflows**, select `tutorial-01-first-workflow`, and select **Start**.

Before running a workflow you just edited, check it without running anything:

```bash
dagu validate tutorial-01-first-workflow.yaml
```

## Try it

1. Make `test` fail by changing its command to `exit 1`, then run the workflow again. What happens to `package`?
2. Remove `depends: checkout` from `lint`. When does `lint` start now?

::: details Answers

1. The run fails, and `package` ends as **Aborted** without running. A step starts only when every step it depends on has succeeded.
2. Immediately, at the same time as `checkout`. A step without `depends` has nothing to wait for. To run every step in the order written, without `depends`, set `type: chain` instead of `type: graph`.

:::

<a href="/writing-workflows/basics" class="learn-more">Go deeper: Workflow basics →</a>
