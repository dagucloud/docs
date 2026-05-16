# MCP Server

Dagu exposes a built-in Model Context Protocol (MCP) server for external chat and agent clients. Use it when you want a chat app, coding assistant, or operations assistant to read DAG state, create or edit DAG YAML, run workflows, retry failed runs, stop active runs, and receive completion updates.

The MCP server is served by the same Dagu HTTP server as the Web UI. Clients do not need a local Dagu installation when they can reach the Dagu server endpoint.

## Endpoint

Start Dagu with the HTTP server enabled:

```bash
dagu start-all
```

Then configure your MCP client to use Streamable HTTP:

```text
http://localhost:8080/mcp
```

If `base_path` is configured, the endpoint is mounted under that base path:

```text
https://dagu.example.com/dagu/mcp
```

The MCP endpoint is not part of the REST API base path. Changing `api_base_path` does not move `/mcp`.

## Client Configuration

MCP client configuration formats vary. Use the client's HTTP or Streamable HTTP transport, set the URL to the Dagu MCP endpoint, and pass Dagu authentication credentials when authentication is enabled.

Generic example:

```json
{
  "mcpServers": {
    "dagu": {
      "type": "http",
      "url": "http://localhost:8080/mcp",
      "headers": {
        "Authorization": "Bearer dagu_your_api_key"
      }
    }
  }
}
```

For local development with `auth.mode: none`, no authorization header is required. For production, prefer a Dagu API key with the smallest role and workspace access needed by the client.

## Authentication And Permissions

The MCP endpoint uses the same Dagu server authentication stack as other protected streaming endpoints:

- `auth.mode: none` allows local unauthenticated access.
- `auth.mode: basic` accepts HTTP Basic authentication.
- `auth.mode: builtin` accepts JWT bearer tokens and Dagu API keys.

MCP operations delegate to Dagu's existing API layer. Existing role-based access, workspace access, and server permission settings still apply:

```yaml
permissions:
  write_dags: true
  run_dags: true
```

Set `write_dags: false` to prevent create/edit/delete operations. Set `run_dags: false` to prevent run control operations such as start, retry, and stop.

## Tools

Dagu intentionally exposes a compact MCP tool surface.

| Tool | Purpose |
|------|---------|
| `dagu_read` | Read DAG lists, DAG details, DAG specs, DAG-run lists, run details, logs, and Dagu MCP reference resources. |
| `dagu_change` | Validate and optionally apply a DAG YAML upsert. Defaults to preview mode. |
| `dagu_execute` | Start, enqueue, retry, or stop DAG-runs. |

### `dagu_read`

Use `dagu_read` before making changes or run-control decisions.

Common inputs:

| Field | Description |
|-------|-------------|
| `target` | One of `dags`, `dag`, `dag_spec`, `runs`, `run`, `run_logs`, or `reference`. |
| `name` | DAG name for DAG and run-specific targets. |
| `dagRunId` | DAG-run ID for `run` and `run_logs`. The value `latest` is accepted where Dagu accepts it. |
| `query` | Query string for list and log targets, such as `page=1&perPage=100` or `tail=100`. |
| `uri` | Direct MCP resource URI such as `dagu://reference/authoring`. |

Examples:

```json
{ "target": "dags", "query": "page=1&perPage=20" }
```

```json
{ "target": "dag_spec", "name": "daily-report" }
```

```json
{ "target": "run_logs", "name": "daily-report", "dagRunId": "latest", "query": "tail=200" }
```

### `dagu_change`

Use `dagu_change` to create or edit DAG YAML. The safe workflow is:

1. Call `dagu_change` with `mode: "preview"`.
2. Review validation results.
3. Call `dagu_change` with `mode: "apply"` only when the user intends to write the file.

Inputs:

| Field | Description |
|-------|-------------|
| `mode` | `preview` or `apply`. Defaults to `preview`. |
| `type` | Currently `upsert_dag`. |
| `name` | DAG name to create or update. |
| `spec` | Full DAG YAML spec. |

Example:

```json
{
  "mode": "preview",
  "type": "upsert_dag",
  "name": "hello",
  "spec": "steps:\n  - command: echo hello"
}
```

### `dagu_execute`

Use `dagu_execute` for run control. `retry` and `stop` are actions inside this tool, not separate tools.

Inputs:

| Field | Description |
|-------|-------------|
| `action` | `start`, `enqueue`, `retry`, or `stop`. |
| `targetType` | `dag`, `inline_spec`, or `run`. Defaults from the action and provided spec. |
| `name` | DAG name, or optional inline spec name. |
| `spec` | Inline DAG YAML for `start` or `enqueue` with `targetType: "inline_spec"`. |
| `dagRunId` | DAG-run ID for start/enqueue override, retry, and stop. |
| `params` | Runtime parameters as a JSON string. |
| `queue` | Queue override for `enqueue`. |
| `singleton` | Prevent duplicate running or queued DAG-runs when supported. |
| `labels` | Additional labels, each as `key=value` or `key`. |
| `stepName` | Optional step name for retry. |

Start a stored DAG:

```json
{
  "action": "start",
  "targetType": "dag",
  "name": "daily-report",
  "params": "{\"env\":\"prod\"}"
}
```

Enqueue an inline spec:

```json
{
  "action": "enqueue",
  "targetType": "inline_spec",
  "name": "ad-hoc-check",
  "spec": "steps:\n  - command: uptime",
  "queue": "default"
}
```

Retry a run:

```json
{
  "action": "retry",
  "name": "daily-report",
  "dagRunId": "20260101_120000"
}
```

Stop a run:

```json
{
  "action": "stop",
  "name": "daily-report",
  "dagRunId": "20260101_120000"
}
```

## Resources

Dagu exposes reference resources and live Dagu resources.

Reference resources:

| URI | Description |
|-----|-------------|
| `dagu://reference/authoring` | Guidance for writing and editing DAG YAML through MCP. |
| `dagu://reference/tools` | Tool surface reference. |
| `dagu://reference/notifications` | Completion notification guidance. |

Resource templates:

| URI template | Description |
|--------------|-------------|
| `dagu://dags/{name}/spec` | Current YAML spec for a DAG. |
| `dagu://runs/{name}/{dagRunId}` | DAG-run details as JSON. |
| `dagu://runs/{name}/{dagRunId}/logs` | DAG-run logs as JSON. Supports query parameters such as `tail=100`. |

## Completion Notifications

When `dagu_execute` can identify a run, it returns resource links for the run and logs. MCP clients that support resource subscriptions should subscribe to:

```text
dagu://runs/{name}/{dagRunId}
```

Dagu sends a resource update notification when the run reaches a terminal state: success, failed, aborted, partial success, or rejected.

Clients without resource subscription support should poll:

```json
{ "target": "run", "name": "daily-report", "dagRunId": "20260101_120000" }
```

## Prompts

Dagu also exposes prompt templates for clients that support MCP prompts:

| Prompt | Purpose |
|--------|---------|
| `dagu_create_dag` | Draft, validate, and apply a new DAG. |
| `dagu_edit_dag` | Read an existing DAG spec, make a scoped edit, preview, then apply. |
| `dagu_debug_failed_run` | Read a run and logs, explain the likely failure, and propose retry or stop when appropriate. |

## Operational Guidance

- Use `dagu start-all` when you want the MCP client to start and monitor real workflows from one local Dagu process.
- Use HTTPS for remote MCP clients.
- Prefer API keys over user session tokens for long-running external clients.
- Give MCP clients the narrowest Dagu role and workspace access that can complete their task.
- Keep `dagu_change` in preview mode unless the user explicitly asks to write.
- Subscribe to run resources when the client supports it; otherwise poll `dagu_read`.

## See Also

- [REST API](/overview/api)
- [API Keys](/server-admin/authentication/api-keys)
- [Server Configuration](/server-admin/server)
- [Steward](/features/agent/)
- [Workflow Operator](/features/bots/)
