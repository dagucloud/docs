# Human Tasks

A human task is a step that pauses a run until a person completes it. It runs no command. The person acknowledges a prompt or fills in a typed form, and the submitted values become step outputs for later steps.

Use human tasks for release parameters, incident decisions, maintenance confirmations, data corrections, and reviews of results that earlier steps produced. To review the output of a command right after it runs, or to be able to reject the run, use an [approval gate](/writing-workflows/approval) instead. [Human-in-the-Loop](/writing-workflows/human-in-the-loop) compares the two and describes the waiting and resume behavior they share.

## Quick Start

```yaml
steps:
  - id: review
    action: human.task
    with:
      prompt: Choose the deployment target
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
    run: ./deploy.sh '${steps.review.outputs.environment}'
```

When the run reaches `review`, the step and the run enter `Waiting`. Open the run from **Cockpit**, select **Open actions**, fill in the form on the **Actions** tab, and select **Complete task**. The run is queued, resumes, and `deploy` runs with the selected environment.

`deploy` needs no `depends` entry: referencing an output of `review` makes it depend on `review`.

## Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Step ID used by the CLI, the REST API, and output references. |
| `action` | Yes | `human.task` |
| `with.prompt` | Yes | Instructions shown to the person. See [Prompt](#prompt). |
| `with.form` | No | Typed input form. Omit it when the person only acknowledges the prompt. See [Form](#form). |
| `with.artifacts` | No | Artifact paths shown as review context. See [Artifacts](#artifacts). |
| `with.push_back` | No | Lets the person send the work back to an upstream step. See [Requesting Changes](#requesting-changes). |

The step ID must start with a letter, contain only letters, numbers, and underscores, and be at most 40 characters. `name` does not replace `id`.

A human task can also use `name`, `description`, `depends`, `working_dir`, `env`, `preconditions`, and `continue_on`. Preconditions are checked before the task opens. When they are not met, the step is skipped and never waits.

## Prompt

`with.prompt` must not be empty. It is resolved when the task opens, so it can include parameters, environment values, context values, and outputs of completed dependencies:

```yaml
params:
  - name: environment
    default: production

steps:
  - id: prepare
    run: printf 'version=v1.4.0\n' >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: version

  - id: confirm
    action: human.task
    depends: [prepare]
    with:
      prompt: Deploy ${steps.prepare.outputs.version} to ${params.environment}?
```

The resolved prompt is stored with the run. The Web UI, the REST API, and `dagu status` show the text the person saw, even if the YAML file changes later.

## Artifacts

`with.artifacts` lists files from the run's artifact directory to show beside the prompt. The Web UI renders a preview of each one.

```yaml
steps:
  - id: test
    run: ./run-tests.sh
    stdout:
      artifact: reports/test-report.html

  - id: review
    action: human.task
    depends: [test]
    with:
      prompt: The test report is attached. Approve the release?
      artifacts:
        - reports/test-report.html
```

Paths are resolved when the task opens, from the same values as the prompt, so an entry can name a file that a dependency produced:

```yaml
params:
  - name: environment
    default: production

steps:
  - id: review
    action: human.task
    with:
      prompt: Review the deployment plan
      artifacts:
        - "plans/${params.environment}.md"
```

Rules:

- Each path must be relative to the artifact directory. Absolute paths, `~`, and `..` segments are rejected.
- The resolved path is checked again, so a parameter cannot inject `..` or an absolute path. An unsafe resolved path fails the step without opening the task.
- Entries that resolve to the same path are shown once.
- Listing a path does not create the file. Another step has to write it, through `stdout.artifact` or an [`artifact.*` action](/writing-workflows/artifacts).
- A missing artifact does not block completion.

## Form

`with.form` is a flat JSON Schema object with root `type: object`. The Web UI renders it as a form, and the CLI and REST API validate input against it.

```yaml
steps:
  - id: release_details
    action: human.task
    with:
      prompt: Enter release details
      form:
        type: object
        title: Release details
        description: Values used by the deployment step
        properties:
          environment:
            type: string
            title: Environment
            oneOf:
              - const: staging
                title: Staging
              - const: production
                title: Production
          replicas:
            type: integer
            minimum: 1
            maximum: 20
            default: 3
          change_ticket:
            type: string
            minLength: 3
            pattern: '^CHG-[0-9]+$'
          notify:
            type: boolean
            default: true
        required: [environment, change_ticket]
```

Root fields:

| Field | Description |
|-------|-------------|
| `type` | Must be `object`. |
| `title`, `description` | Display text for the form. |
| `properties` | Fields of the form. Each property name starts with a letter and contains only letters, numbers, and underscores. |
| `required` | Property names that must have a value. Defaults are applied before this check. |
| `additionalProperties` | Whether input keys not listed in `properties` are accepted. Defaults to `false`. |

Each property has a `type` of `string`, `integer`, `number`, or `boolean`, and can use these keywords:

| Keyword | Applies to | Description |
|---------|------------|-------------|
| `title`, `description` | All types | Display text. |
| `default` | All types | Value used when the property is omitted. |
| `enum` | All types | Allowed values. |
| `oneOf` | All types | Labeled choices. Each option needs `const` and can set `title` and `description`. |
| `minimum`, `maximum` | `integer`, `number` | Numeric bounds. |
| `minLength`, `maxLength`, `pattern` | `string` | Length and regular-expression constraints. |

Nested objects and arrays are not supported. The form is stored with the run when the task opens, so editing the YAML file does not change a task that is already waiting.

## Generated Step Outputs

Every property declared in the form is an output of the step. Do not add an `outputs` field to a human task.

```yaml
steps:
  - id: review
    action: human.task
    with:
      prompt: Approve the deployment
      form:
        type: object
        properties:
          environment:
            type: string
          notify:
            type: boolean
            default: true
          notes:
            type: string
        required: [environment]

  - id: deploy
    env:
      - DEPLOY_ENV: ${steps.review.outputs.environment}
      - SEND_NOTICE: ${steps.review.outputs.notify}
    run: ./deploy.sh
```

- A value is published when it is submitted or comes from a `default`. An optional property with no value and no default publishes nothing, as `notes` does here when left empty.
- `string` properties publish their text. `integer`, `number`, and `boolean` properties publish JSON text, such as `3` or `true`.
- Keys accepted through `additionalProperties: true` are stored with the input but are not outputs.
- The submitted input and the outputs must fit within the DAG's `max_output_size`.

## Completing a Task

Input is validated against the form stored with the run. A valid completion marks the step `Succeeded` and publishes its outputs in one change. Completing requires permission to run DAGs in the task's workspace.

### Web UI

1. Open the waiting run from **Cockpit** or the workflow's run history.
2. Select **Open actions** on the canvas notice, or the **Actions** tab of the Activity panel.
3. Fill in the form and select **Complete task**.

While the run is queued or running, open tasks are visible but read-only. Input already typed into the form is kept until the run waits again.

### CLI

```bash
dagu human-task complete \
  --run-id <run-id> \
  --step review \
  --input environment=production \
  --input notify=true \
  <root-dag-name>
```

`--input` values are converted to the property types in the form, so `notify=true` becomes a boolean. Use `--inputs-json '{"environment":"production","notify":true}'` to pass one typed JSON object instead. Omit both for an acknowledgement-only task.

The command works on the local Dagu instance only, but the run itself may have executed on a distributed worker. See the [CLI reference](/getting-started/cli#human-task-complete) for all flags.

### REST API

The request body is the form values as one JSON object:

```bash
curl -X POST \
  "http://localhost:8080/api/v1/dag-runs/release-workflow/<run-id>/human-tasks/review/complete" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"environment":"production","notify":true}'
```

Send `{}` for an acknowledgement-only task. See [Human Task Endpoints](/web-ui/api#human-task-endpoints) for responses and errors.

### MCP

Read the run with `dagu_read` `target=run`, then call [`dagu_execute`](/mcp/tools#deciding-waiting-steps) with `action=approve`, the task's step name as `stepName`, its form values as `inputs`, and the run's `attemptId`. `action=push_back` sends feedback the same way. A call for a task that is no longer waiting fails with `conflict`, even with the same input.

### Repeated and Conflicting Completions

- Repeating a completion with the same input succeeds and changes nothing.
- Completing an already completed task with different input fails with a conflict.
- The completion records who completed the task: the authenticated user for the Web UI, REST API, and MCP, or the OS username and an `os:<uid>` ID for the CLI.

Human tasks have no reject operation. Stop the run if it should not continue, or [push the work back](#requesting-changes).

## Resuming the Run

A completion queues the same DAG run when it lets another step run, or when no other manual step is waiting. Otherwise the input is stored and the run stays `Waiting`. The completion request never starts the run itself. The scheduler picks up the queued run, so keep it running.

Each resumed attempt runs from the stored checkpoint with the DAG definition, prompts, and artifact paths stored with the run. See [Resuming](/writing-workflows/human-in-the-loop#resuming) for the rules shared with approval gates.

While a resumed attempt is queued or running, other open tasks cannot be completed: the CLI and REST API return a conflict, and the Web UI shows them read-only. They become actionable again when the run returns to `Waiting`. If the resumed attempt fails or is aborted before that, retry the DAG run to open them again. Completed input is kept.

### Recovering a Failed Queue

Input is stored before the run is queued. If queueing fails, the REST API returns `503` and the run stays `Waiting` with its resume pending. Recover without entering the values again:

- In the Web UI, select **Retry queue**.
- Call the [resume endpoint](/web-ui/api#retry-human-task-resume-queue).
- Repeat the identical CLI command. Dagu recognizes the stored input and only retries the queue.

Retrying the DAG run or the human-task step cannot skip a task that is still waiting.

## Requesting Changes

Add `with.push_back` to let the person send the work back instead of completing the task. A push-back reruns an upstream step and every step that depends on it with the person's feedback, then opens the task again.

```yaml
steps:
  - id: implement
    action: harness.run
    with:
      provider: codex
      prompt: Implement the requested change

  - id: test
    depends: [implement]
    run: make test

  - id: review
    depends: [test]
    action: human.task
    with:
      prompt: Review the implementation
      push_back:
        rewind_to: implement
        form:
          type: object
          required: [feedback]
          properties:
            feedback:
              type: string
              title: What should change?

  - id: publish
    depends: [review]
    run: ./publish.sh
```

| Field | Required | Description |
|-------|----------|-------------|
| `rewind_to` | Yes | ID or name of the step that runs again first. The task must depend on it, directly or transitively. |
| `form` | No | Feedback form with the same rules as `with.form`, except that `additionalProperties` must stay `false`. Omit it to send work back without feedback. |

In the Web UI, select **Request changes**, fill in the feedback form, and submit it. From the CLI:

```bash
dagu human-task push-back \
  --run-id <run-id> \
  --step review \
  --input feedback="Add coverage for the empty input case" \
  --expected-iteration 0 \
  <root-dag-name>
```

A push-back:

1. Validates the feedback against `push_back.form`.
2. Resets `rewind_to` and every step that depends on it, including the task, to `Not Started`. Their previous results are discarded, including completed human-task input and approval decisions. In a `type: build` DAG, a step that consumes a declared output path of a reset step counts as depending on it.
3. Records the iteration, the feedback, and the push-back history on every reset step.
4. Queues the run. If another manual step is still waiting, the run is queued only when the rewind target can run, declares no build `inputs`, and no step is failed, aborted, rejected, or retrying. Otherwise the push-back is stored and the run is queued once no manual step is waiting.

The rerun steps receive the [push-back context](/writing-workflows/human-in-the-loop#push-back-context). In this example, `implement` reruns with the feedback added to its prompt, `test` runs again, and `review` opens with the new results. Each feedback property is also an environment variable on every rerun step, including an approval step whose `approval.input` does not list it. Values are strings: `integer`, `number`, and `boolean` properties are passed as JSON text.

When the task opens again, its prompt and artifact paths are resolved again so they show the new results. The Web UI shows the iteration and earlier push-backs on the task, and `dagu status` prints the iteration.

### Iteration Check

Pass the iteration you reviewed with `--expected-iteration`, such as `0` for the first review, so a repeated or late push-back cannot send back a task that already reopened. A mismatch fails with a conflict and changes nothing. The Web UI sends the iteration automatically.

### Recovering a Failed Push-back Queue

The push-back is stored before the run is queued. If queueing fails, the run stays `Waiting` with its resume pending. Select **Retry queue** in the Web UI, call the [resume endpoint](/web-ui/api#retry-human-task-resume-queue), or repeat the identical push-back. Until the task opens again, an identical repeat only retries the queue, and a push-back with different feedback fails with a conflict.

## Examples

### Acknowledgement Only

Omit `form` when the person only confirms the prompt:

```yaml
steps:
  - id: confirm_maintenance
    action: human.task
    with:
      prompt: Confirm that the maintenance window has started

  - id: begin_maintenance
    depends: [confirm_maintenance]
    run: ./maintenance.sh
```

### Sequential Decisions

Each task is a separate checkpoint. Completing `select_target` resumes the run until `confirm_release` opens. Completing `confirm_release` resumes it again, and `deploy` runs.

```yaml
steps:
  - id: select_target
    action: human.task
    with:
      prompt: Select the release target
      form:
        type: object
        properties:
          environment:
            type: string
            enum: [staging, production]
        required: [environment]

  - id: confirm_release
    action: human.task
    depends: [select_target]
    with:
      prompt: Confirm release to ${steps.select_target.outputs.environment}

  - id: deploy
    depends: [confirm_release]
    run: ./deploy.sh '${steps.select_target.outputs.environment}'
```

### Parallel Reviewers

Independent tasks wait at the same time. `deploy` depends on both, so completing one stores its input and the run stays `Waiting` until the other is complete.

```yaml
type: graph

steps:
  - id: security_review
    action: human.task
    with:
      prompt: Record the security review
      form:
        type: object
        properties:
          risk:
            type: string
            enum: [low, medium, high]
        required: [risk]

  - id: release_manager
    action: human.task
    with:
      prompt: Confirm the release window

  - id: deploy
    depends: [security_review, release_manager]
    run: ./deploy.sh '${steps.security_review.outputs.risk}'
```

### Independent Review Branches

When a step depends on only one of several open tasks, completing that task resumes the run for its branch while the other task stays open.

```yaml
type: graph

steps:
  - id: build
    run: ./build.sh

  - id: security_review
    depends: [build]
    action: human.task
    with:
      prompt: Record the security review

  - id: publish_report
    depends: [security_review]
    run: ./publish-report.sh

  - id: release_manager
    depends: [build]
    action: human.task
    with:
      prompt: Confirm the release window

  - id: deploy
    depends: [publish_report, release_manager]
    run: ./deploy.sh
```

Completing `security_review` queues the run. `publish_report` runs, and the run returns to `Waiting` on `release_manager`. Completing `release_manager` queues the run again, and `deploy` runs.

## Distributed Execution

Only root DAGs can contain human tasks. A root DAG with human tasks can run locally or on a distributed worker under the normal DAG-level routing: a label-based `worker_selector` selects a matching worker, `worker_selector: local` forces local execution, and `default_execution_mode: distributed` dispatches a root DAG that sets no selector.

When a run reaches a human task on a worker, it stores the `Waiting` status and releases the worker slot. Completion and push-back update the shared run store. The resumed attempt is queued and dispatched under the same routing rules, so a different matching worker can run it.

## Restrictions

A human task cannot use fields that run or configure a process:

- `run`, `executor`, or legacy execution fields
- `approval`
- `container` or a step-level `worker_selector`
- `foreach`, `parallel`, retry, repeat, signal, or timeout settings
- `stdout`, `stderr`, log, `output`, `output_schema`, or `outputs`
- `mail_on_error`

Human tasks are not allowed inside `foreach.steps` or lifecycle handlers. A DAG with a human task fails when invoked as a child through `dag.run`, `dag.enqueue`, or `parallel`. `with.push_back` is not allowed in `type: agent` DAGs.

`dagu dry` resolves the prompt and artifact paths and marks the task complete without waiting, so a workflow can be checked without input.

## See Also

- [Human-in-the-Loop](/writing-workflows/human-in-the-loop): Choosing between human tasks and approval gates, resume rules, and notifications
- [Approval Gates](/writing-workflows/approval): Reviewing the output of an executable step
- [Outputs](/writing-workflows/outputs): Referencing values in later steps
- [REST API](/web-ui/api#human-task-endpoints): Completion, push-back, and queue recovery endpoints
- [CLI Reference](/getting-started/cli#human-task-complete): `dagu human-task complete` and `dagu human-task push-back`
- [YAML Specification](/writing-workflows/yaml-specification#human-task): Field reference
