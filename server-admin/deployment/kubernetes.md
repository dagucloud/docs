# Kubernetes (Helm)

The official Helm chart in `charts/dagu` deploys Dagu on Kubernetes 1.19 or newer. Its default configuration is a self-contained standalone installation designed to work with a regular cluster StorageClass.

For the shortest installation path, see [Install on Kubernetes](/getting-started/installation/kubernetes).

## Deployment modes

| Mode | Components | Storage | Best for |
|---|---|---|---|
| `standalone` (default) | One `dagu start-all` pod runs the UI, scheduler, and local executor | `ReadWriteOnce` | Most installations and initial evaluation |
| `distributed` | Separate UI server, scheduler, coordinator, and worker Deployments | `ReadWriteMany` for server-side state | Horizontal workers and specialized worker pools |

Standalone mode intentionally keeps one UI replica and uses the `Recreate` update strategy. This prevents two pods from writing the same file-backed state while a `ReadWriteOnce` volume is attached.

## Prerequisites

- Kubernetes 1.19 or newer
- Helm 3
- A default `ReadWriteOnce` StorageClass, or the name of one to select
- For distributed mode, a StorageClass that supports `ReadWriteMany`
- For Ingress access, an installed ingress controller and a DNS record for the UI hostname

## Install standalone mode

```bash
helm repo add dagu https://dagucloud.github.io/dagu
helm repo update
helm upgrade --install dagu dagu/dagu \
  --namespace dagu \
  --create-namespace \
  --wait
```

If the cluster has no default StorageClass, pass one explicitly:

```bash
helm upgrade --install dagu dagu/dagu \
  --namespace dagu \
  --create-namespace \
  --set-string persistence.storageClass=standard \
  --wait
```

From a Dagu source checkout, replace `dagu/dagu` with `./charts/dagu`.

## Rendered resources

For a release named `dagu`, standalone mode creates these primary resources:

- `ServiceAccount/dagu`
- `ConfigMap/dagu-config`
- `PersistentVolumeClaim/dagu-data`, unless `persistence.existingClaim` is set
- `Deployment/dagu-ui`
- `Service/dagu-ui`
- `Ingress/dagu-ui` when `ingress.enabled=true`

Distributed mode also creates:

- `Deployment/dagu-scheduler` and `Service/dagu-scheduler`
- `Deployment/dagu-coordinator` and `Service/dagu-coordinator`
- one `Deployment/dagu-worker-<pool>` for every entry in `workerPools`

The chart uses stable selectors so upgrades do not replace workloads merely because chart metadata changes. `nameOverride` and `fullnameOverride` can change the resource-name prefix. Run `helm get manifest` or query resources by the release label when custom names are used:

```bash
kubectl --namespace dagu get deployment,service,serviceaccount,configmap,pvc,ingress \
  --selector app.kubernetes.io/instance=dagu
```

## Access the UI

### Port forwarding

The default UI Service is a `ClusterIP` on port 8080:

```bash
kubectl --namespace dagu port-forward service/dagu-ui 8080:8080
```

Open <http://localhost:8080>. The first visit guides the administrator through builtin-auth setup.

The release notes contain commands with the actual rendered resource names:

```bash
helm get notes dagu --namespace dagu
```

### Ingress

Create a values file and replace the ingress class, hostname, and TLS Secret with values for the cluster:

```yaml
ingress:
  enabled: true
  className: your-ingress-class
  annotations: {}
  host: dagu.example.com
  tls:
    enabled: true
    secretName: dagu-tls

config:
  publicUrl: https://dagu.example.com
```

The TLS Secret must exist in the release namespace. Leave `ingress.tls.secretName` empty only when the ingress controller supplies a default certificate. Provider-specific settings can be added through `ingress.annotations`.

Apply the values:

```bash
helm upgrade --install dagu dagu/dagu \
  --namespace dagu \
  --create-namespace \
  --values dagu-values.yaml \
  --wait
```

Point the hostname at the ingress controller and inspect the assigned address:

```bash
kubectl --namespace dagu get ingress dagu-ui
```

Open <https://dagu.example.com>. Because the bundled UI and API use the same origin, `config.corsAllowedOrigins` is not needed for this setup.

When OIDC is enabled, set `auth.oidc.clientUrl` to the same external URL and register its `/oidc-callback` path with the identity provider.

::: warning Proxy authentication
Proxy-header authentication cannot use the chart-managed Ingress. The authenticating proxy must be the only path to the UI Service. Keep `ingress.enabled=false` and follow [Proxy Authentication](/server-admin/authentication/proxy).
:::

### LoadBalancer or NodePort

Clusters without an ingress controller can expose the Service directly:

```yaml
ui:
  service:
    type: LoadBalancer
    port: 80
    annotations: {}
```

`ui.service.port` is the Kubernetes Service port. Dagu still listens on `ui.containerPort`, which defaults to 8080, so exposing Service port 80 does not require the application process to bind a privileged port.

`NodePort` is also supported. Kubernetes selects the node port because the chart does not set a fixed one.

## Persistence

The default persistence settings are:

```yaml
persistence:
  enabled: true
  retain: true
  existingClaim: ""
  accessMode: ReadWriteOnce
  size: 10Gi
  storageClass: ""
  annotations: {}
```

An empty `storageClass` uses the cluster's default StorageClass. Dagu requires persistence, so `persistence.enabled` must remain `true`.

### PVC retention

The chart annotates its PVC so Helm retains it when the release is uninstalled. This preserves workflows, run history, credentials, and other Dagu state.

Set `persistence.retain: false` only when uninstalling the release should also delete the chart-managed PVC. To remove a retained PVC explicitly:

```bash
kubectl --namespace dagu delete pvc dagu-data
```

Confirm the release name and PVC contents before deleting it.

### Existing PVC

To mount a PVC managed outside the release:

```yaml
persistence:
  existingClaim: existing-dagu-data
```

The claim must already exist in the release namespace. The chart does not create, modify, retain, or delete it.

In distributed mode, also declare `persistence.accessMode: ReadWriteMany`. The declaration must match the existing PVC; Helm cannot inspect the live claim while rendering.

## Distributed mode

Distributed mode is an explicit opt-in:

```yaml
deploymentMode: distributed

persistence:
  accessMode: ReadWriteMany
  storageClass: nfs-client
  size: 20Gi

worker:
  maxActiveRuns: 100

workerPools:
  general:
    replicas: 2
    labels: {}
    dataVolume:
      sizeLimit: 2Gi
```

Install it with a values file:

```bash
helm upgrade --install dagu dagu/dagu \
  --namespace dagu \
  --create-namespace \
  --values distributed-values.yaml \
  --wait
```

The UI server, scheduler, and coordinator share the RWX PVC. Workers use ephemeral pod storage and communicate with the coordinator through its `ClusterIP` Service; they do not mount the shared PVC.

Each `workerPools` entry creates an independent worker Deployment. Labels are Dagu worker-selection capabilities, while scheduling fields control Kubernetes placement:

```yaml
workerPools:
  gpu:
    replicas: 2
    labels:
      gpu: "true"
    dataVolume:
      sizeLimit: 10Gi
    resources:
      requests:
        cpu: "1"
        memory: 2Gi
        ephemeral-storage: 2Gi
      limits:
        cpu: "2"
        memory: 4Gi
        ephemeral-storage: 10Gi
    nodeSelector:
      accelerator: nvidia
    tolerations: []
    affinity: {}
```

Non-empty `nodeSelector`, `tolerations`, and `affinity` values on a worker pool override their global counterparts for that pool.

### Standby schedulers

The scheduler defaults to one replica in distributed mode. Set two to keep a standby ready:

```yaml
scheduler:
  replicas: 2
```

The replicas share the `ReadWriteMany` volume and compete for one lock. The replica holding the lock schedules runs and consumes queues, and another takes over when the lock is released or stops being renewed. See [Scheduler High Availability](/server-admin/deployment/high-availability) for the storage requirements and what is guaranteed.

Image tag `2.26.0` and earlier can run one schedule slot twice when a scheduler stalls past `scheduler.lock_stale_threshold`. Later releases stop dispatching before the lock can be taken over.

## Configuration and environment variables

The chart renders a minimal Dagu configuration into `dagu-config` and mounts it at `/etc/dagu/dagu.yaml`. Every Deployment receives a checksum annotation, so configuration changes trigger a rollout.

Common top-level settings include:

```yaml
config:
  publicUrl: https://dagu.example.com
  corsAllowedOrigins: []
  allowedHosts: []
  ipAccess:
    allowedIPs: []
    trustedProxies: []
  envPassthrough: []
  envPassthroughPrefixes: []

extraEnv: []
```

`extraEnv` adds variables to every Dagu Deployment. `config.envPassthrough` and `config.envPassthroughPrefixes` control which pod environment variables Dagu forwards into workflow processes; they do not create those variables.

### Allowed host names

Where no login is needed, on every request with `auth.mode: none` and on first-admin setup, Dagu v2.22 or later answers `400 Bad Request` to host names it does not know. IP addresses, single-label names such as `dagu-ui`, cluster names under `.local` such as `dagu-ui.dagu.svc.cluster.local`, and the `config.publicUrl` host need no entry. The chart adds `ingress.host` when `ingress.enabled=true`. List any other name Dagu is reached under:

```yaml
config:
  allowedHosts:
    - dagu.example.com
    - .corp.example.com # The domain and its subdomains
```

Shortened Service names that contain a dot, such as `dagu-ui.dagu` or `dagu-ui.dagu.svc`, are not accepted automatically; use the full `.svc.cluster.local` name or list them. See [Allowed Host Names](/server-admin/server#allowed-host-names) for every name accepted and for `["*"]`.

### IP access allowlist

Restrict all UI and API routes to selected addresses or networks:

```yaml
config:
  ipAccess:
    allowedIPs:
      - 203.0.113.10
      - 10.0.0.0/8
    trustedProxies:
      - 10.42.0.0/16
```

Both lists accept IPv4 and IPv6 addresses or CIDR ranges. Leave `allowedIPs` empty to disable filtering. For an ingress or reverse proxy, set `trustedProxies` to the narrowest network containing the proxy addresses. The proxy must remove client-supplied forwarding headers and set or append the verified client address.

The allowlist includes health and metrics endpoints. When `allowedIPs` is non-empty, the chart renders TCP liveness and readiness probes and uses a TCP connection check for `helm test`, so cluster node and test-pod addresses do not need HTTP allowlist exemptions.

## Authentication and licensing

Builtin authentication is enabled by default. The chart also supports Secret-backed basic authentication and chart-managed OIDC configuration:

- [Builtin authentication](/server-admin/authentication/builtin)
- [Basic authentication](/server-admin/authentication/basic)
- [OIDC authentication](/server-admin/authentication/oidc)
- [Proxy authentication](/server-admin/authentication/proxy)

The chart keeps Dagu's runtime-compatible OIDC defaults: first-time identities are created automatically and unmatched validated users receive viewer access to all named workspaces. Set `auth.oidc.roleMapping.defaultWorkspaceAccess: none` when named workspaces must be isolated, and use `allowedDomains`, `whitelist`, or explicit mappings to limit who can sign in.

OIDC and license activation values reference existing Kubernetes Secrets. Secret data is read when the UI pod starts, so restart the UI after changing a referenced Secret:

```bash
kubectl --namespace dagu rollout restart deployment/dagu-ui
```

## Images and private registries

An empty `image.tag` uses the chart's `appVersion`, keeping the default image aligned with the chart release:

```yaml
image:
  repository: ghcr.io/dagucloud/dagu
  tag: ""
  pullPolicy: IfNotPresent
```

Set an explicit tag only when a different Dagu version is required. Private registry credentials can be applied to every Dagu pod:

```yaml
imagePullSecrets:
  - name: registry-credentials
```

## Service account and mounted files

The chart creates a release-scoped ServiceAccount and assigns it to every Dagu pod. Provider-specific annotations can connect it to supported workload identity systems such as EKS IRSA or GKE Workload Identity:

```yaml
serviceAccount:
  create: true
  name: ""
  annotations:
    example.com/workload-identity: dagu
```

Use an existing ServiceAccount by disabling creation and setting its name:

```yaml
serviceAccount:
  create: false
  name: dagu-runtime
```

With `create: false` and an empty name, Dagu uses the namespace's `default` ServiceAccount. The chart does not create RoleBindings or grant Kubernetes API access. Bind the permissions required by workflows or the [Kubernetes Secret provider](/writing-workflows/secrets/kubernetes-provider) to the selected account separately.

Additional volumes and mounts are applied to every Dagu container. This example exposes a custom CA bundle to Dagu and its workflow processes:

```yaml
extraVolumes:
  - name: ca-bundle
    secret:
      secretName: dagu-ca-bundle

extraVolumeMounts:
  - name: ca-bundle
    mountPath: /etc/ssl/certs/dagu-ca-bundle.pem
    subPath: ca-bundle.pem
    readOnly: true

extraEnv:
  - name: SSL_CERT_FILE
    value: /etc/ssl/certs/dagu-ca-bundle.pem

config:
  envPassthrough:
    - SSL_CERT_FILE
```

Use unique volume names that do not conflict with the chart-managed `data` and `config` volumes. Referenced Secrets, ConfigMaps, PVCs, and CSI resources must already be available in the release namespace where applicable.

## Pod settings and resources

These values apply to every Dagu pod:

```yaml
podAnnotations: {}
nodeSelector: {}
tolerations: []
affinity: {}
```

The default `podSecurityContext.fsGroup` is 1000 so mounted runtime files remain writable after the image entrypoint switches to the default Dagu user.

The standalone UI container has resource requests but no default limits because local workflow subprocesses run inside it. Set limits only after accounting for the workflows the pod will execute.

## Upgrade

Keep release configuration in a values file for reproducible upgrades:

```bash
helm repo update
helm upgrade dagu dagu/dagu \
  --namespace dagu \
  --values dagu-values.yaml \
  --wait
```

Inspect the proposed manifests before applying them:

```bash
helm template dagu dagu/dagu \
  --namespace dagu \
  --values dagu-values.yaml
```

## Verify and troubleshoot

Check the release and run the chart test:

```bash
helm status dagu --namespace dagu
kubectl --namespace dagu get pods,pvc,service,ingress
helm test dagu --namespace dagu
```

If a pod remains pending, inspect its events and the PVC:

```bash
kubectl --namespace dagu describe pod <pod-name>
kubectl --namespace dagu get pvc
kubectl --namespace dagu describe pvc <pvc-name>
kubectl get storageclass
```

If Ingress has no address, confirm that `ingress.className` selects an installed controller. If the address works but the hostname does not, check the DNS record and TLS Secret.

Distributed rendering fails unless `persistence.accessMode` is `ReadWriteMany`. A successful render does not guarantee that the selected StorageClass can provision RWX volumes; verify that capability with the storage provider.

## Uninstall

```bash
helm uninstall dagu --namespace dagu
```

The chart-managed PVC remains by default. See [Uninstall](/getting-started/installation/uninstall#helm) before deleting persistent data.

The complete value reference is maintained with the chart in [`charts/dagu/README.md`](https://github.com/dagucloud/dagu/blob/main/charts/dagu/README.md).
