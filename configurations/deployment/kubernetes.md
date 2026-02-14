# Kubernetes (Helm)

Deploy Dagu to Kubernetes using the official Helm chart. The chart deploys a scheduler, coordinator, Web UI, and configurable worker pools.

## Installation

```bash
helm repo add dagu https://dagu-org.github.io/dagu
helm install dagu dagu/dagu
```

## Worker Pools

The `workerPools` section in `values.yaml` defines groups of worker Deployments. Each pool creates a separate Kubernetes Deployment named `<release>-dagu-worker-<poolName>`.

### Default Configuration

```yaml
workerPools:
  general:
    replicas: 2
    labels: {}
    resources:
      requests:
        memory: "128Mi"
        cpu: "100m"
      limits:
        memory: "256Mi"
        cpu: "200m"
    nodeSelector: {}
    tolerations: []
    affinity: {}
```

The default `general` pool has `labels: {}`, which means it matches DAGs without a `worker_selector` (an empty selector matches any worker). See [Worker Labels](/features/worker-labels#matching-algorithm) for how matching works.

### Multi-Pool Example

```yaml
workerPools:
  general:
    replicas: 3
    labels: {}
    resources:
      requests:
        memory: "256Mi"
        cpu: "250m"
      limits:
        memory: "512Mi"
        cpu: "500m"

  gpu:
    replicas: 2
    labels:
      gpu: "true"
      cuda: "12.0"
    resources:
      requests:
        memory: "1Gi"
        cpu: "500m"
        nvidia.com/gpu: "1"
      limits:
        memory: "4Gi"
        cpu: "2"
        nvidia.com/gpu: "1"
    nodeSelector:
      nvidia.com/gpu.present: "true"
    tolerations:
      - key: nvidia.com/gpu
        operator: Exists
        effect: NoSchedule
```

This creates two Deployments:
- `<release>-dagu-worker-general` — 3 replicas, no labels, matches any DAG without `worker_selector`
- `<release>-dagu-worker-gpu` — 2 replicas, labels `gpu=true,cuda=12.0`, scheduled on GPU nodes

DAGs with `worker_selector: {gpu: "true"}` are dispatched to the `gpu` pool. DAGs without `worker_selector` are dispatched to any pool (including `general`).

### How Pool Labels Map to Worker Labels

Each pool's `labels` map is converted to a `--worker.labels` CLI argument via the `dagu.workerLabels` template helper. For example:

```yaml
labels:
  gpu: "true"
  cuda: "12.0"
```

becomes the CLI argument `--worker.labels gpu=true,cuda=12.0`, which is equivalent to running:

```bash
dagu worker --worker.labels gpu=true,cuda=12.0
```

These labels are then matched against `worker_selector` in DAG definitions. See [Distributed Execution — How Dispatch Decisions Work](/features/distributed-execution#how-dispatch-decisions-work) for the full dispatch logic.

### Pool Name Validation

Pool names must match `^[a-z][a-z0-9-]*$` — lowercase letters, digits, and hyphens, starting with a letter. Invalid names cause a Helm template error.

Valid: `general`, `gpu-workers`, `us-east-1`
Invalid: `GPU`, `1-workers`, `my_pool`

### Per-Pool Kubernetes Scheduling

Each pool supports standard Kubernetes scheduling fields:

```yaml
workerPools:
  gpu:
    replicas: 2
    labels:
      gpu: "true"
    nodeSelector:
      nvidia.com/gpu.present: "true"
    tolerations:
      - key: nvidia.com/gpu
        operator: Exists
        effect: NoSchedule
    affinity:
      nodeAffinity:
        requiredDuringSchedulingIgnoredDuringExecution:
          nodeSelectorTerms:
            - matchExpressions:
                - key: nvidia.com/gpu.product
                  operator: In
                  values: ["NVIDIA-A100-SXM4-40GB"]
```

## Persistence

The chart requires `ReadWriteMany` (RWX) storage for shared state:

```yaml
persistence:
  enabled: true
  accessMode: ReadWriteMany
  size: 10Gi
  storageClass: "nfs-client"  # Your RWX-capable storage class
```

All worker pods mount this PVC at `/data`.

### Local Testing

For local testing with Kind or Docker Desktop (which lack RWX storage), skip PVC validation:

```bash
helm install dagu dagu/dagu \
  --set persistence.skipValidation=true \
  --set workerPools.general.replicas=1
```

## Other Chart Components

### Scheduler

```yaml
scheduler:
  replicas: 1
  resources:
    requests:
      memory: "256Mi"
      cpu: "250m"
```

### Coordinator

```yaml
coordinator:
  replicas: 1
  resources:
    requests:
      memory: "128Mi"
      cpu: "100m"
```

### Web UI

```yaml
ui:
  replicas: 1
  service:
    port: 8080
  resources:
    requests:
      memory: "256Mi"
      cpu: "250m"
```

### Authentication

```yaml
auth:
  mode: "builtin"  # "none", "builtin", or "oidc"
  builtin:
    admin:
      username: "admin"
      password: "changeme"
    token:
      secret: "changeme"
      ttl: "24h"
```

### Image

```yaml
image:
  repository: ghcr.io/dagu-org/dagu
  tag: latest
  pull_policy: IfNotPresent
```
