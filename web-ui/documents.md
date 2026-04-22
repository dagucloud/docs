# Documents

Markdown documents stored under `paths.docs_dir`, browsable and editable in the Web UI, searchable via API, and scoped by workspace.

By default, `paths.docs_dir` resolves to `<paths.dags_dir>/docs`.

## Storage

Documents are `.md` files under the configured docs directory:

```text
{docs_dir}/
├── onboarding.md
├── runbooks/
│   └── rollback.md
├── ops/
│   └── daily-report/
│       └── latest-run.md
└── platform/
    └── deployment.md
```

The first path segment is treated as a workspace only when it matches an existing workspace name. In the example above:

- `onboarding.md` and `runbooks/rollback.md` are `default` documents
- `ops/daily-report/latest-run.md` belongs to the `ops` workspace
- `platform/deployment.md` belongs to the `platform` workspace

When one workspace is selected, document IDs are relative to that workspace. For example, `ops/daily-report/latest-run.md` appears in the `ops` workspace as document ID `daily-report/latest-run`.

In `all`, the API can return documents from all workspaces the current identity can access and `default`. Workspace documents include their workspace metadata so the UI can disambiguate them.

## Workspace Selection

The Documents page follows the global workspace selector:

| UI label | Behavior |
|----------|----------|
| `all` | Lists and searches all documents the current identity can access. |
| `default` | Lists and edits documents outside known workspace folders. |
| `<workspace>` | Lists and edits documents under `{docs_dir}/<workspace>/`. |

`all` is an aggregate view and is not a valid mutation target.

## Generating Documents from DAG Steps

Dagu sets `DAG_DOCS_DIR` for each run when `paths.docs_dir` is configured.

For a DAG with no valid workspace tag:

```text
DAG_DOCS_DIR=<paths.docs_dir>/<DAG name>
```

For a DAG with exactly one valid `workspace=<name>` tag:

```text
DAG_DOCS_DIR=<paths.docs_dir>/<workspace>/<DAG name>
```

For example, if `paths.docs_dir` is `/home/user/.config/dagu/dags/docs`, the DAG name is `daily-report`, and the DAG has `workspace=ops`, then:

```text
DAG_DOCS_DIR=/home/user/.config/dagu/dags/docs/ops/daily-report
```

```yaml
name: daily-report
tags:
  - workspace=ops
steps:
  - id: generate_report
    command: |
      mkdir -p "${DAG_DOCS_DIR}"
      cat > "${DAG_DOCS_DIR}/latest-run.md" <<'TEMPLATE'
      ---
      title: Latest Run Results
      ---

      ## Results

      See output files in /tmp/results/
      TEMPLATE
```

This writes `{docs_dir}/ops/daily-report/latest-run.md`. It appears in the `ops` workspace as document ID `daily-report/latest-run`.

If the DAG has no workspace tag, an invalid workspace tag, or conflicting workspace tags, Dagu uses `<paths.docs_dir>/<DAG name>`, which appears under `default`.

`DAG_DOCS_DIR` is not set when `paths.docs_dir` resolves to an empty string. See [Special Environment Variables](/writing-workflows/runtime-variables).

## Document Format

Each file is markdown with optional YAML frontmatter. Only the `title` field is parsed from frontmatter:

```markdown
---
title: Deployment Runbook
---

## Steps

1. Pull latest changes
2. Run database migrations
3. Deploy to production
```

If no `title` is present in frontmatter, the title defaults to the last segment of the document ID. For example, `runbooks/deployment` gets title `deployment`.

The `content` field in API responses and requests always contains the full file, including the `---` frontmatter block. When updating a document via the API, include the frontmatter if you want to preserve it.

## Document ID Validation

IDs are validated against this regex:

```text
^[a-zA-Z0-9][a-zA-Z0-9_. -]*(/[a-zA-Z0-9][a-zA-Z0-9_. -]*)*$
```

Rules:

- Each path segment must start with an alphanumeric character
- Segments can contain letters, digits, underscores, dots, spaces, and hyphens
- Segments are separated by `/` for directory nesting
- Maximum length: 256 characters

Examples:

| ID | Valid | Reason |
|---|---|---|
| `onboarding` | Yes | |
| `runbooks/deployment` | Yes | Nested path |
| `architecture/AWS-Setup` | Yes | Mixed case, hyphens |
| `runbooks/v2.0-release` | Yes | Dots and hyphens |
| `.hidden` | No | Starts with dot |
| `/leading-slash` | No | Starts with slash |
| `path//double` | No | Empty segment |

Files under `docs/` that do not match the ID pattern are skipped from listings and search results. A debug-level log entry is emitted for each skipped file.

## API

All endpoints are under `/api/v1`. All accept an optional `remoteNode` query parameter to target a remote node.

### Endpoints

| Method | Path | Description | Status Codes |
|---|---|---|---|
| GET | `/docs` | List documents, tree or flat | 200 |
| POST | `/docs` | Create document | 201, 400, 409 |
| GET | `/docs/search` | Search document content | 200, 400 |
| GET | `/docs/doc` | Get single document | 200, 404 |
| PATCH | `/docs/doc` | Update document | 200, 404 |
| DELETE | `/docs/doc` | Delete document | 204, 404 |
| POST | `/docs/doc/rename` | Rename or move document | 200, 404, 409 |

Single-document endpoints use `/docs/doc` with a `path` query parameter rather than embedding the path in the URL.

### List Documents

```bash
curl "http://localhost:8080/api/v1/docs?perPage=50"
```

Query parameters:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | Page number, minimum 1 |
| `perPage` | integer | `50` | Items per page, minimum 1 and maximum 1000 |
| `flat` | boolean | `false` | If true, returns a flat list instead of a tree |

Tree response:

```json
{
  "tree": [
    {
      "id": "daily-report",
      "name": "daily-report",
      "type": "directory",
      "children": [
        {
          "id": "daily-report/latest-run",
          "name": "latest-run.md",
          "title": "Latest Run Results",
          "type": "file",
          "workspace": "ops"
        }
      ],
      "workspace": "ops"
    }
  ],
  "pagination": {
    "totalRecords": 1,
    "currentPage": 1,
    "totalPages": 1,
    "nextPage": 1,
    "prevPage": 1
  }
}
```

Flat response with `?flat=true`:

```json
{
  "items": [
    {
      "id": "daily-report/latest-run",
      "title": "Latest Run Results",
      "workspace": "ops"
    }
  ],
  "pagination": {
    "totalRecords": 1,
    "currentPage": 1,
    "totalPages": 1,
    "nextPage": 1,
    "prevPage": 1
  }
}
```

Items in flat mode are sorted alphabetically by `id`.

### Get Document

```bash
curl "http://localhost:8080/api/v1/docs/doc?path=daily-report/latest-run"
```

Response:

```json
{
  "id": "daily-report/latest-run",
  "title": "Latest Run Results",
  "content": "---\ntitle: Latest Run Results\n---\n\n## Results\n",
  "workspace": "ops",
  "createdAt": "2025-06-15T10:30:00Z",
  "updatedAt": "2025-06-20T14:00:00Z"
}
```

The `content` field contains the full file including frontmatter. `createdAt` is the file creation time when the platform exposes it. `updatedAt` is the file modification time.

Returns `404` if the document does not exist.

### Search Documents

```bash
curl "http://localhost:8080/api/v1/docs/search?q=deployment"
```

The `q` parameter is required.

Response:

```json
{
  "results": [
    {
      "id": "runbooks/deployment",
      "title": "Deployment Runbook",
      "workspace": "platform",
      "matches": [
        { "line": "## Deployment Steps", "lineNumber": 5, "startLine": 5 }
      ]
    }
  ]
}
```

### Create Document

```bash
curl -X POST "http://localhost:8080/api/v1/docs" \
  -H "Content-Type: application/json" \
  -d '{"id": "daily-report/latest-run", "content": "---\ntitle: Latest Run Results\n---\n\n## Results"}'
```

Request body fields:

- `id` (string, required): document ID
- `content` (string, required): full file content including optional frontmatter

Returns `201` on success. Returns `409` if a document with that ID already exists.

### Update Document

```bash
curl -X PATCH "http://localhost:8080/api/v1/docs/doc?path=daily-report/latest-run" \
  -H "Content-Type: application/json" \
  -d '{"content": "---\ntitle: Latest Run Results\n---\n\n## Updated Results"}'
```

Request body fields:

- `content` (string, required): full file content including optional frontmatter

Returns `404` if the document does not exist.

### Delete Document

```bash
curl -X DELETE "http://localhost:8080/api/v1/docs/doc?path=daily-report/latest-run"
```

Returns `204` with no response body on success. Returns `404` if the document does not exist.

Empty parent directories are automatically removed after deletion.

### Rename Document

```bash
curl -X POST "http://localhost:8080/api/v1/docs/doc/rename?path=daily-report/latest-run" \
  -H "Content-Type: application/json" \
  -d '{"newPath": "daily-report/run-summary"}'
```

Request body fields:

- `newPath` (string, required): new document ID

Returns `404` if the source document does not exist. Returns `409` if a document already exists at the target path.

Empty parent directories of the old path are automatically removed.

## Permissions

Read endpoints (`GET /docs`, `GET /docs/doc`, `GET /docs/search`) are available to authenticated users, limited by their workspace access policy.

Write endpoints (`POST /docs`, `PATCH /docs/doc`, `DELETE /docs/doc`, `POST /docs/doc/rename`) require:

1. The server-level `write_dags` permission to be enabled
2. The user's effective role for the target workspace to satisfy `CanWrite()`: `admin`, `manager`, or `developer`

Write operations are also blocked when Git Sync is in read-only mode (`push_enabled: false`).

## Git Sync

Documents are synced alongside DAGs when [Git Sync](/server-admin/git-sync) is enabled. They are tracked as the `doc` kind in the sync state. Files under `docs/` with the `.md` extension are included in sync scanning.

Workspace folders are regular directories under `paths.docs_dir`, so Git Sync tracks them the same way as other document files.

## Agent Integration

The AI agent can reference documents via `@` mentions in the agent chat. Typing `@` opens a doc picker that fuzzy-searches available documents in the current workspace. Selected documents are passed as context to the agent.

The agent's `navigate` tool supports `/docs` and `/docs/<doc-id>` paths to open the documents page or a specific document in the UI.

The agent does not have tools to create, update, or delete documents directly.
