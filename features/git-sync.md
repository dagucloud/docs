# Git Sync

Synchronize DAG definitions with a Git repository.

## Configuration

```yaml
gitSync:
  enabled: true
  repository: github.com/your-org/dags
  branch: main
  path: ""  # Subdirectory in repo (empty = root)
  pushEnabled: true

  auth:
    type: token
    token: ${GITHUB_TOKEN}

  autoSync:
    enabled: true
    onStartup: true
    interval: 300  # seconds

  commit:
    authorName: Dagu
    authorEmail: dagu@localhost
```

## Authentication

### Token (HTTPS)

GitHub offers two types of Personal Access Tokens. Choose one:

#### Option A: Fine-grained PAT (Recommended)

Fine-grained tokens are scoped to specific repositories with granular permissions.

**Create at:** GitHub > Settings > Developer settings > Personal access tokens > Fine-grained tokens

**Required settings:**
| Setting | Value |
|---------|-------|
| Repository access | Select the repository containing your DAGs |
| Permissions > Repository permissions > Contents | **Read and write** (for pull and push) |
| Permissions > Repository permissions > Metadata | **Read** (required for all fine-grained tokens) |

If you only need to pull (read-only mode with `pushEnabled: false`):
| Setting | Value |
|---------|-------|
| Permissions > Repository permissions > Contents | **Read-only** |
| Permissions > Repository permissions > Metadata | **Read** |

#### Option B: Classic PAT

Classic tokens use broad OAuth scopes and access all repositories you can access.

**Create at:** GitHub > Settings > Developer settings > Personal access tokens > Tokens (classic)

**Required scopes:**
| Repository Type | Required Scope | What it grants |
|-----------------|----------------|----------------|
| Private repository | `repo` | Full access to all private and public repos you can access |
| Public repository only | `public_repo` | Read/write access to public repos only |

::: warning
Classic PATs with `repo` scope grant access to ALL your private repositories, not just the DAGs repository. Use fine-grained tokens for better security.
:::

#### Configuration

```yaml
gitSync:
  repository: github.com/your-org/dags
  branch: main
  auth:
    type: token
    token: ${GITHUB_TOKEN}
```

Environment variables:
```bash
export DAGU_GITSYNC_AUTH_TYPE=token
export DAGU_GITSYNC_AUTH_TOKEN=ghp_xxxxxxxxxxxx
```

### SSH Key

Supported key types: RSA, ED25519, ECDSA (via `go-git/v5`).

**Repository URL must use SSH format:** `git@github.com:org/repo.git`

Add your public key to GitHub: Settings > SSH and GPG keys > New SSH key

```yaml
gitSync:
  repository: git@github.com:your-org/dags.git
  branch: main
  auth:
    type: ssh
    sshKeyPath: /home/user/.ssh/id_ed25519
    sshPassphrase: ${SSH_PASSPHRASE}  # Only if key is encrypted
```

Environment variables:
```bash
export DAGU_GITSYNC_AUTH_TYPE=ssh
export DAGU_GITSYNC_AUTH_SSH_KEY_PATH=/home/user/.ssh/id_ed25519
export DAGU_GITSYNC_AUTH_SSH_PASSPHRASE=your-passphrase
```

## CLI Commands

### Status

```bash
dagu sync status
```

Output: repository, branch, last sync time/commit, DAG counts by status.

### Pull

```bash
dagu sync pull
```

Fetches remote changes. Local modifications preserved (marked `modified`). Conflicts detected when both local and remote changed.

### Publish

```bash
dagu sync publish my-dag -m "Updated schedule"
dagu sync publish --all -m "Batch update"
```

Flags:
- `-m, --message <string>`: Commit message
- `--all`: Publish all modified DAGs
- `-f, --force`: Force publish (overwrite conflicts)

### Discard

```bash
dagu sync discard my-dag
```

Restores remote version. **Permanently discards local changes.**

## DAG Status States

| Status | Meaning |
|--------|---------|
| `synced` | Local matches remote |
| `modified` | Local has unpublished changes |
| `untracked` | Exists locally only |
| `conflict` | Both local and remote modified since last sync |

## Conflict Resolution

```bash
# Option 1: Force publish (overwrites remote)
dagu sync publish my-dag --force -m "Override remote"

# Option 2: Discard local (restores remote)
dagu sync discard my-dag

# Option 3: Manual merge, then publish
# Edit the file, then:
dagu sync publish my-dag -m "Merged changes"
```

## REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/sync/status` | Overall sync status |
| POST | `/api/v1/sync/pull` | Pull from remote |
| POST | `/api/v1/sync/publish-all` | Publish all modified DAGs |
| POST | `/api/v1/sync/test-connection` | Test remote connection |
| GET | `/api/v1/sync/config` | Get configuration |
| PUT | `/api/v1/sync/config` | Update configuration |
| POST | `/api/v1/dags/{name}/sync/publish` | Publish single DAG |
| POST | `/api/v1/dags/{name}/sync/discard` | Discard single DAG changes |

### Examples

```bash
# Get status
curl http://localhost:8080/api/v1/sync/status

# Pull
curl -X POST http://localhost:8080/api/v1/sync/pull

# Publish DAG
curl -X POST http://localhost:8080/api/v1/dags/my-dag/sync/publish \
  -H "Content-Type: application/json" \
  -d '{"message": "Updated schedule", "force": false}'
```

## Configuration Reference

### Main Options

| Option | Type | Default | Environment Variable |
|--------|------|---------|----------------------|
| `enabled` | bool | `false` | `DAGU_GITSYNC_ENABLED` |
| `repository` | string | (required) | `DAGU_GITSYNC_REPOSITORY` |
| `branch` | string | `main` | `DAGU_GITSYNC_BRANCH` |
| `path` | string | `""` | `DAGU_GITSYNC_PATH` |
| `pushEnabled` | bool | `true` | `DAGU_GITSYNC_PUSH_ENABLED` |

### Authentication (`auth`)

| Option | Type | Default | Environment Variable |
|--------|------|---------|----------------------|
| `type` | string | `token` | `DAGU_GITSYNC_AUTH_TYPE` |
| `token` | string | - | `DAGU_GITSYNC_AUTH_TOKEN` |
| `sshKeyPath` | string | - | `DAGU_GITSYNC_AUTH_SSH_KEY_PATH` |
| `sshPassphrase` | string | - | `DAGU_GITSYNC_AUTH_SSH_PASSPHRASE` |

### Auto-Sync (`autoSync`)

| Option | Type | Default | Environment Variable |
|--------|------|---------|----------------------|
| `enabled` | bool | `false` | `DAGU_GITSYNC_AUTOSYNC_ENABLED` |
| `onStartup` | bool | `true` | `DAGU_GITSYNC_AUTOSYNC_ON_STARTUP` |
| `interval` | int | `300` | `DAGU_GITSYNC_AUTOSYNC_INTERVAL` |

### Commit (`commit`)

| Option | Type | Default | Environment Variable |
|--------|------|---------|----------------------|
| `authorName` | string | `Dagu` | `DAGU_GITSYNC_COMMIT_AUTHOR_NAME` |
| `authorEmail` | string | `dagu@localhost` | `DAGU_GITSYNC_COMMIT_AUTHOR_EMAIL` |

## Read-Only Mode

Set `pushEnabled: false` for deployments where DAGs are managed externally (CI/CD pushes to repo, Dagu only pulls).

```yaml
gitSync:
  enabled: true
  repository: github.com/your-org/dags
  branch: main
  pushEnabled: false
  auth:
    type: token
    token: ${GITHUB_TOKEN}
  autoSync:
    enabled: true
    interval: 300
```

In this mode, `dagu sync publish` returns error `"push operations are disabled"`.

## Permissions

Git Sync operations require the following user roles (when authentication is enabled):

| Operation | Required Role |
|-----------|--------------|
| View status | Any authenticated user |
| View config | Any authenticated user |
| Test connection | Any authenticated user |
| Pull changes | `admin` or `manager` |
| Publish DAG(s) | `admin` or `manager` |
| Discard changes | `admin` or `manager` |
| Update config | `admin` only |

Additionally:
- Server must have `writeDAGs` permission enabled in `server.permissions`
- If `pushEnabled: false`, all write operations return 403 Forbidden

## Data Management

### Storage Locations

| Location | Path | Purpose |
|----------|------|---------|
| Local DAGs | `{dagsDir}/` | User-editable DAG files |
| State file | `{dataDir}/gitsync/state.json` | Tracks sync status per DAG |
| Repo cache | `{dataDir}/gitsync/repo/` | Shallow clone of remote (depth=1) |

### State File Format

**Top-level fields:**

| Field | Type | Description |
|-------|------|-------------|
| `version` | int | Format version (currently 1) |
| `repository` | string | Remote URL |
| `branch` | string | Tracked branch |
| `lastSyncAt` | timestamp | Last successful sync time |
| `lastSyncCommit` | string | Git commit hash from last sync |
| `lastSyncStatus` | string | `"success"` or `"error"` |
| `lastError` | string | Error message (if failed) |
| `dags` | map | DAG ID → DAGState |

**Per-DAG state (`dags[id]`):**

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | `synced`, `modified`, `untracked`, `conflict` |
| `baseCommit` | string | Commit hash when last synced |
| `lastSyncedHash` | string | Content hash at last sync (`sha256:hex`) |
| `localHash` | string | Current local content hash |
| `lastSyncedAt` | timestamp | When DAG was last synced |
| `modifiedAt` | timestamp | When local file was modified |
| `remoteCommit` | string | Conflicting commit (if conflict) |
| `remoteAuthor` | string | Conflict commit author |
| `remoteMessage` | string | Conflict commit message |
| `conflictDetectedAt` | timestamp | When conflict was detected |

### Change Detection

Content hash: `sha256:` + hex(SHA256(file_content))

- `localHash == lastSyncedHash` → `synced`
- `localHash != lastSyncedHash` → `modified`
- No `lastSyncedHash` → `untracked`

### Sync Algorithm

**Pull:**
1. `git fetch --depth=1` from remote
2. For each remote `.yaml`/`.yml` file:
   - Compute remote hash
   - If local status=`modified` AND remote hash != lastSyncedHash → **conflict**
   - Else update local file, set status=`synced`
3. Scan local DAGs dir for untracked files
4. Save state.json

**Publish:**
1. If status=`conflict` and force=false → error
2. Copy DAG file to repo working tree
3. `git add` + `git commit` (with configured author)
4. `git push`
5. Update state: status=`synced`, update hashes

**Conflict occurs when:**
- Local file modified (localHash != lastSyncedHash)
- AND remote changed (pulled hash != lastSyncedHash)

### State Transitions

```
[new file] → untracked
                ↓ publish
            synced ←──────────────┐
                ↓ local edit      │
            modified              │
           ↙        ↘             │
    [pull+remote    [publish] ────┘
     changed]
        ↓
    conflict
        ↓ publish --force OR discard
    synced
```

### Internals

| Item | Detail |
|------|--------|
| Git library | `go-git/v5` |
| Synced files | `.yaml`, `.yml` only |
| Clone depth | Shallow clone (`depth: 1`) |

## References

- [GitHub: Managing personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [GitHub: Fine-grained PAT permissions](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens)
- [GitHub: Scopes for OAuth Apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)
