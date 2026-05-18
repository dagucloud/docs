# Data

Convert and select small structured values across JSON, YAML, CSV, TSV, and text without spawning a shell.

`action: data.convert` reads inline data or a file, converts it, and writes the result to stdout. Use `output:` to capture the converted value for later steps.

`action: data.pick` reads inline data or a file, selects a value with a jq-style path, and writes the selected value to stdout.

## Basic Usage

```yaml
steps:
  - id: users_json
    action: data.convert
    with:
      from: csv
      to: json
      data: |
        name,age
        Alice,30
        Bob,25
    output: USERS_JSON
```

`USERS_JSON` contains:

```json
[
  {
    "age": "30",
    "name": "Alice"
  },
  {
    "age": "25",
    "name": "Bob"
  }
]
```

## Configuration

### `data.convert`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `from` | string | Yes | Input format: `json`, `yaml`, `csv`, `tsv`, or `text`. |
| `to` | string | Yes | Output format: `json`, `yaml`, `csv`, `tsv`, or `text`. |
| `data` | any | One of `data` or `input` | Inline data to convert. |
| `input` | string | One of `data` or `input` | File path to read. Relative paths resolve against the step working directory. |
| `has_header` | boolean | No | Whether CSV/TSV input has a header row. Defaults to `true`. |
| `headers` | boolean | No | Include a header row for CSV/TSV output. Defaults to `true`. |
| `columns` | array | No | Column names for headerless CSV/TSV input or CSV/TSV output ordering. |
| `delimiter` | string | No | Single-character delimiter override. |

`data` and `input` are mutually exclusive.

### `data.pick`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `from` | string | Yes | Input format: `json`, `yaml`, `csv`, `tsv`, or `text`. |
| `select` | string | Yes | jq-style path to select, such as `.spec.image` or `.[0].name`. |
| `data` | any | One of `data` or `input` | Inline data to read. |
| `input` | string | One of `data` or `input` | File path to read. Relative paths resolve against the step working directory. |
| `raw` | boolean | No | Write selected scalar values without JSON/YAML encoding. |
| `to` | string | No | Output format: `json`, `yaml`, `csv`, `tsv`, or `text`. Defaults to `json` when `raw` is false. |
| `has_header` | boolean | No | Whether CSV/TSV input has a header row. Defaults to `true`. |
| `headers` | boolean | No | Include a header row for CSV/TSV output. Defaults to `true`. |
| `columns` | array | No | Column names for headerless CSV/TSV input or CSV/TSV output ordering. |
| `delimiter` | string | No | Single-character delimiter override. |

`raw` and `to` are mutually exclusive.

## CSV and TSV

CSV and TSV input with a header row becomes an array of objects:

```yaml
steps:
  - id: users
    action: data.convert
    with:
      from: csv
      to: yaml
      data: |
        name,role
        Alice,admin
        Bob,viewer
```

For headerless CSV, provide `columns` when you want objects:

```yaml
steps:
  - id: users
    action: data.convert
    with:
      from: csv
      to: json
      has_header: false
      columns: [name, age]
      data: |
        Alice,30
        Bob,25
```

Without `columns`, headerless CSV becomes an array of arrays.

## YAML to CSV

Use `columns` to make CSV column order deterministic:

```yaml
steps:
  - id: report
    action: data.convert
    with:
      from: yaml
      to: csv
      columns: [name, age]
      data: |
        - name: Alice
          age: 30
        - name: Bob
          age: 25
```

Output:

```csv
name,age
Alice,30
Bob,25
```

## Combining with jq

Use `data.convert` for format conversion and `data.pick` for simple selection:

```yaml
steps:
  - id: users
    action: data.convert
    with:
      from: csv
      to: json
      data: |
        name,age
        Alice,30
    output: USERS_JSON

  - id: first_name
    depends: [users]
    action: data.pick
    with:
      from: json
      select: '.[0].name'
      data: ${USERS_JSON}
      raw: true
    output: FIRST_NAME
```

Use `jq.filter` when you need full jq expressions such as filtering, grouping, or reshaping arrays.

## Picking from YAML

```yaml
steps:
  - id: image
    action: data.pick
    with:
      from: yaml
      select: .spec.containers[0].image
      raw: true
      data:
        spec:
          containers:
            - image: nginx:1.27
    output: IMAGE
```

## Size Guidance

`data.convert` is intended for small values and step outputs. For large CSV files, use `postgres.import`, `sqlite.import`, or the official [`duckdb@v1` action](/step-types/sql/duckdb) with DuckDB SQL such as `read_csv_auto`.
