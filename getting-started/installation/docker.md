---
description: Run Dagu with Docker or Docker Compose and persist workflows, history, logs, and settings on a host volume.
---

# Install with Docker

Run Dagu in Docker and keep your workflows, history, logs, and settings on a host volume.

::: tip Choose the required access
The standard commands below run shell and built-in steps without exposing the
host Docker daemon. If a workflow uses `container:`, `action: docker.run`, or a
containerized `harness.run`, use
[Run container steps when Dagu runs in Docker](#run-container-steps-when-dagu-runs-in-docker).
:::

## One-off run

```bash
docker run --rm \
  -p 8080:8080 \
  -v ~/.dagu:/var/lib/dagu \
  ghcr.io/dagucloud/dagu:latest \
  dagu start-all
```

Visit <http://localhost:8080>.

## Detached

```bash
docker run -d \
  --name dagu \
  -p 8080:8080 \
  -v ~/.dagu:/var/lib/dagu \
  ghcr.io/dagucloud/dagu:latest \
  dagu start-all
```

## Docker Compose

```yaml
services:
  dagu:
    image: ghcr.io/dagucloud/dagu:latest
    ports:
      - "8080:8080"
    environment:
      - DAGU_TZ=America/New_York
      - DAGU_PORT=8080        # optional, default 8080
      - PUID=1000             # optional, default 1000
      - PGID=1000             # optional, default 1000
    volumes:
      - dagu:/var/lib/dagu
volumes:
  dagu: {}
```

Start with `docker compose up -d`.

The image defaults `DAGU_HOME` to `/var/lib/dagu`, matching the volume mount. If `DAGU_HOME` is customized, mount the persistent volume at the same path and ensure it is writable by `PUID`/`PGID`.

Remote CLI contexts use the HTTP API exposed on port `8080`. Include the API path in the context URL:

```bash
dagu context add docker \
  --server http://docker-host:8080/api/v1 \
  --api-key dagu_xxxxxxxxxxxxxxxxxxxx
dagu context test docker
```

Coordinator port `50055` is unrelated to remote CLI contexts. Publish it only when `dagu worker` processes outside the Compose network need to connect.

## Run container steps when Dagu runs in Docker

Container steps need a Docker-compatible daemon. Mount the host socket into the
Dagu container so Dagu can create sibling containers through the host engine.

### Docker Run

```bash
docker run -d \
  --name dagu \
  -p 8080:8080 \
  -v dagu-data:/var/lib/dagu \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --user 0:0 \
  --entrypoint /usr/local/bin/tini \
  ghcr.io/dagucloud/dagu:latest \
  -g -- dagu start-all
```

The named data volume avoids creating root-owned files in a host directory.
Keep an existing data mount when converting an existing installation.

### Docker Compose

```yaml
services:
  dagu:
    image: ghcr.io/dagucloud/dagu:latest
    ports:
      - "8080:8080"
    volumes:
      - dagu-data:/var/lib/dagu
      - /var/run/docker.sock:/var/run/docker.sock
    entrypoint: ["/usr/local/bin/tini", "-g", "--"]
    command: ["dagu", "start-all"]
    user: "0:0"
volumes:
  dagu-data: {}
```

Both examples bypass `/entrypoint.sh` so Dagu runs as root regardless of the
socket's group ownership. Tini remains PID 1 for signal forwarding and process
reaping. Docker is the default runtime; `DAGU_CONTAINER_RUNTIME=docker` is not
required.

For a remote daemon, omit the socket mount and configure `DOCKER_HOST` and any
required Docker TLS variables on the Dagu container. In distributed setups,
configure daemon access on every worker that can receive container steps. See
[Docker](/step-types/docker#docker-daemon-access).

::: warning Security
Mounting `/var/run/docker.sock` grants workflows control of the host Docker
daemon, including the ability to mount host files or start privileged
containers. Use it only for trusted workflows on an authenticated Dagu server.
:::

For AI and coding-agent CLI sandboxes, see
[Harness Sandboxed Execution](/step-types/harness/sandbox/).

## Image tags

| Tag | Contents |
|---|---|
| `latest` | Latest stable release |
| `<version>` | Specific release, such as `2.11.1` |
| `alpine`, `<version>-alpine` | Alpine-based runtime image |
| `dev`, `<version>-dev` | Development image with compilers, SDKs, common CLI tools, and Chromium for [browser steps](/step-types/browser) (amd64 and arm64; see [Docker Images](/server-admin/deployment/docker-images) for the run options) |

Full list: [Docker Images](/server-admin/deployment/docker-images).

## Running one-off DAG commands

```bash
# Validate
docker run --rm -v ~/.dagu:/var/lib/dagu ghcr.io/dagucloud/dagu:latest \
  dagu validate hello

# Start
docker run --rm -v ~/.dagu:/var/lib/dagu ghcr.io/dagucloud/dagu:latest \
  dagu start hello

# History
docker run --rm -v ~/.dagu:/var/lib/dagu ghcr.io/dagucloud/dagu:latest \
  dagu history hello
```

## Verify

```bash
docker exec dagu dagu version
```

Next: [Quickstart](/getting-started/quickstart).
