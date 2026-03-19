# Durable Execution

Dagu has three automatic retry surfaces:

| Surface | YAML location | Scope | Creates a new DAG attempt | Requires the scheduler |
|---------|---------------|-------|---------------------------|------------------------|
| Step retry | `steps[].retry_policy` | One step inside the current DAG attempt | No | No |
| Step default retry | `defaults.retry_policy` | Every step and `handler_on` step unless overridden | No | No |
| DAG retry | root `retry_policy` | The whole DAG after a failed attempt | Yes | Yes |

Manual retry through `dagu retry`, the Web UI, or the API is separate from the automatic behavior described here.

## Step `retry_policy`

Step retries run inside the current DAG attempt. They rerun the same step. They do not create a new DAG-run ID and they do not create a new DAG attempt.

When a step has `retry_policy`:

- `limit` is the maximum number of retries after the first failure.
- `interval_sec` is the base delay between retries.
- `exit_code` is optional. If omitted, any non-zero exit code is retryable.
- `backoff` is optional.
- `max_interval_sec` is optional.

Field behavior:

| Field | Required when `retry_policy` is present | Notes |
|-------|-----------------------------------------|-------|
| `limit` | Yes | Integer or string. `3` means at most 3 retries, so at most 4 total attempts. |
| `interval_sec` | Yes | Integer or string. Delay is measured in seconds. |
| `exit_code` | No | Retry only when the step exits with one of these codes. |
| `backoff` | No | `true` means `2.0`. A positive number greater than `1.0` is used as the multiplier. `false`, `0`, or omission keeps a fixed interval. |
| `max_interval_sec` | No | Caps the computed delay when greater than `0`. Omission means no cap. |

String values for step `limit` and `interval_sec` are evaluated at runtime and must resolve to integers.

Backoff uses the same delay formula used elsewhere in the runtime:

```text
interval * backoff^attemptCount
```

`attemptCount` starts at `0` for the first retry.

Example:

```yaml
steps:
  - id: fetch
    command: curl -fsS https://api.example.com/data
    retry_policy:
      limit: 5
      interval_sec: 2
      exit_code: [22, 28]
      backoff: true
      max_interval_sec: 30
```

This step can run at most 6 times total:

- initial attempt
- retry 1 after 2s
- retry 2 after 4s
- retry 3 after 8s
- retry 4 after 16s
- retry 5 after 30s because `max_interval_sec` caps the computed 32s delay

If the step still fails after retries are exhausted, normal DAG failure handling continues. `continue_on` is evaluated after execution, not instead of `retry_policy`.

## `defaults.retry_policy`

`defaults.retry_policy` uses the same step-level retry semantics described above. It is copied into each step that does not define its own `retry_policy`. It is also applied to `handler_on` steps.

The merge rule is simple:

- if a step does not define `retry_policy`, it inherits `defaults.retry_policy`
- if a step defines `retry_policy`, the step value replaces the default object completely
- there is no field-level merge inside `retry_policy`

Example:

```yaml
defaults:
  retry_policy:
    limit: 2
    interval_sec: 5
    exit_code: [1, 28]

steps:
  - id: fetch
    command: curl -fsS https://api.example.com/data

  - id: deploy
    command: ./deploy.sh
    retry_policy:
      limit: 5
      interval_sec: 10

  - id: notify
    command: ./notify.sh
    retry_policy:
      limit: 0
      interval_sec: 0

handler_on:
  failure:
    command: ./alert.sh
```

Result:

- `fetch` inherits the default retry policy
- `deploy` uses only its own retry policy
- `notify` does not retry
- `handler_on.failure` inherits the default retry policy

You can also place `defaults.retry_policy` in `base.yaml` to make it the default for every DAG.

## Root `retry_policy`

Root `retry_policy` is different from step retry. It applies after a DAG attempt ends in `Failed`. The scheduler scans recent failed DAG runs and queues another attempt when the retry delay has elapsed.

This retry path creates a new attempt under the same DAG-run ID.

Only scheduler-issued DAG retries consume this retry budget. Manual retry does not increment the DAG auto-retry counter.

Requirements:

- the scheduler must be running
- `scheduler.retry_failure_window` must be greater than `0`
- the failed run must still be the latest attempt for that DAG-run
- the failed run must be a top-level DAG run, not a child/sub-DAG run

Current scheduler behavior:

- the scan runs once when the scheduler starts
- after that it runs every 30 seconds
- an eligible retry may wait up to about 30 extra seconds after its computed retry time before it is queued

Field behavior:

| Field | Required | Notes |
|-------|----------|-------|
| `limit` | Yes | Positive integer or numeric string. This is the maximum number of scheduler-issued DAG retries. |
| `interval_sec` | No | Positive integer or numeric string. Defaults to `60`. |
| `backoff` | No | Same parsing rules as step retry: `true` means `2.0`, numbers greater than `1.0` are allowed, `false`, `0`, or omission keeps a fixed interval. |
| `max_interval_sec` | No | Positive integer. Defaults to `3600`. |

Differences from step retry:

- root `retry_policy` does not support `exit_code`
- numeric strings are parsed when the DAG is loaded, not at runtime
- `${VAR}` and command substitution are not evaluated in root `retry_policy`

The retry delay is measured from the failed attempt timestamps in this order:

1. `finished_at`
2. `created_at`
3. `started_at`

Example:

```yaml
retry_policy:
  limit: 2
  interval_sec: 60
  backoff: true
  max_interval_sec: 900

steps:
  - id: job
    command: ./job.sh
```

This allows at most two scheduler-issued retries for the DAG:

- first DAG retry after 60s
- second DAG retry after 120s

If `max_interval_sec` is reached, later delays are capped.

## Scheduler Window

`scheduler.retry_failure_window` controls how far back the scheduler looks for failed DAG runs to retry.

- default: `24h`
- `0` disables DAG-level retry scanning

The current implementation has one important limitation:

- the retry window is evaluated from the original DAG-run timestamp/day bucket, not from the latest failed attempt timestamp

That means a very old DAG run can age out of the scan window even if its most recent failed attempt is newer.

## Auto-Created `base.yaml`

When Dagu auto-creates `base.yaml` for a first-time installation, the generated file currently enables root DAG retry by default:

```yaml
retry_policy:
  limit: 3
  interval_sec: 5
```

If you keep that generated `base.yaml`, every DAG inherits one scheduler-issued DAG retry.

## Combined Example

```yaml
retry_policy:
  limit: 3
  interval_sec: 5

defaults:
  retry_policy:
    limit: 2
    interval_sec: 5
    exit_code: [1, 28]

steps:
  - id: fetch
    command: curl -fsS https://api.example.com/data

  - id: deploy
    depends: [fetch]
    command: ./deploy.sh
    retry_policy:
      limit: 0
      interval_sec: 0
```

Exact behavior:

- `fetch` can retry twice inside the current DAG attempt
- `deploy` does not retry because it overrides the default with `limit: 0`
- if the DAG still ends in `Failed`, the scheduler can create up to three more DAG attempts, 5 seconds apart
