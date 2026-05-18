# Dagu Actions

Dagu actions are reusable step interfaces. They let a workflow call a named unit of work with a `with:` object instead of repeating the underlying implementation details at every call site.

There are three action reuse models:

| Model | Call shape | Where it lives | Use when |
|-------|------------|----------------|----------|
| Official action | `action: python-script@v1` | A maintained `dagucloud/*` repository | Dagu already provides the reusable package you need. |
| Remote action | `action: owner/repo@version` or `source:...@version` | A GitHub repository, explicit Git source, or local directory | The reusable unit needs files, scripts, schemas, tools, or its own DAG structure. |
| Custom action | `action: release.announce` | The current DAG document or `base.yaml` | You need an inline typed wrapper around a built-in step type. |

Built-in step types such as `run`, `http.request`, `docker.run`, `postgres.query`, and `agent.run` are documented separately in [Step Types](/step-types/shell). Dagu actions can wrap or package those step types, but they are not the same layer.

## Quick Example

Official actions use a short versioned reference:

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
    depends: [compute]
    run: echo "total=${compute.outputs.result.total}"
```

The action package owns its manifest, implementation DAG, output contract, and tool dependencies. The caller only supplies `with:` and reads `${compute.outputs.*}`.

## Choose a Model

Use an official action first when it matches the task. Official actions are remote action packages maintained in the `dagucloud` organization and can be called with `name@version`.

Use a remote action when the reusable behavior should be versioned independently, shared across repositories or teams, or implemented with package files such as scripts and templates.

Use a custom action when the reusable behavior is only a small wrapper around a built-in step type and should remain inside one DAG file or shared `base.yaml`.

## How Remote Actions Run

Remote and official actions are implemented as normal Dagu workflows with an action manifest:

```text
dagu-action.yaml  # manifest and schemas
workflow.yaml     # action DAG entrypoint
scripts/...       # helper files used by the action DAG
```

At runtime, Dagu resolves the action reference, validates the caller's `with:` object against the manifest `inputs` schema, materializes the action workspace, runs the action DAG as a sub-DAG, collects action outputs, validates them against the manifest `outputs` schema, and exposes them to the parent workflow through `${step.outputs.*}`.

See [Execution Model](/dagu-actions/execution-model) for the exact lifecycle and distributed-worker behavior.

## Pages

- [Official Actions](/dagu-actions/official)
- [Remote Actions](/dagu-actions/remote)
- [Custom Actions](/dagu-actions/custom)
- [Execution Model](/dagu-actions/execution-model)
