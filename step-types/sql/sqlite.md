# SQLite

Execute queries and data operations against SQLite databases. Uses a pure Go SQLite implementation with no external dependencies.

## Basic Usage

```yaml
steps:
  - id: query_data
    type: sqlite
    with:
      dsn: "file:./data.db"
    command: "SELECT * FROM users"
    output: USERS  # Capture results to variable
```

::: tip Output Destination
Query results are written to **stdout** by default (JSONL format). Use `output: VAR_NAME` to capture results into an environment variable. For large results, use `streaming: true` with `output_file`.
:::

## Connection String

SQLite supports file-based and in-memory databases:

### File Database

```yaml
with:
  dsn: "file:./myapp.db"
```

Or with options:

```yaml
with:
  dsn: "file:./myapp.db?mode=rw&cache=shared"
```

| Parameter | Description |
|-----------|-------------|
| `mode` | `ro` (read-only), `rw` (read-write), `rwc` (read-write-create), `memory` |
| `cache` | `shared` (shared cache), `private` (private cache) |

### In-Memory Database

```yaml
with:
  dsn: ":memory:"
```

::: tip In-Memory Database Sharing
By default, `:memory:` databases are ephemeral and not shared between steps. To share an in-memory database across steps within the same DAG run, use `shared_memory: true`:

```yaml
with:
  dsn: ":memory:"
  shared_memory: true  # Enables shared cache mode
```

This converts the DSN to `file::memory:?cache=shared` internally. For persistent storage, use file databases.
:::

## Configuration

```yaml
steps:
  - id: query
    type: sqlite
    with:
      dsn: "file:./app.db"
      timeout: 30           # Query timeout in seconds
      shared_memory: false   # Set true for :memory: databases to share across steps
```

::: tip Connection Pooling
SQLite connection pooling is **not configurable**. Each step always uses **1 connection** (optimal for SQLite's locking model). Global pool management does not apply to SQLite, even in distributed worker mode.
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
  - id: find_user
    type: sqlite
    with:
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
  - id: find_user
    type: sqlite
    with:
      dsn: "file:./app.db"
      params:
        - active
        - admin
    command: "SELECT * FROM users WHERE status = ? AND role = ?"
```

## Transactions

```yaml
steps:
  - id: batch_update
    type: sqlite
    with:
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
  - id: exclusive_operation
    type: sqlite
    with:
      dsn: "file:./shared.db"
      file_lock: true
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
  - id: cleanup_expired
    type: sqlite
    with:
      dsn: "file:/shared/cache.db"
      file_lock: true
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
  - id: import_products
    type: sqlite
    with:
      dsn: "file:./inventory.db"
      import:
        input_file: /data/products.csv
        table: products
        format: csv
        has_header: true
        batch_size: 500
```

### JSONL Import

```yaml
steps:
  - id: import_events
    type: sqlite
    with:
      dsn: "file:./events.db"
      import:
        input_file: /data/events.jsonl
        table: events
        format: jsonl
```

### Import with Conflict Handling

SQLite supports `INSERT OR IGNORE` and `INSERT OR REPLACE`:

```yaml
steps:
  - id: upsert_data
    type: sqlite
    with:
      dsn: "file:./app.db"
      import:
        input_file: /data/updates.csv
        table: products
        on_conflict: replace  # Uses INSERT OR REPLACE
```

| on_conflict | SQLite Behavior |
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
  - id: export_jsonl
    type: sqlite
    with:
      dsn: "file:./app.db"
      output_format: jsonl
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
  - id: export_json
    type: sqlite
    with:
      dsn: "file:./app.db"
      output_format: json
    command: "SELECT * FROM products LIMIT 1000"
```

::: warning Memory Usage
The `json` format buffers ALL rows in memory before writing. For large result sets, use `jsonl` or `csv` instead. Always use `LIMIT` or `max_rows` with `json` format.
:::

### CSV

```yaml
steps:
  - id: export_csv
    type: sqlite
    with:
      dsn: "file:./app.db"
      output_format: csv
      headers: true
    command: "SELECT id, name, price FROM products"
```

## Streaming Large Results

```yaml
steps:
  - id: export_logs
    type: sqlite
    with:
      dsn: "file:./logs.db"
      streaming: true
      output_file: /data/logs-export.jsonl
      output_format: jsonl    # Use jsonl or csv for large results
    command: "SELECT * FROM logs WHERE date >= date('now', '-7 days')"
```

::: tip Best Practices for Large Results
- Use `output_format: jsonl` or `csv` - these formats stream rows immediately
- Avoid `output_format: json` - it buffers all rows in memory before writing
- Set `max_rows` as a safety limit for unbounded queries
:::

## Multiple Statements

```yaml
steps:
  - id: setup_database
    type: sqlite
    with:
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
  - id: aggregate_data
    type: sqlite
    with:
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
  - id: safe_query
    type: sqlite
    with:
      dsn: "file:./app.db"
      timeout: 30
    command: "SELECT * FROM large_table"
    retry_policy:
      limit: 3
      interval_sec: 2
    continue_on:
      failure: true
```

## Complete Example

```yaml
name: local-data-pipeline
env:
  - DB_PATH: "./data/analytics.db"

steps:
  - id: setup_schema
    type: sqlite
    with:
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

  - id: import_events
    type: sqlite
    with:
      dsn: "file:${DB_PATH}"
      import:
        input_file: /data/events-${TODAY}.jsonl
        table: raw_events
        format: jsonl
        batch_size: 1000
    depends:
      - setup_schema

  - id: calculate_stats
    type: sqlite
    with:
      dsn: "file:${DB_PATH}"
      file_lock: true
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
      - import_events

  - id: export_report
    type: sqlite
    with:
      dsn: "file:${DB_PATH}"
      streaming: true
      output_file: /reports/daily-stats.json
      output_format: json
    command: |
      SELECT * FROM daily_stats
      ORDER BY date DESC
      LIMIT 30
    depends:
      - calculate_stats
```

## See Also

- [ETL Overview](/step-types/sql/) - Common configuration and features
- [PostgreSQL](/step-types/sql/postgresql) - PostgreSQL-specific documentation
