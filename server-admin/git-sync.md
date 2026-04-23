# Git Sync

Git Sync keeps Dagu workflows, documents, and markdown-backed agent files aligned with a Git repository.

## What It Syncs

Git Sync can track:

- DAG files
- documents under `docs/`
- agent memory
- skills
- souls

## Tracked Items And IDs

Git Sync refers to each tracked file by an `itemId`. You will see that term in the CLI and REST API.

| Local file | itemId | kind |
|---|---|---|
| `my-dag.yaml` | `my-dag` | `dag` |
| `subdir/report.yml` | `subdir/report` | `dag` |
| `memory/MEMORY.md` | `memory/MEMORY` | `memory` |
| `skills/review/SKILL.md` | `skills/review/SKILL` | `skill` |
| `souls/persona.md` | `souls/persona` | `soul` |
| `docs/runbooks/deployment.md` | `docs/runbooks/deployment` | `doc` |

## Basic Configuration

```yaml
git_sync:
  enabled: true
  repository: github.com/your-org/dags
  branch: main
  path: ""
  push_enabled: true

  auth:
    type: token
    token: ${GITHUB_TOKEN}

  auto_sync:
    enabled: true
    on_startup: true
    interval: 300

  commit:
    author_name: Dagu
    author_email: dagu@localhost
```

## Authentication

### HTTPS Token

```yaml
git_sync:
  repository: github.com/your-org/dags
  auth:
    type: token
    token: ${GITHUB_TOKEN}
```

### SSH Key

```yaml
git_sync:
  repository: git@github.com:your-org/dags.git
  auth:
    type: ssh
    ssh_key_path: /home/user/.ssh/id_ed25519
    ssh_passphrase: ${SSH_PASSPHRASE}
```

## Everyday Workflow

Most teams use Git Sync in this order:

1. **Check status**
2. **Pull** remote changes
3. **Review diffs**
4. **Publish** selected local changes
5. **Discard**, **forget**, or **clean up** stale items when needed

## Status Values

| Status | Meaning |
|---|---|
| `synced` | Local content matches the last synced revision |
| `modified` | Local content changed since the last sync |
| `untracked` | The local file exists but has not been published yet |
| `conflict` | Both local and remote changed |
| `missing` | A previously tracked local file is gone |

## CLI

### Check Status

```bash
dagu sync status
```

### Pull

```bash
dagu sync pull
```

### Publish

```bash
dagu sync publish my-dag -m "Update workflow"
dagu sync publish memory/MEMORY -m "Update memory"
dagu sync publish --all -m "Batch update"
```

### Discard Local Changes

```bash
dagu sync discard my-dag
```

### Forget Stale State

```bash
dagu sync forget missing-dag
dagu sync cleanup
```

### Delete Or Move

```bash
dagu sync delete my-dag -m "Remove old workflow"
dagu sync mv old-dag new-dag -m "Rename workflow"
```

## REST API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/sync/status` | Overall sync status and tracked items |
| POST | `/api/v1/sync/pull` | Pull from the remote repository |
| POST | `/api/v1/sync/publish-all` | Publish selected or all changed items |
| POST | `/api/v1/sync/test-connection` | Verify repository access |
| GET | `/api/v1/sync/config` | Read current Git Sync config |
| PUT | `/api/v1/sync/config` | Update Git Sync config |
| GET | `/api/v1/sync/items/{itemId}/diff` | Show local vs remote diff |
| POST | `/api/v1/sync/items/{itemId}/publish` | Publish one item |
| POST | `/api/v1/sync/items/{itemId}/discard` | Discard one item |
| POST | `/api/v1/sync/items/{itemId}/forget` | Remove stale sync state for one item |
| POST | `/api/v1/sync/items/{itemId}/delete` | Delete one item locally and remotely |
| POST | `/api/v1/sync/items/{itemId}/move` | Rename one item |
| POST | `/api/v1/sync/delete-missing` | Delete all missing items from the remote |
| POST | `/api/v1/sync/cleanup` | Remove all missing entries from sync state |

If an `itemId` contains `/`, URL-encode it in REST calls.

## Permissions

| Action | Requirement |
|--------|-------------|
| View status and config | Authenticated access |
| Pull, publish, discard, delete, move, cleanup | `permissions.write_dags` plus a write-capable role |
| Update Git Sync config | Admin role |

Write operations are blocked when Git Sync is configured as read-only (`push_enabled: false`).

## Operational Notes

- Manage Git Sync through the UI, CLI, or API rather than editing its internal state directly.
- Pull before publishing when multiple people or systems may change the same repository.
- Use clear commit messages because Git Sync publishes normal Git commits.

## Related Pages

- [Server Administration](/server-admin/)
- [Documents](/web-ui/documents)
- [Memory](/features/agent/memory)
