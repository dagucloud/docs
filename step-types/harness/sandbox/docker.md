# Harness Sandbox with Docker

Docker is the default runtime for containerized harness execution. If
`DAGU_CONTAINER_RUNTIME` is unset or set to `docker`, Dagu creates the Moby SDK
client from the normal Docker environment.

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

This setting is optional. When the runtime is Docker, Dagu leaves the daemon
host empty and lets the Moby client use the standard Docker environment:

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

## Root-Level Shared Sandbox

Use root-level `container:` when ordinary steps and `harness.run` should share
one workflow sandbox:

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
  - id: test
    run: npm test

  - id: review
    action: harness.run
    with:
      provider: codex
      prompt: |
        Review this repository and report the highest-risk issues.
```

The shared container is started once for the DAG run. The `test` step and the
`review` harness provider both execute inside that same container. The image
therefore needs `npm`, the `codex` binary, and any other tools the workflow
expects.

Because root-level `container.env` is shared by the ordinary command steps too,
do not pass `CODEX_API_KEY` this way when repository-controlled commands should
not see it. Use the step-level shape below for that case.

## Step-Level Per-Attempt Sandbox

Use step-level `container:` when the harness attempt should get its own
container:

```yaml
steps:
  - id: review
    action: harness.run
    container:
      image: dagu-codex-runner:local
      pull_policy: never
      working_dir: /workspace
      volumes:
        - .:/workspace:ro
      env:
        - CODEX_API_KEY=${CODEX_API_KEY}
    with:
      provider: codex
      prompt: |
        Review this repository and report the highest-risk issues.
```

The runner image must include the `codex` binary. The repository is mounted
read-only, so the agent can inspect the workspace but cannot edit files through
that mount.

To use a ChatGPT subscription login instead of `CODEX_API_KEY`, mount the
worker's file-backed Codex home into the runner container and set `CODEX_HOME`.
See [Use Your ChatGPT Subscription Login](./images#use-your-chatgpt-subscription-login).

For implementation tasks, mount the workspace read-write:

```yaml
volumes:
  - .:/workspace
```

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

## Isolation Tips

- Use image mode for most sandboxes so each harness attempt starts from a clean image.
- Mount only the directories the agent needs.
- Prefer read-only mounts for review-only tasks.
- Pass only the credentials needed for that provider and task.
- Avoid mounting `/var/run/docker.sock` into the runner image unless the agent is expected to manage containers.
- Use `network: none` only for providers or smoke tests that do not need network
  access. API-backed providers such as Codex need network access for real
  `codex exec` runs.

```yaml
harnesses:
  shell:
    binary: sh
    prefix_args:
      - -c
    prompt_mode: arg

steps:
  - id: offline_workspace_check
    action: harness.run
    container:
      image: alpine:3.20
      pull_policy: missing
      network: none
      working_dir: /workspace
      volumes:
        - .:/workspace:ro
    with:
      provider: shell
      prompt: |
        set -eu
        test -f /etc/alpine-release
        find . -maxdepth 2 -type f | head
```

## Smoke Test

Use the smoke test from [Harness Sandboxed Execution](./) to verify Docker
runtime plumbing before introducing a real agent image.

If the image is already present locally and the test should not pull from a
registry, set:

```yaml
container:
  image: alpine:3.20
  pull_policy: never
```

## Troubleshooting

| Symptom | Check |
|---------|-------|
| cannot connect to Docker daemon | the Dagu process can reach the Docker socket or `DOCKER_HOST` |
| workflow unexpectedly uses Podman | unset `DAGU_CONTAINER_RUNTIME` or set it to `docker` on the Dagu process |
| image not found | image name, registry access, and `pull_policy` |
| agent binary not found | the runner image contains the selected provider binary in `PATH` |
| permission denied on workspace | volume mode, container user, and file ownership |
| no network access | `container.network` and daemon network policy |
