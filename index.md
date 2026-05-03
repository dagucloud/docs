---
layout: doc
---

<img src="/hero-logo.webp" alt="Dagu" style="display: block; margin: 0 auto; width: 100%">

<div class="tagline" style="text-align: center;">
  <h2>Run scripts, cron jobs, and runbooks as workflows.</h2>
  <p>Dagu turns the commands your team already runs into scheduled, observable workflows that are safe to rerun: shell scripts, Python scripts, containers, HTTP tasks, SQL jobs, SSH operations, sub-workflows, and agent-driven steps.</p>
  <p>Define the workflow in plain YAML, run it with one binary, and get the operational layer that cron and ad hoc scripts are missing: dependencies, retries, queues, logs, artifacts, approvals, API/webhooks, and optional distributed workers.</p>
  <p>No database required. No message broker. No framework rewrite. No platform migration. State is file-backed by default, and a full local server starts with <code>dagu start-all</code>.</p>
</div>

<div class="hero-section">
  <div class="hero-actions">
    <a href="/getting-started/quickstart" class="VPButton brand">Get Started</a>
    <a href="/overview/deployment-models" class="VPButton alt">Deployment Models</a>
    <a href="/writing-workflows/examples" class="VPButton alt">View Examples</a>
  </div>
</div>

<video src="/cockpit-demo.mp4" controls preload="metadata" playsinline aria-label="Cockpit demo" style="width: 100%; border-radius: 12px; margin: 8px 0 24px;"></video>

::: tip Try It Live
Explore without installing: [Live Demo](https://dagu-demo-f5e33d0e.dagu.sh/)

Credentials: `demouser` / `demouser`
:::

## What Dagu Does

Dagu is an operations automation engine that helps teams consolidate existing scripts, commands, containers, server tasks, SQL jobs, HTTP calls, SSH operations, and runbooks into one self-hosted workflow system.

By default, Dagu keeps workflows, run history, logs, and artifacts on local disk, so teams can move from fragmented cron and scattered scripts to visible, retryable workflows without introducing a large orchestration project.

## Real-World Use Cases

Dagu fits teams that already have operational work spread across scripts, cron jobs, SQL tasks, HTTP automation, containers, and manual runbooks, and need one place to run, monitor, retry, and manage that work.

<div class="real-world-usecases">
  <div class="real-world-usecase">
    <h3>Cron and Legacy Script Management</h3>
    <p><strong>Run:</strong> existing shell scripts, Python scripts, HTTP calls, and scheduled jobs without rewriting them.</p>
    <p><strong>Why Dagu fits:</strong> Dagu turns hidden cron jobs and scattered scripts into visible workflows with dependencies, run status, logs, retries, history, and operator controls in one place.</p>
  </div>
  <div class="real-world-usecase">
    <h3>ETL and Data Operations</h3>
    <p><strong>Run:</strong> PostgreSQL or SQLite queries, S3 transfers, <code>jq</code> transforms, validation steps, and reusable sub-workflows.</p>
    <p><strong>Why Dagu fits:</strong> daily data workflows stay declarative, observable, and easy to retry when one step fails.</p>
  </div>
  <div class="real-world-usecase">
    <h3>Media Conversion</h3>
    <p><strong>Run:</strong> <code>ffmpeg</code>, thumbnail extraction, audio normalization, image processing, and other compute-heavy jobs.</p>
    <p><strong>Why Dagu fits:</strong> conversion work can run across distributed workers while status, history, logs, and artifacts stay visible in one place for monitoring, debugging, and retries.</p>
  </div>
  <div class="real-world-usecase">
    <h3>Infrastructure and Server Automation</h3>
    <p><strong>Run:</strong> SSH backups, cleanup jobs, deploy scripts, patch windows, precondition checks, and lifecycle hooks.</p>
    <p><strong>Why Dagu fits:</strong> remote operations get schedules, retries, notifications, and per-step logs without requiring operators to SSH into servers for every recovery.</p>
  </div>
  <div class="real-world-usecase">
    <h3>GitHub-driven Workflows</h3>
    <p><strong>Run:</strong> PR validation, preview deployments, release workflows, check reruns, and repository dispatches from GitHub.</p>
    <p><strong>Why Dagu fits:</strong> GitHub stays the trigger source while Dagu executes the DAG on your licensed server and reports checks, reactions, and comments back to GitHub.</p>
  </div>
  <div class="real-world-usecase">
    <h3>Container and Kubernetes Workflows</h3>
    <p><strong>Run:</strong> Docker images, Kubernetes Jobs, shell glue, and follow-up validation steps.</p>
    <p><strong>Why Dagu fits:</strong> teams can compose image-based tasks and route them to the right workers without building a custom control plane.</p>
  </div>
  <div class="real-world-usecase">
    <h3>Customer Support Automation</h3>
    <p><strong>Run:</strong> diagnostics, account repair jobs, data checks, and approval-gated support actions.</p>
    <p><strong>Why Dagu fits:</strong> non-engineers can run reviewed workflows from the Web UI while engineers keep commands, logs, and results traceable.</p>
  </div>
  <div class="real-world-usecase">
    <h3>IoT and Edge Workflows</h3>
    <p><strong>Run:</strong> sensor polling, local cleanup, offline sync, health checks, and device maintenance jobs.</p>
    <p><strong>Why Dagu fits:</strong> the single binary and local-first storage work well on small devices while still providing visibility through the Web UI.</p>
  </div>
  <div class="real-world-usecase">
    <h3>AI Agent Workflows</h3>
    <p><strong>Run:</strong> AI coding agents, agent CLIs, agent-authored YAML workflows, log analysis, repair steps, and human-reviewed automation.</p>
    <p><strong>Why Dagu fits:</strong> workflows are commands plus plain YAML, so agents can create and debug them while humans keep dependencies, logs, approvals, and run history in one place.</p>
  </div>
</div>

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
                    └────────▲────────────────┘
                             │
                   Worker poll / task response
                   Heartbeat / ReportStatus /
                   StreamLogs (gRPC)
                             │
               ┌─────────────┴─────────────┐
               │             │             │
          ┌────┴───┐    ┌────┴───┐    ┌────┴───┐
          │Worker 1│    │Worker 2│    │Worker N│
          └────────┘    └────────┘    └────────┘
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

```bash [npm]
npm install -g --ignore-scripts=false @dagucloud/dagu
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

The script installers run a guided wizard that installs Dagu, adds it to your PATH, sets up a background service, and creates the initial admin account. Homebrew, npm, Docker, and Helm install without the wizard. See the [Installation Guide](/getting-started/installation/) for all options.

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

## Built-in Step Types

Common built-in step types include:

| Step type | Purpose |
|----------|---------|
| `command`, `shell` | Local shell commands and scripts |
| `docker`, `container` | Run in a Docker container or exec into an existing container |
| `kubernetes`, `k8s` | Run a step as a Kubernetes workload |
| `ssh` | Remote command execution |
| `sftp` | Remote file transfer |
| `http` | HTTP requests |
| `postgres`, `sqlite` | SQL queries |
| `redis` | Redis commands and scripts |
| `s3` | S3 object operations |
| `jq` | JSON transformation |
| `mail` | Email delivery |
| `archive` | Archive create/extract |
| `dag` | Sub-DAG execution |
| `router` | Route execution to downstream steps by value |
| `template` | Template rendering |
| `chat` | LLM chat completion |
| `agent` | Tool-using agent step |

DAGs can also declare reusable `step_types` that expand to builtin step types at load time. See [Custom Step Types](/writing-workflows/custom-step-types) and [Step Types](/step-types/shell) for the exact configuration surface.

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
    retry_policy:
      limit: 3
      interval_sec: 10
      backoff: 2
      max_interval_sec: 120
    continue_on:
      failure: true
```

### Scheduling with Overlap Control

```yaml
schedule:
  - "0 */6 * * *"
overlap_policy: skip
timeout_sec: 3600
handler_on:
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
    with:
      host: prod-server.example.com
      user: deploy
      key: ~/.ssh/id_rsa
    command: cd /var/www && git pull && systemctl restart app
```

See [Examples](/writing-workflows/examples) for more patterns.

## Version-Controlled Workflows

Dagu supports Git sync to keep DAG definitions, agent markdown files, and managed documents version-controlled. Enable `DAGU_GITSYNC_ENABLED=true` with a repository URL, and Dagu pulls tracked files from a Git branch. Optional auto-sync polls the repository at a configurable interval (default 300s). Supports token and SSH authentication.

See [Git Sync](/server-admin/git-sync) for configuration.

GitHub Integration is separate from Git Sync. Use it when GitHub events, PR comments, releases, check reruns, `workflow_dispatch`, or `repository_dispatch` should trigger a DAG that runs on your licensed Dagu server. See [GitHub Integration](/github-integration/) for setup and examples.

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
    <p>All 18 executor types</p>
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
