# DuckDB

Run DuckDB SQL from a workflow with the official `duckdb@v1` action.

DuckDB is packaged as an official action instead of a built-in SQL executor. This keeps the Dagu core binary portable and cgo-free while still letting workflows use a pinned DuckDB CLI through the action's own `tools` declaration. Dagu `tools` is powered internally by [aqua](https://github.com/aquaproj/aqua) from the [aquaproj](https://github.com/aquaproj) project.

::: info Official Action
Use `action: duckdb@v1`. Older built-in forms such as `duckdb.query` and `duckdb.import` are not part of the core SQL step types.
:::

## Basic Usage

```yaml
steps:
  - id: query
    action: duckdb@v1
    with:
      query: |
        SELECT 42 AS answer, 'duckdb' AS engine;

  - id: print_result
    run: printf '%s\n' '${steps.query.outputs.result}'
    depends: query
```

The default output format is DuckDB JSON mode, so `result` is a JSON string:

```json
[{"answer":42,"engine":"duckdb"}]
```

Use `${steps.query.outputs.result}` for small results such as counts, IDs, status rows, or compact JSON, replacing `query` with your step id. For large rowsets, write to an artifact or file instead of routing the data through action outputs.

## Existing DuckDB Files

Use `database` to run SQL against an existing DuckDB file:

```yaml
steps:
  - id: query_existing_db
    action: duckdb@v1
    with:
      database: /data/analytics.duckdb
      query: |
        SELECT count(*) AS users FROM users;
```

Use `workdir` when the database path or files referenced by SQL should be resolved relative to a directory:

```yaml
steps:
  - id: query_project_db
    action: duckdb@v1
    with:
      workdir: /data/project
      database: analytics.duckdb
      query: |
        SELECT * FROM read_csv_auto('events.csv') LIMIT 10;
```

The database file must exist on the worker that runs the action. In distributed shared-nothing mode, use a shared mount, object storage, or an absolute path available on that worker. Omitting `database` creates a transient in-memory database for that one action invocation, so it cannot share state with later steps.

Use `readonly: true` when a step should only inspect an existing database:

```yaml
steps:
  - id: inspect
    action: duckdb@v1
    with:
      database: /data/analytics.duckdb
      readonly: true
      query: |
        SELECT table_name
        FROM information_schema.tables
        ORDER BY table_name;
```

## Multiple Operations

For tightly coupled operations, run multiple SQL statements in one action. This keeps them in one DuckDB process and lets you control the transaction boundary:

```yaml
steps:
  - id: update_metrics
    action: duckdb@v1
    with:
      database: /data/analytics.duckdb
      query: |
        BEGIN TRANSACTION;

        CREATE TABLE IF NOT EXISTS metrics (
          name VARCHAR,
          value INTEGER
        );

        DELETE FROM metrics WHERE name = 'runs';
        INSERT INTO metrics VALUES ('runs', 1);

        COMMIT;

        SELECT * FROM metrics WHERE name = 'runs';
```

For separate DAG visibility, use multiple action steps against the same database file and connect them with `depends`:

```yaml
steps:
  - id: insert_rows
    action: duckdb@v1
    with:
      database: /data/analytics.duckdb
      query: |
        CREATE TABLE IF NOT EXISTS metrics (
          name VARCHAR,
          value INTEGER
        );

        DELETE FROM metrics WHERE name = 'jobs';
        INSERT INTO metrics VALUES ('jobs', 10);

  - id: update_rows
    action: duckdb@v1
    with:
      database: /data/analytics.duckdb
      query: |
        UPDATE metrics SET value = value + 5 WHERE name = 'jobs';
    depends: insert_rows

  - id: select_rows
    action: duckdb@v1
    with:
      database: /data/analytics.duckdb
      readonly: true
      query: |
        SELECT * FROM metrics WHERE name = 'jobs';
    depends: update_rows

  - id: print_result
    run: printf '%s\n' '${steps.select_rows.outputs.result}'
    depends: select_rows
```

Keep write operations ordered with `depends`. Parallel writes to the same DuckDB file can conflict because DuckDB uses file-level locking semantics.

## Import Data

Use DuckDB SQL functions such as `read_csv_auto`, `read_json_auto`, and `read_parquet` to load files.

Create or replace a table from CSV:

```yaml
steps:
  - id: import_orders
    action: duckdb@v1
    with:
      database: /data/analytics.duckdb
      query: |
        CREATE OR REPLACE TABLE orders AS
        SELECT *
        FROM read_csv_auto('/data/orders.csv');
```

Append rows from JSONL:

```yaml
steps:
  - id: append_events
    action: duckdb@v1
    with:
      database: /data/analytics.duckdb
      query: |
        INSERT INTO events
        SELECT *
        FROM read_json_auto('/data/events.jsonl');
```

Load one DuckDB database from another by using `ATTACH`:

```yaml
steps:
  - id: copy_between_databases
    action: duckdb@v1
    with:
      database: /data/target.duckdb
      query: |
        ATTACH '/data/source.duckdb' AS source_db;

        INSERT INTO target_table
        SELECT *
        FROM source_db.source_table;
```

## Export Data

For large or typed datasets, write files directly from SQL. When the target path is under `${context.paths.artifacts_dir}`, Dagu stores it as a run artifact.

```yaml
steps:
  - id: export_parquet
    action: duckdb@v1
    with:
      database: /data/analytics.duckdb
      query: |
        COPY (
          SELECT id, name, score
          FROM source_table
          WHERE score >= 80
        )
        TO '${context.paths.artifacts_dir}/exports/selected_rows.parquet'
        (FORMAT parquet);
```

You can load that file in a later step when the artifact directory is readable by the worker running the step:

```yaml
steps:
  - id: export_parquet
    action: duckdb@v1
    with:
      database: /data/source.duckdb
      query: |
        COPY (
          SELECT id, name, score
          FROM source_table
          WHERE score >= 80
        )
        TO '${context.paths.artifacts_dir}/exports/selected_rows.parquet'
        (FORMAT parquet);

  - id: insert_parquet
    action: duckdb@v1
    with:
      database: /data/target.duckdb
      query: |
        INSERT INTO target_table
        SELECT *
        FROM read_parquet('${context.paths.artifacts_dir}/exports/selected_rows.parquet');
    depends: export_parquet
```

In distributed shared-nothing mode, an artifact path may be worker-local while the run is still executing. For cross-worker data handoff, use a shared mounted path, object storage, or keep the transfer inside one DuckDB statement with `ATTACH` and `INSERT INTO ... SELECT`.

## Stdout Artifacts

If the query result should be stored as a file instead of action output, call the pinned DuckDB CLI directly and attach stdout to an artifact:

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

This keeps the CSV out of Dagu output variables while making it available in the run's Artifacts tab.

## Inputs

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `query` | string | Yes | - | SQL passed to `duckdb -c`. |
| `database` | string | No | transient in-memory database | Database file path. Use an absolute path when the file lives outside the action workspace. |
| `workdir` | string | No | action workspace | Directory to `cd` into before running DuckDB. Use this when SQL references local files with relative paths. |
| `format` | string | No | `json` | Output format: `json`, `csv`, `table`, `markdown`, `line`, `list`, or `column`. |
| `readonly` | boolean | No | `false` | Open the database in read-only mode. |

## Outputs

| Name | Type | Description |
|------|------|-------------|
| `result` | string | Raw DuckDB stdout in the selected format. |

## Local Development

Use `source:` to call a local checkout of the action:

```yaml
steps:
  - id: query
    action: source:file:///path/to/duckdb@local
    with:
      query: SELECT 1 AS ok;
```

Packaged actions run in their own action workspace. If a query needs files from a caller workspace, pass `workdir` and use paths that exist on the worker running the action.

## See Also

- [Official Actions](/dagu-actions/official) - Maintained `dagucloud/*` action packages
- [ETL Overview](/step-types/sql/) - Built-in PostgreSQL and SQLite step types
- [Artifacts](/writing-workflows/artifacts) - Persisting run-scoped output files
- [Tools](/writing-workflows/tools) - Pinned CLI tools for command steps
