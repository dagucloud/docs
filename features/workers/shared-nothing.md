# Shared Nothing Mode

In shared nothing mode, workers operate without any shared filesystem access. All status updates and logs are transmitted to the coordinator via gRPC.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Dagu Instance                           │
│  (Scheduler + Web UI + Coordinator)                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Local Storage                          │    │
│  │  ┌───────────────┬─────────────────┬────────────┐   │    │
│  │  │  dag-runs/    │     logs/       │   dags/    │   │    │
│  │  │  (status)     │ (execution logs)│            │   │    │
│  │  └───────────────┴─────────────────┴────────────┘   │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
         ▲                              │
         │ ReportStatus + StreamLogs    │ Task Dispatch
         │ (gRPC)                       │ (gRPC)
         │                              ▼
┌────────┴───────────┐        ┌────────────────────┐
│     Worker 1       │        │     Worker N       │
│  (No local state)  │        │  (No local state)  │
└────────────────────┘        └────────────────────┘
```

## How It Works

### Static Discovery

Workers connect directly to coordinators using explicit addresses:

```bash
dagu worker --worker.coordinators=coordinator-1:50055,coordinator-2:50055
```

No service registry or shared storage is required.

### Status Pushing

Workers send execution status to the coordinator via the `ReportStatus` gRPC call:

1. Worker executes a DAG step
2. Worker calls `ReportStatus` with full `DAGRunStatus`
3. Coordinator persists status to its local `DAGRunStore`
4. Web UI reads status from coordinator's local storage

### Log Streaming

Workers stream stdout/stderr to the coordinator via the `StreamLogs` gRPC call:

1. Worker buffers log output in 32KB chunks
2. Worker sends `LogChunk` messages with sequence numbers
3. Coordinator writes to local log files, flushing every 64KB
4. Worker sends final marker when execution completes

Log streaming supports:
- Separate stdout and stderr streams
- Sequence numbers for ordering
- Automatic reconnection on network failures

### Zombie Detection

The coordinator monitors worker heartbeats and automatically marks tasks as failed when workers become unresponsive:

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
  dataDir: "/var/lib/dagu/data"   # Local storage for status
  logDir: "/var/lib/dagu/logs"    # Local storage for logs

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
```

### Environment Variables

```bash
# Worker
export DAGU_WORKER_COORDINATORS="coordinator-1:50055,coordinator-2:50055"
export DAGU_WORKER_ID=worker-01
export DAGU_WORKER_LABELS="gpu=true,region=us-east-1"
```

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
            - "worker"
            - "--worker.coordinators=dagu-coordinator.default.svc.cluster.local:50055"
            - "--worker.labels=region=us-east-1"
          # No volume mounts needed - all state via gRPC
```

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
            - "worker"
            - "--worker.coordinators=coordinator.cluster-a.example.com:50055"
            - "--worker.labels=region=us-west-2,cluster=cluster-b"
```

## TLS Configuration

For production deployments, enable TLS for gRPC communication:

```bash
# Coordinator with TLS
dagu coordinator \
  --coordinator.host=0.0.0.0 \
  --peer.insecure=false \
  --peer.cert-file=/certs/server.crt \
  --peer.key-file=/certs/server.key

# Worker with TLS
dagu worker \
  --worker.coordinators=coordinator:50055 \
  --peer.insecure=false \
  --peer.cert-file=/certs/client.crt \
  --peer.key-file=/certs/client.key \
  --peer.client-ca-file=/certs/ca.crt
```

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
1. Finds or opens the DAGRunAttempt for the run
2. Writes status to the local `DAGRunStore`
3. Returns acceptance confirmation

### Queue Dispatch with Previous Status

When the scheduler dispatches queued DAGs to workers:

1. Scheduler reads the current status from `DAGRunStore`
2. Status is included in the task as `previous_status` field
3. Worker receives status with the task (no local store access needed)
4. Worker uses `previous_status` for retry operations

This enables workers to perform retries without requiring:
- Access to shared filesystem
- Local `DAGRunStore` instance
- Previous execution history on the worker

### Temporary File Cleanup

Workers automatically clean up temporary files after each execution:

| File Type | Location | Cleaned After |
|-----------|----------|---------------|
| DAG files | `/tmp/dagu/worker-dags/` | Each execution |
| Log directories | `/tmp/dagu/worker-logs/` | Each execution |

Workers are safe to run on ephemeral nodes without risk of disk accumulation.

## Advantages

- **No shared storage**: Works in any environment
- **Multi-cloud ready**: Workers can run anywhere with network access
- **Simple infrastructure**: No NFS, EFS, or shared volumes needed
- **Fault isolation**: Worker failures don't affect storage

## Limitations

### Network Dependency
- Status updates and logs require network connectivity to the coordinator
- If the coordinator is unreachable, status updates are lost (not queued)
- Log streaming failures are non-fatal: steps succeed even if logs cannot be streamed

### Cancellation Latency
- Cancellation signals are delivered via heartbeat responses
- Worst-case latency: 1 second (worker heartbeat interval)
- Workers check for cancelled runs in each heartbeat response from coordinator

### Log Streaming Behavior
- Log streaming is **best-effort**: failures don't fail the step execution
- Some logs may be lost if network issues occur during streaming
- From `output.go`: *"Log streaming failures are non-fatal - they shouldn't fail an otherwise successful step execution. Lost logs are unfortunate but acceptable."*

### Coordinator Availability
- Single point for status persistence
- If coordinator is down, workers continue executing but cannot report status
- Zombie detection requires coordinator to be running

## When to Use

Use shared nothing mode when:

- Kubernetes without `ReadWriteMany` storage
- Multi-cloud or multi-cluster deployments
- Containerized workloads in dynamic environments
- Infrastructure without shared filesystem capability
- Workers need to run on ephemeral nodes
