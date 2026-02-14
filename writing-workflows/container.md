# Container Field

Run workflow steps in Docker containers for consistent, isolated execution environments.

The `container` field supports two modes:
- **Image mode**: Create a new container from an image
- **Exec mode**: Execute commands in an existing running container

::: warning Entrypoint Not Used for Steps
When using DAG-level `container`, steps run via `docker exec` in a long-lived container. Your image's `ENTRYPOINT`/`CMD` is **not** invoked for step commands. See [Execution Model](#execution-model-and-entrypoint-behavior) for details.
:::

## Basic Usage

### Image Mode (Create New Container)

```yaml
container:
  image: python:3.11

steps:
  - command: pip install pandas numpy  # Install dependencies
  - command: python process.py          # Process data
```

All steps run in the same container instance, sharing the filesystem and installed packages.

### Exec Mode (Use Existing Container)

Execute commands in a container that's already running (e.g., started by Docker Compose or another process):

```yaml
# Simple string form - exec with container's default settings
container: my-running-container

steps:
  - command: php artisan migrate
  - command: php artisan cache:clear
```

Or with overrides for user, working directory, and environment:

```yaml
# Object form with exec field
container:
  exec: my-running-container
  user: root
  working_dir: /app
  env:
    - DEBUG=true

steps:
  - command: chown -R app:app /data
```

Exec mode is ideal for:
- Running commands in application containers started by Docker Compose
- Interacting with long-running service containers
- Development workflows where containers are already running

## With Volume Mounts

```yaml
container:
  image: node:24
  volumes:
    - ./src:/app
    - ./data:/data
  working_dir: /app

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
    retry_policy:
      limit: 10
      
  - command: psql -U postgres myapp -f schema.sql
```

## Private Registry Authentication

```yaml
# For private images
registry_auths:
  ghcr.io:
    username: ${GITHUB_USER}
    password: ${GITHUB_TOKEN}

container:
  image: ghcr.io/myorg/private-app:latest

steps:
  - command: ./app
```

Or use `DOCKER_AUTH_CONFIG` environment variable (same format as `~/.docker/config.json`).

## Shell Wrapper

The `shell` field wraps step commands with a shell interpreter to enable shell operators like pipes, redirects, and command chaining. Configure the shell once at the container level instead of wrapping each command individually.

### Why Use Shell Wrapper?

**Without `shell` (repetitive wrapping):**
```yaml
container:
  image: alpine:latest

steps:
  - command: sh -c "cat data.csv | cut -d',' -f2 | sort | uniq > unique.txt"
  - command: sh -c "npm install && npm test"
  - command: sh -c "npm run build || exit 1"
```

**With `shell` (configured once):**
```yaml
container:
  image: alpine:latest
  shell: ["/bin/sh", "-c"]  # Configure once

steps:
  - command: cat data.csv | cut -d',' -f2 | sort | uniq > unique.txt
  - command: npm install && npm test
  - command: npm run build || exit 1
```

### Supported Shell Features

When `shell` is configured, your commands can use:

- **Pipes**: `|` - Pass output from one command to another
- **Command chaining**: `&&`, `||`, `;` - Execute multiple commands conditionally
- **Redirects**: `>`, `>>`, `<` - Redirect input/output
- **Variable expansion**: `$VAR`, `${VAR}` - Use shell variables
- **Globbing**: `*.txt`, `**/*.js` - File pattern matching

```yaml
container:
  image: alpine:latest
  shell: ["/bin/sh", "-c"]

steps:
  # Pipes
  - command: echo "hello world" | tr a-z A-Z

  # Command chaining
  - command: mkdir -p build && cd build && cmake ..

  # Redirects
  - command: cat data.txt | grep ERROR > errors.log

  # Variable expansion
  - command: echo "User is $USER"
```

### Format

**Array format:** `[shell_path, ...flags, command_flag]`

- **First element**: Path to shell executable (`/bin/sh`, `/bin/bash`, etc.)
- **Middle elements** (optional): Shell flags (`-e`, `-o errexit`, etc.)
- **Last element**: Command flag is **auto-added** if not present (`-c`, `-Command`, `/c`, `--run`)

**Examples:**
```yaml
# Simple - auto-adds -c
shell: ["/bin/sh"]

# With flags - auto-adds -c at the end
shell: ["/bin/bash", "-e", "-x"]

# Bash strict mode - -c already present
shell: ["/bin/bash", "-o", "errexit", "-o", "pipefail", "-c"]

# PowerShell - auto-adds -Command
shell: ["powershell"]

# Windows cmd - auto-adds /c
shell: ["cmd.exe"]
```

### Cross-Platform Support

The shell field automatically detects and adds the correct command flag for different shells:

| Shell Type | Auto-Added Flag | Example |
|------------|----------------|---------|
| Unix shells (`sh`, `bash`, `zsh`) | `-c` | `["/bin/bash"]` → `["/bin/bash", "-c"]` |
| PowerShell (`powershell`, `pwsh`) | `-Command` | `["powershell"]` → `["powershell", "-Command"]` |
| Windows cmd | `/c` | `["cmd.exe"]` → `["cmd.exe", "/c"]` |
| Nix shell | `--run` | `["nix-shell"]` → `["nix-shell", "--run"]` |

### Exec Mode Example

Works in both image mode and exec mode:

```yaml
container:
  exec: my-running-container
  shell: ["/bin/bash", "-c"]

steps:
  - command: composer install && php artisan migrate
  - command: npm run build || echo "Build failed"
```

### Bash Strict Mode

Enable error handling and debugging flags for robust shell scripts:

```yaml
container:
  image: ubuntu:22.04
  shell: ["/bin/bash", "-o", "errexit", "-o", "xtrace", "-o", "pipefail", "-c"]

steps:
  # Exit immediately if any command fails
  - command: npm install && npm run build && npm test

  # Print commands before execution (debug)
  - command: echo "Starting deployment" && deploy.sh
```

**Flags explained:**
- `-o errexit` (or `-e`): Exit immediately if any command fails
- `-o xtrace` (or `-x`): Print commands before executing (useful for debugging)
- `-o pipefail`: Return exit code of the first failed command in a pipeline

### Important Notes

- **Only affects step commands**: The `shell` wrapper is applied to your workflow step commands, not to container startup commands
- **Without `shell`**: Commands execute in Docker exec form without shell interpretation (operators like `&&` won't work)
- **Command joining**: Commands are joined with spaces, so shell operators work naturally
- **Quoting**: If your command arguments contain spaces, quote them in YAML: `command: echo "hello world"`

## Configuration Options

The container field accepts either a string (exec mode) or an object (exec or image mode).

### String Form (Exec Mode)

```yaml
container: my-running-container  # Exec into existing container with defaults
```

### Object Form

```yaml
# Image mode - create new container
container:
  name: my-workflow-container # Custom container name (optional)
  image: ubuntu:22.04        # Required for image mode
  pull_policy: missing        # always | missing | never
  volumes:                   # Volume mounts
    - /host:/container
  env:                       # Environment variables
    - KEY=value
  working_dir: /app           # Working directory
  user: "1000:1000"          # User/group
  platform: linux/amd64      # Platform
  ports:                     # Port mappings
    - "8080:8080"
  network: host              # Network mode
  startup: keepalive         # keepalive | entrypoint | command
  command: ["sh", "-c", "my-daemon"] # when startup: command
  wait_for: running           # running | healthy
  log_pattern: "Ready"        # optional regex; wait for log pattern
  restart_policy: unless-stopped  # optional Docker restart policy (no|always|unless-stopped)
  keep_container: true        # Keep after workflow
  shell: ["/bin/bash", "-c"] # Shell wrapper for step commands
```

```yaml
# Exec mode - use existing container
container:
  exec: my-running-container  # Required for exec mode
  user: root                  # Optional: override user
  working_dir: /app            # Optional: override working directory
  env:                        # Optional: additional environment variables
    - DEBUG=true
  shell: ["/bin/sh", "-c"]    # Shell wrapper for step commands
```

### Field Availability by Mode

| Field | String Mode | Exec Mode | Image Mode |
|-------|-------------|-----------|------------|
| `exec` | N/A (implicit) | **Required** | Not allowed |
| `image` | Not allowed | Not allowed | **Required** |
| `user` | N/A | Optional | Optional |
| `working_dir` | N/A | Optional | Optional |
| `env` | N/A | Optional | Optional |
| `shell` | N/A | Optional | Optional |
| `name` | N/A | Not allowed | Optional |
| `pull_policy` | N/A | Not allowed | Optional |
| `volumes` | N/A | Not allowed | Optional |
| `ports` | N/A | Not allowed | Optional |
| `network` | N/A | Not allowed | Optional |
| `platform` | N/A | Not allowed | Optional |
| `startup` | N/A | Not allowed | Optional |
| `command` | N/A | Not allowed | Optional |
| `wait_for` | N/A | Not allowed | Optional |
| `log_pattern` | N/A | Not allowed | Optional |
| `restart_policy` | N/A | Not allowed | Optional |
| `keep_container` | N/A | Not allowed | Optional |

### Validation and Errors

**Common rules:**
- `exec` and `image` are mutually exclusive; specifying both causes an error.
- Either `exec` or `image` must be specified (or use string form for exec).

**Image mode:**
- `image` is required.
- `name` is optional; if specified, must be unique. If a container with the same name already exists (running or stopped), the workflow fails.
- `volumes` must use `source:target[:ro|rw]` format; relative paths are resolved from the DAG `working_dir`; invalid formats fail.
- `ports` accept `"80"`, `"8080:80"`, `"127.0.0.1:8080:80"`; container port may have `/tcp|udp|sctp` (default tcp); invalid formats fail.
- `network` accepts `bridge`, `host`, `none`, `container:<name|id>`, or a custom network name.
- `restart_policy` supports `no`, `always`, or `unless-stopped`; other values fail.
- `startup` must be one of `keepalive` (default), `entrypoint`, `command`; invalid values fail.
- `wait_for` must be `running` (default) or `healthy`; if `healthy` is chosen but no healthcheck exists, Dagu falls back to `running` with a warning.
- `log_pattern` must be a valid regex; readiness waits up to 120s (including `log_pattern`), then errors with the last known state.

**Exec mode:**
- The container must exist and be running; Dagu waits up to 120 seconds for the container to be running.
- Fields like `volumes`, `ports`, `network`, `pull_policy`, etc. cannot be used with `exec` (they're only valid when creating a new container).
- Only `user`, `working_dir`, `env`, and `shell` can override the container's defaults.

**Shell field:**
- Non-empty array: first element is shell path, last element is command flag (e.g., `-c`)
- Available in both image and exec modes

## Multiple Commands

Multiple commands share the same step configuration, including the container config:

```yaml
steps:
  - name: build-and-test
    container:
      image: node:24
      volumes:
        - ./src:/app
      working_dir: /app
    command:
      - npm install
      - npm run build
      - npm test
```

Instead of duplicating the `container`, `env`, `retry_policy`, `preconditions`, etc. across multiple steps, combine commands into one step. All commands run in the same container instance, sharing the filesystem state (e.g., `node_modules` from `npm install`).

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
  wait_for: healthy      # running | healthy (default running)
```

```yaml
container:
  image: alpine:latest
  startup: command
  command: ["sh", "-c", "my-daemon --flag"]
  restart_policy: unless-stopped   # optional
```

- `keepalive` (default): preserves current behavior using an embedded
  keepalive binary or `sh -c 'while true; sleep 86400; done'` in DinD.
- `entrypoint`: honors the image’s `ENTRYPOINT`/`CMD` with no overrides.
- `command`: runs a user‑provided `command` array instead of image defaults.

Readiness before steps run:

- `wait_for: running` (default): continue once the container is running.
- `wait_for: healthy`: if image defines a Docker healthcheck, wait for healthy;
  if not defined, Dagu falls back to `running` and logs a warning.
- `log_pattern`: optional regex; when set, steps start only after this pattern
  appears in container logs (after the selected `wait_for` condition passes).

Readiness timeout and errors:

- Dagu waits up to 120 seconds for readiness (`running`/`healthy` and any
  `log_pattern`). On timeout, it fails the run and reports the mode and last
  known state (for example, `status=exited, exit_code=1`).

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

### Step-Level Container

If you want each step to run in its own container (as with a fresh `docker run`
per step), use the step-level `container` field:

```yaml
steps:
  - name: send-confirmation-emails
    container:
      image: myorg/myimage:latest
    # The container is automatically created and removed after execution
    command: sendConfirmationEmails
```

You can also use different containers for different steps:

```yaml
steps:
  - name: build
    container:
      image: node:24
      volumes:
        - ./src:/app
      working_dir: /app
    command: npm run build

  - name: test
    container:
      image: node:24
      volumes:
        - ./src:/app
      working_dir: /app
    command: npm test

  - name: deploy
    container:
      image: python:3.11
      env:
        - AWS_DEFAULT_REGION=us-east-1
    command: python deploy.py
```

#### Step-Level Exec Mode

Steps can also exec into existing containers using the same syntax as DAG-level:

```yaml
steps:
  # String form - exec with defaults
  - name: run-migration
    container: my-app-container
    command: php artisan migrate

  # Object form with overrides
  - name: clear-cache
    container:
      exec: my-app-container
      user: www-data
      working_dir: /var/www
    command: php artisan cache:clear

  # Mix exec and image modes in the same workflow
  - name: run-tests
    container:
      image: node:24
    command: npm test
```

::: warning
When using step-level `container`, you cannot use `executor` or `script` fields on the same step.
:::

Note: When a DAG‑level `container:` is set, step-level `container` fields are ignored. The step runs inside the shared DAG container via `docker exec`. To use step-specific container settings, remove the DAG‑level `container`.

## See Also

- [Docker Executor](/features/executors/docker) - Step-level container execution
- [Registry Authentication](/features/executors/docker#registry-authentication) - Private registry setup
