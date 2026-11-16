# Docker Compose

## Minimal Setup

```yaml
# compose.yaml
services:
  dagu:
    image: ghcr.io/dagucloud/dagu:latest
    container_name: dagu-dev
    hostname: dagu-dev

    # Expose the web UI on localhost:8080
    ports:
      - "8525:8080"

    # Default command: run all-in-one (server + scheduler + coordinator in-process)
    # You may override this at runtime, e.g.:
    #   docker compose -f compose.dev.yaml run --rm dagu dagu server
    command: ["dagu", "start-all"]

    # Recommended dev environment variables
    environment:
      # Frontend server
      - DAGU_HOST=0.0.0.0 # Bind inside container
      - DAGU_PORT=8080 # Web/UI port inside container
      - DAGU_DEBUG=true # More verbose logs during dev
      # Paths
      - DAGU_DAGS_DIR=/var/lib/dagu/dags
      # Builtin authentication (RBAC): default auth mode
      - DAGU_AUTH_MODE=builtin
      # Token secret: auto-generated if not set (persisted to {dataDir}/auth/token_secret)
      # - DAGU_AUTH_TOKEN_SECRET=your-secure-random-secret
      # - DAGU_AUTH_TOKEN_TTL=24h        # default: 24h; maximum: 8760h
      # Auto-create admin on first startup (both required; omit to use /setup page instead)
      # - DAGU_AUTH_BUILTIN_INITIAL_ADMIN_USERNAME=admin
      # - DAGU_AUTH_BUILTIN_INITIAL_ADMIN_PASSWORD=your-secure-password
      # Timezone / base path (optional)
      # - DAGU_TZ=UTC
      # - DAGU_BASE_PATH=/dagu
      # User and Group IDs (optional, for file permissions)
      # - PUID=1000 # optional. default is 1000
      # - PGID=1000 # optional. default is 1000

    # Dev-friendly mounts (persistent data + writable DAGs)
    volumes:
      - dagu-data:/var/lib/dagu
      - ./dags:/var/lib/dagu/dags

    # Quick command presets (uncomment any one to run specific component):
    # command: ["dagu", "server"]
    # command: ["dagu", "scheduler"]
    # command: ["dagu", "coordinator"]
    # command: ["dagu", "worker"]

    # Alternative: basic auth (simpler, no user management)
    # To use basic auth instead of builtin auth, change DAGU_AUTH_MODE above:
    #   - DAGU_AUTH_MODE=basic
    #   - DAGU_AUTH_BASIC_USERNAME=dev
    #   - DAGU_AUTH_BASIC_PASSWORD=devpass

volumes:
  dagu-data:
    driver: local

```

The image entrypoint keeps Tini as PID 1 and applies `PUID`/`PGID`. Override only
`command` for normal deployments.

The `./dags` mount is writable so Dagu can seed first-run examples and save DAG edits. Add `:ro` only when using immutable DAG sources.

This development example enables `DAGU_DEBUG=true`. When HTTP access logging is enabled, debug mode includes request headers and can produce large log entries. Remove that environment variable or set it to `false` when the extra diagnostic detail is not needed. HTTP access logs are disabled by default. To enable them, add:

```yaml
environment:
  - DAGU_ACCESS_LOG_MODE=all
```

See [Operations - Logging](/server-admin/operations#logging) for all access log modes and their behavior.

Start with:
```bash
docker compose up -d
```

## Run Container Steps

Use this smaller service definition when workflows use `container:`,
`action: docker.run`, or containerized `harness.run`:

```yaml
services:
  dagu:
    image: ghcr.io/dagucloud/dagu:latest
    ports:
      - "8525:8080"
    volumes:
      - dagu-data:/var/lib/dagu
      - /var/run/docker.sock:/var/run/docker.sock
    entrypoint: ["/usr/local/bin/tini", "-g", "--"]
    command: ["dagu", "start-all"]
    user: "0:0"

volumes:
  dagu-data: {}
```

This bypasses `/entrypoint.sh` so Dagu runs as root while Tini remains PID 1.
The socket grants workflows control of the host daemon. See
[Run container steps when Dagu runs in Docker](/getting-started/installation/docker#run-container-steps-when-dagu-runs-in-docker)
before enabling it.

## Let Runs Finish on Stop

Stopping the container, as `docker compose down` or an image update does, ends the DAG runs inside it. To let them finish first, set a drain timeout and a grace period longer than it:

```yaml
services:
  dagu:
    stop_grace_period: 6m
    environment:
      - DAGU_SIGNAL_DRAIN_TIMEOUT=5m
```

A stopping Dagu then starts no new runs and waits up to 5 minutes for the running ones. See [Graceful Shutdown](/server-admin/operations#graceful-shutdown).

## Commands

```bash
# Start services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down

# Stop and remove volumes
docker compose down -v

# Scale workers
docker compose up -d --scale dagu-worker=3
```

## Access

Open http://localhost:8525 in your browser.
