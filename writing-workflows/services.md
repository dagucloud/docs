# Services

A service is a DAG that Dagu keeps running. Set `restart_policy`, and the scheduler starts the first run, then a new run after each one ends, instead of following a cron schedule.

```yaml
restart_policy: always
restart_wait_sec: 5
hist_retention_runs: 100
steps:
  - run: python3 worker.py
```

The scheduler must be running (`dagu start-all` or `dagu scheduler`), and queues must be enabled, because the runs of a service go through its queue. While queues are disabled, a service gets no run and the scheduler logs an error.

## Restart Policies

| Value | Meaning |
|-------|---------|
| `no` | The DAG is not kept running. This is the default. |
| `always` | A new run follows each run, whatever its status. |
| `unless-stopped` | Same as `always`, except that no run follows a run that an operator stopped. |

Values are case-insensitive. A DAG with `always` or `unless-stopped` is a service.

## When Runs Start

- **First run:** the scheduler queues it as soon as it finds a service with no run.
- **Later runs:** `restart_wait_sec` after the previous run ended, plus a few seconds for the scheduler to queue the run and start it.
- **After a scheduler restart or failover:** the new scheduler works out what is due from the stored runs, so it continues where the previous one stopped without starting a second run.

The runs have the trigger type `restart`, which steps can read as `${context.trigger.type}`.

Changes to the DAG file take effect without a restart of the scheduler:

| Change | Effect |
|--------|--------|
| Edit `restart_wait_sec` | Applies from the next check, which comes at once. |
| Remove `restart_policy`, or delete the file | No new run. The active run keeps going. |
| Rename the file | The renamed DAG starts at once, next to the old run, which keeps going. |

### Backoff

A service that keeps failing does not restart every few seconds. Each run in a row that does not succeed within 10 seconds of its start doubles the wait, up to 5 minutes. With `restart_wait_sec: 5`, the waits are 5, 10, 20, 40 seconds, and so on.

A run that succeeds, or that lasts longer than 10 seconds, resets the wait. A `restart_wait_sec` above 5 minutes is never doubled. The count is kept in memory, so a scheduler that takes over starts it again.

## Stopping a Service

| Action | `always` | `unless-stopped` |
|--------|----------|------------------|
| `dagu stop`, or Stop in the Web UI or API | A new run follows after the wait. | Stays stopped until a run is started by hand. |
| `dagu dequeue` of a queued restart | A new run follows after the wait. | Stays stopped until a run is started by hand. |
| Suspend the DAG | The active run keeps going. No new run until it is resumed. | Same. |
| [Pause the scheduler](/writing-workflows/scheduling#pausing-the-scheduler) | The active run keeps going. No new run until it is resumed. | Same. |

To stop a service for good with `always`, suspend it first and then stop the active run. On resume, a new run starts once the wait has passed since the latest run ended.

With `unless-stopped`, only an operator's request counts as a stop. These do not, and the DAG restarts after the wait:

- a run that failed, or whose process was killed
- an unmet DAG-level precondition
- a scheduler shutdown that aborts its runs
- a queued restart dropped because the DAG was suspended

## One Run at a Time

A second copy of a service usually means a port conflict or work that is done twice, so a service has one run at a time. While its latest run is running, queued, or waiting for a person, every way to start a run by hand fails without starting one:

| Surface | Refused | Result |
|---------|---------|--------|
| CLI | `dagu start` (also with `--only` and `--from-run-id`), `dagu enqueue`, `dagu retry` | Non-zero exit |
| API and Web UI | Start, synchronous start, enqueue, runs from an inline spec, retry, reschedule, edited retry | `409` with the code `conflict` |
| MCP | `start`, `enqueue`, `retry` in `dagu_execute` | `conflict` |
| Webhooks | Trigger | `409` with the code `conflict` |

```text
Error: a DAG with a restart_policy has one run at a time: run 019a... of DAG worker is running
```

A run that has not started yet, because it waits for a worker, counts as active for 5 minutes.

With no active run, these all work. That is how a stopped `unless-stopped` service comes back. The scheduler treats a run started by hand like any other, so a new run follows it when it ends.

`dagu restart` is always refused for a service: the scheduler starts its runs. Stop the active run instead.

Some details:

- The current definition decides whether a DAG is a service. A retry of a run from before `restart_policy` was added is refused too, and so is a spec in a request that leaves it out but has the name of a service.
- A run started under another name with `--name` is a run of another DAG, and is not refused.
- If a manual start and a restart race on one host, the second to start fails. A queued run that loses this way ends as `failed`, and the DAG restarts after the run that won.
- Starts on two different workers can still race, and both runs then keep going. Runs that began before `restart_policy` was added can overlap the same way. No new run starts until all of them have ended, and the new run follows the one that ended last.

## Requirements

A service DAG:

- must set `restart_wait_sec` to at least `1`, in its file or through the base configuration
- must not define a `schedule` in its file, in any form. An empty `schedule` defines none.
- must not define a DAG-level `retry_policy` in its file

`restart_policy` itself cannot be set in a [base configuration](/server-admin/base-config), since it would turn every DAG into a service. A `schedule` or a DAG-level `retry_policy` that a service would inherit from the base configuration is ignored.

Everything else works as usual, including `queue`, `timeout_sec`, `max_clean_up_time_sec`, `handler_on`, `preconditions`, `worker_selector`, and step-level `retry_policy` and `repeat_policy`.

## History

Each restart adds a run to the history, so a period of days does not bound it. A service keeps its latest 100 runs unless you say otherwise:

| Setting | Effect on a service |
|---------|---------------------|
| `hist_retention_runs`, in its file or the base configuration | Applies |
| `hist_retention_days`, in its file | Applies |
| `hist_retention_days`, in the base configuration | Ignored |

## Failures

- **The run process dies:** the DAG restarts once [zombie detection](/writing-workflows/scheduling#zombie-detection) marks the run failed, within 135 seconds with the default settings. A process killed while it writes its status can hold the DAG's run lock until the lock goes stale, which can add to this.
- **A worker is lost:** in [distributed execution](/server-admin/distributed/), the run is marked failed when its lease goes stale, and the new run can go to another worker.
- **A run never starts:** a run left queued or not started by a crash is marked failed after 5 minutes if no process, worker, queue item, or pending dispatch will still start it. The DAG then restarts after it.
- **A crash while a run is created:** a restart whose attempt has no complete status yet is replaced by the next check.

While the scheduler is down, nothing fails such a left-behind run, and a queued one still refuses manual starts. Remove it with `dagu dequeue <queue-name> --dag-run=<dag-name>:<run-id>`.

## Costs to Plan For

- A service run holds a queue and worker slot for as long as it lives, so size the queue's concurrency for it.
- `handler_on` and notifications fire for every run. A service that keeps failing sends one for each attempt, spaced by the backoff.

## In the Web UI

The DAG list and the DAG's details show the policy and the wait. A service shows **Enabled**, **Stopped** after an operator stopped an `unless-stopped` service, or **Suspended** where a scheduled DAG shows **Live**, and the switch suspends and resumes it. The active filter of the DAG list includes services that are not suspended.

A service restarts without end, so its runs do not fill the run lists. The Overview, the Cockpit, and the Executions page leave them out and show a card for each service: its state, how long it has been up or when it restarts, and why it keeps failing. On the Executions page a card opens the latest runs of its service, and a search by name, run ID, status, or labels lists them with the other runs.

A service that keeps failing, or whose run waits for approval, is listed under **Needs attention** on the Overview. A run that waits for approval also stays in the review column of the Cockpit. The Queues page lists the queue of each service that does not set `queue` apart from the other queues.

## In the API

`GET /api/v1/service-dags` lists these DAGs with their state, the error of a failed latest run, how many runs in a row failed, and when the next run is due or why none comes. `excludeServiceDAGRuns=true` keeps every run of these DAGs out of `GET /api/v1/dag-runs`, including runs started by hand. See the [API reference](/web-ui/api#list-service-dags).

## A Health Probe

A service can also be one long run that repeats a check, with a restart as the fallback when the check fails:

```yaml
restart_policy: always
restart_wait_sec: 15
hist_retention_runs: 100
steps:
  - run: ./check.sh
    repeat_policy:
      repeat: while
      exit_code: [0]
      interval_sec: 10
handler_on:
  failure:
    run: ./alert.sh
```

## Related Features

| Feature | Use it to |
|---------|-----------|
| [`schedule.restart`](/writing-workflows/scheduling#restart-schedule) | Restart a running DAG at set times |
| [DAG `retry_policy`](/writing-workflows/durable-execution) | Retry a failed run a limited number of times |
| [Step `repeat_policy`](/writing-workflows/control-flow) | Repeat a step inside one run |
| [`container.restart_policy`](/writing-workflows/container) | Set the Docker restart policy of a container |
