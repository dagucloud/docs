# Git Sync

Git Sync synchronizes local DAG files and agent files (memory, souls) with a remote Git repository.

## Tracked Files and Item IDs

Git Sync tracks items by `itemId` — the file path relative to the DAGs directory, without extension.

| Local file | itemId | kind |
|---|---|---|
| `my-dag.yaml` | `my-dag` | `dag` |
| `subdir/report.yml` | `subdir/report` | `dag` |
| `memory/MEMORY.md` | `memory/MEMORY` | `memory` |
| `memory/dags/my-dag/MEMORY.md` | `memory/dags/my-dag/MEMORY` | `memory` |
| `souls/persona.md` | `souls/persona` | `soul` |

## File Scanning Rules

Implemented in `internal/gitsync/service.go`.

### Remote scan

Includes files with extensions `.yaml`, `.yml`, and `.md`. Files with `.md` extension are only accepted when the item ID starts with `memory/` or `souls/`.

### Local untracked scan

Discovers local files not yet in sync state:

- **DAGs**: `.yaml` and `.yml` files in the root of `{dags_dir}/`. Flat scan, not recursive.
- **Memory**: any `.md` file under `memory/`. Recursive walk through all subdirectories.
- **Souls**: `souls/*.md`. Flat scan, not recursive.

## Configuration

```yaml
git_sync:
  enabled: true
  repository: github.com/your-org/dags
  branch: main
  path: ""  # subdirectory in repo (empty = root)
  push_enabled: true

  auth:
    type: token
    token: ${GITHUB_TOKEN}

  auto_sync:
    enabled: true
    on_startup: true
    interval: 300  # seconds

  commit:
    author_name: Dagu
    author_email: dagu@localhost
```

Defaults applied when `git_sync.enabled: true`:

| Field | Default |
|---|---|
| `branch` | `main` |
| `push_enabled` | `true` |
| `auth.type` | `token` |
| `auto_sync.on_startup` | `true` |
| `auto_sync.interval` | `300` |
| `commit.author_name` | `Dagu` |
| `commit.author_email` | `dagu@localhost` |

## Authentication

### HTTPS token

```yaml
git_sync:
  repository: github.com/your-org/dags
  branch: main
  auth:
    type: token
    token: ${GITHUB_TOKEN}
```

```bash
export DAGU_GITSYNC_AUTH_TYPE=token
export DAGU_GITSYNC_AUTH_TOKEN=ghp_xxxxxxxxxxxx
```

### SSH key

Use SSH repository format, for example `git@github.com:org/repo.git`.

```yaml
git_sync:
  repository: git@github.com:your-org/dags.git
  branch: main
  auth:
    type: ssh
    ssh_key_path: /home/user/.ssh/id_ed25519
    ssh_passphrase: ${SSH_PASSPHRASE}
```

```bash
export DAGU_GITSYNC_AUTH_TYPE=ssh
export DAGU_GITSYNC_AUTH_SSH_KEY_PATH=/home/user/.ssh/id_ed25519
export DAGU_GITSYNC_AUTH_SSH_PASSPHRASE=your-passphrase
```

## Environment Variables

All env vars use the `DAGU_GITSYNC_` prefix.

| Environment variable | Config key | Default |
|---|---|---|
| `DAGU_GITSYNC_ENABLED` | `git_sync.enabled` | `false` |
| `DAGU_GITSYNC_REPOSITORY` | `git_sync.repository` | — |
| `DAGU_GITSYNC_BRANCH` | `git_sync.branch` | `main` |
| `DAGU_GITSYNC_PATH` | `git_sync.path` | `""` |
| `DAGU_GITSYNC_PUSH_ENABLED` | `git_sync.push_enabled` | `true` |
| `DAGU_GITSYNC_AUTH_TYPE` | `git_sync.auth.type` | `token` |
| `DAGU_GITSYNC_AUTH_TOKEN` | `git_sync.auth.token` | — |
| `DAGU_GITSYNC_AUTH_SSH_KEY_PATH` | `git_sync.auth.ssh_key_path` | — |
| `DAGU_GITSYNC_AUTH_SSH_PASSPHRASE` | `git_sync.auth.ssh_passphrase` | — |
| `DAGU_GITSYNC_AUTOSYNC_ENABLED` | `git_sync.auto_sync.enabled` | `false` |
| `DAGU_GITSYNC_AUTOSYNC_ON_STARTUP` | `git_sync.auto_sync.on_startup` | `true` |
| `DAGU_GITSYNC_AUTOSYNC_INTERVAL` | `git_sync.auto_sync.interval` | `300` |
| `DAGU_GITSYNC_COMMIT_AUTHOR_NAME` | `git_sync.commit.author_name` | `Dagu` |
| `DAGU_GITSYNC_COMMIT_AUTHOR_EMAIL` | `git_sync.commit.author_email` | `dagu@localhost` |

## Status Values

| Status | Meaning |
|---|---|
| `synced` | Local content matches last synced content |
| `modified` | Local content differs from `lastSyncedHash` |
| `untracked` | Local item exists but has no synced baseline |
| `conflict` | Local item is modified and remote changed since last sync |
| `missing` | Previously tracked file no longer exists on local disk |

When an item transitions to `missing`, the previous status is recorded in `previousStatus` and the detection time in `missingAt`.

## CLI

### `sync status`

```bash
dagu sync status
```

Shows repository URL, branch, last sync info, status counts, and a table of non-synced items.

### `sync pull`

```bash
dagu sync pull
```

Fetches and applies changes from the remote repository.

### `sync publish`

```bash
dagu sync publish my-dag -m "Update dag"
dagu sync publish memory/MEMORY -m "Update global memory"
dagu sync publish --all -m "Batch update"
dagu sync publish my-dag --force -m "Overwrite remote"
```

| Flag | Description |
|---|---|
| `-m, --message` | Commit message |
| `--all` | Publish all modified and untracked items |
| `-f, --force` | Force publish even with conflicts |

Provide either an item ID or `--all`, not both.

### `sync discard`

```bash
dagu sync discard my-dag
dagu sync discard memory/dags/my-dag/MEMORY
dagu sync discard my-dag -y
```

| Flag | Description |
|---|---|
| `-y, --yes` | Skip confirmation prompt |

Discards local changes and restores the remote version.

### `sync forget`

```bash
dagu sync forget missing-dag
dagu sync forget item-a item-b item-c
dagu sync forget missing-dag -y
```

| Flag | Description |
|---|---|
| `-y, --yes` | Skip confirmation prompt |

Removes state entries for `missing`, `untracked`, or `conflict` items. Does not touch files on disk or remote. Rejects `synced` and `modified` items. Accepts multiple item IDs.

### `sync cleanup`

```bash
dagu sync cleanup
dagu sync cleanup --dry-run
dagu sync cleanup -y
```

| Flag | Description |
|---|---|
| `--dry-run` | Show what would be cleaned without making changes |
| `-y, --yes` | Skip confirmation prompt |

Removes all `missing` entries from sync state. Does not touch files on disk or remote.

### `sync delete`

```bash
# Delete a single item
dagu sync delete my-dag -m "Remove old dag"

# Delete with force (required for modified items)
dagu sync delete my-dag --force -m "Remove despite modifications"

# Delete all missing items
dagu sync delete --all-missing -m "Clean up missing"

# Dry run
dagu sync delete my-dag --dry-run
dagu sync delete --all-missing --dry-run
```

| Flag | Description |
|---|---|
| `-m, --message` | Commit message |
| `--force` | Force delete even with local modifications |
| `--all-missing` | Delete all missing items instead of a single item |
| `--dry-run` | Show what would be deleted without making changes |
| `-y, --yes` | Skip confirmation prompt |

Deletes items from the remote repository (git rm + commit + push), local disk, and sync state. Provide either an item ID or `--all-missing`, not both. Untracked items cannot be deleted — use `forget` instead.

### `sync mv`

```bash
# Rename a DAG
dagu sync mv old-dag new-dag -m "Rename workflow"

# Force move (required for conflicting items)
dagu sync mv old-dag new-dag --force -m "Move despite conflict"

# Dry run
dagu sync mv old-dag new-dag --dry-run
```

| Flag | Description |
|---|---|
| `-m, --message` | Commit message |
| `--force` | Force move even with conflicts |
| `--dry-run` | Show what would be moved without making changes |
| `-y, --yes` | Skip confirmation prompt |

Atomically renames an item across local filesystem, remote repository, and sync state. Both source and destination must be of the same kind (e.g., both DAGs or both memory files).

Two modes:
- **Preemptive**: source file exists on disk. Reads it, writes to new location, stages removal+addition in repo, commits and pushes.
- **Retroactive**: source is missing but the new file already exists at destination. Reads new file, stages old removal + new addition, commits and pushes.

## REST API

### Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/sync/status` | Overall sync status and item list |
| POST | `/api/v1/sync/pull` | Pull from remote |
| POST | `/api/v1/sync/publish-all` | Publish selected or all modified/untracked items |
| POST | `/api/v1/sync/test-connection` | Test repository and auth access |
| GET | `/api/v1/sync/config` | Get sync configuration |
| PUT | `/api/v1/sync/config` | Update sync configuration |
| GET | `/api/v1/sync/items/{itemId}/diff` | Get local vs remote diff |
| POST | `/api/v1/sync/items/{itemId}/publish` | Publish one item |
| POST | `/api/v1/sync/items/{itemId}/discard` | Discard local changes |
| POST | `/api/v1/sync/items/{itemId}/forget` | Remove state entry |
| POST | `/api/v1/sync/items/{itemId}/delete` | Delete from remote + local + state |
| POST | `/api/v1/sync/items/{itemId}/move` | Rename across local/remote/state |
| POST | `/api/v1/sync/delete-missing` | Delete all missing items |
| POST | `/api/v1/sync/cleanup` | Remove all missing entries from state |

`itemId` is a path parameter. If the ID contains `/`, URL-encode it (e.g., `memory/MEMORY` → `memory%2FMEMORY`).

### Get Status

```bash
curl "http://localhost:8080/api/v1/sync/status"
```

Response:

```json
{
  "enabled": true,
  "summary": "pending",
  "items": [
    {
      "itemId": "my-dag",
      "filePath": "my-dag.yaml",
      "displayName": "my-dag.yaml",
      "kind": "dag",
      "status": "modified"
    },
    {
      "itemId": "memory/MEMORY",
      "filePath": "memory/MEMORY.md",
      "displayName": "memory/MEMORY.md",
      "kind": "memory",
      "status": "untracked"
    }
  ],
  "counts": {
    "synced": 10,
    "modified": 1,
    "untracked": 1,
    "conflict": 0,
    "missing": 0
  }
}
```

- `items` are sorted by `filePath`.
- For `kind=dag`, `filePath` is `itemId + ".yaml"`.
- For `kind=memory` or `kind=soul`, `filePath` is `itemId + ".md"`.
- `displayName` equals `filePath`.

### Diff

```bash
curl "http://localhost:8080/api/v1/sync/items/memory%2FMEMORY/diff"
```

### Publish One Item

```bash
curl -X POST "http://localhost:8080/api/v1/sync/items/memory%2FMEMORY/publish" \
  -H "Content-Type: application/json" \
  -d '{"message":"Update global memory","force":false}'
```

Returns `409` with `SyncConflictResponse` when a conflict is detected and `force` is `false`.

### Publish Selected Items

```bash
curl -X POST "http://localhost:8080/api/v1/sync/publish-all" \
  -H "Content-Type: application/json" \
  -d '{
    "message":"Batch publish",
    "itemIds":["my-dag","memory/MEMORY"]
  }'
```

Omit `itemIds` to publish all modified/untracked items.

### Discard One Item

```bash
curl -X POST "http://localhost:8080/api/v1/sync/items/memory%2FMEMORY/discard"
```

### Forget One Item

```bash
curl -X POST "http://localhost:8080/api/v1/sync/items/missing-dag/forget"
```

Returns `400` if the item is `synced` or `modified`. Returns `404` if the item does not exist in state.

### Delete One Item

```bash
curl -X POST "http://localhost:8080/api/v1/sync/items/my-dag/delete" \
  -H "Content-Type: application/json" \
  -d '{"message":"Remove old DAG","force":false}'
```

| Field | Type | Description |
|---|---|---|
| `message` | string | Commit message |
| `force` | boolean | Force delete when item has local modifications |

Returns `400` for untracked items (use forget instead) or modified items without `force`. Returns `404` if not found.

### Delete All Missing Items

```bash
curl -X POST "http://localhost:8080/api/v1/sync/delete-missing" \
  -H "Content-Type: application/json" \
  -d '{"message":"Clean up missing items"}'
```

Request body is optional. Response:

```json
{
  "deleted": ["missing-a", "missing-b"],
  "message": "Deleted 2 missing item(s)"
}
```

Returns `400` when push is disabled.

### Move One Item

```bash
curl -X POST "http://localhost:8080/api/v1/sync/items/old-dag/move" \
  -H "Content-Type: application/json" \
  -d '{"newItemId":"new-dag","message":"Rename workflow","force":false}'
```

| Field | Type | Required | Description |
|---|---|---|---|
| `newItemId` | string | yes | New item ID to rename to |
| `message` | string | no | Commit message |
| `force` | boolean | no | Force move even with conflicts |

Returns `400` for validation errors (e.g., cross-kind moves) or when push is disabled. Returns `404` if not found. Returns `409` with conflict details when a conflict is detected and `force` is `false`.

### Cleanup

```bash
curl -X POST "http://localhost:8080/api/v1/sync/cleanup"
```

Response:

```json
{
  "forgotten": ["missing-a", "missing-b"],
  "message": "Cleaned up 2 item(s)"
}
```

## Permissions

| Endpoint | Permission |
|---|---|
| `GET /sync/status`, `GET /sync/config`, `POST /sync/test-connection` | No write permission required. Returns non-error responses even when sync is not configured. |
| `GET /sync/items/{itemId}/diff` | Requires sync service to be configured. |
| `POST /sync/pull`, `POST /sync/publish-all`, all `POST /sync/items/{itemId}/*` endpoints, `POST /sync/delete-missing`, `POST /sync/cleanup` | Requires `permissions.write_dags`. Authenticated users must satisfy `Role.CanWrite()` (`admin` or `manager`). |
| `PUT /sync/config` | Admin only. |

Write operations are blocked when Git Sync is read-only (`git_sync.enabled=true` and `push_enabled=false`).

## Data On Disk

| Path | Purpose |
|---|---|
| `{dags_dir}/` | Local DAG and agent files |
| `{data_dir}/gitsync/state.json` | Sync state |
| `{data_dir}/gitsync/repo/` | Local Git checkout cache |

### state.json structure

Top-level fields:
- `version` (int)
- `repository` (string)
- `branch` (string)
- `lastSyncAt` (datetime)
- `lastSyncCommit` (string)
- `lastSyncStatus` (string)
- `lastError` (string)
- `dags` (map of itemId → DAGState)

DAGState fields:

| Field | Type | Description |
|---|---|---|
| `status` | string | `synced`, `modified`, `untracked`, `conflict`, or `missing` |
| `kind` | string | `dag`, `memory`, or `soul` |
| `baseCommit` | string | Commit hash when item was last synced |
| `lastSyncedHash` | string | Content hash at last sync (`sha256:...`) |
| `lastSyncedAt` | datetime | When item was last synced |
| `modifiedAt` | datetime | When local modification was detected |
| `localHash` | string | Current local content hash |
| `remoteCommit` | string | Remote commit hash (populated on conflict) |
| `remoteAuthor` | string | Author of the remote commit (populated on conflict) |
| `remoteMessage` | string | Message of the remote commit (populated on conflict) |
| `conflictDetectedAt` | datetime | When the conflict was detected |
| `previousStatus` | string | Status before transitioning to `missing` |
| `missingAt` | datetime | When the file was first detected as missing |
| `lastStatModTime` | datetime | Cached file modification time (for change detection) |
| `lastStatSize` | int64 | Cached file size (for change detection) |
