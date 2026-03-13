# Kubernetes (Helm)

This page documents the Helm chart in `charts/dagu` as implemented in this repository.

## Chart Path

```text
charts/dagu
```

## Rendered Objects

For a release named `<release>`, the chart renders:

- `ConfigMap/<fullname>-config`
- `PersistentVolumeClaim/<fullname>-data`
- `Deployment/<fullname>-coordinator`
- `Deployment/<fullname>-scheduler`
- `Deployment/<fullname>-ui`
- `Deployment/<fullname>-worker-<poolName>` for each entry in `workerPools`
- `Service/<fullname>-coordinator` (`ClusterIP`, port `50055`)
- `Service/<fullname>-scheduler` (`ClusterIP`, port `8090`)
- `Service/<fullname>-ui` (`ClusterIP`, port `ui.service.port`)

The chart does not render:

- `Ingress`
- `NetworkPolicy`
- `ServiceAccount`, `Role`, or `RoleBinding`
- `HorizontalPodAutoscaler`
- `PodDisruptionBudget`
- Services for worker Deployments

`<fullname>` is resolved by the helper in `charts/dagu/templates/_helpers.tpl`:

- `fullnameOverride` if set
- otherwise let `<name>` be `nameOverride` if set, or `dagu` if not
- if the release name already contains `<name>`, use the release name unchanged
- otherwise use `<release>-<name>`

`nameOverride` and `fullnameOverride` are supported by the templates even though they are not listed in `charts/dagu/values.yaml`.

## Install

Official Helm repository URL:

```text
https://dagu-org.github.io/dagu
```

Add the repository and install the chart:

```bash
helm repo add dagu https://dagu-org.github.io/dagu
helm repo update
helm install dagu dagu/dagu --set persistence.storageClass=nfs-client
```

Render manifests without installing:

```bash
helm template dagu dagu/dagu --set persistence.storageClass=nfs-client
```

To upgrade an existing release:

```bash
helm repo update
helm upgrade dagu dagu/dagu --set persistence.storageClass=nfs-client
```

From the repository root, the local chart path remains available:

```bash
helm install dagu ./charts/dagu --set persistence.storageClass=nfs-client
```

## Version Fields

`charts/dagu/Chart.yaml` defines the chart `version`, which is the version published in the Helm repository.

The deployed container image comes from `values.yaml -> image.repository` and `values.yaml -> image.tag`. With the current defaults, the chart deploys `ghcr.io/dagu-org/dagu:latest`.

## Pod Configuration

All Deployments created by the chart:

- mount the shared PVC at `/data`
- mount the ConfigMap at `/etc/dagu`
- set `enableServiceLinks: false`
- set `DAGU_HOME=/data`

Additional per-component environment variables:

- UI:
  `DAGU_PORT=<ui.service.port>`
- Coordinator:
  `DAGU_COORDINATOR_HOST=0.0.0.0`
  `DAGU_COORDINATOR_ADVERTISE=<fullname>-coordinator.<namespace>.svc.cluster.local`
- Worker:
  `WORKER_ID` from `metadata.name`

Container commands are fixed by the templates:

```text
dagu coordinator --config /etc/dagu/dagu.yaml
dagu scheduler --config /etc/dagu/dagu.yaml
dagu server --config /etc/dagu/dagu.yaml
dagu worker --config /etc/dagu/dagu.yaml [--worker.labels ...]
```

## Dagu Configuration Written By The Chart

The chart writes the following `dagu.yaml` to `<fullname>-config`:

```yaml
host: "0.0.0.0"
port: 8080
api_base_path: "/api/v1"
default_execution_mode: "distributed"

coordinator:
  host: "0.0.0.0"
  port: 50055

scheduler:
  port: 8090

paths:
  data_dir: /data
  dags_dir: /data/dags
  log_dir: /data/logs
  base_config: /data/base.yaml
  suspend_flags_dir: /data/suspend
  admin_logs_dir: /data/admin/logs
  dag_runs_dir: /data/dag-runs
  queue_dir: /data/queue
  proc_dir: /data/proc
  service_registry_dir: /data/services
  api_keys_dir: /data/api-keys
  webhooks_dir: /data/webhooks
  users_dir: /data/users

auth:
  mode: "builtin"
  builtin:
    token:
      secret: ""
      ttl: "24h"

peer:
  insecure: true
```

The `auth.mode`, `auth.builtin.token.secret`, and `auth.builtin.token.ttl` fields come from `values.yaml`. The other fields shown above are fixed by the chart templates.

The UI Deployment also sets `DAGU_PORT=<ui.service.port>`. That environment variable overrides `port` from `dagu.yaml` at runtime when `ui.service.port` is changed from the default.

The following paths are not set explicitly in the chart, but Dagu derives them from `paths.data_dir` and `paths.dags_dir` at runtime:

```yaml
paths:
  docs_dir: /data/dags/docs
  sessions_dir: /data/agent/sessions
  remote_nodes_dir: /data/remote-nodes
  workspaces_dir: /data/workspaces
```

That path layout is consistent with `DAGU_HOME=/data` and with the explicit `base_config: /data/base.yaml`.

The chart does not render DAG definition files. `paths.dags_dir` points to `/data/dags` on the shared PVC. Populate that directory through the UI/API or by writing files into the shared volume.

## Values Exposed By `values.yaml`

The chart currently defines these top-level values in `charts/dagu/values.yaml`:

```yaml
image:
  repository: ghcr.io/dagu-org/dagu
  tag: latest
  pullPolicy: IfNotPresent

scheduler:
  replicas: 1
  resources: ...

coordinator:
  replicas: 1
  resources: ...

workerPools:
  general:
    replicas: 2
    labels: {}
    resources: ...
    nodeSelector: {}
    tolerations: []
    affinity: {}

ui:
  replicas: 1
  service:
    port: 8080
  resources: ...

auth:
  mode: "builtin"
  builtin:
    token:
      secret: ""
      ttl: "24h"

persistence:
  enabled: true
  accessMode: ReadWriteMany
  size: 10Gi
  storageClass: ""
  skipValidation: false
```

`image.pullPolicy` is the actual key used by the chart. `pull_policy` is not used.

## Persistence Rules

The PVC template enforces two conditions:

1. `persistence.enabled` must be `true`
2. `persistence.accessMode` must be `ReadWriteMany` unless `persistence.skipValidation=true`

Examples:

```bash
helm install dagu dagu/dagu \
  --set persistence.storageClass=nfs-client
```

```bash
helm install dagu dagu/dagu \
  --set persistence.accessMode=ReadWriteOnce \
  --set persistence.skipValidation=true \
  --set workerPools.general.replicas=1
```

`persistence.skipValidation=true` only disables the chart's RWX check. It does not change how Kubernetes storage works.

If `persistence.storageClass` is the empty string, the rendered PVC omits `storageClassName` and Kubernetes uses the cluster default behavior.

## Worker Pools

Each entry in `workerPools` creates one Deployment:

```text
<fullname>-worker-<poolName>
```

Pool names are validated by the template and must match:

```text
^[a-z][a-z0-9-]*$
```

Examples:

- valid: `general`, `gpu-workers`, `us-east-1`
- invalid: `GPU`, `1-workers`, `my_pool`

### Worker Labels

`workerPools.<poolName>.labels` are Dagu worker capability labels. They are not copied into Kubernetes pod metadata.

The worker pod metadata always includes `daguit.dev/worker-pool: <poolName>`, but the contents of `workerPools.<poolName>.labels` are only used to build the `--worker.labels` argument.

When `labels` is non-empty, the worker Deployment adds:

```text
--worker.labels <comma-separated key=value pairs>
```

When `labels: {}` is used, the chart does not add a `--worker.labels` argument.

Example values:

```yaml
workerPools:
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

The rendered worker command includes a `--worker.labels` flag built from that map. The exact pair order should not be relied on.

### Kubernetes Scheduling Fields

These pool fields are copied directly into the worker pod spec:

- `nodeSelector`
- `tolerations`
- `affinity`
- `resources`

Example:

```yaml
workerPools:
  gpu:
    replicas: 1
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
                  values:
                    - NVIDIA-A100-SXM4-40GB
```

## Minimal Values Example

```yaml
image:
  tag: latest

auth:
  mode: builtin
  builtin:
    token:
      secret: ""
      ttl: 24h

persistence:
  enabled: true
  accessMode: ReadWriteMany
  size: 10Gi
  storageClass: nfs-client

workerPools:
  general:
    replicas: 2
    labels: {}
    resources:
      requests:
        memory: 128Mi
        cpu: 100m
      limits:
        memory: 256Mi
        cpu: 200m
    nodeSelector: {}
    tolerations: []
    affinity: {}
```

Install with that file:

```bash
helm install dagu dagu/dagu -f values.yaml
```

To force a different image tag:

```yaml
image:
  tag: 2.2.4
```

## Access The UI

```bash
kubectl port-forward svc/dagu-ui 8080:8080
```

If you used a different release name or `fullnameOverride`, replace `dagu-ui` with the rendered UI service name.
