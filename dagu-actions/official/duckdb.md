# DuckDB (`duckdb@v1`)

Run DuckDB SQL from a Dagu workflow without adding DuckDB bindings to the Dagu core binary.

- Repository: [`dagucloud/duckdb`](https://github.com/dagucloud/duckdb)
- Runtime owned by the action: `duckdb/duckdb@v1.5.2` through action `tools`

Contributions are welcome. The repository is public, so improvements, bug reports, and pull requests can go to [`dagucloud/duckdb`](https://github.com/dagucloud/duckdb).

## Example

```yaml
steps:
  - id: query
    action: duckdb@v1
    with:
      query: |
        SELECT 42 AS answer, 'duckdb' AS engine;

  - id: print
    run: printf '%s\n' '${steps.query.outputs.result}'
    depends: query
```

`query` is passed to `duckdb -c`. By default, the action uses DuckDB JSON output mode and publishes raw stdout as `${steps.query.outputs.result}`, replacing `query` with your step id.

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

## Inputs

| Field | Description |
|-------|-------------|
| `query` | Required SQL passed to `duckdb -c`. |
| `database` | Optional DuckDB database file path. Omit for a transient in-memory database. |
| `workdir` | Optional directory to `cd` into before running DuckDB. |
| `format` | Output format: `json`, `csv`, `table`, `markdown`, `line`, `list`, or `column`. Defaults to `json`. |
| `readonly` | Open the database in read-only mode. Defaults to `false`. |

## Outputs

| Field | Description |
|-------|-------------|
| `result` | Raw DuckDB stdout in the selected format. |

Use action output only for small results. For large rowsets, write to a run artifact from SQL with `COPY ... TO '${context.paths.artifacts_dir}/...'`, or call the pinned DuckDB CLI directly and attach stdout with `stdout.artifact`. The CLI is pinned through Dagu `tools`, which is powered by aqua from the aquaproj project:

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

## Related

- [Official Dagu Actions](/dagu-actions/official)
- [Action Package Execution](/dagu-actions/execution-model)
