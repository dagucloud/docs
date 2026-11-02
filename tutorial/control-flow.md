# Branch and Poll

<p class="tutorial-meta">Lesson 5 of 10 · 3 minutes</p>

A workflow does not have to run every step every time. This workflow picks one branch based on an input parameter and repeats a check until it passes.

## The workflow

```bash
curl -fsSLO https://docs.dagu.sh/tutorial/dags/tutorial-05-control-flow.yaml
```

<<< @/public/tutorial/dags/tutorial-05-control-flow.yaml

`router.route` compares `value` with each route and starts the steps listed for matching routes. The steps of the other routes end as **Skipped**. `deploy_staging` and `deploy_prod` have no `depends` field because the router starts them directly.

`repeat_policy` with `repeat: until` runs `wait_until_healthy` again every second until the command exits 0, up to 10 times. The script counts its attempts in a file and passes on the third one.

`wait_until_healthy` depends on both deploy steps. A step skipped by a router does not block its dependents, so `wait_until_healthy` starts as soon as `deploy_staging` finishes.

## Watch it run

<RunReplay run="tutorial-05-control-flow" />

The router runs `deploy_staging` and skips `deploy_prod`. Then `wait_until_healthy` polls three times before succeeding.

## Run it yourself

```bash
dagu start tutorial-05-control-flow.yaml
```

## Try it

1. Run with `-- environment=prod`. Which deploy step runs?
2. Change `-ge 3` to `-ge 5`. How many times does `wait_until_healthy` run?

::: details Answers

1. `deploy_prod` runs and `deploy_staging` is skipped.
2. Five times. It repeats once a second until the check passes.

:::

<a href="/writing-workflows/control-flow" class="learn-more">Go deeper: Control flow →</a>
