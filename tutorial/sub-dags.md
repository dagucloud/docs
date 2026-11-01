# Sub-DAGs and Fan-out

<p class="tutorial-meta">Lesson 7 of 9 · 4 minutes</p>

A step can run another workflow as a sub-DAG. The child is a full run with its own steps, logs, and status. Use sub-DAGs to reuse a workflow, or to run one workflow once per item in a list.

## The workflow

```bash
curl -fsSLO https://docs.dagu.sh/tutorial/dags/tutorial-07-sub-dags.yaml
```

<<< @/public/tutorial/dags/tutorial-07-sub-dags.yaml

The file holds three workflows separated by `---`. The first is the parent. `build-app` and `smoke-test` are children, named with `name`.

- `action: dag.run` runs the child named in `dag`. `params` passes values into it. A child sees only what it receives this way, not the parent's environment.
- `outputs.write` in `build-app` returns `bundle` to the parent, which reads it as `${steps.build.outputs.bundle}`.
- `parallel` runs `smoke-test` once per item, at most 2 at a time. `${ITEM}` is the current item.

## Watch it run

<RunReplay run="tutorial-07-sub-dags" />

Select `smoke_test` to see the three child runs it started, one per region.

## Run it yourself

```bash
dagu start tutorial-07-sub-dags.yaml
```

In the Web UI, the **Activity** list marks `smoke_test` with **3 sub-runs**. Select it to see, on the **Log** tab, a JSON summary of each child run's status and outputs.

A child can also live in its own file. Then `dag` names that file, for example `dag: smoke-test` for `smoke-test.yaml` in the same folder.

## Try it

1. Add `ap-east` to `items`. How many child runs does `smoke_test` start?
2. Change `max_concurrent: 2` to `1`. How long does `smoke_test` take now?

::: details Answers

1. Four, one per item.
2. About 3 seconds instead of 2. The child runs no longer overlap: each starts after the previous one finishes.

:::

<a href="/writing-workflows/sub-dags" class="learn-more">Go deeper: Sub-DAGs →</a>
