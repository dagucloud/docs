# Install on Kubernetes

The official Helm chart deploys Dagu to any Kubernetes 1.19+ cluster.

## Prerequisites

- Kubernetes 1.19+
- Helm 3.0+
- **A `StorageClass` that supports `ReadWriteMany`** — Dagu's server components need shared storage so the Web UI, scheduler, and run history stay in sync across pods. Examples: NFS (`nfs-client-provisioner`), AWS EFS, CephFS, Azure Files Premium, GlusterFS.

## Install

```bash
helm repo add dagu https://dagucloud.github.io/dagu
helm repo update
helm install dagu dagu/dagu --set persistence.storageClass=<your-rwx-storage-class>
```

If your cluster's default `StorageClass` already supports `ReadWriteMany`, you can drop the `--set persistence.storageClass=...` flag.

## Render manifests without installing

```bash
helm template dagu dagu/dagu --set persistence.storageClass=<your-rwx-storage-class>
```

## Upgrade

```bash
helm repo update
helm upgrade dagu dagu/dagu --set persistence.storageClass=<your-rwx-storage-class>
```

## From a source checkout

```bash
git clone https://github.com/dagucloud/dagu.git
cd dagu
helm install dagu ./charts/dagu --set persistence.storageClass=<your-rwx-storage-class>
```

## Image and version

- Chart version comes from `charts/dagu/Chart.yaml`.
- Container image comes from `values.yaml` — defaults to `ghcr.io/dagucloud/dagu:latest`. Pin a specific tag in production:

  ```bash
  helm install dagu dagu/dagu \
    --set persistence.storageClass=<rwx-class> \
    --set image.tag=vX.Y.Z
  ```

## Full configuration

All values are documented in [`charts/dagu/README.md`](https://github.com/dagucloud/dagu/blob/main/charts/dagu/README.md) and validated against `values.schema.json`.

## Verify

```bash
kubectl get pods -l app.kubernetes.io/name=dagu
kubectl port-forward svc/dagu 8080:8080
# visit http://localhost:8080
```

Next: [Quickstart](/getting-started/quickstart).
