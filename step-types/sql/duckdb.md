# DuckDB

Execute analytical queries and data operations against DuckDB databases. DuckDB is useful for local OLAP workflows, file-backed analytics, and transformations that should run inside the workflow without a separate database server.

## Basic Usage

```yaml
steps:
  - id: query_orders
    action: duckdb.query
    with:
      dsn: "./analytics.duckdb"
      query: |
        SELECT customer_id, sum(total) AS total_spend
        FROM orders
        GROUP BY customer_id
        ORDER BY total_spend DESC
    output: CUSTOMER_TOTALS
```

::: tip Output Destination
Query results are written to **stdout** by default in JSONL format. Use `output: VAR_NAME` for small results that need to become an environment variable. For large results, use `streaming: true` with an explicit `output_file`.
:::

## Database Path

### File Database

Use a file path when multiple steps need to read or write the same DuckDB database:

```yaml
with:
  dsn: "./data/warehouse.duckdb"
```

The path is resolved by the step process. Use an absolute path or a path relative to the step working directory when the workflow may run on different workers.

### In-Memory Database

```yaml
with:
  dsn: ":memory:"
```

An in-memory DuckDB database is scoped to the step execution. Use a file database when tables must persist across steps.

## Build Support

::: info Native DuckDB Support
The DuckDB action depends on DuckDB native bindings. On builds where those bindings are unavailable or cgo is disabled, `duckdb.query` and `duckdb.import` fail at runtime with a clear unsupported-platform error.
:::

## Configuration

```yaml
steps:
  - id: query
    action: duckdb.query
    with:
      dsn: "./analytics.duckdb"
      timeout: 60
      output_format: jsonl
      max_rows: 10000
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `dsn` | string | required | DuckDB database path, or `:memory:` |
| `timeout` | int | 60 | Query timeout in seconds |
| `transaction` | bool | false | Wrap execution in a transaction |
| `params` | map/array | - | Query parameters |
| `output_format` | string | jsonl | `jsonl`, `json`, `csv` |
| `headers` | bool | false | Include headers in CSV output |
| `null_string` | string | null | NULL representation |
| `max_rows` | int | 0 | Limit rows returned by a query (0 = unlimited) |
| `streaming` | bool | false | Stream query results to a file |
| `output_file` | string | - | Explicit output path for streaming results |

## Parameterized Queries

### Named Parameters

Use `:name` syntax for named parameters:

```yaml
steps:
  - id: sales_by_region
    action: duckdb.query
    with:
      dsn: "./analytics.duckdb"
      params:
        region: apac
        min_total: 1000
      query: |
        SELECT order_id, customer_id, total
        FROM orders
        WHERE region = :region AND total >= :min_total
```

### Positional Parameters

DuckDB uses `?` for positional parameters:

```yaml
steps:
  - id: customer_orders
    action: duckdb.query
    with:
      dsn: "./analytics.duckdb"
      params:
        - 42
        - shipped
      query: "SELECT * FROM orders WHERE customer_id = ? AND status = ?"
```

## Transactions

```yaml
steps:
  - id: refresh_summary
    action: duckdb.query
    with:
      dsn: "./analytics.duckdb"
      transaction: true
      query: |
        DELETE FROM daily_summary WHERE date = current_date;
        INSERT INTO daily_summary
        SELECT current_date, count(*), sum(total)
        FROM orders
        WHERE order_date = current_date;
```

DuckDB does not support PostgreSQL advisory locks or SQLite file lock configuration through the SQL action.

## Data Import

Create the target table before importing data. `duckdb.import` supports CSV, TSV, and JSONL input.

### CSV Import

```yaml
steps:
  - id: import_orders
    action: duckdb.import
    with:
      dsn: "./analytics.duckdb"
      import:
        input_file: /data/orders.csv
        table: orders
        format: csv
        has_header: true
        batch_size: 1000
```

### TSV Import

```yaml
steps:
  - id: import_products
    action: duckdb.import
    with:
      dsn: "./analytics.duckdb"
      import:
        input_file: /data/products.tsv
        table: products
        format: tsv
        has_header: true
```

### JSONL Import

```yaml
steps:
  - id: import_events
    action: duckdb.import
    with:
      dsn: "./analytics.duckdb"
      import:
        input_file: /data/events.jsonl
        table: events
        format: jsonl
        batch_size: 5000
```

### Import with Conflict Handling

DuckDB supports SQLite-style conflict handling:

```yaml
steps:
  - id: upsert_orders
    action: duckdb.import
    with:
      dsn: "./analytics.duckdb"
      import:
        input_file: /data/order-updates.csv
        table: orders
        on_conflict: replace
```

| on_conflict | DuckDB Behavior |
|-------------|-----------------|
| `error` | Fail on duplicate (default) |
| `ignore` | `INSERT OR IGNORE` - skip duplicates |
| `replace` | `INSERT OR REPLACE` - replace existing rows |

`conflict_target` and `update_columns` are PostgreSQL-specific and are not used by DuckDB.

## Output Formats

### JSONL (Default)

One JSON object per row:

```yaml
steps:
  - id: export_jsonl
    action: duckdb.query
    with:
      dsn: "./analytics.duckdb"
      output_format: jsonl
      query: "SELECT * FROM orders"
```

Output:

```
{"order_id":1,"customer_id":42,"total":99.99}
{"order_id":2,"customer_id":43,"total":149.99}
```

### JSON Array

```yaml
steps:
  - id: export_json
    action: duckdb.query
    with:
      dsn: "./analytics.duckdb"
      output_format: json
      max_rows: 1000
      query: "SELECT * FROM orders"
```

::: warning Memory Usage
The `json` format buffers all rows in memory before writing. For large result sets, use `jsonl` or `csv` instead.
:::

### CSV

```yaml
steps:
  - id: export_csv
    action: duckdb.query
    with:
      dsn: "./analytics.duckdb"
      output_format: csv
      headers: true
      query: "SELECT order_id, customer_id, total FROM orders"
```

## Streaming Large Results

For large result sets, stream directly to a file:

```yaml
steps:
  - id: export_large_report
    action: duckdb.query
    with:
      dsn: "./analytics.duckdb"
      streaming: true
      output_file: "${DAG_RUN_ARTIFACTS_DIR}/orders.jsonl"
      output_format: jsonl
      query: "SELECT * FROM orders"
```

::: tip Best Practices for Large Results
- Use `output_format: jsonl` or `csv`; these formats write rows as they are read.
- Avoid `output_format: json` for large exports because it buffers the full result.
- Set `max_rows` as a safety limit for broad queries.
- `output_file` is an explicit target path. Existing files at that path can be replaced, so prefer run-scoped paths such as `${DAG_RUN_ARTIFACTS_DIR}/orders.jsonl`.
:::

## Complete Example

```yaml
name: duckdb-local-analytics
env:
  - DB_PATH: "./data/analytics.duckdb"

steps:
  - id: setup_schema
    action: duckdb.query
    with:
      dsn: "${DB_PATH}"
      query: |
        CREATE TABLE IF NOT EXISTS orders (
          order_id INTEGER PRIMARY KEY,
          customer_id INTEGER,
          region TEXT,
          total DOUBLE,
          order_date DATE
        );

  - id: import_orders
    action: duckdb.import
    with:
      dsn: "${DB_PATH}"
      import:
        input_file: /data/orders.csv
        table: orders
        format: csv
        has_header: true
        on_conflict: replace
    depends:
      - setup_schema

  - id: export_region_summary
    action: duckdb.query
    with:
      dsn: "${DB_PATH}"
      streaming: true
      output_file: "${DAG_RUN_ARTIFACTS_DIR}/region-summary.csv"
      output_format: csv
      headers: true
      query: |
        SELECT region, count(*) AS order_count, sum(total) AS revenue
        FROM orders
        GROUP BY region
        ORDER BY revenue DESC;
    depends:
      - import_orders
```

## See Also

- [ETL Overview](/step-types/sql/) - Common configuration and features
- [PostgreSQL](/step-types/sql/postgresql) - PostgreSQL-specific documentation
- [SQLite](/step-types/sql/sqlite) - SQLite-specific documentation
- [Artifacts](/writing-workflows/artifacts) - Persisting run-scoped output files
