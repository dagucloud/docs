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
| `duckdb@v1` | [`dagucloud/duckdb`](https://github.com/dagucloud/duckdb) | `duckdb/duckdb@v1.5.2` through action `tools` | You need analytical SQL or file-backed DuckDB workflows without adding DuckDB bindings to the Dagu core binary. |
| `node-script@v1` | [`dagucloud/node-script`](https://github.com/dagucloud/node-script) | `nodejs/node@v22.21.1` through action `tools` | You need a small JavaScript transform or glue step and want the action to provide Node.js. |
| `python-script@v1` | [`dagucloud/python-script`](https://github.com/dagucloud/python-script) | `astral-sh/uv@0.11.14` through action `tools`; default Python `3.13.9` | You need a small Python transform or glue step, optionally with pinned Python requirements. |

Official actions are not sandboxes. The action runs with the same worker permissions, filesystem access, network access, and secrets available to the Dagu run. Only run trusted code.

## DuckDB: `duckdb`

```yaml
steps:
  - id: query
    action: duckdb@v1
    with:
      query: |
        SELECT 42 AS answer, 'duckdb' AS engine;

  - id: print
    depends: [query]
    run: printf '%s\n' '${query.outputs.result}'
```

`query` is passed to `duckdb -c`. By default, the action uses DuckDB JSON output mode and publishes raw stdout as `${query.outputs.result}`, replacing `query` with your step id.

Use `database` to run against an existing file, `workdir` when SQL references files by relative path, and `readonly: true` for read-only inspection:

```yaml
steps:
  - id: summarize
    action: duckdb@v1
    with:
      workdir: /data/project
      database: analytics.duckdb
      readonly: true
      query: |
        SELECT count(*) AS events
        FROM read_csv_auto('events.csv');
```

Inputs include:

| Field | Description |
|-------|-------------|
| `query` | Required SQL passed to `duckdb -c`. |
| `database` | Optional DuckDB database file path. Omit for a transient in-memory database. |
| `workdir` | Optional directory to `cd` into before running DuckDB. |
| `format` | Output format: `json`, `csv`, `table`, `markdown`, `line`, `list`, or `column`. Defaults to `json`. |
| `readonly` | Open the database in read-only mode. Defaults to `false`. |

Outputs include:

| Field | Description |
|-------|-------------|
| `result` | Raw DuckDB stdout in the selected format. |

Use action output only for small results. For large rowsets, write to a run artifact from SQL with `COPY ... TO '${DAG_RUN_ARTIFACTS_DIR}/...'`, or call the pinned DuckDB CLI directly and attach stdout with `stdout.artifact`:

```yaml
tools:
  - duckdb/duckdb@v1.5.2

steps:
  - id: export_rows
    run: |
      duckdb -batch -bail -no-stdin -csv /data/source.duckdb \
        -c "SELECT id, name, score FROM source_table WHERE score >= 80"
    stdout:
      artifact: exports/selected_rows.csv
```

See [DuckDB](/step-types/sql/duckdb) for database-file handling, multi-step workflows, import/export examples, and artifact patterns.

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
