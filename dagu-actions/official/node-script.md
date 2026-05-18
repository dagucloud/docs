# JavaScript (`node-script@v1`)

Run a small JavaScript transform or glue step with action-owned Node.js.

- Repository: [`dagucloud/node-script`](https://github.com/dagucloud/node-script)
- Runtime owned by the action: `nodejs/node@v22.21.1` through action `tools`

Contributions are welcome. The repository is public, so improvements, bug reports, and pull requests can go to [`dagucloud/node-script`](https://github.com/dagucloud/node-script).

## Example

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
    run: echo "release tag is ${compute.outputs.result.tag}"
    depends: [compute]
```

`script` is a JavaScript async function body. `return` publishes `result`. The action exposes `input`, `params`, `env`, and a captured `console` object.

## Outputs

| Field | Description |
|-------|-------------|
| `ok` | `true` when the script completed successfully. |
| `result` | JSON-compatible value returned by the script. |
| `stdout` | Text written through `console.log`, `console.info`, `console.debug`, or `console.dir`. |
| `stderr` | Text written through `console.warn` or `console.error`. |
| `durationMs` | Wrapper-measured script duration in milliseconds. |
| `nodeVersion` | Node.js version used by the action. |
| `error` | Error object when the script fails. |

## Related

- [Official Dagu Actions](/dagu-actions/official)
- [Action Package Execution](/dagu-actions/execution-model)

