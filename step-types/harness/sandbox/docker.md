# Harness Sandbox with Docker

Docker is the default runtime for containerized harness execution. If
`DAGU_CONTAINER_RUNTIME` is unset or set to `docker`, Dagu uses the Docker
environment available to the Dagu process.

The same Docker connection is used for root-level `container:`, step-level
`container:`, `docker.run`, and containerized `harness.run` steps.

## Requirements

The Dagu server, scheduler, or worker process that executes the step must be
able to reach a Docker daemon.

Common setups:

| Setup | Configuration |
|-------|---------------|
| Local Docker Desktop | no Dagu-specific runtime setting |
| Remote Docker daemon | set Docker client environment such as `DOCKER_HOST` |
| Dagu running in a container | mount the Docker socket into the Dagu container |

Docker daemon access is powerful. A workflow that can control containers can
often access host files or start privileged workloads, depending on daemon
policy. Only expose the Docker daemon to trusted Dagu workers and workflows.

## Service Environment

Docker is selected by default:

```sh
DAGU_CONTAINER_RUNTIME=docker
```

This setting is optional. When the runtime is Docker, Dagu uses the standard
Docker environment:

| Variable | Meaning |
|----------|---------|
| `DOCKER_HOST` | Docker daemon endpoint, for example a local socket or remote TCP endpoint |
| `DOCKER_CERT_PATH` | TLS certificate directory for a TLS Docker daemon |
| `DOCKER_TLS_VERIFY` | Enable Docker daemon TLS verification |
| `DOCKER_API_VERSION` | Optional Docker API version override |

Do not put `DAGU_CONTAINER_RUNTIME` in DAG YAML. Runtime selection is read from
the Dagu process environment only. Set it on the process that actually executes
the run: server, scheduler, worker, or one-off CLI command.

Examples:

```sh
# Local default Docker context
dagu start-all

# Explicit Docker runtime
DAGU_CONTAINER_RUNTIME=docker dagu start-all

# Remote Docker daemon
DOCKER_HOST=tcp://docker.example.com:2375 dagu start-all
```

## Root-Level Shared Container

Use root-level `container:` when ordinary steps and `harness.run` should share
one workflow container:

```yaml
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

Both steps run inside the same container. The file written by `write_file` is
visible to `read_file`.

If root-level `container.env` contains credentials, every inherited step inside
the shared container can read them.

## Step-Level Container

Use step-level `container:` when the harness attempt should get its own image,
mounts, and environment:

```yaml
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

For a real provider, use a runner image that contains the provider binary and
pass the provider credential with `container.env` or a mounted credentials
directory.

Provider-specific examples:

- [Codex](./codex)
- [Claude Code](./claude-code)
- [OpenCode](./opencode)

## Dagu in Docker

When Dagu itself runs inside Docker, the Docker socket must be mounted into the
Dagu container if harness steps should create sibling containers:

```yaml
services:
  dagu:
    image: ghcr.io/dagu-org/dagu:latest
    ports:
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./workflows:/var/lib/dagu/dags
    environment:
      DAGU_CONTAINER_RUNTIME: docker
    command: ["dagu", "start-all"]
```

Mounting the Docker socket gives the Dagu container control over the Docker
daemon. Use this only for trusted deployments.

The runner container created for a harness step does not need the Docker socket
unless the agent itself should manage containers. Most harness runner images
should receive only the workspace mount and provider credentials.

## Network Access

Hosted agent CLIs such as Codex, Claude Code, and OpenCode usually need
outbound network access to reach their provider APIs. Do not set
`network: none` for those providers unless the CLI is configured to use a local
endpoint available inside the container.

If a harness step needs restricted egress, configure that restriction outside
Dagu with Docker networks, daemon policy, firewall rules, or an outbound proxy.
Then attach the harness container to the network or proxy environment that
provides the intended access.

## Pull Policy

If an image is already present locally and the DAG must not pull from a
registry, set `pull_policy: never`:

```yaml
container:
  image: alpine:3.20
  pull_policy: never
```

## Runtime Checks

| Symptom | Check |
|---------|-------|
| cannot connect to Docker daemon | the Dagu process can reach the Docker socket or `DOCKER_HOST` |
| workflow unexpectedly uses Podman | unset `DAGU_CONTAINER_RUNTIME` or set it to `docker` on the Dagu process |
| image not found | image name, registry access, and `pull_policy` |
| agent binary not found | the runner image contains the selected provider binary in `PATH` |
| permission denied on workspace | volume mode, container user, and file ownership |
| no network access | `container.network` and external daemon, firewall, or proxy configuration |
