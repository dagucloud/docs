# Workers

Distributed workers execute DAG tasks across multiple machines, enabling horizontal scaling and specialized hardware utilization.

## Architecture

Workers connect to a coordinator service and poll for tasks via gRPC long-polling. The coordinator distributes tasks based on worker labels and availability.

```
┌─────────────────────────────────────────────────────────────┐
│                     Dagu Instance                           │
├──────────────┬────────────────┬─────────────────────────────┤
│  Scheduler   │   Web UI       │      Coordinator Service    │
│              │                │         (gRPC Server)       │
└──────────────┴────────────────┴─────────────────────────────┘
                                              │
                                              │ gRPC (Long Polling)
                                              │
                ┌─────────────────────────────┴────────────────┐
                │                                              │
         ┌──────▼───────┐                            ┌────────▼──────┐
         │   Worker 1   │                            │   Worker N    │
         │              │                            │               │
         │ Labels:      │                            │ Labels:       │
         │ - gpu=true   │                            │ - region=eu   │
         │ - memory=64G │                            │ - cpu=high    │
         └──────────────┘                            └───────────────┘
```

## How Workers Operate

1. **Polling**: Each worker runs multiple concurrent pollers (configurable via `maxActiveRuns`, default: 100)
2. **Task Assignment**: Coordinator matches tasks to workers based on `workerSelector` labels
3. **Heartbeat**: Workers send heartbeats every 1 second to report health status
4. **Execution**: Workers execute assigned DAGs using the same execution engine as the main instance

## Worker Identification

Workers are identified by a unique ID that defaults to `hostname@PID`. This can be customized:

```bash
dagu worker --worker.id=gpu-worker-01
```

## Health Monitoring

The coordinator tracks worker health based on heartbeat recency:

| Status | Condition |
|--------|-----------|
| Healthy | Last heartbeat < 5 seconds ago |
| Warning | Last heartbeat 5-15 seconds ago |
| Unhealthy | Last heartbeat > 15 seconds ago |
| Offline | No heartbeat for > 30 seconds |

## Deployment Modes

Workers support two deployment modes based on your infrastructure:

| Feature | Shared Filesystem | Shared Nothing |
|---------|-------------------|----------------|
| **Storage Requirement** | NFS/shared volume | None |
| **Service Discovery** | File-based registry | Static coordinator list |
| **Status Persistence** | Direct file writes | gRPC `ReportStatus` |
| **Log Storage** | Direct file writes | gRPC `StreamLogs` |
| **Zombie Detection** | File-based heartbeats | Coordinator-based |
| **Use Cases** | Docker Compose, single-cluster | Kubernetes, multi-cloud |

### [Shared Filesystem Mode](./shared-filesystem)

Traditional deployment where workers share filesystem access with the coordinator. Workers write status and logs directly to shared storage.

**Best for**: Docker Compose deployments, single Kubernetes clusters with shared volumes (NFS, EFS, Azure Files).

### [Shared Nothing Mode](./shared-nothing)

Workers operate without any shared storage. All communication happens via gRPC to the coordinator.

**Best for**: Kubernetes deployments across multiple clusters, multi-cloud environments, containerized workloads without shared volumes.

## Configuration Reference

### Worker Configuration

```yaml
# config.yaml
worker:
  id: "worker-gpu-01"        # Defaults to hostname@PID
  maxActiveRuns: 100         # Number of concurrent pollers
  labels:
    gpu: "true"
    memory: "64G"
```

### PostgreSQL Connection Pool

In shared-nothing mode (when `worker.coordinators` is configured), workers use a global PostgreSQL connection pool to prevent connection exhaustion when running multiple concurrent DAGs.

```yaml
# config.yaml
worker:
  id: "worker-gpu-01"
  maxActiveRuns: 100
  postgresPool:
    maxOpenConns: 25       # Total connections across ALL PostgreSQL DSNs
    maxIdleConns: 5        # Idle connections per DSN
    connMaxLifetime: 300   # Connection lifetime in seconds
    connMaxIdleTime: 60    # Idle connection timeout in seconds
```

**Key Points:**
- **Applies only in shared-nothing mode** (when `worker.coordinators` is configured)
- **Prevents connection exhaustion** when multiple DAGs run concurrently in a single worker
- **Shared across all PostgreSQL databases** accessed by the worker
- **Does not apply to SQLite** - SQLite always uses 1 connection per step

See [Shared Nothing Mode - PostgreSQL Connection Pool Management](/features/workers/shared-nothing#postgresql-connection-pool-management) for detailed configuration guidance.

### Environment Variables

```bash
export DAGU_WORKER_ID=worker-01
export DAGU_WORKER_LABELS="gpu=true,region=us-east-1"
export DAGU_WORKER_MAX_ACTIVE_RUNS=50

# PostgreSQL connection pool (shared-nothing mode only)
export DAGU_WORKER_POSTGRES_POOL_MAX_OPEN_CONNS=25
export DAGU_WORKER_POSTGRES_POOL_MAX_IDLE_CONNS=5
export DAGU_WORKER_POSTGRES_POOL_CONN_MAX_LIFETIME=300
export DAGU_WORKER_POSTGRES_POOL_CONN_MAX_IDLE_TIME=60
```

## Technical Details

| Parameter | Value | Description |
|-----------|-------|-------------|
| Heartbeat interval | 1 second | How often workers report health |
| Heartbeat backoff | 1s base, 1.5x factor, 15s max | Backoff on heartbeat failures |
| Poll backoff | 1s base, 2.0x factor, 1 minute max | Backoff on poll failures |
| Stale threshold | 30 seconds | When workers are considered offline |
| Default port | 50055 | Coordinator gRPC port |
