# Human Input

<p class="tutorial-meta">Lesson 9 of 10 · 3 minutes</p>

Some steps need a person: a decision, or a review before the run goes on. `action: human.task` pauses the run and asks for it in a form. The run shows **Waiting** until someone completes the task.

## Watch it run

<RunReplay run="tutorial-09-human-input" />

In this recording, the person picked `production`, so `deploy` printed `Deploying 1.4.0 to production`.

## The workflow

Create a workflow named `tutorial-09-human-input` and paste this YAML into it ([how](/tutorial/#_3-add-each-lesson-s-workflow)).

<<< @/public/tutorial/dags/tutorial-09-human-input.yaml

`prompt` is the text the person sees. Human tasks are also how a person reviews work before a run continues: put the review instructions in the prompt.

`form` describes the fields as a JSON schema; here `environment` must be `staging` or `production`. Every form field becomes an output of the task, so `${steps.choose_target.outputs.environment}` reads the answer. `deploy` depends on `choose_target`.

## Run it yourself

1. Select **Start** at the top right, then select **Start** in the dialog. `build` runs, then the run shows **Waiting**.
2. Select **Open actions** on the canvas, or open **Activity** → **Actions**.
3. Pick an environment and select **Complete task**.
4. `deploy` runs and prints the environment you picked.

A waiting run holds no process or worker slot, so it can wait as long as the person needs.

## Try it

1. Start a run and leave it **Waiting**. Stop `dagu start-all` with `Ctrl+C`, start it again, and open the run. What state is it in?
2. Add a boolean form field `notify` with default `true` and print it in `deploy`.

::: details Answers

1. It is still **Waiting**. Complete the task and the run continues.
2. Add `notify` under `properties` and reference it in `deploy`:

```yaml
steps:
  - id: build
    run: echo "Built release 1.4.0"

  - id: choose_target
    action: human.task
    with:
      prompt: Check the build, then choose where release 1.4.0 goes
      form:
        type: object
        properties:
          environment:
            type: string
            enum: [staging, production]
          notify:
            type: boolean
            default: true
        required: [environment]
    depends: build

  - id: deploy
    run: echo "Deploying 1.4.0 to ${steps.choose_target.outputs.environment}, notify=${steps.choose_target.outputs.notify}"
    depends: choose_target
```

:::

<a href="/writing-workflows/human-tasks" class="learn-more">Go deeper: Human tasks →</a>
