# Branch and Skip

<p class="tutorial-meta">Lesson 5 of 10 · 3 minutes</p>

A workflow does not have to run every step every time. This workflow picks one branch based on an input parameter and skips steps when preconditions are not met.

## Watch it run

<RunReplay run="tutorial-05-control-flow" />

By default, `deploy_staging` runs, `deploy_prod` and `publish_notes` end as **Skipped**, and the run succeeds.

## The workflow

Create a workflow named `tutorial-05-control-flow` and paste this YAML into it ([how](/tutorial/#_3-add-each-lesson-s-workflow)).

<<< @/public/tutorial/dags/tutorial-05-control-flow.yaml

`router.route` compares `value` with each route and starts the steps listed for matching routes. Here it picks `deploy_staging` or `deploy_prod` from the `environment` parameter. `deploy_staging` and `deploy_prod` have no `depends` because the router starts them. Steps of the other routes end as **Skipped**.

`publish_notes` depends on both deploy steps and has a precondition: it runs only when the `notes` parameter matches `re:.+` (is not empty). A step skipped by a router does not block its dependents.

## Run it yourself

Select **Start** at the top right. The dialog has a field for each parameter. Keep the defaults and select **Start**.

## Try it

1. Start with `environment` set to `prod`. Which deploy step runs?
2. Start with `notes` set to `Fixed the login bug`. What does `publish_notes` print?

::: details Answers

1. `deploy_prod` runs and `deploy_staging` is skipped.
2. `publish_notes` prints `Release notes - Fixed the login bug`.

:::

<a href="/writing-workflows/control-flow" class="learn-more">Go deeper: Control flow →</a>
