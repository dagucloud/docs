# Third-Party Actions

Third-party actions are action packages maintained outside the official `dagucloud` action set. Use them when a workflow should call a reusable package from another repository and pin it by version.

If a maintained official Dagu Action already fits the job, prefer [Official Dagu Actions](/dagu-actions/official). If the reusable logic is only a small inline wrapper around a built-in step type, use [Custom Actions](/dagu-actions/custom).

## Call an Action

Call a third-party action with `owner/repo@version`:

```yaml
params:
  - ENVIRONMENT: production

steps:
  - id: notify
    action: acme/dagu-action-notify@v1.2.0
    with:
      channel: "#ops"
      text: "Deployment finished for ${params.ENVIRONMENT}"
```

`with:` is the input object passed to the action. The action package can validate that object with the `inputs` schema in `dagu-action.yaml` before its workflow starts.

Versions are required. Pin production workflows to a version tag or commit SHA. A commit SHA gives the strongest reproducibility boundary.

## Package Layout

A third-party action package is a Git repository containing a manifest and a workflow:

```text
dagu-action-notify/
├── dagu-action.yaml
├── workflow.yaml
└── scripts/
    └── notify.sh
```

`dagu-action.yaml` declares the action entrypoint and the input/output contracts:

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

Supported manifest keys are exactly `apiVersion`, `name`, `dag`, `inputs`, and `outputs`. Unknown keys are rejected. Put tool dependencies in the action workflow, not in the manifest.

The action workflow is a normal Dagu workflow. Dagu runs it inside the materialized action workspace, so relative files such as `./scripts/notify.sh` refer to files from the package.

## Tool Dependencies

If the action needs external CLIs, declare them in the action workflow:

```yaml
tools:
  - jqlang/jq@jq-1.7.1

params:
  - text

steps:
  - id: send
    run: ./scripts/notify.sh "${params.text}"
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

Caller workflow tools are not inherited across the action boundary. Each action package must declare the tools it needs.

Action `tools` are Dagu-managed CLI dependencies. Dagu resolves pinned packages from the aqua registry, prepares them before the action workflow runs, and exposes their commands on `PATH` for that action run. See [Tools](/writing-workflows/tools) for package syntax, registry behavior, and current limitations.

## Return Outputs

Callers read action outputs with `${steps.step_id.outputs.*}`:

```yaml
params:
  - BUILD_ID: "42"

steps:
  - id: notify
    action: acme/dagu-action-notify@v1.2.0
    with:
      text: "Build ${params.BUILD_ID} finished"

  - id: audit
    run: echo "Notification message: ${steps.notify.outputs.messageId}"
    depends: notify
```

Inside the action workflow, publish caller-visible outputs with `stdout.outputs` or `outputs.write`.

Use `stdout.outputs` when a command writes the result object to stdout:

```yaml
params:
  - text

steps:
  - id: classify
    run: ./classify.sh "${params.text}"
    stdout:
      outputs:
        decode: json
```

Use `outputs.write` when the action workflow assembles the result from parameters, previous steps, or literal values:

```yaml
params:
  - text

steps:
  - id: send
    run: ./scripts/notify.sh "${params.text}"
    stdout:
      outputs:
        fields:
          messageId:
            decode: json
            select: .id

  - id: publish
    action: outputs.write
    with:
      values:
        messageId: ${steps.send.outputs.messageId}
        status: sent
    depends: send
```

Do not use object-form `output:` to return action results to the caller. Object-form `output:` is step-scoped inside the action workflow. To cross the action boundary, publish values with `stdout.outputs` or `outputs.write`.

## How It Runs

At runtime, Dagu resolves the action reference, validates `with:` against the manifest `inputs` schema, materializes the action workspace, runs the action workflow as a sub-DAG, collects outputs, validates them against the manifest `outputs` schema, and exposes them to the caller through `${steps.step_id.outputs.*}`.

In distributed mode, Dagu transfers the materialized action workspace to the worker that runs the action sub-DAG. The child worker does not need the action repository checked out in its DAG directory.

Workspace bundles are bounded by the default limits: 64 MiB compressed, 256 MiB uncompressed, and 8192 files. `.git` directories are not included in the bundle.

## When To Use Third-Party Actions

Use a third-party action when:

- The reusable unit has scripts, templates, or helper files.
- The reusable unit should be versioned independently of the caller workflow.
- Multiple repositories or teams should call the same action contract.
- The action should run as a sub-DAG with its own run metadata.

Use a custom action instead when:

- The reusable unit is only a small wrapper around `run:` or another built-in step type.
- The action should live in `base.yaml` or inside one DAG file.
- You do not need a separate package, Git ref, or action manifest.

## Related

- [Official Dagu Actions](/dagu-actions/official)
- [Custom Actions](/dagu-actions/custom)
- [Execution Model](/dagu-actions/execution-model)
- [Tools](/writing-workflows/tools)
- [Outputs](/writing-workflows/outputs)
- [Distributed Workers](/server-admin/distributed/workers/)
