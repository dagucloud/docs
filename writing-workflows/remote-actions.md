# Remote Actions

Remote actions package a DAG as a reusable action that another workflow can call by version. Use them when the reusable logic needs its own files, scripts, schemas, or sub-DAG structure instead of a small inline wrapper.

For inline wrappers around built-in actions, use [Custom Actions](/writing-workflows/custom-step-types). For package-style reuse across repositories and workers, use remote actions.

## Call a Remote Action

Call a GitHub action package with `owner/repo@version`:

```yaml
steps:
  - id: notify
    action: acme/dagu-action-slack@v1.2.0
    with:
      channel: "#ops"
      text: "Deployment finished for ${ENVIRONMENT}"
```

Official Dagu actions use the short form `name@version`. This resolves to `dagucloud/name`:

```yaml
steps:
  - id: notify
    action: slack@v1.2.0
    with:
      channel: "#ops"
      text: "Workflow ${DAG_NAME} finished"
```

Use `source:` when you need an explicit source location:

```yaml
steps:
  - id: local_action
    action: source:./actions/notify@local
    with:
      text: "Local development run"

  - id: git_action
    action: source:https://github.com/acme/dagu-action-notify.git@v1.2.0
    with:
      text: "Pinned Git source run"
```

`with:` is the input object passed to the action. The action manifest can validate it with JSON Schema before the action DAG starts.

## Action Package Layout

A remote action package is a directory or Git repository containing `dagu-action.yaml`:

```text
dagu-action-notify/
├── dagu-action.yaml
├── workflow.yaml
└── scripts/
    └── notify.sh
```

This page uses `workflow.yaml` as the recommended entrypoint DAG filename to keep it visually distinct from the `dagu-action.yaml` manifest. The `dag` field can point to any safe relative file path inside the package.

`dagu-action.yaml` describes the action entrypoint and input/output contracts:

```yaml
apiVersion: v1alpha1
name: notify
dag: workflow.yaml
inputs:
  type: object
  additionalProperties: false
  required: [text]
  properties:
    text:
      type: string
outputs:
  type: object
  additionalProperties: false
  required: [messageId]
  properties:
    messageId:
      type: string
    status:
      type: string
```

Supported manifest keys are exactly `apiVersion`, `name`, `dag`, `inputs`, and `outputs`. Unknown keys are rejected. `inputs` and `outputs` are JSON Schema objects.

The action DAG is a normal Dagu workflow, but it must not set `working_dir`. Dagu runs it inside the materialized action workspace so relative files in the package are available.

If the action DAG invokes external CLIs, declare them in top-level `tools` in the action DAG file. Do not put `tools` in `dagu-action.yaml`; unknown manifest keys are rejected. Caller DAG tools are not inherited by the action DAG, so an action package that needs `jq`, `yq`, `kubectl`, or another portable CLI should pin that dependency itself. Dagu prepares the action DAG's tools on the worker that runs the action DAG, using that worker's local tools cache.

```yaml
tools:
  - jqlang/jq@jq-1.7.1

params:
  - text
steps:
  - id: send
    run: ./scripts/notify.sh "${text}"
    stdout:
      outputs:
        fields:
          messageId:
            decode: json
            select: .id
          status:
            decode: json
            select: .status
```

The `inputs` schema validates the caller's `with:` object before the action DAG starts. Input values are passed to the action DAG as runtime parameters, so scalar fields can be read with normal parameter syntax such as `${text}`. For structured input, pass an explicit JSON string and decode it inside the action DAG. JSON Schema `default` values in `inputs` are validated as schema defaults, but they are not applied to the caller's `with:` object before parameters are passed.

The `outputs` schema validates the collected action output object after the action DAG returns a run result. New action packages should publish that object with `stdout.outputs` or `action: outputs.write` in the action DAG. If no typed outputs are published, legacy string-form run outputs can still be carried for compatibility. If `outputs` validation fails, the action step fails. Dagu also writes the compact outputs JSON to the action step's stdout for compatibility, but callers should read the structured boundary with `${step.outputs.*}`.

## Use Outputs in the Caller

Use `${action_step.outputs.<field>}` when later steps need fields from the action result:

```yaml
steps:
  - id: notify
    action: acme/dagu-action-notify@v1.2.0
    with:
      text: "Build ${BUILD_ID} finished"

  - id: audit
    depends: [notify]
    run: echo "Notification message: ${notify.outputs.messageId}"
```

Use `stdout.outputs` when a command emits the action result on stdout:

```yaml
steps:
  - id: classify
    run: ./classify.sh "${text}"
    stdout:
      outputs:
        decode: json
```

Use `outputs.write` when the action DAG needs to assemble the result from parameters, previous steps, or literal values:

```yaml
steps:
  - id: send
    run: ./scripts/notify.sh "${text}"
    output:
      response:
        from: stdout
        decode: json

  - id: publish
    depends: [send]
    action: outputs.write
    with:
      values:
        messageId: ${send.output.response.id}
        status: sent
```

Do not use object-form `output:` to return action results to the parent DAG. Object-form `output:` is step-scoped inside the action DAG and remains available as `${step.output.*}` there; publish caller-visible action results through `stdout.outputs` or `outputs.write`.

See [Outputs](/writing-workflows/outputs) for the full output reference.

## Reference Formats

| Format | Meaning | Example |
|--------|---------|---------|
| `name@version` | Official Dagu action, resolved as `dagucloud/name` | `node-script@v1.2.0` |
| `owner/repo@version` | GitHub repository | `acme/dagu-action-notify@v1.2.0` |
| `source:target@version` | Explicit local path, `file://` path, or Git source | `source:./actions/notify@local` |

Versions are required. Use immutable tags or commit SHAs for production workflows. Dagu rejects unsafe Git ref syntax such as whitespace, `..`, `@{`, shell metacharacters, hidden path segments, and `.lock` suffixes.

## Execution Modes

Remote actions work in standalone runs and distributed worker runs, but the source reference determines what each worker must be able to access.

| Mode | Behavior |
|------|----------|
| Standalone or local sub-DAG | The process running the action resolves the ref, validates the manifest, packages the action workspace, and runs the action DAG locally. |
| Shared-filesystem workers | The worker executing the action resolves the ref. Local `source:` paths can be used only if that path is mounted and readable by that worker. |
| Shared-nothing workers | Prefer GitHub or explicit Git `source:` refs. Local `source:` paths work only if the same path exists on the worker executing the action step. |

After an action is resolved, Dagu packages the action workspace as an immutable content-addressed bundle. When the action sub-DAG runs on a distributed worker, the bundle is uploaded through the coordinator and materialized on the worker, so the child worker does not need the action repository checked out in its DAG directory.

Workspace bundles are bounded by the default limits: 64 MiB compressed, 256 MiB uncompressed, and 8192 files. `.git` directories are not included in the bundle.

## When To Use Remote Actions

Use a remote action when:

- The reusable unit has scripts, templates, or helper files.
- The reusable unit should be versioned independently of the caller workflow.
- Multiple repositories or teams should call the same action contract.
- The action should run as a sub-DAG with its own run metadata.

Use a custom action when:

- The reusable unit is only a small wrapper around `run:` or a built-in action.
- The action should live in `base.yaml` or inside one DAG file.
- You do not need a separate package, Git ref, or action manifest.

## Related

- [Custom Actions](/writing-workflows/custom-step-types)
- [Outputs](/writing-workflows/outputs)
- [Distributed Workers](/server-admin/distributed/workers/)
