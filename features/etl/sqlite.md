# SQLite

Execute queries and data operations against SQLite databases. Uses a pure Go SQLite implementation with no external dependencies.

## Basic Usage

```yaml
steps:
  - name: query-data
    type: sqlite
    config:
      dsn: "file:./data.db"
    command: "SELECT * FROM users"
```

## Connection String

SQLite supports file-based and in-memory databases:

### File Database

```yaml
config:
  dsn: "file:./myapp.db"
```

Or with options:

```yaml
config:
  dsn: "file:./myapp.db?mode=rw&cache=shared"
```

| Parameter | Description |
|-----------|-------------|
| `mode` | `ro` (read-only), `rw` (read-write), `rwc` (read-write-create), `memory` |
| `cache` | `shared` (shared cache), `private` (private cache) |

### In-Memory Database

```yaml
config:
  dsn: ":memory:"
```

::: tip In-Memory Database Sharing
By default, `:memory:` databases are ephemeral and not shared between steps. To share an in-memory database across steps within the same DAG run, use `sharedMemory: true`:

```yaml
config:
  dsn: ":memory:"
  sharedMemory: true  # Enables shared cache mode
```

This converts the DSN to `file::memory:?cache=shared` internally. For persistent storage, use file databases.
:::

## Configuration

```yaml
steps:
  - name: query
    type: sqlite
    config:
      dsn: "file:./app.db"
      timeout: 30           # Query timeout in seconds
      maxOpenConns: 1       # SQLite works best with 1 connection
      maxIdleConns: 1
      sharedMemory: false   # Set true for :memory: databases to share across steps
```

::: tip
SQLite handles concurrency at the database level. For best performance, use `maxOpenConns: 1` to avoid lock contention.
:::

## Default Pragmas

The SQLite driver automatically configures these pragmas for robustness:

```sql
PRAGMA foreign_keys = ON;    -- Enable foreign key enforcement
PRAGMA busy_timeout = 5000;  -- Wait up to 5 seconds if database is locked
```

## Parameterized Queries

### Named Parameters

Use `:name` syntax for named parameters:

```yaml
steps:
  - name: find-user
    type: sqlite
    config:
      dsn: "file:./app.db"
      params:
        status: active
        role: admin
    command: |
      SELECT * FROM users
      WHERE status = :status AND role = :role
```

### Positional Parameters

SQLite uses `?` for positional parameters:

```yaml
steps:
  - name: find-user
    type: sqlite
    config:
      dsn: "file:./app.db"
      params:
        - active
        - admin
    command: "SELECT * FROM users WHERE status = ? AND role = ?"
```

## Transactions

```yaml
steps:
  - name: batch-update
    type: sqlite
    config:
      dsn: "file:./app.db"
      transaction: true
    command: |
      UPDATE users SET last_seen = datetime('now') WHERE id = 1;
      UPDATE users SET login_count = login_count + 1 WHERE id = 1;
      INSERT INTO activity_log (user_id, action) VALUES (1, 'login');
```

## File Locking

For exclusive access to the database file, use file locking:

```yaml
steps:
  - name: exclusive-operation
    type: sqlite
    config:
      dsn: "file:./shared.db"
      fileLock: true
    command: |
      DELETE FROM cache WHERE expires_at < datetime('now');
      VACUUM;
```

::: tip
File locking creates a `.lock` file next to the database (e.g., `shared.db.lock`) and uses OS-level locking to ensure only one process can access the database at a time.
:::

### Distributed Workflow Example

```yaml
name: cache-cleanup
steps:
  - name: cleanup-expired
    type: sqlite
    config:
      dsn: "file:/shared/cache.db"
      fileLock: true
      transaction: true
    command: |
      -- Safe to run from multiple workers
      DELETE FROM cache WHERE expires_at < datetime('now');
      DELETE FROM sessions WHERE last_activity < datetime('now', '-1 day');
```

## Data Import

### CSV Import

```yaml
steps:
  - name: import-products
    type: sqlite
    config:
      dsn: "file:./inventory.db"
      import:
        inputFile: /data/products.csv
        table: products
        format: csv
        hasHeader: true
        batchSize: 500
```

### JSONL Import

```yaml
steps:
  - name: import-events
    type: sqlite
    config:
      dsn: "file:./events.db"
      import:
        inputFile: /data/events.jsonl
        table: events
        format: jsonl
```

### Import with Conflict Handling

SQLite supports `INSERT OR IGNORE` and `INSERT OR REPLACE`:

```yaml
steps:
  - name: upsert-data
    type: sqlite
    config:
      dsn: "file:./app.db"
      import:
        inputFile: /data/updates.csv
        table: products
        onConflict: replace  # Uses INSERT OR REPLACE
```

| onConflict | SQLite Behavior |
|------------|-----------------|
| `error` | Fail on duplicate (default) |
| `ignore` | `INSERT OR IGNORE` - skip duplicates |
| `replace` | `INSERT OR REPLACE` - update existing rows |

::: tip
Unlike PostgreSQL where `replace` uses `ON CONFLICT DO NOTHING`, SQLite's `replace` truly replaces existing rows using `INSERT OR REPLACE`.
:::

## Output Formats

### JSONL (Streaming)

```yaml
steps:
  - name: export-jsonl
    type: sqlite
    config:
      dsn: "file:./app.db"
      outputFormat: jsonl
    command: "SELECT * FROM products"
```

Output:
```
{"id":1,"name":"Widget","price":9.99}
{"id":2,"name":"Gadget","price":19.99}
```

### JSON Array

```yaml
steps:
  - name: export-json
    type: sqlite
    config:
      dsn: "file:./app.db"
      outputFormat: json
    command: "SELECT * FROM products"
```

### CSV

```yaml
steps:
  - name: export-csv
    type: sqlite
    config:
      dsn: "file:./app.db"
      outputFormat: csv
      headers: true
    command: "SELECT id, name, price FROM products"
```

## Streaming Large Results

```yaml
steps:
  - name: export-logs
    type: sqlite
    config:
      dsn: "file:./logs.db"
      streaming: true
      outputFile: /data/logs-export.jsonl
    command: "SELECT * FROM logs WHERE date >= date('now', '-7 days')"
```

## Multiple Statements

```yaml
steps:
  - name: setup-database
    type: sqlite
    config:
      dsn: "file:./app.db"
    command: |
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        expires_at DATETIME NOT NULL
      );
```

## SQLite Functions

SQLite provides many built-in functions:

```yaml
steps:
  - name: aggregate-data
    type: sqlite
    config:
      dsn: "file:./sales.db"
    command: |
      SELECT
        date(created_at) as sale_date,
        count(*) as order_count,
        sum(total) as revenue,
        avg(total) as avg_order,
        group_concat(product_name, ', ') as products
      FROM orders
      WHERE created_at >= date('now', '-30 days')
      GROUP BY date(created_at)
      ORDER BY sale_date DESC
```

## Error Handling

```yaml
steps:
  - name: safe-query
    type: sqlite
    config:
      dsn: "file:./app.db"
      timeout: 30
    command: "SELECT * FROM large_table"
    retryPolicy:
      limit: 3
      intervalSec: 2
    continueOn:
      failure: true
```

## Complete Example

```yaml
name: local-data-pipeline
env:
  - DB_PATH: "./data/analytics.db"

steps:
  - name: setup-schema
    type: sqlite
    config:
      dsn: "file:${DB_PATH}"
    command: |
      CREATE TABLE IF NOT EXISTS raw_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        payload TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS daily_stats (
        date TEXT PRIMARY KEY,
        event_count INTEGER,
        unique_types INTEGER
      );

  - name: import-events
    type: sqlite
    config:
      dsn: "file:${DB_PATH}"
      import:
        inputFile: /data/events-${TODAY}.jsonl
        table: raw_events
        format: jsonl
        batchSize: 1000
    depends:
      - setup-schema

  - name: calculate-stats
    type: sqlite
    config:
      dsn: "file:${DB_PATH}"
      fileLock: true
      transaction: true
    command: |
      INSERT OR REPLACE INTO daily_stats (date, event_count, unique_types)
      SELECT
        date(created_at) as date,
        count(*) as event_count,
        count(DISTINCT event_type) as unique_types
      FROM raw_events
      WHERE date(created_at) = date('now')
      GROUP BY date(created_at);
    depends:
      - import-events

  - name: export-report
    type: sqlite
    config:
      dsn: "file:${DB_PATH}"
      streaming: true
      outputFile: /reports/daily-stats.json
      outputFormat: json
    command: |
      SELECT * FROM daily_stats
      ORDER BY date DESC
      LIMIT 30
    depends:
      - calculate-stats
```

## See Also

- [ETL Overview](/features/etl/) - Common configuration and features
- [PostgreSQL](/features/etl/postgresql) - PostgreSQL-specific documentation
