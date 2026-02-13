# Git Sync

Git Sync synchronizes local DAG files and agent memory files with a remote Git repository.

## Tracked Files And Item IDs

Git Sync tracks items by `itemId` (path without extension).

| Local file | Tracked as | kind |
|---|---|---|
| `my-dag.yaml` | `my-dag` | `dag` |
| `subdir/report.yml` | `subdir/report` | `dag` |
| `memory/MEMORY.md` | `memory/MEMORY` | `memory` |
| `memory/dags/my-dag/MEMORY.md` | `memory/dags/my-dag/MEMORY` | `memory` |

Rules implemented by `internal/gitsync/service.go`:
- Remote scan includes `.yaml`, `.yml`, `.md`.
- `.md` is accepted only when the item is under `memory/`.
- Local untracked scan includes root-level `.yaml` / `.yml` files.
- Local untracked scan includes any `.md` file under `memory/` (recursive).

## Configuration

```yaml
gitSync:
  enabled: true
  repository: github.com/your-org/dags
  branch: main
  path: ""  # subdirectory in repo (empty = root)
  pushEnabled: true

  auth:
    type: token
    token: ${GITHUB_TOKEN}

  autoSync:
    enabled: true
    onStartup: true
    interval: 300

  commit:
    authorName: Dagu
    authorEmail: dagu@localhost
```

Defaults applied when `gitSync.enabled: true`:
- `branch: main`
- `pushEnabled: true`
- `auth.type: token`
- `autoSync.onStartup: true`
- `autoSync.interval: 300`
- `commit.authorName: Dagu`
- `commit.authorEmail: dagu@localhost`

## Authentication

### HTTPS token

```yaml
gitSync:
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
gitSync:
  repository: git@github.com:your-org/dags.git
  branch: main
  auth:
    type: ssh
    sshKeyPath: /home/user/.ssh/id_ed25519
    sshPassphrase: ${SSH_PASSPHRASE}
```

```bash
export DAGU_GITSYNC_AUTH_TYPE=ssh
export DAGU_GITSYNC_AUTH_SSH_KEY_PATH=/home/user/.ssh/id_ed25519
export DAGU_GITSYNC_AUTH_SSH_PASSPHRASE=your-passphrase
```

## CLI

```bash
dagu sync status
dagu sync pull
```

Publish one item or all modified/untracked items:

```bash
dagu sync publish my-dag -m "Update dag"
dagu sync publish memory/MEMORY -m "Update global memory"
dagu sync publish --all -m "Batch update"
```

Discard one item:

```bash
dagu sync discard my-dag
dagu sync discard memory/dags/my-dag/MEMORY
```

## Status Values

| status | meaning |
|---|---|
| `synced` | local content matches last synced content |
| `modified` | local content differs from `lastSyncedHash` |
| `untracked` | local item exists but has no synced baseline |
| `conflict` | local item is modified and remote changed since last sync |

## REST API

### Endpoints

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/api/v1/sync/status` | Returns overall status and `items[]` |
| POST | `/api/v1/sync/pull` | Pull from remote |
| POST | `/api/v1/sync/publish-all` | Publish selected `itemIds` or all modified/untracked if omitted |
| POST | `/api/v1/sync/test-connection` | Test repository/auth access |
| GET | `/api/v1/sync/config` | Get sync config |
| PUT | `/api/v1/sync/config` | Update sync config |
| GET | `/api/v1/sync/items/{itemId}/diff` | Get local vs remote diff for one item |
| POST | `/api/v1/sync/items/{itemId}/publish` | Publish one item |
| POST | `/api/v1/sync/items/{itemId}/discard` | Discard local changes for one item |

`itemId` is a path parameter. If the ID contains `/`, URL-encode it.

Example:
- raw item ID: `memory/MEMORY`
- path segment: `memory%2FMEMORY`

### Get Status Example

```bash
curl "http://localhost:8080/api/v1/sync/status"
```

Example response shape:

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
    "conflict": 0
  }
}
```

Implementation details from API handler (`internal/service/frontend/api/v1/sync.go`):
- `items` are sorted by `filePath`.
- for `kind=dag`, `filePath` is `itemId + ".yaml"`.
- for `kind=memory`, `filePath` is `itemId + ".md"`.
- `displayName` currently equals `filePath`.

### Diff Example (Memory Item)

```bash
curl "http://localhost:8080/api/v1/sync/items/memory%2FMEMORY/diff"
```

### Publish One Item

```bash
curl -X POST "http://localhost:8080/api/v1/sync/items/memory%2FMEMORY/publish" \
  -H "Content-Type: application/json" \
  -d '{"message":"Update global memory","force":false}'
```

### Publish Selected Items

```bash
curl -X POST "http://localhost:8080/api/v1/sync/publish-all" \
  -H "Content-Type: application/json" \
  -d '{
    "message":"Batch publish",
    "itemIds":["my-dag","memory/MEMORY"]
  }'
```

### Publish All Modified/Untracked Items

```bash
curl -X POST "http://localhost:8080/api/v1/sync/publish-all" \
  -H "Content-Type: application/json" \
  -d '{"message":"Publish all pending"}'
```

### Discard One Item

```bash
curl -X POST "http://localhost:8080/api/v1/sync/items/memory%2FMEMORY/discard"
```

## Permissions

API permission checks for sync endpoints:

- `/sync/status`, `/sync/config`, and `/sync/test-connection` return non-error responses even when sync is not configured.
- `/sync/items/{itemId}/diff` requires sync service configuration.
- write operations (`/sync/pull`, `/sync/publish-all`, `/sync/items/{itemId}/publish`, `/sync/items/{itemId}/discard`) require `server.permissions.writeDAGs`.
- authenticated users on write operations must satisfy `Role.CanWrite()` (`admin` or `manager`).
- write operations are blocked when Git Sync is read-only (`gitSync.enabled=true` and `pushEnabled=false`).
- Config update (`PUT /sync/config`): admin only.

## Data On Disk

| path | purpose |
|---|---|
| `{dagsDir}/` | local DAG and memory files |
| `{dataDir}/gitsync/state.json` | sync state |
| `{dataDir}/gitsync/repo/` | local Git checkout cache |

`state.json` top-level fields:
- `version`
- `repository`
- `branch`
- `lastSyncAt`
- `lastSyncCommit`
- `lastSyncStatus`
- `lastError`
- `dags` (`map[itemId]DAGState`)

`DAGState` fields:
- `status` (`synced|modified|untracked|conflict`)
- `kind` (`dag|memory`)
- `baseCommit`
- `lastSyncedHash`
- `lastSyncedAt`
- `modifiedAt`
- `localHash`
- `remoteCommit`
- `remoteAuthor`
- `remoteMessage`
- `conflictDetectedAt`
