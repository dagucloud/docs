# REST API

Dagu provides a comprehensive REST API for programmatic control over workflow orchestration. The API enables DAG management, execution control, monitoring, and system operations through standard HTTP endpoints.

::: tip API Reference
For the complete API documentation with all endpoints, see [REST API Reference](/web-ui/api).
:::

## Base Configuration

- **Base URL**: `http://localhost:8080/api/v1`
- **Content-Type**: `application/json`
- **Required Headers**: `Accept: application/json`

Mounted deployments can change both the server base path and the API base path. The live OpenAPI document advertises the mounted API path in `servers[0].url` so generated clients can target `/api/v1`, `/dagu/api/v1`, `/dagu/rest`, or any other configured mount point correctly.

## Authentication

The REST API supports three authentication methods:

- **Basic Authentication**: Include `Authorization: Basic <base64(username:password)>` header
- **Bearer Token**: Include `Authorization: Bearer <token>` header  
- **No Authentication**: When auth is disabled (default for local development)

## Core Operations

### Health Monitoring

Check server health and status:

```bash
curl http://localhost:8080/api/v1/health
```

Response includes server status, version, uptime, and timestamp.

### OpenAPI Document

Fetch the normalized OpenAPI document served by the current Dagu instance:

```bash
curl http://localhost:8080/api/v1/openapi.json
```

When authentication is enabled, `/openapi.json` requires the same auth as the rest of the API. The web UI also exposes a live viewer at `/api-docs`, which loads this document with the current session.

### DAG Management

#### List DAGs
```bash
# Get all DAGs
curl http://localhost:8080/api/v1/dags

# With filtering and pagination
curl "http://localhost:8080/api/v1/dags?page=1&perPage=10&name=example&labels=prod"

# Sort alphabetically
curl "http://localhost:8080/api/v1/dags?sort=name&order=desc"

# Sort by the scheduler's next planned run time
curl "http://localhost:8080/api/v1/dags?sort=nextRun&order=asc"
```

::: info Supported Sort Fields
`GET /api/v1/dags` supports server-side sorting by `name` and `nextRun`.

- `name`: case-insensitive DAG name sort
- `nextRun`: earlier scheduled run times first in ascending order; DAGs without schedules appear last
:::

#### Get DAG Details
```bash
curl http://localhost:8080/api/v1/dags/my-dag
```

The DAG detail response includes `paramDefs` when Dagu can derive parameter metadata. `paramDefs` carries typed metadata for inline rich `params:` definitions, top-level inline JSON Schema, and representable external schemas. For named params, clients should submit a JSON object payload; JSON arrays are mainly for positional or mixed raw input.

`defaultParams` is a shell-style string of resolved default pairs such as `environment="staging" batch_size="25"`. It is not JSON.

When a param uses inline `eval`, `paramDefs.default` still represents only the authored literal `default`, if one exists. Computed defaults such as `${BASE_DIR}/out` or `` `nproc` `` are resolved by the server when the DAG is started.

#### Create New DAG
```bash
# Create with default template
curl -X POST http://localhost:8080/api/v1/dags \
  -H "Content-Type: application/json" \
  -d '{"name": "my-new-dag"}'

# Create with custom specification (validated before creation)
curl -X POST http://localhost:8080/api/v1/dags \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-new-dag",
    "spec": "steps:\n  - command: echo hello"
  }'
```

#### Validate DAG Specification
```bash
curl -X POST http://localhost:8080/api/v1/dags/validate \
  -H "Content-Type: application/json" \
  -d '{
    "spec": "steps:\n  - command: echo hello",
    "name": "optional-dag-name"
  }'
```

Validates DAG specifications without saving. Returns a validity flag, validation errors, and parsed DAG details when possible.

Example response (valid):
```json
{
  "valid": true,
  "errors": [],
  "dag": {
    "name": "my-new-dag"
  }
}
```

Example response (invalid):
```json
{
  "valid": false,
  "errors": [
    "field 'steps': decoding failed due to the following error(s):",
    "invalid keys: command1"
  ]
}
```

### DAG Execution Control

#### Start DAG
```bash
curl -X POST http://localhost:8080/api/v1/dags/my-dag/start \
  -H "Content-Type: application/json" \
  -d '{
    "params": "{\"env\": \"production\"}",
    "dagRunId": "custom-run-id",
    "dagName": "adhoc-my-dag"
  }'
```

`params` remains a JSON string payload. The server validates and coerces its values against the DAG's inline param definitions or external parameter schema before execution.

#### Enqueue DAG
```bash
curl -X POST http://localhost:8080/api/v1/dags/my-dag/enqueue \
  -H "Content-Type: application/json" \
  -d '{
    "params": "{\"env\": \"production\"}",
    "dagName": "queue-override-my-dag",
    "queue": "high-priority"  // optional: override queue
  }'
```

The same validation rules apply to enqueue requests. Invalid typed values are rejected before the run is queued.

#### Suspend/Resume DAG
```bash
# Suspend
curl -X POST http://localhost:8080/api/v1/dags/my-dag/suspend \
  -H "Content-Type: application/json" \
  -d '{"suspend": true}'

# Resume
curl -X POST http://localhost:8080/api/v1/dags/my-dag/suspend \
  -H "Content-Type: application/json" \
  -d '{"suspend": false}'
```

### Queue Management

#### List Queues
```bash
# Get queue summaries
curl http://localhost:8080/api/v1/queues
```

`GET /queues` returns queue summaries only: queue type (`global` or `dag-based`), optional `maxConcurrency`, `runningCount`, `queuedCount`, currently running items, and a top-level capacity summary.

To inspect queue contents, use `GET /queues/{name}/items`:

```bash
# Get queued items from one queue
curl "http://localhost:8080/api/v1/queues/default/items?type=queued&page=1&perPage=20"

# Get running items from one queue
curl "http://localhost:8080/api/v1/queues/default/items?type=running&page=1&perPage=20"
```

### DAG Run Management

#### List DAG Runs
```bash
# Get the newest DAG runs
curl http://localhost:8080/api/v1/dag-runs

# Filter by name and status
curl "http://localhost:8080/api/v1/dag-runs?name=my-dag&status=2"
```

`GET /dag-runs` and `GET /dag-runs/{name}` now use forward-only cursor pagination. Each response returns `dagRuns` and, when more data exists, `nextCursor`.

```bash
# Follow the next page
curl "http://localhost:8080/api/v1/dag-runs?limit=100&cursor=<opaque-cursor>"
```

#### Run From Inline Spec
Create and start a DAG-run directly from a YAML spec without persisting a DAG file.

```bash
curl -X POST "http://localhost:8080/api/v1/dag-runs?remoteNode=local" \
  -H "Content-Type: application/json" \
  -d '{
    "spec": "steps:\n  - name: hello\n    command: echo hello",
    "name": "hello",                  # optional if spec includes name
    "params": "{\"env\":\"prod\"}", # optional JSON string
    "dagRunId": "custom-run-id",      # optional; autogenerated if omitted
    "singleton": true                  # optional; prevent start if already active
  }'
```

Notes:
- `name` must be <= 40 chars and match `[A-Za-z0-9_.-]+` when provided.
- When `singleton` is true, starting while another run of the same DAG name is active returns 409 (`max_run_reached`).
- Response:

```json
{ "dagRunId": "<run-id>" }
```

#### Stop or Cancel DAG Run
```bash
curl -X POST http://localhost:8080/api/v1/dag-runs/my-dag/20240101_120000/stop
```

This endpoint stops a running DAG run. It can also cancel a failed root DAG run that is still pending DAG-level automatic retry.

#### Retry DAG Run
```bash
curl -X POST http://localhost:8080/api/v1/dag-runs/my-dag/20240101_120000/retry \
  -H "Content-Type: application/json" \
  -d '{"dagRunId": "new-run-id"}'
```

### Step Management

#### Update Step Status
```bash
# Mark step as successful
curl -X PATCH http://localhost:8080/api/v1/dag-runs/my-dag/20240101_120000/steps/step1/status \
  -H "Content-Type: application/json" \
  -d '{"status": 4}'  # 4 = Success

# Mark step as failed
curl -X PATCH http://localhost:8080/api/v1/dag-runs/my-dag/20240101_120000/steps/step1/status \
  -H "Content-Type: application/json" \
  -d '{"status": 2}'  # 2 = Failed
```

### Search Operations

Legacy full DAG search is still available:

```bash
curl "http://localhost:8080/api/v1/dags/search?q=database"
```

The global search page uses cursor-based feed endpoints:

```bash
# Lightweight DAG search results
curl "http://localhost:8080/api/v1/search/dags?q=database"

# Lightweight document search results
curl "http://localhost:8080/api/v1/search/docs?q=runbook"

# Load more snippets for one DAG result
curl "http://localhost:8080/api/v1/search/dags/example/matches?q=database&cursor=<opaque-cursor>"

# Load more snippets for one document result
curl "http://localhost:8080/api/v1/search/docs/matches?path=runbooks/oncall&q=runbook&cursor=<opaque-cursor>"
```

The feed endpoints return lightweight results with preview matches, `hasMore`, and optional cursors for both additional results and additional snippets per result.

### Event Logs

Centralized event logs are available through `GET /event-logs` when the event store is enabled:

```bash
curl "http://localhost:8080/api/v1/event-logs?kind=dag_run&type=dag.run.failed&limit=50"
```

Supported filters include `kind`, `type`, `dagName`, `dagRunId`, `attemptId`, `sessionId`, `userId`, `model`, `startTime`, and `endTime`.

The endpoint supports:

- offset pagination with `limit` and `offset`
- cursor pagination with `limit`, `paginationMode=cursor`, and `cursor`

When builtin authentication is enabled, this endpoint requires a `manager` or `admin` role.

## Monitoring and Metrics

### Prometheus Metrics

Dagu exposes Prometheus-compatible metrics for comprehensive monitoring:

```bash
curl http://localhost:8080/api/v1/metrics
```

Available metrics include:

- **System Metrics**: Build info, uptime, scheduler status
- **Execution Metrics**: Running DAGs, queued runs, execution totals by status
- **Performance Metrics**: Success rates, queue lengths

## Error Handling

All API endpoints return structured error responses:

```json
{
  "code": "error_code",
  "message": "Human readable error message",
  "details": {
    "additional": "error details"
  }
}
```

Common error codes:
- `bad_request`: Invalid request parameters
- `not_found`: Resource doesn't exist
- `internal_error`: Server-side error
- `unauthorized`: Authentication failed
- `forbidden`: Insufficient permissions
- `already_exists`: Resource (e.g., run ID) already exists
- `max_run_reached`: Concurrency or singleton limit reached
- `not_running`: DAG is not running

## Response Formats

### DAG List Response
```json
{
  "dags": [
    {
      "fileName": "example",
      "dag": {
        "name": "example_dag",
        "schedule": [{"expression": "0 * * * *"}],
        "description": "Example DAG",
        "labels": ["example", "demo"]
      },
      "nextRun": "2026-03-29T09:30:00+09:00",
      "latestDAGRun": {
        "dagRunId": "20240101_120000",
        "name": "example_dag",
        "status": 1,
        "statusLabel": "running",
        "startedAt": "2024-01-01T12:00:00Z"
      },
      "suspended": false
    }
  ],
  "errors": [],
  "pagination": {
    "totalRecords": 45,
    "currentPage": 1,
    "totalPages": 5,
    "nextPage": 2,
    "prevPage": null
  }
}
```

`schedule` entries are recurring cron objects such as `{"expression":"0 * * * *"}` or typed one-off start entries such as `{"kind":"at","at":"2026-03-29T09:30:00+09:00"}`. `nextRun` is the scheduler-aware next planned run time for that DAG. For a pending one-off start entry, `nextRun` can remain visible even after that timestamp has passed, until the scheduler consumes it.

### Health Check Response
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 3600,
  "timestamp": "2024-02-11T12:00:00Z"
}
```
