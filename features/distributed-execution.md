# Distributed Execution

Run workflow tasks across multiple worker nodes.

## Architecture

```
Main Instance (Scheduler + UI + Coordinator)
         │                    │
         │ Service Registry   │ gRPC + Heartbeat
         │ (File-based)       │ (includes DAG definitions)
         │                    │
    ┌────┴──────────┬─────────┴─────────────┐
    │               │                       │
Worker 1        Worker 2                Worker 3
(gpu=true)   (region=eu-west)        (cpu-optimized)
    │               │                       │
    └───────────────┴───────────────────────┘
                    │
            Shared Storage
          (logs, execution state)

```

### Storage Modes

Dagu supports two deployment modes for distributed workers:

| Mode | Description |
|------|-------------|
| [Shared Filesystem](./workers/shared-filesystem) | Workers share storage with coordinator via NFS/shared volumes |
| [Shared Nothing](./workers/shared-nothing) | Workers communicate status and logs via gRPC (no shared storage) |

See [Workers](./workers/) for configuration reference and deployment details.

DAG definitions do not need to be shared in either mode — they are transmitted to workers via gRPC when tasks are dispatched.

## How Dispatch Decisions Work

Every execution path in Dagu — API, CLI, scheduler, queue, and sub-DAG steps — uses a single function (`ShouldDispatchToCoordinator`) to decide whether a DAG runs locally or is dispatched to a worker. This guarantees consistent behavior regardless of how a run is triggered.

### Decision Priority

The dispatch decision evaluates these rules in order, stopping at the first match:

| Priority | Condition | Result |
|----------|-----------|--------|
| 1 | `worker_selector: local` is set | **Local** — always runs on the main instance |
| 2 | No coordinator is configured | **Local** — distributed execution is unavailable |
| 3 | `worker_selector` has labels (e.g., `gpu: "true"`) | **Dispatch** — sent to a matching worker |
| 4 | `defaultExecutionMode: distributed` is set | **Dispatch** — sent to any available worker |
| 5 | None of the above | **Local** — runs on the main instance |

### Execution Paths

All of the following entry points evaluate the same decision logic:

| Trigger | Description |
|---------|-------------|
| API start | Immediate execution from the UI or API |
| API retry | Retrying a failed run from the UI or API |
| CLI `dagu start` | Running a DAG from the command line |
| Scheduler | Cron-triggered scheduled runs |
| Queue consumer | Dequeuing a previously enqueued run |
| Sub-DAG step | A `call` step executing a child DAG |

### Queue Behavior

When a DAG run is enqueued (via API, webhook, or scheduler), it always enters the local queue first with status `queued`. The queue processor dequeues items respecting `maxConcurrency`, and only at dequeue time does it evaluate the dispatch decision. This means distributed runs are still subject to queue concurrency limits — the queue acts as a gate before dispatch, not after.

### Sub-DAG Dispatch

Each sub-DAG independently evaluates the dispatch decision. A DAG running locally can dispatch a child to a worker (if the child has `worker_selector` labels), and a DAG running on a worker can force a child to run locally (if the child has `worker_selector: local`). Parent and child dispatch decisions are completely independent.

## Setting Up Distributed Execution

### Step 1: Start the Coordinator

The coordinator service can be started with `dagu start-all` (requires `--coordinator.host` set to a non-localhost address):

```bash
# Start all services including coordinator (distributed mode)
dagu start-all --coordinator.host=0.0.0.0 --port=8080

# Single instance mode (coordinator disabled, default)
dagu start-all

# Or start coordinator separately
dagu coordinator --coordinator.host=0.0.0.0 --coordinator.port=50055
```

The coordinator is only started by `start-all` when `--coordinator.host` is set to a non-localhost address (not `127.0.0.1` or `localhost`). This allows running in single instance mode by default.

For containerized environments (Docker, Kubernetes), configure both the bind address and advertise address:

```bash
# Bind to all interfaces and advertise the service name
dagu coordinator \
  --coordinator.host=0.0.0.0 \
  --coordinator.advertise=dagu-server \
  --coordinator.port=50055
```

- `--coordinator.host`: Address to bind the gRPC server (use `0.0.0.0` for containers)
- `--coordinator.advertise`: Address workers use to connect (defaults to hostname if not set)

### Step 2: Deploy Workers

Start workers on your compute nodes with appropriate labels:

```bash
# GPU-enabled worker
dagu worker \
  --worker.labels gpu=true,cuda=11.8,memory=64G

# CPU-optimized worker
dagu worker \
  --worker.labels cpu-arch=amd64,cpu-cores=32,region=us-east-1
```

### Step 3: Route Tasks to Workers

Use `worker_selector` in your DAG definitions to route tasks:

```yaml
worker_selector:
  gpu: "true"

steps:
  - command: python train_model.py
```

Or at the step level for sub-DAG steps:

```yaml
steps:
  - call: train-model
    worker_selector:
      gpu: "true"
```

See [Worker Labels](./worker-labels) for full details on label matching and step-level `worker_selector`.

## Default Execution Mode

By default, DAGs without a `worker_selector` run locally on the main instance. You can change this behavior with the `defaultExecutionMode` server setting so that all DAGs are dispatched to workers automatically.

```yaml
# config.yaml
defaultExecutionMode: distributed  # "local" (default) or "distributed"
```

Or via environment variable:

```bash
export DAGU_DEFAULT_EXECUTION_MODE=distributed
```

When set to `distributed`, every DAG is dispatched to a worker through the coordinator — even if it has no `worker_selector`. DAGs with a `worker_selector` are always dispatched to a matching worker regardless of this setting.

### Force Local Execution

If `defaultExecutionMode` is `distributed` but you need a specific DAG to always run locally (e.g., a lightweight health-check), use `worker_selector: local`:

```yaml
# This DAG always runs locally, even when defaultExecutionMode is "distributed"
worker_selector: local

steps:
  - command: curl -f http://localhost:8080/health
```

Setting `worker_selector` to the string `"local"` overrides both the server default and any label-based routing, forcing the DAG to execute on the main instance.

See [How Dispatch Decisions Work](#how-dispatch-decisions-work) for the complete priority order.
