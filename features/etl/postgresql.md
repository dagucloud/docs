# PostgreSQL

Execute queries and data operations against PostgreSQL databases.

## Basic Usage

```yaml
secrets:
  - name: DB_PASSWORD
    provider: env
    key: POSTGRES_PASSWORD

steps:
  - name: query-users
    type: postgres
    config:
      dsn: "postgres://user:${DB_PASSWORD}@localhost:5432/mydb"
    command: "SELECT id, name, email FROM users"
    output: USERS  # Capture results to variable
```

::: tip Output Destination
Query results are written to **stdout** by default (JSONL format). Use `output: VAR_NAME` to capture results into an environment variable. For large results, use `streaming: true` with `outputFile`.
:::

## Connection String

The DSN follows the PostgreSQL connection string format:

```
postgres://user:password@host:port/database?sslmode=disable
```

Common parameters:

| Parameter | Description |
|-----------|-------------|
| `sslmode` | `disable`, `require`, `verify-ca`, `verify-full` |
| `connect_timeout` | Connection timeout in seconds |
| `application_name` | Application identifier |

```yaml
config:
  dsn: "postgres://user:pass@db.example.com:5432/mydb?sslmode=require&connect_timeout=10"
```

## Configuration

```yaml
steps:
  - name: query
    type: postgres
    config:
      dsn: "${DATABASE_URL}"
      timeout: 30           # Query timeout in seconds
```

## Connection Pooling

PostgreSQL connection pooling is **not configurable per-step**. The behavior depends on the execution mode:

### Non-Worker Mode

When executing DAGs directly (not via distributed workers), each PostgreSQL step uses fixed connection defaults:
- Maximum open connections: **1**
- Maximum idle connections: **1**
- Connection max lifetime: **5 minutes**

This is optimal for isolated step execution where each step gets its own dedicated connection.

### Worker Mode (Shared-Nothing)

When running distributed workers in shared-nothing mode (with `worker.coordinators` configured), PostgreSQL steps use a **global connection pool** managed at the worker level.

This prevents connection exhaustion when multiple DAGs run concurrently in the same worker process. All PostgreSQL connections across all DAG executions share the pool.

**Configuration** is done via [`worker.postgresPool`](/features/workers/shared-nothing#postgresql-connection-pool-management):

```yaml
worker:
  postgresPool:
    maxOpenConns: 25       # Total connections across ALL PostgreSQL DSNs
    maxIdleConns: 5        # Idle connections per DSN
    connMaxLifetime: 300   # Connection lifetime in seconds
    connMaxIdleTime: 60    # Idle connection timeout in seconds
```

::: warning Connection Limits in Worker Mode
With many concurrent DAGs, configure `worker.postgresPool.maxOpenConns` based on your PostgreSQL server's `max_connections` setting. Consider the total: `number of workers × maxOpenConns`.

Example: 5 workers with `maxOpenConns: 25` = up to 125 connections to your PostgreSQL server.
:::

## Parameterized Queries

### Named Parameters

Use `:name` syntax for named parameters:

```yaml
steps:
  - name: find-user
    type: postgres
    config:
      dsn: "${DATABASE_URL}"
      params:
        email: "user@example.com"
        status: active
    command: |
      SELECT * FROM users
      WHERE email = :email AND status = :status
```

### Positional Parameters

PostgreSQL uses `$1`, `$2`, etc. for positional parameters:

```yaml
steps:
  - name: find-user
    type: postgres
    config:
      dsn: "${DATABASE_URL}"
      params:
        - "user@example.com"
        - active
    command: "SELECT * FROM users WHERE email = $1 AND status = $2"
```

## Transactions

### Basic Transaction

```yaml
steps:
  - name: transfer
    type: postgres
    config:
      dsn: "${DATABASE_URL}"
      transaction: true
    command: |
      UPDATE accounts SET balance = balance - 100 WHERE id = 1;
      UPDATE accounts SET balance = balance + 100 WHERE id = 2;
```

### Isolation Levels

Control transaction isolation for concurrent access:

```yaml
steps:
  - name: critical-update
    type: postgres
    config:
      dsn: "${DATABASE_URL}"
      transaction: true
      isolationLevel: serializable
    command: |
      SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;
      UPDATE accounts SET balance = balance - 100 WHERE id = 1;
```

| Level | Description |
|-------|-------------|
| `default` | Use database default |
| `read_committed` | See only committed data |
| `repeatable_read` | Consistent reads within transaction |
| `serializable` | Full isolation (may fail with conflicts) |

## Multiple Statements

Execute multiple SQL statements in a single step:

```yaml
steps:
  - name: setup-tables
    type: postgres
    config:
      dsn: "${DATABASE_URL}"
    command: |
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

      INSERT INTO users (name, email) VALUES ('Admin', 'admin@example.com')
      ON CONFLICT (email) DO NOTHING;
```

## Data Import

### CSV Import

```yaml
steps:
  - name: import-users
    type: postgres
    config:
      dsn: "${DATABASE_URL}"
      import:
        inputFile: /data/users.csv
        table: users
        format: csv
        hasHeader: true
        columns:
          - name
          - email
          - department
        batchSize: 1000
```

### JSONL Import

```yaml
steps:
  - name: import-events
    type: postgres
    config:
      dsn: "${DATABASE_URL}"
      import:
        inputFile: /data/events.jsonl
        table: events
        format: jsonl
        onConflict: ignore
```

::: tip PostgreSQL UPSERT
When using `onConflict: replace`, specify `conflictTarget` with the column(s) that have a unique constraint. This generates a proper `ON CONFLICT (column) DO UPDATE SET` statement. Without `conflictTarget`, `replace` falls back to `ON CONFLICT DO NOTHING`.

```yaml
import:
  inputFile: /data/users.csv
  table: users
  onConflict: replace
  conflictTarget: id          # Column with UNIQUE constraint
  updateColumns:              # Optional: specific columns to update
    - name
    - email
```
:::

### Import with NULL Handling

```yaml
steps:
  - name: import-with-nulls
    type: postgres
    config:
      dsn: "${DATABASE_URL}"
      import:
        inputFile: /data/records.csv
        table: records
        nullValues:
          - ""
          - "NULL"
          - "N/A"
          - "\\N"
```

### Dry Run Validation

Test import without writing data:

```yaml
steps:
  - name: validate-import
    type: postgres
    config:
      dsn: "${DATABASE_URL}"
      import:
        inputFile: /data/users.csv
        table: users
        dryRun: true
```

## Output Formats

### JSONL (Streaming)

```yaml
steps:
  - name: export-orders
    type: postgres
    config:
      dsn: "${DATABASE_URL}"
      outputFormat: jsonl
    command: "SELECT * FROM orders"
    output: ORDERS
```

Output:
```
{"id":1,"product":"Widget","total":99.99}
{"id":2,"product":"Gadget","total":149.99}
```

### JSON Array

```yaml
steps:
  - name: export-json
    type: postgres
    config:
      dsn: "${DATABASE_URL}"
      outputFormat: json
    command: "SELECT * FROM orders LIMIT 100"
```

::: warning Memory Usage
The `json` format buffers ALL rows in memory before writing. For large result sets, use `jsonl` or `csv` instead. Always use `LIMIT` or `maxRows` with `json` format.
:::

### CSV

```yaml
steps:
  - name: export-csv
    type: postgres
    config:
      dsn: "${DATABASE_URL}"
      outputFormat: csv
      headers: true
    command: "SELECT id, name, email FROM users"
```

## Streaming Large Results

For large datasets, stream directly to a file:

```yaml
steps:
  - name: export-all-orders
    type: postgres
    config:
      dsn: "${DATABASE_URL}"
      streaming: true
      outputFile: /data/orders-export.jsonl
      outputFormat: jsonl    # Use jsonl or csv for large results
    command: "SELECT * FROM orders"

  - name: process-export
    command: wc -l /data/orders-export.jsonl
    depends:
      - export-all-orders
```

## Advisory Locks

Prevent concurrent execution of critical operations across distributed workers:

```yaml
steps:
  - name: exclusive-job
    type: postgres
    config:
      dsn: "${DATABASE_URL}"
      advisoryLock: "daily-aggregation"
    command: |
      DELETE FROM daily_stats WHERE date = CURRENT_DATE;
      INSERT INTO daily_stats (date, total_orders, revenue)
      SELECT CURRENT_DATE, COUNT(*), SUM(total)
      FROM orders
      WHERE created_at >= CURRENT_DATE;
```

::: tip
Advisory locks are session-level and automatically released when the step completes or fails. The lock name is hashed to a 64-bit integer for PostgreSQL's `pg_advisory_lock()`.
:::

### Distributed Workflow Example

```yaml
name: distributed-etl
steps:
  - name: aggregate-region-data
    type: postgres
    config:
      dsn: "${DATABASE_URL}"
      advisoryLock: "etl-${REGION}"
      transaction: true
    command: |
      -- Only one worker per region can run this
      TRUNCATE TABLE region_summary_${REGION};
      INSERT INTO region_summary_${REGION}
      SELECT * FROM calculate_region_metrics('${REGION}');
```

## Error Handling

```yaml
steps:
  - name: resilient-query
    type: postgres
    config:
      dsn: "${DATABASE_URL}"
      timeout: 60
    command: "SELECT * FROM large_table"
    retryPolicy:
      limit: 3
      intervalSec: 10
    continueOn:
      failure: true
```

## Complete Example

```yaml
name: etl-pipeline
env:
  - DATABASE_URL: "postgres://etl:secret@db.example.com:5432/analytics"

steps:
  - name: acquire-lock
    type: postgres
    config:
      dsn: "${DATABASE_URL}"
      advisoryLock: "daily-etl"
      transaction: true
    command: |
      -- Clear staging table
      TRUNCATE TABLE staging_orders;

  - name: import-new-data
    type: postgres
    config:
      dsn: "${DATABASE_URL}"
      import:
        inputFile: /data/orders-${TODAY}.csv
        table: staging_orders
        hasHeader: true
        batchSize: 5000
    depends:
      - acquire-lock

  - name: transform-data
    type: postgres
    config:
      dsn: "${DATABASE_URL}"
      transaction: true
      isolationLevel: repeatable_read
    command: |
      INSERT INTO orders (id, customer_id, total, created_at)
      SELECT id, customer_id, total, created_at
      FROM staging_orders
      ON CONFLICT (id) DO UPDATE
      SET total = EXCLUDED.total,
          updated_at = NOW();
    depends:
      - import-new-data

  - name: generate-report
    type: postgres
    config:
      dsn: "${DATABASE_URL}"
      streaming: true
      outputFile: /reports/daily-summary.json
      outputFormat: json
    command: |
      SELECT
        DATE(created_at) as date,
        COUNT(*) as order_count,
        SUM(total) as revenue
      FROM orders
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    depends:
      - transform-data
```

## See Also

- [ETL Overview](/features/etl/) - Common configuration and features
- [SQLite](/features/etl/sqlite) - SQLite-specific documentation
