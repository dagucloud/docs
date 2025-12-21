# Migrating from Cron

## Add Logging, Dashboard, and Notifications to Your Cron Jobs

If your cron jobs look like this:

```bash
0 2 * * * /usr/bin/python /home/user/backup.py >> /var/log/backup.log 2>&1
```

Run them through Dagu instead and get:
- Persistent logs with automatic rotation
- Web dashboard showing all runs (status, duration, exit codes)
- Notifications on failure (email, webhooks)
- Run history and status tracking
- No need to change your scripts

**Dagu** is a single binary workflow engine. No database, no dependencies. Runs on Linux/macOS/Windows. [Install →](/getting-started/installation)

## Basic Usage

Run a command:

```bash
dagu exec -- echo "Hello World!"
```

Start the web UI and open `http://localhost:8080`:

```bash
dagu start-all
```

You'll see the execution log, status, and timing in the dashboard.

For your actual scripts:

```bash
dagu exec -- python /home/user/backup.py
```

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
- `--worker-label key=value` - Set worker selector labels for distributed execution (repeatable)

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

### With Worker Labels

```bash
dagu exec \
  --worker-label gpu=true \
  --worker-label memory=32G \
  -- python train_model.py
```

This sets worker selector labels on the generated DAG. To run this on a distributed worker, use `dagu enqueue` instead of `dagu exec`.

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

The command runs locally and the CLI waits for completion and shows progress.

For distributed execution, use `dagu enqueue` instead:
```bash
dagu enqueue my-workflow.yaml
```

### Concurrency Limits

When `--singleton` is set and another run with the same name is active, the command fails with an error.

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
    command: 'curl -X POST https://alerts.example.com/webhook -d "dag ${DAG_NAME} failed"'
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

Handlers receive the standard environment provided by Dagu, including variables such as `${DAG_NAME}`, `${DAG_RUN_ID}`, and `${DAG_RUN_LOG_FILE}`.

See [Lifecycle Handlers](/writing-workflows/lifecycle-handlers) for complete documentation.

## Technical Details

`dagu exec` generates an in-memory DAG from the command and flags, then executes it through the same runtime as `dagu start`. This means:

- Logs are stored in the same location as file-based DAGs
- Run history appears in the Web UI
- Base configuration (`~/.config/dagu/base.yaml`) is automatically applied
- All lifecycle handlers, secrets, and environment variables are inherited
