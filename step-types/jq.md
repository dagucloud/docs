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
