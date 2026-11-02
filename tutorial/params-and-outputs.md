# Parameters and Outputs

<p class="tutorial-meta">Lesson 3 of 10 · 4 minutes</p>

Parameters pass values into a workflow when it starts. Outputs pass values from one step to the steps that follow.

## Watch it run

<RunReplay run="tutorial-03-params-and-outputs" />

Select `build` to see the `bundle` output it published.

## The workflow

Create a workflow named `tutorial-03-params-and-outputs` and paste this YAML into it ([how](/tutorial/#_3-add-each-lesson-s-workflow)).

<<< @/public/tutorial/dags/tutorial-03-params-and-outputs.yaml

`params` declares the inputs. `environment` accepts only `dev`, `staging`, or `prod`. Both have defaults, so the workflow runs without any arguments. `${params.version}` puts a parameter's value into a command.

Outputs pass data forward. The `build` step captures its printed text as an output named `bundle`. The `deploy` step reads that value with `${steps.build.outputs.bundle}`. A step can only read outputs from steps it depends on.

## Run it yourself

Select **Start** at the top right of the workflow page. The start dialog has one field per parameter. `environment` is a list with the three allowed values, so the dialog only offers allowed values.

Select **Start** in the dialog to run with the defaults.

Select **Start** again. Choose `staging` for `environment` and enter `2.1.0` for `version`. Select **Start** in the dialog to run. The `deploy` step prints `Deploying app-2.1.0.tar.gz to staging`.

## Try it

1. Change the default of `version` to `2.0.0` in the YAML, select **Save**, and select **Start** without changing any values in the dialog. What does `deploy` print?
2. Add a third step, `notify`, that prints `Shipped <bundle>` using the output of `build`.

::: details Answers

1. `Deploying app-2.0.0.tar.gz to dev`
2. Add a step to `steps` with `id: notify`, `depends: build`, and `run: echo "Shipped ${steps.build.outputs.bundle}"`.

:::

<a href="/writing-workflows/parameters" class="learn-more">Go deeper: Parameters →</a>
<a href="/writing-workflows/outputs" class="learn-more">Go deeper: Outputs →</a>
