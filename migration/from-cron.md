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

**Dagu** is a self-contained workflow engine. Single binary, no external dependencies. Runs on Linux/macOS/Windows. [Install →](/getting-started/installation/)

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
- `--worker-label key=value` - Set worker selector labels (repeatable)

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

Every `dagu exec` run appears in Dagu's normal run history, so you can reopen it in the Web UI under the generated DAG name and review the logs, timing, and final result later.

The command runs locally and the CLI waits for completion and shows progress.

For distributed execution, use `dagu enqueue` instead:
```bash
dagu enqueue my-workflow.yaml
```

## Generated YAML Format

For `dagu exec -- python script.py --arg=value`:

```yaml
name: exec-python
type: chain
working_dir: /current/directory
steps:
  - id: main
    command: ["python", "script.py", "--arg=value"]
```

With flags:

```bash
dagu exec \
  --env FOO=bar \
  -- python script.py
```

Generates:

```yaml
name: exec-python
type: chain
working_dir: /current/directory
env:
  - FOO=bar
steps:
  - id: main
    command: ["python", "script.py"]
```

Dagu keeps a snapshot of the generated workflow with the run so you can inspect what actually executed later. It does not add a new workflow file to your normal DAGs directory.

## Using Secrets (Avoiding Log Leakage)

Environment variables passed via `--env` can show up in run details and logs. For sensitive data, use the `secrets` block in `base.yaml` instead:

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

Every `dagu exec` command inherits these secrets, and Dagu masks the resolved values in its managed logs and captured outputs:

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

Secrets are resolved during execution. Dagu does not serialize the resolved secret env vars into the DAG spec, and it masks those values in Dagu-managed logs and captured outputs. Workflow code can still write them elsewhere. See [Secrets](/writing-workflows/secrets) for provider behavior.

## Lifecycle Hooks via Base Configuration

While `dagu exec` doesn't support lifecycle hook flags, you can define handlers in `base.yaml` that apply to all exec commands:

```yaml
# ~/.config/dagu/base.yaml
handler_on:
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

## What To Expect

`dagu exec` behaves like a quick way to run an ad-hoc workflow through Dagu's normal runtime. In practice:

- the run shows up in the Web UI
- your base configuration still applies
- lifecycle handlers, secrets, and environment settings are still honored
