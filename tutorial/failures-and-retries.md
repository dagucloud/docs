# Failures and Retries

<p class="tutorial-meta">Lesson 6 of 10 · 3 minutes</p>

Commands fail when networks drop or services go down. Dagu can retry a flaky step automatically, ignore an optional failure, and run cleanup commands when the run finishes.

## Watch it run

<RunReplay run="tutorial-06-failures-and-retries" />

`call_api` shows **retried 1×** before it succeeds. The `failure` handler stays **Not started** because the run reached **Partially succeeded** instead of failing.

## The workflow

```bash
curl -fsSLO https://docs.dagu.sh/tutorial/dags/tutorial-06-failures-and-retries.yaml
```

<<< @/public/tutorial/dags/tutorial-06-failures-and-retries.yaml

`call_api` simulates a flaky network call. Its `retry_policy` tries again up to two times with a two-second pause between attempts. The step fails on the first try and succeeds on the retry.

Not every failure needs to halt the workflow. Setting `continue_on: failed` on `warm_cache` lets `publish` run even though the cache fails. The run finishes as **Partially succeeded** so you still know something went wrong.

`handler_on` registers commands for the end of the run. The `exit` handler runs after every run, while `failure` runs only when the workflow fails.

## Run it yourself

```bash
dagu start tutorial-06-failures-and-retries.yaml
```

The command exits with an error because the run was only partially successful.

## Retry a failed run

A retry runs a failed run again under the same run ID, with the definition and parameters it started with. Retry once the cause is gone, such as a server that is back up.

1. Change `limit: 2` to `limit: 0` in `call_api` and start the workflow. With retries disabled, `call_api` fails, `publish` is **Aborted**, and the `failure` handler runs.
2. Find the run ID with `dagu history`, then retry it:

```bash
dagu history tutorial-06-failures-and-retries.yaml
dagu retry --run-id=<run-id> tutorial-06-failures-and-retries.yaml
```

In the Web UI, the retry button in the workflow bar does the same. This time `call_api` succeeds, and the run finishes as **Partially succeeded**.

## Try it

1. Remove `continue_on: failed` from `warm_cache` and start the workflow. What happens to `publish` and the handlers?

::: details Answers

`publish` is **Aborted** without running. The run fails, so the `failure` handler runs.

:::

<a href="/writing-workflows/error-handling" class="learn-more">Go deeper: Error handling →</a>
