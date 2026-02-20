# Docker

Run workflow steps in Docker containers for isolated, reproducible execution.

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
  - command: pip install -r requirements.txt
  - command: python process.py /data/input.csv
```

### Exec Mode (Use Existing Container)

Execute commands in a container that's already running (e.g., started by Docker Compose):

```yaml
# Simple string form - use container's default settings
container: my-app-container

steps:
  - command: php artisan migrate
  - command: php artisan cache:clear
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
  - command: composer install
  - command: php artisan optimize
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
  - name: build
    container:
      image: golang:1.22
      working_dir: /app
      volumes:
        - ./src:/app
    command: go build -o /app/bin/myapp

  - name: test
    container:
      image: golang:1.22
      working_dir: /app
      volumes:
        - ./src:/app
    command: go test ./...
    depends:
      - build
```

### Exec Mode

Steps can also exec into existing containers:

```yaml
steps:
  # String form
  - name: run-migration
    container: my-database-container
    command: psql -c "SELECT 1"

  # Object form with overrides
  - name: admin-task
    container:
      exec: my-app-container
      user: root
    command: chown -R app:app /data
```

### Mixed Mode Example

Combine exec and image modes in the same workflow:

```yaml
steps:
  # Exec into existing app container
  - name: prepare-app
    container: my-app
    command: php artisan down

  # Run migrations in a fresh container
  - name: migrate
    container:
      image: my-app:latest
      volumes:
        - ./migrations:/migrations
    command: php artisan migrate --force

  # Exec back into the app container
  - name: restart-app
    container: my-app
    command: php artisan up
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
  - name: install
    command: npm install
    # Uses DAG-level node:20 container

  - name: deploy
    container:
      image: google/cloud-sdk:latest  # Uses its own container
      env:
        - GOOGLE_APPLICATION_CREDENTIALS=/secrets/gcp.json
    command: gcloud app deploy
```

## Executor Config Syntax

For advanced use cases, use `type: docker` with a `config` block. This provides access to Docker SDK options:

```yaml
steps:
  - name: run-in-docker
    type: docker
    config:
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
  - name: with-resource-limits
    type: docker
    config:
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
  - command: curl localhost
```

```yaml
# Startup: command - run custom startup command
container:
  image: alpine:3
  startup: command
  command: ["sh", "-c", "while true; do sleep 3600; done"]

steps:
  - command: echo "container running with custom command"
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
  - command: psql -U postgres -c "SELECT 1"
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
  - command: my-entrypoint sendConfirmationEmails
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
  - name: build-and-test
    container:
      image: node:20
      volumes:
        - ./src:/app
      working_dir: /app
    command:
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
  - command: cat /etc/alpine-release
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
To emit a literal `$` in non-shell container commands or config fields, escape it as `\$`.
If you configure `container.shell`, Dagu leaves `\$` intact and the shell handles the escape.
:::

## Output Handling

Capture step output to variables or redirect to files:

```yaml
steps:
  # Capture small output to variable
  - name: get-version
    container:
      image: alpine:3
    command: cat /etc/alpine-release
    output: ALPINE_VERSION

  # Redirect large output to file
  - name: process-data
    container:
      image: alpine:3
    command: tar -tvf /data/archive.tar
    stdout: /tmp/archive-listing.txt
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
  - command: python process.py
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
  - name: process
    container:
      image: myorg/processor:latest  # from Docker Hub
    command: process-data

  - name: analyze
    container:
      image: ghcr.io/myorg/analyzer:v2  # from GitHub
    command: analyze-results
```

## Docker in Docker

Mount the Docker socket and run as root to use Docker inside your containers:

```yaml
# compose.yml for Dagu with Docker support
services:
  dagu:
    image: ghcr.io/dagu-org/dagu:latest
    ports:
      - 8080:8080
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./dags:/var/lib/dagu/dags
    entrypoint: ["dagu", "start-all"]
    user: "0:0"  # Run as root for Docker access
```

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
  - name: build-amd64
    container:
      image: golang:1.22
      platform: linux/amd64
    command: go build -o app-amd64

  - name: build-arm64
    container:
      image: golang:1.22
      platform: linux/arm64
    command: go build -o app-arm64
```
