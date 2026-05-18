# Official Actions

Official actions are remote action packages maintained in the `dagucloud` GitHub organization. They use the same remote action runtime as any other package, but callers can use the short form:

```yaml
action: name@version
```

Dagu resolves that form to the GitHub repository `dagucloud/name`. For example, `python-script@v1` resolves to `dagucloud/python-script` at tag `v1`.

Versions are required. Pin production workflows to a version tag or commit SHA; a commit SHA is the strongest reproducibility boundary. The examples below use the current `v1` tags.

## Available Official Actions

| Action | Repository | Runtime owned by the action | Use when |
|--------|------------|-----------------------------|----------|
| `node-script@v1` | [`dagucloud/node-script`](https://github.com/dagucloud/node-script) | `nodejs/node@v22.21.1` through action `tools` | You need a small JavaScript transform or glue step and want the action to provide Node.js. |
| `python-script@v1` | [`dagucloud/python-script`](https://github.com/dagucloud/python-script) | `astral-sh/uv@0.11.14` through action `tools`; default Python `3.13.9` | You need a small Python transform or glue step, optionally with pinned Python requirements. |

Official actions are not sandboxes. The script runs with the same worker permissions, filesystem access, network access, and secrets available to the Dagu run. Only run trusted code.

## JavaScript: `node-script`

```yaml
steps:
  - id: compute
    action: node-script@v1
    with:
      input:
        version: "1.2.3"
        services: ["api", "worker"]
      script: |
        console.log("preparing release", input.version)

        return {
          tag: `v${input.version}`,
          serviceCount: input.services.length
        }

  - id: print
    depends: [compute]
    run: echo "release tag is ${compute.outputs.result.tag}"
```

`script` is a JavaScript async function body. `return` publishes `result`. The action exposes `input`, `params`, `env`, and a captured `console` object.

Outputs include:

| Field | Description |
|-------|-------------|
| `ok` | `true` when the script completed successfully. |
| `result` | JSON-compatible value returned by the script. |
| `stdout` | Text written through `console.log`, `console.info`, `console.debug`, or `console.dir`. |
| `stderr` | Text written through `console.warn` or `console.error`. |
| `durationMs` | Wrapper-measured script duration in milliseconds. |
| `nodeVersion` | Node.js version used by the action. |
| `error` | Error object when the script fails. |

## Python: `python-script`

```yaml
steps:
  - id: compute
    action: python-script@v1
    with:
      input:
        version: "2.3.4"
        services: ["api", "worker", "scheduler"]
      requirements:
        - packaging==25.0
      script: |
        from packaging.version import Version

        version = Version(input["version"])

        return {
            "major": version.major,
            "serviceCount": len(input["services"]),
        }

  - id: print
    depends: [compute]
    run: echo "major version is ${compute.outputs.result.major}"
```

`script` is a Python async function body. `return` publishes `result`, and `await` works directly. The action exposes `input`, `params`, and `env`.

The `requirements` field is optional. When present, each entry is passed to `uv run --with`, so pin dependencies for reproducible runs.

Outputs include:

| Field | Description |
|-------|-------------|
| `ok` | `true` when the script completed successfully. |
| `result` | JSON-compatible value returned by the script. |
| `stdout` | Text written to stdout with `print()` or other stdout writes. |
| `stderr` | Text written to stderr by the script process. |
| `durationMs` | Wrapper-measured duration in milliseconds. |
| `pythonVersion` | Python version used by the script process. |
| `error` | Error object when the script fails. |

## Runtime and Worker Behavior

Official actions declare their own `tools` in the action DAG. Caller DAG `tools` are not inherited across the action boundary.

In standalone runs, the local Dagu process resolves the action, prepares the action tools, and runs the action DAG as a sub-DAG. In distributed runs, the worker executing the action step resolves and packages the action workspace; the worker running the action DAG prepares that action DAG's tools in its own local tools cache.

For the full package model, reference formats, manifest rules, output publication rules, and distributed execution details, see [Execution Model](/dagu-actions/execution-model).
