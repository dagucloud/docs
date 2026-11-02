# Failures and Retries

<p class="tutorial-meta">Lesson 6 of 10 · 3 minutes</p>

Commands fail when networks drop or services go down. Dagu can retry a flaky step automatically, ignore an optional failure, and run cleanup commands when the run finishes.

## Watch it run

<RunReplay run="tutorial-06-failures-and-retries" />

`warm_cache` retries twice and fails each time. Because `continue_on: failed` is set, `publish` runs anyway, and the run ends as **Partially succeeded**. The `failure` handler stays **Not started** because the run did not fail.

## The workflow

Create a workflow named `tutorial-06-failures-and-retries` and paste this YAML into it ([how](/tutorial/#_3-add-each-lesson-s-workflow)).

<<< @/public/tutorial/dags/tutorial-06-failures-and-retries.yaml

`warm_cache` uses `http.request` against `http://localhost:9`, where no cache server listens. Its `retry_policy` retries up to 2 more times, 1 second apart, and fails each time.

Setting `continue_on: failed` on `warm_cache` lets `publish` run even though the cache fails. The run ends as **Partially succeeded** so the failure is still recorded.

`handler_on` registers steps for the end of the run. The `exit` handler runs after every run, while `failure` runs only when the run fails.

## Run it yourself

Select **Start** at the top right of the workflow page, then select **Start** in the dialog.

`warm_cache` fails after two retries, `publish` succeeds, and the `exit` handler runs. The workflow finishes as **Partially succeeded**.

## Retry a failed run

A retry runs a failed run again under the same run ID, with the definition and parameters it started with. Retry once the cause is gone, such as a server that is back up.

In the Web UI, select the retry icon next to the run chip in the workflow bar.

## Try it

1. Remove `continue_on: failed` from `warm_cache`, select **Save**, and start the workflow. What happens to `publish` and the handlers?
2. Change `limit: 2` to `limit: 0` in `warm_cache`. How many times does `warm_cache` run?

::: details Answers

1. `publish` ends as **Aborted** without running. The run fails, so the `failure` handler runs, and `exit` runs as always.
2. Once. With no retries left, it fails on the first attempt.

:::

<a href="/writing-workflows/error-handling" class="learn-more">Go deeper: Error handling →</a>
