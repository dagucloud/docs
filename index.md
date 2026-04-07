---
layout: doc
---

<img src="/hero-logo.webp" alt="Dagu" style="display: block; margin: 0 auto; width: 100%">

<div class="tagline" style="text-align: center;">
  <h2>Workflow Orchestration Engine</h2>
  <p>Single binary. No external dependencies. Scales from standalone to distributed cluster over gRPC.</p>
</div>

<div class="hero-section">
  <div class="hero-actions">
    <a href="/getting-started/quickstart" class="VPButton brand">Get Started</a>
    <a href="/writing-workflows/examples" class="VPButton alt">View Examples</a>
  </div>
</div>

<img src="/cockpit-demo.gif" alt="Cockpit demo" style="width: 100%; border-radius: 12px; margin: 8px 0 24px;" />

::: tip Try It Live
Explore without installing: [Live Demo](https://demo-instance.dagu.sh/)

Credentials: `demouser` / `demouser`
:::

## What Dagu Does

Dagu is a workflow orchestration engine that runs as a single binary with no external databases or message brokers. Workflows are defined as DAGs (Directed Acyclic Graphs) in YAML. It supports local execution, cron scheduling, queue-based concurrency control, and distributed coordinator/worker execution across multiple machines over gRPC.

All state is stored in local files by default. There is nothing to install besides the binary itself.

## Production Use Cases

**Data pipeline orchestration.** Define ETL/ELT workflows as DAGs with parallel and sequential steps. Use the built-in SQL executor to query PostgreSQL or SQLite, the S3 executor to move files to/from object storage, the `jq` executor for JSON transformation, and sub-DAG composition to break large pipelines into reusable stages. Steps can pass outputs to downstream steps via environment variables.

**Infrastructure automation.** Run commands on remote machines via the SSH executor with key-based authentication. Execute containers via the Docker or Kubernetes executor. Use preconditions to gate steps on environment checks, and lifecycle hooks (`onSuccess`, `onFailure`, `onExit`) to handle cleanup or notifications.

**Scheduled job management.** Replace crontab with DAGs that have cron scheduling, timezone support, retry policies, overlap control (`skip`, `all`, `latest`), and a web UI showing execution history, logs, and real-time status. Zombie detection automatically identifies and handles stalled runs.

**Batch processing at scale.** Distribute compute-heavy workloads across a pool of workers using the coordinator/worker architecture. Workers connect to a coordinator over gRPC, pull tasks from a queue, and report status back. Workers support label-based routing (e.g., `gpu=true`, `region=us-east-1`) so DAGs target specific machine capabilities.

**Legacy script orchestration.** Wrap existing shell scripts, Python scripts, HTTP calls, or any executable into workflow steps without modifying them. Dagu orchestrates execution order, captures stdout/stderr per step, and handles retries and error propagation around your existing code.

## Architecture

Dagu runs in three configurations:

**Standalone.** A single `dagu start-all` process runs the HTTP server, scheduler, and executor. Suitable for single-machine deployments.

**Coordinator/Worker.** The scheduler enqueues jobs to a file-based queue, then dispatches them to a coordinator over gRPC. Workers long-poll the coordinator for tasks, execute DAGs locally, and report status back. Workers can run on separate machines and are routed tasks based on labels. Mutual TLS secures gRPC communication between coordinator and workers.

**Headless.** Run without the web UI (`DAGU_HEADLESS=true`). Useful for CI/CD environments or when Dagu is managed through the CLI or API only.

```
Standalone:

  ┌─────────────────────────────────────────┐
  │  dagu start-all                         │
  │  ┌───────────┐ ┌───────────┐ ┌────────┐│
  │  │ HTTP / UI │ │ Scheduler │ │Executor││
  │  └───────────┘ └───────────┘ └────────┘│
  │  File-based storage (logs, state, queue)│
  └─────────────────────────────────────────┘

Distributed:

  ┌────────────┐                   ┌────────────┐
  │ Scheduler  │                   │ HTTP / UI  │
  │            │                   │            │
  │ ┌────────┐ │                   └─────┬──────┘
  │ │ Queue  │ │  Dispatch (gRPC)        │
  │ │(file)  │ │─────────┐               │
  │ └────────┘ │         │               │
  └────────────┘         ▼               ▼
                    ┌─────────────────────────┐
                    │      Coordinator        │
                    │  (gRPC task dispatch,   │
                    │   worker registry,      │
                    │   health monitoring)    │
                    └────────┬────────────────┘
                             │
                   Poll (gRPC long-polling)
                             │
               ┌─────────────┼─────────────┐
               │             │             │
          ┌────▼───┐    ┌────▼───┐    ┌────▼───┐
          │Worker 1│    │Worker 2│    │Worker N│
          └────┬───┘    └────┬───┘    └────┬───┘
               │             │             │
               └─────────────┴─────────────┘
                 Heartbeat / ReportStatus /
                 StreamLogs (gRPC)
```

## Quick Start

### Install

::: code-group

```bash [macOS/Linux]
curl -fsSL https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.sh | bash
```

```powershell [Windows (PowerShell)]
irm https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.ps1 | iex
```

```bash [Docker]
docker run --rm -v ~/.dagu:/var/lib/dagu -p 8080:8080 ghcr.io/dagucloud/dagu:latest dagu start-all
```

```bash [Homebrew]
brew install dagu
```

```bash [Kubernetes (Helm)]
helm repo add dagu https://dagucloud.github.io/dagu
helm repo update
helm install dagu dagu/dagu --set persistence.storageClass=<your-rwx-storage-class>
```

:::

The script installers run a guided wizard that installs Dagu, adds it to your PATH, sets up a background service, and creates the initial admin account. Homebrew, Docker, and Helm install without the wizard. See the [Installation Guide](/getting-started/installation) for all options.

### Create and Run a Workflow

```bash
cat > hello.yaml << 'EOF'
steps:
  - command: echo "Hello from Dagu!"
  - command: echo "Step 2"
EOF

dagu start hello.yaml
```

### Start the Server

```bash
dagu start-all
```

Visit [http://localhost:8080](http://localhost:8080)

## Built-in Executors

Dagu includes 17 built-in step executors. Each runs within the Dagu process (or worker). No plugins or external runtimes required.

| Executor | Purpose |
|----------|---------|
| `command` | Shell commands and scripts (bash, sh, PowerShell, custom shells) |
| `docker` | Run containers with registry auth, volume mounts, resource limits |
| `kubernetes` | Execute Kubernetes Pods with resource requests, service accounts, namespaces |
| `ssh` | Remote command execution with key-based auth and SFTP file transfer |
| `http` | HTTP requests (GET, POST, PUT, DELETE) with headers and authentication |
| `sql` | Query PostgreSQL and SQLite with parameterized queries and result capture |
| `redis` | Redis commands, pipelines, and Lua scripts |
| `s3` | Upload, download, list, and delete S3 objects |
| `jq` | JSON transformation using jq expressions |
| `mail` | Send email via SMTP |
| `archive` | Create zip/tar archives with glob patterns |
| `dag` | Invoke another DAG as a sub-workflow with parameter passing |
| `router` | Conditional step routing based on expressions |
| `template` | Text generation with template rendering |
| `chat` | LLM inference (OpenAI, Anthropic, Google Gemini, OpenRouter) |
| `agentstep` | Multi-step LLM agent execution with tool calling |
| `gha` | GitHub Actions execution |

See [Step Types](/step-types/shell) for configuration details of each executor.

## Scheduling and Reliability

| Feature | Details |
|---------|---------|
| **Cron scheduling** | Timezone support, multiple schedule entries per DAG |
| **Overlap policies** | `skip` (default), `all` (queue all), `latest` (keep only the most recent) |
| **Catch-up scheduling** | Automatically runs missed intervals when the scheduler was down |
| **Zombie detection** | Identifies and handles stalled DAG runs (configurable interval, default 45s) |
| **Retry policies** | Per-step retry with configurable limits, intervals, exit code filtering, exponential/linear/constant backoff |
| **Lifecycle hooks** | `onInit`, `onSuccess`, `onFailure`, `onAbort`, `onExit`, `onWait` |
| **Preconditions** | Gate DAG or step execution on shell command results |
| **Queue system** | File-based persistent queue with configurable concurrency limits per queue |
| **Scheduler HA** | Lock with stale detection for failover across multiple scheduler instances |

## Security and Access Control

### Authentication

Four authentication modes, configured via `DAGU_AUTH_MODE`:

| Mode | Description |
|------|-------------|
| `none` | No authentication |
| `basic` | HTTP Basic authentication |
| `builtin` | JWT-based authentication with user management, API keys, and per-DAG webhook tokens |
| OIDC | OpenID Connect integration with any compliant identity provider |

### Role-Based Access Control

When using `builtin` auth, five roles control access:

| Role | Capabilities |
|------|-------------|
| `admin` | Full access including user management |
| `manager` | Create, edit, delete, run, stop DAGs; view audit logs |
| `developer` | Create, edit, delete, run, stop DAGs |
| `operator` | Run and stop DAGs only (no editing) |
| `viewer` | Read-only access |

API keys can be created with independent role assignments. Audit logging tracks all actions.

### TLS and Secrets

- TLS for the HTTP server (`DAGU_CERT_FILE`, `DAGU_KEY_FILE`)
- Mutual TLS for gRPC coordinator/worker communication (`DAGU_PEER_CERT_FILE`, `DAGU_PEER_KEY_FILE`, `DAGU_PEER_CLIENT_CA_FILE`)
- Secret management with three providers: environment variables, files, and [HashiCorp Vault](https://www.vaultproject.io/)

## Observability

### Prometheus Metrics

Dagu exposes Prometheus-compatible metrics at the `/metrics` endpoint:

| Metric | Description |
|--------|-------------|
| `dagu_dag_runs_total` | Total DAG runs by status |
| `dagu_dag_runs_total_by_dag` | Per-DAG run counts |
| `dagu_dag_run_duration_seconds` | Histogram of run durations |
| `dagu_dag_runs_currently_running` | Active DAG runs |
| `dagu_dag_runs_queued_total` | Queued runs |
| `dagu_queue_wait_time` | Queue wait time histogram |
| `dagu_uptime_seconds` | Server uptime |

### OpenTelemetry

Per-DAG OpenTelemetry tracing configuration with OTLP endpoint, custom headers, resource attributes, and TLS options.

### Structured Logging and Notifications

- JSON or text format logging (`DAGU_LOG_FORMAT`), per-run log files with separate stdout/stderr capture per step
- Slack and Telegram bot integration for run status events (`succeeded`, `failed`, `aborted`, `waiting`, `rejected`)
- Email notifications on DAG success, failure, or wait status via SMTP
- Per-DAG webhook endpoints with token authentication

## Distributed Execution

The coordinator/worker architecture distributes DAG execution across multiple machines:

- **Coordinator**: gRPC server managing task distribution, worker registry, and health monitoring
- **Workers**: Connect to the coordinator, pull tasks via long-polling, execute DAGs locally, stream logs back
- **Worker labels**: Route DAGs to specific workers based on labels (e.g., `gpu=true`, `region=us-east-1`)
- **Health checks**: HTTP health endpoints on coordinator and workers for load balancer integration
- **Queue system**: File-based persistent queue with configurable concurrency limits

```bash
# Start coordinator
dagu coord

# Start workers (on separate machines)
DAGU_WORKER_LABELS=gpu=true,memory=64G dagu worker
```

See the [Distributed Execution documentation](/server-admin/distributed/) for setup details.

## Workflow Examples

### Parallel Execution with Dependencies

```yaml
type: graph
steps:
  - id: extract
    command: ./extract.sh

  - id: transform_a
    command: ./transform_a.sh
    depends: [extract]

  - id: transform_b
    command: ./transform_b.sh
    depends: [extract]

  - id: load
    command: ./load.sh
    depends: [transform_a, transform_b]
```

### Docker Step

```yaml
steps:
  - name: build
    container:
      image: node:20-alpine
    command: npm run build
```

### Retry with Exponential Backoff

```yaml
steps:
  - name: flaky-api-call
    command: curl -f https://api.example.com/data
    retryPolicy:
      limit: 3
      intervalSec: 10
      backoff: 2
      maxIntervalSec: 120
    continueOn:
      failure: true
```

### Scheduling with Overlap Control

```yaml
schedule:
  - "0 */6 * * *"
overlapPolicy: skip
timeoutSec: 3600
handlerOn:
  failure:
    command: notify-team.sh
  exit:
    command: cleanup.sh
```

### Sub-DAG Composition

```yaml
steps:
  - name: extract
    call: etl/extract
    params: "SOURCE=s3://bucket/data.csv"

  - name: transform
    call: etl/transform
    params: "INPUT=${extract.outputs.result}"
    depends: [extract]

  - name: load
    call: etl/load
    params: "DATA=${transform.outputs.result}"
    depends: [transform]
```

### SSH Remote Execution

```yaml
steps:
  - name: deploy
    type: ssh
    config:
      host: prod-server.example.com
      user: deploy
      key: ~/.ssh/id_rsa
    command: cd /var/www && git pull && systemctl restart app
```

See [Examples](/writing-workflows/examples) for more patterns.

## Version-Controlled Workflows

Dagu supports Git sync to keep DAG definitions version-controlled. Enable `DAGU_GITSYNC_ENABLED=true` with a repository URL, and Dagu pulls DAG definitions from a Git branch. Optional auto-sync polls the repository at a configurable interval (default 300s). Supports token and SSH authentication.

See [Git Sync](/server-admin/git-sync) for configuration.

## CLI Reference

| Command | Description |
|---------|-------------|
| `dagu start <dag>` | Execute a DAG |
| `dagu start-all` | Start HTTP server + scheduler |
| `dagu server` | Start HTTP server only |
| `dagu scheduler` | Start scheduler only |
| `dagu coord` | Start coordinator (distributed mode) |
| `dagu worker` | Start worker (distributed mode) |
| `dagu stop <dag>` | Stop a running DAG |
| `dagu restart <dag>` | Restart a DAG |
| `dagu retry <dag> <run-id>` | Retry a failed run |
| `dagu dry <dag>` | Dry run (show what would execute) |
| `dagu status <dag>` | Show DAG run status |
| `dagu history <dag>` | Show execution history |
| `dagu validate <dag>` | Validate DAG YAML |
| `dagu enqueue <dag>` | Add DAG to the execution queue |
| `dagu dequeue <dag>` | Remove DAG from the queue |
| `dagu cleanup` | Clean up old run data |
| `dagu migrate` | Run database migrations |

Full CLI and environment variable reference: [CLI](/overview/cli) | [Configuration Reference](/server-admin/reference)

## Learn More

<div class="next-steps">
  <div class="step-card">
    <h3><a href="/overview/">Overview</a></h3>
    <p>Architecture and core concepts</p>
  </div>
  <div class="step-card">
    <h3><a href="/getting-started/quickstart">Getting Started</a></h3>
    <p>Installation and first workflow</p>
  </div>
  <div class="step-card">
    <h3><a href="/writing-workflows/">Writing Workflows</a></h3>
    <p>YAML syntax, scheduling, execution control</p>
  </div>
  <div class="step-card">
    <h3><a href="/writing-workflows/yaml-specification">YAML Reference</a></h3>
    <p>All configuration options</p>
  </div>
  <div class="step-card">
    <h3><a href="/step-types/shell">Step Types</a></h3>
    <p>All 17 executor types</p>
  </div>
  <div class="step-card">
    <h3><a href="/server-admin/distributed/">Distributed Execution</a></h3>
    <p>Coordinator/worker setup</p>
  </div>
  <div class="step-card">
    <h3><a href="/server-admin/authentication/">Authentication</a></h3>
    <p>RBAC, OIDC, API keys, audit logging</p>
  </div>
  <div class="step-card">
    <h3><a href="/server-admin/">Server Administration</a></h3>
    <p>Deployment, configuration, operations</p>
  </div>
</div>

## Community

<div class="community-links">
  <a href="https://github.com/dagucloud/dagu" class="community-link">
    <span class="icon">GitHub</span>
  </a>
  <a href="https://discord.gg/gpahPUjGRk" class="community-link">
    <span class="icon">Discord</span>
  </a>
  <a href="https://bsky.app/profile/dagu-org.bsky.social" class="community-link">
    <span class="icon">Bluesky</span>
  </a>
  <a href="https://github.com/dagucloud/dagu/issues" class="community-link">
    <span class="icon">Issues</span>
  </a>
</div>
