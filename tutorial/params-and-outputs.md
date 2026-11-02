# Parameters and Outputs

<p class="tutorial-meta">Lesson 3 of 10 · 4 minutes</p>

Parameters pass values into a workflow when it starts. Outputs pass values from one step to the steps that follow.

## Watch it run

<RunReplay run="tutorial-03-params-and-outputs" />

Select `build` to see the `bundle` output it published.

## The workflow

```bash
curl -fsSLO https://docs.dagu.sh/tutorial/dags/tutorial-03-params-and-outputs.yaml
```

<<< @/public/tutorial/dags/tutorial-03-params-and-outputs.yaml

`params` declares the inputs. `environment` accepts only `dev`, `staging`, or `prod`. Both have defaults, so the workflow runs without any arguments. `${params.version}` puts a parameter's value into a command.

Outputs pass data forward. The `build` step captures its printed text as an output named `bundle`. The `deploy` step reads that value with `${steps.build.outputs.bundle}`. A step can only read outputs from steps it depends on.

## Run it yourself

Run the workflow with defaults, then pass your own values after `--`:

```bash
dagu start tutorial-03-params-and-outputs.yaml
dagu start tutorial-03-params-and-outputs.yaml -- environment=staging version=2.1.0
```

`deploy` prints `Deploying app-2.1.0.tar.gz to staging`.

In the Web UI, **Start** opens a dialog with one field per parameter. `environment` shows a list with the three allowed values.

## Try it

1. Run with `-- environment=qa`. What happens?
2. Add a third step, `notify`, that prints `Shipped <bundle>` using the output of `build`.

::: details Answers

1. Dagu rejects the input before any step runs, because `qa` is not one of the allowed values.
2. Add a step to `steps` with `id: notify`, `depends: build`, and `run: echo "Shipped ${steps.build.outputs.bundle}"`.

:::

<a href="/writing-workflows/parameters" class="learn-more">Go deeper: Parameters →</a>
<a href="/writing-workflows/outputs" class="learn-more">Go deeper: Outputs →</a>
