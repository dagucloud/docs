# Docker

Run workflow steps in Docker containers for isolated, reproducible execution.

::: warning Docker runtime required
Docker-based step execution requires access to a Docker daemon through a local
Docker socket or a remote daemon such as `DOCKER_HOST`.

Dagu Cloud managed instances run on GKE with gVisor isolation and do not expose
a Docker daemon or Docker socket. Docker actions are not supported inside
managed instances. Use self-hosted Dagu, or route the workflow to a self-hosted
worker, when a workflow needs Docker step execution.
:::

The `container` field supports two modes:
- **Image mode**: Create a new container from a Docker image
- **Exec mode**: Execute commands in an already-running container

## DAG-Level Container

### Image Mode (Create New Container)

Use the `container` field at the DAG level to run all steps in a shared container:

```yaml
# All steps run in this container
container:
  image: python:3.11
  volumes:
    - ./data:/data
  env:
    - PYTHONPATH=/app

steps:
  - id: install
    run: pip install -r requirements.txt
  - id: process
    run: python process.py /data/input.csv
    depends: install
```

### Exec Mode (Use Existing Container)

Execute commands in a container that's already running (e.g., started by Docker Compose):

```yaml
# Simple string form - use container's default settings
container: my-app-container

steps:
  - id: migrate
    run: php artisan migrate
  - id: clear_cache
    run: php artisan cache:clear
    depends: migrate
```

```yaml
# Object form with overrides
container:
  exec: my-app-container
  user: root
  working_dir: /var/www
  env:
    - APP_DEBUG=true

steps:
  - id: install
    run: composer install
  - id: optimize
    run: php artisan optimize
    depends: install
```

Exec mode is useful when:
- Your application runs in containers managed by Docker Compose
- You need to run maintenance commands in service containers
- Development workflows where containers are already running

## Step-Level Container

### Image Mode

Use the `container` field directly on a step for per-step container configuration:

```yaml
steps:
  - id: build
    container:
      image: golang:1.22
      working_dir: /app
      volumes:
        - ./src:/app
    run: go build -o /app/bin/myapp

  - id: test
    container:
      image: golang:1.22
      working_dir: /app
      volumes:
        - ./src:/app
    run: go test ./...
    depends:
      - build
```

### Exec Mode

Steps can also exec into existing containers:

```yaml
steps:
  # String form
  - id: run_migration
    container: my-database-container
    run: psql -c "SELECT 1"

  # Object form with overrides
  - id: admin_task
    container:
      exec: my-app-container
      user: root
    run: chown -R app:app /data
```

### Mixed Mode Example

Combine exec and image modes in the same workflow:

```yaml
steps:
  # Exec into existing app container
  - id: prepare_app
    container: my-app
    run: php artisan down

  # Run migrations in a fresh container
  - id: migrate
    container:
      image: my-app:latest
      volumes:
        - ./migrations:/migrations
    run: php artisan migrate --force
    depends: prepare_app

  # Exec back into the app container
  - id: restart_app
    container: my-app
    run: php artisan up
    depends: migrate
```

### Configuration Options

The `container` field accepts a string (exec mode) or object (exec or image mode).

#### String Form (Exec Mode)

```yaml
container: my-running-container  # Exec into existing container
```

#### Object Form - Image Mode

```yaml
container:
  image: alpine:latest        # Required: container image
  name: my-container          # Optional: custom container name
  pull_policy: missing         # always | missing | never
  working_dir: /app            # Working directory inside the container
  user: "1000:1000"           # User and group
  platform: linux/amd64       # Target platform
  env:
    - MY_VAR=value
    - API_KEY=${API_KEY}      # From host environment
  volumes:
    - ./data:/data            # Bind mount
    - /host/path:/container/path:ro
  ports:
    - "8080:8080"
  network: bridge
  keep_container: true         # Keep container after workflow (DAG-level only)
```

#### Object Form - Exec Mode

```yaml
container:
  exec: my-running-container  # Required: name of existing container
  user: root                  # Optional: override user
  working_dir: /app            # Optional: override working directory
  env:                        # Optional: additional environment variables
    - DEBUG=true
```

#### Field Availability

| Field | Exec Mode | Image Mode |
|-------|-----------|------------|
| `exec` | **Required** | Not allowed |
| `image` | Not allowed | **Required** |
| `user` | Optional | Optional |
| `working_dir` | Optional | Optional |
| `env` | Optional | Optional |
| `name` | Not allowed | Optional |
| `pull_policy` | Not allowed | Optional |
| `volumes` | Not allowed | Optional |
| `ports` | Not allowed | Optional |
| `network` | Not allowed | Optional |
| `platform` | Not allowed | Optional |
| `keep_container` | Not allowed | Optional |

### Step Container Overrides DAG Container

When a step has its own `container` field, it runs in that container instead of the DAG-level container:

```yaml
# DAG-level container for most steps
container:
  image: node:20
  working_dir: /app

steps:
  - id: install
    run: npm install
    # Uses DAG-level node:20 container

  - id: deploy
    container:
      image: google/cloud-sdk:latest  # Uses its own container
      env:
        - GOOGLE_APPLICATION_CREDENTIALS=/secrets/gcp.json
    run: gcloud app deploy
    depends: install
```

## Executor `with` Syntax

For advanced use cases, use `action: docker.run` with a `with` block. This provides access to Docker SDK options:

```yaml
steps:
  - id: run_in_docker
    action: docker.run
    with:
      image: alpine:3
      auto_remove: true
      working_dir: /app
      volumes:
        - /host:/container
      command: pwd
```

### Advanced Docker SDK Options

Pass Docker SDK configuration directly via `container`, `host`, and `network` fields:

```yaml
steps:
  - id: with_resource_limits
    action: docker.run
    with:
      image: alpine:3
      auto_remove: true
      host:
        Memory: 536870912    # 512MB in bytes
        CPUShares: 512
      command: echo "limited resources"
```

## Validation and Errors

### Common Rules

- **Mutual exclusivity**: `exec` and `image` are mutually exclusive; specifying both causes an error.
- **Required field**: Either `exec` or `image` must be specified (or use string form for exec).

### Image Mode

- **Required fields**: `container.image` is required.
- **Container name**: Must be unique. If a container with the same name already exists (running or stopped), the DAG fails.
- **Volume format**: `source:target[:ro|rw]`
  - `source` may be absolute, relative to DAG working_dir (`.` or `./...`), or `~`-expanded; otherwise it is treated as a named volume.
  - Only `ro` or `rw` are valid modes.
- **Port format**: `"80"`, `"8080:80"`, `"127.0.0.1:8080:80"`, optional protocol: `80/tcp|udp|sctp` (default tcp).
- **Network**: Accepts `bridge`, `host`, `none`, `container:<name|id>`, or a custom network name.
- **Restart policy** (DAG-level): `no`, `always`, `unless-stopped`.
- **Platform**: `linux/amd64`, `linux/arm64`, etc.

### Exec Mode

- **Container must exist**: The specified container must exist and be running. Dagu waits up to 120 seconds for the container to be in running state.
- **Invalid fields**: Fields like `volumes`, `ports`, `network`, `pull_policy`, `name`, etc. cannot be used with `exec` and will cause validation errors.
- **Allowed overrides**: Only `user`, `working_dir`, and `env` can be specified to override the container's defaults.

### DAG-Level Startup Options

For DAG-level containers, additional startup options are available:

- `startup`: `keepalive` (default), `entrypoint`, `command`
- `wait_for`: `running` (default) or `healthy`
- `log_pattern`: regex pattern for readiness detection

```yaml
# Startup: entrypoint - uses image's default entrypoint
container:
  image: nginx:alpine
  startup: entrypoint
  wait_for: healthy

steps:
  - run: curl localhost
```

```yaml
# Startup: command - run custom startup command
container:
  image: alpine:3
  startup: command
  command: ["sh", "-c", "while true; do sleep 3600; done"]

steps:
  - run: echo "container running with custom command"
```

```yaml
# With log_pattern - wait for specific log output
container:
  image: postgres:15
  startup: entrypoint
  log_pattern: "ready to accept connections"
  env:
    - POSTGRES_PASSWORD=secret

steps:
  - run: psql -U postgres -c "SELECT 1"
```

## How Commands Execute

### DAG-Level Container

When using a DAG-level `container`, Dagu starts a single persistent container and executes each step inside it using `docker exec`:

- Step commands run directly in the running container
- The image's `ENTRYPOINT`/`CMD` are not invoked for step commands
- If your image's entrypoint is a dispatcher, call it explicitly in your step command

```yaml
container:
  image: myorg/myimage:latest

steps:
  # Runs inside the already-running container via `docker exec`
  - run: my-entrypoint sendConfirmationEmails
```

### Step-Level Container

When using step-level `container`, each step creates its own container:

- Each step runs in a fresh container
- The container is automatically removed after the step completes
- The image's `ENTRYPOINT`/`CMD` behavior depends on your command

### Multiple Commands in Containers

Multiple commands share the same step configuration, including the container config:

```yaml
steps:
  - id: build_and_test
    container:
      image: node:20
      volumes:
        - ./src:/app
      working_dir: /app
    run:
      - npm install
      - npm run build
      - npm test
```

Instead of duplicating the `container`, `env`, `retry_policy`, `preconditions`, etc. across multiple steps, combine commands into one step. All commands run in the same container instance, sharing the filesystem state (e.g., `node_modules` from `npm install`).

## Variable Expansion

Use `${VAR}` syntax in container fields to expand DAG-level environment variables:

```yaml
env:
  - IMAGE_TAG: "3.18"
  - VOLUME_PATH: /data

container:
  image: alpine:${IMAGE_TAG}
  volumes:
    - ${VOLUME_PATH}:/mnt

steps:
  - run: cat /etc/alpine-release
```

::: tip OS Variables
OS environment variables not defined in the DAG `env:` block (like `$HOME`, `$PATH`)
are **not** expanded by Dagu. They pass through to the container as-is. To use a local
OS value, explicitly import it in the DAG-level `env:` block:

```yaml
env:
  - HOST_HOME: ${HOME}  # Import local $HOME into DAG scope
```
:::

::: tip Literal Dollar Signs
To emit a literal `$` in non-shell container commands or `with` fields, escape it as `\$`.
If you configure `container.shell`, Dagu leaves `\$` intact and the shell handles the escape.
:::

## Output Handling

Capture step output to variables or redirect to files:

```yaml
steps:
  # Capture small output to variable
  - id: get_version
    container:
      image: alpine:3
    run: cat /etc/alpine-release
    output: ALPINE_VERSION

  # Stream large output to a run artifact
  - id: process_data
    container:
      image: alpine:3
    run: tar -tvf /data/archive.tar
    stdout:
      artifact: reports/archive-listing.txt
```

## Registry Authentication

Access private container registries with authentication configured at the DAG level.

`${VAR}` references in `registry_auths` fields expand only DAG-scoped variables (`env:`, `params:`, `secrets:`, step outputs). OS environment variables are **not** expanded — define them in the `env:` block first.

```yaml
registry_auths:
  docker.io:
    username: ${DOCKER_USERNAME}
    password: ${DOCKER_PASSWORD}
  ghcr.io:
    username: ${GITHUB_USER}
    password: ${GITHUB_TOKEN}

container:
  image: ghcr.io/myorg/private-app:latest

steps:
  - run: python process.py
```

### Authentication Methods

**Structured format:**

```yaml
registry_auths:
  docker.io:
    username: ${DOCKER_USERNAME}
    password: ${DOCKER_PASSWORD}
```

**Pre-encoded authentication:**

```yaml
registry_auths:
  gcr.io:
    auth: ${GCR_AUTH_BASE64}  # base64(username:password)
```

**Environment variable:**

```yaml
registry_auths: ${DOCKER_AUTH_CONFIG}
```

The `DOCKER_AUTH_CONFIG` format is compatible with Docker's `~/.docker/config.json`.

### Authentication Priority

1. **DAG-level `registry_auths`** - Configured in your DAG file
2. **`DOCKER_AUTH_CONFIG` environment variable** - Standard Docker authentication
3. **No authentication** - For public registries

### Example: Multi-Registry Workflow

```yaml
registry_auths:
  docker.io:
    username: ${DOCKERHUB_USER}
    password: ${DOCKERHUB_TOKEN}
  ghcr.io:
    username: ${GITHUB_USER}
    password: ${GITHUB_TOKEN}

steps:
  - id: process
    container:
      image: myorg/processor:latest  # from Docker Hub
    run: process-data

  - id: analyze
    container:
      image: ghcr.io/myorg/analyzer:v2  # from GitHub
    run: analyze-results
    depends: process
```

## Remote Docker Daemon

The Docker daemon connection variables `DOCKER_HOST`, `DOCKER_TLS_VERIFY`, `DOCKER_CERT_PATH`, and `DOCKER_API_VERSION` are included in Dagu's environment whitelist. They are automatically passed through to step processes and sub-DAGs without needing to redeclare them in `env:`.

This means Docker steps connect to the correct daemon when these variables are set in the Dagu process environment:

```bash
# Start Dagu pointing at a remote Docker daemon
DOCKER_HOST=tcp://build-server:2375 dagu start-all
```

All `container:` steps and `action: docker.run` steps will use the remote daemon automatically.

> **Note:** `DOCKER_AUTH_CONFIG` is **not** whitelisted — it may contain credentials. Use `registry_auths:` in the DAG file or reference it explicitly via `env:` or `secrets:` if needed.

## Docker in Docker

Mount the Docker socket and run as root to use Docker inside your containers:

```yaml
# compose.yml for Dagu with Docker support
services:
  dagu:
    image: ghcr.io/dagucloud/dagu:latest
    ports:
      - 8080:8080
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./dags:/var/lib/dagu/dags
    entrypoint: ["/usr/local/bin/tini", "-g", "--"]
    command: ["dagu", "start-all"]
    user: "0:0"  # Run as root for Docker access
```

This bypasses `/entrypoint.sh` so Dagu can run as root for Docker socket access, but it keeps Tini as PID 1. Do not use `entrypoint: []`; that removes process reaping.

## Container Lifecycle Management

The `keep_container` option (DAG-level only) prevents the container from being removed after the workflow completes:

```yaml
container:
  image: postgres:16
  keep_container: true
  env:
    - POSTGRES_PASSWORD=secret
  ports:
    - "5432:5432"
```

## Platform-Specific Builds

```yaml
steps:
  - id: build_amd64
    container:
      image: golang:1.22
      platform: linux/amd64
    run: go build -o app-amd64

  - id: build_arm64
    container:
      image: golang:1.22
      platform: linux/arm64
    run: go build -o app-arm64
```

## Fan-Out: Running Across Multiple Configurations

To run the same container task across multiple images or configurations in parallel, use `parallel.items` with a sub-DAG. Each item gets its own run with separate logs, status, and retry tracking.

```yaml
# test-matrix.yaml
steps:
  - name: test-all-versions
    parallel:
      items:
        - python:3.10
        - python:3.11
        - python:3.12
      max_concurrent: 2
    action: dag.run
    with:
      dag: run-tests
      params:
        IMAGE: ${ITEM}
---
name: run-tests

params:
  - IMAGE: ""

steps:
  - name: test
    container:
      image: ${IMAGE}
    run: python -m pytest tests/
```

For object items (e.g., different image and platform per run), use `${ITEM.field}` references:

```yaml
steps:
  - name: build-targets
    parallel:
      items:
        - image: golang:1.22
          platform: linux/amd64
          output: app-amd64
        - image: golang:1.22
          platform: linux/arm64
          output: app-arm64
      max_concurrent: 2
    action: dag.run
    with:
      dag: build-target
      params:
        IMAGE: ${ITEM.image}
        PLATFORM: ${ITEM.platform}
        OUTPUT: ${ITEM.output}
---
name: build-target

params:
  - IMAGE: ""
  - PLATFORM: ""
  - OUTPUT: ""

steps:
  - name: build
    container:
      image: ${IMAGE}
      platform: ${PLATFORM}
    run: go build -o ${OUTPUT}
```

See [parallel.items](/writing-workflows/execution-control#parallel-execution) for full fan-out options.
