# Schedules

<p class="tutorial-meta">Lesson 8 of 9 · 3 minutes</p>

`schedule` runs a workflow on a cron schedule. The scheduler that `dagu start-all` started in the setup checks every schedule and starts the runs.

## The workflow

```bash
curl -fsSLO https://docs.dagu.sh/tutorial/dags/tutorial-08-scheduling.yaml
```

<<< @/public/tutorial/dags/tutorial-08-scheduling.yaml

`* * * * *` is a cron expression for every minute. The five fields are minute, hour, day of month, month, and day of week.

| Schedule | Runs |
| --- | --- |
| `"0 2 * * *"` | Every day at 2:00 |
| `"*/15 * * * *"` | Every 15 minutes |
| `"0 9 * * MON-FRI"` | Weekdays at 9:00 |
| `"@hourly"` | At the start of every hour |
| `"CRON_TZ=Asia/Tokyo 0 9 * * *"` | 9:00 in Tokyo, whatever the server's time zone |

## Watch it run

<RunReplay run="tutorial-08-scheduling" />

## See it run on schedule

1. Open `tutorial-08-scheduling` in the Web UI and select the **Cron** launcher on the canvas. It lists the next three runs.
2. Wait for the next minute to start. A new run appears in **Activity**, started by the scheduler instead of by you.

::: warning Stop the schedule when you are done
This workflow runs every minute while Dagu is up. Delete `tutorial-08-scheduling.yaml`, or remove its `schedule` line, when you finish the lesson.
:::

## Try it

1. Change the schedule to run every 2 minutes.
2. Make it run only at 9:00 and 17:00 on weekdays.

::: details Answers

1. `schedule: "*/2 * * * *"`
2. `schedule: "0 9,17 * * MON-FRI"`. A list of expressions also works:

```yaml
type: graph
schedule:
  - "0 9 * * MON-FRI"
  - "0 17 * * MON-FRI"

steps:
  - id: snapshot
    run: date "+Snapshot taken at %H:%M:%S"
```

:::

<a href="/writing-workflows/scheduling" class="learn-more">Go deeper: Scheduling →</a>
