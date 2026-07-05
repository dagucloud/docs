# Persistent State

Persistent state stores small JSON values that must survive across DAG runs. Use it for cursors, checkpoints, last-seen IDs, previous API responses, and simple change detection.

State is different from step outputs and artifacts:

| Mechanism | Lifetime | Best for |
|-----------|----------|----------|
| Step outputs | Current DAG run | Passing values between steps |
| DAG run outputs | Current DAG run history | Returning structured run results |
| Artifacts | Current DAG run history | Files, reports, logs, and large payloads |
| Persistent state | Across DAG runs | Cursors, checkpoints, and previous values |

Persistent state values are JSON. Each stored value is normalized before it is written, versioned, hashed, and limited to 1 MiB after normalization. Use artifacts or external storage for large documents or files.

## Quick Example

This workflow stores a cursor after each successful fetch. The next scheduled run reads the cursor before fetching again.

```yaml
schedule: "0 * * * *"

steps:
  - id: load_cursor
    action: state.get
    output: CURSOR
    with:
      key: cursors/feed
      default:
        last_id: 0

  - id: fetch
    run: |
      last_id="$(printf '%s\n' '${steps.load_cursor.outputs.value}' | jq -r .last_id)"
      ./fetch-feed --after "$last_id" > result.json
    depends: load_cursor

  - id: parse_last_id
    run: |
      printf 'last_id=%s\n' "$(jq -r '.last_id' result.json)" >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: last_id
    depends: fetch

  - id: save_cursor
    action: state.set
    with:
      key: cursors/feed
      value:
        last_id: "${steps.parse_last_id.outputs.last_id}"
    depends: parse_last_id
```

`state.get` publishes JSON, so later steps can reference the top-level value as `${steps.load_cursor.outputs.value}` and decode nested fields in the consuming command.

## Actions

### `state.get`

Reads one value.

```yaml
steps:
  - id: load
    action: state.get
    output: STATE
    with:
      key: cursors/feed
      default:
        last_id: 0
```

Fields:

| Field | Required | Description |
|-------|----------|-------------|
| `key` | yes | State key. May contain `/` for hierarchy, but not leading/trailing `/`, empty segments, `.`, `..`, or backslashes. |
| `default` | no | JSON value returned when the key is missing. |
| `required` | no | If `true`, fail when the key is missing instead of returning `found: false`. |
| `scope` | no | Scope. Defaults to `dag`. |
| `namespace` | no | Namespace override. Required when `scope: custom`. |

Output:

```json
{
  "operation": "get",
  "scope": "dag",
  "namespace": "feed-sync",
  "key": "cursors/feed",
  "found": true,
  "version": 1,
  "hash": "sha256...",
  "value": { "last_id": 123 }
}
```

When the key is missing, `found` is `false`; `value` is present only when `default` is configured.

### `state.set`

Creates or updates one value.

```yaml
steps:
  - action: state.set
    with:
      key: cursors/feed
      value:
        last_id: 123
```

Fields:

| Field | Required | Description |
|-------|----------|-------------|
| `key` | yes | State key. |
| `value` | yes | JSON-serializable value to store. |
| `expected_version` | no | Optimistic concurrency guard. The write fails if the stored version differs. Use `0` to require that the key does not exist. |
| `create_only` | no | If `true`, fail when the key already exists. |
| `scope` | no | Scope. Defaults to `dag`. |
| `namespace` | no | Namespace override. Required when `scope: custom`. |

Output:

```json
{
  "operation": "set",
  "scope": "dag",
  "namespace": "feed-sync",
  "key": "cursors/feed",
  "version": 2,
  "hash": "sha256...",
  "created": false
}
```

### `state.diff`

Compares a new JSON value with the stored value. By default it writes the new value when it changed.

```yaml
steps:
  - id: check_snapshot
    action: state.diff
    output: DIFF
    with:
      key: snapshots/feed
      value:
        count: "${params.COUNT}"
        checksum: "${params.CHECKSUM}"
```

Fields:

| Field | Required | Description |
|-------|----------|-------------|
| `key` | yes | State key. |
| `value` | yes | JSON-serializable value to compare. |
| `update` | no | Whether to write the new value when changed. Defaults to `true`. Set `false` for read-only comparison. |
| `expected_version` | no | Optimistic concurrency guard for the write. |
| `scope` | no | Scope. Defaults to `dag`. |
| `namespace` | no | Namespace override. Required when `scope: custom`. |

Output includes `changed`, `foundPrevious`, `current`, optional `previous`, and version/hash fields when a stored entry exists or is written.

```yaml
steps:
  - id: notify_if_changed
    run: ./notify.sh
    depends: check_snapshot
    preconditions:
      - condition: "${steps.check_snapshot.outputs.changed}"
        expected: "true"
```

### `state.delete`

Deletes one value.

```yaml
steps:
  - action: state.delete
    with:
      key: cursors/feed
```

Output:

```json
{
  "operation": "delete",
  "scope": "dag",
  "namespace": "feed-sync",
  "key": "cursors/feed",
  "deleted": true
}
```

`deleted` is `false` when the key did not exist.

### `state.list`

Lists entries in one scope and namespace.

```yaml
steps:
  - id: list_cursors
    action: state.list
    output: CURSORS
    with:
      prefix: cursors/
      limit: 20
      include_values: false
```

Fields:

| Field | Required | Description |
|-------|----------|-------------|
| `prefix` | no | Key prefix to list. |
| `limit` | no | Maximum entries to return. `0` means no limit. |
| `include_values` | no | Include each entry's `value` in the output. Defaults to `false`. |
| `scope` | no | Scope. Defaults to `dag`. |
| `namespace` | no | Namespace override. Required when `scope: custom`. |

By default, list output omits values and returns metadata only:

```json
{
  "operation": "list",
  "scope": "dag",
  "namespace": "feed-sync",
  "prefix": "cursors/",
  "entries": [
    {
      "scope": "dag",
      "namespace": "feed-sync",
      "key": "cursors/feed",
      "version": 2,
      "hash": "sha256...",
      "createdAt": "2026-05-25T10:00:00Z",
      "updatedAt": "2026-05-25T11:00:00Z"
    }
  ]
}
```

Set `include_values: true` when the workflow needs the stored JSON values.

## Scopes And Namespaces

Every state entry is identified by `scope`, `namespace`, and `key`.

| Scope | Default namespace | Use for |
|-------|-------------------|---------|
| `dag` | Current DAG name | Private state for one DAG. This is the default. |
| `root_dag` | Root DAG name | State shared by a root DAG and nested sub-DAGs. |
| `global` | `_` | Process-wide state that is intentionally shared. |
| `custom` | none | Explicit shared namespaces. `namespace` is required. |

Prefer `scope: custom` when multiple DAGs intentionally share a state contract:

```yaml
steps:
  - action: state.set
    with:
      scope: custom
      namespace: feed-pipeline-v1
      key: cursors/source-a
      value:
        last_id: 123
```

A DAG can also refer to another DAG's `dag` scope by setting `scope: dag` and `namespace` to that DAG name:

```yaml
steps:
  - action: state.get
    with:
      scope: dag
      namespace: upstream-dag
      key: cursors/feed
```

Use that form only when you intentionally want to couple to another DAG's private state. For new shared contracts, `scope: custom` is clearer and easier to rename independently from DAG files.

## Optimistic Concurrency

State entries have monotonically increasing versions. Use `expected_version` when two runs may update the same key at the same time.

```yaml
steps:
  - id: load
    action: state.get
    output: STATE
    with:
      key: counters/jobs
      required: true

  - id: save
    action: state.set
    with:
      key: counters/jobs
      expected_version: "${steps.load.outputs.version}"
      value:
        count: "${params.NEXT_COUNT}"
    depends: load
```

If the stored version changed between the read and the write, the write fails with a conflict. Handle that by retrying the step or designing the workflow so one run owns the key at a time. Use `expected_version: 0` when the write should only create a missing key.

## Storage Location

State is stored under `paths.dag_state_dir`.

```yaml
paths:
  dag_state_dir: /var/lib/dagu/dag-state
```

Environment variable:

```bash
export DAGU_DAG_STATE_DIR=/var/lib/dagu/dag-state
```

If omitted, Dagu derives it from the data directory:

```text
{paths.data_dir}/dag-state
```

See [Configuration](/server-admin/configuration#persistent-state-directory) for configuration precedence and path defaults.

The file-backed store is safe for concurrent local processes on the same filesystem. State record filenames are encoded so hierarchical keys, Windows-invalid characters, and case variants do not collide on disk.

## Distributed Execution

In distributed worker execution, workers access persistent state through the coordinator state RPCs. This keeps workers from creating separate local copies of the same logical state.

For shared filesystem deployments, make `paths.dag_state_dir` point at shared persistent storage if workers or coordinators can access state files directly.

For shared-nothing deployments, state is stored by the coordinator under its `paths.dag_state_dir`. State RPCs are routed deterministically by `scope` and `namespace`, so every worker uses the same coordinator for the same state keyspace. If you run multiple coordinators and need state to survive coordinator replacement, give each coordinator persistent storage for `paths.dag_state_dir` or use shared storage for that directory.

## Choosing Keys

Use stable, descriptive keys:

```text
cursors/feed-a
snapshots/daily-summary
locks/export-window
```

Avoid putting secrets in state. Values are persisted as local files and are intended for operational state, not secret storage. Use [Secrets](/writing-workflows/secrets) for credentials and tokens.

## Related

- [Data Flow](/writing-workflows/data-flow)
- [Artifacts](/writing-workflows/artifacts)
- [Durable Execution](/writing-workflows/durable-execution)
- [Distributed Workers](/server-admin/distributed/workers/)
