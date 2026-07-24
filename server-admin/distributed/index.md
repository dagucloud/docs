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

In shared-nothing mode, workers stream step and scheduler logs to the coordinator while a run is active, so they can be viewed before the run finishes. Small bursts are briefly batched to reduce gRPC traffic, and any remaining output is sent when execution completes.

## How Dispatch Decisions Work

Every server-side execution path in Dagu — API, scheduler, queue, and sub-DAG steps — uses a single function (`ShouldDispatchToCoordinator`) to decide whether a DAG runs locally or is dispatched to a worker. This guarantees consistent behavior for runs handled by the server and queue processor.

### Decision Priority

The dispatch decision evaluates these rules in order, stopping at the first match:

| Priority | Condition | Result |
|----------|-----------|--------|
| 1 | `worker_selector: local` is set | **Local** — always runs on the main instance |
| 2 | No coordinator is configured | **Local** — distributed execution is unavailable |
| 3 | `worker_selector` has labels (e.g., `gpu: "true"`) | **Dispatch** — sent to a matching worker |
| 4 | `default_execution_mode: distributed` is set | **Dispatch** — sent to any available worker |
| 5 | None of the above | **Local** — runs on the main instance |

### Execution Paths

All of the following entry points evaluate the same decision logic:

| Trigger | Description |
|---------|-------------|
| API start | Immediate execution from the UI or API |
| API retry | Retrying a failed run from the UI or API |
| CLI `dagu enqueue` | Queueing a DAG-run from the command line for the queue processor to dispatch |
| Scheduler | Cron-triggered scheduled runs |
| Queue consumer | Dequeuing a previously enqueued run |
| Sub-DAG step | A `call` step executing a child DAG |

### Queue Behavior

When a DAG run is enqueued (via API, webhook, or scheduler), it always enters the local queue first with status `queued`. The queue processor dequeues items respecting `max_concurrency`, and only at dequeue time does it evaluate the dispatch decision. This means distributed runs are still subject to queue concurrency limits — the queue acts as a gate before dispatch, not after.

### Sub-DAG Dispatch

Each sub-DAG independently evaluates the dispatch decision. A DAG running locally can dispatch a child to a worker (if the child has `worker_selector` labels), and a DAG running on a worker can force a child to run locally (if the child has `worker_selector: local`). Parent and child dispatch decisions are completely independent, whether the child is started synchronously with `action: dag.run` or queued asynchronously with `action: dag.enqueue`.

## Transport Security

The default peer transport is convenient for local evaluation, but it is not the right choice for untrusted networks.

- If coordinator and workers communicate only on a single private host or an isolated development network, the default peer transport may be acceptable.
- If coordinator and workers communicate across machines, clusters, VPN boundaries, or any network segment you do not fully trust, configure peer TLS or mTLS.
- Treat worker connectivity as a control plane. Anyone who can intercept or impersonate that channel can affect workflow execution.

For Kubernetes, private network, VPN, overlay network, and SSH forwarding examples, see [Distributed Networking](/server-admin/distributed/networking).
For peer certificates and mTLS setup, see [Distributed Transport Security](/server-admin/distributed/transport-security).

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
  --coordinator.port=50055 \
  --coordinator.health-port=8091
```

- `--coordinator.host`: Address to bind the gRPC server (use `0.0.0.0` for containers)
- `--coordinator.advertise`: Address workers use to connect (defaults to hostname if not set)
- `--coordinator.health-port`: Dedicated HTTP `/health` port for per-instance liveness checks (`0` disables)

If you need an independent coordinator health probe, run `dagu coordinator` as a separate service. `dagu start-all` keeps using the main web/API process health endpoint and does not expose the dedicated coordinator HTTP health server.

### Step 2: Deploy Workers

Start workers on your compute nodes with appropriate labels:

```bash
# GPU-enabled worker
dagu worker \
  --worker.labels gpu=true,cuda=11.8,memory=64G \
  --worker.health-port=8092

# CPU-optimized worker
dagu worker \
  --worker.labels cpu-arch=amd64,cpu-cores=32,region=us-east-1 \
  --worker.health-port=8092
```

Each worker exposes `GET /health` on its configured `worker.health_port`, which is intended for container-orchestrator liveness and readiness probes for that specific worker process.

### Step 3: Route Tasks to Workers

Use `worker_selector` in your DAG definitions to route tasks:

```yaml
worker_selector:
  gpu: "true"

tools:
  - astral-sh/uv@0.11.14

steps:
  - run: uv run --python 3.13.9 python train_model.py
```

Or at the step level for sub-DAG steps:

```yaml
steps:
  - action: dag.run
    with:
      dag: train-model
    worker_selector:
      gpu: "true"
```

See [Worker Labels](./worker-labels) for full details on label matching and step-level `worker_selector`.

## Default Execution Mode

By default, DAGs without a `worker_selector` run locally on the main instance. You can change this behavior with the `default_execution_mode` server setting so that all DAGs are dispatched to workers automatically.

```yaml
# config.yaml
default_execution_mode: distributed  # "local" (default) or "distributed"
```

Or via environment variable:

```bash
export DAGU_DEFAULT_EXECUTION_MODE=distributed
```

When set to `distributed`, every DAG is dispatched to a worker through the coordinator — even if it has no `worker_selector`. DAGs with a `worker_selector` are always dispatched to a matching worker regardless of this setting.

### Human Tasks on Distributed Workers

Root DAGs containing [`action: human.task`](/writing-workflows/human-tasks) use normal dispatch rules. They may select a worker with a label-based DAG-level `worker_selector`, follow `default_execution_mode: distributed`, or remain local.

When a worker reaches a human task, it persists the final `waiting` state and releases the run. The Web UI, REST API, or local CLI can store the form input in the root run. Once no manual steps remain waiting, Dagu enqueues the same run through the scheduler. This is the same queue-based resume path used for local runs; completion never starts a run directly. The scheduler must remain available. Human tasks are prohibited in sub-DAGs.

### Force Local Execution

If `default_execution_mode` is `distributed` but you need a specific DAG to always run locally (e.g., a lightweight health-check), use `worker_selector: local`:

```yaml
# This DAG always runs locally, even when default_execution_mode is "distributed"
worker_selector: local

steps:
  - run: curl -f http://localhost:8080/health
```

Setting `worker_selector` to the string `"local"` overrides both the server default and any label-based routing, forcing the DAG to execute on the main instance.

See [How Dispatch Decisions Work](#how-dispatch-decisions-work) for the complete priority order.
