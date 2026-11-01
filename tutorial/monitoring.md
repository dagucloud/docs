# Watch Runs in the Web UI

<p class="tutorial-meta">Lesson 2 of 9 · 5 minutes</p>

Every run is recorded: each step's status, timing, and log. This lesson uses a slow workflow so you can follow it live, stop it, and look back at earlier runs.

## The workflow

```bash
curl -fsSLO https://docs.dagu.sh/tutorial/dags/tutorial-02-monitoring.yaml
```

<<< @/public/tutorial/dags/tutorial-02-monitoring.yaml

Each step prints a line every second, so the run takes about eight seconds.

## Watch it run

<RunReplay run="tutorial-02-monitoring" />

Select a step while it runs. Its log fills in as lines arrive.

## Follow a run in the Web UI

1. Open <http://localhost:8080>, select **Workflows**, then `tutorial-02-monitoring`.
2. Select the **Start** button (▶) at the top right, then **Start** in the dialog.

The workflow page has three parts:

![Workflow page with a finished run of tutorial-02-monitoring](/tutorial/workflow-page-light.png)

- **The workflow bar** at the top shows the selected run and its status. Its buttons stop or retry the run and switch to older or newer runs.
- **The canvas** draws the steps as a graph. Each step shows its status in the selected run.
- **Activity** at the bottom charts recent runs and lists the steps of the selected run.

Select a step, on the canvas or in the **Activity** list, to see what it printed on the **Log** tab. The log keeps updating while the step runs.

![Activity panel showing the log of the transform step](/tutorial/step-log-light.png)

## Look back at earlier runs

Run the workflow two or three more times, then open **Activity**:

- **Timeline** shows when each step ran and how long it took.
- **History** shows each step's status across recent runs, one column per run. Select a cell to open that run and step.

![History tab with one column per run](/tutorial/history-light.png)

## Stop a run

Start the workflow again and select the stop button in the workflow bar while `download` is running. The run and `download` end as **Aborted**. The steps after it never start.

## The same from the terminal

```bash
dagu start tutorial-02-monitoring.yaml     # run and print the result
dagu status tutorial-02-monitoring.yaml    # status of the latest run
dagu history tutorial-02-monitoring.yaml   # recent runs
```

To stop a run from a second terminal, run `dagu stop tutorial-02-monitoring.yaml`.

## Try it

1. Start a run in the Web UI, then run `dagu status tutorial-02-monitoring.yaml` in the terminal while it is still going. Do both show the same step running?
2. Find the run you stopped in **History**. Which steps have no color?

::: details Answers

1. Yes. The Web UI and the CLI read the same run records, so a run started in one shows up in the other.
2. `transform` and `publish`. They never started in that run, so their cells show a gray dot.

:::

<a href="/overview/web-ui#workflow-page" class="learn-more">Go deeper: The workflow page →</a>
