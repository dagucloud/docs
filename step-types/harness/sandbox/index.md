# Harness Sandboxed Execution

Run `harness.run` CLI agents inside containers to control the tools,
filesystem, network, and credentials available to an agent step.

By default, a CLI harness provider runs as a subprocess on the Dagu worker. That
process can see the worker filesystem, inherited environment, network, and
installed tools. A containerized harness moves the agent CLI into a container
environment instead. This is the recommended shape when an AI or coding agent
should inspect, edit, or test a repository with a smaller and more explicit
runtime boundary.

There are two supported sandbox shapes. Choose the shape first, then choose
Docker or Podman as the service-level container runtime.

| Shape | Use when |
|-------|----------|
| Root-level `container:` | Many workflow steps should share one long-lived sandbox. Ordinary command steps and `harness.run` CLI providers run inside the same container unless a step defines its own supported container override. |
| Step-level `container:` | One harness step should run in its own per-attempt container, or should override the DAG-level shared container for that harness step. |

When a root-level `container:` is configured, `harness.run` does not silently
fall back to the host. If the shared container cannot be used, the harness step
fails. This keeps the sandbox contract explicit: either the provider runs in the
configured container, or the step is marked failed.

```yaml
container:
  image: dagu-codex-runner:local
  pull_policy: never
  working_dir: /workspace
  volumes:
    - .:/workspace
  env:
    - CODEX_API_KEY=${CODEX_API_KEY}

steps:
  - id: review
    action: harness.run
    with:
      provider: codex
      prompt: |
        Review this repository and report the highest-risk issues.
```

The image must contain the selected provider binary. In the example above,
`codex` must exist in `PATH` inside `dagu-codex-runner:local`. See
[Runner images](./images) for a buildable Codex runner image based on
OpenAI's `codex-universal` image.

Root-level `container.env` is visible to every step that runs inside the shared
container. If repository-controlled commands such as `npm test` should not see
`CODEX_API_KEY`, prefer a step-level harness container for the Codex step.

## What the Sandbox Controls

A containerized harness step gives the workflow author explicit control over:

| Boundary | Controlled by |
|----------|---------------|
| Filesystem | `container.volumes`, `container.working_dir`, image contents |
| Tools | binaries and packages installed in the runner image |
| Credentials | `container.env` and mounted secret files |
| Network | `container.network` and daemon/runtime network policy |
| CPU and memory | configured Dagu resource limits applied to the container |
| Runtime | Docker by default, or Podman selected by Dagu service environment variables |

This is not a complete security boundary by itself. A container can still be
dangerous if it mounts sensitive host paths, runs privileged, uses host network,
receives broad credentials, or can access the container daemon socket. Treat
container daemon access as privileged.

## Execution Model

### Root-Level Shared Sandbox

Root-level `container:` starts one shared container for the DAG run. Ordinary
command steps and `harness.run` CLI providers execute inside that container with
Docker exec or Podman's Docker-compatible exec API.

This example uses a custom `shell` provider so it can be run as a smoke test
without Codex authentication:

```yaml
type: graph

container:
  image: dagu-codex-runner:local
  pull_policy: never
  working_dir: /workspace
  volumes:
    - .:/workspace

harnesses:
  shell:
    binary: sh
    prefix_args:
      - -c
    prompt_mode: arg

steps:
  - id: prepare
    run: npm --version

  - id: inspect_runner
    action: harness.run
    with:
      provider: shell
      prompt: |
        set -eu
        codex --version
        command -v codex
```

The shared container keeps filesystem state between steps. This is useful for
multi-step workflows, but it is not a fresh sandbox per harness attempt.

The runner image must contain both the tools used by ordinary steps and the
selected harness provider binary. In the example above, `npm` and `codex` both
need to be available inside `dagu-codex-runner:local`.

### Step-Level Per-Attempt Sandbox

In image mode, Dagu creates a fresh container for the harness attempt, runs the
agent CLI in that container, captures stdout and stderr, and removes the
container when the step finishes unless `keep_container: true` is set.

```yaml
steps:
  - id: implement
    action: harness.run
    container:
      image: dagu-codex-runner:local
      pull_policy: never
      working_dir: /workspace
      volumes:
        - .:/workspace
      env:
        - CODEX_API_KEY=${CODEX_API_KEY}
    with:
      provider: codex
      prompt: |
        Implement the requested change and run the relevant tests.
```

In exec mode, Dagu runs the agent command inside an already-running container:

```yaml
steps:
  - id: review
    action: harness.run
    container:
      exec: agent-sandbox
      working_dir: /workspace
      env:
        - CODEX_API_KEY=${CODEX_API_KEY}
    with:
      provider: codex
      prompt: |
        Review the current patch.
```

Image mode is usually a better sandbox because each attempt starts from a known
image and can be removed automatically. Exec mode is useful when another system
creates and manages the sandbox container.

### Precedence

For `harness.run`, a step-level `container:` overrides the root-level container
for that harness step. Without a step-level container, a CLI harness provider
inherits the root-level shared container when one exists. Without either
container form, the CLI provider runs as a host subprocess.

Root-level image mode creates a shared container. Root-level exec mode runs the
harness CLI inside the configured existing container.

The shared-container path passes provider arguments directly to the container
exec API. It does not re-wrap the provider command with root-level
`container.shell`, because provider argv and prompt text must not be
reinterpreted by a shell.

Step-level image mode for `harness.run` also ignores the image `ENTRYPOINT` as
the agent entrypoint. Dagu sets the selected provider binary as the container
entrypoint for that attempt.

Host-only runtime path variables such as `PWD`, `DAG_RUN_WORK_DIR`,
`DAG_RUN_LOG_FILE`, `DAG_RUN_ARTIFACTS_DIR`, and step stdout/stderr log paths
are not exposed to the shared-container harness process as container-local
paths. Pass container-visible paths explicitly through `container.env` when the
agent needs them.

## Supported Providers

Containerized harness execution is for CLI providers:

- built-in CLI providers such as `claude`, `codex`, `copilot`, `opencode`, and `pi`
- custom harness definitions under top-level `harnesses:`

`provider: builtin` is not supported with root-level or step-level
`container:` because it runs Dagu's in-process agent, not an external CLI
binary. If a fallback list starts with `provider: builtin`, Dagu can continue to
a later CLI provider attempt. If the selected compatible attempt is still
`builtin`, the harness step fails instead of leaving the container sandbox.

The containerized path also does not support stdin-based input. Do not combine
`container:` with:

- `script:`
- `with.stdin`
- a custom harness definition that uses `prompt_mode: stdin`

Use a provider that accepts the prompt as command arguments, or wrap the agent
with a CLI that reads its prompt from argv or flags.

## Runtime Selection

Dagu uses the same container runtime selection for containerized harness steps
as it uses for root-level and step-level container execution. There is no
per-DAG `container.runtime` field and Dagu does not auto-detect Docker vs
Podman for a workflow.

| Setting | Meaning |
|---------|---------|
| unset or `DAGU_CONTAINER_RUNTIME=docker` | use Docker through the normal Moby client environment |
| `DAGU_CONTAINER_RUNTIME=podman` | use Podman's Docker-compatible API |
| `DAGU_PODMAN_HOST=...` | override the Podman Docker-compatible API socket |

Runtime selection is a service-level setting. It is read from the Dagu engine
process environment, not from DAG-level or step-level `env:` entries. A workflow
cannot switch the daemon socket by setting `DAGU_CONTAINER_RUNTIME` inside the
DAG YAML. Set these variables on the server, scheduler, worker, or CLI process
that executes the DAG run.

See:

- [Docker sandbox setup](./docker)
- [Podman sandbox setup](./podman)
- [Runner images](./images)

## Minimal Smoke Test

This smoke test verifies the root-level shared sandbox path without requiring a
real agent CLI. It defines a custom harness provider named `shell`, starts one
Alpine container for the DAG run, and runs the harness provider inside that
shared container.

```yaml
type: graph

container:
  image: alpine:3.20
  pull_policy: missing
  env:
    - SMOKE_TOKEN=container-env-ok

harnesses:
  shell:
    binary: sh
    prefix_args:
      - -c
    prompt_mode: arg

steps:
  - id: smoke
    action: harness.run
    with:
      provider: shell
      prompt: |
        set -eu
        echo "HARNESS_CONTAINER_SMOKE=ok"
        echo "SMOKE_TOKEN=$SMOKE_TOKEN"
        echo "ALPINE_RELEASE=$(cat /etc/alpine-release)"
```

Expected output includes:

```text
HARNESS_CONTAINER_SMOKE=ok
SMOKE_TOKEN=container-env-ok
ALPINE_RELEASE=...
```

For a per-attempt smoke test, move the `container:` block from the root level
onto the `smoke` step.
