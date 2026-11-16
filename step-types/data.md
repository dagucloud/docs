# Data

Convert and select small structured values across JSON, YAML, CSV, TSV, and text without spawning a shell.

`action: data.convert` reads inline data or a file, converts it, and publishes the result for later steps.

`action: data.pick` reads inline data or a file, selects a value with a jq-style path, and writes the selected value to stdout.

`action: data.filter` keeps the rows of a list that meet conditions on their values as written, such as `4,280万円` or `昭和58年5月`, then sorts and limits them. See [Filtering Rows](#filtering-rows).

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
```

The result contains:

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

### `data.filter`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `from` | string | Yes | Input format: `json`, `yaml`, `csv`, `tsv`, or `text`. |
| `data` | any | One of `data` or `input` | Inline rows to filter. |
| `input` | string | One of `data` or `input` | File path to read. Relative paths resolve against the step working directory. |
| `where` | object | Yes | Each field of a row to its [condition](#conditions). A row passes when every condition holds. |
| `select` | string | No | jq-style path to the list of rows, such as `.items`, when the input is an object. |
| `sort` | string or array | No | Fields to order the kept rows by. `-` before a field sorts it descending. |
| `limit` | integer | No | Most rows to keep after sorting. `0`, the default, keeps every row. |
| `to` | string | No | Output format: `json`, `yaml`, `csv`, `tsv`, or `text`. Defaults to `json`. |
| `has_header`, `columns`, `delimiter` | | No | CSV/TSV input options, as for `data.convert`. |

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
    output: USERS

  - id: first_name
    action: data.pick
    with:
      from: json
      select: '.[0].name'
      data: ${USERS}
      raw: true
    depends: users
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

## Filtering Rows

Rows that a [browser](/step-types/browser) or [computer](/step-types/computer) extract reads keep their values as the page wrote them. `data.filter` reads those values directly, so the conditions need no parsing code:

```yaml
params:
  - MAX_PRICE: 70000000
  - AREAS: ""

steps:
  - id: keep
    action: data.filter
    with:
      from: json
      data:
        - {name: Tenma, price: "4,280万円", built: "1983年5月", address: 大阪市北区}
        - {name: Umeda, price: "1億2,000万円", built: "2008年1月", address: 大阪市北区}
        - {name: Juso, price: "3,200万円", built: "1979年3月", address: 大阪市淀川区}
        - {name: Tenroku, price: "価格未定", built: "昭和60年4月", address: 大阪市北区}
      where:
        price: {max: "${params.MAX_PRICE}"}
        built: {from: "1981-06"}
        address: {any: "${params.AREAS}"}
      sort: -price
      limit: 20
    output: KEPT
```

Only `Tenma` is kept. `Umeda` is over the price, `Juso` was built before June 1981, and `Tenroku` has no price that reads as a number. `AREAS` is empty, so `address` has no condition until the parameter is set.

### Conditions

Each field takes one kind of condition:

| Condition | The value reads as | Holds when |
|-----------|--------------------|------------|
| `min`, `max` | The first number in it, with 万 and 億 applied, commas dropped, and full-width digits folded. `4,280万円` reads as `42800000`, and `徒歩4分` as `4`. | The number is within the bounds, inclusive. |
| `from`, `to` | The first date in it: `2026/11/12`, `2026-11-12`, `1983年5月`, a Japanese era date such as `昭和58年5月`, or a year. | The date is within the bounds, inclusive at the precision written. `to: 2025-03` runs to the end of March. |
| `within` | A date, as for `from` and `to`. | The date is no more than that many days before the day the step runs: `7d`, `2w`, or `7`. |
| `is` | Text, with full-width letters and digits folded. | The text equals the value. |
| `any` | Text, as for `is`. | The text contains one of the words. |
| `none` | Text, as for `is`. | The text contains none of the words. |

- A row whose value does not read as its condition's kind is left out. stderr reports `data.filter: kept N of M rows`, and for each field that left rows out, how many and one such value.
- A bound that is empty, null, or an empty list sets no limit, and a field whose bounds are all empty has no condition. A parameter that defaults to `""` filters nothing until it is set.
- `any` and `none` take a list, or a text whose commas (`,` or `、`) separate the words, so a parameter holding `北区,中央区` matches either.
- A bound that does not read as its kind fails validation and names the field. A bound from a reference is read when the step runs, and fails the step the same way.
- `sort` compares each field as its condition reads it, or else as the kind most of its values read as. Values that do not read as that kind come last in either direction.

## Size Guidance

`data.convert` is intended for small values and step outputs. For large CSV files, use `postgres.import`, `sqlite.import`, or the official [`duckdb@v1` action](/step-types/sql/duckdb) with DuckDB SQL such as `read_csv_auto`.
