# dbt (`dbt@v1`)

Run dbt Core commands from a Dagu workflow.

- Repository: [`dagucloud/dbt`](https://github.com/dagucloud/dbt)
- Runtime owned by the action: `astral-sh/uv@0.11.14` through action `tools`; default Python `3.13.9`

Contributions are welcome. The repository is public, so improvements, bug reports, and pull requests can go to [`dagucloud/dbt`](https://github.com/dagucloud/dbt).

## Example

```yaml
steps:
  - id: dbt_build
    action: dbt@v1
    with:
      projectDir: /data/jaffle-shop
      profilesDir: /data/dbt-profiles
      requirements:
        - dbt-duckdb==1.10.1
      command: build
      targetPath: ${env.DAG_RUN_ARTIFACTS_DIR}/dbt-target
      logPath: ${env.DAG_RUN_ARTIFACTS_DIR}/dbt-logs

  - id: print_summary
    run: |
      echo "dbt exit code: ${steps.dbt_build.outputs.exitCode}"
      echo "dbt run results: ${steps.dbt_build.outputs.runResultsPath}"
    depends: dbt_build
```

`projectDir` must point to the directory containing `dbt_project.yml` on the worker that runs the action. Packaged actions run in their own action workspace, so use absolute paths or paths that are meaningful on that worker.

Use `requirements` for pip-compatible dbt packages. The default is `dbt-core`, but most projects should pin an adapter package such as `dbt-duckdb==1.10.1`, `dbt-postgres==1.9.0`, or the adapter version used by your project.

Supported commands include `build`, `run`, `test`, `seed`, `snapshot`, `compile`, `deps`, `debug`, `parse`, `list`, `ls`, `show`, `run-operation`, `source freshness`, `docs generate`, and `clean`. Use `args` for command-specific flags that do not have a first-class input.

## Inputs

| Field | Description |
|-------|-------------|
| `projectDir` | Required directory containing `dbt_project.yml`. |
| `command` | dbt command to run. Defaults to `build`. |
| `requirements` | Pip requirement specifiers installed with `uv run --with`. Defaults to `["dbt-core"]`. |
| `profilesDir` | Optional directory containing `profiles.yml`. |
| `profile` / `target` | Optional dbt profile and target names. |
| `select` / `exclude` | Repeated dbt selection and exclusion arguments. |
| `selector` | YAML selector name passed with `--selector`. |
| `vars` | Value passed with `--vars`; objects are encoded as compact JSON. |
| `threads` | Thread count passed with `--threads`. |
| `state` | State directory passed with `--state`. |
| `targetPath` / `logPath` | Directories passed with `--target-path` and `--log-path`. |
| `fullRefresh`, `failFast`, `warnError`, `defer`, `quiet` | Boolean dbt flags. |
| `args` | Additional raw dbt CLI arguments appended after structured options. |
| `env` | Extra environment variables exposed to the dbt process. |
| `pythonVersion` | Python version used by uv. Defaults to `3.13.9`. |
| `timeoutSeconds` | Timeout for the dbt process. Defaults to `3600`. |

## Outputs

| Field | Description |
|-------|-------------|
| `ok` | `true` when dbt exits with code 0. |
| `exitCode` | dbt process exit code. |
| `command` | Full argv used to invoke dbt through uv. |
| `stdout` / `stderr` | Captured dbt stdout and stderr. |
| `durationMs` | Wrapper-measured dbt process duration in milliseconds. |
| `targetPath` / `logPath` | Effective dbt target and log paths. |
| `manifestPath` | Present when `manifest.json` exists under `targetPath`. |
| `runResultsPath` | Present when `run_results.json` exists under `targetPath`. |
| `catalogPath` | Present when `catalog.json` exists under `targetPath`. |
| `sourcesPath` | Present when `sources.json` exists under `targetPath`. |
| `error` | Validation or wrapper error object when dbt does not start. |

## Related

- [Official Dagu Actions](/dagu-actions/official)
- [Action Package Execution](/dagu-actions/execution-model)
