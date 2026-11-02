# Watch Runs in the Web UI

<p class="tutorial-meta">Lesson 2 of 10 · 5 minutes</p>

Dagu records the status, timing, and log output of every run. This workflow is slow on purpose, so you can watch it live, stop it, and look back at earlier runs.

## Watch it run

<RunReplay run="tutorial-02-monitoring" />

Step boxes change color as each step finishes.

## The workflow

Create a workflow named `tutorial-02-monitoring` and paste this YAML into it ([how](/tutorial/#_3-add-each-lesson-s-workflow)).

<<< @/public/tutorial/dags/tutorial-02-monitoring.yaml

The `download` and `transform` steps use `action: wait.duration`, a built-in action that pauses the step for a duration. [Lesson 4](/tutorial/actions) covers actions. `download` and `transform` print nothing; `publish` prints one line. A run takes about eight seconds.

## Run it yourself

Select **Start** at the top right of the workflow page, then select **Start** in the dialog.

The workflow page has three parts:

![Workflow page with a finished run of tutorial-02-monitoring](/tutorial/workflow-page-light.png)

**The workflow bar** at the top shows the selected run and its status. Icons next to the run chip stop, retry, or reject the selected run.

**The canvas** draws the steps as a graph with each step's status.

**Activity** at the bottom has the run timeline, the steps of the selected run, and tabs such as **Log**, **Timeline**, and **History**.

Select `publish` on the canvas or in the **Activity** list to read what it printed on the **Log** tab.

![Activity panel showing the log of the publish step](/tutorial/step-log-light.png)

## Look back at earlier runs

Run the workflow two or three more times, then open **Activity**.

**Timeline** shows when each step ran and how long it took. **History** shows each step's status across recent runs, one column per run. Select any cell to open that run and step.

![History tab with one column per run](/tutorial/history-light.png)

## Stop a run

Start the workflow again and select the stop icon in the workflow bar while `download` runs. The run and `download` end as **Aborted**. Later steps never start.

## Try it

1. Open **Timeline** for a finished run. Which step took the longest?
2. Find the run you stopped in **History**. Which steps have no color?

::: details Answers

1. `download`, at about five seconds.
2. `transform` and `publish`. They never started in that run, so their cells show a gray dot.

:::

To get an email when a run fails while you are away, connect the server to Dagu Console in [lesson 10](/tutorial/console-alerts).

<a href="/overview/web-ui#workflow-page" class="learn-more">Go deeper: The workflow page →</a>
