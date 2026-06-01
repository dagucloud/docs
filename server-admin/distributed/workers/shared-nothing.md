# Shared Nothing Mode

In shared nothing mode, workers operate without any shared filesystem access. All status updates and logs are transmitted to the coordinator via gRPC. No shared storage is required, but status and logs depend on network connectivity to the coordinator.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Dagu Instance                           │
│  (Scheduler + Web UI + Coordinator)                         │
│                                                             │
│  Local Storage: dag-runs/  dag-state/  logs/                │
│                 (status)   (state)     (logs)               │
└─────────────────────────────────────────────────────────────┘
         ▲                              │
         │ ReportStatus + StreamLogs    │ Task Dispatch
         │ (gRPC)                       │ (gRPC)
         │                              ▼
┌────────┴───────────┐        ┌────────────────────┐
│     Worker 1       │        │     Worker N       │
│ (No shared disk)   │        │ (No shared disk)   │
└────────────────────┘        └────────────────────┘
```

## How It Works

### Static Discovery

Workers connect directly to coordinators using explicit addresses:

```bash
dagu worker --worker.coordinators=coordinator-1:50055,coordinator-2:50055
```

No service registry or shared storage is required.

For Kubernetes, private network, VPN, overlay network, and SSH forwarding examples, see [Distributed Networking](/server-admin/distributed/networking).

### Status Pushing

Workers send execution status to the coordinator via the `ReportStatus` gRPC call:

1. Worker executes a DAG step
2. Worker calls `ReportStatus` with full `DAGRunStatus`
3. Coordinator records the updated run state locally
4. The Web UI reads that coordinator-side state

### Log Streaming

Workers stream stdout/stderr to the coordinator via the `StreamLogs` gRPC call:

1. Worker buffers log output in 32KB chunks
2. Worker sends `LogChunk` messages with sequence numbers
3. Coordinator writes to local log files, flushing every 64KB
4. Worker sends final marker when execution completes

Log streaming is best-effort: failures don't fail the step execution. Some logs may be lost if network issues occur during streaming.

### Persistent State

Workers use coordinator RPCs for `state.*` actions, so they do not write persistent DAG state to worker-local disks. The coordinator stores state under `paths.dag_state_dir`, which defaults to `{data_dir}/dag-state`.

When multiple coordinators are configured, state requests are routed deterministically by state scope and namespace. This keeps all workers using the same coordinator for the same logical state keyspace. If coordinator pods or VMs can be replaced, back `paths.dag_state_dir` with persistent storage so the selected coordinator does not lose state on restart.

### Packaged Actions

Packaged actions are supported in shared-nothing mode. The worker executing the action step resolves the action reference, validates the `dagu-action.yaml` manifest, and packages the resolved action workspace. When the action sub-DAG is dispatched, the workspace bundle is transferred through the coordinator and materialized on the worker that runs the child DAG.

The workspace bundle contains the action DAG, manifest, scripts, and helper files. It does not contain external binaries from the caller's environment. If the action DAG needs portable CLIs, declare them with top-level `tools` in the action DAG file; the worker running the child action DAG prepares those tools in its own local cache.

Use pinned GitHub references for portable shared-nothing deployments:

```yaml
steps:
  - action: acme/dagu-action-notify@v1.2.0
    with:
      text: "shared-nothing worker run"
```

See [Third-Party Actions](/dagu-actions/third-party) for non-official package references and packaging rules.

### Zombie Detection

The coordinator monitors worker heartbeats and marks tasks as failed when workers become unresponsive:

| Parameter | Value |
|-----------|-------|
| Heartbeat interval | 1 second |
| Stale threshold | 30 seconds |
| Detector interval | 45 seconds |

When a worker stops sending heartbeats:

1. Coordinator detects stale heartbeat (> 30 seconds old)
2. Coordinator marks all running tasks from that worker as `FAILED`
3. Error message: `"worker {workerID} became unresponsive"`
4. All running nodes within the task are also marked as `FAILED`

## Configuration

### Coordinator

```bash
# Bind to all interfaces
dagu coordinator --coordinator.host=0.0.0.0 --coordinator.port=50055

# With advertise address for Kubernetes/Docker
dagu coordinator \
  --coordinator.host=0.0.0.0 \
  --coordinator.advertise=dagu-coordinator.default.svc.cluster.local \
  --coordinator.port=50055
```

### Workers

```bash
# Connect to specific coordinators (no service registry)
dagu worker \
  --worker.coordinators=coordinator-1:50055,coordinator-2:50055 \
  --worker.labels=gpu=true,region=us-east-1
```

### Configuration File

```yaml
# Coordinator config.yaml
coordinator:
  host: 0.0.0.0
  port: 50055
  advertise: dagu-coordinator.default.svc.cluster.local

paths:
  data_dir: "/var/lib/dagu/data"   # Local storage for status
  dag_state_dir: "/var/lib/dagu/data/dag-state" # Local persistent DAG state
  log_dir: "/var/lib/dagu/logs"    # Local storage for logs

---
# Worker config.yaml
worker:
  id: "worker-gpu-01"
  coordinators:
    - "coordinator-1:50055"
    - "coordinator-2:50055"
  labels:
    gpu: "true"
    region: "us-east-1"
  postgres_pool:
    max_open_conns: 25       # Total connections across ALL PostgreSQL DSNs
    max_idle_conns: 5        # Per-DSN idle connections
    conn_max_lifetime: 300   # Seconds
    conn_max_idle_time: 60    # Seconds
```

### Environment Variables

```bash
# Coordinator
export DAGU_DAG_STATE_DIR=/var/lib/dagu/data/dag-state

# Worker
export DAGU_WORKER_COORDINATORS="coordinator-1:50055,coordinator-2:50055"
export DAGU_WORKER_ID=worker-01
export DAGU_WORKER_LABELS="gpu=true,region=us-east-1"

# PostgreSQL connection pool (optional, defaults shown)
export DAGU_WORKER_POSTGRES_POOL_MAX_OPEN_CONNS=25
export DAGU_WORKER_POSTGRES_POOL_MAX_IDLE_CONNS=5
export DAGU_WORKER_POSTGRES_POOL_CONN_MAX_LIFETIME=300
export DAGU_WORKER_POSTGRES_POOL_CONN_MAX_IDLE_TIME=60
```

## PostgreSQL Connection Pool Management

In shared-nothing mode, multiple DAGs run concurrently within a single worker process. Without global connection pool management, each DAG's PostgreSQL steps could create unlimited connections, leading to connection exhaustion.

### How It Works

The global PostgreSQL connection pool:

1. **Limits total connections** across ALL databases and DAG executions
2. **Shares connections** between concurrent DAG runs
3. **Reuses connections** across sequential DAG executions
4. **Manages per-DSN pools** while enforcing a global limit

### Configuration

```yaml
worker:
  postgres_pool:
    max_open_conns: 25       # Hard limit across ALL PostgreSQL DSNs
    max_idle_conns: 5        # Per-DSN idle connection limit
    conn_max_lifetime: 300   # Max connection age (seconds)
    conn_max_idle_time: 60    # Max idle time before closure (seconds)
```

Size `max_open_conns` based on your PostgreSQL server's `max_connections`:

```
worker.postgres_pool.max_open_conns = PostgreSQL max_connections / number_of_workers / 2
```

Example: PostgreSQL with `max_connections: 100`, 4 workers → per-worker limit: `100 / 4 / 2 = 12` (leaving headroom).

Global pool management applies only to PostgreSQL. SQLite steps always use 1 connection per step. When running DAGs directly (not via workers), PostgreSQL steps use fixed defaults: 1 max connection, 1 idle connection.

## Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dagu-coordinator
spec:
  replicas: 1
  template:
    spec:
      containers:
        - name: dagu
          image: dagu:latest
          args:
            - "dagu"
            - "start-all"
            - "--host=0.0.0.0"
            - "--coordinator.host=0.0.0.0"
            - "--coordinator.advertise=dagu-coordinator.default.svc.cluster.local"
          ports:
            - containerPort: 8080
              name: http
            - containerPort: 50055
              name: grpc
          volumeMounts:
            - name: data
              mountPath: /var/lib/dagu
            - name: dags
              mountPath: /etc/dagu/dags
      volumes:
        - name: data
          emptyDir: {}  # Local ephemeral storage
        - name: dags
          configMap:
            name: dagu-dags
---
apiVersion: v1
kind: Service
metadata:
  name: dagu-coordinator
spec:
  ports:
    - port: 8080
      name: http
    - port: 50055
      name: grpc
  selector:
    app: dagu-coordinator
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dagu-worker
spec:
  replicas: 5
  template:
    spec:
      containers:
        - name: worker
          image: dagu:latest
          args:
            - "dagu"
            - "worker"
            - "--worker.coordinators=dagu-coordinator.default.svc.cluster.local:50055"
            - "--worker.labels=region=us-east-1"
          # No volume mounts needed - all state via gRPC
```

For Helm-based Kubernetes deployment, see [Kubernetes (Helm)](/server-admin/deployment/kubernetes).

## Multi-Cluster Deployment

Workers can connect to coordinators across different clusters or clouds:

```yaml
# Cluster A - Coordinator
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dagu-coordinator
spec:
  template:
    spec:
      containers:
        - name: dagu
          args:
            - "dagu"
            - "start-all"
            - "--coordinator.host=0.0.0.0"
            - "--coordinator.advertise=coordinator.cluster-a.example.com"

---
# Cluster B - Workers
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dagu-worker
spec:
  template:
    spec:
      containers:
        - name: worker
          args:
            - "dagu"
            - "worker"
            - "--worker.coordinators=coordinator.cluster-a.example.com:50055"
            - "--worker.labels=region=us-west-2,cluster=cluster-b"
```

## TLS Configuration

For TLS, mTLS, and certificate requirements for coordinator gRPC traffic, see [Distributed Transport Security](/server-admin/distributed/transport-security).

## Technical Details

### Log Streaming Protocol

| Parameter | Value |
|-----------|-------|
| Worker buffer size | 32KB |
| Coordinator flush threshold | 64KB |
| Stream type | Bidirectional gRPC stream |

Log chunks include:
- `dag_name`: Name of the DAG
- `dag_run_id`: Unique run identifier
- `step_name`: Name of the step producing logs
- `stream_type`: `STDOUT` or `STDERR`
- `sequence`: Ordering sequence number
- `data`: Log content bytes
- `final`: Marker for stream completion

### Status Pushing Protocol

Workers send `ReportStatusRequest` containing:
- Full `DAGRunStatus` protobuf message
- Status updates for all nodes
- Error messages and timestamps

The coordinator:
1. Finds the matching run attempt
2. Updates the coordinator-side run state
3. Returns acceptance confirmation

### Queue Dispatch with Previous Status

When the scheduler dispatches queued DAGs to workers:

1. Scheduler reads the current recorded run status
2. Status is included in the task as `previous_status` field
3. Worker receives status with the task (no local store access needed)
4. Worker uses `previous_status` for retry operations

### Temporary File Cleanup

Workers automatically clean up temporary files after each execution:

| File Type | Location | Cleaned After |
|-----------|----------|---------------|
| DAG files | `/tmp/dagu/worker-dags/` | Each execution |
| Log directories | `/tmp/dagu/worker-logs/` | Each execution |

Workers are safe to run on ephemeral nodes without risk of disk accumulation.
