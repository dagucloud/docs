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
  log_dir: /var/log/dagu
  data_dir: /var/lib/dagu/data
  dag_state_dir: /var/lib/dagu/data/dag-state
```

## Environment Variables

Configuration fields can be overridden with `DAGU_` environment variables. Nested fields are flattened with underscores.

```bash
export DAGU_HOST=0.0.0.0
export DAGU_PORT=8080
export DAGU_DAGS_DIR=/opt/dagu/dags
export DAGU_DOCS_DIR=/opt/dagu/docs
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
| `DAGU_DAGS_DIR` | `paths.dags_dir` | DAG definition directory |
| `DAGU_DOCS_DIR` | `paths.docs_dir` | Docs Markdown directory |
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
| `paths.dags_dir` | `~/.config/dagu/dags` | DAG definitions |
| `paths.docs_dir` | `{dags_dir}/docs` | Docs Markdown files |
| `paths.log_dir` | `~/.local/share/dagu/logs` | DAG logs |
| `paths.data_dir` | `~/.local/share/dagu/data` | Base directory for runtime data |
| `paths.tools_dir` | `{data_dir}/tools` | Managed DAG tool cache |
| `paths.artifact_dir` | `{data_dir}/artifacts` | DAG-run artifacts |
| `paths.dag_state_dir` | `{data_dir}/dag-state` | Persistent state for `state.*` actions |
| `paths.dag_runs_dir` | `{data_dir}/dag-runs` | DAG-run status and history |
| `paths.queue_dir` | `{data_dir}/queue` | Queue data |
| `paths.proc_dir` | `{data_dir}/proc` | Local process heartbeat data |
| `paths.service_registry_dir` | `{data_dir}/service-registry` | File-backed service registry data |
| `paths.users_dir` | `{data_dir}/users` | Builtin auth users |
| `paths.contexts_dir` | `{data_dir}/contexts` | CLI contexts |
| `paths.workspaces_dir` | `{data_dir}/workspaces` | Web UI workspaces |

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

In shared-filesystem distributed deployments, point `paths.dag_state_dir` at shared persistent storage when multiple processes can access the same state files. In shared-nothing deployments, workers use coordinator RPCs and the coordinator stores state under its own `paths.dag_state_dir`.

See [Persistent State](/writing-workflows/persistent-state) for workflow usage and [Shared Nothing Workers](/server-admin/distributed/workers/shared-nothing#persistent-state) for distributed behavior.

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

handlerOn:
  failure:
    command: echo "failed"
```

Do not put `paths`, `auth`, `coordinator`, `worker`, or other server process settings in `base.yaml`; they belong in `config.yaml`.

## Related Pages

- [Server Configuration](/server-admin/server)
- [Configuration Reference](/server-admin/reference)
- [Base Configuration](/server-admin/base-config)
- [Queue Configuration](/server-admin/queues)
- [Distributed Execution](/server-admin/distributed/)
- [Persistent State](/writing-workflows/persistent-state)
