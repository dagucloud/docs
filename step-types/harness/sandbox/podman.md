# Harness Sandbox with Podman

Dagu can run root-level and step-level harness containers with Podman by
connecting the Moby SDK client to Podman's Docker-compatible API socket. Dagu
does not shell out to the `podman` CLI for each step.

Podman is useful when a deployment prefers rootless containers or already uses
Podman/Podman Compose for local or self-hosted execution.

The same Podman connection is used for root-level `container:`, step-level
`container:`, `docker.run`, and containerized `harness.run` steps.

## Service Environment

Set these variables on the Dagu server, scheduler, worker, or one-off CLI
process that executes the DAG run:

```sh
DAGU_CONTAINER_RUNTIME=podman
DAGU_PODMAN_HOST=unix:///path/to/podman.sock
```

| Variable | Required | Meaning |
|----------|----------|---------|
| `DAGU_CONTAINER_RUNTIME` | yes | Set to `podman` to select Podman's Docker-compatible API |
| `DAGU_PODMAN_HOST` | often | Docker-compatible Podman API socket Dagu should connect to |

If `DAGU_PODMAN_HOST` is unset, Dagu uses:

```text
unix:///run/podman/podman.sock
```

That default is suitable for many rootful Linux Podman installations. Rootless
Linux and macOS usually need `DAGU_PODMAN_HOST`.

Runtime selection is read from the Dagu process environment only. A DAG-level or
step-level `env:` entry cannot switch Dagu from Docker to Podman or redirect the
daemon socket. There is no `container.runtime` field in DAG YAML.

## Linux Rootful Podman

Enable Podman's system socket:

```sh
sudo systemctl enable --now podman.socket
```

The default socket is usually:

```text
unix:///run/podman/podman.sock
```

With that socket, this is enough:

```sh
DAGU_CONTAINER_RUNTIME=podman
```

If Dagu runs as a systemd service, put the environment variable in that service
unit or an environment file used by the unit.

## Linux Rootless Podman

Enable the user socket:

```sh
systemctl --user enable --now podman.socket
```

The rootless socket is usually under the user's runtime directory:

```text
unix:///run/user/1000/podman/podman.sock
```

Set both variables for the Dagu process:

```sh
DAGU_CONTAINER_RUNTIME=podman
DAGU_PODMAN_HOST=unix:///run/user/1000/podman/podman.sock
```

Replace `1000` with the UID of the user running Dagu. If Dagu runs as a user
systemd service and should keep working after logout, enable lingering for that
user:

```sh
loginctl enable-linger "$USER"
```

If Dagu itself runs inside a container, mount the socket into the Dagu container
and set `DAGU_PODMAN_HOST` to the path as seen inside that container:

```yaml
services:
  dagu:
    image: ghcr.io/dagu-org/dagu:latest
    ports:
      - "8080:8080"
    volumes:
      - /run/user/1000/podman/podman.sock:/run/user/1000/podman/podman.sock
      - ./workflows:/var/lib/dagu/dags
    environment:
      DAGU_CONTAINER_RUNTIME: podman
      DAGU_PODMAN_HOST: unix:///run/user/1000/podman/podman.sock
    command: ["dagu", "start-all"]
```

## macOS Podman Machine

On macOS, Podman usually runs inside a Podman machine. Start it first:

```sh
podman machine start
```

Find the forwarded Docker-compatible API socket:

```sh
podman machine inspect
```

Look for:

```json
{
  "ConnectionInfo": {
    "PodmanSocket": {
      "Path": "/var/folders/.../podman/podman-machine-default-api.sock"
    }
  }
}
```

Then set:

```sh
DAGU_CONTAINER_RUNTIME=podman
DAGU_PODMAN_HOST=unix:///var/folders/.../podman/podman-machine-default-api.sock
```

The exact `/var/folders/...` path is local to the macOS user session. Do not
copy the example path literally.

You can also print just the socket path for the default machine:

```sh
podman machine inspect --format '{{ .ConnectionInfo.PodmanSocket.Path }}'
```

When the Podman machine is recreated or its forwarded port changes, refresh
`DAGU_PODMAN_HOST` before starting Dagu.

## Verify the Socket

Before running a harness DAG, verify that the Dagu process can reach the same
socket:

```sh
export DAGU_CONTAINER_RUNTIME=podman
export DAGU_PODMAN_HOST=unix:///run/user/1000/podman/podman.sock

podman --url "$DAGU_PODMAN_HOST" ps
dagu start-all
```

On macOS, use the socket path from `podman machine inspect`. The `podman --url`
check is only a connectivity check; Dagu still uses the Docker-compatible API
through the Moby SDK when it runs the workflow.

## Docker Environment Isolation

When `DAGU_CONTAINER_RUNTIME=podman`, Dagu uses `DAGU_PODMAN_HOST` or the
Podman default socket. It does not let `DOCKER_HOST` override that selected
Podman socket.

This prevents a stale Docker environment from redirecting Podman-mode harness
steps to a different daemon. `DOCKER_API_VERSION` is still honored by the Moby
client for API version negotiation.

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

Root-level `container.env` is shared by the ordinary command steps in the same
container. Use this shape only when every step in the shared sandbox is trusted
to receive `CODEX_API_KEY`.

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

The DAG YAML is the same as the Docker version. The runtime is selected by the
Dagu service environment, not by a `container.runtime` field.

To use a ChatGPT subscription login instead of `CODEX_API_KEY`, mount the
worker's file-backed Codex home into the runner container and set `CODEX_HOME`.
See [Use Your ChatGPT Subscription Login](./images#use-your-chatgpt-subscription-login).

The image must exist in Podman's image store or `pull_policy` must allow Dagu to
pull it through Podman. Docker and Podman do not necessarily share local image
stores.

## Smoke Test

Use the smoke test from [Harness Sandboxed Execution](./) to verify that Dagu
can create and remove a container through Podman's Docker-compatible API.

For a local smoke test that must use an already-present image:

```yaml
container:
  image: alpine:3.20
  pull_policy: never
```

If the image is missing from Podman's image store, pull it into Podman first or
use `pull_policy: missing`.

## Troubleshooting

| Symptom | Check |
|---------|-------|
| `Cannot connect to Podman` | Podman socket is active and reachable from the Dagu process |
| connection refused on macOS | `podman machine start` is running and `DAGU_PODMAN_HOST` points at the current machine socket |
| image not known | image exists in Podman's image store or `pull_policy` allows pulling |
| permission denied on socket | Dagu process user has access to the Podman socket |
| workflow still uses Docker | `DAGU_CONTAINER_RUNTIME=podman` is set on the Dagu process, not inside DAG YAML |
| `DOCKER_HOST` points at Docker | expected; Podman mode ignores `DOCKER_HOST` for daemon selection |
| agent binary not found | runner image contains the selected provider binary in `PATH` |
