# Shared Filesystem Mode

In shared filesystem mode, workers share storage access with the coordinator. All nodes must have access to the same filesystem (NFS, EFS, Azure Files, etc.). For environments without shared storage, see [Shared Nothing Mode](./shared-nothing).

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Dagu Instance                           │
│  (Scheduler + Web UI + Coordinator)                         │
└─────────────────────────────────────────────────────────────┘
         │                              │
         │ File-based Service Registry  │ gRPC Task Dispatch
         │                              │
         ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Shared Storage                           │
│  ┌───────────────┬─────────────────┬─────────────────────┐  │
│  │ service-      │   dag-runs/     │      logs/          │  │
│  │ registry/     │   (status)      │   (execution logs)  │  │
│  └───────────────┴─────────────────┴─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         ▲                              ▲
         │                              │
         │  Direct File Access          │
         │                              │
┌────────┴───────────┐        ┌────────┴───────────┐
│     Worker 1       │        │     Worker N       │
└────────────────────┘        └────────────────────┘
```

## How It Works

### Service Registry

Workers automatically register themselves in a file-based service registry. Workers discover coordinators by scanning the registry directory — no manual coordinator address configuration is required.

#### Registry Directory Structure

```
{data}/service-registry/
├── coordinator/
│   └── coordinator-primary-host1-50055.json
└── worker/
    ├── worker-gpu-01-host2-1234.json
    └── worker-cpu-02-host3-5678.json
```

#### Registration Process

1. **Worker starts**: creates a registry file containing its ID, host, port, PID, and timestamp.
2. **Heartbeat updates**: workers update their registry files every 10 seconds with the current timestamp, health status, and active task count.
3. **Coordinator monitoring**: the coordinator continuously scans registry files to track available workers, detect unhealthy workers, and remove stale entries (no heartbeat for 30+ seconds).
4. **Cleanup**: registry files are removed when a worker shuts down gracefully or when the heartbeat timeout is exceeded.

#### Configuring the Registry Directory

The registry directory must be accessible by all nodes:

```yaml
# config.yaml
paths:
  service_registry_dir: "/nfs/shared/dagu/service-registry"
```

```bash
export DAGU_PATHS_SERVICE_REGISTRY_DIR=/nfs/shared/dagu/service-registry
```

### Status Persistence

Workers write execution status directly to the shared filesystem:

```
{data}/dag-runs/
└── my-workflow/
    └── dag-runs/
        └── 2024/03/15/
            └── dag-run_20240315_120000Z_abc123/
                └── attempt_20240315_120001_123Z_def456/
                    └── status.jsonl
```

### Log Storage

Workers write execution logs directly to the shared log directory:

```
{logs}/dags/
└── my-workflow/
    └── 20240315_120000_abc123/
        ├── step1.stdout.log
        ├── step1.stderr.log
        └── status.yaml
```

## Requirements

Shared storage must be mounted at the same path on all nodes, or configured via `DAGU_HOME` to point to the shared location.

Required shared directories:
- `{data}/service-registry/` — worker registration and discovery
- `{data}/dag-runs/` — execution status
- `{logs}/` — execution logs (required for Web UI log display)

> [!NOTE]
> DAG definitions (`dags/`) do **not** need to be shared. Workers receive DAG definitions via gRPC when tasks are dispatched.

## Configuration

### Coordinator

```bash
# Start coordinator on the main server
dagu start-all --coordinator.host=0.0.0.0 --port=8080

# Or start coordinator separately
dagu coordinator --coordinator.host=0.0.0.0 --coordinator.port=50055
```

### Workers

```bash
# Workers auto-discover coordinators via service registry
dagu worker --worker.labels gpu=true,memory=64G
```

### Configuration File

```yaml
# config.yaml (same on all nodes)
paths:
  data_dir: "/shared/dagu/data"        # Must be shared
  log_dir: "/shared/dagu/logs"         # Must be shared
  service_registry_dir: "/shared/dagu/service-registry"  # Must be shared

worker:
  id: "worker-gpu-01"
  labels:
    gpu: "true"
    memory: "64G"

coordinator:
  host: 0.0.0.0
  port: 50055
```

## Docker Compose Example

```yaml
version: '3.8'

services:
  dagu-main:
    image: dagu:latest
    command: start-all --host=0.0.0.0 --coordinator.host=0.0.0.0
    ports:
      - "8080:8080"
      - "50055:50055"
    volumes:
      - ./dags:/etc/dagu/dags           # DAG definitions (only main instance)
      - shared-data:/var/lib/dagu       # Shared: data + logs + service registry

  worker-gpu:
    image: dagu:latest
    command: worker --worker.labels=gpu=true,cuda=11.8
    volumes:
      - shared-data:/var/lib/dagu       # Shared storage (no dags needed)
    deploy:
      replicas: 2
      resources:
        reservations:
          devices:
            - capabilities: [gpu]

  worker-cpu:
    image: dagu:latest
    command: worker --worker.labels=cpu-only=true
    volumes:
      - shared-data:/var/lib/dagu       # Shared storage (no dags needed)
    deploy:
      replicas: 5

volumes:
  shared-data:
    driver: local
```

## Kubernetes with NFS

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: dagu-shared
spec:
  accessModes:
    - ReadWriteMany
  storageClassName: nfs
  resources:
    requests:
      storage: 10Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dagu-main
spec:
  replicas: 1
  template:
    spec:
      containers:
        - name: dagu
          image: dagu:latest
          args: ["start-all", "--host=0.0.0.0", "--coordinator.host=0.0.0.0"]
          volumeMounts:
            - name: shared
              mountPath: /var/lib/dagu
            - name: dags
              mountPath: /etc/dagu/dags
      volumes:
        - name: shared
          persistentVolumeClaim:
            claimName: dagu-shared
        - name: dags
          configMap:
            name: dagu-dags
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dagu-worker
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: worker
          image: dagu:latest
          args: ["worker", "--worker.labels=region=us-east-1"]
          volumeMounts:
            - name: shared
              mountPath: /var/lib/dagu
      volumes:
        - name: shared
          persistentVolumeClaim:
            claimName: dagu-shared
```

For Helm-based Kubernetes deployment, see [Kubernetes (Helm)](/configurations/deployment/kubernetes).
