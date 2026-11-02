# Approvals and Human Input

<p class="tutorial-meta">Lesson 9 of 10 · 3 minutes</p>

Some steps need human judgment before work continues. The run pauses in the **Waiting** state and resumes when someone responds in the Web UI.

## Watch it run

<RunReplay run="tutorial-09-approvals" />

The run waits twice: first for approval on `build`, then for the form on `choose_target`. In this recording, the reviewer approves the build and picks `production`.

## The workflow

Create a workflow named `tutorial-09-approvals` and paste this YAML into it ([how](/tutorial/#_3-add-each-lesson-s-workflow)).

<<< @/public/tutorial/dags/tutorial-09-approvals.yaml

`approval` on `build` pauses the run after the command succeeds. The run stays paused until someone approves or rejects the step.

`action: human.task` pauses for structured form input. The `form` section uses a JSON schema to define fields. Every submitted field becomes a step output, so `${steps.choose_target.outputs.environment}` reads the chosen value.

## Run it yourself

1. Select **Start** at the top right of the workflow page, then select **Start** in the dialog. `build` finishes and the run status changes to **Waiting**.
2. Select **Open actions** on the canvas, or open **Activity** → **Actions**. Review the log from `build` and select **Approve**.
3. The form for `choose_target` appears. Pick an environment and submit it.
4. `deploy` runs and prints the environment you picked.

A waiting run holds no process or worker slot, so it can wait as long as the review takes.

## Try it

1. Start another run and select the reject icon next to the run chip while it waits. Check the final run status.
2. Add a boolean form field named `notify`, then print it in `deploy`.

::: details Answers

1. The run ends as **Rejected**. Steps that depend on the rejected step do not run.
2. Add `notify` under `properties`, then reference `${steps.choose_target.outputs.notify}`:

```yaml
steps:
  - id: build
    run: echo "Built release 1.4.0"
    approval:
      prompt: Check the build output, then approve the release

  - id: choose_target
    action: human.task
    with:
      prompt: Where should release 1.4.0 go?
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
    run: echo "Deploying to ${steps.choose_target.outputs.environment}, notify=${steps.choose_target.outputs.notify}"
    depends: choose_target
```

:::

<a href="/writing-workflows/human-in-the-loop" class="learn-more">Go deeper: Human-in-the-loop →</a>
