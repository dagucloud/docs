# Docker Executor

Run workflow steps in Docker containers for isolated, reproducible execution.

## DAG-Level Container

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

## Step-Level Container

Use the `container` field directly on a step for per-step container configuration:

```yaml
steps:
  - name: build
    container:
      image: golang:1.22
      workingDir: /app
      volumes:
        - ./src:/app
    command: go build -o /app/bin/myapp

  - name: test
    container:
      image: golang:1.22
      workingDir: /app
      volumes:
        - ./src:/app
    command: go test ./...
    depends:
      - build
```

### Configuration Options

Both DAG-level and step-level `container` fields support the same options:

```yaml
container:
  image: alpine:latest        # Required: container image
  name: my-container          # Optional: custom container name
  pullPolicy: missing         # always | missing | never
  workingDir: /app            # Working directory inside the container
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
  keepContainer: true         # Keep container after workflow (DAG-level only)
```

### Step Container Overrides DAG Container

When a step has its own `container` field, it runs in that container instead of the DAG-level container:

```yaml
# DAG-level container for most steps
container:
  image: node:20
  workingDir: /app

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

## Validation and Errors

- **Required fields**: `container.image` is required for both DAG-level and step-level containers.
- **Container name**: Must be unique. If a container with the same name already exists (running or stopped), the DAG fails.
- **Volume format**: `source:target[:ro|rw]`
  - `source` may be absolute, relative to DAG workingDir (`.` or `./...`), or `~`-expanded; otherwise it is treated as a named volume.
  - Only `ro` or `rw` are valid modes.
- **Port format**: `"80"`, `"8080:80"`, `"127.0.0.1:8080:80"`, optional protocol: `80/tcp|udp|sctp` (default tcp).
- **Network**: Accepts `bridge`, `host`, `none`, `container:<name|id>`, or a custom network name.
- **Restart policy** (DAG-level): `no`, `always`, `unless-stopped`.
- **Platform**: `linux/amd64`, `linux/arm64`, etc.

### DAG-Level Startup Options

For DAG-level containers, additional startup options are available:

- `startup`: `keepalive` (default), `entrypoint`, `command`
- `waitFor`: `running` (default) or `healthy`
- `logPattern`: regex pattern for readiness detection

```yaml
container:
  image: nginx:alpine
  startup: entrypoint
  waitFor: healthy
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
      workingDir: /app
    command:
      - npm install
      - npm run build
      - npm test
```

Instead of duplicating the `container`, `env`, `retryPolicy`, `preconditions`, etc. across multiple steps, combine commands into one step. All commands run in the same container instance, sharing the filesystem state (e.g., `node_modules` from `npm install`).

## Registry Authentication

Access private container registries with authentication configured at the DAG level:

```yaml
registryAuths:
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
registryAuths:
  docker.io:
    username: ${DOCKER_USERNAME}
    password: ${DOCKER_PASSWORD}
```

**Pre-encoded authentication:**

```yaml
registryAuths:
  gcr.io:
    auth: ${GCR_AUTH_BASE64}  # base64(username:password)
```

**Environment variable:**

```yaml
registryAuths: ${DOCKER_AUTH_CONFIG}
```

The `DOCKER_AUTH_CONFIG` format is compatible with Docker's `~/.docker/config.json`.

### Authentication Priority

1. **DAG-level `registryAuths`** - Configured in your DAG file
2. **`DOCKER_AUTH_CONFIG` environment variable** - Standard Docker authentication
3. **No authentication** - For public registries

### Example: Multi-Registry Workflow

```yaml
registryAuths:
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

The `keepContainer` option (DAG-level only) prevents the container from being removed after the workflow completes:

```yaml
container:
  image: postgres:16
  keepContainer: true
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
