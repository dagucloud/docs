# MCP Tools

Dagu intentionally exposes three MCP tools.

| Tool | Purpose |
|------|---------|
| `dagu_read` | Read DAG specs, DAG details, DAG-run details, logs, list views, and Dagu MCP reference resources. |
| `dagu_change` | Validate and optionally apply a DAG YAML upsert. |
| `dagu_execute` | Start, enqueue, retry, or stop DAG runs. |

## `dagu_read`

Use `dagu_read` for current Dagu state.

| Input | Values |
|-------|--------|
| `target` | `dags`, `dag`, `dag_spec`, `runs`, `run`, `run_logs`, or `reference` |
| `name` | DAG name for DAG and run targets |
| `dagRunId` | DAG-run ID for run and log targets |
| `query` | URL query string for list and log targets, such as `page=1&perPage=100` or `tail=100` |
| `uri` | Direct resource URI, such as `dagu://reference/authoring` |

Examples:

```json
{ "target": "dags", "query": "page=1&perPage=100" }
```

```json
{ "target": "dag_spec", "name": "nightly-report" }
```

```json
{ "uri": "dagu://runs/nightly-report/latest/logs?tail=100" }
```

## `dagu_change`

Use `dagu_change` for DAG YAML edits. The only current change type is `upsert_dag`.

| Input | Values |
|-------|--------|
| `mode` | `preview` or `apply`; defaults to `preview` |
| `type` | `upsert_dag`; defaults to `upsert_dag` |
| `name` | DAG name to create or update |
| `spec` | Full DAG YAML specification |

Preview validates the spec without writing it:

```json
{
  "mode": "preview",
  "type": "upsert_dag",
  "name": "nightly-report",
  "spec": "steps:\n  - name: hello\n    command: echo hello\n"
}
```

Apply writes only after validation succeeds:

```json
{
  "mode": "apply",
  "type": "upsert_dag",
  "name": "nightly-report",
  "spec": "steps:\n  - name: hello\n    command: echo hello\n"
}
```

## `dagu_execute`

Use `dagu_execute` for run control.

| Input | Values |
|-------|--------|
| `action` | `start`, `enqueue`, `retry`, or `stop` |
| `targetType` | `dag`, `inline_spec`, or `run`; inferred when omitted |
| `name` | DAG name or optional inline spec name |
| `spec` | Inline DAG YAML for `start` or `enqueue` with `targetType=inline_spec` |
| `dagRunId` | Run ID override for start/enqueue, or target run for retry/stop |
| `params` | Runtime parameters as a JSON string |
| `queue` | Queue override for `enqueue` |
| `singleton` | Prevent duplicate running or queued runs when supported |
| `labels` | Labels as `key=value` or key-only strings |
| `stepName` | Optional step name for retry |

Start a stored DAG:

```json
{ "action": "start", "targetType": "dag", "name": "nightly-report" }
```

Enqueue a stored DAG:

```json
{ "action": "enqueue", "name": "nightly-report", "queue": "default" }
```

Retry a run:

```json
{ "action": "retry", "name": "nightly-report", "dagRunId": "20260522T010000" }
```

Stop a run:

```json
{ "action": "stop", "name": "nightly-report", "dagRunId": "20260522T010000" }
```

When a run can be identified, `dagu_execute` returns resource links for run details and logs. Clients that support subscriptions can subscribe to the returned run resource.

`dagu_execute` can start or enqueue a root DAG containing human tasks, locally or on a distributed worker, but it cannot complete a waiting human task. Use the [Web UI](/writing-workflows/human-tasks#web-ui), [REST API](/web-ui/api#human-task-endpoints), or local [`dagu human-task complete`](/getting-started/cli#human-task-complete) command. Human-task completion is not available through MCP, including `dagu_execute` retry or stop actions.
