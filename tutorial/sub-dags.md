# Sub-DAGs and Fan-out

<p class="tutorial-meta">Lesson 7 of 10 · 3 minutes</p>

A step can run another workflow as a sub-DAG. You can use sub-DAGs to reuse existing workflows or fan out one workflow across a list of items.

## The workflow

```bash
curl -fsSLO https://docs.dagu.sh/tutorial/dags/tutorial-07-sub-dags.yaml
```

<<< @/public/tutorial/dags/tutorial-07-sub-dags.yaml

Three dashes `---` separate workflows in one file. The top workflow is the parent, and `smoke-test` below it is the child workflow.

The `build` step captures a filename from standard output into `bundle`. Next, `smoke_test` calls the child workflow with `action: dag.run`. Child workflows run in isolation, receiving only what you pass through `params`.

The `parallel` block runs `smoke-test` once per region, replacing `${ITEM}` with the current item. Setting `max_concurrent: 2` limits the fan-out so at most two child runs execute at the same time.

## Watch it run

<RunReplay run="tutorial-07-sub-dags" />

Select `smoke_test` to see the three child runs it started, one per region.

## Run it yourself

```bash
dagu start tutorial-07-sub-dags.yaml
```

In the Web UI, the **Activity** list marks `smoke_test` with **3 sub-runs**. Select it to view a JSON summary of each child run's status on the **Log** tab.

A child workflow can also live in a separate file. When it does, `dag` references the filename without the `.yaml` extension, such as `dag: smoke-test` for `smoke-test.yaml`.

## Try it

1. Add `ap-east` to `items`. How many child runs does `smoke_test` start?
2. Change `max_concurrent: 2` to `1`. How long does `smoke_test` take now?

::: details Answers

1. Four child runs, one for each item.
2. About 3 seconds instead of 2. Child runs no longer overlap, so each run waits for the previous one to finish.

:::

<a href="/writing-workflows/sub-dags" class="learn-more">Go deeper: Sub-DAGs →</a>
