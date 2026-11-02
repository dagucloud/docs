# Sub-DAGs and Fan-out

<p class="tutorial-meta">Lesson 7 of 10 · 3 minutes</p>

A step can run another workflow as a sub-DAG. You can use sub-DAGs to reuse existing workflows or fan out one workflow across a list of items.

## Watch it run

<RunReplay run="tutorial-07-sub-dags" />

Select `smoke_test` to see the three child runs it started, one per region.

## The workflow

Create a workflow named `tutorial-07-sub-dags` and paste this YAML into it ([how](/tutorial/#_3-add-each-lesson-s-workflow)).

<<< @/public/tutorial/dags/tutorial-07-sub-dags.yaml

Three dashes `---` separate workflows in one file. The top workflow is the parent, and `smoke-test` below it is the child workflow.

The `build` step captures a filename from standard output into `bundle`. Next, `smoke_test` calls the child workflow with `action: dag.run`. Child workflows run in isolation, receiving only what you pass through `params`.

The `parallel` block runs `smoke-test` once per region, replacing `${ITEM}` with the current item. Setting `max_concurrent: 2` limits the fan-out so at most two child runs run at the same time.

## Run it yourself

Select **Start** at the top right, then select **Start** in the dialog.

In the Web UI, the **Activity** list marks `smoke_test` with **3 sub-runs**. Select it to see, on the **Log** tab, a JSON summary of each child run's status and outputs.

A child workflow can also live in a separate file. When it does, `dag` references the filename without the `.yaml` extension, such as `dag: smoke-test` for `smoke-test.yaml`.

## Try it

1. Add `ap-east` to `items`. How many child runs does `smoke_test` start?
2. Add an `announce` step after `smoke_test` that prints `Released ${steps.build.outputs.bundle} to all regions`.

::: details Answers

1. Four child runs, one for each item.
2. Add the `announce` step with `depends: smoke_test`:

```yaml
# Dagu tutorial, lesson 7: https://docs.dagu.sh/tutorial/sub-dags

steps:
  - id: build
    run: echo "app-1.4.0.tar.gz"
    output:
      bundle:
        from: stdout

  - id: smoke_test
    action: dag.run
    with:
      dag: smoke-test
      params:
        region: ${ITEM}
        bundle: ${steps.build.outputs.bundle}
    parallel:
      items: [us-east, eu-west, ap-south]
      max_concurrent: 2
    depends: build

  - id: announce
    run: echo "Released ${steps.build.outputs.bundle} to all regions"
    depends: smoke_test

---
name: smoke-test
steps:
  - id: check
    run: echo "${params.bundle} is healthy in ${params.region}"
```

:::

<a href="/writing-workflows/sub-dags" class="learn-more">Go deeper: Sub-DAGs →</a>
