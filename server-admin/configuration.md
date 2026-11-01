# Configuration

Dagu configuration is split by purpose:

| File or source | Purpose |
| --- | --- |
| `config.yaml` | Server, scheduler, coordinator, worker, storage paths, authentication, queues, and other process-level settings |
| `base.yaml` | Shared defaults inherited by DAG definitions, such as env vars, handlers, defaults, and reusable actions |
| DAG YAML files | Workflow definitions and workflow-specific settings |
| Environment variables | Deployment-time overrides for `config.yaml` fields |
| Command-line flags | One-off process overrides |

Use this page for process-level configuration. For shared workflow defaults, see [Base Configuration](/server-admin/base-config). For the full field list, see [Configuration Reference](/server-admin/reference).

## Precedence

When the same setting is provided in more than one place, Dagu uses this order:

1. Command-line flags
2. Environment variables
3. `config.yaml`
4. Built-in defaults

Example:

```bash
dagu start-all --port 9000
export DAGU_PORT=8080
```

With this command, Dagu listens on port `9000` because the flag wins over the environment variable.

## Configuration File

The default configuration file is:

```text
~/.config/dagu/config.yaml
```

Most commands also accept `--config`:

```bash
dagu start-all --config /etc/dagu/config.yaml
```

A minimal production-oriented file looks like this:

```yaml
host: 0.0.0.0
port: 8080
public_url: https://dagu.example.com

auth:
  mode: builtin

paths:
  dags_dir: /opt/dagu/dags
  wiki_dir: /opt/dagu/dags/wiki
  log_dir: /var/log/dagu
  data_dir: /var/lib/dagu/data
  dag_state_dir: /var/lib/dagu/data/dag-state
  dag_run_work_dir: /var/lib/dagu/data/dag-run-work
```

`dag_run_work_dir` specifies the root directory for per-run working directories. Steps run here when a DAG does not define a `working_dir`. Point it at fast local storage when steps write large intermediate files. Each directory is removed along with its DAG run, keeping storage bounded by the retention policy rather than growing indefinitely. See [Per-Run Work Directory](/writing-workflows/runtime-variables#per-run-work-directory-dag-run-work-dir).

## Environment Variables

Configuration fields can be overridden with `DAGU_` environment variables. Nested fields are flattened with underscores.

```bash
export DAGU_HOST=0.0.0.0
export DAGU_PORT=8080
export DAGU_DAGS_DIR=/opt/dagu/dags
export DAGU_WIKI_DIR=/opt/dagu/dags/wiki
export DAGU_DAG_DISCOVERY_RECURSIVE=true
export DAGU_DAG_DISCOVERY_SYMLINKS=true
export DAGU_DATA_DIR=/var/lib/dagu/data
export DAGU_DAG_STATE_DIR=/var/lib/dagu/data/dag-state

dagu start-all
```

Common examples:

| Environment variable | Config field | Purpose |
| --- | --- | --- |
| `DAGU_HOST` | `host` | Web UI bind address |
| `DAGU_PORT` | `port` | Web UI port |
| `DAGU_PUBLIC_URL` | `public_url` | External URL used in generated links |
| `DAGU_DAGS_DIR` | `paths.dags_dir` | DAG definitions and Git Sync supporting files |
| `DAGU_WIKI_DIR` | `paths.wiki_dir` | Markdown Wiki page directory |
| `DAGU_CALENDARS_DIR` | `paths.calendars_dir` | Business calendar files |
| `DAGU_DAG_DISCOVERY_RECURSIVE` | `dag_discovery.recursive` | Discover DAG definitions in subdirectories |
| `DAGU_DAG_DISCOVERY_SYMLINKS` | `dag_discovery.symlinks` | Include DAG file symlinks and allow external targets |
| `DAGU_DATA_DIR` | `paths.data_dir` | Data directory used by derived stores |
| `DAGU_LOG_DIR` | `paths.log_dir` | Log directory |
| `DAGU_ARTIFACT_DIR` | `paths.artifact_dir` | DAG-run artifact directory |
| `DAGU_DAG_STATE_DIR` | `paths.dag_state_dir` | Persistent DAG state directory |
| `DAGU_BASE_CONFIG` | `paths.base_config` | Base DAG configuration file |
| `DAGU_QUEUE_DIR` | `paths.queue_dir` | Queue storage directory |
| `DAGU_PROC_DIR` | `paths.proc_dir` | Process heartbeat storage directory |

For all environment variables, see [Configuration Reference - Environment Variables](/server-admin/reference#environment-variables).

### Container Runtime Environment

Container runtime selection is process-level configuration. Set these variables
on the Dagu process that executes runs:

| Environment variable | Purpose |
| --- | --- |
| `DAGU_CONTAINER_RUNTIME` | Container runtime for root-level `container:`, step-level `container:`, `docker.run`, and containerized `harness.run`. Valid values are `docker` and `podman`; unset means `docker`. |
| `DAGU_PODMAN_HOST` | Podman's Docker-compatible API socket, used when `DAGU_CONTAINER_RUNTIME=podman`. Default: `unix:///run/podman/podman.sock`. |

These are not DAG YAML fields. Do not set them under DAG-level or step-level
`env:` to select a runtime for a workflow.

See [Harness Sandboxed Execution](/step-types/harness/sandbox/) for Docker and
Podman setup examples.

## `DAGU_HOME`

`DAGU_HOME` is an all-in-one directory override. When set, Dagu derives its default config, base config, DAG, log, and data paths from that directory unless a more specific flag, environment variable, or config field overrides them.

```bash
export DAGU_HOME=/var/lib/dagu
dagu start-all
```

Typical layout:

```text
/var/lib/dagu/
|-- config.yaml
|-- base.yaml
|-- dags/
|   |-- report.yaml
|   |-- scripts/
|   |   `-- report.py
|   `-- wiki/
|-- logs/
`-- data/
    |-- artifacts/
    |-- dag-state/
    |-- dag-runs/
    |-- proc/
    `-- queue/
```

Use `DAGU_HOME` for simple single-directory deployments. Use explicit `paths.*` fields when each store needs a different mount, retention policy, or backup policy.

## Paths

Most persistent runtime data is stored under `paths.data_dir` by default.

| Config field | Default | Purpose |
| --- | --- | --- |
| `paths.dags_dir` | `~/.config/dagu/dags` | DAG definitions and Git Sync supporting files |
| `paths.wiki_dir` | `{dags_dir}/wiki` | Markdown Wiki pages and runbooks |
| `paths.calendars_dir` | `~/.config/dagu/calendars` | [Business calendar](/writing-workflows/business-calendars) files that start schedules name |
| `paths.log_dir` | `~/.local/share/dagu/logs` | DAG logs |
| `paths.data_dir` | `~/.local/share/dagu/data` | Base directory for runtime data |
| `paths.tools_dir` | `{data_dir}/tools` | Managed DAG tool cache |
| `paths.artifact_dir` | `{data_dir}/artifacts` | DAG-run artifacts |
| `paths.dag_state_dir` | `{data_dir}/dag-state` | Persistent state for `state.*` actions |
| `paths.dag_runs_dir` | `{data_dir}/dag-runs` | DAG-run status and history |
| `paths.dag_run_work_dir` | `{data_dir}/dag-run-work` | Per-run working directories |
| `paths.queue_dir` | `{data_dir}/queue` | Queue data |
| `paths.proc_dir` | `{data_dir}/proc` | Local process heartbeat data |
| `paths.service_registry_dir` | `{data_dir}/service-registry` | File-backed service registry data |
| `paths.users_dir` | `{data_dir}/users` | Builtin auth users |
| `paths.contexts_dir` | `{data_dir}/contexts` | CLI contexts |
| `paths.workspaces_dir` | `{data_dir}/workspaces` | Web UI workspaces |

[Git Sync](/server-admin/git-sync) writes DAG definitions and supporting files to `paths.dags_dir`, Wiki pages and attachments to `paths.wiki_dir`, and calendars to `paths.calendars_dir`. The `git_sync.path` setting selects a repository subdirectory without appending that subdirectory name to any local destination path.

A backup of the complete `paths.data_dir` includes both DAG-run history and per-run work directories at their default locations. If backups select individual subdirectories, include both `paths.dag_runs_dir` and `paths.dag_run_work_dir`; restoring history alone can leave retries without files created by earlier attempts.

## Wiki Directory

`paths.wiki_dir` is the storage root for Markdown files managed by the Wiki Web UI and Git Sync:

```yaml
paths:
  dags_dir: /opt/dagu/dags
  wiki_dir: /srv/dagu/wiki
```

The equivalent environment variable is:

```bash
export DAGU_WIKI_DIR=/srv/dagu/wiki
```

When `paths.wiki_dir` is not configured, a fresh installation uses `<paths.dags_dir>/wiki`. Default-workspace Wiki pages live directly in that directory. Named workspaces use a directory named after the workspace:

```text
/srv/dagu/wiki/
|-- shared-runbook.md
`-- finance/
    `-- month-end-close.md
```

`shared-runbook.md` belongs to Default. The second path is owned by the `finance` workspace when that workspace exists. Treat the Wiki root and workspace records as related state when designing backups. Dagu moves the matching Wiki directory when a workspace is renamed and blocks workspace deletion until its pages are removed.

Existing installations are adopted without moving files. If `wiki` is absent and the legacy `<paths.dags_dir>/docs` directory exists, Dagu uses `docs` as the Wiki root. Startup fails when both directories exist, preventing an implicit merge. The deprecated `paths.docs_dir` and `DAGU_DOCS_DIR` settings remain accepted with a warning; `paths.wiki_dir` or `DAGU_WIKI_DIR` takes precedence when both names are configured.

Each workflow run also receives a per-DAG Wiki path as `${context.paths.wiki_dir}` and `DAG_WIKI_DIR`. The deprecated `${context.paths.docs_dir}`, `${paths.docs_dir}`, and `DAG_DOCS_DIR` aliases point to the same path. See [Wiki](/web-ui/wiki) and [Runtime Context and Variables](/writing-workflows/runtime-variables).

## Recursive DAG Discovery

By default, Dagu discovers DAG definitions only at the top level of
`paths.dags_dir`. Enable recursive discovery to organize `.yaml` and `.yml`
files in subdirectories:

```yaml
paths:
  dags_dir: /opt/dagu/dags

dag_discovery:
  recursive: true
```

The equivalent environment variable is:

```bash
export DAGU_DAG_DISCOVERY_RECURSIVE=true
```

Recursive discovery skips dot-directories, the root `workspaces/` directory,
and symlinked directories. `paths.alt_dags_dir` remains a lookup path and is not
included in the recursive catalog.

File names without their `.yaml` or `.yml` extension must be unique across the
discovered tree. Effective DAG `name` values must also be unique. Comparison is
case-sensitive. If either value is duplicated, Dagu excludes every DAG in that
conflict from the Definitions page and scheduler. The Definitions page shows an
error with the conflicting paths. After the files are renamed or removed, the
remaining DAG is discovered again automatically.

### DAG File Symlinks

Enable file-symlink discovery when DAG definitions are linked into
`paths.dags_dir`:

```yaml
dag_discovery:
  symlinks: true
```

The equivalent environment variable is:

```bash
export DAGU_DAG_DISCOVERY_SYMLINKS=true
```

This opt-in includes YAML file symlinks in recursive discovery and permits
targets outside `paths.dags_dir`. External targets can be viewed, scheduled,
and run, but cannot be updated, deleted, or renamed through Dagu. Symlinked
directories are never traversed. A symlink configured as `paths.dags_dir`
itself is supported.

Without the opt-in, top-level YAML file symlinks whose targets remain inside
`paths.dags_dir` continue to work in the default non-recursive mode. File
symlinks encountered during recursive discovery are skipped.

### Persistent State Directory

`paths.dag_state_dir` stores the file-backed state used by `state.get`, `state.set`, `state.delete`, `state.list`, and `state.diff`.

```yaml
paths:
  dag_state_dir: /var/lib/dagu/data/dag-state
```

Equivalent environment variable:

```bash
export DAGU_DAG_STATE_DIR=/var/lib/dagu/data/dag-state
```

Distributed workers use coordinator RPCs for persistent state. The coordinator stores state under its own `paths.dag_state_dir`. Use persistent or shared server-side storage when coordinator replacement must preserve it.

See [Persistent State](/writing-workflows/persistent-state) for workflow usage and [Worker Deployment](/server-admin/distributed/workers/shared-nothing#persistent-state) for distributed behavior.

## Config File vs Base Config

Use `config.yaml` for server and runtime settings:

```yaml
host: 0.0.0.0
port: 8080
queues:
  enabled: true
```

Use `base.yaml` for defaults inherited by DAGs:

```yaml
env:
  - APP_ENV: production

handler_on:
  failure:
    run: echo "failed"
```

Do not put `paths`, `auth`, `coordinator`, `worker`, or other server process settings in `base.yaml`; they belong in `config.yaml`.

## Related Pages

- [Server Configuration](/server-admin/server)
- [Configuration Reference](/server-admin/reference)
- [Base Configuration](/server-admin/base-config)
- [Queue Configuration](/server-admin/queues)
- [Distributed Execution](/server-admin/distributed/)
- [Persistent State](/writing-workflows/persistent-state)
- [Wiki](/web-ui/wiki)
