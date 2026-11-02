# Your First Workflow

<p class="tutorial-meta">Lesson 1 of 10 · 3 minutes</p>

A workflow is a YAML file with a list of steps. Each step runs a shell command, and `depends` sets which steps wait for others.

## Watch it run

<RunReplay run="tutorial-01-first-workflow" />

`lint` and `test` start together after `checkout`, and `package` starts after both.

## The workflow

Create a workflow named `tutorial-01-first-workflow` and paste this YAML into it ([how](/tutorial/#_3-add-each-lesson-s-workflow)).

<<< @/public/tutorial/dags/tutorial-01-first-workflow.yaml

Each step has an `id`, which other steps use to refer to it, and a `run` command.

Steps that do not depend on each other run at the same time. A step with `depends` waits until those steps succeed: `lint` and `test` both wait for `checkout`, then run side by side, and `package` waits for both.

## Run it yourself

Select **Start** at the top right, then **Start** in the dialog. The canvas marks each step as it finishes.

If the YAML has a mistake, the issues button takes the place of **Save** and lists it.

## Try it

Edit in the **YAML** panel, select **Save**, then select **Start**.

1. Make `test` fail by changing its command to `exit 1`, then run the workflow again. What happens to `package`?
2. Remove `depends: checkout` from `lint`. When does `lint` start now?

::: details Answers

1. The run fails, and `package` ends as **Aborted** without running. A step runs only when every step it depends on succeeds.
2. Immediately, at the same time as `checkout`. Steps without `depends` have nothing to wait for. To run every step in order without `depends`, set `type: chain`.

:::

<a href="/writing-workflows/basics" class="learn-more">Go deeper: Workflow basics →</a>
