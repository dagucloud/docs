# Workspaces

Workspaces group DAG definitions, DAG runs, documents, and search views by the canonical DAG tag `workspace=<name>`.

The workspace selector is global. It appears in the Web UI navigation above the remote node selector and applies to Dashboard, DAG Definitions, DAG Runs, Search, Cockpit, and Documents.

Workspaces are an organization and navigation scope inside one Dagu installation. They are not a multi-tenant isolation model and should not be treated as a hard security boundary between tenants. Use separate Dagu deployments and separate storage when you need tenant isolation.

## Workspace Selection

The selector has three kinds of values:

| UI label | Tag filter | Meaning |
|----------|-----------|---------|
| `all` | - | Show all data the current user or API key can access. |
| `default` | `!workspace` | Show resources with no valid `workspace=<name>` tag. This is not an automatically created workspace record. |
| `<workspace>` | `workspace=<name>` | Show one named workspace. |

Missing or invalid workspace selection defaults to `all`.

The selected workspace is persisted in browser `localStorage` under `dagu-selected-workspace`. Older keys, including `dagu-selected-workspace-scope` and `dagu_cockpit_workspace`, are migrated and removed automatically.

## Tags

A named workspace is represented on DAGs and DAG runs by this tag:

```yaml
tags:
  - workspace=production
```

Only one valid workspace tag should be present. A missing workspace tag belongs to `default`. Invalid or conflicting workspace tags are excluded from named workspace filters.

Workspace names must match:

```text
^[A-Za-z0-9_-]+$
```

The value can contain letters, numbers, underscores, and hyphens. It cannot be empty and cannot contain `/`, whitespace, dots, or other punctuation. This restriction lets the same name be used safely as a tag value and filesystem path segment.

## API Behavior

DAG and DAG-run list APIs use the `tags` query parameter for workspace filtering.

## Documents

Documents are workspace-aware when `paths.docs_dir` is configured.

For a DAG with no valid workspace tag, Dagu sets:

```text
DAG_DOCS_DIR=<paths.docs_dir>/<DAG name>
```

For a DAG with `workspace=<name>`, Dagu sets:

```text
DAG_DOCS_DIR=<paths.docs_dir>/<workspace>/<DAG name>
```

For example, a DAG named `daily-report` with `workspace=ops` writes workspace documents under:

```text
<paths.docs_dir>/ops/daily-report/
```

Files created at `$DAG_DOCS_DIR/path/to/file.md` appear in the Documents page under the selected `ops` workspace as `daily-report/path/to/file`.

See [Documents](/web-ui/documents) for document storage, API, and permission details.

## Workspace Access

Workspace access limits which workspace-scoped data a user or API key sees in list, search, and workspace-aware UI views. It works with the role model, but it does not turn workspaces into isolated tenants.

- Users with `all: true` can access every workspace with their top-level role.
- Users with selected workspace grants can access only those named workspaces with the grant role.
- Resources with no workspace tag remain visible through `default`; scoped users see them through their top-level role, which is `viewer` for selected-workspace users.

Existing users without a stored workspace access policy are treated as `all` for backward compatibility. New users created in the UI must explicitly choose `all` or selected workspaces.

See [User Management](/server-admin/authentication/user-management) for the workspace access schema and role rules.

## Storage

Each named workspace is stored as a JSON file at:

```text
{workspaces_dir}/{uuid}.json
```

### Configuration

```yaml
# ~/.config/dagu/config.yaml
paths:
  workspaces_dir: "/custom/path/to/workspaces"
```

| Config key | Environment variable | Default |
|------------|---------------------|---------|
| `paths.workspaces_dir` | `DAGU_WORKSPACES_DIR` | `{data_dir}/workspaces` |

The default `data_dir` depends on your setup:

- With `DAGU_HOME` set: `{DAGU_HOME}/data`
- XDG fallback: `~/.local/share/dagu/data`

### File Format

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "production",
  "description": "Production workflows",
  "created_at": "2026-03-06T10:00:00Z",
  "updated_at": "2026-03-06T10:00:00Z"
}
```

File permissions: `0600`. Directory permissions: `0750`.

The store maintains in-memory indices by ID and name. They are rebuilt on startup by scanning the workspace directory for `.json` files.

## Delete Behavior

Deleting a workspace removes the workspace record. It does not rewrite DAG files, historical DAG runs, generated documents, users, or API keys.

If users or API keys still contain grants for a deleted workspace, update those access policies. Future create/update validation requires selected workspace grants to reference existing workspace records.

## REST API

All endpoints accept the `remoteNode` query parameter for routing requests to remote nodes.

### List Workspaces

```http
GET /api/v1/workspaces?remoteNode=<node>
```

Available to authenticated users.

**Response (200)**:

```json
{
  "workspaces": [
    {
      "id": "a1b2c3d4-...",
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

```http
POST /api/v1/workspaces?remoteNode=<node>
```

Requires developer role or above.

**Request**:

```json
{
  "name": "staging",
  "description": "Optional description"
}
```

`name` is required. `description` is optional.

**Response (201)**: The created workspace object.

**Response (400)**: Name is empty or does not match `^[A-Za-z0-9_-]+$`.

```json
{ "code": "bad_request", "message": "Name is required" }
```

**Response (409)**: A workspace with this name already exists.

```json
{ "code": "already_exists", "message": "Workspace with this name already exists" }
```

### Get Workspace

```http
GET /api/v1/workspaces/{workspaceId}?remoteNode=<node>
```

Available to authenticated users.

**Response (200)**: The workspace object.

**Response (404)**: Workspace not found.

### Update Workspace

```http
PATCH /api/v1/workspaces/{workspaceId}?remoteNode=<node>
```

Requires developer role or above. PATCH semantics: only provided fields are updated.

**Request**:

```json
{
  "name": "new-name",
  "description": "Updated description"
}
```

Both fields are optional. Empty string for `name` is ignored and the existing name is kept.

**Response (200)**: The updated workspace object.

**Response (404)**: Workspace not found.

**Response (409)**: Another workspace with the new name already exists.

### Delete Workspace

```http
DELETE /api/v1/workspaces/{workspaceId}?remoteNode=<node>
```

Requires developer role or above.

**Response (204)**: No content. Workspace deleted.

**Response (404)**: Workspace not found.

### Response Object

All endpoints returning workspace data use this shape:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | UUID v4 |
| `name` | string | Yes | Workspace name |
| `description` | string | No | Omitted from JSON when empty |
| `createdAt` | string (date-time) | No | UTC timestamp, omitted when zero |
| `updatedAt` | string (date-time) | No | UTC timestamp, omitted when zero |

### Error Responses

When the workspace store is not configured, endpoints return:

**Response (503)**:

```json
{ "code": "internal_error", "message": "Workspace store not configured" }
```

## Audit Logging

All write operations are logged with category `workspace`:

| Action | Logged fields |
|--------|---------------|
| `workspace_create` | `id`, `name` |
| `workspace_update` | `id`, `name` |
| `workspace_delete` | `id`, `name` |

## Related

- [Cockpit](/web-ui/cockpit)
- [Documents](/web-ui/documents)
- [User Management](/server-admin/authentication/user-management)
