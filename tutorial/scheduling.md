# Schedules

<p class="tutorial-meta">Lesson 8 of 10 · 2 minutes</p>

Add `schedule` to run a workflow on a cron schedule. The scheduler started by `dagu start-all` checks every schedule and starts the runs.

## Watch it run

<RunReplay run="tutorial-08-scheduling" />

`snapshot` prints the time it ran. On the schedule, a new run like this starts every minute.

## The workflow

Create a workflow named `tutorial-08-scheduling` and paste this YAML into it ([how](/tutorial/#_3-add-each-lesson-s-workflow)).

<<< @/public/tutorial/dags/tutorial-08-scheduling.yaml

`* * * * *` is a cron expression for every minute. The five fields are minute, hour, day of month, month, and day of week.

| Schedule | Runs |
| --- | --- |
| `"0 2 * * *"` | Every day at 2:00 |
| `"*/15 * * * *"` | Every 15 minutes |
| `"0 9 * * MON-FRI"` | Weekdays at 9:00 |
| `"@hourly"` | At the start of every hour |
| `"CRON_TZ=Asia/Tokyo 0 9 * * *"` | 9:00 in Tokyo, whatever the server's time zone |

## Run it yourself

1. Select the **Cron** launcher on the canvas to see the next three scheduled runs.
2. Wait for the next minute to start. A new run appears in **Activity**, started by the scheduler.

::: warning Stop the schedule when you are done
This workflow runs every minute while Dagu is up. Remove its `schedule` line and select **Save**, or delete the workflow when you finish the lesson.
:::

## Try it

1. Change the schedule to run every 2 minutes.
2. Make it run only at 9:00 and 17:00 on weekdays.

::: details Answers

1. `schedule: "*/2 * * * *"`
2. `schedule: "0 9,17 * * MON-FRI"`. A list of expressions also works:

```yaml
schedule:
  - "0 9 * * MON-FRI"
  - "0 17 * * MON-FRI"

steps:
  - id: snapshot
    run: echo "Snapshot taken at ${context.attempt.started_at}"
```

:::

<a href="/writing-workflows/scheduling" class="learn-more">Go deeper: Scheduling →</a>
