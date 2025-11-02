# Track and Manage Any Command with Web UI

**Dagu** is a workflow engine with a Web UI. Single binary, no dependencies, runs on Linux/macOS/Windows. [Install Dagu →](/getting-started/installation)

The `dagu exec` command wraps any shell command with persistent logging, execution history, and a web dashboard—without writing configuration files.

## Basic Usage

```bash
dagu exec -- python daily_report.py
```

This creates an in-memory workflow, executes it through Dagu's runtime, and stores the run history. All logs and metadata are preserved exactly as if you had written a YAML file.

## Why Use This?

### Migrate from Cron Without Rewriting

```bash
# Your existing crontab:
# 0 2 * * * /usr/bin/python /home/user/backup.py

# Run through Dagu instead:
dagu exec -- python /home/user/backup.py
```

You get:
- Persistent logs in `~/.local/share/dagu/logs/`
- Run history visible in the Web UI
- Execution metadata (start time, duration, exit code)
- Notifications on success/failure (via `base.yaml` handlers)

### Track Ad-hoc Commands

```bash
dagu exec --name db-migration-20250102 -- psql -f migrate.sql
```

Check status later:
```bash
dagu status db-migration-20250102
```

View in UI at `http://localhost:8080`.

## Command Reference

### Syntax

```bash
dagu exec [flags] -- <command> [args...]
```

The `--` separator is optional. Everything after flags is treated as the command.

### Flags

**Naming:**
- `--name, -N <name>` - DAG name (default: `exec-<command>`)
- `--run-id, -r <id>` - Custom run ID (default: auto-generated)

**Environment:**
- `--env KEY=VALUE` - Set environment variable (repeatable)
- `--dotenv <path>` - Load dotenv file relative to working directory (repeatable)
- `--workdir <path>` - Working directory (default: current directory)
- `--shell <path>` - Shell binary for command execution
- `--base <file>` - Custom base config file (default: `~/.config/dagu/base.yaml`)

**Execution Control:**
- `--singleton` - Allow only one active run (sets `maxActiveRuns: 1`)
- `--queue <name>` - Enqueue for distributed execution
- `--no-queue` - Force local execution even if queues are enabled
- `--worker-label key=value` - Target specific workers (repeatable, requires queues)

## Examples

### Environment Variables

```bash
dagu exec \
  --env DATABASE_URL=postgres://localhost/mydb \
  --env LOG_LEVEL=debug \
  -- python etl.py
```

### Dotenv Files

```bash
dagu exec \
  --dotenv .env.production \
  --workdir /opt/app \
  -- node index.js
```

Loads environment from `/opt/app/.env.production` before execution.

### Singleton Execution

```bash
dagu exec --singleton --name nightly-sync -- rsync -av /source/ /dest/
```

If another `nightly-sync` is already running, this either blocks until the previous run finishes or enqueues the run if queues are enabled.

### Distributed Execution

```bash
dagu exec \
  --queue gpu-jobs \
  --worker-label gpu=true \
  --worker-label memory=32G \
  -- python train_model.py
```

This enqueues the command for a worker with matching labels. The command does not run locally.

## Behavior Details

### Generated DAG Name

Without `--name`, the DAG name is derived from the command:

```bash
dagu exec -- python script.py
# DAG name: exec-python

dagu exec -- /usr/local/bin/backup
# DAG name: exec-backup
```

Names are truncated to 40 characters and sanitized to alphanumeric + hyphens.

### Run History

Every execution creates a persistent record in `~/.local/share/dagu/data/dag-runs/<dag-name>/`:

```
exec-python/
├── dag-run_20250102_143022_01JGHQR8K4/
│   ├── status.json       # Execution metadata
│   ├── dagu.log          # Step output
│   └── spec.yaml         # Generated YAML snapshot
```

The Web UI displays these runs under the DAG name. The generated YAML is stored so you can see exactly what was executed.

### Queue Behavior

With `--queue` or `--worker-label`:
- The command is enqueued and the CLI exits immediately
- A worker with matching labels picks up the task
- Use `dagu status <name>` to track progress

Without `--queue`:
- The command runs locally
- CLI waits for completion and shows progress

### Concurrency Limits

When `--singleton` is set:
- If another run with the same name is active:
  - **Queues disabled:** Command fails with error
  - **Queues enabled:** Run is enqueued automatically

Without `--singleton`, multiple runs with the same name can execute concurrently.

## Generated YAML Format

For `dagu exec -- python script.py --arg=value`:

```yaml
name: exec-python
type: chain
workingDir: /current/directory
steps:
  - name: main
    command: ["python", "script.py", "--arg=value"]
params:
  - CMD=python script.py --arg=value
```

With flags:

```bash
dagu exec \
  --env FOO=bar \
  --singleton \
  -- python script.py
```

Generates:

```yaml
name: exec-python
type: chain
workingDir: /current/directory
maxActiveRuns: 1
env:
  - FOO=bar
steps:
  - name: main
    command: ["python", "script.py"]
params:
  - CMD=python script.py
```

This YAML is stored in the run history but **not** written to the DAGs directory. It exists only as run metadata.

## Using Secrets (Avoiding Log Leakage)

Environment variables passed via `--env` are stored in run history and visible in logs. For sensitive data, use the `secrets` block in `base.yaml`:

```yaml
# ~/.config/dagu/base.yaml
secrets:
  - name: API_TOKEN
    provider: env
    key: PROD_API_TOKEN
  - name: DB_PASSWORD
    provider: file
    key: /run/secrets/db-password
```

Every `dagu exec` command inherits these secrets and they are **automatically scrubbed from logs**:

```bash
# API_TOKEN is available to the script but masked in logs
dagu exec -- python deploy.py
```

You can use different base configs for different environments:

```bash
# Production environment with prod secrets
dagu exec --base ~/configs/prod-base.yaml -- ./deploy.sh

# Staging environment with staging secrets
dagu exec --base ~/configs/staging-base.yaml -- ./deploy.sh
```

Secrets are resolved at runtime and never persisted to disk or run history. See [Secrets](/writing-workflows/secrets) for provider details.

## Lifecycle Hooks via Base Configuration

While `dagu exec` doesn't support lifecycle hook flags, you can define handlers in `base.yaml` that apply to all exec commands:

```yaml
# ~/.config/dagu/base.yaml
handlerOn:
  failure:
    command: 'curl -X POST https://alerts.example.com/webhook -d "cmd=${CMD} failed"'
  success:
    command: 'echo "Success: ${DAG_NAME}" >> /var/log/dagu-exec.log'
  exit:
    command: 'rm -f /tmp/${DAG_RUN_ID}.lock'
```

Every `dagu exec` command inherits these handlers automatically:

```bash
dagu exec -- python risky_script.py
# If this fails, the failure handler runs
# The exit handler always runs regardless of success/failure
```

Handlers have access to these environment variables:
- `${CMD}` - The original command (from params)
- `${DAG_NAME}` - Auto-generated or custom name
- `${DAG_RUN_ID}` - The run ID
- `${DAG_RUN_STATUS}` - Final status (succeeded, failed, canceled)
- `${DAG_RUN_LOG_FILE}` - Path to log file

See [Lifecycle Handlers](/writing-workflows/lifecycle-handlers) for complete documentation.

## Technical Details

`dagu exec` generates an in-memory DAG from the command and flags, then executes it through the same runtime as `dagu start`. This means:

- Logs are stored in the same location as file-based DAGs
- Run history appears in the Web UI
- Base configuration (`~/.config/dagu/base.yaml`) is automatically applied
- Queue and worker coordination works identically
- All lifecycle handlers, secrets, and environment variables are inherited
