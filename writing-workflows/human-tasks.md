# Human Tasks

Use `action: human.task` when a workflow must pause for an acknowledgement or a small amount of typed operator input before downstream steps continue. A human task is a standalone, processless step: it does not run a command before entering `Waiting`.

Human tasks are completed through the local Dagu CLI. They are different from [approval gates](/writing-workflows/approval), which are attached to executable steps and support approve, reject, and push-back decisions.

## Typed Form and Outputs

The following workflow asks an operator to choose a deployment target. Each declared form property automatically becomes a step output for downstream steps.

```yaml
params:
  - name: release
    default: v1.2.3

steps:
  - id: release_review
    action: human.task
    with:
      prompt: Choose the deployment target for ${params.release}
      form:
        type: object
        title: Release review
        properties:
          environment:
            type: string
            enum: [staging, production]
          replicas:
            type: integer
            minimum: 1
            default: 2
          notify:
            type: boolean
            default: true
        required: [environment]

  - id: deploy
    depends: release_review
    env:
      - TARGET: ${steps.release_review.outputs.environment}
      - REPLICAS: ${steps.release_review.outputs.replicas}
      - NOTIFY: ${steps.release_review.outputs.notify}
    run: ./deploy.sh "$TARGET" "$REPLICAS" "$NOTIFY"
```

Start the workflow with a known run ID:

```bash
dagu start --run-id release-42 release.yaml
```

When the run reaches `release_review`, inspect the stored prompt and normalized form:

```bash
dagu status --run-id release-42 release.yaml
```

Complete the task with form input:

```bash
dagu human-task complete \
  --run-id release-42 \
  --step release_review \
  --input environment=production \
  release.yaml
```

Dagu validates the submitted value, applies the `replicas` and `notify` defaults, marks `release_review` as succeeded, and resumes the same DAG run. The `deploy` step receives `production`, `2`, and `true` through the generated outputs.

## Acknowledgement-Only Tasks

Omit `form` when no input is needed:

```yaml
steps:
  - id: maintenance_started
    action: human.task
    with:
      prompt: Confirm that maintenance has started

  - id: continue_maintenance
    depends: maintenance_started
    run: ./continue-maintenance.sh
```

Complete an acknowledgement-only task without an input flag:

```bash
dagu human-task complete \
  --run-id maintenance-42 \
  --step maintenance_started \
  maintenance.yaml
```

## Form Schema

`with.form` uses the same scalar field schema as [typed parameters](/writing-workflows/parameters). It must be a flat object schema.

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | Must be `object`. |
| `title` | No | Display title for the form. |
| `description` | No | Help text for the form. |
| `properties` | No | Map of declared scalar fields. Defaults to an empty object. |
| `required` | No | Unique list of required property names. Defaults to an empty list. |
| `additionalProperties` | No | Whether undeclared input is accepted. Defaults to `false`. |

Declared properties support these scalar types:

- `string`
- `integer`
- `number`
- `boolean`

Property constraints include `default`, `enum`, `oneOf`, `minimum`, `maximum`, `minLength`, `maxLength`, and `pattern`. Nested declared objects and arrays are not supported. Property names must start with a letter and contain only letters, digits, or `_`.

Defaults are applied before required fields are checked. An optional property without a submitted value or default remains absent.

Set `additionalProperties: true` only when arbitrary extra input is intentional. Extra properties are stored with the submitted input but do not become step outputs.

## Generated Step Outputs

Dagu derives one output from each declared form property. Do not add an `outputs` field to a human-task step.

```text
${steps.<human-task-id>.outputs.<property>}
```

The consuming step must depend directly or transitively on the human task. An output reference does not create a dependency automatically.

Only values present after input validation and default application are published. Undeclared properties never become outputs, even when `additionalProperties` is enabled.

## Completion Input

`dagu human-task complete` requires the root DAG name or file, its run ID, and the human-task step ID.

| Flag | Description |
|------|-------------|
| `--run-id`, `-r` | Root DAG-run ID containing the waiting task. Required. |
| `--step` | Explicit human-task step `id`. Required. |
| `--input key=value` | String input. Repeat for multiple properties. |
| `--inputs-json object` | Typed input as one JSON object. |

`--input` and `--inputs-json` are mutually exclusive. Values passed with `--input` are coerced using the declared property type:

```bash
dagu human-task complete \
  --run-id release-42 \
  --step release_review \
  --input environment=production \
  --input replicas=3 \
  release.yaml
```

Use `--inputs-json` when input should retain its JSON types:

```bash
dagu human-task complete \
  --run-id release-42 \
  --step release_review \
  --inputs-json '{"environment":"production","replicas":3,"notify":false}' \
  release.yaml
```

The command matches `--step` against the explicit step `id`, not its display name. Repeating completion with the same validated input is safe. Repeating it with different input reports a conflict.

The command operates only in the local CLI context because it updates the DAG-run store directly. The run itself may have executed locally or on a distributed worker.

## Waiting and Resume Behavior

When a human task becomes ready, Dagu:

1. evaluates its preconditions
2. resolves and stores its prompt
3. marks the step as `Waiting`
4. lets independent ready or running branches finish
5. persists the DAG run as `Waiting`
6. exits the execution process or releases the distributed worker slot

Completing the last waiting task resumes the same DAG run automatically. If another independent human task is still waiting, the completion is stored but the run remains `Waiting` until that task is also completed.

Resume uses the stored DAG snapshot, form, and worker-selection rules. Editing the source YAML after the task opens does not change the waiting task. A distributed resume can run on a different matching worker; the scheduler must be running to dispatch it.

Human tasks have no automatic expiration or step timeout. No reconciliation command is required before or after completion.

## Human Tasks and Approval Gates

| Behavior | Human task | Approval gate |
|----------|------------|---------------|
| Definition | Standalone `action: human.task` step | `approval` attached to an executable step |
| Before waiting | Runs no process | Runs the step first |
| Result | Completion succeeds the step | Approve, reject, or push back |
| Rewind | Not supported | Supported with `rewind_to` |
| Collected values | Typed form properties become step outputs | Inputs become approval or push-back environment values |

Use a human task to collect a decision or value before work starts. Use an [approval gate](/writing-workflows/approval) to review the result of work that has already run or to send it back for revision.

## Restrictions

- A human-task step requires an explicit `id` and a non-empty `with.prompt`.
- Human tasks can run only in root DAGs. A root DAG may run locally or on a distributed worker.
- Human tasks are not allowed in DAGs invoked through `dag.run`, `dag.enqueue`, or `parallel`.
- Human tasks are not allowed in `foreach.steps` or lifecycle handlers.
- Execution, retry, repeat, timeout, container, step-level worker selector, approval, and authored output fields are not supported on a human-task step.
- A dry run resolves the prompt and succeeds the step without waiting or publishing form outputs.

## Related Pages

- [Approval Gates](/writing-workflows/approval)
- [CLI Reference](/getting-started/cli#human-task-complete)
- [Data Flow](/writing-workflows/data-flow)
- [Lifecycle Handlers](/writing-workflows/lifecycle-handlers)
- [YAML Specification](/writing-workflows/yaml-specification#human-task)
