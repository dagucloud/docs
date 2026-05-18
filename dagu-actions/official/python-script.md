# Python (`python-script@v1`)

Run a small Python transform or glue step with action-owned Python and optional requirements.

- Repository: [`dagucloud/python-script`](https://github.com/dagucloud/python-script)
- Runtime owned by the action: `astral-sh/uv@0.11.14` through action `tools`; default Python `3.13.9`

Contributions are welcome. The repository is public, so improvements, bug reports, and pull requests can go to [`dagucloud/python-script`](https://github.com/dagucloud/python-script).

## Example

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
    run: echo "major version is ${compute.outputs.result.major}"
    depends: compute
```

`script` is a Python async function body. `return` publishes `result`, and `await` works directly. The action exposes `input`, `params`, and `env`.

The `requirements` field is optional. When present, each entry is passed to `uv run --with`, so pin dependencies for reproducible runs.

## Outputs

| Field | Description |
|-------|-------------|
| `ok` | `true` when the script completed successfully. |
| `result` | JSON-compatible value returned by the script. |
| `stdout` | Text written to stdout with `print()` or other stdout writes. |
| `stderr` | Text written to stderr by the script process. |
| `durationMs` | Wrapper-measured duration in milliseconds. |
| `pythonVersion` | Python version used by the script process. |
| `error` | Error object when the script fails. |

## Related

- [Official Dagu Actions](/dagu-actions/official)
- [Action Package Execution](/dagu-actions/execution-model)
