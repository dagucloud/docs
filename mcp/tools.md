# MCP Tools

Dagu intentionally exposes three MCP tools.

| Tool | Purpose |
|------|---------|
| `dagu_read` | Read DAGs, Markdown Wiki pages, DAG runs, logs, list views, and Dagu MCP reference resources. |
| `dagu_change` | Preview or apply DAG YAML, DAG default runtime profile, and workspace-aware Wiki page changes. |
| `dagu_execute` | Start, enqueue, retry, or stop DAG runs, and approve, reject, or push back steps waiting for a person. |

## `dagu_read`

Use `dagu_read` for current Dagu state.

| Input | Values |
|-------|--------|
| `target` | `references`, `reference`, `dags`, `dag`, `dag_spec`, `dag_profile`, `dag_search`, `wiki`, `wiki_page`, `wiki_search`, `runs`, `run`, `run_logs`, `step_log`, `foreach_items`, `foreach_item`, or `workbook` |
| `name` | DAG name for DAG and run targets, or reference topic for `reference` |
| `dagRunId` | DAG-run ID for run and log targets |
| `subRunId` | Optional child DAG-run ID for `run`, `step_log`, `foreach_items`, and `foreach_item`; `name` and `dagRunId` identify its root run |
| `stepName` | Step name for the `step_log`, `foreach_items`, and `foreach_item` targets |
| `item` | Foreach item path for `foreach_item`, or for `step_log` with `bodyStepName`. A top-level item is its index; a nested item is the body step's `foreachParent`, a dot, and the index. |
| `bodyStepName` | Body step name inside a foreach item for `step_log`; requires `item` |
| `query` | URL query string for list and log targets, such as `page=1&perPage=100` or `tail=100`. `foreach_items` accepts `parent`, `status`, `page`, and `perPage`. |
| `workspace` | `all`, `default`, or a workspace name. Required for `wiki_page`; optional for `wiki`, `wiki_search`, and `dag_search`. |
| `path` | Wiki page path without `.md`, required for `wiki_page`; or a workbook file path on the server, required for `workbook` |
| `password` | Password of a protected workbook; optional for `workbook` and not recorded in the audit log |
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

Inspect an `.xlsx` workbook on the server before writing [xlsx steps](/step-types/xlsx) for it:

```json
{ "target": "workbook", "path": "/srv/data/orders.xlsx" }
```

The result describes each sheet, its used range, detected data block, header row, headers, column types, row count, and tables, with five typed sample rows, plus the workbook's named ranges and date system. Each column carries a profile over up to 5000 data rows: filled and blank cells, distinct values, the values themselves when a few repeat, the lowest and highest number or date, and the odd cells that do not read as the column's type, such as `未定` in a number column. Use it to choose `where`, `types`, and `on_type_error` for `xlsx.read`. `path` is any file the server process can read, and is recorded in the audit log as `workbook_path`.

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

List the items of a foreach step, filtered by the status each body run reached (`not_started`, `running`, `succeeded`, `failed`, or `aborted`):

```json
{
  "target": "foreach_items",
  "name": "nightly-report",
  "dagRunId": "20260522T010000",
  "stepName": "process-files",
  "query": "status=failed"
}
```

Read one item with `foreach_item`, or the log of one body step of an item with `step_log`:

```json
{
  "target": "step_log",
  "name": "nightly-report",
  "dagRunId": "20260522T010000",
  "stepName": "process-files",
  "item": "3",
  "bodyStepName": "upload"
}
```

Read the default runtime profile of a DAG. The result has `configuredProfile`, `effectiveProfile`, and `source` (`dag`, `workspace`, or `none`):

```json
{ "target": "dag_profile", "name": "nightly-report" }
```

Successful reads return a stable envelope with `target`, normalized `data`, built-in `references`, and `uri` when the result has a canonical resource URI. DAG and run lists include canonical URIs; run summaries include numeric and human-readable statuses; run details include the current `attemptId`, step statuses, errors, log URIs, and child-run references.

## `dagu_change`

Use `dagu_change` to create, update, rename, or delete DAG definitions and to maintain Markdown Wiki pages. Preview does not write; apply uses the same authorization, Git Sync write policy, mutation notifications, and audit path as the REST API.

| Input | Values |
|-------|--------|
| `mode` | `preview` or `apply`; defaults to `preview` |
| `type` | `upsert_dag`, `rename_dag`, `delete_dag`, `set_dag_profile`, `clear_dag_profile`, `upsert_wiki_page`, `rename_wiki_page`, or `delete_wiki_page`; defaults to `upsert_dag` |
| `name` | Target DAG name for DAG changes |
| `spec` | Full DAG YAML specification for `upsert_dag` |
| `newName` | Destination DAG name for `rename_dag` |
| `profile` | Runtime profile name for `set_dag_profile` |
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

Set the default runtime profile of a DAG:

```json
{
  "mode": "preview",
  "type": "set_dag_profile",
  "name": "nightly-report",
  "profile": "prod"
}
```

`set_dag_profile` and `clear_dag_profile` change the server-side DAG setting, not the YAML. Preview checks the profile without writing it. `clear_dag_profile` removes the setting, so the DAG falls back to its workspace default, if any. Read the current value with `target=dag_profile`. See [Runtime Profiles](/writing-workflows/runtime-profiles).

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

Use `dagu_execute` for run control and for deciding steps that wait for a person.

| Input | Values |
|-------|--------|
| `action` | `start`, `enqueue`, `retry`, `stop`, `approve`, `reject`, or `push_back` |
| `targetType` | `dag`, `inline_spec`, or `run`; inferred when omitted |
| `name` | Required DAG name, including the identity used for an inline spec run |
| `spec` | Inline DAG YAML for `start` or `enqueue` with `targetType=inline_spec` |
| `dagRunId` | Run ID override for start/enqueue, or target run for the other actions |
| `params` | Runtime parameters as a JSON object or JSON-encoded string |
| `queue` | Queue override for `enqueue` |
| `singleton` | Prevent duplicate running or queued runs for `start` and `enqueue` |
| `noReuse` | Run eligible build steps instead of reusing prior materializations for `start` and `enqueue` |
| `labels` | Labels as `key=value` or key-only strings for `start` and `enqueue` |
| `stepName` | Optional step name for retry; required for `approve`, `reject`, and `push_back` as the waiting step to decide |
| `includeDownstream` | With `stepName`, retry that step and every reachable descendant |
| `subDAGRunId` | For step decisions, the sub-DAG run of `dagRunId` that owns the waiting step |
| `inputs` | Object of values for `approve` and `push_back` |
| `reason` | Optional reason for `reject` |
| `attemptId` | For step decisions, the run's `attemptId` from the `dagu_read` result the decision is based on |
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

### Deciding Waiting Steps

When `dagu_read` with `target=run` lists a step as waiting with `approval` or `humanTask`, `approve`, `reject`, or `push_back` decides it. Read the run first and pass its `attemptId`:

```json
{
  "action": "approve",
  "name": "nightly-report",
  "dagRunId": "20260522T010000",
  "stepName": "publish_gate",
  "inputs": {"TICKET": "CHG-42"},
  "attemptId": "att-2",
  "wait": true
}
```

| Action | [Approval gate](/writing-workflows/approval) | [Human task](/writing-workflows/human-tasks) |
|--------|---------------|------------|
| `approve` | The step succeeds. `inputs` holds its input values, each a string. | Completes the task with `inputs` as its form values. Omit `inputs` for an acknowledgement-only task. |
| `reject` | Rejects the step and the run, recording `reason`. | Not allowed. Human tasks cannot be rejected. |
| `push_back` | Pushes the step back for re-execution with `inputs` as feedback, each a string. | Pushes the task back with `inputs` as its feedback. |

- Human-task `inputs` are typed JSON values, as with `dagu human-task complete --inputs-json`.
- Deciding requires permission to run DAGs in the run's workspace, as in the Web UI and REST API: `operator` or above. A decision resumes the run as those surfaces do.
- When `attemptId` differs from the run's current attempt, the call fails with `conflict`, changes nothing, and reports the current attempt in `details.attemptId`. Read the run again before deciding.
- A step that is not waiting fails with `conflict`. An unknown step fails with `resource_not_found`.
- `reject` on a human task, a non-string approval input, a missing required approval input, and input the task's form refuses fail with `invalid_tool_input` and change nothing.
- Without `wait`, the result includes `stepName` and the run's `status` and `statusLabel` observed after the decision.

`attemptId` is optional on the server's own MCP endpoint. Calls from Dagu Cloud must pass it, and can decide steps only while the server allows [remote approvals](/overview/cloud-remote-access#approvals).
