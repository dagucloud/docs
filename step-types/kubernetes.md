# Kubernetes

Run a workflow step as a Kubernetes Job.

The Kubernetes executor has two equivalent type aliases:

- `type: k8s`
- `type: kubernetes`

Dagu creates a single-container Kubernetes Job for the step, waits for the Job to finish, streams the Pod logs, and uses the terminated container exit code when available.

## Basic Usage

```yaml
steps:
  - id: hello
    type: k8s
    with:
      image: alpine:3.20
    command: echo "hello from kubernetes"
```

If you omit `command`, Dagu leaves the container command unset, so the image default command/entrypoint runs instead:

```yaml
steps:
  - id: run_image_default
    type: kubernetes
    with:
      image: ghcr.io/example/app:latest
```

## DAG-Level Defaults

Use the root `kubernetes:` block for defaults shared by explicit Kubernetes steps:

```yaml
kubernetes:
  kubeconfig: /etc/dagu/kubeconfig
  context: production
  namespace: batch
  service_account: dagu-runner
  resources:
    requests:
      cpu: "100m"
      memory: "128Mi"

steps:
  - id: report
    type: k8s
    with:
      image: alpine:3.20
    command: echo "generate report"

  - id: worker
    type: kubernetes
    with:
      image: ghcr.io/example/worker:1.2.3
      namespace: jobs
```

Important behavior:

- The root `kubernetes:` block applies only to steps with `type: k8s` or `type: kubernetes`.
- It does not change plain command steps into Kubernetes steps.
- Step `with` overrides DAG-level `kubernetes`.
- `image` is optional in DAG-level or `base.yaml` defaults, but it must be present in the effective step configuration after inheritance.

Merge behavior is Kubernetes-specific:

- Scalar values replace inherited values.
- Nested objects merge by key, with the step value winning.
- Arrays replace inherited arrays wholesale.
- Empty objects and empty arrays can clear inherited nested values.

The same `kubernetes:` block can also be set in `base.yaml`. Precedence is:

1. `base.yaml` `kubernetes`
2. DAG-level `kubernetes`
3. Step-level `with`

See [Base Configuration](/server-admin/base-config#kubernetes-configuration) for the `base.yaml` form.

## Cluster Resolution

Dagu resolves Kubernetes client configuration in this order:

1. Explicit `with.kubeconfig`
2. Default kubeconfig loading rules (`KUBECONFIG`, then the standard local kubeconfig locations)
3. In-cluster configuration

If you set `kubeconfig` or `context` explicitly and they are invalid, Dagu fails fast instead of silently falling back to in-cluster credentials.

## Command Behavior

The Kubernetes executor is intentionally narrow:

- Supports a single command only
- Does not support `script:`
- Does not support step-level `shell:`
- Does not support multi-command `command: [...]` lists where each item is a separate command

These are valid:

```yaml
steps:
  - id: string_command
    type: k8s
    with:
      image: alpine:3.20
    command: echo "hello"

  - id: argv_command
    type: k8s
    with:
      image: python:3.12-alpine
    command: [python3, -c, 'print("hello")']
```

These are not supported:

```yaml
steps:
  - id: bad_script
    type: k8s
    with:
      image: alpine:3.20
    script: |
      echo hello

  - id: bad_multi_command
    type: k8s
    with:
      image: alpine:3.20
    command:
      - echo one
      - echo two
```

## Logging and Cleanup

- Kubernetes exposes a merged container log stream, so stdout and stderr are streamed as a single log stream for this executor.
- `cleanup_policy` defaults to `delete`, which removes the Job after completion.
- `cleanup_policy: keep` keeps the Job after normal completion or job-reported failure.
- `cleanup_policy: keep` also keeps the Job when pod scheduling fails before the workload starts.
- Cancellation, kill, and timeout paths still force cleanup even when `cleanup_policy` is `keep`.

## Configuration Reference

### Cluster and Runtime

| Field | Description | Default |
|-------|-------------|---------|
| `image` | Container image for the Job | Required in effective step configuration |
| `namespace` | Kubernetes namespace | `default` |
| `kubeconfig` | Explicit path to kubeconfig | - |
| `context` | Kubeconfig context name | current context |
| `working_dir` | Working directory inside the container | image default |
| `service_account` | Pod service account name | cluster default |
| `image_pull_policy` | Pull policy: `Always`, `IfNotPresent`, `Never` | unset |
| `image_pull_secrets` | Secret names for private registries | - |
| `priority_class_name` | Pod priority class name | unset |
| `termination_grace_period_seconds` | Pod shutdown grace period in seconds | cluster default |

`image_pull_policy` is case-insensitive. When omitted, Dagu leaves it unset.
`termination_grace_period_seconds` must be non-negative.

### Environment

`env` sets explicit environment variables:

```yaml
with:
  env:
    - name: APP_ENV
      value: production
    - name: POD_NAME
      value_from:
        field_ref:
          field_path: metadata.name
```

Supported `value_from` sources:

- `secret_key_ref`
- `config_map_key_ref`
- `field_ref`

`env_from` imports whole ConfigMaps or Secrets:

```yaml
with:
  env_from:
    - config_map_ref:
        name: app-config
      prefix: APP_
    - secret_ref:
        name: app-secrets
```

Rules enforced by Dagu:

- Every `env` entry must include `name`.
- `value` and `value_from` are mutually exclusive.
- `value_from` must define exactly one source.
- `secret_key_ref.name`, `secret_key_ref.key`, `config_map_key_ref.name`, `config_map_key_ref.key`, and `field_ref.field_path` are required when their source is used.
- Every `env_from` entry must define exactly one of `config_map_ref` or `secret_ref`.
- `config_map_ref.name` and `secret_ref.name` are required.

### Resources, Scheduling, and Metadata

| Field | Description |
|-------|-------------|
| `resources.requests` | Resource requests map, typically `cpu` / `memory` |
| `resources.limits` | Resource limits map, typically `cpu` / `memory` |
| `node_selector` | Pod node selector labels |
| `tolerations` | Pod tolerations |
| `affinity` | Node affinity, pod affinity, and pod anti-affinity |
| `labels` | Labels applied to both the Job and Pod |
| `annotations` | Annotations applied to both the Job and Pod |

Resource quantities use Kubernetes quantity syntax such as `100m`, `128Mi`, or `1Gi`. Invalid or negative quantities are rejected during configuration validation.

### Security Context

`security_context` configures container-level Linux security settings:

```yaml
with:
  security_context:
    run_as_user: 1000
    run_as_group: 1000
    run_as_non_root: true
    privileged: false
    read_only_root_filesystem: true
    allow_privilege_escalation: false
    capabilities:
      drop: [ALL]
    seccomp_profile:
      type: RuntimeDefault
```

Supported fields:

- `run_as_user`
- `run_as_group`
- `run_as_non_root`
- `privileged`
- `read_only_root_filesystem`
- `allow_privilege_escalation`
- `capabilities.add`
- `capabilities.drop`
- `seccomp_profile.type`
- `seccomp_profile.localhost_profile`

Rules enforced by Dagu:

- `run_as_user` and `run_as_group` must be non-negative when set.
- `capabilities.add` and `capabilities.drop` must contain only non-empty strings.
- `seccomp_profile.type` must be `RuntimeDefault`, `Unconfined`, or `Localhost`.
- `seccomp_profile.localhost_profile` is required only when `type` is `Localhost`.

### Pod Security Context

`pod_security_context` configures Pod-level Linux defaults:

```yaml
with:
  pod_security_context:
    run_as_user: 1000
    run_as_group: 1000
    run_as_non_root: true
    fs_group: 2000
    fs_group_change_policy: OnRootMismatch
    supplemental_groups: [3000, 4000]
    sysctls:
      - name: net.ipv4.ip_unprivileged_port_start
        value: "0"
    seccomp_profile:
      type: RuntimeDefault
```

Supported fields:

- `run_as_user`
- `run_as_group`
- `run_as_non_root`
- `fs_group`
- `fs_group_change_policy`
- `supplemental_groups`
- `sysctls[].name`
- `sysctls[].value`
- `seccomp_profile.type`
- `seccomp_profile.localhost_profile`

Rules enforced by Dagu:

- `run_as_user`, `run_as_group`, `fs_group`, and every `supplemental_groups` entry must be non-negative.
- `fs_group_change_policy` must be `Always` or `OnRootMismatch` when set.
- Every `sysctls` entry must include non-empty `name` and `value`.
- `seccomp_profile` uses the same validation rules as `security_context`.

Container-level `security_context` and Pod-level `pod_security_context` can both be set. Dagu maps both to Kubernetes and does not try to collapse them into one structure.

### Affinity

`affinity` supports the typed subset implemented by the executor:

```yaml
with:
  affinity:
    node_affinity:
      required_during_scheduling_ignored_during_execution:
        node_selector_terms:
          - match_expressions:
              - key: kubernetes.io/arch
                operator: In
                values: [amd64]
      preferred_during_scheduling_ignored_during_execution:
        - weight: 50
          preference:
            match_expressions:
              - key: topology.kubernetes.io/zone
                operator: In
                values: [ap-northeast-1a]
    pod_anti_affinity:
      preferred_during_scheduling_ignored_during_execution:
        - weight: 100
          pod_affinity_term:
            topology_key: kubernetes.io/hostname
            label_selector:
              match_labels:
                app: report-worker
```

Supported fields:

- `node_affinity.required_during_scheduling_ignored_during_execution.node_selector_terms[].match_expressions[]`
- `node_affinity.preferred_during_scheduling_ignored_during_execution[].weight`
- `node_affinity.preferred_during_scheduling_ignored_during_execution[].preference.match_expressions[]`
- `pod_affinity.required_during_scheduling_ignored_during_execution[]`
- `pod_affinity.preferred_during_scheduling_ignored_during_execution[].weight`
- `pod_affinity.preferred_during_scheduling_ignored_during_execution[].pod_affinity_term`
- `pod_anti_affinity` with the same shape as `pod_affinity`
- `label_selector.match_labels`
- `label_selector.match_expressions`
- `namespace_selector.match_labels`
- `namespace_selector.match_expressions`
- `namespaces`
- `topology_key`

Rules enforced by Dagu:

- Node selector requirement operators must be `In`, `NotIn`, `Exists`, `DoesNotExist`, `Gt`, or `Lt`.
- `In` and `NotIn` require at least one value.
- `Exists` and `DoesNotExist` require `values` to be empty.
- `Gt` and `Lt` require exactly one integer value.
- Pod and label selector operators are limited to `In`, `NotIn`, `Exists`, and `DoesNotExist`.
- Every preferred affinity weight must be between `1` and `100`.
- Every pod affinity or anti-affinity term must set `topology_key`.
- `namespaces` entries must be non-empty strings.

At the DAG or base level, `affinity: {}` clears inherited affinity defaults. You can also clear only the required node-affinity block with:

```yaml
with:
  affinity:
    node_affinity:
      required_during_scheduling_ignored_during_execution: {}
```

### Job Lifecycle

| Field | Description | Default |
|-------|-------------|---------|
| `active_deadline` | Kubernetes Job active deadline in seconds | - |
| `backoff_limit` | Kubernetes Job retry count | `0` |
| `ttl_after_finished` | Kubernetes TTL-after-finished in seconds | - |
| `cleanup_policy` | `delete` or `keep` | `delete` |
| `pod_failure_policy` | Kubernetes Job pod failure policy rules | - |

Notes:

- `active_deadline`, `backoff_limit`, and `ttl_after_finished` must be non-negative.
- `ttl_after_finished` matters only if the Job remains after completion, for example with `cleanup_policy: keep`.

`pod_failure_policy` supports this typed subset:

```yaml
with:
  pod_failure_policy:
    rules:
      - action: FailJob
        on_exit_codes:
          operator: In
          values: [42]
      - action: Ignore
        on_pod_conditions:
          - type: DisruptionTarget
```

Supported fields:

- `rules[].action`
- `rules[].on_exit_codes.container_name`
- `rules[].on_exit_codes.operator`
- `rules[].on_exit_codes.values`
- `rules[].on_pod_conditions[].type`
- `rules[].on_pod_conditions[].status`

Rules enforced by Dagu:

- `rules` may contain at most `20` rules.
- Each rule must define exactly one of `on_exit_codes` or `on_pod_conditions`.
- Supported `action` values are `FailJob`, `Ignore`, and `Count`.
- `FailIndex` is rejected because this executor creates non-indexed Jobs.
- `on_exit_codes.operator` must be `In` or `NotIn`.
- `on_exit_codes.values` must contain `1` to `255` unique integers.
- With `operator: In`, exit code `0` is not allowed.
- `on_pod_conditions` may contain at most `20` patterns per rule.
- `on_pod_conditions[].type` is required.
- `on_pod_conditions[].status` may be `True`, `False`, or `Unknown`. If omitted, Kubernetes defaults it to `True`.

At the DAG or base level, `pod_failure_policy: {}` or `pod_failure_policy: { rules: [] }` clears inherited rules.

### Volumes

Each volume entry must define exactly one source:

- `empty_dir`
- `host_path`
- `config_map`
- `secret`
- `persistent_volume_claim`

Example:

```yaml
with:
  volumes:
    - name: scratch
      empty_dir:
        medium: Memory
        size_limit: 256Mi
    - name: app-config
      config_map:
        name: my-config
    - name: data
      persistent_volume_claim:
        claim_name: shared-data
  volume_mounts:
    - name: scratch
      mount_path: /tmp/work
    - name: app-config
      mount_path: /etc/app
      read_only: true
    - name: data
      mount_path: /data
```

Supported source shapes:

- `empty_dir.medium`
- `empty_dir.size_limit`
- `host_path.path`
- `host_path.type`
- `config_map.name`
- `secret.secret_name`
- `persistent_volume_claim.claim_name`
- `persistent_volume_claim.read_only`

## Complete Example

```yaml
type: graph

kubernetes:
  context: production
  namespace: batch
  service_account: dagu-runner
  image_pull_secrets: [regcred]
  pod_security_context:
    run_as_non_root: true
    fs_group: 2000
    seccomp_profile:
      type: RuntimeDefault
  affinity:
    pod_anti_affinity:
      preferred_during_scheduling_ignored_during_execution:
        - weight: 100
          pod_affinity_term:
            topology_key: kubernetes.io/hostname
            label_selector:
              match_labels:
                app: dagu-job
  resources:
    requests:
      cpu: "100m"
      memory: "128Mi"
    limits:
      cpu: "500m"
      memory: "512Mi"
  labels:
    app: dagu
    team: platform

steps:
  - id: migrate
    type: k8s
    with:
      image: ghcr.io/example/migrator:2026-03-31
      cleanup_policy: keep
      ttl_after_finished: 3600
      priority_class_name: batch-high
      security_context:
        run_as_user: 1000
        run_as_group: 1000
        run_as_non_root: true
        read_only_root_filesystem: true
        allow_privilege_escalation: false
        capabilities:
          drop: [ALL]
      env:
        - name: DATABASE_URL
          value_from:
            secret_key_ref:
              name: app-secrets
              key: database_url
    command: [app, migrate]

  - id: report
    type: kubernetes
    depends: [migrate]
    with:
      image: ghcr.io/example/report:2026-03-31
      termination_grace_period_seconds: 30
      annotations:
        batch.example.com/purpose: nightly-report
      pod_failure_policy:
        rules:
          - action: FailJob
            on_exit_codes:
              operator: In
              values: [42]
    command: [app, report, --date, "${DATE}"]
```

## Unsupported Fields

The current executor does not expose:

- raw Pod spec or Job spec passthrough
- Job `parallelism`, `completions`, `completion_mode`, or `success_policy`
- `restart_policy` configuration
- Windows-specific security options
- SELinux, AppArmor, or `proc_mount` settings

If a field is not listed on this page, assume it is not currently supported by the executor.

## See Also

- [YAML Specification](/writing-workflows/yaml-specification#kubernetes-configuration)
- [Base Configuration](/server-admin/base-config#kubernetes-configuration)
- [Distributed Execution](/server-admin/distributed/)
