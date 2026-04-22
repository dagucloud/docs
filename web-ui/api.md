# REST API Reference

## Base Configuration

- **Base URL**: `http://localhost:8080/api/v1`
- **Content-Type**: `application/json`
- **OpenAPI Version**: 3.0.0
- **Live OpenAPI Document**: `GET /api/v1/openapi.json`

The web UI also includes a live API docs page at `/api-docs`. It renders the same OpenAPI document served by `/api/v1/openapi.json` using the current session. With builtin auth, the viewer pre-fills the stored bearer token for interactive requests.

### Authentication

The API supports multiple authentication methods:

- **API Keys**: Include `Authorization: Bearer dagu_<key>` header (requires Builtin Auth)
- **Webhooks**: Include `Authorization: Bearer dagu_wh_<token>` header for triggering specific DAGs (requires Builtin Auth)
- **JWT Token**: Include `Authorization: Bearer <jwt-token>` header (from login endpoint)
- **Basic Auth**: Include `Authorization: Basic <base64(username:password)>` header
- **No Authentication**: When auth is disabled (default for local development)

API keys are recommended for general programmatic access as they support role-based permissions. See [API Keys](/server-admin/authentication/api-keys) for details. For triggering specific DAGs from external systems, see [Webhooks](/server-admin/authentication/webhooks).

## System Endpoints

### Health Check

**Endpoint**: `GET /api/v1/health`

Checks the health status of the Dagu server.

**Response (200)**:
```json
{
  "status": "healthy",
  "version": "1.14.5",
  "uptime": 86400,
  "timestamp": "2024-02-11T16:30:45.123456789Z"
}
```

**Response when unhealthy (503)**:
```json
{
  "status": "unhealthy",
  "version": "1.14.5",
  "uptime": 300,
  "timestamp": "2024-02-11T16:30:45.123456789Z",
  "error": "Scheduler not responding"
}
```

**Response Fields**:
- `status`: Server health status ("healthy" or "unhealthy")
- `version`: Current server version
- `uptime`: Server uptime in seconds
- `timestamp`: Current server time

### OpenAPI Document

**Endpoint**: `GET /api/v1/openapi.json`

Returns the normalized OpenAPI document served by this Dagu instance.

**Notes**:

- When authentication is enabled, this endpoint is authenticated like the rest of the API.
- The response advertises the mounted API path in `servers[0].url` such as `/api/v1`, `/dagu/api/v1`, or `/dagu/rest`.
- The document includes the `/openapi.json` path itself, so clients can discover it from the schema.

## DAG Management Endpoints

### List DAGs

**Endpoint**: `GET /api/v1/dags`

Retrieves DAG definitions with optional filtering by name and tags.

**Query Parameters**:
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| page | integer | Page number (1-based) | 1 |
| perPage | integer | Items per page (max 1000) | 50 |
| name | string | Filter DAGs by name | - |
| tags | string | Filter by tags. Comma-separated. Syntax: `key`, `key=value`, `!key`, `key*`, `key=value*`. Supports `*` and `?` wildcards. AND logic. | - |
| sort | string | Sort field: `name` or `nextRun` | `ui.dags.sort_field` (fallback `name`) |
| order | string | Sort order: `asc` or `desc` | `ui.dags.sort_order` (fallback `asc`) |
| remoteNode | string | Remote node name | "local" |

**Response (200)**:
```json
{
  "dags": [
    {
      "fileName": "example",
      "dag": {
        "name": "example_dag",
        "group": "default",
        "schedule": [{"expression": "0 * * * *"}],
        "description": "Example DAG",
        "params": ["param1", "param2"],
        "defaultParams": "{}",
        "tags": ["example", "demo"]
      },
      "nextRun": "2026-03-29T09:30:00+09:00",
      "latestDAGRun": {
        "dagRunId": "20240101_120000",
        "name": "example_dag",
        "status": 1,
        "statusLabel": "running",
        "startedAt": "2024-01-01T12:00:00Z",
        "finishedAt": "",
        "log": "/logs/example_dag.log"
      },
      "suspended": false,
      "errors": []
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

### Create DAG

**Endpoint**: `POST /api/v1/dags`

Creates a new DAG file with the specified name. Optionally initializes it with a provided YAML specification.

**Request Body**:
```json
{
  "name": "my-new-dag",
  "spec": "steps:\n  - command: echo hello"  // Optional - YAML spec to initialize the DAG
}
```

**Notes**:
- If `spec` is provided, it will be validated before creation
- If validation fails, returns 400 with error details
- Without `spec`, creates a minimal DAG with a single echo step

**Response (201)**:
```json
{
  "name": "my-new-dag"
}
```

**Error Response (400)**:
```json
{
  "code": "bad_request",
  "message": "Invalid DAG name format"
}
```

**Error Response (409)**:
```json
{
  "code": "already_exists",
  "message": "DAG with this name already exists"
}
```

### Get DAG Details

**Endpoint**: `GET /api/v1/dags/{fileName}`

Fetches detailed information about a specific DAG.

**Path Parameters**:
| Parameter | Type | Description | Pattern |
|-----------|------|-------------|---------|
| fileName | string | DAG file name | `^[a-zA-Z0-9_-]+$` |

**Response (200)**:
```json
{
  "dag": {
    "name": "data_processing_pipeline",
    "group": "ETL",
    "schedule": [
      {"expression": "0 2 * * *"},
      {"expression": "0 14 * * *"}
    ],
    "description": "Daily data processing pipeline for warehouse ETL",
    "env": [
      "DATA_SOURCE=postgres://prod-db:5432/analytics",
      "WAREHOUSE_URL=${WAREHOUSE_URL}"
    ],
    "log_dir": "/var/log/dagu/pipelines",
    "handler_on": {
      "success": {
        "name": "notify_success",
        "command": "notify.sh 'Pipeline completed successfully'"
      },
      "failure": {
        "name": "alert_on_failure",
        "command": "alert.sh 'Pipeline failed' high"
      },
      "exit": {
        "name": "cleanup",
        "command": "cleanup_temp_files.sh"
      }
    },
    "steps": [
      {
        "name": "extract_data",
        "id": "extract",
        "description": "Extract data from source database",
        "dir": "/app/etl",
        "command": "python",
        "args": ["extract.py", "--date", "${date}"],
        "stdout": "/logs/extract.out",
        "stderr": "/logs/extract.err",
        "output": "EXTRACTED_FILE",
        "preconditions": [
          {
            "condition": "test -f /data/ready.flag",
            "expected": ""
          }
        ]
      },
      {
        "name": "transform_data",
        "id": "transform",
        "description": "Apply transformations to extracted data",
        "command": "python transform.py --input=${EXTRACTED_FILE}",
        "depends": ["extract_data"],
        "output": "TRANSFORMED_FILE",
        "repeat_policy": {
          "repeat": false,
          "interval": 0
        },
        "mail_on_error": true
      },
      {
        "name": "load_to_warehouse",
        "id": "load",
        "run": "warehouse-loader",
        "params": "{\"file\": \"${TRANSFORMED_FILE}\", \"table\": \"fact_sales\"}",
        "depends": ["transform_data"]
      }
    ],
    "delay": 30,
    "hist_retention_days": 30,
    "preconditions": [
      {
        "condition": "`date +%u`",
        "expected": "re:[1-5]",
        "error": "Pipeline only runs on weekdays"
      }
    ],
    "max_active_runs": 1,
    "max_active_steps": 5,
    "params": ["date", "env", "batch_size"],
    "paramDefs": [
      {
        "name": "date",
        "type": "string",
        "description": "Pipeline run date",
        "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
      },
      {
        "name": "env",
        "type": "string",
        "default": "dev",
        "enum": ["dev", "staging", "prod"]
      },
      {
        "name": "batch_size",
        "type": "integer",
        "default": 1000,
        "minimum": 1,
        "maximum": 10000
      }
    ],
    "defaultParams": "{\"batch_size\": 1000, \"env\": \"dev\"}",
    "tags": ["production", "etl", "daily"]
  },
  "localDags": [
    {
      "name": "warehouse-loader",
      "dag": {
        "name": "warehouse_loader_subdag",
        "steps": [
          {
            "name": "validate_schema",
            "command": "validate_schema.py"
          },
          {
            "name": "load_data",
            "command": "load_to_warehouse.py",
            "depends": ["validate_schema"]
          }
        ]
      },
      "errors": []
    }
  ],
  "latestDAGRun": {
    "rootDAGRunName": "data_processing_pipeline",
    "rootDAGRunId": "20240211_140000_abc123",
    "parentDAGRunName": "",
    "parentDAGRunId": "",
    "dagRunId": "20240211_140000_abc123",
    "name": "data_processing_pipeline",
    "status": 4,
    "statusLabel": "succeeded",
    "queuedAt": "",
    "startedAt": "2024-02-11T14:00:00Z",
    "finishedAt": "2024-02-11T14:45:30Z",
    "log": "/logs/data_processing_pipeline/20240211_140000_abc123.log",
    "params": "{\"date\": \"2024-02-11\", \"env\": \"production\", \"batch_size\": 5000}"
  },
  "suspended": false,
  "errors": []
}
```

`paramDefs` is additive metadata derived from DAG-level `params:`. Typed clients can use it to render start/enqueue controls. When Dagu cannot derive a faithful typed field model, the field is omitted and clients should fall back to the raw parameter editor.

`paramDefs` can be derived from inline rich params, top-level inline JSON Schema, and representable external schemas.

`defaultParams` is the resolved shell-style default parameter string, not JSON. For example: `environment="staging" batch_size="25"`.

When an inline rich param uses `eval`, `paramDefs.default` remains only the authored literal `default`, if one exists. Clients should not evaluate template defaults locally.

### Delete DAG

**Endpoint**: `DELETE /api/v1/dags/{fileName}`

Permanently removes a DAG definition from the system.

**Response (204)**: No content

**Error Response (404)**:
```json
{
  "code": "not_found",
  "message": "DAG not found"
}
```

**Error Response (403)**:
```json
{
  "code": "forbidden",
  "message": "Permission denied to delete DAGs"
}
```

### Get DAG Specification

**Endpoint**: `GET /api/v1/dags/{fileName}/spec`

Fetches the YAML specification of a DAG.

**Response (200)**:
```json
{
  "dag": {
    "name": "example_dag"
  },
  "spec": "name: example_dag\nsteps:\n  - name: hello\n    command: echo Hello",
  "errors": []
}
```

### Update DAG Specification

**Endpoint**: `PUT /api/v1/dags/{fileName}/spec`

Updates the YAML specification of a DAG.

**Request Body**:
```json
{
  "spec": "name: example_dag\nsteps:\n  - name: hello\n    command: echo Hello World"
}
```

**Response (200)**:
```json
{
  "errors": []
}
```

**Response with Validation Errors (200)**:
```json
{
  "errors": [
    "Line 5: Invalid step configuration - missing command",
    "Line 10: Circular dependency detected between step1 and step2"
  ]
}
```

**Error Response (403)**:
```json
{
  "code": "forbidden",
  "message": "Permission denied to edit DAGs"
}
```

### Validate DAG Specification

**Endpoint**: `POST /api/v1/dags/validate`

Validates a DAG YAML specification without persisting any changes. Returns a list of validation errors. When the spec can be partially parsed, the response may include parsed DAG details built with error-tolerant loading.

**Request Body**:
```json
{
  "spec": "type: graph\nsteps:\n  - name: step1\n    command: echo hello\n  - name: step2\n    command: echo world\n    depends: [step1]",
  "name": "optional-dag-name"  // Optional - name to use when spec omits a name
}
```

**Response (200)**:
```json
{
  "valid": true,
  "errors": [],
  "dag": {
    "name": "example-dag",
    "group": "default",
    "description": "Validated DAG",
    "schedule": [],
    "params": [],
    "defaultParams": "{}",
    "tags": []
  }
}
```

**Response with errors (200)**:
```json
{
  "valid": false,
  "errors": [
    "Step 'step2' depends on non-existent step 'missing_step'",
    "Invalid cron expression in schedule: '* * * *'"
  ],
  "dag": {
    "name": "example-dag",
    // Partial DAG details when possible
  }
}
```

**Notes**:
- Always returns 200 status - check `valid` field to determine if spec is valid
- `errors` array contains human-readable validation messages
- `dag` field may contain partial DAG details even when validation fails
- Use this endpoint to validate DAG specs before creating or updating DAGs

### Rename DAG

**Endpoint**: `POST /api/v1/dags/{fileName}/rename`

Changes the file ID of the DAG definition.

**Request Body**:
```json
{
  "newFileName": "new-dag-name"
}
```

**Response (200)**: Success

**Error Response (400)**:
```json
{
  "code": "bad_request",
  "message": "Invalid new file name format"
}
```

**Error Response (409)**:
```json
{
  "code": "already_exists",
  "message": "A DAG with the new name already exists"
}
```

## DAG Execution Endpoints

### Start DAG

**Endpoint**: `POST /api/v1/dags/{fileName}/start`

Creates and starts a DAG run with optional parameters.

**Request Body**:
```json
{
  "params": "{\"env\": \"production\", \"version\": \"1.2.3\"}",
  "dagRunId": "custom-run-id",
  "dagName": "on-demand-data-load",
  "singleton": false,
  "tags": ["workspace=analytics", "adhoc"]
}
```

**Request Fields**:
| Field | Type | Description | Required |
|-------|------|-------------|----------|
| params | string | JSON string of parameters. Values are validated and coerced against DAG param definitions or external parameter schema before execution. For named params, prefer a JSON object payload. JSON arrays are mainly for positional or mixed raw input. | No |
| dagRunId | string | Custom run ID | No |
| dagName | string | Override the DAG name used for this run (must satisfy DAG name validation) | No |
| singleton | boolean | If true, prevent starting if DAG is already running (returns 409) | No |
| tags | string[] | Additional tags for this DAG run. | No |

> **Tip:** Overriding the DAG name changes the identifier used for queue grouping, which is useful for ad-hoc executions that should not collide with scheduled runs.

> **Note:** `GET /api/v1/dags/{fileName}` returns `paramDefs` for typed UI rendering. The start endpoint still accepts a JSON string in `params`, and the server performs the authoritative validation/coercion. For named params, clients should send a JSON object payload.
**Response (200)**:
```json
{
  "dagRunId": "20240101_120000_abc123"
}
```

**Response (409)** - When `singleton: true` and DAG is already running:
```json
{
  "code": "already_running",
  "message": "DAG example_dag is already running, cannot start in singleton mode"
}
```

### Start DAG (Synchronous)

**Endpoint**: `POST /api/v1/dags/{fileName}/start-sync`

Creates and starts a DAG run, waits for it to complete (or timeout), and returns the full execution details. This is useful for automation scripts and CI/CD pipelines that need to wait for a DAG to finish before proceeding.

**Request Body**:
```json
{
  "timeout": 300,
  "params": "{\"env\": \"production\"}",
  "dagRunId": "custom-run-id",
  "dagName": "sync-execution",
  "singleton": false,
  "tags": ["manual"]
}
```

**Request Fields**:
| Field | Type | Description | Required |
|-------|------|-------------|----------|
| timeout | integer | Maximum seconds to wait for completion (1-86400) | **Yes** |
| params | string | JSON string of parameters. Values are validated and coerced against DAG param definitions or external parameter schema before execution. | No |
| dagRunId | string | Custom run ID | No |
| dagName | string | Override the DAG name used for this run | No |
| singleton | boolean | If true, prevent starting if DAG is already running (returns 409) | No |
| tags | string[] | Additional tags for this DAG run. | No |

**Response (200)** - DAG completed or reached waiting status:
```json
{
  "dagRun": {
    "rootDAGRunName": "my-dag",
    "rootDAGRunId": "20240101_120000_abc123",
    "dagRunId": "20240101_120000_abc123",
    "name": "my-dag",
    "status": 4,
    "statusLabel": "succeeded",
    "startedAt": "2024-01-01T12:00:00Z",
    "finishedAt": "2024-01-01T12:00:05Z",
    "log": "/logs/my-dag.log",
    "params": "{}",
    "nodes": [
      {
        "step": {"name": "step1", "command": "echo hello"},
        "status": 4,
        "statusLabel": "succeeded",
        "startedAt": "2024-01-01T12:00:01Z",
        "finishedAt": "2024-01-01T12:00:02Z"
      }
    ]
  }
}
```

**Response (408)** - Timeout waiting for completion (DAG continues in background):
```json
{
  "code": "timeout",
  "message": "timeout waiting for DAG my-dag to complete after 300 seconds; DAG run continues in background",
  "dagRunId": "20240101_120000_abc123"
}
```

> **Note:** When a timeout occurs, the DAG run continues executing in the background. The response includes the `dagRunId` so you can monitor or cancel the run using other API endpoints.

**Response (409)** - When `singleton: true` and DAG is already running:
```json
{
  "code": "already_exists",
  "message": "DAG my-dag is already running (singleton mode)"
}
```

> **Note:** If the DAG reaches a "waiting" status (e.g., a human-in-the-loop step requires approval), the endpoint returns immediately with 200 and the current status instead of blocking until timeout.

### Enqueue DAG

**Endpoint**: `POST /api/v1/dags/{fileName}/enqueue`

Adds a DAG run to the queue for later execution.

**Request Body**:
```json
{
  "params": "{\"key\": \"value\"}",
  "dagRunId": "optional-custom-id",
  "dagName": "queued-ad-hoc-run",
  "queue": "optional-queue-override",
  "singleton": false,
  "tags": ["queued"]
}
```

**Request Fields**:
| Field | Type | Description | Required |
|-------|------|-------------|----------|
| params | string | JSON string of parameters. Values are validated and coerced against DAG param definitions or external parameter schema before the run is queued. | No |
| dagRunId | string | Custom run ID | No |
| dagName | string | Override the DAG name used for the queued run (must satisfy DAG name validation) | No |
| queue | string | Queue name override | No |
| singleton | boolean | If true, prevent enqueuing if the DAG is already running or queued (returns 409) | No |
| tags | string[] | Additional tags for this DAG run. | No |

> **Tip:** When you override the DAG name, the queued run is tracked under the new identifier for both queue management and history records.

**Response (200)**:
```json
{
  "dagRunId": "20240101_120000_abc123"
}
```

### Toggle DAG Suspension

**Endpoint**: `POST /api/v1/dags/{fileName}/suspend`

Controls whether the scheduler creates runs from this DAG.

**Request Body**:
```json
{
  "suspend": true
}
```

**Response (200)**: Success

**Error Response (404)**:
```json
{
  "code": "not_found",
  "message": "DAG not found"
}
```

## DAG Run History Endpoints

### Get DAG Run History

**Endpoint**: `GET /api/v1/dags/{fileName}/dag-runs`

Fetches execution history of a DAG.

**Response (200)**:
```json
{
  "dagRuns": [
    {
      "rootDAGRunName": "data_processing_pipeline",
      "rootDAGRunId": "20240211_140000_abc123",
      "parentDAGRunName": "",
      "parentDAGRunId": "",
      "dagRunId": "20240211_140000_abc123",
      "name": "data_processing_pipeline",
      "status": 4,
      "statusLabel": "succeeded",
      "queuedAt": "",
      "startedAt": "2024-02-11T14:00:00Z",
      "finishedAt": "2024-02-11T14:45:30Z",
      "log": "/logs/data_processing_pipeline/20240211_140000_abc123.log",
      "params": "{\"date\": \"2024-02-11\", \"env\": \"production\", \"batch_size\": 5000}"
    },
    {
      "rootDAGRunName": "data_processing_pipeline",
      "rootDAGRunId": "20240211_020000_def456",
      "parentDAGRunName": "",
      "parentDAGRunId": "",
      "dagRunId": "20240211_020000_def456",
      "name": "data_processing_pipeline",
      "status": 2,
      "statusLabel": "failed",
      "queuedAt": "",
      "startedAt": "2024-02-11T02:00:00Z",
      "finishedAt": "2024-02-11T02:15:45Z",
      "log": "/logs/data_processing_pipeline/20240211_020000_def456.log",
      "params": "{\"date\": \"2024-02-11\", \"env\": \"production\", \"batch_size\": 5000}"
    },
    {
      "rootDAGRunName": "data_processing_pipeline",
      "rootDAGRunId": "20240210_140000_ghi789",
      "parentDAGRunName": "",
      "parentDAGRunId": "",
      "dagRunId": "20240210_140000_ghi789",
      "name": "data_processing_pipeline",
      "status": 4,
      "statusLabel": "succeeded",
      "queuedAt": "",
      "startedAt": "2024-02-10T14:00:00Z",
      "finishedAt": "2024-02-10T14:42:15Z",
      "log": "/logs/data_processing_pipeline/20240210_140000_ghi789.log",
      "params": "{\"date\": \"2024-02-10\", \"env\": \"production\", \"batch_size\": 5000}"
    }
  ],
  "gridData": [
    {
      "name": "extract_data",
      "history": [4, 2, 4]
    },
    {
      "name": "transform_data",
      "history": [4, 2, 4]
    },
    {
      "name": "load_to_warehouse",
      "history": [4, 0, 4]
    }
  ]
}
```

### Get Specific DAG Run

**Endpoint**: `GET /api/v1/dags/{fileName}/dag-runs/{dagRunId}`

Gets detailed status of a specific DAG run.

**Response (200)**:
```json
{
  "dagRun": {
    "rootDAGRunName": "data_processing_pipeline",
    "rootDAGRunId": "20240211_140000_abc123",
    "parentDAGRunName": "",
    "parentDAGRunId": "",
    "dagRunId": "20240211_140000_abc123",
    "name": "data_processing_pipeline",
    "status": 4,
    "statusLabel": "succeeded",
    "queuedAt": "",
    "startedAt": "2024-02-11T14:00:00Z",
    "finishedAt": "2024-02-11T14:45:30Z",
    "log": "/logs/data_processing_pipeline/20240211_140000_abc123.log",
    "params": "{\"date\": \"2024-02-11\", \"env\": \"production\", \"batch_size\": 5000}",
    "nodes": [
      {
        "step": {
          "name": "extract_data",
          "id": "extract",
          "command": "python",
          "args": ["extract.py", "--date", "2024-02-11"]
        },
        "stdout": "/logs/data_processing_pipeline/20240211_140000_abc123/extract_data.stdout",
        "stderr": "/logs/data_processing_pipeline/20240211_140000_abc123/extract_data.stderr",
        "startedAt": "2024-02-11T14:00:30Z",
        "finishedAt": "2024-02-11T14:15:45Z",
        "status": 4,
        "statusLabel": "succeeded",
        "retryCount": 0,
        "doneCount": 1,
        "subRuns": [],
        "subRunsRepeated": [],
        "error": ""
      },
      {
        "step": {
          "name": "transform_data",
          "id": "transform",
          "command": "python transform.py --input=/tmp/extracted_20240211.csv",
          "depends": ["extract_data"]
        },
        "stdout": "/logs/data_processing_pipeline/20240211_140000_abc123/transform_data.stdout",
        "stderr": "/logs/data_processing_pipeline/20240211_140000_abc123/transform_data.stderr",
        "startedAt": "2024-02-11T14:15:45Z",
        "finishedAt": "2024-02-11T14:30:20Z",
        "status": 4,
        "statusLabel": "succeeded",
        "retryCount": 0,
        "doneCount": 1,
        "subRuns": [],
        "subRunsRepeated": [],
        "error": ""
      },
      {
        "step": {
          "name": "load_to_warehouse",
          "id": "load",
          "run": "warehouse-loader",
          "params": "{\"file\": \"/tmp/transformed_20240211.csv\", \"table\": \"fact_sales\"}",
          "depends": ["transform_data"]
        },
        "stdout": "/logs/data_processing_pipeline/20240211_140000_abc123/load_to_warehouse.stdout",
        "stderr": "/logs/data_processing_pipeline/20240211_140000_abc123/load_to_warehouse.stderr",
        "startedAt": "2024-02-11T14:30:20Z",
        "finishedAt": "2024-02-11T14:45:30Z",
        "status": 4,
        "statusLabel": "succeeded",
        "retryCount": 0,
        "doneCount": 1,
        "subRuns": [
          {
            "dagRunId": "sub_20240211_143020_xyz456",
            "params": "{\"file\": \"/tmp/transformed_20240211.csv\", \"table\": \"fact_sales\"}"
          }
        ],
        "subRunsRepeated": [],
        "error": ""
      }
    ]
  }
}
```

## DAG Run Management Endpoints

### List All DAG Runs

**Endpoint**: `GET /api/v1/dag-runs`

Retrieves the newest DAG runs with forward-only cursor pagination.

**Query Parameters**:
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| name | string | Filter by DAG name | - |
| status | integer | Filter by status (0-8) | - |
| fromDate | integer | Unix timestamp start | - |
| toDate | integer | Unix timestamp end | - |
| dagRunId | string | Filter by run ID | - |
| limit | integer | Page size (max 500) | 100 |
| cursor | string | Opaque cursor returned by the previous page | - |
| tags | string | Filter by DAG tags. Comma-separated. Same syntax as DAG filtering. Supports `*` and `?` wildcards. AND logic. | - |
| remoteNode | string | Remote node name | "local" |

The response includes `nextCursor` when older results are available. Repeat the same request with `cursor=<nextCursor>` to continue.

**Status Values**:
- 0: Not started
- 1: Running
- 2: Failed
- 3: Aborted
- 4: Success
- 5: Queued
- 6: Partial Success
- 7: Waiting
- 8: Rejected

**Response (200)**:
```json
{
  "dagRuns": [
    {
      "rootDAGRunName": "data_processing_pipeline",
      "rootDAGRunId": "20240211_160000_current",
      "parentDAGRunName": "",
      "parentDAGRunId": "",
      "dagRunId": "20240211_160000_current",
      "name": "data_processing_pipeline",
      "status": 1,
      "statusLabel": "running",
      "queuedAt": "",
      "startedAt": "2024-02-11T16:00:00Z",
      "finishedAt": "",
      "log": "/logs/data_processing_pipeline/20240211_160000_current.log",
      "params": "{\"date\": \"2024-02-11\", \"env\": \"production\", \"batch_size\": 5000}"
    },
    {
      "rootDAGRunName": "database_backup",
      "rootDAGRunId": "20240211_150000_backup",
      "parentDAGRunName": "",
      "parentDAGRunId": "",
      "dagRunId": "20240211_150000_backup",
      "name": "database_backup",
      "status": 4,
      "statusLabel": "succeeded",
      "queuedAt": "",
      "startedAt": "2024-02-11T15:00:00Z",
      "finishedAt": "2024-02-11T15:45:30Z",
      "log": "/logs/database_backup/20240211_150000_backup.log",
      "params": "{\"target_db\": \"production\", \"retention_days\": 30}"
    },
    {
      "rootDAGRunName": "ml_training_pipeline",
      "rootDAGRunId": "20240211_143000_ml",
      "parentDAGRunName": "",
      "parentDAGRunId": "",
      "dagRunId": "20240211_143000_ml",
      "name": "ml_training_pipeline",
      "status": 5,
      "statusLabel": "queued",
      "queuedAt": "2024-02-11T14:30:00Z",
      "startedAt": "",
      "finishedAt": "",
      "log": "/logs/ml_training_pipeline/20240211_143000_ml.log",
      "params": "{\"model\": \"recommendation_v2\", \"dataset\": \"user_interactions\"}"
    }
  ],
  "nextCursor": "eyJvY2N1cnJlZEF0IjoiMjAyNC0wMi0xMVQxNDozMDowMFoiLCJkYWdSdW5JZCI6IjIwMjQwMjExXzE0MzAwMF9tbCJ9"
}
```

### Execute DAG Run from Inline Spec

**Endpoint**: `POST /api/v1/dag-runs`

Creates and starts a DAG-run directly from an inline YAML specification without writing a DAG file to disk.

**Query Parameters**:
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| remoteNode | string | Target remote node for execution | "local" |

**Request Body**:
```json
{
  "spec": "steps:\n  - name: extract\n    command: ./extract.sh",
  "name": "ad-hoc-extract",
  "params": "{\"env\":\"prod\"}",
  "dagRunId": "20241101_010203_custom",
  "singleton": true,
  "tags": ["inline"]
}
```

**Request Fields**:
| Field | Type | Description | Required |
|-------|------|-------------|----------|
| spec | string | DAG specification in YAML format | Yes |
| name | string | Override DAG name used for validation and execution | No |
| params | string | JSON string persisted with the DAG-run and exposed to steps | No |
| dagRunId | string | Explicit run identifier. If omitted, one is generated | No |
| singleton | boolean | When true, aborts with `409` if the DAG already has active or queued runs | No |
| tags | string[] | Additional tags for this DAG run. | No |

**Response (200)**:
```json
{
  "dagRunId": "20241101_010203_custom"
}
```

**Error Response (400)** - Invalid spec or missing `spec` field:
```json
{
  "code": "bad_request",
  "message": "spec is required"
}
```

**Error Response (409)** - Singleton guard or queue concurrency limit blocking execution:
```json
{
  "code": "max_run_reached",
  "message": "DAG ad-hoc-extract is already running, cannot start"
}
```

**Example**:
```bash
curl -X POST "http://localhost:8080/api/v1/dag-runs?remoteNode=local" \
  -H "Content-Type: application/json" \
  -d '{
        "spec": "steps:\n  - name: echo\n    command: echo \"hello\"",
        "name": "adhoc-hello",
        "params": "{\"requestedBy\":\"cli\"}"
      }'
```

### Enqueue DAG Run from Inline Spec

**Endpoint**: `POST /api/v1/dag-runs/enqueue`

Queues a DAG-run from an inline YAML spec without persisting a DAG file. The run follows queue semantics (global queue concurrency limits, queue overrides) and is started by the scheduler.

**Query Parameters**:
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| remoteNode | string | Target remote node for queuing | "local" |

**Request Body**:
```json
{
  "spec": "steps:\n  - name: sleep\n    command: sleep 60",
  "name": "queued-sleeper",
  "params": "{\"duration\":60}",
  "dagRunId": "queue_20241101_010203",
  "queue": "low-priority",
  "singleton": false,
  "tags": ["inline", "queued"]
}
```

**Request Fields**:
| Field | Type | Description | Required |
|-------|------|-------------|----------|
| spec | string | DAG specification in YAML format | Yes |
| name | string | Override DAG name if the spec omits one | No |
| params | string | JSON string saved with the queued run | No |
| dagRunId | string | Explicit run ID. When omitted, one is generated | No |
| queue | string | Queue name override for this run only | No |
| singleton | boolean | When true, aborts with `409` if the DAG already has active or queued runs | No |
| tags | string[] | Additional tags for this DAG run. | No |

**Response (200)**:
```json
{
  "dagRunId": "queue_20241101_010203"
}
```

**Error Response (409)** - DAG already queued or queue concurrency limit reached:
```json
{
  "code": "max_run_reached",
  "message": "DAG queued-sleeper is already in the queue, cannot enqueue"
}
```

**Example**:
```bash
curl -X POST "http://localhost:8080/api/v1/dag-runs/enqueue" \
  -H "Content-Type: application/json" \
  -d '{
        "spec": "steps:\n  - name: notify\n    command: ./notify.sh",
        "name": "queued-notify",
        "queue": "alerts"
      }'
```

### Get DAG Run Details

**Endpoint**: `GET /api/v1/dag-runs/{name}/{dagRunId}`

Fetches detailed status of a specific DAG run. You can use the special value "latest" as the dagRunId to retrieve the most recent DAG run for the specified DAG.

**Examples**:
- `GET /api/v1/dag-runs/data-pipeline/20240211_120000` - Get a specific run
- `GET /api/v1/dag-runs/data-pipeline/latest` - Get the latest run

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| name | string | DAG name |
| dagRunId | string | DAG run ID or "latest" |

**Response (200)**:
```json
{
  "dagRun": {
    "dagRunId": "20240211_120000",
    "name": "data-pipeline",
    "status": 4,
    "statusLabel": "succeeded",
    "startedAt": "2024-02-11T12:00:00Z",
    "finishedAt": "2024-02-11T12:15:00Z",
    "params": "{\"date\": \"2024-02-11\", \"env\": \"prod\"}",
    "nodes": [
      {
        "step": {
          "name": "extract",
          "command": "python extract.py"
        },
        "status": 4,
        "statusLabel": "succeeded",
        "startedAt": "2024-02-11T12:00:00Z",
        "finishedAt": "2024-02-11T12:05:00Z",
        "retryCount": 0,
        "stdout": "/logs/data-pipeline/20240211_120000/extract.out",
        "stderr": "/logs/data-pipeline/20240211_120000/extract.err"
      },
      {
        "step": {
          "name": "transform",
          "command": "python transform.py",
          "depends": ["extract"]
        },
        "status": 4,
        "statusLabel": "succeeded",
        "startedAt": "2024-02-11T12:05:00Z",
        "finishedAt": "2024-02-11T12:10:00Z",
        "retryCount": 0
      },
      {
        "step": {
          "name": "load",
          "run": "sub-workflow",
          "params": "TARGET=warehouse"
        },
        "status": 4,
        "statusLabel": "succeeded",
        "startedAt": "2024-02-11T12:10:00Z",
        "finishedAt": "2024-02-11T12:15:00Z",
        "subRuns": [
          {
            "dagRunId": "sub_20240211_121000",
            "name": "sub-workflow",
            "status": 4,
            "statusLabel": "succeeded"
          }
        ]
      }
    ]
  }
}
```

### Stop or Cancel DAG Run

**Endpoint**: `POST /api/v1/dag-runs/{name}/{dagRunId}/stop`

Forcefully stops a running DAG run, or cancels a failed root DAG run that is still pending DAG-level automatic retry.

**Response (200)**: Success

**Error Response (404)**:
```json
{
  "code": "not_found",
  "message": "DAG run not found"
}
```

**Error Response (400)**:
```json
{
  "code": "not_running",
  "message": "DAG is not currently running"
}
```

### Stop All DAG Runs

**Endpoint**: `POST /api/v1/dags/{fileName}/stop-all`

Forcefully stops all currently running instances of a DAG. This is useful when multiple instances of the same DAG are running simultaneously.

**Response (200)**: 
```json
{
  "errors": []
}
```

**Error Response (404)**:
```json
{
  "code": "not_found",
  "message": "DAG not found"
}
```

### Retry DAG Run

**Endpoint**: `POST /api/v1/dag-runs/{name}/{dagRunId}/retry`

Creates a new DAG run based on a previous execution.

**Request Body**:
```json
{
  "dagRunId": "new-run-id"
}
```

**Response (200)**: Success

**Error Response (404)**:
```json
{
  "code": "not_found",
  "message": "Original DAG run not found"
}
```

**Error Response (400)**:
```json
{
  "code": "already_running",
  "message": "Another instance of this DAG is already running"
}
```

### Reschedule DAG Run

**Endpoint**: `POST /api/v1/dag-runs/{name}/{dagRunId}/reschedule`

Launches a fresh DAG run by reusing the captured parameters from a historic execution. Useful for re-running successful or failed runs while keeping the original parameter set.

**Request Body**:
```json
{
  "dagRunId": "optional-new-id",
  "dagName": "optional-name-override"
}
```

**Request Fields**:
| Field | Type | Description | Required |
|-------|------|-------------|----------|
| dagRunId | string | Custom ID for the new run. If omitted a unique ID is generated. | No |
| dagName | string | Override the DAG name used for the rescheduled run. Must pass DAG name validation. | No |

Rescheduled runs always respect singleton mode. When the target DAG already has active or queued runs, the request is rejected.

**Response (200)**:
```json
{
  "dagRunId": "20241101_010203_xyz",
  "queued": false
}
```

**Error Response (409)** - When the DAG already has active or queued runs:
```json
{
  "code": "max_run_reached",
  "message": "DAG example_dag is already running, cannot start"
}
```

**Error Response (404)**:
```json
{
  "code": "not_found",
  "message": "DAG run not found"
}
```

### Dequeue DAG Run

**Endpoint**: `GET /api/v1/dag-runs/{name}/{dagRunId}/dequeue`

Removes a queued DAG run from the queue.

**Response (200)**: Success

**Error Response (404)**:
```json
{
  "code": "not_found",
  "message": "DAG run not found in queue"
}
```

## Log Endpoints

### Get DAG Run Log

**Endpoint**: `GET /api/v1/dag-runs/{name}/{dagRunId}/log`

Fetches the execution log for a DAG run.

**Query Parameters**:
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| tail | integer | Lines from end | - |
| head | integer | Lines from start | - |
| offset | integer | Start line (1-based) | - |
| limit | integer | Max lines (max 10000) | - |
| remoteNode | string | Remote node name | "local" |

**Response (200)**:
```json
{
  "content": "2024-02-11 14:00:00 INFO DAG data_processing_pipeline started\n2024-02-11 14:00:00 INFO Run ID: 20240211_140000_abc123\n2024-02-11 14:00:00 INFO Parameters: {\"date\": \"2024-02-11\", \"env\": \"production\", \"batch_size\": 5000}\n2024-02-11 14:00:00 INFO Checking preconditions...\n2024-02-11 14:00:01 INFO Precondition passed: Weekday check (current day: 7)\n2024-02-11 14:00:01 INFO Starting step: extract_data\n2024-02-11 14:00:30 INFO [extract_data] Executing: python extract.py --date 2024-02-11\n2024-02-11 14:15:45 INFO [extract_data] Step completed successfully\n2024-02-11 14:15:45 INFO [extract_data] Output saved to variable: EXTRACTED_FILE = /tmp/extracted_20240211.csv\n2024-02-11 14:15:45 INFO Starting step: transform_data\n2024-02-11 14:15:45 INFO [transform_data] Executing: python transform.py --input=/tmp/extracted_20240211.csv\n2024-02-11 14:30:20 INFO [transform_data] Step completed successfully\n2024-02-11 14:30:20 INFO [transform_data] Output saved to variable: TRANSFORMED_FILE = /tmp/transformed_20240211.csv\n2024-02-11 14:30:20 INFO Starting step: load_to_warehouse\n2024-02-11 14:30:20 INFO [load_to_warehouse] Running sub DAG: warehouse-loader\n2024-02-11 14:30:20 INFO [load_to_warehouse] Sub DAG started with ID: sub_20240211_143020_xyz456\n2024-02-11 14:45:30 INFO [load_to_warehouse] Sub DAG completed successfully\n2024-02-11 14:45:30 INFO Executing onSuccess handler: notify_success\n2024-02-11 14:45:32 INFO [notify_success] Handler completed\n2024-02-11 14:45:32 INFO Executing onExit handler: cleanup\n2024-02-11 14:45:35 INFO [cleanup] Handler completed\n2024-02-11 14:45:35 INFO DAG completed successfully\n",
  "lineCount": 22,
  "totalLines": 156,
  "hasMore": true,
  "isEstimate": false
}
```

### Get Step Log

**Endpoint**: `GET /api/v1/dag-runs/{name}/{dagRunId}/steps/{stepName}/log`

Fetches the log for a specific step.

**Query Parameters**:
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| stream | string | "stdout" or "stderr" | "stdout" |
| tail | integer | Lines from end | - |
| head | integer | Lines from start | - |
| offset | integer | Start line (1-based) | - |
| limit | integer | Max lines (max 10000) | - |

**Response (200)**:
```json
{
  "content": "2024-02-11 12:05:00 INFO Starting data transformation...\n2024-02-11 12:05:01 INFO Processing 1000 records\n2024-02-11 12:05:05 INFO Transformation complete\n",
  "lineCount": 3,
  "totalLines": 3,
  "hasMore": false,
  "isEstimate": false
}
```

**Response with stderr (200)**:
```json
{
  "content": "2024-02-11 12:05:02 WARNING Duplicate key found, skipping record ID: 123\n2024-02-11 12:05:03 WARNING Invalid date format in record ID: 456\n",
  "lineCount": 2,
  "totalLines": 2,
  "hasMore": false,
  "isEstimate": false
}
```

## DAG Run Outputs Endpoint

### Get DAG Run Outputs

**Endpoint**: `GET /api/v1/dag-runs/{name}/{dagRunId}/outputs`

Retrieves the collected outputs from a completed DAG run. Outputs are collected from steps that have an `output` field defined.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| name | string | DAG name |
| dagRunId | string | DAG run ID |

**Query Parameters**:
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| remoteNode | string | Remote node name | "local" |

**Response (200)**:
```json
{
  "metadata": {
    "dagName": "data-processing-pipeline",
    "dagRunId": "20240211_140000_abc123",
    "attemptId": "attempt_20240211_140000_001",
    "status": "succeeded",
    "completedAt": "2024-02-11T14:45:30Z",
    "params": "{\"date\": \"2024-02-11\", \"env\": \"production\"}"
  },
  "outputs": {
    "extractedFile": "/tmp/extracted_20240211.csv",
    "recordCount": "50000",
    "transformedFile": "/tmp/transformed_20240211.csv"
  }
}
```

**Response Fields**:
- `metadata`: Execution context for the outputs
  - `dagName`: Name of the executed DAG
  - `dagRunId`: Unique identifier for the DAG run
  - `attemptId`: Identifier for the specific execution attempt
  - `status`: Final status of the DAG run ("succeeded", "partially_succeeded", "failed", "rejected", "aborted")
  - `completedAt`: RFC3339 timestamp when execution completed
  - `params`: JSON-serialized parameters passed to the DAG
- `outputs`: Key-value pairs of collected outputs
  - Keys are converted from `SCREAMING_SNAKE_CASE` to `camelCase` by default
  - Custom keys can be specified using `output.key` in the step definition

**Response when no outputs (200)**:
```json
{
  "metadata": {
    "dagName": "",
    "dagRunId": "",
    "attemptId": "",
    "status": "",
    "completedAt": "0001-01-01T00:00:00Z"
  },
  "outputs": {}
}
```

**Error Response (404)**:
```json
{
  "code": "not_found",
  "message": "dag-run ID 20240211_140000_abc123 not found for DAG data-processing-pipeline"
}
```

**Notes**:
- Outputs are only available for completed DAG runs (succeeded, failed, or aborted)
- Secret values in outputs are automatically masked with `*******`
- Steps with `output.omit: true` are excluded from the outputs

**Example**:
```bash
# Get outputs from a specific DAG run
curl "http://localhost:8080/api/v1/dag-runs/data-processing-pipeline/20240211_140000_abc123/outputs" \
     -H "Authorization: Bearer your-token"

# Get outputs from the latest DAG run
curl "http://localhost:8080/api/v1/dag-runs/data-processing-pipeline/latest/outputs" \
     -H "Authorization: Bearer your-token"
```

## Step Management Endpoints

### Update Step Status

**Endpoint**: `PATCH /api/v1/dag-runs/{name}/{dagRunId}/steps/{stepName}/status`

Manually updates a step's execution status.

**Request Body**:
```json
{
  "status": 4
}
```

**Status Values**:
- 0: Not started
- 1: Running
- 2: Failed
- 3: Cancelled
- 4: Success
- 5: Skipped

**Response (200)**: Success

**Error Response (404)**:
```json
{
  "code": "not_found",
  "message": "Step not found in DAG run"
}
```

**Error Response (400)**:
```json
{
  "code": "bad_request",
  "message": "Invalid status value"
}
```

### Approve Step

**Endpoint**: `POST /api/v1/dag-runs/{name}/{dagRunId}/steps/{stepName}/approve`

Approves a step that is in Waiting status. If the step's `approval.input` defines input fields, the provided `inputs` are available as environment variables in subsequent steps.

**Request Body** (optional):
```json
{
  "inputs": {
    "FEEDBACK": "Looks good, proceed.",
    "PRIORITY": "high"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `inputs` | object | Key-value pairs injected as environment variables in subsequent steps. Keys must match `approval.input` if defined. |

**Response (200)**:
```json
{
  "dagRunId": "20240211_140000_abc123",
  "stepName": "deploy-staging",
  "resumed": true
}
```

| Field | Type | Description |
|-------|------|-------------|
| `dagRunId` | string | The DAG run ID |
| `stepName` | string | The approved step name |
| `resumed` | boolean | Whether the DAG run was re-enqueued for execution |

**Error Responses**:
- `400`: Step is not in Waiting status, or required inputs missing
- `404`: DAG-run or step not found

**Sub DAG variant**: `POST /api/v1/dag-runs/{name}/{dagRunId}/sub-dag-runs/{subDAGRunId}/steps/{stepName}/approve`

### Reject Step

**Endpoint**: `POST /api/v1/dag-runs/{name}/{dagRunId}/steps/{stepName}/reject`

Rejects a step that is in Waiting status. The step transitions to Rejected, the DAG status becomes `rejected`, dependent steps are aborted, and the `failure` handler runs.

**Request Body** (optional):
```json
{
  "reason": "Output quality insufficient"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `reason` | string | Optional reason for rejection |

**Response (200)**:
```json
{
  "dagRunId": "20240211_140000_abc123",
  "stepName": "deploy-staging"
}
```

**Error Responses**:
- `400`: Step is not in Waiting status
- `404`: DAG-run or step not found

**Sub DAG variant**: `POST /api/v1/dag-runs/{name}/{dagRunId}/sub-dag-runs/{subDAGRunId}/steps/{stepName}/reject`

### Push Back Step

**Endpoint**: `POST /api/v1/dag-runs/{name}/{dagRunId}/steps/{stepName}/push-back`

Pushes back a Waiting step for re-execution with feedback. The step is reset to `NotStarted`, the `approvalIteration` counter increments, any downstream dependents are also reset, and the step re-executes with the provided inputs injected as environment variables.

**Request Body** (optional):
```json
{
  "inputs": {
    "FEEDBACK": "Include error counts in the summary",
    "FORMAT": "markdown"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `inputs` | object | Key-value pairs injected as environment variables when the step re-executes |

**Response (200)**:
```json
{
  "dagRunId": "20240211_140000_abc123",
  "stepName": "generate-report",
  "approvalIteration": 2,
  "resumed": true
}
```

| Field | Type | Description |
|-------|------|-------------|
| `dagRunId` | string | The DAG run ID |
| `stepName` | string | The pushed-back step name |
| `approvalIteration` | integer | The approval iteration count after push-back |
| `resumed` | boolean | Whether the DAG run was re-enqueued for execution |

**Error Responses**:
- `400`: Step is not in Waiting status, step has no approval config, or required inputs missing
- `404`: DAG-run or step not found

**Sub DAG variant**: `POST /api/v1/dag-runs/{name}/{dagRunId}/sub-dag-runs/{subDAGRunId}/steps/{stepName}/push-back`

## Search Endpoints

### Search DAGs

**Endpoint**: `GET /api/v1/dags/search`

Performs full-text search across DAG definitions. This endpoint remains available for direct DAG search requests.

**Query Parameters**:
| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| q | string | Search query | Yes |
| remoteNode | string | Remote node name | No |

**Response (200)**:
```json
{
  "results": [
    {
      "name": "database_backup",
      "dag": {
        "name": "database_backup",
        "group": "Operations",
        "schedule": [{"expression": "0 0 * * 0"}],
        "description": "Weekly database backup job",
        "params": ["target_db", "retention_days"],
        "defaultParams": "{\"retention_days\": 30}",
        "tags": ["backup", "weekly", "critical"]
      },
      "matches": [
        {
          "line": "    command: pg_dump ${target_db} | gzip > backup_$(date +%Y%m%d).sql.gz",
          "lineNumber": 25,
          "startLine": 20
        },
        {
          "line": "description: Weekly database backup job",
          "lineNumber": 3,
          "startLine": 1
        }
      ]
    },
    {
      "name": "data_processing_pipeline",
      "dag": {
        "name": "data_processing_pipeline",
        "group": "ETL",
        "schedule": [
          {"expression": "0 2 * * *"},
          {"expression": "0 14 * * *"}
        ],
        "description": "Daily data processing pipeline for warehouse ETL",
        "params": ["date", "env", "batch_size"],
        "defaultParams": "{\"batch_size\": 1000, \"env\": \"dev\"}",
        "tags": ["production", "etl", "daily"]
      },
      "matches": [
        {
          "line": "      command: psql -h ${DB_HOST} -d analytics -c \"COPY data TO STDOUT\"",
          "lineNumber": 45,
          "startLine": 42
        }
      ]
    }
  ],
  "errors": []
}
```

### Search DAG Feed

**Endpoint**: `GET /api/v1/search/dags`

Returns lightweight cursor-based DAG search results for the global search page.

**Query Parameters**:
| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| q | string | Search query | Yes |
| limit | integer | Number of results to return (max 50) | No |
| cursor | string | Opaque cursor returned by a previous response | No |
| remoteNode | string | Remote node name | No |

Each result includes preview snippets plus `hasMoreMatches` and `nextMatchesCursor` for loading more snippets from that result.

**Response (200)**:
```json
{
  "results": [
    {
      "fileName": "database_backup",
      "name": "database_backup",
      "hasMoreMatches": true,
      "nextMatchesCursor": "eyJmaWxlTmFtZSI6ImRhdGFiYXNlX2JhY2t1cCJ9",
      "matches": [
        {
          "line": "    command: pg_dump ${target_db} | gzip > backup_$(date +%Y%m%d).sql.gz",
          "lineNumber": 25,
          "startLine": 20
        }
      ]
    }
  ],
  "hasMore": true,
  "nextCursor": "eyJmaWxlTmFtZSI6ImRhdGFiYXNlX2JhY2t1cCJ9"
}
```

### Search Document Feed

**Endpoint**: `GET /api/v1/search/docs`

Returns lightweight cursor-based document search results for the global search page.

**Query Parameters**:
| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| q | string | Search query | Yes |
| limit | integer | Number of results to return (max 50) | No |
| cursor | string | Opaque cursor returned by a previous response | No |
| remoteNode | string | Remote node name | No |

This endpoint is available only when document management is enabled.

**Response (200)**:
```json
{
  "results": [
    {
      "id": "runbooks/oncall",
      "title": "runbooks/oncall",
      "hasMoreMatches": false,
      "matches": [
        {
          "line": "Escalate to the database team when the replication lag exceeds 5 minutes.",
          "lineNumber": 18,
          "startLine": 16
        }
      ]
    }
  ],
  "hasMore": false
}
```

### Search DAG Match Snippets

**Endpoint**: `GET /api/v1/search/dags/{fileName}/matches`

Loads additional cursor-based snippets for one DAG search result.

**Query Parameters**:
| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| q | string | Search query | Yes |
| limit | integer | Number of snippets to return (max 50) | No |
| cursor | string | Opaque cursor returned by a previous snippet response | No |
| remoteNode | string | Remote node name | No |

**Response (200)**:
```json
{
  "matches": [
    {
      "line": "description: Weekly database backup job",
      "lineNumber": 3,
      "startLine": 1
    }
  ],
  "hasMore": false
}
```

### Search Document Match Snippets

**Endpoint**: `GET /api/v1/search/docs/matches`

Loads additional cursor-based snippets for one document search result.

**Query Parameters**:
| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| path | string | Document path | Yes |
| q | string | Search query | Yes |
| limit | integer | Number of snippets to return (max 50) | No |
| cursor | string | Opaque cursor returned by a previous snippet response | No |
| remoteNode | string | Remote node name | No |

### Event Logs

**Endpoint**: `GET /api/v1/event-logs`

Returns centralized operational event log entries. When builtin authentication is enabled, this endpoint requires a `manager` or `admin` role.

**Query Parameters**:
| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| kind | string | Event kind such as `dag_run` or `llm_usage` | No |
| type | string | Event type such as `dag.run.failed` or `llm.usage.recorded` | No |
| dagName | string | Filter by DAG name | No |
| dagRunId | string | Filter by DAG run ID | No |
| attemptId | string | Filter by attempt ID | No |
| sessionId | string | Filter by session ID | No |
| userId | string | Filter by user ID | No |
| model | string | Filter by model name | No |
| startTime | string | ISO 8601 start time filter | No |
| endTime | string | ISO 8601 end time filter | No |
| limit | integer | Number of entries to return (max 500) | No |
| offset | integer | Offset for compatibility pagination | No |
| paginationMode | string | `offset` or `cursor` | No |
| cursor | string | Opaque cursor for older entries | No |
| remoteNode | string | Remote node name | No |

If `cursor` is provided, cursor pagination is used automatically and `offset` must be omitted.

**Response (200)**:
```json
{
  "entries": [
    {
      "id": "dag_4ac3b3b9b16bdb10",
      "schemaVersion": 1,
      "occurredAt": "2026-04-05T08:05:12Z",
      "recordedAt": "2026-04-05T08:05:12Z",
      "kind": "dag_run",
      "type": "dag.run.failed",
      "sourceService": "scheduler",
      "sourceInstance": "worker-1:12345",
      "dagName": "nightly-report",
      "dagRunId": "20260405_080000_abc123",
      "attemptId": "attempt-1",
      "status": "failed",
      "data": {
        "trigger": "scheduler"
      }
    }
  ],
  "nextCursor": "eyJvY2N1cnJlZEF0IjoiMjAyNi0wNC0wNVQwODowNToxMloiLCJpZCI6ImRhZ180YWMzYjNiOWIxNmJkYjEwIn0"
}
```

### Get All Tags

**Endpoint**: `GET /api/v1/dags/tags`

Retrieves all unique tags used across DAGs.

**Query Parameters**:
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| remoteNode | string | Remote node name | "local" |

**Response (200)**:
```json
{
  "tags": [
    "backup",
    "critical",
    "daily",
    "data-quality",
    "etl",
    "experimental",
    "hourly",
    "maintenance",
    "ml",
    "monitoring",
    "production",
    "reporting",
    "staging",
    "testing",
    "weekly"
  ],
  "errors": []
}
```

**Response with Errors (200)**:
```json
{
  "tags": [
    "backup",
    "critical",
    "daily",
    "etl",
    "production"
  ],
  "errors": [
    "Error reading DAG file: malformed-etl.yaml - yaml: line 15: found unexpected end of stream",
    "Error reading DAG file: invalid-syntax.yaml - yaml: unmarshal errors:\n  line 8: field invalidField not found in type digraph.DAG"
  ]
}
```

## Monitoring Endpoints

### Prometheus Metrics

**Endpoint**: `GET /api/v1/metrics`

Returns Prometheus-compatible metrics.

**Response (200)** (text/plain):
```text
# HELP dagu_info Dagu build information
# TYPE dagu_info gauge
dagu_info{version="1.14.0",build_date="2024-01-01T12:00:00Z",go_version="1.21"} 1

# HELP dagu_uptime_seconds Time since server start
# TYPE dagu_uptime_seconds gauge
dagu_uptime_seconds 3600

# HELP dagu_dag_runs_currently_running Number of currently running DAG runs
# TYPE dagu_dag_runs_currently_running gauge
dagu_dag_runs_currently_running 5

# HELP dagu_dag_runs_queued_total Total number of DAG runs in queue
# TYPE dagu_dag_runs_queued_total gauge
dagu_dag_runs_queued_total 8

# HELP dagu_dag_runs_total Total number of DAG runs by status
# TYPE dagu_dag_runs_total counter
dagu_dag_runs_total{status="succeeded"} 2493
dagu_dag_runs_total{status="failed"} 15
dagu_dag_runs_total{status="aborted"} 7

# HELP dagu_dags_total Total number of DAGs
# TYPE dagu_dags_total gauge
dagu_dags_total 45

# HELP dagu_scheduler_running Whether the scheduler is running
# TYPE dagu_scheduler_running gauge
dagu_scheduler_running 1
```

## Error Handling

All endpoints return structured error responses:

```json
{
  "code": "error_code",
  "message": "Human readable error message",
  "details": {
    "additional": "error details"
  }
}
```

**Error Codes**:
| Code | Description |
|------|-------------|
| forbidden | Insufficient permissions |
| bad_request | Invalid request parameters |
| not_found | Resource doesn't exist |
| internal_error | Server-side error |
| unauthorized | Authentication failed |
| bad_gateway | Upstream service error |
| remote_node_error | Remote node connection failed |
| already_running | DAG is already running |
| not_running | DAG is not running |
| already_exists | Resource already exists |

## Sub DAG Run Endpoints

### Get Sub DAG Runs with Timing Information

**Endpoint**: `GET /api/v1/dag-runs/{name}/{dagRunId}/sub-dag-runs`

Retrieves timing and status information for all sub DAG runs within a specific DAG run. This is useful for tracking repeated executions of sub DAG steps and understanding the timeline of sub workflows.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| name | string | DAG name |
| dagRunId | string | DAG run ID |

**Query Parameters**:
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| remoteNode | string | Remote node name | "local" |

**Response (200)**:
```json
{
  "subRuns": [
    {
      "dagRunId": "sub_20240211_143020_001",
      "params": "{\"file\": \"/tmp/data_batch_1.csv\", \"table\": \"fact_sales\"}",
      "status": 4,
      "statusLabel": "succeeded",
      "startedAt": "2024-02-11T14:30:20Z",
      "finishedAt": "2024-02-11T14:35:45Z"
    },
    {
      "dagRunId": "sub_20240211_143600_002",
      "params": "{\"file\": \"/tmp/data_batch_2.csv\", \"table\": \"fact_sales\"}",
      "status": 4,
      "statusLabel": "succeeded",
      "startedAt": "2024-02-11T14:36:00Z",
      "finishedAt": "2024-02-11T14:41:30Z"
    },
    {
      "dagRunId": "sub_20240211_144200_003",
      "params": "{\"file\": \"/tmp/data_batch_3.csv\", \"table\": \"fact_sales\"}",
      "status": 1,
      "statusLabel": "running",
      "startedAt": "2024-02-11T14:42:00Z",
      "finishedAt": null
    }
  ]
}
```

**Response Fields**:
- `subRuns`: Array of sub DAG run details with timing information
- `dagRunId`: Unique identifier for the sub DAG run
- `params`: JSON string of parameters passed to the sub DAG
- `status`: Execution status (0-6, see status values below)
- `statusLabel`: Human-readable status label
- `startedAt`: ISO 8601 timestamp when the sub DAG run started
- `finishedAt`: ISO 8601 timestamp when the sub DAG run finished (null if still running)

**Status Values**:
- 0: Not started
- 1: Running
- 2: Failed
- 3: Cancelled
- 4: Success
- 5: Queued
- 6: Partial Success

**Error Response (404)**:
```json
{
  "code": "not_found",
  "message": "DAG run not found"
}
```

**Use Case**:
This endpoint is particularly useful for nodes with `repeat_policy` that execute sub DAGs multiple times. It allows the UI to display a timeline of all executions with their respective start times, end times, and statuses, making it easier to track and debug repeated sub workflow executions.

### Get Sub DAG Run Details

**Endpoint**: `GET /api/v1/dag-runs/{name}/{dagRunId}/sub-dag-runs/{subDAGRunId}`

Fetches detailed status of a sub DAG run.

**Response (200)**:
```json
{
  "dagRunDetails": {
    "rootDAGRunName": "data_processing_pipeline",
    "rootDAGRunId": "20240211_140000_abc123",
    "parentDAGRunName": "data_processing_pipeline",
    "parentDAGRunId": "20240211_140000_abc123",
    "dagRunId": "sub_20240211_143020_xyz456",
    "name": "warehouse_loader_subdag",
    "status": 4,
    "statusLabel": "succeeded",
    "queuedAt": "",
    "startedAt": "2024-02-11T14:30:20Z",
    "finishedAt": "2024-02-11T14:45:30Z",
    "log": "/logs/warehouse_loader_subdag/sub_20240211_143020_xyz456.log",
    "params": "{\"file\": \"/tmp/transformed_20240211.csv\", \"table\": \"fact_sales\"}",
    "nodes": [
      {
        "step": {
          "name": "validate_schema",
          "command": "validate_schema.py",
          "args": [],
          "depends": []
        },
        "stdout": "/logs/warehouse_loader_subdag/sub_20240211_143020_xyz456/validate_schema.stdout",
        "stderr": "/logs/warehouse_loader_subdag/sub_20240211_143020_xyz456/validate_schema.stderr",
        "startedAt": "2024-02-11T14:30:20Z",
        "finishedAt": "2024-02-11T14:30:35Z",
        "status": 4,
        "statusLabel": "succeeded",
        "retryCount": 0,
        "doneCount": 1,
        "subRuns": [],
        "subRunsRepeated": [],
        "error": ""
      },
      {
        "step": {
          "name": "load_data",
          "command": "load_to_warehouse.py",
          "depends": ["validate_schema"]
        },
        "stdout": "/logs/warehouse_loader_subdag/sub_20240211_143020_xyz456/load_data.stdout",
        "stderr": "/logs/warehouse_loader_subdag/sub_20240211_143020_xyz456/load_data.stderr",
        "startedAt": "2024-02-11T14:30:35Z",
        "finishedAt": "2024-02-11T14:45:30Z",
        "status": 4,
        "statusLabel": "succeeded",
        "retryCount": 0,
        "doneCount": 1,
        "subRuns": [],
        "subRunsRepeated": [],
        "error": ""
      }
    ],
    "onExit": null,
    "onSuccess": null,
    "onFailure": null,
    "onAbort": null,
    "preconditions": []
  }
}
```

### Get Sub DAG Run Log

**Endpoint**: `GET /api/v1/dag-runs/{name}/{dagRunId}/sub-dag-runs/{subDAGRunId}/log`

Fetches the log for a sub DAG run.

**Response (200)**:
```json
{
  "content": "2024-02-11 14:30:20 INFO Starting sub DAG: warehouse_loader_subdag\n2024-02-11 14:30:20 INFO Parameters: {\"file\": \"/tmp/transformed_20240211.csv\", \"table\": \"fact_sales\"}\n2024-02-11 14:30:20 INFO Parent DAG: data_processing_pipeline (20240211_140000_abc123)\n2024-02-11 14:30:20 INFO Step 'validate_schema' started\n2024-02-11 14:30:22 INFO Schema validation: Checking table structure for 'fact_sales'\n2024-02-11 14:30:35 INFO Step 'validate_schema' completed successfully\n2024-02-11 14:30:35 INFO Step 'load_data' started\n2024-02-11 14:30:36 INFO Opening file: /tmp/transformed_20240211.csv\n2024-02-11 14:30:37 INFO File contains 50000 records\n2024-02-11 14:30:38 INFO Beginning bulk insert to warehouse.fact_sales\n2024-02-11 14:35:00 INFO Progress: 25000/50000 records loaded (50%)\n2024-02-11 14:40:00 INFO Progress: 45000/50000 records loaded (90%)\n2024-02-11 14:45:28 INFO All 50000 records loaded successfully\n2024-02-11 14:45:29 INFO Committing transaction\n2024-02-11 14:45:30 INFO Step 'load_data' completed successfully\n2024-02-11 14:45:30 INFO Sub DAG completed successfully\n",
  "lineCount": 7,
  "totalLines": 7,
  "hasMore": false,
  "isEstimate": false
}
```

### Get Child Step Log

**Endpoint**: `GET /api/v1/dag-runs/{name}/{dagRunId}/sub-dag-runs/{subDAGRunId}/steps/{stepName}/log`

Fetches the log for a step in a sub DAG run.

**Response (200)**:
```json
{
  "content": "2024-02-11 14:30:35 INFO Step 'load_data' started\n2024-02-11 14:30:36 INFO Opening file: /tmp/transformed_20240211.csv\n2024-02-11 14:30:37 INFO File contains 50000 records\n2024-02-11 14:30:38 INFO Beginning bulk insert to warehouse.fact_sales\n2024-02-11 14:30:39 INFO Using batch size: 5000\n2024-02-11 14:30:40 INFO Processing batch 1 of 10\n2024-02-11 14:32:00 INFO Batch 1 complete (5000 records)\n2024-02-11 14:33:20 INFO Processing batch 2 of 10\n2024-02-11 14:34:40 INFO Batch 2 complete (10000 records)\n2024-02-11 14:36:00 INFO Processing batch 3 of 10\n2024-02-11 14:37:20 INFO Batch 3 complete (15000 records)\n2024-02-11 14:38:40 INFO Processing batch 4 of 10\n2024-02-11 14:40:00 INFO Batch 4 complete (20000 records)\n2024-02-11 14:41:20 INFO Processing batch 5 of 10\n2024-02-11 14:42:40 INFO Batch 5 complete (25000 records)\n[... truncated for brevity ...]\n2024-02-11 14:45:28 INFO All 50000 records loaded successfully\n2024-02-11 14:45:29 INFO Committing transaction\n2024-02-11 14:45:30 INFO Step 'load_data' completed successfully\n",
  "lineCount": 50,
  "totalLines": 156,
  "hasMore": true,
  "isEstimate": false
}
```

### Update Child Step Status

**Endpoint**: `PATCH /api/v1/dag-runs/{name}/{dagRunId}/sub-dag-runs/{subDAGRunId}/steps/{stepName}/status`

Updates the status of a step in a sub DAG run.

**Request Body**:
```json
{
  "status": 4
}
```

**Response (200)**: Success

**Error Response (404)**:
```json
{
  "code": "not_found",
  "message": "Sub DAG run or step not found"
}
```

## Queue Management Endpoints

### List All Queues

**Endpoint**: `GET /api/v1/queues`

Retrieves queue summaries. Use `GET /api/v1/queues/{name}/items` to fetch paginated running or queued items for a specific queue.

**Response (200)**:
```json
{
  "queues": [
    {
      "name": "critical",
      "type": "global",
      "maxConcurrency": 2,
      "runningCount": 1,
      "queuedCount": 2,
      "running": [
        {
          "dagRunId": "20240211_140000_abc123",
          "name": "data_processing_pipeline",
          "status": 1,
          "statusLabel": "running",
          "startedAt": "2024-02-11T14:00:00Z",
          "finishedAt": "",
          "log": "/logs/data_processing_pipeline/20240211_140000_abc123.log"
        }
      ]
    },
    {
      "name": "backup_job",
      "type": "dag-based",
      "runningCount": 1,
      "queuedCount": 0,
      "running": [
        {
          "dagRunId": "20240211_150000_backup",
          "name": "backup_job",
          "status": 1,
          "statusLabel": "running",
          "startedAt": "2024-02-11T15:00:00Z",
          "finishedAt": "",
          "log": "/logs/backup_job/20240211_150000_backup.log"
        }
      ],
      "maxConcurrency": 1
    }
  ],
  "summary": {
    "totalQueues": 2,
    "totalRunning": 2,
    "totalQueued": 2,
    "totalCapacity": 3,
    "utilizationPercentage": 66.666664
  }
}
```

**Response Fields**:
- `queues`: Queue summary objects
- `type`: `global` for configured global queues, `dag-based` when the DAG name itself acts as the queue
- `running`: Only currently running DAG-runs are embedded here
- `summary`: Capacity and utilization totals across all queues

### List Queue Items

**Endpoint**: `GET /api/v1/queues/{name}/items`

Returns paginated items for one queue.

**Query Parameters**:
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| type | string | `queued` or `running` | `queued` |
| page | integer | Page number | 1 |
| perPage | integer | Items per page | 50 |
| remoteNode | string | Remote node name | "local" |

**Response (200)**:
```json
{
  "items": [
    {
      "dagRunId": "20240211_143000_def456",
      "name": "ml_training_pipeline",
      "status": 5,
      "statusLabel": "queued",
      "queuedAt": "2024-02-11T14:30:00Z",
      "startedAt": "",
      "finishedAt": "",
      "log": "/logs/ml_training_pipeline/20240211_143000_def456.log"
    }
  ],
  "pagination": {
    "totalRecords": 2,
    "currentPage": 1,
    "totalPages": 2,
    "nextPage": 2,
    "prevPage": null
  }
}
```

**Error Response (500)**:
```json
{
  "code": "internal_error",
  "message": "Failed to retrieve queue information"
}
```

## Additional Endpoints

### List DAG Runs by Name

**Endpoint**: `GET /api/v1/dag-runs/{name}`

Lists DAG runs for a specific DAG name using forward-only cursor pagination.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| name | string | DAG name |

**Query Parameters**:
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| status | integer | Filter by status (0-8) | - |
| fromDate | integer | Unix timestamp start | - |
| toDate | integer | Unix timestamp end | - |
| dagRunId | string | Filter by run ID | - |
| limit | integer | Page size (max 500) | 100 |
| cursor | string | Opaque cursor returned by the previous page | - |
| remoteNode | string | Remote node name | "local" |

Use `nextCursor` from the previous response to continue loading older runs.

**Response (200)**:
```json
{
  "dagRuns": [
    {
      "rootDAGRunName": "data_processing_pipeline",
      "rootDAGRunId": "20240211_140000_abc123",
      "parentDAGRunName": "",
      "parentDAGRunId": "",
      "dagRunId": "20240211_140000_abc123",
      "name": "data_processing_pipeline",
      "status": 4,
      "statusLabel": "succeeded",
      "queuedAt": "",
      "startedAt": "2024-02-11T14:00:00Z",
      "finishedAt": "2024-02-11T14:45:30Z",
      "log": "/logs/data_processing_pipeline/20240211_140000_abc123.log",
      "params": "{\"date\": \"2024-02-11\", \"env\": \"production\", \"batch_size\": 5000}"
    },
    {
      "rootDAGRunName": "data_processing_pipeline",
      "rootDAGRunId": "20240211_020000_def456",
      "parentDAGRunName": "",
      "parentDAGRunId": "",
      "dagRunId": "20240211_020000_def456",
      "name": "data_processing_pipeline",
      "status": 2,
      "statusLabel": "failed",
      "queuedAt": "",
      "startedAt": "2024-02-11T02:00:00Z",
      "finishedAt": "2024-02-11T02:15:45Z",
      "log": "/logs/data_processing_pipeline/20240211_020000_def456.log",
      "params": "{\"date\": \"2024-02-11\", \"env\": \"production\", \"batch_size\": 5000}"
    }
  ],
  "nextCursor": "eyJvY2N1cnJlZEF0IjoiMjAyNC0wMi0xMVQxNDowMDowMFoiLCJkYWdSdW5JZCI6IjIwMjQwMjExXzE0MzAwMF9tbCJ9"
}
```

## Example Usage

### Start a DAG with Parameters
```bash
curl -X POST "http://localhost:8080/api/v1/dags/data-processing-pipeline/start" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer your-token" \
     -d '{
       "params": "{\"date\": \"2024-02-11\", \"env\": \"production\", \"batch_size\": 5000}",
       "dagRunId": "manual_20240211_160000"
     }'
```

**Response**:
```json
{
  "dagRunId": "manual_20240211_160000"
}
```

### Start a DAG with Singleton Mode
```bash
curl -X POST "http://localhost:8080/api/v1/dags/critical-job/start" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer your-token" \
     -d '{
       "singleton": true,
       "params": "{\"priority\": \"high\"}"
     }'
```

**Response if DAG is not running (200)**:
```json
{
  "dagRunId": "20240211_161500_xyz789"
}
```

**Response if DAG is already running (409)**:
```json
{
  "code": "already_running",
  "message": "DAG critical-job is already running, cannot start in singleton mode"
}
```

### Check DAG Run Status
```bash
curl "http://localhost:8080/api/v1/dag-runs/data-processing-pipeline/latest" \
     -H "Authorization: Bearer your-token"
```

**Response**:
```json
{
  "dagRunDetails": {
    "rootDAGRunName": "data_processing_pipeline",
    "rootDAGRunId": "20240211_160000_current",
    "parentDAGRunName": "",
    "parentDAGRunId": "",
    "dagRunId": "20240211_160000_current",
    "name": "data_processing_pipeline",
    "status": 1,
    "statusLabel": "running",
    "queuedAt": "",
    "startedAt": "2024-02-11T16:00:00Z",
    "finishedAt": "",
    "log": "/logs/data_processing_pipeline/20240211_160000_current.log",
    "params": "{\"date\": \"2024-02-11\", \"env\": \"production\", \"batch_size\": 5000}",
    "nodes": [
      {
        "step": {
          "name": "extract_data",
          "id": "extract"
        },
        "status": 4,
        "statusLabel": "succeeded",
        "startedAt": "2024-02-11T16:00:30Z",
        "finishedAt": "2024-02-11T16:15:45Z",
        "retryCount": 0,
        "doneCount": 1
      },
      {
        "step": {
          "name": "transform_data",
          "id": "transform"
        },
        "status": 1,
        "statusLabel": "running",
        "startedAt": "2024-02-11T16:15:45Z",
        "finishedAt": "",
        "retryCount": 0,
        "doneCount": 0
      },
      {
        "step": {
          "name": "load_to_warehouse",
          "id": "load"
        },
        "status": 0,
        "statusLabel": "not_started",
        "startedAt": "",
        "finishedAt": "",
        "retryCount": 0,
        "doneCount": 0
      }
    ]
  }
}
```

### Search for DAGs
```bash
curl "http://localhost:8080/api/v1/dags/search?q=database" \
     -H "Authorization: Bearer your-token"
```

**Response**:
```json
{
  "results": [
    {
      "name": "database_backup",
      "dag": {
        "name": "database_backup",
        "group": "Operations",
        "schedule": [{"expression": "0 0 * * 0"}],
        "description": "Weekly database backup job",
        "params": ["target_db", "retention_days"],
        "defaultParams": "{\"retention_days\": 30}",
        "tags": ["backup", "weekly", "critical"]
      },
      "matches": [
        {
          "line": "    command: pg_dump ${target_db} | gzip > backup_$(date +%Y%m%d).sql.gz",
          "lineNumber": 25,
          "startLine": 20
        }
      ]
    }
  ],
  "errors": []
}
```

### Get Metrics for Monitoring
```bash
curl "http://localhost:8080/api/v1/metrics" | grep dagu_dag_runs_currently_running
```

### Stop a Running DAG
```bash
curl -X POST "http://localhost:8080/api/v1/dag-runs/data-pipeline/20240211_120000/stop" \
     -H "Authorization: Bearer your-token"
```

### Update Step Status Manually
```bash
# Mark a failed step as successful
curl -X PATCH "http://localhost:8080/api/v1/dag-runs/data-processing-pipeline/20240211_020000_def456/steps/transform_data/status" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer your-token" \
     -d '{"status": 4}'
```

**Response (200)**: Success (empty response body)

### Approve a Waiting Step
```bash
curl -X POST "http://localhost:8080/api/v1/dag-runs/deploy-pipeline/20240211_120000/steps/deploy-staging/approve" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer your-token" \
     -d '{"inputs": {"APPROVED_BY": "ops-team"}}'
```

### Reject a Waiting Step
```bash
curl -X POST "http://localhost:8080/api/v1/dag-runs/deploy-pipeline/20240211_120000/steps/deploy-staging/reject" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer your-token" \
     -d '{"reason": "Not ready for production"}'
```

### Push Back a Waiting Step
```bash
curl -X POST "http://localhost:8080/api/v1/dag-runs/report-pipeline/20240211_120000/steps/generate-report/push-back" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer your-token" \
     -d '{"inputs": {"FEEDBACK": "Include error counts"}}'
```

### Enqueue a DAG Run
```bash
curl -X POST "http://localhost:8080/api/v1/dags/ml-training-pipeline/enqueue" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer your-token" \
     -d '{
       "params": "{\"model\": \"recommendation_v3\", \"dataset\": \"user_interactions_2024\"}",
       "dagRunId": "ml_train_20240211_170000",
       "dagName": "ml-training-on-demand",
       "queue": "gpu-jobs"
     }'
```

**Response**:
```json
{
  "dagRunId": "ml_train_20240211_170000"
}
```

### Get Logs with Pagination
```bash
# Get last 100 lines of a DAG run log
curl "http://localhost:8080/api/v1/dag-runs/etl-pipeline/20240211_120000/log?tail=100"

# Get specific step's stderr output
curl "http://localhost:8080/api/v1/dag-runs/etl-pipeline/20240211_120000/steps/transform/log?stream=stderr"

# Get logs with offset and limit
curl "http://localhost:8080/api/v1/dag-runs/etl-pipeline/20240211_120000/log?offset=1000&limit=500"
```

### Working with Sub DAGs
```bash
# Get all sub DAG runs with timing information
curl "http://localhost:8080/api/v1/dag-runs/data-processing-pipeline/20240211_140000_abc123/sub-dag-runs" \
     -H "Authorization: Bearer your-token"

# Get sub DAG run details
curl "http://localhost:8080/api/v1/dag-runs/data-processing-pipeline/20240211_140000_abc123/sub-dag-runs/sub_20240211_143020_xyz456" \
     -H "Authorization: Bearer your-token"

# Get sub DAG step log
curl "http://localhost:8080/api/v1/dag-runs/data-processing-pipeline/20240211_140000_abc123/sub-dag-runs/sub_20240211_143020_xyz456/steps/load_data/log" \
     -H "Authorization: Bearer your-token"

# Update sub DAG step status
curl -X PATCH "http://localhost:8080/api/v1/dag-runs/data-processing-pipeline/20240211_140000_abc123/sub-dag-runs/sub_20240211_143020_xyz456/steps/load_data/status" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer your-token" \
     -d '{"status": 4}'
```

### Rename a DAG
```bash
curl -X POST "http://localhost:8080/api/v1/dags/old-pipeline-name/rename" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer your-token" \
     -d '{"newFileName": "new-pipeline-name"}'
```

**Response (200)**: Success (empty response body)

### Delete a DAG
```bash
curl -X DELETE "http://localhost:8080/api/v1/dags/deprecated-pipeline" \
     -H "Authorization: Bearer your-token"
```

**Response (204)**: No content (successful deletion)

### Get DAG Specification YAML
```bash
curl "http://localhost:8080/api/v1/dags/data-processing-pipeline/spec" \
     -H "Authorization: Bearer your-token"
```

**Response**:
```json
{
  "dag": {
    "name": "data_processing_pipeline",
    "group": "ETL"
  },
  "spec": "name: data_processing_pipeline\ngroup: ETL\nschedule:\n  - \"0 2 * * *\"\n  - \"0 14 * * *\"\ndescription: Daily data processing pipeline for warehouse ETL\nenv:\n  - DATA_SOURCE=postgres://prod-db:5432/analytics\n  - WAREHOUSE_URL=${WAREHOUSE_URL}\nlog_dir: /var/log/dagu/pipelines\nhist_retention_days: 30\nmax_active_runs: 1\nmax_active_steps: 5\nparams:\n  - date\n  - env\n  - batch_size=1000\ntags:\n  - production\n  - etl\n  - daily\npreconditions:\n  - condition: \"`date +%u`\"\n    expected: \"re:[1-5]\"\n    error: Pipeline only runs on weekdays\ntype: graph\nsteps:\n  - name: extract_data\n    id: extract\n    description: Extract data from source database\n    dir: /app/etl\n    command: python\n    args:\n      - extract.py\n      - --date\n      - ${date}\n    stdout: /logs/extract.out\n    stderr: /logs/extract.err\n    output: EXTRACTED_FILE\n    preconditions:\n      - condition: test -f /data/ready.flag\n  - name: transform_data\n    id: transform\n    description: Apply transformations to extracted data\n    command: python transform.py --input=${EXTRACTED_FILE}\n    depends:\n      - extract_data\n    output: TRANSFORMED_FILE\n    mail_on_error: true\n  - name: load_to_warehouse\n    id: load\n    run: warehouse-loader\n    params: |\n      file: ${TRANSFORMED_FILE}\n      table: fact_sales\n    depends:\n      - transform_data\nhandler_on:\n  success:\n    command: notify.sh 'Pipeline completed successfully'\n  failure:\n    command: alert.sh 'Pipeline failed' high\n  exit:\n    command: cleanup_temp_files.sh\n",
  "errors": []
}
```

### Complex Filtering Examples
```bash
# Get all failed DAG runs in the last 24 hours
curl "http://localhost:8080/api/v1/dag-runs?status=2&fromDate=$(date -d '24 hours ago' +%s)" \
     -H "Authorization: Bearer your-token"

# Get DAG runs for a specific DAG with cursor pagination
curl "http://localhost:8080/api/v1/dag-runs?name=data-processing-pipeline&limit=20" \
     -H "Authorization: Bearer your-token"

# Search for DAGs with specific tags
curl "http://localhost:8080/api/v1/dags?tags=production&page=1&perPage=50" \
     -H "Authorization: Bearer your-token"

# Get running DAG runs
curl "http://localhost:8080/api/v1/dag-runs?status=1" \
     -H "Authorization: Bearer your-token"

# Get queued DAG runs
curl "http://localhost:8080/api/v1/dag-runs?status=5" \
     -H "Authorization: Bearer your-token"

# View all execution queues with running and queued DAG runs
curl "http://localhost:8080/api/v1/queues" \
     -H "Authorization: Bearer your-token"

# Load queued items from one queue
curl "http://localhost:8080/api/v1/queues/default/items?type=queued&page=1&perPage=20" \
     -H "Authorization: Bearer your-token"
```

### Suspend/Resume DAG Scheduling
```bash
# Suspend a DAG
curl -X POST "http://localhost:8080/api/v1/dags/data-processing-pipeline/suspend" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer your-token" \
     -d '{"suspend": true}'

# Resume a DAG
curl -X POST "http://localhost:8080/api/v1/dags/data-processing-pipeline/suspend" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer your-token" \
     -d '{"suspend": false}'
```

**Response (200)**: Success (empty response body)

## API Response Status Codes Summary

| Status Code | Description | Common Scenarios |
|-------------|-------------|------------------|
| 200 | Success | Successful GET, POST, PUT, PATCH requests |
| 201 | Created | New DAG created successfully |
| 204 | No Content | Successful DELETE operation |
| 400 | Bad Request | Invalid parameters, malformed JSON, invalid DAG name format |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Insufficient permissions (e.g., no write access) |
| 404 | Not Found | DAG, DAG run, or resource doesn't exist |
| 409 | Conflict | Resource already exists (e.g., DAG name conflict) |
| 500 | Internal Error | Server-side processing error |
| 503 | Service Unavailable | Server unhealthy or scheduler not responding |

## API Key Endpoints

API key management endpoints require Builtin Authentication mode and admin role.

### List API Keys

**Endpoint**: `GET /api/v1/api-keys`

Retrieves all API keys. Requires admin role.

**Response (200)**:
```json
{
  "apiKeys": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "ci-pipeline",
      "description": "API key for CI/CD pipeline",
      "role": "operator",
      "keyPrefix": "dagu_7Kq",
      "createdAt": "2024-02-11T12:00:00Z",
      "updatedAt": "2024-02-11T12:00:00Z",
      "createdBy": "admin-user-id",
      "lastUsedAt": "2024-02-11T15:30:00Z"
    }
  ]
}
```

### Create API Key

**Endpoint**: `POST /api/v1/api-keys`

Creates a new API key. Requires admin role.

**Request Body**:
```json
{
  "name": "ci-pipeline",
  "description": "API key for CI/CD pipeline",
  "role": "operator"
}
```

**Request Fields**:
| Field | Type | Description | Required |
|-------|------|-------------|----------|
| name | string | Human-readable name (1-100 chars) | Yes |
| description | string | Optional description (max 500 chars) | No |
| role | string | Role: "admin", "manager", "operator", "viewer" | Yes |

**Response (201)**:
```json
{
  "apiKey": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "ci-pipeline",
    "description": "API key for CI/CD pipeline",
    "role": "operator",
    "keyPrefix": "dagu_7Kq",
    "createdAt": "2024-02-11T12:00:00Z",
    "updatedAt": "2024-02-11T12:00:00Z",
    "createdBy": "admin-user-id"
  },
  "key": "dagu_7Kq9mXxN3pLwR5tY2vZa8bCdEfGhJk4n6sUwXy0zA1B"
}
```

::: warning
The `key` field contains the full API key secret and is **only returned once** at creation time. Store it securely.
:::

**Error Response (409)**:
```json
{
  "code": "already_exists",
  "message": "API key with this name already exists"
}
```

### Get API Key

**Endpoint**: `GET /api/v1/api-keys/{keyId}`

Retrieves a specific API key by ID. Requires admin role.

**Response (200)**:
```json
{
  "apiKey": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "ci-pipeline",
    "description": "API key for CI/CD pipeline",
    "role": "operator",
    "keyPrefix": "dagu_7Kq",
    "createdAt": "2024-02-11T12:00:00Z",
    "updatedAt": "2024-02-11T12:00:00Z",
    "createdBy": "admin-user-id",
    "lastUsedAt": "2024-02-11T15:30:00Z"
  }
}
```

**Error Response (404)**:
```json
{
  "code": "not_found",
  "message": "API key not found"
}
```

### Update API Key

**Endpoint**: `PATCH /api/v1/api-keys/{keyId}`

Updates an API key's metadata. Requires admin role.

**Request Body**:
```json
{
  "name": "production-ci",
  "description": "Updated description",
  "role": "manager"
}
```

All fields are optional. Only provided fields are updated.

**Response (200)**:
```json
{
  "apiKey": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "production-ci",
    "description": "Updated description",
    "role": "manager",
    "keyPrefix": "dagu_7Kq",
    "createdAt": "2024-02-11T12:00:00Z",
    "updatedAt": "2024-02-11T16:00:00Z",
    "createdBy": "admin-user-id",
    "lastUsedAt": "2024-02-11T15:30:00Z"
  }
}
```

**Error Response (409)**:
```json
{
  "code": "already_exists",
  "message": "API key with this name already exists"
}
```

### Delete API Key

**Endpoint**: `DELETE /api/v1/api-keys/{keyId}`

Deletes (revokes) an API key. Requires admin role.

**Response (204)**: No content

**Error Response (404)**:
```json
{
  "code": "not_found",
  "message": "API key not found"
}
```

### Example: Full API Key Workflow

```bash
# 1. Login as admin to get JWT token
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin-password"}' | jq -r '.token')

# 2. Create an API key
API_KEY=$(curl -s -X POST http://localhost:8080/api/v1/api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "automation", "role": "operator"}' | jq -r '.key')

echo "Created API key: $API_KEY"

# 3. Use the API key for subsequent requests
curl -H "Authorization: Bearer $API_KEY" \
  http://localhost:8080/api/v1/dags

# 4. Start a DAG with the API key
curl -X POST http://localhost:8080/api/v1/dags/my-dag/start \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"params": "{\"env\": \"production\"}"}'
```

## Webhook Endpoints

Webhooks allow external systems to trigger DAG executions via HTTP with DAG-specific tokens. Unlike API keys which provide general API access, webhooks are designed for integration with external services like CI/CD pipelines, GitHub, Slack, etc.

Webhook management endpoints require Builtin Authentication mode and admin role.

### Trigger DAG via Webhook

**Endpoint**: `POST /api/v1/webhooks/{fileName}`

Triggers a DAG execution using a webhook token. This endpoint uses webhook token authentication instead of regular API authentication.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| fileName | string | DAG file name |

**Request Headers**:
| Header | Description |
|--------|-------------|
| Authorization | `Bearer <webhook-token>` |

**Request Body** (optional):
```json
{
  "dagRunId": "custom-run-id",
  "payload": {"key": "value"}
}
```

**Request Fields**:
| Field | Type | Description | Required |
|-------|------|-------------|----------|
| dagRunId | string | Custom run ID for idempotency | No |
| payload | object | Data passed to DAG as WEBHOOK_PAYLOAD env var | No |

**Response (200)**:
```json
{
  "dagRunId": "20240211_120000_abc123",
  "dagName": "my-dag"
}
```

**Error Response (401)** - Missing or invalid token:
```json
{
  "code": "unauthorized",
  "message": "Invalid or missing webhook token"
}
```

**Error Response (403)** - Webhook disabled:
```json
{
  "code": "forbidden",
  "message": "Webhook is disabled"
}
```

**Error Response (404)** - DAG or webhook not found:
```json
{
  "code": "not_found",
  "message": "DAG not found"
}
```

**Error Response (409)** - Duplicate dagRunId:
```json
{
  "code": "already_exists",
  "message": "DAG run with this ID already exists"
}
```

### List All Webhooks

**Endpoint**: `GET /api/v1/webhooks`

Retrieves all webhooks. Requires admin role.

**Response (200)**:
```json
{
  "webhooks": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "dagName": "my-dag",
      "tokenPrefix": "dagu_wh_7Kq",
      "enabled": true,
      "createdAt": "2024-02-11T12:00:00Z",
      "updatedAt": "2024-02-11T12:00:00Z",
      "createdBy": "admin-user-id",
      "lastUsedAt": "2024-02-11T15:30:00Z"
    }
  ]
}
```

### Get DAG Webhook

**Endpoint**: `GET /api/v1/dags/{fileName}/webhook`

Retrieves the webhook for a specific DAG. Requires admin role.

**Response (200)**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "dagName": "my-dag",
  "tokenPrefix": "dagu_wh_7Kq",
  "enabled": true,
  "createdAt": "2024-02-11T12:00:00Z",
  "updatedAt": "2024-02-11T12:00:00Z",
  "createdBy": "admin-user-id",
  "lastUsedAt": "2024-02-11T15:30:00Z"
}
```

**Error Response (404)**:
```json
{
  "code": "not_found",
  "message": "Webhook not found for this DAG"
}
```

### Create DAG Webhook

**Endpoint**: `POST /api/v1/dags/{fileName}/webhook`

Creates a webhook for a DAG. Requires admin role. Each DAG can only have one webhook.

**Response (201)**:
```json
{
  "webhook": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "dagName": "my-dag",
    "tokenPrefix": "dagu_wh_7Kq",
    "enabled": true,
    "createdAt": "2024-02-11T12:00:00Z",
    "updatedAt": "2024-02-11T12:00:00Z",
    "createdBy": "admin-user-id"
  },
  "token": "dagu_wh_7Kq9mXxN3pLwR5tY2vZa8bCdEfGhJk4n6sUwXy0zA1B"
}
```

::: warning
The `token` field contains the full webhook token and is **only returned once** at creation time. Store it securely.
:::

**Error Response (404)** - DAG not found:
```json
{
  "code": "not_found",
  "message": "DAG not found"
}
```

**Error Response (409)** - Webhook already exists:
```json
{
  "code": "already_exists",
  "message": "Webhook already exists for this DAG"
}
```

### Delete DAG Webhook

**Endpoint**: `DELETE /api/v1/dags/{fileName}/webhook`

Deletes the webhook for a DAG. Requires admin role.

**Response (204)**: No content

**Error Response (404)**:
```json
{
  "code": "not_found",
  "message": "Webhook not found"
}
```

### Regenerate Webhook Token

**Endpoint**: `POST /api/v1/dags/{fileName}/webhook/regenerate`

Regenerates the token for a webhook. The old token is immediately invalidated. Requires admin role.

**Response (200)**:
```json
{
  "webhook": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "dagName": "my-dag",
    "tokenPrefix": "dagu_wh_9Xz",
    "enabled": true,
    "createdAt": "2024-02-11T12:00:00Z",
    "updatedAt": "2024-02-11T16:00:00Z",
    "createdBy": "admin-user-id"
  },
  "token": "dagu_wh_9XzNewTokenGeneratedHereAfterRegeneration"
}
```

**Error Response (404)**:
```json
{
  "code": "not_found",
  "message": "Webhook not found"
}
```

### Toggle Webhook

**Endpoint**: `POST /api/v1/dags/{fileName}/webhook/toggle`

Enables or disables a webhook without regenerating the token. Requires admin role.

**Request Body**:
```json
{
  "enabled": false
}
```

**Response (200)**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "dagName": "my-dag",
  "tokenPrefix": "dagu_wh_7Kq",
  "enabled": false,
  "createdAt": "2024-02-11T12:00:00Z",
  "updatedAt": "2024-02-11T16:00:00Z",
  "createdBy": "admin-user-id",
  "lastUsedAt": "2024-02-11T15:30:00Z"
}
```

**Error Response (404)**:
```json
{
  "code": "not_found",
  "message": "Webhook not found"
}
```

### Example: Using Webhooks

```bash
# 1. Login as admin to get JWT token
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin-password"}' | jq -r '.token')

# 2. Create a webhook for a DAG
WEBHOOK=$(curl -s -X POST http://localhost:8080/api/v1/dags/my-dag/webhook \
  -H "Authorization: Bearer $TOKEN")

WEBHOOK_TOKEN=$(echo $WEBHOOK | jq -r '.token')
echo "Webhook token: $WEBHOOK_TOKEN"

# 3. Trigger the DAG using the webhook
curl -X POST http://localhost:8080/api/v1/webhooks/my-dag \
  -H "Authorization: Bearer $WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"payload": {"branch": "main", "commit": "abc123"}}'

# 4. Regenerate token if compromised
curl -X POST http://localhost:8080/api/v1/dags/my-dag/webhook/regenerate \
  -H "Authorization: Bearer $TOKEN"

# 5. Disable webhook temporarily
curl -X POST http://localhost:8080/api/v1/dags/my-dag/webhook/toggle \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

## Workers Endpoints

### List Workers

**Endpoint**: `GET /api/v1/workers`

Retrieves information about connected workers in the distributed execution system.

**Query Parameters**:
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| remoteNode | string | Remote node name | "local" |

**Response (200)**:
```json
{
  "workers": [
    {
      "id": "worker-gpu-01",
      "labels": {
        "gpu": "true",
        "cuda": "11.8",
        "memory": "64G",
        "region": "us-east-1"
      },
      "health_status": "WORKER_HEALTH_STATUS_HEALTHY",
      "last_heartbeat": "2024-02-11T12:00:00Z",
      "running_tasks": [
        {
          "dagName": "ml-training-pipeline",
          "dagRunId": "20240211_120000_abc123",
          "rootDagRunName": "ml-training-pipeline",
          "rootDagRunId": "20240211_120000_abc123",
          "parentDagRunName": "",
          "parentDagRunId": "",
          "startedAt": "2024-02-11T12:00:00Z"
        }
      ]
    },
    {
      "id": "worker-cpu-02",
      "labels": {
        "cpu-arch": "amd64",
        "cpu-cores": "32",
        "region": "us-east-1"
      },
      "health_status": "WORKER_HEALTH_STATUS_WARNING",
      "last_heartbeat": "2024-02-11T11:59:50Z",
      "running_tasks": []
    },
    {
      "id": "worker-eu-01",
      "labels": {
        "region": "eu-west-1",
        "compliance": "gdpr"
      },
      "health_status": "WORKER_HEALTH_STATUS_UNHEALTHY",
      "last_heartbeat": "2024-02-11T11:59:30Z",
      "running_tasks": [
        {
          "dagName": "data-processor",
          "dagRunId": "20240211_113000_def456",
          "rootDagRunName": "data-pipeline",
          "rootDagRunId": "20240211_110000_xyz789",
          "parentDagRunName": "data-pipeline",
          "parentDagRunId": "20240211_110000_xyz789",
          "startedAt": "2024-02-11T11:30:00Z"
        }
      ]
    }
  ]
}
```

**Worker Health Status Values**:
- `WORKER_HEALTH_STATUS_HEALTHY`: Last heartbeat < 5 seconds ago
- `WORKER_HEALTH_STATUS_WARNING`: Last heartbeat 5-15 seconds ago
- `WORKER_HEALTH_STATUS_UNHEALTHY`: Last heartbeat > 15 seconds ago

**Running Task Fields**:
- `dagName`: Name of the DAG being executed
- `dagRunId`: ID of the current DAG run
- `rootDagRunName`: Name of the root DAG (for nested workflows)
- `rootDagRunId`: ID of the root DAG run
- `parentDagRunName`: Name of the immediate parent DAG (empty for root DAGs)
- `parentDagRunId`: ID of the immediate parent DAG run
- `startedAt`: When the task execution started

**Error Response (503)** (when coordinator is not running):
```json
{
  "code": "service_unavailable",
  "message": "Coordinator service is not available"
}
```

## Git Sync Endpoints

All sync endpoints accept an optional `remoteNode` query parameter.

### Get Sync Status

**Endpoint**: `GET /api/v1/sync/status`

Returns overall sync status, item list, and status counts.

```bash
curl "http://localhost:8080/api/v1/sync/status"
```

**Response (200)**:
```json
{
  "enabled": true,
  "repository": "github.com/your-org/dags",
  "branch": "main",
  "summary": "pending",
  "lastSyncAt": "2026-02-26T10:00:00Z",
  "lastSyncCommit": "abc123",
  "items": [
    {
      "itemId": "my-dag",
      "filePath": "my-dag.yaml",
      "displayName": "my-dag.yaml",
      "kind": "dag",
      "status": "modified"
    }
  ],
  "counts": {
    "synced": 10,
    "modified": 1,
    "untracked": 0,
    "conflict": 0,
    "missing": 0
  }
}
```

### Pull from Remote

**Endpoint**: `POST /api/v1/sync/pull`

Fetches and applies changes from the remote repository. Requires `permissions.write_dags`.

```bash
curl -X POST "http://localhost:8080/api/v1/sync/pull"
```

**Response (200)**:
```json
{
  "success": true,
  "message": "Synced 3 item(s)",
  "synced": ["dag-a", "dag-b", "dag-c"],
  "modified": [],
  "conflicts": [],
  "errors": [],
  "timestamp": "2026-02-26T10:00:00Z"
}
```

### Publish All

**Endpoint**: `POST /api/v1/sync/publish-all`

Publishes specified items, or all modified/untracked items if `itemIds` is omitted. Requires `permissions.write_dags`.

```bash
curl -X POST "http://localhost:8080/api/v1/sync/publish-all" \
  -H "Content-Type: application/json" \
  -d '{"message":"Batch publish","itemIds":["my-dag","memory/MEMORY"]}'
```

**Request Body**:
| Field | Type | Required | Description |
|---|---|---|---|
| `message` | string | No | Commit message |
| `itemIds` | string[] | No | Item IDs to publish. Omit to publish all modified/untracked. |

**Response (200)**: Same shape as Pull response.

### Test Connection

**Endpoint**: `POST /api/v1/sync/test-connection`

Tests repository access and authentication.

```bash
curl -X POST "http://localhost:8080/api/v1/sync/test-connection"
```

**Response (200)**:
```json
{
  "success": true,
  "message": "Connection successful"
}
```

### Get Config

**Endpoint**: `GET /api/v1/sync/config`

```bash
curl "http://localhost:8080/api/v1/sync/config"
```

**Response (200)**:
```json
{
  "enabled": true,
  "repository": "github.com/your-org/dags",
  "branch": "main",
  "path": "",
  "pushEnabled": true,
  "auth": {
    "type": "token"
  },
  "autoSync": {
    "enabled": true,
    "onStartup": true,
    "interval": 300
  },
  "commit": {
    "authorName": "Dagu",
    "authorEmail": "dagu@localhost"
  }
}
```

### Update Config

**Endpoint**: `PUT /api/v1/sync/config`

Admin only.

```bash
curl -X PUT "http://localhost:8080/api/v1/sync/config" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "repository": "github.com/your-org/dags",
    "branch": "main",
    "pushEnabled": true,
    "auth": {"type": "token", "token": "ghp_xxx"},
    "autoSync": {"enabled": true, "onStartup": true, "interval": 300},
    "commit": {"authorName": "Dagu", "authorEmail": "dagu@localhost"}
  }'
```

### Get Item Diff

**Endpoint**: `GET /api/v1/sync/items/{itemId}/diff`

Returns local and remote content for comparison. Requires sync service to be configured.

```bash
curl "http://localhost:8080/api/v1/sync/items/memory%2FMEMORY/diff"
```

**Response (200)**:
```json
{
  "itemId": "memory/MEMORY",
  "filePath": "memory/MEMORY.md",
  "status": "modified",
  "localContent": "# Memory\nUpdated locally",
  "remoteContent": "# Memory\nOriginal"
}
```

**Response (404)**: Item not found.

### Publish One Item

**Endpoint**: `POST /api/v1/sync/items/{itemId}/publish`

Requires `permissions.write_dags`.

```bash
curl -X POST "http://localhost:8080/api/v1/sync/items/my-dag/publish" \
  -H "Content-Type: application/json" \
  -d '{"message":"Update dag","force":false}'
```

**Request Body**:
| Field | Type | Required | Description |
|---|---|---|---|
| `message` | string | No | Commit message |
| `force` | boolean | No | Force publish over conflict |

**Response (200)**: Same shape as Pull response.

**Response (404)**: Item not found.

**Response (409)**: Conflict detected (when `force` is false):
```json
{
  "itemId": "my-dag",
  "remoteCommit": "abc123",
  "remoteAuthor": "alice",
  "remoteMessage": "Remote update",
  "message": "conflict: \"my-dag\" — remote has been updated"
}
```

### Discard Item Changes

**Endpoint**: `POST /api/v1/sync/items/{itemId}/discard`

Requires `permissions.write_dags`.

```bash
curl -X POST "http://localhost:8080/api/v1/sync/items/my-dag/discard"
```

**Response (200)**:
```json
{
  "message": "Discarded changes"
}
```

**Response (404)**: Item not found.

### Forget Item

**Endpoint**: `POST /api/v1/sync/items/{itemId}/forget`

Removes the state entry for a `missing`, `untracked`, or `conflict` item. Rejects `synced` and `modified` items. Requires `permissions.write_dags`.

```bash
curl -X POST "http://localhost:8080/api/v1/sync/items/missing-dag/forget"
```

**Response (200)**:
```json
{
  "message": "Forgotten"
}
```

**Response (400)**: Item cannot be forgotten (synced or modified).

**Response (404)**: Item not found.

### Delete Item

**Endpoint**: `POST /api/v1/sync/items/{itemId}/delete`

Removes item from remote repository (git rm + commit + push), local disk, and sync state. Requires `permissions.write_dags`.

```bash
curl -X POST "http://localhost:8080/api/v1/sync/items/my-dag/delete" \
  -H "Content-Type: application/json" \
  -d '{"message":"Remove old DAG","force":false}'
```

**Request Body**:
| Field | Type | Required | Description |
|---|---|---|---|
| `message` | string | No | Commit message |
| `force` | boolean | No | Force delete when item has local modifications |

**Response (200)**:
```json
{
  "message": "Deleted item: my-dag"
}
```

**Response (400)**: Item cannot be deleted (untracked, or modified without force, or push disabled).

**Response (404)**: Item not found.

### Delete All Missing Items

**Endpoint**: `POST /api/v1/sync/delete-missing`

Removes all missing items from remote repository, local disk, and sync state. Requires `permissions.write_dags`. Request body is optional.

```bash
curl -X POST "http://localhost:8080/api/v1/sync/delete-missing" \
  -H "Content-Type: application/json" \
  -d '{"message":"Clean up missing items"}'
```

**Request Body**:
| Field | Type | Required | Description |
|---|---|---|---|
| `message` | string | No | Commit message |

**Response (200)**:
```json
{
  "deleted": ["missing-a", "missing-b"],
  "message": "Deleted 2 missing item(s)"
}
```

**Response (400)**: Push is disabled.

### Move Item

**Endpoint**: `POST /api/v1/sync/items/{itemId}/move`

Atomically renames an item across local filesystem, remote repository, and sync state. Requires `permissions.write_dags`.

```bash
curl -X POST "http://localhost:8080/api/v1/sync/items/old-dag/move" \
  -H "Content-Type: application/json" \
  -d '{"newItemId":"new-dag","message":"Rename workflow"}'
```

**Request Body**:
| Field | Type | Required | Description |
|---|---|---|---|
| `newItemId` | string | Yes | New item ID |
| `message` | string | No | Commit message |
| `force` | boolean | No | Force move over conflict |

**Response (200)**:
```json
{
  "message": "Moved old-dag to new-dag"
}
```

**Response (400)**: Validation error (cross-kind move, push disabled, invalid ID).

**Response (404)**: Source item not found.

**Response (409)**: Conflict detected (when `force` is false). Same shape as publish conflict response.

### Cleanup

**Endpoint**: `POST /api/v1/sync/cleanup`

Removes all missing entries from sync state. Does not touch files on disk or remote. Requires `permissions.write_dags`.

```bash
curl -X POST "http://localhost:8080/api/v1/sync/cleanup"
```

**Response (200)**:
```json
{
  "forgotten": ["missing-a", "missing-b"],
  "message": "Cleaned up 2 item(s)"
}
```

## API Versioning

- Current version: v2
- Legacy v1 endpoints are deprecated but still available
- Version is included in the URL path: `/api/v1/`
- Breaking changes will result in a new API version

## Workspace Endpoints

Workspaces are managed through `/api/v1/workspaces`. DAG and DAG-run filtering uses tags such as `workspace=<name>`.

### List Workspaces

**Endpoint**: `GET /api/v1/workspaces`

Retrieves workspaces. Requires authentication.

**Query Parameters**:
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| remoteNode | string | Remote node name | "local" |

**Response (200)**:
```json
{
  "workspaces": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "production",
      "description": "Production workflows",
      "createdAt": "2026-03-06T10:00:00Z",
      "updatedAt": "2026-03-06T10:00:00Z"
    }
  ]
}
```

Returns an empty array if no workspaces exist.

### Create Workspace

**Endpoint**: `POST /api/v1/workspaces`

Creates a new workspace. Requires **developer** role or above.

**Request Body**:
```json
{
  "name": "staging",
  "description": "Optional description"
}
```

`name` is required and must match `^[A-Za-z0-9_-]+$`. `description` is optional.

**Response (201)**: The created workspace object.

**Error Response (400)**:
```json
{
  "code": "bad_request",
  "message": "Name is required"
}
```

**Error Response (409)**:
```json
{
  "code": "already_exists",
  "message": "Workspace with this name already exists"
}
```

### Get Workspace

**Endpoint**: `GET /api/v1/workspaces/{workspaceId}`

Retrieves a single workspace by ID. Requires authentication.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| workspaceId | string (UUID) | Workspace ID |

**Response (200)**: The workspace object.

**Error Response (404)**: Workspace not found.

### Update Workspace

**Endpoint**: `PATCH /api/v1/workspaces/{workspaceId}`

Updates a workspace. Requires **developer** role or above. PATCH semantics — only provided fields are updated.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| workspaceId | string (UUID) | Workspace ID |

**Request Body**:
```json
{
  "name": "new-name",
  "description": "Updated description"
}
```

Both fields are optional. Empty string for `name` is ignored.

**Response (200)**: The updated workspace object.

**Error Response (404)**: Workspace not found.

**Error Response (409)**:
```json
{
  "code": "already_exists",
  "message": "Workspace with this name already exists"
}
```

### Delete Workspace

**Endpoint**: `DELETE /api/v1/workspaces/{workspaceId}`

Deletes a workspace. Requires **developer** role or above.

Deleting a workspace removes the workspace record only. It does not rewrite DAG files, historical DAG runs, documents, users, or API keys.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| workspaceId | string (UUID) | Workspace ID |

**Response (204)**: No content.

**Error Response (404)**: Workspace not found.

### Workspace Response Object

All endpoints returning workspace data use this shape:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | UUID |
| `name` | string | Workspace name |
| `description` | string | Optional description |
| `createdAt` | string (date-time) | UTC creation timestamp |
| `updatedAt` | string (date-time) | UTC last-update timestamp |

## Remote Node Support

Most endpoints support the `remoteNode` query parameter for multi-environment setups:

```bash
# Query a remote node
curl "http://localhost:8080/api/v1/dags?remoteNode=production" \
     -H "Authorization: Bearer your-token"
```

Remote nodes are configured in the server configuration file and allow managing DAGs across multiple Dagu instances from a single interface.
