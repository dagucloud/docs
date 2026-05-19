# DAG Run Resource Limits

Limit the CPU and memory available to one DAG run.

Use the root `resources.limits` block when a workflow should stay inside a CPU or memory budget:

```yaml
resources:
  limits:
    cpu: "500m"
    memory: "1Gi"

steps:
  - id: process
    run: python process.py
```

This is a run-level setting. Dagu applies it to processes or containers started for the DAG run where the current executor and operating system support enforcement.

::: tip Best-Effort Enforcement
Resource limits are a best-effort runtime capability. If Dagu cannot apply the requested limits, it logs a warning and continues the run.

Invalid limit values are still rejected during DAG validation.
:::

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `resources.limits.cpu` | string | CPU limit using Kubernetes-style CPU quantity syntax. |
| `resources.limits.memory` | string | Memory limit using Kubernetes-style memory quantity syntax. |

At least one of `cpu` or `memory` must be set for the block to have an effect.

## CPU Values

CPU is measured in cores. You can use whole cores, decimal cores, or millicores:

```yaml
resources:
  limits:
    cpu: "500m"  # 0.5 CPU
```

Examples:

| Value | Meaning |
|-------|---------|
| `"250m"` | 0.25 CPU |
| `"500m"` | 0.5 CPU |
| `"1"` | 1 CPU |
| `"2"` | 2 CPUs |
| `"0.25"` | 250 millicores |

CPU precision must not be finer than 1 millicore. For example, `"0.001"` is valid, but `"0.0005"` is not.

## Memory Values

Memory is measured in bytes. Bare numbers are bytes, and suffixes are supported:

```yaml
resources:
  limits:
    memory: "512Mi"
```

Examples:

| Value | Meaning |
|-------|---------|
| `"1024"` | 1024 bytes |
| `"512Mi"` | 512 mebibytes |
| `"1Gi"` | 1 gibibyte |
| `"2G"` | 2 gigabytes |

Decimal suffixes such as `k`, `M`, `G`, `KB`, `MB`, and `GB` use powers of 1000. Binary suffixes such as `Ki`, `Mi`, and `Gi` use powers of 1024. Suffix matching is case-insensitive.

## Enforcement

| Runtime target | Enforcement | Notes |
|----------------|-------------|-------|
| Linux local processes | cgroup v2 | Dagu logs a warning and continues if cgroup enforcement is unavailable. |
| Windows local processes | Windows Job Objects | Dagu logs a warning and continues if Job Object enforcement is unavailable. |
| New Docker containers | Docker host CPU and memory limits | Dagu sets Docker resource options when it creates the container. |
| Existing Docker containers | Not supported | Dagu logs a warning and continues. |
| macOS and other OSes | Not supported | Dagu logs a warning and continues. |

On Linux, the Dagu process must be able to create a child cgroup under its current cgroup and write the `cpu.max`, `memory.max`, and `cgroup.procs` files. If cgroup v2 is unavailable or permissions are insufficient, Dagu warns and runs without native limits.

On Windows, Dagu uses Job Objects. CPU limits are translated from requested cores into a Windows CPU rate based on the host's logical CPU count.

## Docker Behavior

When Dagu creates a container, DAG run resource limits are mapped to Docker host resource settings.

This applies to:

- A root `container:` block in image mode.
- `docker.run` steps that create a new container.

It does not apply to existing-container exec mode, because Docker cannot change CPU and memory limits for an already running container through exec. In that case, Dagu logs a warning and continues.

```yaml
resources:
  limits:
    cpu: "1"
    memory: "2Gi"

container:
  image: python:3.12

steps:
  - id: train
    run: python train.py
```

## Kubernetes Steps

For Kubernetes pods, use the Kubernetes executor's `resources.requests` and `resources.limits` fields:

```yaml
steps:
  - id: report
    action: k8s.run
    with:
      image: alpine:3.20
      resources:
        requests:
          cpu: "100m"
          memory: "128Mi"
        limits:
          cpu: "500m"
          memory: "512Mi"
      command: echo "hello"
```

See [Kubernetes](/step-types/kubernetes) for the full Kubernetes executor reference.

## Validation

Resource limits are validated when the DAG is loaded. Present values like these are rejected:

- Empty strings.
- Zero or negative values.
- CPU values finer than 1 millicore.
- Unknown memory suffixes.
- Values that exceed the supported integer range.

```yaml
resources:
  limits:
    cpu: "0"        # Invalid
    memory: "10QQ" # Invalid
```

## Related Controls

- Use [Resource Limits](/writing-workflows/resource-limits) for concurrency, queue, and timeout controls.
- Use [Queue Assignment](/writing-workflows/queues) to limit concurrent DAG runs across queues.
- Use `max_active_steps` to limit how many steps run in parallel inside one DAG run.
- Use `timeout_sec` to limit total runtime or individual step runtime.
