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

1. **Polling**: Each worker runs multiple concurrent pollers (configurable via `max_active_runs`, default: 100)
2. **Task Assignment**: Coordinator matches tasks to workers based on `worker_selector` labels
3. **Heartbeat**: Workers send heartbeats every 1 second to report health status
4. **Execution**: Workers execute assigned DAGs using the same execution engine as the main instance

## Worker Identification

Workers are identified by a unique ID that defaults to `hostname@PID`. This can be customized:

```bash
dagu worker --worker.id=gpu-worker-01
```

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

Workers share filesystem access with the coordinator. Workers write status and logs directly to shared storage.

### [Shared Nothing Mode](./shared-nothing)

Workers operate without any shared storage. All communication happens via gRPC to the coordinator.

## Monitoring

### Web UI Workers Page

The Workers page in the Web UI shows:
- Connected workers and their labels
- Worker health status
- Currently running tasks on each worker
- Task hierarchy (root/parent/sub DAGs)

### Health Status

The coordinator tracks worker health based on heartbeat recency:

| Status | Condition |
|--------|-----------|
| Healthy | Last heartbeat < 5 seconds ago |
| Warning | Last heartbeat 5-15 seconds ago |
| Unhealthy | Last heartbeat > 15 seconds ago |
| Offline | No heartbeat for > 30 seconds |

When a worker's heartbeat becomes stale (>30 seconds), the coordinator's zombie detector marks all running tasks from that worker as failed.

### API Endpoint

```bash
# Get worker status via API
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/v1/workers
```

Response:

```json
{
  "workers": [
    {
      "id": "worker-gpu-01",
      "labels": {"gpu": "true", "memory": "64G"},
      "health_status": "HEALTHY",
      "last_heartbeat": "2024-02-11T12:00:00Z",
      "running_tasks": [
        {
          "dag_name": "ml-pipeline",
          "dag_run_id": "20240211_120000",
          "root_dag_run_name": "ml-pipeline",
          "started_at": "2024-02-11T12:00:00Z"
        }
      ]
    }
  ]
}
```

## Configuration Reference

### Worker Configuration

```yaml
# config.yaml
worker:
  id: "worker-gpu-01"        # Defaults to hostname@PID
  max_active_runs: 100         # Number of concurrent pollers
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
  max_active_runs: 100
  postgres_pool:
    max_open_conns: 25       # Total connections across ALL PostgreSQL DSNs
    max_idle_conns: 5        # Idle connections per DSN
    conn_max_lifetime: 300   # Connection lifetime in seconds
    conn_max_idle_time: 60    # Idle connection timeout in seconds
```

This applies only in shared-nothing mode and only to PostgreSQL. SQLite always uses 1 connection per step.

See [Shared Nothing Mode — PostgreSQL Connection Pool Management](/features/workers/shared-nothing#postgresql-connection-pool-management) for detailed configuration guidance.

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
