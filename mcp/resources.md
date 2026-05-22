# MCP Resources

Dagu exposes MCP resources for DAG specs, DAG-run details, run logs, and built-in references.

## Resource URIs

| URI | MIME type | Description |
|-----|-----------|-------------|
| `dagu://reference/authoring` | `text/markdown` | Guidance for writing and editing Dagu DAG YAML through MCP. |
| `dagu://reference/tools` | `text/markdown` | Compact tool reference for `dagu_read`, `dagu_change`, and `dagu_execute`. |
| `dagu://reference/notifications` | `text/markdown` | How run-completion notifications work over MCP resources. |
| `dagu://dags/{name}/spec` | `application/yaml` | Current YAML spec for a DAG. |
| `dagu://runs/{name}/{dagRunId}` | `application/json` | Current DAG-run details. |
| `dagu://runs/{name}/{dagRunId}/logs` | `application/json` | DAG-run logs. |

Use `dagu_read` with a `uri` to read any resource directly:

```json
{ "uri": "dagu://reference/tools" }
```

```json
{ "uri": "dagu://dags/nightly-report/spec" }
```

Log resources accept query parameters supported by Dagu's log readers, such as `tail=100`:

```text
dagu://runs/nightly-report/20260522T010000/logs?tail=100
```

## Run Subscriptions

`dagu_execute` returns run and log resource links when a run can be identified.

Clients that support MCP resource subscriptions can subscribe to:

```text
dagu://runs/{name}/{dagRunId}
```

Dagu sends a resource update notification when the run reaches a terminal state:

- `success`
- `failed`
- `aborted`
- `partial success`
- `rejected`

Clients without resource subscription support should poll `dagu_read` with `target=run` and the same `name` and `dagRunId`.

## Built-in Prompts

Dagu also exposes MCP prompts for common workflows:

| Prompt | Arguments | Purpose |
|--------|-----------|---------|
| `dagu_create_dag` | `goal` | Draft, validate, and apply a new DAG using Dagu's compact MCP tool surface. |
| `dagu_edit_dag` | `name`, `change` | Read an existing DAG spec, make a scoped edit, preview validation, then apply. |
| `dagu_debug_failed_run` | `name`, `dagRunId` | Read a run and logs, explain the likely failure, then offer retry or stop when appropriate. |
