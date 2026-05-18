# Dagu Actions

Dagu Actions are official reusable action packages maintained by the `dagucloud` organization. They let a workflow call a maintained package with a short versioned reference such as `python-script@v1` or `duckdb@v1`.

Custom Actions and Third-Party Actions use related `action:` syntax, but they are different concepts:

| Model | Call shape | Where it lives | Use when |
|-------|------------|----------------|----------|
| Dagu Action | `action: python-script@v1` | A maintained `dagucloud/*` repository | Dagu already provides the reusable package you need. |
| Third-Party Action | `action: owner/repo@version` | A repository outside the official `dagucloud` action set | The reusable unit is maintained outside Dagu and should be pinned by version. |
| Custom Action | `action: release.announce` | The current DAG document or `base.yaml` | You need an inline typed wrapper around a built-in step type. |

Built-in step types such as `run`, `http.request`, `docker.run`, `postgres.query`, and `agent.run` are documented separately in [Step Types](/step-types/shell). Packaged actions can use those step types internally, but they are not the same layer.

## Quick Example

Dagu Actions use a short versioned reference:

```yaml
steps:
  - id: compute
    action: python-script@v1
    with:
      input:
        values: [3, 5, 8]
      script: |
        return {"total": sum(input["values"])}

  - id: print
    run: echo "total=${compute.outputs.result.total}"
    depends: [compute]
```

The action package owns its manifest, implementation workflow, output contract, and tool dependencies. The caller only supplies `with:` and reads `${compute.outputs.*}`.

## Choose a Model

Use a Dagu Action first when it matches the task. Dagu Actions are maintained in the `dagucloud` organization and can be called with `name@version`.

Use a third-party action when the reusable behavior is packaged outside the official `dagucloud` action set and should be pinned by version.

Use a custom action when the reusable behavior is only a small wrapper around a built-in step type and should remain inside one DAG file or shared `base.yaml`.

## How Packages Run

Dagu Actions and Third-Party Actions are implemented as normal Dagu workflows with an action manifest:

```text
dagu-action.yaml  # manifest and schemas
workflow.yaml     # action DAG entrypoint
scripts/...       # helper files used by the action DAG
```

At runtime, Dagu resolves the action reference, validates the caller's `with:` object against the manifest `inputs` schema, materializes the action workspace, runs the action DAG as a sub-DAG, collects action outputs, validates them against the manifest `outputs` schema, and exposes them to the parent workflow through `${step.outputs.*}`.

See [Execution Model](/dagu-actions/execution-model) for the exact lifecycle and distributed-worker behavior.

## Pages

- [Official Dagu Actions](/dagu-actions/official)
- [Third-Party Actions](/dagu-actions/third-party)
- [Custom Actions](/dagu-actions/custom)
- [Execution Model](/dagu-actions/execution-model)
