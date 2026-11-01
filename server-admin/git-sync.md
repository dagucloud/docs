# Git Sync

Git Sync keeps workflows and their supporting files synchronized with a Git repository. Pulling changes places DAG definitions, scripts, templates, binaries, Wiki pages, Wiki attachments, and business calendars into their respective Dagu storage directories.

## Repository layout

Set `git_sync.path` when workflow files occupy a subdirectory within a larger repository. Dagu ignores tracked files outside that directory.

```text
repository
`-- workflows/                     # git_sync.path
    |-- daily-report.yaml          # DAG
    |-- calendars/
    |   `-- jp-banking.yaml        # business calendar
    |-- scripts/
    |   `-- generate.py            # supporting file
    |-- templates/
    |   `-- summary.html           # supporting file
    `-- wiki/
        `-- operations/
            `-- daily-report.md    # Wiki page
```

After a pull:

```text
paths.dags_dir/
|-- daily-report.yaml
|-- scripts/
|   `-- generate.py
`-- templates/
    `-- summary.html

paths.wiki_dir/
`-- operations/
    `-- daily-report.md

paths.calendars_dir/
`-- jp-banking.yaml
```

Paths under `git_sync.path` remain relative to their destination roots. Leave `path` empty when the repository itself is dedicated to Dagu files.

## What Git Sync tracks

Git Sync assigns every managed file an `itemId` and `kind`. The Web UI, CLI, and REST API use these values.

| Repository file | Local destination | itemId | kind |
|---|---|---|---|
| `daily-report.yaml` | `paths.dags_dir/daily-report.yaml` | `daily-report` | `dag` |
| `scripts/generate.py` | `paths.dags_dir/scripts/generate.py` | `scripts/generate.py` | `file` |
| `skills/review/SKILL.md` | `paths.dags_dir/skills/review/SKILL.md` | `skills/review/SKILL.md` | `file` |
| `wiki/operations/runbook.md` | `paths.wiki_dir/operations/runbook.md` | `wiki/operations/runbook` | `doc` |
| `wiki/.attachments/operations/runbook/chart.png` | `paths.wiki_dir/.attachments/operations/runbook/chart.png` | `wiki/.attachments/operations/runbook/chart.png` | `doc-asset` |
| `calendars/jp-banking.yaml` | `paths.calendars_dir/jp-banking.yaml` | `calendars/jp-banking` | `calendar` |

Supporting-file IDs retain their complete relative path and file extension. DAG, Wiki page, and calendar IDs omit `.yaml`, `.yml`, and `.md`.

An existing repository that contains `docs/` but not `wiki/` continues using `docs/` for Wiki content. Git Sync rejects a repository containing both directories rather than merging them.

### Calendars

A file `calendars/<name>.yaml` directly under the synchronized scope, with a valid calendar name, is a [business calendar](/writing-workflows/business-calendars). It syncs with `paths.calendars_dir`. Deeper paths, `.yml` files, and other files under `calendars/` keep their DAG or supporting-file handling.

- A calendar created on the Calendars page appears as `untracked` and can be published.
- On a pull, a local calendar that Git Sync has not synced yet, but that the repository also has, becomes a conflict when the contents differ. It is never overwritten.
- A calendar can only be moved to another calendar name.
- A DAG kept at `calendars/<name>.yaml` before calendars were synced becomes a calendar on the next pull. An unchanged copy in `paths.dags_dir` is removed; an edited copy becomes a conflict.

### Supporting files

Any Git-tracked regular file in scope that is not handled as a DAG, calendar, Wiki page, or Wiki attachment is a supporting file. Common examples include:

- shell, Python, PowerShell, and JavaScript files
- SQL, JSON, TOML, and dotenv configuration
- templates, certificates, and binary data
- authoring files under `skills/`

Git Sync does not automatically discover new supporting files created directly in `paths.dags_dir`. Commit new files to the Git repository first, then pull them into Dagu. Once tracked, local edits and deletions appear in Git Sync status and can be published.

Within the synchronized scope, reserve `.yaml` and `.yml` extensions for DAG definitions and calendars. Base configuration files and YAML files under the Wiki tree are excluded from supporting files.

Git symlinks and submodules are not synchronized. Additionally, a repository cannot contain items that resolve to the same `itemId`. For example, `workflow.yaml` and an extensionless supporting file named `workflow` collide, causing the pull operation to fail without writing either item.

::: warning Review the synchronized path
A pull copies every tracked supporting file in scope. In a general-purpose repository, set `git_sync.path` to the workflow subdirectory so unrelated files are not copied into `paths.dags_dir`.
:::

## Use supporting files from a workflow

Set `working_dir: .` when local steps should run from the directory containing the DAG file:

```yaml
working_dir: .

steps:
  - id: generate
    run: python scripts/generate.py --template templates/summary.html
```

For distributed execution, declare each file or directory under `dependencies`. Git Sync places the source files on the Dagu host; `dependencies` sends a snapshot to the worker.

```yaml
steps:
  - id: generate
    run: python scripts/generate.py --template templates/summary.html
    dependencies:
      - scripts/generate.py
      - templates/summary.html
```

The worker still requires the runtime that executes the file (for example, synchronizing a Python script does not install Python). See [File Dependencies](/writing-workflows/file-dependencies) for directories, globs, limits, and worker behavior.

## Configuration

```yaml
git_sync:
  enabled: true
  repository: github.com/your-org/automation
  branch: main
  path: workflows
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

`push_enabled: false` allows pulls but blocks publish, delete, and move operations. It also blocks DAG and calendar edits in the Web UI and API, so the server keeps matching the repository. This is the recommended setting for deployments that receive reviewed changes from a promotion branch.

## Authentication

### HTTPS token

```yaml
git_sync:
  repository: github.com/your-org/automation
  auth:
    type: token
    token: ${GITHUB_TOKEN}
```

### SSH key

```yaml
git_sync:
  repository: git@github.com:your-org/automation.git
  auth:
    type: ssh
    ssh_key_path: /home/user/.ssh/id_ed25519
    ssh_passphrase: ${SSH_PASSPHRASE}
```

For an SSH server that requires a username other than `git`, include it in the repository URL:

```yaml
git_sync:
  repository: deploy@git.example.com:your-org/automation.git
  auth:
    type: ssh
    ssh_key_path: /home/user/.ssh/id_ed25519
```

### Secrets from files

To read the token or the SSH passphrase from a file, such as a mounted Docker or Kubernetes secret, set `token_file` or `ssh_passphrase_file` instead:

```yaml
git_sync:
  repository: github.com/your-org/automation
  auth:
    type: token
    token_file: /run/secrets/git-token
```

The environment equivalents are `DAGU_GITSYNC_AUTH_TOKEN_FILE` and `DAGU_GITSYNC_AUTH_SSH_PASSPHRASE_FILE`. See [Secrets From Files](/server-admin/configuration#secrets-from-files).

## Work with changes

A typical update follows this sequence:

1. Check the current status.
2. Pull remote changes.
3. Review local and remote differences.
4. Publish selected local changes.
5. Resolve conflicts or clean up missing items.

### Status values

| Status | Meaning |
|---|---|
| `synced` | Local content matches the last synchronized version. |
| `modified` | A tracked local file changed. |
| `untracked` | A local DAG, Wiki page, Wiki attachment, or calendar has not been published. New local supporting files are not discovered. |
| `conflict` | Local and remote content both changed, or a locally changed tracked item was deleted remotely. |
| `missing` | A previously tracked local file is gone. |

### Pull and remote deletion

Pulling preserves local edits. If the remote repository deletes a tracked DAG, Wiki page, Wiki attachment, calendar, or supporting file:

- An unchanged local copy is removed, along with any directories the removal leaves empty.
- A locally edited copy remains and becomes a conflict.
- An `untracked` item is left alone.
- Discarding that deletion conflict removes the local copy.
- Force publishing the conflict restores the local file to the repository.

The CLI and Web UI report how many items were updated and removed.

### Text, binary, and executable files

Text files show local and remote content in the diff view. Binary files show local and remote sizes instead of loading their content into the viewer.

Git Sync preserves whether a supporting file is executable. On Unix systems, changing that permission marks the file as modified so it can be published. Windows does not track this file permission mode directly, so published changes preserve the executable state recorded in the repository.

## Web UI

Open **Git Sync** from the server navigation. The page provides separate filters for workflows, calendars, Wiki pages, attachments, and supporting files.

Use it to:

- pull remote changes and view updated or removed counts
- filter items by type and status
- compare text diffs, binary sizes, executable permissions, and remote deletions
- publish selected changes
- discard, move, delete, or forget an item when permitted by its status
- inspect the configured repository, branch, push mode, and auto-sync interval

Pull and other write operations require a write-capable role and `permissions.write_dags`. Publishing, deleting, and moving also require `push_enabled: true`.

## CLI

```bash
dagu sync status
dagu sync pull

dagu sync publish daily-report -m "Update workflow"
dagu sync publish scripts/generate.py -m "Update report script"
dagu sync publish skills/review/SKILL.md -m "Update review skill"
dagu sync publish --all -m "Update automation files"

dagu sync discard scripts/generate.py
dagu sync mv scripts/generate.py scripts/render.py -m "Rename report script"
dagu sync delete scripts/render.py -m "Remove report script"

dagu sync forget missing-item
dagu sync cleanup
```

See [CLI Reference](/getting-started/cli#sync) for every option and confirmation flag.

## REST API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/sync/status` | Overall sync status and tracked items |
| POST | `/api/v1/sync/pull` | Pull from the remote repository |
| POST | `/api/v1/sync/publish-all` | Publish selected or all changed items |
| POST | `/api/v1/sync/test-connection` | Verify repository access |
| GET | `/api/v1/sync/config` | Read current Git Sync config |
| PUT | `/api/v1/sync/config` | Update Git Sync config |
| GET | `/api/v1/sync/items/{itemId}/diff` | Show local and remote differences |
| POST | `/api/v1/sync/items/{itemId}/publish` | Publish one item |
| POST | `/api/v1/sync/items/{itemId}/discard` | Discard one item |
| POST | `/api/v1/sync/items/{itemId}/forget` | Remove stale sync state for one item |
| POST | `/api/v1/sync/items/{itemId}/delete` | Delete one item locally and remotely |
| POST | `/api/v1/sync/items/{itemId}/move` | Rename one item |
| POST | `/api/v1/sync/delete-missing` | Delete all missing items from the remote |
| POST | `/api/v1/sync/cleanup` | Remove all missing entries from sync state |

URL-encode item IDs in REST paths. For example, `scripts/report.py` becomes `scripts%2Freport.py`, and `assets/100%.txt` becomes `assets%2F100%25.txt`.

See [REST API](/web-ui/api#git-sync-endpoints) for request and response examples.

## Permissions and production use

Treat a synchronized repository as executable code. Review changes before promotion, restrict repository write access, and keep secrets out of tracked files.

| Action | Requirement |
|---|---|
| View status, diffs, and configuration | Authenticated access |
| Pull, publish, discard, delete, move, forget, and cleanup | `permissions.write_dags` and a write-capable role |
| Update Git Sync configuration | Admin role |

Publishing, deleting, and moving also require `push_enabled: true`.

For staging and production environments, use read-only Git Sync and promote reviewed commits between environment branches. See [Multi-Environment Deployments](/server-admin/deployment/multi-environment).

## Related pages

- [File Dependencies](/writing-workflows/file-dependencies)
- [Wiki](/web-ui/wiki)
- [Configuration](/server-admin/configuration)
- [Multi-Environment Deployments](/server-admin/deployment/multi-environment)
