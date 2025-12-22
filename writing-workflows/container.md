# Container Field

Run all workflow steps in a shared Docker container for consistent execution environment.

## Basic Usage

```yaml
container:
  image: python:3.11

steps:
  - command: pip install pandas numpy  # Install dependencies
  - command: python process.py          # Process data
```

All steps run in the same container instance, sharing the filesystem and installed packages.

## With Volume Mounts

```yaml
container:
  image: node:24
  volumes:
    - ./src:/app
    - ./data:/data
  workingDir: /app

steps:
  - command: npm install    # Install dependencies
  - command: npm run build  # Build the application
  - command: npm test       # Run tests
```

## With Environment Variables

```yaml
container:
  image: postgres:16
  env:
    - POSTGRES_PASSWORD=secret
    - POSTGRES_DB=myapp

steps:
  - command: pg_isready -U postgres
    retryPolicy:
      limit: 10
      
  - command: psql -U postgres myapp -f schema.sql
```

## Private Registry Authentication

```yaml
# For private images
registryAuths:
  ghcr.io:
    username: ${GITHUB_USER}
    password: ${GITHUB_TOKEN}

container:
  image: ghcr.io/myorg/private-app:latest

steps:
  - command: ./app
```

Or use `DOCKER_AUTH_CONFIG` environment variable (same format as `~/.docker/config.json`).

## Configuration Options

```yaml
container:
  name: my-workflow-container # Custom container name (optional)
  image: ubuntu:22.04        # Required
  pullPolicy: missing        # always | missing | never
  volumes:                   # Volume mounts
    - /host:/container
  env:                       # Environment variables
    - KEY=value
  workingDir: /app             # Working directory
  user: "1000:1000"         # User/group
  platform: linux/amd64     # Platform
  ports:                    # Port mappings
    - "8080:8080"
  network: host             # Network mode
  startup: keepalive        # keepalive | entrypoint | command
  command: ["sh", "-c", "my-daemon"] # when startup: command
  waitFor: running          # running | healthy
  logPattern: "Ready"       # optional regex; wait for log pattern
  restartPolicy: unless-stopped  # optional Docker restart policy (no|always|unless-stopped)
  keepContainer: true       # Keep after workflow
```

### Validation and Errors

- `image` is required.
- `name` is optional; if specified, must be unique. If a container with the same name already exists (running or stopped), the workflow fails.
- `volumes` must use `source:target[:ro|rw]` format; relative paths are resolved from the DAG `workingDir`; invalid formats fail.
- `ports` accept `"80"`, `"8080:80"`, `"127.0.0.1:8080:80"`; container port may have `/tcp|udp|sctp` (default tcp); invalid formats fail.
- `network` accepts `bridge`, `host`, `none`, `container:<name|id>`, or a custom network name.
- `restartPolicy` supports `no`, `always`, or `unless-stopped`; other values fail.
- `startup` must be one of `keepalive` (default), `entrypoint`, `command`; invalid values fail.
- `waitFor` must be `running` (default) or `healthy`; if `healthy` is chosen but no healthcheck exists, Dagu falls back to `running` with a warning.
- `logPattern` must be a valid regex; readiness waits up to 120s (including `logPattern`), then errors with the last known state.

## Key Benefits

- **Shared Environment**: All steps share the same filesystem and installed dependencies
- **Performance**: No container startup overhead between steps
- **Consistency**: Guaranteed same environment for all steps
- **Simplicity**: No need to configure Docker executor for each step

## Execution Model and Entrypoint Behavior

- **How it runs:** When you set a DAG‑level `container`, Dagu starts one
  long‑lived container for the workflow. By default (`startup: keepalive`),
  it runs a lightweight keepalive process (or sleep) so the container stays
  up. Each step then runs inside that container via `docker exec`.
- **Entrypoint/CMD not used for steps:** Because steps are executed with
  `docker exec`, your image’s `ENTRYPOINT` or `CMD` are not invoked for step
  commands. Steps run directly in the running container process context.
- **Implication:** If your image’s entrypoint is a dispatcher that expects a
  subcommand (for example, `my-entrypoint sendConfirmationEmails` which then
  calls `npm run sendConfirmationEmails`), the step command must invoke that
  dispatcher explicitly.

### Startup Modes

Choose how the DAG‑level container starts:

```yaml
container:
  image: servercontainers/samba:latest
  startup: entrypoint   # keepalive | entrypoint | command
  waitFor: healthy      # running | healthy (default running)
```

```yaml
container:
  image: alpine:latest
  startup: command
  command: ["sh", "-c", "my-daemon --flag"]
  restartPolicy: unless-stopped   # optional
```

- `keepalive` (default): preserves current behavior using an embedded
  keepalive binary or `sh -c 'while true; sleep 86400; done'` in DinD.
- `entrypoint`: honors the image’s `ENTRYPOINT`/`CMD` with no overrides.
- `command`: runs a user‑provided `command` array instead of image defaults.

Readiness before steps run:

- `waitFor: running` (default): continue once the container is running.
- `waitFor: healthy`: if image defines a Docker healthcheck, wait for healthy;
  if not defined, Dagu falls back to `running` and logs a warning.
- `logPattern`: optional regex; when set, steps start only after this pattern
  appears in container logs (after the selected `waitFor` condition passes).

Readiness timeout and errors:

- Dagu waits up to 120 seconds for readiness (`running`/`healthy` and any
  `logPattern`). On timeout, it fails the run and reports the mode and last
  known state (for example, `status=exited, exitCode=1`).

### Examples

Image entrypoint expects a job name as its first argument:

```yaml
container:
  image: myorg/myimage:latest

steps:
  # This will NOT pass through the image ENTRYPOINT automatically.
  # Explicitly call the entrypoint script or the underlying command.
  - command: my-entrypoint sendConfirmationEmails
  # Or call the underlying command directly, if appropriate
  - command: npm run sendConfirmationEmails
```

If your step needs a shell to interpret operators (like `&&`, redirects,
or environment expansion), wrap it explicitly:

```yaml
steps:
  - command: sh -c "npm run prep && npm run sendConfirmationEmails"
```

### When to use step-level Docker instead

If you want each step to run via the image’s `ENTRYPOINT`/`CMD` (as with a
fresh `docker run` per step), prefer the step‑level Docker executor instead of
the DAG‑level `container`:

```yaml
steps:
  - name: send-confirmation-emails
    executor:
      type: docker
      config:
        image: myorg/myimage:latest
        autoRemove: true
    # Here, Docker will honor ENTRYPOINT/CMD by default
    # (or you can override using executor config options)
    command: sendConfirmationEmails
```

Note: When a DAG‑level `container:` is set, any step using the Docker executor runs inside that shared container via `docker exec`. In that case, the step‑level Docker `config` (such as `image`, `container/host/network`, and `exec`) is ignored, and only the step’s `command` and `args` are used. To apply step‑specific container settings, remove the DAG‑level `container` and use the step‑level Docker executor exclusively.

## See Also

- [Docker Executor](/features/executors/docker) - Step-level container execution
- [Registry Authentication](/features/executors/docker#registry-authentication) - Private registry setup
