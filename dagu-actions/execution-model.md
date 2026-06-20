# Action Package Execution

This page explains what happens when a workflow calls a packaged action.

Packaged actions include:

- [Official Dagu Actions](/dagu-actions/official), such as `python-script@v1` and `duckdb@v1`
- [Third-Party Actions](/dagu-actions/third-party), such as `acme/dagu-action-notify@v1.2.0`

[Custom Actions](/dagu-actions/custom) are different. They are inline `actions:` wrappers that expand into a normal step when the DAG is loaded. They do not create a package workspace, manifest boundary, or sub-DAG run.

## The Short Version

When a workflow calls a packaged action, Dagu:

1. Resolves the `action:` reference.
2. Reads the package manifest, `dagu-action.yaml`.
3. Validates the caller's `with:` input.
4. Creates a workspace from the package files.
5. Runs the package workflow as a child DAG run.
6. Collects outputs from the package workflow.
7. Validates those outputs against the manifest.
8. Exposes them to the caller as `${steps.step_id.outputs.*}`.

From the caller's point of view, the action is just one step:

```yaml
params:
  - BUILD_ID: "42"

steps:
  - id: notify
    action: acme/dagu-action-notify@v1.2.0
    with:
      text: "Deploy finished"

  - id: audit
    run: echo "Message: ${steps.notify.outputs.messageId}"
    depends: notify
```

## Package Shape

An action package is a repository with a manifest and a workflow file:

```text
my-action/
├── dagu-action.yaml
├── workflow.yaml
└── scripts/
    └── helper.sh
```

`dagu-action.yaml` tells Dagu which workflow to run and what input/output contract to enforce:

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
```

The manifest accepts only these keys: `apiVersion`, `name`, `dag`, `inputs`, and `outputs`. Put runtime dependencies such as `tools` in the action workflow, not in `dagu-action.yaml`.

## References

The caller chooses the package with the step `action` field:

| Reference | Meaning | Example |
|-----------|---------|---------|
| `name@version` | Official Dagu Action from `dagucloud/name` | `python-script@v1` |
| `owner/repo@version` | Third-party action package | `acme/dagu-action-notify@v1.2.0` |

Versions are required. Use a version tag or commit SHA for production workflows. A commit SHA is the strongest reproducibility boundary.

Dagu rejects unsafe Git ref syntax such as whitespace, `..`, `@{`, shell metacharacters, hidden path segments, and `.lock` suffixes.

## Inputs

The caller passes input through `with:`:

```yaml
steps:
  - id: notify
    action: acme/dagu-action-notify@v1.2.0
    with:
      text: "Build ${params.BUILD_ID} finished"
```

If the manifest has an `inputs` schema, Dagu validates `with:` before the package workflow starts.

Inside the package workflow, scalar input fields are available as runtime parameters. For the example above, the package workflow can read `${params.text}`:

```yaml
params:
  - text

steps:
  - id: send
    run: ./scripts/notify.sh "${params.text}"
```

For structured input, read `DAG_PARAMS_JSON` or pass an explicit JSON string and decode it in the action workflow.

Schema `default` values are validated as part of the schema, but they are not applied to the caller's `with:` object before parameters are passed.

## Workspace

Dagu runs the package workflow inside a workspace built from the package files. Relative paths in the package workflow point to files in that workspace:

```yaml
steps:
  - id: classify
    run: ./scripts/classify.sh
```

Do not set `working_dir` in the package workflow. The action workspace is already the package boundary.

Workspace bundles are bounded by the default limits: 64 MiB compressed, 256 MiB uncompressed, and 8192 files. `.git` directories are not included.

## Tools

Caller workflow `tools` are not inherited by the package workflow. If the action package needs a CLI, declare it in the package workflow:

```yaml
tools:
  - jqlang/jq@jq-1.7.1

steps:
  - id: classify
    run: jq '.kind' payload.json
```

Dagu prepares those tools on the worker that runs the package workflow.

## Outputs

Action outputs are the values returned to the caller. Publish them with `stdout.outputs` or `outputs.write`.

Use `stdout.outputs` when a command writes the result object to stdout:

```yaml
steps:
  - id: send
    run: ./scripts/notify.sh "${params.text}"
    stdout:
      outputs:
        fields:
          messageId:
            decode: json
            select: .id
```

Use `outputs.write` when the package workflow assembles the result from earlier values:

```yaml
steps:
  - id: publish
    action: outputs.write
    with:
      values:
        messageId: ${steps.send.outputs.messageId}
        status: sent
```

Do not use object-form `output:` to return values to the caller. Object-form `output:` is only step-scoped inside the package workflow. To cross the action boundary, use `stdout.outputs` or `outputs.write`.

After the package workflow finishes, Dagu validates the collected output object against the manifest `outputs` schema. If validation fails, the parent action step fails.

The caller reads returned values with `${steps.step_id.outputs.*}`:

```yaml
steps:
  - id: notify
    action: acme/dagu-action-notify@v1.2.0
    with:
      text: "Deploy finished"

  - id: audit
    run: echo "Message: ${steps.notify.outputs.messageId}"
    depends: notify
```

## Distributed Workers

Packaged actions work in distributed mode.

The worker executing the parent action step resolves the package and builds the action workspace. When the package workflow runs as a child DAG, Dagu transfers that workspace through the coordinator to the worker that runs the child DAG.

The child worker does not need the action repository checked out in its DAG directory. It does need access to anything the package workflow uses at runtime, such as network access for first-time tool or package downloads.

## Related

- [Official Dagu Actions](/dagu-actions/official)
- [Third-Party Actions](/dagu-actions/third-party)
- [Custom Actions](/dagu-actions/custom)
- [Outputs](/writing-workflows/outputs)
- [Tools](/writing-workflows/tools)
