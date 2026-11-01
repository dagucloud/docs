# Parameters and Outputs

<p class="tutorial-meta">Lesson 3 of 10 · 4 minutes</p>

Parameters are a workflow's inputs, set each time it starts. Outputs carry a value from one step to the steps after it.

## The workflow

```bash
curl -fsSLO https://docs.dagu.sh/tutorial/dags/tutorial-03-params-and-outputs.yaml
```

<<< @/public/tutorial/dags/tutorial-03-params-and-outputs.yaml

- `params` declares two inputs. `environment` accepts only the three listed values. Both have a default, so the workflow also runs with no input.
- `${params.version}` inserts a parameter's value into a command.
- `output` on `build` publishes the step's printed text as an output named `bundle`.
- `${steps.build.outputs.bundle}` reads that output in a later step. The reading step must depend on `build`.

## Watch it run

<RunReplay run="tutorial-03-params-and-outputs" />

Select `build` to see the `bundle` output it published.

## Run it yourself

Run it with the defaults, then with your own values after `--`:

```bash
dagu start tutorial-03-params-and-outputs.yaml
dagu start tutorial-03-params-and-outputs.yaml -- environment=staging version=2.1.0
```

`deploy` prints `Deploying app-2.1.0.tar.gz to staging`.

In the Web UI, **Start** opens a dialog with one field per parameter. `environment` is a list with the three allowed values.

## Try it

1. Run with `environment=qa`. What happens?
2. Add a third step, `notify`, that prints `Shipped <bundle>` using the output of `build`.

::: details Answers

1. Dagu rejects the input before any step runs, because `qa` is not one of the allowed values.
2. Add this step to `steps`:

```yaml
  - id: notify
    run: echo "Shipped ${steps.build.outputs.bundle}"
    depends: build
```

:::

<a href="/writing-workflows/parameters" class="learn-more">Go deeper: Parameters →</a>
<a href="/writing-workflows/outputs" class="learn-more">Go deeper: Outputs →</a>
