# MCP Tools

Dagu intentionally exposes three MCP tools.

| Tool | Purpose |
|------|---------|
| `dagu_read` | Read DAGs, Markdown Wiki pages, DAG runs, logs, list views, and Dagu MCP reference resources. |
| `dagu_change` | Preview or apply DAG YAML and workspace-aware Wiki page changes. |
| `dagu_execute` | Start, enqueue, retry, or stop DAG runs. |

## `dagu_read`

Use `dagu_read` for current Dagu state.

| Input | Values |
|-------|--------|
| `target` | `references`, `reference`, `dags`, `dag`, `dag_spec`, `dag_search`, `wiki`, `wiki_page`, `wiki_search`, `runs`, `run`, `run_logs`, or `step_log` |
| `name` | DAG name for DAG and run targets, or reference topic for `reference` |
| `dagRunId` | DAG-run ID for run and log targets |
| `subRunId` | Optional child DAG-run ID for `run` and `step_log`; `name` and `dagRunId` identify its root run |
| `stepName` | Step name for the `step_log` target |
| `query` | URL query string for list and log targets, such as `page=1&perPage=100` or `tail=100` |
| `workspace` | `all`, `default`, or a workspace name. Required for `wiki_page`; optional for `wiki`, `wiki_search`, and `dag_search`. |
| `path` | Wiki page path without `.md`; required for `wiki_page` |
| `search` | Search text; required for `wiki_search` and `dag_search` |
| `prefix` | Wiki page path prefix without `.md`; optional for `wiki` and `wiki_search` |
| `cursor` | Opaque cursor from the preceding `wiki_search` or `dag_search` result page |
| `limit` | Maximum search results from 1 to 50; defaults to 20 |
| `uri` | Direct resource URI, such as `dagu://reference/authoring` |

Examples:

```json
{ "target": "dags", "query": "page=1&perPage=100" }
```

```json
{ "target": "dag_spec", "name": "nightly-report" }
```

Search DAG definitions across accessible workspaces:

```json
{
  "target": "dag_search",
  "workspace": "all",
  "search": "warehouse_url",
  "limit": 20
}
```

Results contain matching line snippets and canonical DAG spec URIs. If `hasMore` is true, pass `nextCursor` as `cursor` in the next call and keep `search` and `workspace` unchanged.

List Wiki pages in one workspace:

```json
{
  "target": "wiki",
  "workspace": "operations",
  "prefix": "runbooks",
  "query": "flat=true&perPage=100&sort=mtime&order=desc"
}
```

In tree mode, `page` and `perPage` select direct children of the workspace or `prefix`, and each returned directory includes its descendants. In flat mode, they select individual Wiki pages. Wiki page lists accept up to 200 entries per page.

Read or search Markdown Wiki pages:

```json
{ "target": "wiki_page", "workspace": "operations", "path": "runbooks/restart" }
```

```json
{
  "target": "wiki_search",
  "workspace": "operations",
  "prefix": "runbooks",
  "search": "database failover",
  "limit": 20
}
```

Search results include matching snippets and `modifiedAt`. If `hasMore` is true, pass `nextCursor` as `cursor` in the next call and keep `search`, `workspace`, and `prefix` unchanged.

The legacy `docs`, `doc`, and `doc_search` targets remain available as deprecated exact aliases. New clients should use the Wiki target names.

```json
{ "uri": "dagu://runs/nightly-report/latest/logs?tail=100" }
```

Read stdout and stderr for one step:

```json
{
  "target": "step_log",
  "name": "nightly-report",
  "dagRunId": "20260522T010000",
  "stepName": "generate-report",
  "query": "stream=stderr&offset=101&limit=200"
}
```

`step_log` supports `tail`, `head`, `offset`, `limit`, and `stream=stdout|stderr`. Use at most one of `tail`, `head`, and `offset`; `limit` can be used alone or with `offset`, and by itself reads from the beginning. Without positioning parameters, the last 1000 lines are returned. Values for `tail`, `head`, and `limit` range from 1 to 10000.

Read a child DAG run or one of its step logs by adding the child ID returned in a run step's `subRuns` list:

```json
{
  "target": "run",
  "name": "nightly-report",
  "dagRunId": "20260522T010000",
  "subRunId": "child-run-id"
}
```

Successful reads return a stable envelope with `target`, normalized `data`, built-in `references`, and `uri` when the result has a canonical resource URI. DAG and run lists include canonical URIs; run summaries include numeric and human-readable statuses; run details include step statuses, errors, log URIs, and child-run references.

## `dagu_change`

Use `dagu_change` to create, update, rename, or delete DAG definitions and to maintain Markdown Wiki pages. Preview does not write; apply uses the same authorization, Git Sync write policy, mutation notifications, and audit path as the REST API.

| Input | Values |
|-------|--------|
| `mode` | `preview` or `apply`; defaults to `preview` |
| `type` | `upsert_dag`, `rename_dag`, `delete_dag`, `upsert_wiki_page`, `rename_wiki_page`, or `delete_wiki_page`; defaults to `upsert_dag` |
| `name` | Target DAG name for DAG changes |
| `spec` | Full DAG YAML specification for `upsert_dag` |
| `newName` | Destination DAG name for `rename_dag` |
| `workspace` | `default` or a named workspace for Wiki page changes; `all` is not allowed |
| `path` | Wiki page or directory path without `.md` for Wiki page changes |
| `content` | Full Markdown content for `upsert_wiki_page`; empty content is allowed |
| `newPath` | Destination Wiki page or directory path for `rename_wiki_page` |

The legacy `upsert_doc`, `rename_doc`, and `delete_doc` types remain available as deprecated exact aliases.

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

Preview a DAG rename:

```json
{
  "mode": "preview",
  "type": "rename_dag",
  "name": "nightly-report",
  "newName": "daily-report"
}
```

Preview verifies that the source exists and the destination is available. Repeat the call with `mode=apply` to rename the stored DAG. Rename changes the stored identifier without rewriting the YAML `name` field or historical runs. A successful apply links to the destination DAG and omits the obsolete source `dagUri`.

Preview a DAG deletion:

```json
{
  "mode": "preview",
  "type": "delete_dag",
  "name": "daily-report"
}
```

Repeat the call with `mode=apply` to delete the DAG definition. A successful deletion omits `dagUri` because the resource no longer exists.

Preview a Wiki page create or update:

```json
{
  "mode": "preview",
  "type": "upsert_wiki_page",
  "workspace": "operations",
  "path": "runbooks/restart",
  "content": "# Restart procedure\n\n..."
}
```

Rename or move a Wiki page or directory:

```json
{
  "mode": "apply",
  "type": "rename_wiki_page",
  "workspace": "operations",
  "path": "runbooks",
  "newPath": "procedures"
}
```

Delete a Wiki page or directory:

```json
{
  "mode": "preview",
  "type": "delete_wiki_page",
  "workspace": "operations",
  "path": "procedures/obsolete"
}
```

## `dagu_execute`

Use `dagu_execute` for run control.

| Input | Values |
|-------|--------|
| `action` | `start`, `enqueue`, `retry`, or `stop` |
| `targetType` | `dag`, `inline_spec`, or `run`; inferred when omitted |
| `name` | Required DAG name, including the identity used for an inline spec run |
| `spec` | Inline DAG YAML for `start` or `enqueue` with `targetType=inline_spec` |
| `dagRunId` | Run ID override for start/enqueue, or target run for retry/stop |
| `params` | Runtime parameters as a JSON object or JSON-encoded string |
| `queue` | Queue override for `enqueue` |
| `singleton` | Prevent duplicate running or queued runs for `start` and `enqueue` |
| `noReuse` | Run eligible build steps instead of reusing prior materializations for `start` and `enqueue` |
| `labels` | Labels as `key=value` or key-only strings for `start` and `enqueue` |
| `stepName` | Optional step name for retry |
| `includeDownstream` | With `stepName`, retry that step and every reachable descendant |
| `wait` | Wait for the identified run to reach a terminal state or a waiting checkpoint |
| `waitTimeoutSeconds` | Wait limit from 1 to 300 seconds; requires `wait` and defaults to 60 |

Start a stored DAG:

```json
{
  "action": "start",
  "targetType": "dag",
  "name": "nightly-report",
  "params": {"TARGET": "orders"},
  "wait": true,
  "waitTimeoutSeconds": 30
}
```

Enqueue a stored DAG:

```json
{ "action": "enqueue", "name": "nightly-report", "queue": "default" }
```

Retry a run:

```json
{
  "action": "retry",
  "name": "nightly-report",
  "dagRunId": "20260522T010000",
  "stepName": "load",
  "includeDownstream": true
}
```

Stop a run:

```json
{ "action": "stop", "name": "nightly-report", "dagRunId": "20260522T010000" }
```

When a run can be identified, `dagu_execute` returns canonical resource links for run details and logs. Without `wait`, it also returns subscription guidance. With `wait=true`, the result reports whether the run completed, its last observed status, and the normalized run and step summary after terminal completion. A wait timeout does not stop the run.

Tool errors use structured codes such as `invalid_tool_input`, `resource_not_found`, `conflict`, and `resource_unavailable`. When a stored DAG name is close to an existing name, `resource_not_found` may include suggestions under `details.didYouMean`.

`dagu_execute` can start or enqueue a root DAG containing human tasks, locally or on a distributed worker, but it cannot complete or push back a waiting human task. Use the [Web UI](/writing-workflows/human-tasks#web-ui), [REST API](/web-ui/api#human-task-endpoints), or the local [`dagu human-task complete`](/getting-started/cli#human-task-complete) and [`dagu human-task push-back`](/getting-started/cli#human-task-push-back) commands. Human-task completion and push-back are not available through MCP, including `dagu_execute` retry or stop actions.
