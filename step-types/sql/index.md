# ETL & SQL

Execute SQL queries and data operations directly in your workflows.

PostgreSQL and SQLite are built-in SQL step types. DuckDB is available as the official [`duckdb@v1` action](/step-types/sql/duckdb), which keeps the Dagu core binary portable and cgo-free.

## Supported Databases

| Database | Action | Description |
|----------|--------|-------------|
| [PostgreSQL](/step-types/sql/postgresql) | `postgres.query`, `postgres.import` | Full-featured PostgreSQL support with advisory locks |
| [SQLite](/step-types/sql/sqlite) | `sqlite.query`, `sqlite.import` | Lightweight embedded database with file locking |
| [DuckDB](/step-types/sql/duckdb) | `duckdb@v1` official action | Embedded analytical database for local OLAP workflows |

## Basic Usage

```yaml
secrets:
  - name: DB_PASSWORD
    provider: env           # Read from environment variable
    key: POSTGRES_PASSWORD  # Source variable name

steps:
  - id: query_users
    action: postgres.query
    with:
      dsn: "postgres://user:${env.DB_PASSWORD}@localhost:5432/mydb"
      query: "SELECT id, name, email FROM users WHERE active = true"
    output: USERS  # Capture results to variable
```

::: tip Output Destination
Query results are written to **stdout** by default. Use `output: VAR_NAME` to capture small results into an environment variable for use in subsequent steps. For large results, use `streaming: true` with `output_file` to write directly to a file. When `output_file` references `${context.paths.artifacts_dir}`, artifact storage is auto-enabled and the file appears as a run artifact.
:::

Use `postgres.query` or `sqlite.query` for built-in SQL queries. Use `postgres.import` or `sqlite.import` to load CSV, TSV, or JSONL files into a table.

Use `action: duckdb@v1` for DuckDB. DuckDB imports and exports are expressed with DuckDB SQL such as `read_csv_auto`, `read_json_auto`, `read_parquet`, and `COPY`.

::: info Secrets
Secrets are automatically masked in logs. Use `provider: file` for Kubernetes/Docker secrets. See [Secrets](/writing-workflows/secrets) for details.
:::

## Key Features

- **Parameterized queries** - Prevent SQL injection with named or positional parameters
- **Transactions** - Wrap operations in transactions with configurable isolation levels
- **Data import** - Import CSV, TSV, or JSONL files into database tables
- **Output formats** - Export results as JSONL, JSON, or CSV
- **Streaming** - Handle large result sets by streaming to explicit files
- **Locking** - Advisory locks (PostgreSQL) and file locks (SQLite) for distributed workflows

## Configuration Reference

### Connection

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `dsn` | string | required | Database connection string |

::: info Connection Pooling
Connection pooling is **not configurable per-step**:
- **Non-worker mode**: Uses fixed defaults (1 connection per step)
- **Worker mode** (shared-nothing): Managed by global pool configuration at the worker level

For distributed workers running multiple concurrent DAGs, configure PostgreSQL connection pooling via [`worker.postgres_pool`](/server-admin/distributed/workers/shared-nothing#postgresql-connection-pool-management) to prevent connection exhaustion.
:::

### Execution

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `timeout` | int | 60 | Query timeout in seconds |
| `transaction` | bool | false | Wrap in transaction |
| `isolation_level` | string | - | `default`, `read_committed`, `repeatable_read`, `serializable` |
| `params` | map/array | - | Query parameters |

### Output

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `output_format` | string | jsonl | `jsonl`, `json`, `csv` |
| `headers` | bool | false | Include headers in CSV |
| `null_string` | string | null | NULL representation |
| `max_rows` | int | 0 | Limit rows (0 = unlimited) |
| `streaming` | bool | false | Stream to file |
| `output_file` | string | - | Explicit output path for streaming results |

### Locking

| Field | Type | Description |
|-------|------|-------------|
| `advisory_lock` | string | Named lock (PostgreSQL only) |
| `file_lock` | bool | File locking (SQLite only) |

## Data Import

Import data from files into database tables:

```yaml
secrets:
  - name: DB_PASSWORD
    provider: env
    key: POSTGRES_PASSWORD

steps:
  - id: import_csv
    action: postgres.import
    with:
      dsn: "postgres://user:${env.DB_PASSWORD}@localhost:5432/mydb"
      import:
        input_file: /data/users.csv
        table: users
        format: csv
        has_header: true
        batch_size: 1000
```

### Import Configuration

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `input_file` | string | required | Source file path |
| `table` | string | required | Target table name |
| `format` | string | auto-detect | `csv`, `tsv`, `jsonl` (detected from file extension) |
| `has_header` | bool | true | First row is header |
| `delimiter` | string | `,` | Field delimiter |
| `columns` | []string | - | Explicit column names |
| `null_values` | []string | `["", "NULL", "null", "\\N"]` | Values treated as NULL |
| `batch_size` | int | 1000 | Rows per INSERT |
| `on_conflict` | string | error | `error`, `ignore`, `replace` |
| `conflict_target` | string | - | Column(s) for conflict detection (PostgreSQL UPSERT) |
| `update_columns` | []string | - | Columns to update on conflict |
| `skip_rows` | int | 0 | Skip N data rows |
| `max_rows` | int | 0 | Limit rows (0 = unlimited) |
| `dry_run` | bool | false | Validate without importing |

## Parameterized Queries

Use named parameters for SQL injection prevention:

```yaml
steps:
  - id: safe_query
    action: postgres.query
    with:
      dsn: "${env.DATABASE_URL}"
      params:
        status: active
        min_age: 18
      query: |
        SELECT * FROM users
        WHERE status = :status AND age >= :min_age
```

Or positional parameters:

```yaml
steps:
  - id: safe_query
    action: sqlite.query
    with:
      dsn: "file:./app.db"
      params:
        - active
        - 18
      query: "SELECT * FROM users WHERE status = ? AND age >= ?"
```

## Transactions

Wrap multiple statements in a transaction:

```yaml
steps:
  - id: transfer_funds
    action: postgres.query
    with:
      dsn: "${env.DATABASE_URL}"
      transaction: true
      isolation_level: serializable
      query: |
        UPDATE accounts SET balance = balance - 100 WHERE id = 1;
        UPDATE accounts SET balance = balance + 100 WHERE id = 2;
```

## Output Formats

### JSONL (default)

One JSON object per line, ideal for streaming:

```yaml
steps:
  - id: export_jsonl
    action: postgres.query
    with:
      dsn: "${env.DATABASE_URL}"
      output_format: jsonl
      query: "SELECT * FROM orders"
```

Output:
```
{"id":1,"product":"Widget","price":9.99}
{"id":2,"product":"Gadget","price":19.99}
```

### JSON

Array of objects:

```yaml
steps:
  - id: export_json
    action: postgres.query
    with:
      dsn: "${env.DATABASE_URL}"
      output_format: json
      query: "SELECT * FROM orders"
```

::: warning Memory Usage
The `json` format buffers ALL rows in memory before writing. For large result sets, use `jsonl` or `csv` instead to stream rows one at a time. Using `json` with millions of rows can cause out-of-memory errors.
:::

### CSV

Tabular format with optional headers:

```yaml
steps:
  - id: export_csv
    action: postgres.query
    with:
      dsn: "${env.DATABASE_URL}"
      output_format: csv
      headers: true
      query: "SELECT * FROM orders"
```

## Streaming Large Results

For large result sets, stream directly to a file:

```yaml
steps:
  - id: export_large_table
    action: postgres.query
    with:
      dsn: "${env.DATABASE_URL}"
      streaming: true
      output_file: "${context.paths.artifacts_dir}/export.jsonl"
      output_format: jsonl    # Use jsonl or csv for streaming
      query: "SELECT * FROM large_table"
```

::: tip Best Practices for Large Results
- Use `output_format: jsonl` or `csv` - these formats stream rows immediately
- Avoid `output_format: json` - it buffers all rows in memory before writing
- Set `max_rows` as a safety limit for unbounded queries
- Use `streaming: true` with `output_file` to write directly to disk
- `output_file` is an explicit target path. Existing files at that path can be replaced, so prefer run-scoped paths such as `${context.paths.artifacts_dir}/export.jsonl`; this reference auto-enables artifact storage.
:::

## Error Handling

```yaml
steps:
  - id: query_with_retry
    action: postgres.query
    with:
      dsn: "${env.DATABASE_URL}"
      timeout: 30
      query: "SELECT * FROM orders"
    retry_policy:
      limit: 3
      interval_sec: 5
    continue_on:
      failure: true
```

## Fan-Out: Running Across Multiple Databases

To run the same query or migration across multiple databases in parallel, use `parallel.items` with a sub-DAG. Each database gets its own run with separate logs, status, and retry tracking.

```yaml
# migrate-tenants.yaml
steps:
  - name: migrate-all-tenants
    parallel:
      items:
        - tenant_a
        - tenant_b
        - tenant_c
      max_concurrent: 2
    action: dag.run
    with:
      dag: run-migration
      params:
        SCHEMA: ${ITEM}
---
name: run-migration

params:
  - SCHEMA: ""

steps:
  - name: migrate
    action: postgres.query
    with:
      dsn: "${env.DATABASE_URL}"
      transaction: true
      query: |
        SET search_path TO ${params.SCHEMA};
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
```

For different DSNs per tenant, pass the selected DSN string as the item value:

```yaml
steps:
  - name: migrate-all-tenants
    parallel:
      items:
        - postgres://tenant_a:secret@db-a.example.com/app
        - postgres://tenant_b:secret@db-b.example.com/app
      max_concurrent: 2
    action: dag.run
    with:
      dag: run-migration
      params:
        DSN: ${ITEM}
---
name: run-migration

params:
  - DSN: ""

steps:
  - name: migrate
    action: postgres.query
    with:
      dsn: "${params.DSN}"
      transaction: true
      query: |
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
```

See [parallel.items](/writing-workflows/execution-control#parallel-execution) for full fan-out options.

## See Also

- [PostgreSQL](/step-types/sql/postgresql) - PostgreSQL-specific features
- [SQLite](/step-types/sql/sqlite) - SQLite-specific features
- [DuckDB](/step-types/sql/duckdb) - Official DuckDB action
