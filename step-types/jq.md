# JQ

Process and transform JSON data using jq.

## Basic Usage

```yaml
steps:
  - id: extract_field
    action: jq.filter
    with:
      filter: '.name'
      data: |
        {"name": "John Doe", "age": 30, "city": "New York"}
```

Output: `"John Doe"`

## Configuration

| Field | Description |
|-------|-------------|
| `filter` | jq expression to evaluate. Required. |
| `args` | Named jq variables. Values retain their YAML types. Supplying this map, including `{}`, makes `filter` literal jq source. |
| `raw` | Output raw strings without JSON encoding (like `jq -r`). Default: `false`. |
| `input` | File path to read JSON input from. Mutually exclusive with `data`. |
| `data` | Inline JSON value or file URL string to provide as jq input. Mutually exclusive with `input`. |

### Input Sources

The JQ executor accepts JSON input from one of three sources. Exactly one must be provided.

**Inline JSON via `with.data`**

```yaml
steps:
  - id: inline
    action: jq.filter
    with:
      filter: '.name'
      data: '{"name": "Alice"}'
```

**File path via `with.input`**

Read JSON from a file path. The path is evaluated at runtime, so declared step outputs work:

```yaml
steps:
  - id: producer
    run: |
      json_path="$DAG_RUN_WORK_DIR/items.json"
      printf '%s\n' '{"items": [{"name": "a"}, {"name": "b"}]}' > "$json_path"
      printf 'json_path=%s\n' "$json_path" >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: json_path

  - id: filter
    action: jq.filter
    with:
      raw: true
      input: "${steps.producer.outputs.json_path}"
      filter: '.items[] | .name'
    depends: producer
```

**File URL via `with.data`**

```yaml
steps:
  - id: producer
    run: |
      json_path="$DAG_RUN_WORK_DIR/items.json"
      printf '%s\n' '{"items": [{"name": "a"}, {"name": "b"}]}' > "$json_path"
      printf 'json_path=%s\n' "$json_path" >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: json_path

  - id: filter
    action: jq.filter
    with:
      raw: true
      filter: '.items[] | .name'
      data: "file://${steps.producer.outputs.json_path}"
    depends: producer
```

`with.input` and `with.data` are mutually exclusive. Setting both produces a validation error.

### Raw Output

By default, results are returned as pretty-printed JSON. Enable raw output
when you need jq's `-r` behavior (unquoted strings, numbers, booleans).

```yaml
steps:
  - id: list_addresses
    action: jq.filter
    with:
      raw: true
      filter: '.users[].email'
      data: |
        {
          "users": [
            {"email": "alice@example.com"},
            {"email": "bob@example.com"}
          ]
        }
```

Output:
```text
alice@example.com
bob@example.com
```

## Named Arguments

::: info Unreleased
Named arguments require a Dagu build containing PR #2782. This feature is not yet available on Dagu main.

https://github.com/dagucloud/dagu/pull/2782
:::

Use `with.args` to pass values into a filter as `$name` variables:

```yaml
steps:
  - id: filter
    action: jq.filter
    with:
      filter: '.items[] | select(. > $minimum)'
      data: {items: [1, 5, 10]}
      raw: true
      args:
        minimum: 4
```

Output:

```text
5
10
```

Arguments accept strings, numbers, booleans, null, objects, and arrays. Numeric
YAML values remain numbers; quoted numbers remain strings. Nested string values
can use Dagu references, just like other `with` values.

When `args` is present, the entire filter is literal jq source. Dagu does not
expand `$name` or `${...}` inside the filter, even inside jq strings. This also
applies to multiline filters and `args: {}`. Pass workflow values through `args`.
Steps that omit `args` keep their existing filter interpolation behavior.

Argument keys may include one leading `$`: `name` and `$name` both bind `$name`.
Supplying both is an error. Invalid jq variable names and references to undeclared
jq variables fail when the filter is compiled.

### Parameters and Environment Variables

String references remain strings after resolution. Convert numeric parameter,
environment, or captured-output values with `tonumber` before comparing them to
JSON numbers:

```yaml
params:
  - MIN_PRICE: '4'
env:
  CATEGORY: fruit
steps:
  - id: filter
    action: jq.filter
    with:
      filter: |
        .items[] |
        select(.price > ($min_price | tonumber) and .category == $category) |
        .name
      data:
        items:
          - {name: apple, price: 5, category: fruit}
          - {name: pear, price: 3, category: fruit}
          - {name: carrot, price: 8, category: vegetable}
      raw: true
      args:
        min_price: ${params.MIN_PRICE}
        category: ${env.CATEGORY}
```

Output: `apple`

To pass a literal dollar reference as an argument, escape its dollar sign:
`args: {text: '\$CATEGORY'}` passes the string `$CATEGORY`.

### Previous Step Output

```yaml
steps:
  - id: producer
    action: jq.filter
    with:
      filter: .minimum
      data: {minimum: 42}
      raw: true
    output: MINIMUM

  - id: filter
    depends: [producer]
    action: jq.filter
    with:
      filter: '.items[] | select(. > ($minimum | tonumber))'
      data: {items: [1, 5, 40, 50]}
      raw: true
      args:
        minimum: ${producer.output}
```

Output from `filter`: `50`

## Examples

### Transform Objects

```yaml
steps:
  - id: transform
    action: jq.filter
    with:
      filter: '{id: .user_id, name: (.first + " " + .last)}'
      data: |
        {"user_id": 123, "first": "John", "last": "Doe"}
```

### Filter Arrays

```yaml
steps:
  - id: filter_active
    action: jq.filter
    with:
      filter: '.users[] | select(.active) | .email'
      data: |
        {
          "users": [
            {"email": "alice@example.com", "active": true},
            {"email": "bob@example.com", "active": false},
            {"email": "carol@example.com", "active": true}
          ]
        }
```

### Process API Response

```yaml
steps:
  - id: fetch_data
    run: |
      response="$(curl -fsS https://api.example.com/products)"
      printf 'api_response=%s\n' "$response" >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: api_response
        type: json

  - id: extract_in_stock
    action: jq.filter
    with:
      filter: '.products | map(select(.inventory > 0) | {id, name, price})'
      data: ${steps.fetch_data.outputs.api_response}
    depends: fetch_data
```

### Aggregate Data

```yaml
steps:
  - id: sales_by_category
    action: jq.filter
    with:
      filter: |
        group_by(.category) |
        map({
          category: .[0].category,
          total: map(.amount) | add,
          count: length
        })
      data: |
        [
          {"category": "Electronics", "amount": 299.99},
          {"category": "Clothing", "amount": 49.99},
          {"category": "Electronics", "amount": 199.99}
        ]
```
