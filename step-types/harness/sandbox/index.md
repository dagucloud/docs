# Harness Sandboxed Execution

`action: harness.run` can run CLI providers inside a root-level or step-level
`container:`. The container controls the filesystem mounts, installed tools,
environment variables, network mode, user, and working directory available to
the provider process.

Without `container:`, a CLI harness provider runs as a process on the Dagu
worker. With `container:`, the provider binary must exist inside the configured
container image or existing container.

## Container Shapes

| Shape | Behavior |
|-------|----------|
| Root-level `container:` | Dagu starts or attaches to one shared container for the DAG run. Command steps and CLI-based `harness.run` steps inherit that container unless the step defines its own `container:`. |
| Step-level `container:` | The container applies only to that step. For image mode, Dagu creates a container for the harness attempt and removes it after the step unless `keep_container: true` is set. |

When a root-level `container:` is configured, `harness.run` does not fall back
to the host if the shared container cannot be used. The step fails.

Step-level `container:` overrides the root-level container for that harness
step. Without either container form, a CLI harness provider runs on the host.

## Root-Level Shared Container

Use root-level `container:` when command steps and harness steps should share
the same filesystem and toolchain.

```yaml
type: graph

container:
  image: alpine:3.20
  pull_policy: missing
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
  - id: write_file
    run: echo "from command step" > shared.txt

  - id: read_file
    action: harness.run
    with:
      provider: shell
      prompt: |
        set -eu
        cat shared.txt
        cat /etc/alpine-release
```

Both steps run inside the same shared container. The file written by
`write_file` is visible to `read_file`.

If the root-level container receives credentials through `container.env` or
mounted files, every inherited step inside that shared container can read them.

## Step-Level Container

Use step-level `container:` when one harness attempt should receive its own
container, mounts, and credentials.

```yaml
type: graph

harnesses:
  shell:
    binary: sh
    prefix_args:
      - -c
    prompt_mode: arg

steps:
  - id: inspect
    action: harness.run
    container:
      image: alpine:3.20
      pull_policy: missing
      working_dir: /workspace
      volumes:
        - .:/workspace:ro
    with:
      provider: shell
      prompt: |
        set -eu
        pwd
        find . -maxdepth 1 -type f | sort | head
```

Only the `inspect` step runs in this container.

## Existing Container

Both root-level and step-level `container:` can attach to an existing running
container:

```yaml
steps:
  - id: review
    action: harness.run
    container:
      exec: harness-sandbox
      working_dir: /workspace
    with:
      provider: your_provider
      prompt: |
        Review the current patch.
```

The provider binary must exist inside `harness-sandbox`.

## Volumes

Volume specs use `source:target[:ro|rw]`.

- Dagu expands `$VAR` and `${VAR}` only on the source side.
- The target path is passed to the container runtime as written.
- The optional mode is passed as written.
- Path-like sources become bind mounts.
- Non-path-like sources remain named volumes.
- A missing source-side environment variable fails the step before the
  container runtime is called.

Example:

```yaml
container:
  image: dagu-provider-runner:local
  volumes:
    - ${HOME}/.provider:/provider-home
    - provider-cache:/cache
```

If `provider-cache` is not path-like, it remains a named volume.

## Supported Providers

Containerized harness execution is for CLI providers:

- built-in CLI providers such as `claude`, `codex`, `copilot`, `opencode`, and
  `pi`
- custom providers under top-level `harnesses:`

The containerized path does not support stdin prompt input. Do not combine
`container:` with:

- `script:`
- `with.stdin`
- a custom provider that sets `prompt_mode: stdin`

Use `prompt_mode: arg` or `prompt_mode: flag` for custom providers that run in
containers.

## Runtime Selection

Dagu uses the same container runtime setting for root-level `container:`,
step-level `container:`, `docker.run`, and containerized `harness.run`.

There is no per-DAG `container.runtime` field and Dagu does not auto-detect
Docker versus Podman for a workflow.

| Setting | Meaning |
|---------|---------|
| unset or `DAGU_CONTAINER_RUNTIME=docker` | use Docker through the normal Docker client environment |
| `DAGU_CONTAINER_RUNTIME=podman` | use Podman's Docker-compatible API |
| `DAGU_PODMAN_HOST=...` | override the Podman Docker-compatible API socket |

Runtime selection is read from the process environment of the Dagu server,
scheduler, worker, or CLI process that executes the DAG run. Setting
`DAGU_CONTAINER_RUNTIME` inside DAG YAML does not change the runtime used for
that DAG.

## Pages

- [Docker](./docker)
- [Podman](./podman)
- [Runner images](./images)
- [Credentials](./credentials)
- [Codex](./codex)
- [Claude Code](./claude-code)
- [OpenCode](./opencode)
- [Custom CLI provider](./custom-provider)
