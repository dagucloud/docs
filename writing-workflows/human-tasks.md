# Human Tasks

Use `action: human.task` when a workflow must pause for a person to acknowledge a prompt or provide structured input. A human task is a standalone, processless step in a root DAG: it does not run a command before waiting.

Human tasks are useful for release parameters, incident decisions, maintenance confirmations, data corrections, and any other checkpoint where later steps need durable operator input.

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
    depends: [review]
    run: ./deploy.sh '${steps.review.outputs.environment}'
```

Start or enqueue the DAG normally. When it reaches `review`, the DAG and step enter `Waiting` status. Complete it from the Web UI, REST API, or local CLI.

### Web UI

1. Open the waiting run from **Cockpit** or the workflow history.
2. Open the **Human tasks** tab. Dagu selects it automatically when input is required.
3. Fill in the generated form and select **Complete task**.

The form uses the resolved schema stored with that run. Editing the source YAML after the task opens does not change that waiting task. Completing a task requires permission to execute DAGs in its workspace.

### Local CLI

```bash
dagu human-task complete \
  --run-id <run-id> \
  --step review \
  --input environment=production \
  --input notify=true \
  <root-dag-name>
```

The completion command operates on the local Dagu instance, even when the target root run executed on a distributed worker.

### REST API

Submit the form values as a typed JSON object:

```bash
curl -X POST \
  "http://localhost:8080/api/v1/dag-runs/release-workflow/<run-id>/human-tasks/review/complete" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"environment":"production","notify":true}'
```

See [Human Task Endpoints](/web-ui/api#human-task-endpoints) for the response contract, errors, and queue-recovery endpoint.

## Completion and Queueing

Completing a task performs these operations in order:

1. Validate the input against the resolved form stored with the DAG run.
2. Persist the canonical input and generated outputs, then mark the step `Succeeded`.
3. Keep the DAG `Waiting` while any other manual step still needs input.
4. When no manual steps remain waiting, enqueue a retry of the same DAG run.
5. Let the scheduler consume the queue and continue from the persisted checkpoint.

The final completion always uses the queue, for both local and distributed runs. It never starts the DAG immediately in the completion request. This gives every resumed run the same queue, concurrency, scheduler, and worker-selection behavior.

The resumed attempt uses the DAG snapshot and human-task form stored with the run. It does not reload a changed source file before continuing from the checkpoint.

The submitted input is committed before enqueueing. If the queue is temporarily unavailable, the completion endpoint returns `503`, the DAG remains recoverable, and the Web UI displays **Retry queue**. The same operation can be retried through the [resume endpoint](/web-ui/api#retry-human-task-resume-queue) without resubmitting the form values. CLI users can repeat the identical completion command; Dagu recognizes the stored input and retries the enqueue.

Keep the scheduler running so queued resumes can start.

## Human Tasks vs Approval

Human tasks and [approval gates](/writing-workflows/approval) both pause a DAG, but they serve different purposes.

| | Human task | Approval |
|---|---|---|
| Execution | Standalone processless step | Runs a command or action first, then waits |
| Collected values | Typed form values published as step outputs | Approval inputs exposed as environment variables |
| Resolution | Complete | Approve, reject, or push back and rewind |
| Completion surfaces | Web UI, REST API, local CLI | Web UI and REST API |

Use a human task to collect data or require an acknowledgement before later work starts. Use approval when a person must review the output of an executable step and may reject it or send it back for revision.

## Step ID and Output References

Every human task must have an explicit step `id`. It is used by the completion API and CLI as well as downstream output references:

```text
--step review
.../human-tasks/review/complete
${steps.review.outputs.environment}
```

Step IDs must follow the normal identifier rules: they are at most 40 characters, start with a letter, and contain only letters, numbers, and underscores.

Output references do not create dependencies. A consumer must depend directly or transitively on the human task.

## Prompt

`with.prompt` is required and cannot be empty. Dagu resolves supported workflow references when the human task opens, so the prompt can include parameters, environment values, context values, or outputs from completed dependencies:

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

The resolved prompt is stored with the run, so the Web UI and API show the text that the operator actually saw.

## Form Schema

`with.form` is an optional, flat JSON Schema object. If present, its root `type` must be `object`.

```yaml
with:
  prompt: Enter release details
  form:
    type: object
    title: Release details
    description: Values used by the deployment step
    additionalProperties: false
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

The form supports these root fields:

| Field | Description |
|-------|-------------|
| `type` | Must be `object`. |
| `title` | Optional form title. |
| `description` | Optional form description. |
| `properties` | Scalar fields accepted by the form. |
| `required` | Property names that must be submitted. |
| `additionalProperties` | Whether undeclared input keys are accepted. Defaults to `false`. |

Property names must start with a letter and contain only letters, numbers, and underscores. Properties support `string`, `integer`, `number`, and `boolean` values, with these constraints:

| Field | Applies to | Description |
|-------|------------|-------------|
| `title`, `description` | All types | Display metadata. |
| `default` | All types | Value used when the property is omitted. |
| `enum` | All types | Allowed scalar values. |
| `oneOf` | All types | Labeled choices; every option must define `const`. |
| `minimum`, `maximum` | `integer`, `number` | Numeric bounds. |
| `minLength`, `maxLength`, `pattern` | `string` | String length and regular-expression constraints. |

Each `oneOf` option may also define `type`, `title`, and `description`. Nested objects and arrays are not supported. Defaults are applied before required properties are checked. Set `additionalProperties: true` only when the task intentionally accepts keys not listed in `properties`.

## Form Outputs

Dagu derives human-task outputs from the form. Do not add an `outputs` field to the step.

Every declared form property is a step output. Its value is published when submitted or supplied by a default, then becomes available through `${steps.<id>.outputs.<name>}`.

Given this form:

```yaml
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
```

`environment`, `notify`, and `notes` are declared outputs. A value is published when it is submitted or supplied by a default. Later steps can use the generated outputs directly:

```yaml
- id: deploy
  depends: [review]
  env:
    - DEPLOY_ENV: ${steps.review.outputs.environment}
    - SEND_NOTICE: ${steps.review.outputs.notify}
  run: ./deploy.sh
```

The canonical submitted input and generated step outputs are subject to the DAG's `max_output_size` limit.

An undeclared property accepted through `additionalProperties: true` is stored with the submitted input but does not become a step output.

## Examples

### Acknowledgement-Only Checkpoint

Omit `form` when the operator only needs to acknowledge a prompt:

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

In the Web UI, select **Complete task** without filling a form. Through the API, send an empty JSON object. Through the CLI, omit `--input` and `--inputs-json`:

```bash
dagu human-task complete \
  --run-id <run-id> \
  --step confirm_maintenance \
  <root-dag-name>
```

### Typed Release Form

This form collects validated deployment settings and passes them to the executable step:

```yaml
steps:
  - id: release_settings
    action: human.task
    with:
      prompt: Configure the production rollout
      form:
        type: object
        additionalProperties: false
        properties:
          strategy:
            type: string
            enum: [canary, rolling]
          replicas:
            type: integer
            minimum: 1
            maximum: 50
            default: 3
          change_ticket:
            type: string
            pattern: '^CHG-[0-9]+$'
          notify:
            type: boolean
            default: true
        required: [strategy, change_ticket]

  - id: deploy
    depends: [release_settings]
    env:
      - STRATEGY: ${steps.release_settings.outputs.strategy}
      - REPLICAS: ${steps.release_settings.outputs.replicas}
      - CHANGE_TICKET: ${steps.release_settings.outputs.change_ticket}
      - NOTIFY: ${steps.release_settings.outputs.notify}
    run: ./deploy.sh
```

### Sequential Decisions

Each checkpoint is durable. Completing `select_target` queues the run, which advances until `confirm_release` opens. Completing the second task queues the same run again so `deploy` can execute.

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

Independent human tasks can wait at the same time. Completing one stores its input, but the DAG remains `Waiting` and is not enqueued until the other waiting task is also complete.

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

## Completing a Task from the CLI

```bash
dagu human-task complete [flags] <root-dag-name>
```

| Flag | Required | Description |
|------|----------|-------------|
| `--run-id`, `-r` | Yes | Root DAG-run ID. |
| `--step` | Yes | Explicit `id` of the waiting human-task step. |
| `--input key=value` | No | Form value. Repeat the flag for multiple values. |
| `--inputs-json '{...}'` | No | Form values as one typed JSON object. |

`--input` and `--inputs-json` are mutually exclusive. Values passed through `--input` are coerced according to the form schema, so values such as `replicas=3` and `notify=true` become an integer and a boolean. Use `--inputs-json` when preserving JSON number or boolean types explicitly is clearer:

```bash
dagu human-task complete \
  --run-id 20260720_120000 \
  --step review \
  --inputs-json '{"environment":"production","replicas":3,"notify":true}' \
  release-workflow
```

The command only supports the local CLI context. It validates the submitted values against the stored form for that run before changing its status. The target root DAG run may have executed locally or on a distributed worker.

## Idempotency and Recovery

- Completing a human task stores the validated input in the DAG-run status. The step finish time records when it completed.
- Repeating the same completion with the same canonical input is idempotent.
- Trying to complete an already completed task with different input is rejected with a conflict.
- If another manual step is still waiting, the input remains stored and the DAG stays `Waiting`.
- When no manual steps remain waiting, completion always enqueues the same DAG run.
- If enqueueing fails after the input is stored, use **Retry queue**, call the resume endpoint, or repeat the identical CLI completion command. The form does not need to be entered again.
- Retrying the whole DAG or an individual human-task step cannot bypass a pending human-task checkpoint.

Human tasks have no reject, push-back, or rewind operation. Stop the DAG if it should not continue.

## Scheduling and Distributed Execution

Only root DAGs can contain human tasks. A root DAG containing a human task can run on the main Dagu instance or on a distributed worker. Normal DAG-level routing applies: a label-based `worker_selector` selects a matching worker, `worker_selector: local` forces local execution, and `default_execution_mode: distributed` dispatches an otherwise unselected root DAG.

When any run reaches a human task, it persists the final `Waiting` status and releases the attempt. After all manual input is complete, Dagu enqueues the same run. The scheduler later starts the next attempt locally or dispatches it to a matching worker according to the normal routing rules.

Human tasks are rejected in DAGs invoked through `dag.run`, `dag.enqueue`, or `parallel`, regardless of whether the child would otherwise run locally or remotely.

## Validation and Limitations

A human task cannot be combined with executable or process-oriented step features, including:

- `run`, `executor`, or legacy execution fields
- `approval`
- `container` or a step-level `worker_selector`
- `foreach`, `parallel`, retry, repeat, signal, or timeout settings
- stdout, stderr, log, `output`, `output_schema`, or authored `outputs` settings
- mail-on-error settings

Human tasks are not allowed in sub-DAGs, inside `foreach.steps`, or in lifecycle handlers.

`dagu dry` resolves the prompt and completes the human task without waiting. This validates the workflow without requiring operator input.

Human-task completion is available through the Web UI, REST API, and local CLI. MCP can author, start, and inspect runs containing human tasks, but it does not currently expose a completion operation.

## See Also

- [REST API](/web-ui/api#human-task-endpoints) — Completion and queue-recovery endpoints
- [CLI Reference](/getting-started/cli#human-task-complete) — Local completion command
- [Outputs](/writing-workflows/outputs) — Referencing values in later steps
- [Approval](/writing-workflows/approval) — Reviewing executable step output with approve, reject, and push-back
- [Lifecycle Handlers](/writing-workflows/lifecycle-handlers) — Notifications when a DAG enters `Waiting`
- [YAML Specification](/writing-workflows/yaml-specification#human-task) — Concise field reference
