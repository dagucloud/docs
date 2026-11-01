# Failures and Retries

<p class="tutorial-meta">Lesson 6 of 10 · 4 minutes</p>

Commands fail: a network call times out, a server is down. This lesson retries a flaky step, lets an optional step fail without stopping the run, and runs cleanup at the end.

## The workflow

```bash
curl -fsSLO https://docs.dagu.sh/tutorial/dags/tutorial-06-failures-and-retries.yaml
```

<<< @/public/tutorial/dags/tutorial-06-failures-and-retries.yaml

- `retry_policy` runs a failed step again, here up to 2 more times, 2 seconds apart. `call_api` fails the first time and succeeds on the retry.
- `continue_on: failed` lets the steps after `warm_cache` run even though it fails. The run ends as **Partially succeeded**, so the failure is still recorded.
- `timeout_sec` fails `publish` if it runs longer than 30 seconds.
- `handler_on` runs extra commands when the run ends. `failure` runs only when the run fails. `exit` runs after every run.

## Watch it run

<RunReplay run="tutorial-06-failures-and-retries" />

`call_api` shows **retried 1×**. The failure handler stays **Not started**, because the run did not fail.

## Run it yourself

```bash
dagu start tutorial-06-failures-and-retries.yaml
```

The command exits with an error, because the run is only partially successful.

## Retry a failed run

A retry runs a failed run again under the same run ID, with the definition and parameters it started with. Retry once the cause of the failure is gone, such as a server that is back up.

1. Change `limit: 2` to `limit: 0` in `call_api` and start the workflow. `call_api` fails with no retries left, `publish` ends as **Aborted**, and the `failure` handler runs.
2. Retry the run. In the Web UI, select the retry button in the workflow bar. In the terminal, copy the run ID from `dagu history`:

```bash
dagu history tutorial-06-failures-and-retries.yaml
dagu retry --run-id=<run-id> tutorial-06-failures-and-retries.yaml
```

This time `call_api` succeeds, as the simulated API has recovered, and the run ends as **Partially succeeded**.

## Try it

1. Remove `continue_on: failed` from `warm_cache` and run again. What happens to `publish`?
2. Change `publish` to `run: sleep 5` with `timeout_sec: 1`. What happens?

::: details Answers

1. `publish` ends as **Aborted** without running, the run fails, and the `failure` handler runs.
2. Dagu stops `publish` after one second and marks it **Failed** with a timeout error.

:::

<a href="/writing-workflows/error-handling" class="learn-more">Go deeper: Error handling →</a>
