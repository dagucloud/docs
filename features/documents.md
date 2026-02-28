# Documents

Markdown documents stored under `{DAGsDir}/docs/`, browsable and editable in the web UI, searchable via API.

## Storage

Documents are `.md` files under the `docs/` subdirectory of your DAGs directory:

```
{DAGsDir}/docs/
├── runbooks/
│   ├── deployment.md
│   └── rollback.md
├── architecture/
│   └── overview.md
└── onboarding.md
```

The document ID is the file path relative to `docs/` without the `.md` extension. The file `docs/runbooks/deployment.md` has ID `runbooks/deployment`.

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

The `content` field in API responses and requests always contains the **full file including the `---` frontmatter block**. When updating a document via the API, you must include the frontmatter if you want to preserve it.

## Document ID Validation

IDs are validated against this regex:

```
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

Files under `docs/` that don't match the ID pattern are silently skipped from listings and search results. A debug-level log entry is emitted for each skipped file.

## API

All endpoints are under `/api/v1`. All accept an optional `remoteNode` query parameter (string, default: `"local"`) to target a specific remote node.

### Endpoints

| Method | Path | Description | Status Codes |
|---|---|---|---|
| GET | `/docs` | List documents (tree or flat) | 200 |
| POST | `/docs` | Create document | 201, 400, 409 |
| GET | `/docs/search` | Search document content | 200, 400 |
| GET | `/docs/doc` | Get single document | 200, 404 |
| PATCH | `/docs/doc` | Update document | 200, 404 |
| DELETE | `/docs/doc` | Delete document | 204, 404 |
| POST | `/docs/doc/rename` | Rename/move document | 200, 404, 409 |

Single-document endpoints use `/docs/doc` with a `path` query parameter rather than embedding the path in the URL.

### List Documents

```bash
curl "http://localhost:8080/api/v1/docs?perPage=50"
```

Query parameters:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | Page number (minimum 1) |
| `perPage` | integer | `50` | Items per page (minimum 1, maximum 1000) |
| `flat` | boolean | `false` | If true, returns flat list instead of tree |

Tree response (default):

```json
{
  "tree": [
    {
      "id": "runbooks",
      "name": "runbooks",
      "type": "directory",
      "children": [
        {
          "id": "runbooks/deployment",
          "name": "deployment.md",
          "title": "Deployment Runbook",
          "type": "file"
        }
      ]
    },
    {
      "id": "onboarding",
      "name": "onboarding.md",
      "title": "onboarding",
      "type": "file"
    }
  ],
  "pagination": {
    "totalRecords": 2,
    "currentPage": 1,
    "totalPages": 1,
    "nextPage": 1,
    "prevPage": 1
  }
}
```

Flat response (`?flat=true`):

```json
{
  "items": [
    { "id": "onboarding", "title": "onboarding" },
    { "id": "runbooks/deployment", "title": "Deployment Runbook" }
  ],
  "pagination": { "totalRecords": 2, "currentPage": 1, "totalPages": 1, "nextPage": 1, "prevPage": 1 }
}
```

Items in flat mode are sorted alphabetically by `id`.

### Get Document

```bash
curl "http://localhost:8080/api/v1/docs/doc?path=runbooks/deployment"
```

Response:

```json
{
  "id": "runbooks/deployment",
  "title": "Deployment Runbook",
  "content": "---\ntitle: Deployment Runbook\n---\n\n## Steps\n\n1. Pull latest changes",
  "createdAt": "2025-06-15T10:30:00Z",
  "updatedAt": "2025-06-20T14:00:00Z"
}
```

The `content` field contains the full file including frontmatter. `createdAt` is the file creation time (platform-dependent). `updatedAt` is the file modification time.

Returns `404` if the document does not exist.

### Search Documents

```bash
curl "http://localhost:8080/api/v1/docs/search?q=deployment"
```

The `q` parameter is required. Searches across all document content using pattern matching.

Response:

```json
{
  "results": [
    {
      "id": "runbooks/deployment",
      "title": "Deployment Runbook",
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
  -d '{"id": "runbooks/deployment", "content": "---\ntitle: Deployment Runbook\n---\n\n## Steps\n\n1. Pull latest changes"}'
```

Request body fields:
- `id` (string, required) — document ID
- `content` (string, required) — full file content including optional frontmatter

Returns `201` with `{"message": "..."}` on success. Returns `409` if a document with that ID already exists.

### Update Document

```bash
curl -X PATCH "http://localhost:8080/api/v1/docs/doc?path=runbooks/deployment" \
  -H "Content-Type: application/json" \
  -d '{"content": "---\ntitle: Deployment Runbook\n---\n\n## Updated Steps\n\n1. Pull latest changes\n2. Run migrations"}'
```

Request body fields:
- `content` (string, required) — full file content including optional frontmatter

Returns `404` if the document does not exist.

### Delete Document

```bash
curl -X DELETE "http://localhost:8080/api/v1/docs/doc?path=runbooks/deployment"
```

Returns `204` with no response body on success. Returns `404` if the document does not exist.

Empty parent directories are automatically removed after deletion.

### Rename Document

```bash
curl -X POST "http://localhost:8080/api/v1/docs/doc/rename?path=runbooks/deployment" \
  -H "Content-Type: application/json" \
  -d '{"newPath": "runbooks/deploy-guide"}'
```

Request body fields:
- `newPath` (string, required) — new document ID

Returns `404` if the source document does not exist. Returns `409` if a document already exists at the target path.

Empty parent directories of the old path are automatically removed.

## Permissions

Read endpoints (`GET /docs`, `GET /docs/doc`, `GET /docs/search`) are available to all authenticated users.

Write endpoints (`POST /docs`, `PATCH /docs/doc`, `DELETE /docs/doc`, `POST /docs/doc/rename`) require:
1. The server-level `write_dags` permission to be enabled
2. The user's role to satisfy `CanWrite()`: `admin`, `manager`, or `developer`

Write operations are also blocked when Git Sync is in read-only mode (`push_enabled: false`).

## Git Sync

Documents are synced alongside DAGs when [Git Sync](/features/git-sync) is enabled. They are tracked as the `doc` kind in the sync state. Files under `docs/` with the `.md` extension are included in sync scanning.

## Agent Integration

The AI agent can reference documents via `@` mentions in the agent chat. Typing `@` opens a doc picker that fuzzy-searches available documents. Selected documents are passed as context to the agent.

The agent's `navigate` tool supports `/docs` and `/docs/<doc-id>` paths to open the documents page or a specific document in the UI.

The agent does not have tools to create, update, or delete documents directly.
