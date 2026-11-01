# Branch, Skip, and Poll

<p class="tutorial-meta">Lesson 5 of 9 · 4 minutes</p>

A workflow does not have to run every step every time. This lesson picks one branch based on an input, skips a step when its condition is false, and repeats a check until it passes.

## The workflow

```bash
curl -fsSLO https://docs.dagu.sh/tutorial/dags/tutorial-05-control-flow.yaml
```

<<< @/public/tutorial/dags/tutorial-05-control-flow.yaml

- **Branch.** `router.route` compares `value` with each route and runs the steps listed for the routes that match. The steps of the other routes are **Skipped**. `deploy_staging` and `deploy_prod` have no `depends`, because the router starts them.
- **Poll.** `repeat_policy` with `repeat: until` runs `wait_until_healthy` again, once a second, until it exits with 0, at most 10 times. The script here passes on the third try.
- **Skip.** `preconditions` runs `publish_notes` only when the `notes` parameter matches the regular expression `.+`, that is, when it is not empty. Otherwise the step is **Skipped** and the run still succeeds.

`wait_until_healthy` depends on both deploy steps. A step skipped by a router does not block its dependents.

## Watch it run

<RunReplay run="tutorial-05-control-flow" />

The router runs `deploy_staging`. `wait_until_healthy` runs three times, and `publish_notes` is skipped because `notes` is empty.

## Run it yourself

```bash
dagu start tutorial-05-control-flow.yaml
```

## Try it

1. Run with `-- environment=prod`. Which deploy step runs?
2. Run with `-- notes="Fixed the login bug"`. What does `publish_notes` print?

::: details Answers

1. `deploy_prod` runs and `deploy_staging` is skipped.
2. `Release notes - Fixed the login bug`. With a non-empty `notes`, the precondition is true and the step runs.

:::

<a href="/writing-workflows/control-flow" class="learn-more">Go deeper: Control flow →</a>
