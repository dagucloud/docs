# ETL & SQL

Execute SQL queries and data operations directly in your workflows.

## Supported Databases

| Database | Executor Type | Description |
|----------|---------------|-------------|
| [PostgreSQL](/features/etl/postgresql) | `postgres` | Full-featured PostgreSQL support with advisory locks |
| [SQLite](/features/etl/sqlite) | `sqlite` | Lightweight embedded database with file locking |

## Basic Usage

```yaml
secrets:
  - name: DB_PASSWORD
    provider: env           # Read from environment variable
    key: POSTGRES_PASSWORD  # Source variable name

steps:
  - name: query-users
    type: postgres
    config:
      dsn: "postgres://user:${DB_PASSWORD}@localhost:5432/mydb"
    command: "SELECT id, name, email FROM users WHERE active = true"
    output: USERS  # Capture results to variable
```

::: tip Output Destination
Query results are written to **stdout** by default. Use `output: VAR_NAME` to capture results into an environment variable for use in subsequent steps. For large results, use `streaming: true` with `outputFile` to write directly to a file.
:::

::: info Secrets
Secrets are automatically masked in logs. Use `provider: file` for Kubernetes/Docker secrets. See [Secrets](/writing-workflows/secrets) for details.
:::

## Key Features

- **Parameterized queries** - Prevent SQL injection with named or positional parameters
- **Transactions** - Wrap operations in transactions with configurable isolation levels
- **Data import** - Import CSV, TSV, or JSONL files into database tables
- **Output formats** - Export results as JSONL, JSON, or CSV
- **Streaming** - Handle large result sets by streaming to files
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

For distributed workers running multiple concurrent DAGs, configure PostgreSQL connection pooling via [`worker.postgresPool`](/features/workers/shared-nothing#postgresql-connection-pool-management) to prevent connection exhaustion.
:::

### Execution

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `timeout` | int | 60 | Query timeout in seconds |
| `transaction` | bool | false | Wrap in transaction |
| `isolationLevel` | string | - | `default`, `read_committed`, `repeatable_read`, `serializable` |
| `params` | map/array | - | Query parameters |

### Output

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `outputFormat` | string | jsonl | `jsonl`, `json`, `csv` |
| `headers` | bool | false | Include headers in CSV |
| `nullString` | string | null | NULL representation |
| `maxRows` | int | 0 | Limit rows (0 = unlimited) |
| `streaming` | bool | false | Stream to file |
| `outputFile` | string | - | Output file path |

### Locking

| Field | Type | Description |
|-------|------|-------------|
| `advisoryLock` | string | Named lock (PostgreSQL only) |
| `fileLock` | bool | File locking (SQLite only) |

## Data Import

Import data from files into database tables:

```yaml
secrets:
  - name: DB_PASSWORD
    provider: env
    key: POSTGRES_PASSWORD

steps:
  - name: import-csv
    type: postgres
    config:
      dsn: "postgres://user:${DB_PASSWORD}@localhost:5432/mydb"
      import:
        inputFile: /data/users.csv
        table: users
        format: csv
        hasHeader: true
        batchSize: 1000
```

### Import Configuration

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `inputFile` | string | required | Source file path |
| `table` | string | required | Target table name |
| `format` | string | auto-detect | `csv`, `tsv`, `jsonl` (detected from file extension) |
| `hasHeader` | bool | true | First row is header |
| `delimiter` | string | `,` | Field delimiter |
| `columns` | []string | - | Explicit column names |
| `nullValues` | []string | `["", "NULL", "null", "\\N"]` | Values treated as NULL |
| `batchSize` | int | 1000 | Rows per INSERT |
| `onConflict` | string | error | `error`, `ignore`, `replace` |
| `conflictTarget` | string | - | Column(s) for conflict detection (PostgreSQL UPSERT) |
| `updateColumns` | []string | - | Columns to update on conflict |
| `skipRows` | int | 0 | Skip N data rows |
| `maxRows` | int | 0 | Limit rows (0 = unlimited) |
| `dryRun` | bool | false | Validate without importing |

## Parameterized Queries

Use named parameters for SQL injection prevention:

```yaml
steps:
  - name: safe-query
    type: postgres
    config:
      dsn: "${DATABASE_URL}"
      params:
        status: active
        min_age: 18
    command: |
      SELECT * FROM users
      WHERE status = :status AND age >= :min_age
```

Or positional parameters:

```yaml
steps:
  - name: safe-query
    type: sqlite
    config:
      dsn: "file:./app.db"
      params:
        - active
        - 18
    command: "SELECT * FROM users WHERE status = ? AND age >= ?"
```

## Transactions

Wrap multiple statements in a transaction:

```yaml
steps:
  - name: transfer-funds
    type: postgres
    config:
      dsn: "${DATABASE_URL}"
      transaction: true
      isolationLevel: serializable
    command: |
      UPDATE accounts SET balance = balance - 100 WHERE id = 1;
      UPDATE accounts SET balance = balance + 100 WHERE id = 2;
```

## Output Formats

### JSONL (default)

One JSON object per line, ideal for streaming:

```yaml
steps:
  - name: export-jsonl
    type: postgres
    config:
      dsn: "${DATABASE_URL}"
      outputFormat: jsonl
    command: "SELECT * FROM orders"
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
  - name: export-json
    type: postgres
    config:
      dsn: "${DATABASE_URL}"
      outputFormat: json
    command: "SELECT * FROM orders"
```

::: warning Memory Usage
The `json` format buffers ALL rows in memory before writing. For large result sets, use `jsonl` or `csv` instead to stream rows one at a time. Using `json` with millions of rows can cause out-of-memory errors.
:::

### CSV

Tabular format with optional headers:

```yaml
steps:
  - name: export-csv
    type: postgres
    config:
      dsn: "${DATABASE_URL}"
      outputFormat: csv
      headers: true
    command: "SELECT * FROM orders"
```

## Streaming Large Results

For large result sets, stream directly to a file:

```yaml
steps:
  - name: export-large-table
    type: postgres
    config:
      dsn: "${DATABASE_URL}"
      streaming: true
      outputFile: /data/export.jsonl
      outputFormat: jsonl    # Use jsonl or csv for streaming
    command: "SELECT * FROM large_table"
```

::: tip Best Practices for Large Results
- Use `outputFormat: jsonl` or `csv` - these formats stream rows immediately
- Avoid `outputFormat: json` - it buffers all rows in memory before writing
- Set `maxRows` as a safety limit for unbounded queries
- Use `streaming: true` with `outputFile` to write directly to disk
:::

## Error Handling

```yaml
steps:
  - name: query-with-retry
    type: postgres
    config:
      dsn: "${DATABASE_URL}"
      timeout: 30
    command: "SELECT * FROM orders"
    retryPolicy:
      limit: 3
      intervalSec: 5
    continueOn:
      failure: true
```

## See Also

- [PostgreSQL](/features/etl/postgresql) - PostgreSQL-specific features
- [SQLite](/features/etl/sqlite) - SQLite-specific features
