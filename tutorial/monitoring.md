# Watch Runs in the Web UI

<p class="tutorial-meta">Lesson 2 of 10 · 5 minutes</p>

Dagu records the status, timing, and log output of every run. This workflow is slow on purpose, so you can watch it live, stop it, and look back at earlier runs.

## Watch it run

<RunReplay run="tutorial-02-monitoring" />

Select a step while it runs to see its log stream line by line. Step boxes change color as each step finishes.

## The workflow

```bash
curl -fsSLO https://docs.dagu.sh/tutorial/dags/tutorial-02-monitoring.yaml
```

<<< @/public/tutorial/dags/tutorial-02-monitoring.yaml

Each step prints a line every second, so a run takes about eight seconds. That is long enough to follow it in the browser.

## Follow a run in the Web UI

1. Open <http://localhost:8080>, select **Workflows**, then `tutorial-02-monitoring`.
2. Select the **Start** button (▶) at the top right, then **Start** in the dialog.

The workflow page has three parts:

![Workflow page with a finished run of tutorial-02-monitoring](/tutorial/workflow-page-light.png)

**The workflow bar** at the top shows the selected run and its status. Use it to stop or retry the run, or switch to an earlier one.

**The canvas** draws the steps as a graph, colored by status.

**Activity** at the bottom charts recent runs and lists the steps of the selected run.

Select any step on the canvas or in the **Activity** list to read its output on the **Log** tab. The log updates while the step runs.

![Activity panel showing the log of the transform step](/tutorial/step-log-light.png)

## Look back at earlier runs

Run the workflow two or three more times, then open **Activity**.

**Timeline** shows when each step ran and how long it took. **History** shows each step's status across recent runs, one column per run. Select any cell to open that run and step.

![History tab with one column per run](/tutorial/history-light.png)

## Stop a run

Start the workflow again and select the stop button in the workflow bar while `download` is running. The step and the run end as **Aborted**. Downstream steps never start.

## The same from the terminal

```bash
dagu start tutorial-02-monitoring.yaml     # run and print the result
dagu status tutorial-02-monitoring.yaml    # status of the latest run
dagu history tutorial-02-monitoring.yaml   # recent runs
```

To stop a run from a second terminal, run `dagu stop tutorial-02-monitoring.yaml`.

## Try it

1. Start a run in the Web UI, then run `dagu status tutorial-02-monitoring.yaml` in the terminal while it is still running. Do both show the same step running?
2. Find the run you stopped in **History**. Which steps have no color?

::: details Answers

1. Yes. The Web UI and the CLI read the same run records, so a run started in one shows up in the other.
2. `transform` and `publish`. They never started in that run, so their cells show a gray dot.

:::

To get an email when a run fails while you are away, connect the server to Dagu Console in [lesson 10](/tutorial/console-alerts).

<a href="/overview/web-ui#workflow-page" class="learn-more">Go deeper: The workflow page →</a>
