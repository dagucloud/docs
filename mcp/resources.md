# MCP Resources

Dagu exposes MCP resources for DAG specs, Markdown Wiki pages, DAG-run details, scheduler and step logs, and built-in references.

## Resource URIs

| URI | MIME type | Description |
|-----|-----------|-------------|
| `dagu://reference` | `application/json` | Available built-in MCP reference resources. |
| `dagu://reference/authoring` | `text/markdown` | Guidance for writing and editing Dagu DAG YAML through MCP. |
| `dagu://reference/tools` | `text/markdown` | Compact tool reference for `dagu_read`, `dagu_change`, and `dagu_execute`. |
| `dagu://reference/read-tool` | `text/markdown` | Detailed `dagu_read` input, output, and error contract. |
| `dagu://reference/change-tool` | `text/markdown` | Detailed `dagu_change` preview and apply contract. |
| `dagu://reference/execute-tool` | `text/markdown` | Detailed `dagu_execute` input, output, and error contract. |
| `dagu://reference/apps` | `text/markdown` | Interactive run inspector behavior for MCP Apps hosts. |
| `dagu://reference/notifications` | `text/markdown` | How run-completion notifications work over MCP resources. |
| `dagu://dags` | `application/json` | DAG summaries visible to the caller. |
| `dagu://dags/{name}/spec` | `application/yaml` | Current YAML spec for a DAG. |
| `dagu://wiki` | `application/json` | Wiki page tree across accessible workspaces. |
| `dagu://wiki/{workspace}` | `application/json` | Wiki page tree for `default` or one named workspace. |
| `dagu://wiki/{workspace}/{path}` | `text/markdown` | Current Markdown content for one Wiki page. |
| `dagu://runs` | `application/json` | DAG-run summaries visible to the caller. |
| `dagu://runs/{name}/{dagRunId}` | `application/json` | Current DAG-run details. |
| `dagu://runs/{name}/{dagRunId}/logs` | `application/json` | Scheduler log and step log metadata. |
| `dagu://runs/{name}/{dagRunId}/steps/{stepName}/logs` | `application/json` | Standard output and standard error for one step. |
| `dagu://runs/{name}/{dagRunId}/sub/{subRunId}` | `application/json` | Current details for a child DAG run addressed under its root run. |
| `dagu://runs/{name}/{dagRunId}/sub/{subRunId}/steps/{stepName}/logs` | `application/json` | Standard output and standard error for one child-run step. |

Use `dagu_read` with a `uri` to read any resource directly:

```json
{ "uri": "dagu://reference/tools" }
```

```json
{ "uri": "dagu://dags/nightly-report/spec" }
```

Wiki page resources use an explicit workspace so an identical path in two workspaces is unambiguous. Encode a nested Wiki page path as one URI segment:

```text
dagu://wiki/operations/runbooks%2Frestart
```

The `dagu_read` list and search targets return these canonical URIs. `dagu://wiki` and workspace collection resources accept the same `page`, `perPage`, `flat`, `sort`, `order`, and `prefix` query parameters as `target=wiki`. Wiki page lists accept up to 200 entries per page.

The `dagu://docs` collection and page URIs remain available as deprecated exact aliases for existing MCP clients.

In tree mode, pagination selects direct children of the workspace or `prefix`; a returned directory still contains its descendants. In flat mode, pagination selects individual Wiki pages.

For example, this resource lists the newest individual Wiki pages below `runbooks` in the `operations` workspace:

```text
dagu://wiki/operations?prefix=runbooks&flat=true&sort=mtime&order=desc&perPage=20
```

Collection resources accept the same query parameters as their corresponding `dagu_read` list target. Log resources accept bounded query parameters supported by Dagu's log readers. Run logs support `tail` from 1 to 10000:

```text
dagu://runs/nightly-report/20260522T010000/logs?tail=100
```

Step logs support `tail`, `head`, `offset`, `limit`, and `stream=stdout|stderr`. Use at most one of `tail`, `head`, and `offset`; `limit` can be used alone or with `offset`, and by itself reads from the beginning. Without positioning parameters, the last 1000 lines are returned.

```text
dagu://runs/nightly-report/20260522T010000/steps/generate-report/logs?stream=stderr&offset=101&limit=200
```

Child runs are addressed beneath the root run that created them:

```text
dagu://runs/nightly-report/20260522T010000/sub/child-run-id
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

Dagu also notifies when the run stops at a waiting checkpoint, and keeps
watching the resource so the later terminal state is notified as well.

Clients without resource subscription support should poll `dagu_read` with `target=run` and the same `name` and `dagRunId`.

## MCP App Run Inspector

Hosts that support MCP Apps can render run-related `dagu_read` and `dagu_execute` results in an interactive inspector that shows run and step status, scheduler and per-step logs, and refresh, stop, and retry controls.

## Built-in Prompts

Dagu also exposes MCP prompts for common workflows:

| Prompt | Arguments | Purpose |
|--------|-----------|---------|
| `dagu_create_dag` | `goal` | Draft, validate, and apply a new DAG using Dagu's compact MCP tool surface. |
| `dagu_edit_dag` | `name`, `change` | Read an existing DAG spec, make a scoped edit, preview validation, then apply. |
| `dagu_create_wiki_page` | `workspace`, `path`, `goal` | Draft, preview, and create a Markdown Wiki page. |
| `dagu_edit_wiki_page` | `workspace`, `path`, `change` | Read a Markdown Wiki page, make a scoped edit, preview, then apply. |
| `dagu_debug_failed_run` | `name`, `dagRunId` | Read a run and logs, explain the likely failure, then offer retry or stop when appropriate. |

The deprecated `dagu_create_doc` and `dagu_edit_doc` prompts forward to their Wiki equivalents.
