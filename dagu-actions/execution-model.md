# Action Execution Model

This page describes how remote and official Dagu actions run internally. Custom actions are different: they expand into a normal built-in step at DAG load time and do not create an action package, manifest, workspace bundle, or sub-DAG run.

## Package Files

A remote action package is a directory or Git repository with a `dagu-action.yaml` manifest:

```text
my-action/
├── dagu-action.yaml
├── workflow.yaml
└── scripts/
    └── helper.sh
```

`dagu-action.yaml` supports exactly these fields:

| Field | Required | Description |
|-------|----------|-------------|
| `apiVersion` | Yes | Manifest version. Currently `v1alpha1`. |
| `name` | Yes | Action name declared by the package. |
| `dag` | Yes | Safe relative path to the action DAG file inside the package. |
| `inputs` | No | JSON Schema object for the caller's `with:` object. |
| `outputs` | No | JSON Schema object for the collected action output object. |

Unknown manifest fields are rejected. The manifest does not accept `tools`; put tool dependencies in the action DAG file.

## Reference Resolution

The caller chooses an action with the step `action` field:

| Format | Meaning | Example |
|--------|---------|---------|
| `name@version` | Official Dagu action, resolved as `dagucloud/name` | `python-script@v1` |
| `owner/repo@version` | GitHub repository | `acme/dagu-action-notify@v1.2.0` |
| `source:target@version` | Explicit local path, `file://` path, or Git source | `source:./actions/notify@local` |

Versions are required for remote references. Use a version tag or commit SHA for production workflows; a commit SHA is the strongest reproducibility boundary.

Dagu rejects unsafe Git ref syntax such as whitespace, `..`, `@{`, shell metacharacters, hidden path segments, and `.lock` suffixes.

## Caller Input

The caller passes input through `with:`:

```yaml
steps:
  - id: notify
    action: acme/dagu-action-notify@v1.2.0
    with:
      text: "Build ${BUILD_ID} finished"
```

Before the action DAG starts, Dagu validates `with:` against the manifest `inputs` schema when one is declared. JSON Schema `default` values are validated as schema defaults, but they are not applied to the caller's `with:` object before parameters are passed.

Scalar `with:` fields are available to the action DAG as runtime parameters, so they can be read with normal parameter syntax such as `${text}`. For structured input, use `DAG_PARAMS_JSON` in the action implementation or pass an explicit JSON string and decode it inside the action DAG.

## Workspace Materialization

After Dagu resolves the reference and reads the manifest, it materializes an action workspace containing the package files. The action DAG runs inside that workspace, so relative paths such as `./scripts/helper.sh` refer to files from the action package.

Do not set `working_dir` in the action DAG. The action workspace is already the working directory boundary for package-relative files.

Workspace bundles are bounded by the default limits: 64 MiB compressed, 256 MiB uncompressed, and 8192 files. `.git` directories are not included in the bundle.

## Sub-DAG Run

The action DAG is a normal Dagu workflow run as a sub-DAG of the parent action step. It gets its own run metadata, logs, timing, retry behavior, and tool preparation.

Caller DAG `tools` are not inherited by the action DAG. If the action DAG invokes portable external CLIs, declare them in top-level `tools` in the action DAG file:

```yaml
tools:
  - jqlang/jq@jq-1.7.1

steps:
  - id: classify
    run: ./classify.sh
```

Dagu prepares those tools on the worker that runs the action DAG, using that worker's local tools cache.

## Output Collection

Action outputs are the boundary data returned to the parent workflow. New action packages should publish caller-visible outputs with `stdout.outputs` or `outputs.write`.

Use `stdout.outputs` when one command writes the boundary object to stdout:

```yaml
steps:
  - id: classify
    run: ./classify.sh
    stdout:
      outputs:
        decode: json
```

Use `outputs.write` when the action DAG assembles the boundary object from parameters, previous step output, or literals:

```yaml
steps:
  - id: publish
    action: outputs.write
    with:
      values:
        messageId: ${send.output.response.id}
        status: sent
```

Do not use object-form `output:` to return data to the parent workflow. Object-form `output:` is step-scoped inside the action DAG and is read as `${step.output.*}` there. To cross the action boundary, publish values with `stdout.outputs` or `outputs.write`.

After the action DAG returns, Dagu validates the collected action output object against the manifest `outputs` schema when one is declared. Validation failure fails the parent action step.

The parent workflow reads action outputs through `${step.outputs.*}`:

```yaml
steps:
  - id: notify
    action: acme/dagu-action-notify@v1.2.0
    with:
      text: "Deploy finished"

  - id: audit
    depends: [notify]
    run: echo "Message: ${notify.outputs.messageId}"
```

## Distributed Workers

Remote actions work in standalone runs and distributed worker runs, but the source reference determines what the worker must be able to access.

| Mode | Behavior |
|------|----------|
| Standalone or local sub-DAG | The local process resolves the ref, validates the manifest, packages the action workspace, and runs the action DAG locally. |
| Shared-filesystem workers | The worker executing the action step resolves the ref. Local `source:` paths work only if that path is mounted and readable by that worker. |
| Shared-nothing workers | Prefer GitHub or explicit Git `source:` refs. Local `source:` paths work only if the same path exists on the worker executing the action step. |

When the action sub-DAG runs on a distributed worker, Dagu transfers the materialized workspace bundle through the coordinator. The child worker does not need the action repository checked out in its DAG directory, but it does need access to any runtime dependencies the action itself uses, such as network access for first-time tool or package downloads.

## Related

- [Remote Actions](/dagu-actions/remote)
- [Official Actions](/dagu-actions/official)
- [Outputs](/writing-workflows/outputs)
- [Tools](/writing-workflows/tools)
