# Approvals and Human Input

<p class="tutorial-meta">Lesson 9 of 10 · 3 minutes</p>

Some steps should wait for a person: a review before a release, or a choice only a person can make. The run pauses as **Waiting** and continues when someone responds in the Web UI.

## The workflow

```bash
curl -fsSLO https://docs.dagu.sh/tutorial/dags/tutorial-09-approvals.yaml
```

<<< @/public/tutorial/dags/tutorial-09-approvals.yaml

- `approval` on `build` pauses the run after the step succeeds, until someone approves its output.
- `action: human.task` pauses for a form. `form` describes the fields as a JSON schema. Here, `environment` must be one of two values.
- `${steps.choose_target.outputs.environment}` reads the answer. Every form field becomes an output of the task.

## Watch it run

<RunReplay run="tutorial-09-approvals" />

The run waits twice: for the approval of `build`, then for the form. In this recording, a reviewer approved the build and picked `production`.

## Run it yourself

1. In the Web UI, open `tutorial-09-approvals` and select **Start**. `build` runs, then the run shows **Waiting**.
2. Select **Open actions** on the canvas, or open **Activity** → **Actions**. Review the output of `build` and select **Approve**.
3. The form for `choose_target` appears in the same tab. Pick an environment and submit it.
4. `deploy` runs and prints the environment you picked.

A waiting run holds no process or worker slot, so it can wait for as long as the review takes.

## Try it

1. Start another run and select the reject button in the workflow bar while it waits. How does the run end?
2. Add a second form field, `notify`, of `type: boolean`, and print it in `deploy`.

::: details Answers

1. As **Rejected**. The steps after the rejected one do not run.
2. Add the property to `form`, then read it like any other output:

```yaml
type: graph

steps:
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

  - id: deploy
    run: echo "Deploying to ${steps.choose_target.outputs.environment}, notify=${steps.choose_target.outputs.notify}"
    depends: choose_target
```

:::

<a href="/writing-workflows/human-in-the-loop" class="learn-more">Go deeper: Human-in-the-loop →</a>
