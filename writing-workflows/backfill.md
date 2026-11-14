# Backfill

A backfill runs a scheduled DAG once for each past slot of its schedule that needs a run, oldest first. Use it to load the history of a new DAG, to run again the days a bug spoiled, or to fill the slots an outage, a pause, or a suspension let pass.

```bash
dagu backfill start etl --from 2026-10-02 --to 2026-11-01
```

Each run gets its slot's scheduled time and [window](/writing-workflows/runtime-variables#schedule-window), as the scheduled run of that slot did, so the DAG needs no date parameters:

```yaml
schedule: "0 2 * * *"
steps:
  - run: ./load.sh --since ${context.run.interval_start} --until ${context.run.interval_end}
```

## Choosing Slots

The range selects fire times. A job that fires at 02:00 and loads the previous day covers October with the fires of October 2 through November 1.

- `--from` and `--to` take a date, a time without an offset, or an RFC 3339 time. A date means the start of that day for `--from` and its end for `--to`. Times without an offset are read in the schedule's zone.
- `--to` defaults to now. A later `--to` is clamped to now; the fires of the current minute are left to the live schedule. A `--from` later than now is refused.
- [Business calendars](/writing-workflows/business-calendars) apply: a weekday schedule has no weekend slots.
- `--slot` names slots instead of a range. Repeat it for slots that are not adjacent. A `--slot` that is not a fire time is refused with the nearest fire times.

Which slots that already ran get a new run depends on `--rerun`:

| `--rerun` | Slots that run |
| --- | --- |
| `none` (default) | Slots with no run |
| `failed` | Also slots whose latest run did not succeed |
| `all` | Every slot |

A slot is never run while it has a queued, running, or waiting run, or while another open backfill of the DAG holds it. Named slots run whatever their history, unless they are active.

What counts as a slot's run:

- A run of the scheduler, catchup, a manual run started for the slot with `--scheduled-at`, or a backfill. A partially succeeded run counts as succeeded.
- A slot the scheduler skipped under `skip_if_successful` counts as succeeded.
- A run cancelled while queued counts as no run. So does a run removed with `dagu rm --history` or deleted in the UI.
- A run that [history retention](/writing-workflows/yaml-specification) removed keeps counting with its final status. Dagu keeps a record of each slot for `slot_retention_days`, 730 by default, so old slots do not run again after their runs are gone.
- After a schedule moves, for example from 02:00 to 01:00, the scheduler's 02:00 run of a day covers that day's 01:00 slot. This holds when both schedules fire on the same days, once a day or once an hour. A manual run counts only for its own slot.

## Selecting by Date

`--by` names a [`dates`](/writing-workflows/schedule-dates) entry, and `--from` and `--to` are then dates of that entry instead of fire times:

```bash
dagu backfill start etl --by target_day --from 2026-10-01 --to 2026-10-31
```

The backfill runs every slot whose entry falls in the range, in the entry's zone, whatever its format; for a list entry, any of its values. On an hourly DAG with `target_day: -1d`, that is the 744 fires that load October. A range that reaches today runs to now.

## The Plan

`dagu backfill start` prints the plan and asks before starting. `--dry-run` prints it and stops; `--format json` prints every slot.

```text
Backfill etl, Asia/Tokyo, --rerun none

Fires       2026-10-02 02:00 to 2026-11-01 02:00
Windows     2026-10-01 02:00 to 2026-11-01 02:00

31 slots: run 28, skip succeeded 2, skip active 1
Concurrency 1 (queue limit 1), on failure stop
Estimate 56m from recent runs

SLOT              WINDOW START      ACTION
2026-10-02 02:00  2026-10-01 02:00  run
2026-10-03 02:00  2026-10-02 02:00  skip: succeeded
2026-10-04 02:00  2026-10-03 02:00  run
...
2026-10-30 02:00  2026-10-29 02:00  run
2026-10-31 02:00  2026-10-30 02:00  skip: active
2026-11-01 02:00  2026-10-31 02:00  run

Start 28 runs? [y/N]
```

- **Concurrency** is the lower of `--max-concurrency` and the limit of the DAG's [queue](/writing-workflows/queues).
- **The estimate** is the median duration of the DAG's recent successful runs, up to 20, times the rounds the runs take at that concurrency. The plan leaves it out when the DAG has no successful run.
- **Dates.** For a DAG with [`dates`](/writing-workflows/schedule-dates), the plan adds a column for the `--by` entry, else the first entry, and a `Loads <first> to <last>` line over the slots it runs, so an off-by-one is visible before the submit. `--format json` and the API return every slot's dates.

The plan warns when no scheduler is running, when the DAG is suspended, when the queue's limit lowers the concurrency, when live runs may wait behind an executing backfill run, which `handler_on` steps will run once per slot, and how many slots run because the schedule's cadence changed. Pass `--yes` to start without asking; with no terminal, the command needs it.

Submitting the same backfill while it is open starts nothing and names the open one. A backfill with nothing to run is not recorded.

## Running

The scheduler runs backfills, so `dagu scheduler` or `dagu start-all` must be running. It queues the next slots through the DAG's [queue](/writing-workflows/queues), oldest first, while fewer than `--max-concurrency` runs of the backfill are queued, running, or waiting. Queues must be enabled.

- **Order.** With `--max-concurrency 1`, the default, a slot is queued after the slot before it finished.
- **Definition.** Every run uses the DAG's definition as it was at submit, with `--params` and `--profile` if given. An edit during the backfill does not change later slots.
- **Params from dates.** Each run evaluates its params' `eval` when it starts, from its own slot's [dates](/writing-workflows/schedule-dates), so a param with `eval: ${dates.target_day}` takes each slot's date. A value given with `--params` replaces that `eval` for every slot, and the plan warns when it does.
- **Slot labels.** For a DAG with [dates](/writing-workflows/schedule-dates), the Slots view groups and labels each slot by the date it loads, so picking October picks the slots that load October. Hovering a slot shows its window, every date, and how its run started. A slot with a run shows the dates that run recorded.
- **Recheck.** At its turn, a slot that gained a run since the submit that `--rerun` would skip is skipped.
- **Failure.** By default the first failed slot stops the backfill: running runs finish, and the slots it did not reach are not run. `--on-failure continue` goes on. The DAG's own retry policy applies to each run first: a failed run with retries left, within `scheduler.retry_failure_window`, keeps its slot active until its retries succeed or run out. A retried backfill run stays a backfill run.
- **Retries.** The backfill follows a retry of its runs, by hand or by the retry policy. A retry of a run of a backfill that ended `succeeded` or `failed` opens it again until the retry ends; the slots a stopped backfill did not reach stay `not run`. A cancelled backfill stays cancelled.
- **Run IDs** are `backfill-<id>-<generation>-<slot>`. A scheduler that restarts finds the runs it queued and queues none of them twice.
- **Pause and suspension.** A paused scheduler queues nothing new and holds the backfill's queued runs until it resumes. A suspended DAG's backfill runs still run.
- **Removal.** A backfill that ended more than `slot_retention_days` ago is removed, with its record and progress, when its DAG next gets a backfill. Its runs follow the run history's own retention.

A backfill run's `context.trigger.type` is `backfill`. To keep an alert handler from running once per slot, give it a precondition:

```yaml
handler_on:
  failure:
    run: ./page-oncall.sh
    preconditions:
      - condition: "${context.trigger.type}"
        expected: backfill
        negate: true
```

## Live Runs Come First

A backfill does not get in the way of the live schedule:

- Backfill runs wait behind every other run of the queue. A live slot that fires during a backfill is queued ahead of the backfill's queued runs, and waits only for the backfill run executing, if the queue's limit is reached.
- A queued or running backfill run does not make the scheduler skip a live slot, and does not count for `skip_if_successful`.
- A DAG's latest run, in the DAG list, `dagu status`, and the scheduler's checks, is its newest run that is not a backfill run. A failed run of an old slot does not turn a healthy DAG red.
- A DAG's run history leaves out backfill runs, so a long backfill does not push the live runs out of the run timeline. The `GET /api/v1/dags/{fileName}/dag-runs` endpoint lists them with `includeBackfill=true`, and the run timeline with **Show backfill runs**. A DAG whose only runs are backfill runs shows them.
- Catchup skips a slot whose latest backfill run is active or succeeded.
- `mail_on`, a step's `mail_on_error`, and notification routes do not fire for backfill runs, except for a run waiting for a person. A backfill run neither opens nor resolves an [incident](/web-ui/incidents).

## Following, Cancelling, and Resuming

```bash
dagu backfill ls [<DAG>]
dagu backfill status <id> [--watch] [--format json]
dagu backfill cancel <id> [--stop-running]
dagu backfill resume <id> [--max-concurrency <n>] [--on-failure stop|continue] [--yes]
```

- `status` shows each slot as `pending`, `queued`, `running`, `waiting`, `succeeded`, `failed`, `skipped`, `not run`, or `cancelled`. An open backfill shows `waiting for scheduler` while no scheduler runs.
- `status` also says why an open backfill makes no progress: `Blocked: the run of slot 2026-10-05 02:00 is waiting for a person`, or where its next run stands in the queue, such as `Waiting: queue at limit, 2 runs ahead`.
- `status` gives about how long an open backfill has left, at the pace of its runs so far: `About 1h 40m left`. It groups the failed slots by the step that failed and its error, largest group first, each with its first slot and run: `Failed: 2 slots at step load: connection refused (first 2026-10-02 02:00, run …)`.
- The backfill's page shows the same: the time left beside its progress, a link to the run that blocks it, and its failures grouped with a link to each group's run.
- `status --watch` prints a line each time the progress changes and exits 0 only when the backfill succeeds, so a script can wait for a backfill and act on its result. With `--format json`, the progress lines go to stderr and stdout holds only the final status.
- `cancel` withdraws the queued runs, so their slots count as missing again, and cancels the slots not reached. Running runs finish unless `--stop-running` stops them.
- `resume` plans again the slots that have not succeeded, with the DAG's current definition, and runs them with new runs. On an open backfill it first withdraws the queued runs; its running runs finish as part of the resumed backfill and count against its concurrency. Use it after fixing the DAG, or to change the concurrency.
- When the DAG's definition changed since the backfill started, the resume plan says so: new runs use the current definition, and runs still active keep theirs. Every run records a digest of the YAML it ran, so `status` marks a slot whose run ran another definition, as `running (older definition)`, and the slot grid on the backfill's page draws such a slot with a dashed border. The API gives it as `otherDefinition` on a slot.

A backfill whose DAG is renamed or deleted ends cancelled, including a rename of the DAG's `name` inside its file.

### Summary Notification

When a backfill ends succeeded or failed, the scheduler sends one summary to the [notification](/web-ui/notifications#backfill-summaries) targets that a run of the DAG with that outcome would notify. Those are the DAG's notification settings, or else its workspace's rules. The backfill's runs send no notifications of their own, except a run that waits for a person. The summary gives:

- the slot counts and the time from submission to the end;
- up to 10 groups of failed slots, by failing step and error, each with a link to its first run;
- a link to the backfill's page.

```text
Backfill 3f9a1c2e of daily-report failed: 28 slots, 25 succeeded, 3 failed, in 1h40m
2 slots at step load: connection refused, first 2026-10-02 02:00 UTC: https://dagu.example.com/dag-runs/daily-report/backfill-3f9a1c2e-0-20261002T020000Z
```

A cancelled backfill sends no summary, and neither do command channels. The DAG's own `mail_on` mail sends none either; to get the summary by email, notify the DAG through an [email channel](/web-ui/notifications#email-delivery).

`dagu status <DAG>` ends with the DAG's latest backfill: its open backfill, or else its newest backfill that ended failed, until the slots it failed succeed.

```text
Latest backfill 3f9a1c2e: running; succeeded 12, failed 1, queued 1, pending 14 (dagu backfill status 3f9a1c2e)
```

## In the Web UI

- **A backfill's page**, `/backfills/<id>`, says where it stands in one sentence, such as `Running: 12 of 28 slots done, 1 failed` or `Stopped: 1 failed, 4 not run`, with the reason when something holds it. A bar and a legend show the slots by state; pick a state to list its slots. The slot grid has a row per day for an hourly schedule, or per month for a daily one; each slot opens its run. **Cancel** asks whether to stop the runs in progress. **Resume** shows the plan for the concurrency and failure behavior you choose before it runs anything. **View runs** lists the backfill's runs.
- **Backfill in the Run button's menu** of a scheduled workflow opens the start panel with its range to pick: the last 7 or 30 days, since the last slot that succeeded, or fire times typed in, read in the schedule's zone. The panel folds its options under **Options**, which also takes the runtime profile.
- **A workflow's Backfills tab**, for a workflow with a schedule, shows its slots and lists its backfills, newest first.
  - **Slots** shows each fire time of the schedule over the last 24 hours, 7, 30, or 90 days, in the state its runs give it: missing, failed, active, or succeeded. At most the newest 2000 are drawn.
  - A user who may run the workflow picks slots: one at a time, with Shift for a run of them, or with **Pick missing** and **Pick missing and failed**. **Backfill N slots** runs the picked slots; with none picked, **Backfill this range** runs the range.
  - The start dialog offers what to run for a range (**Fill gaps**, **Fill gaps and redo failed**, **Redo everything**), with the count each one runs. Running again slots that succeeded needs a confirmation that names how many. It also sets the runs at once and the failure behavior, and, under **Options**, the params, in the same form as the start dialog of one run. Params are sent only once one is changed, since they then apply to every slot; untouched, each run takes its schedule's params, the defaults, and its `eval` results. It shows the plan before anything runs: the slots, the first and last, an estimate, and warnings. **Start N runs** starts that plan. If the slots changed meanwhile, it shows the new plan instead of starting.
  - A user who may not run the workflow sees each slot link to its run.
- **The workflow page** shows a notice for the latest backfill: its progress while it runs, or that it failed until a slot it failed succeeds. A failure notice can be dismissed.
- **The workflow list** marks a workflow with its open backfill and its progress, such as `Backfill 12/28, 1 failed`, or in red with a backfill that ended failed, until the slots it failed succeed. The mark opens the backfill. Dismissing a failed one hides it there and on the workflow page.
- **A backfill run's trigger** links to its backfill.
- **The run list and a queue's page** pick every run, all but backfill runs, or backfill runs only. The run list keeps the choice in its URL (`backfill=exclude` or `only`) and in a saved run view. The API takes the same `backfill` parameter on `GET /api/v1/dag-runs` and `GET /api/v1/queues/{name}/items`.
- **Show backfill runs**, in the run timeline's View menu of a scheduled workflow, adds the backfill runs to the timeline. The browser remembers it.

An open backfill's page updates as its runs change, while the browser tab is visible; an ended one is read once.

## API

| Endpoint | Purpose |
| --- | --- |
| `POST /api/v1/dags/{fileName}/backfills` | Plan and submit. `dryRun: true` returns the plan only, with `concurrency`, `queueLimit`, and `estimateSeconds`. |
| `GET /api/v1/dags/{fileName}/slots?from=&to=` | A DAG's slots in a range with their state |
| `GET /api/v1/backfills` | List backfills, optionally of one `dag` |
| `GET /api/v1/backfills/{id}` | A backfill's status, slot counts, and `waiting`, the reason `status` gives |
| `GET /api/v1/backfills/{id}/slots` | A backfill's slots, paged, filtered by `state` |
| `POST /api/v1/backfills/{id}/cancel` | Cancel, with `stopRunning` |
| `POST /api/v1/backfills/{id}/resume` | Resume, with `maxConcurrency` and `onFailure` |
| `GET /api/v1/dag-runs?backfillId={id}` | A backfill's runs, from its submission on unless `fromDate` or `toDate` is set |

`GET /api/v1/dags/{fileName}` returns the DAG's latest backfill as `latestBackfill`. `GET /api/v1/dags` gives each DAG the backfill it mentions as `backfill`, with its slot count and how many slots are done and failed. Every run carries the `backfillId` of the backfill that started it, which a retry keeps.

A plan returns a `revision`. Send it with the submit to start exactly the plan you saw: if the slots' history changed in between, nothing starts and the response is a 409 with the new plan.

## Limits

- `scheduler.backfill_max_slots`, 10,000 by default, bounds the slots of one backfill.
- A DAG without a schedule cannot be backfilled.
- Runs started before Dagu kept slot records count from their run history; once history retention removed them, their slots plan as missing.
