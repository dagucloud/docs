# Install with Docker

Run Dagu in Docker and keep your workflows, history, logs, and settings on a host volume.

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
      - DAGU_HOME=/dagu       # optional
      - PUID=1000             # optional, default 1000
      - PGID=1000             # optional, default 1000
    volumes:
      - dagu:/var/lib/dagu
volumes:
  dagu: {}
```

Start with `docker compose up -d`.

## Giving DAGs access to the host Docker daemon

Use this layout when workflows run the `docker` / `container` step type and should reuse the host's Docker engine:

```yaml
services:
  dagu:
    image: ghcr.io/dagucloud/dagu:latest
    ports:
      - "8080:8080"
    volumes:
      - dagu:/var/lib/dagu
      - /var/run/docker.sock:/var/run/docker.sock
    entrypoint: []   # override default entrypoint
    user: "0:0"      # root is needed for socket access
volumes:
  dagu: {}
```

::: warning Security
Mounting `/var/run/docker.sock` grants the container full control of the host Docker daemon. Only do this on trusted hosts and behind authentication.
:::

## Image tags

| Tag | Contents |
|---|---|
| `latest` | Latest stable release |
| `vX.Y.Z` | Specific release |
| `<tag>-full` | Includes sudo, common CLI tools (useful when DAG steps need them) |

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
