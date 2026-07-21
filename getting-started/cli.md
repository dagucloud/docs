# CLI Reference

Commands accept either DAG names (from YAML `name` field) or file paths.

- Both formats: `start`, `stop`, `status`, `retry`
- File path only: `dry`, `enqueue`
- DAG name only: `restart`
- Local-only commands: `profile`, `human-task complete`

## Global Options

```bash
dagu [global options] command [command options] [arguments...]
```

- `--config, -c` - Config file (default: `~/.config/dagu/config.yaml`)
- `--context` - CLI context name for context-aware commands (default: current context or `local`)
- `--dagu-home` - Override DAGU_HOME for this command invocation
- `--quiet, -q` - Suppress output
- `--cpu-profile` - Enable CPU profiling
- `--help, -h` - Show help
- `--version, -v` - Print version

## Remote Contexts

CLI contexts let context-aware commands target a remote Dagu server instead of the built-in `local` context.

Context-aware commands are:

- `agent`
- `start`
- `enqueue`
- `status`
- `history`
- `stop`
- `retry`
- `restart`
- `dequeue`

The built-in `local` context is always available. Remote contexts are stored under `paths.contexts_dir`, and their API keys are encrypted at rest.

```bash
# Add a remote server
dagu context add staging \
  --server https://staging.example.com \
  --api-key dagu_xxxxxxxxxxxxxxxxxxxx \
  --description "Staging Dagu server"

# Make it the current context
dagu context use staging

# Or target a context explicitly for one command
dagu --context staging status nightly-backup
```

Remote command rules:

- `agent` operates on the agent sessions of the selected server and does not take a DAG path.
- DAG-oriented remote commands only operate on DAGs that already exist on the remote server.
- For `start`, `enqueue`, `status`, `stop`, `retry`, and `restart`, pass the remote DAG `fileName` or a unique deployed DAG name. Local YAML paths such as `./job.yaml` are rejected.
- For `history`, pass a deployed DAG name. Local YAML paths are rejected.
- Commands that are not context-aware always run against the local instance and reject non-local contexts.
- `--profile` is local-only for `start`, `enqueue`, and `dry`. To select a profile on a remote server, use the Web UI or the REST API `profileName` field.

## Commands

### `exec`

Run a command without writing a YAML file.

```bash
dagu exec [options] -- <command> [args...]
```

**Options:**
- `--name, -N` - DAG name (default: `exec-<command>`)
- `--run-id, -r` - Custom run ID
- `--env KEY=VALUE` - Set environment variable (repeatable)
- `--dotenv <path>` - Load dotenv file (repeatable)
- `--workdir <path>` - Working directory
- `--shell <path>` - Shell binary
- `--base <file>` - Custom base config file (default: `~/.config/dagu/base.yaml`)
- `--worker-label key=value` - Set worker selector labels (repeatable)

```bash
# Basic usage
dagu exec -- python script.py

# With environment variables
dagu exec --env DB_HOST=localhost -- python etl.py
```

See the [exec guide](/migration/from-cron) for detailed documentation.

### `start`

Run a DAG workflow.

```bash
dagu start [options] DAG_NAME_OR_FILE [-- PARAMS...]
```

`dagu start` requires exactly one DAG name or file path.

**Options:**
- `--params, -p` - Parameters as JSON
- `--name, -N` - Override the DAG name (default: name from DAG definition or filename)
- `--run-id, -r` - Custom run ID
- `--from-run-id` - Re-run using the DAG snapshot and parameters captured from a historic run
- `--profile` - Runtime profile to apply to this run

> **Note:** `--from-run-id` cannot be combined with `--params`, `--parent`, or `--root`. Provide exactly one DAG name or file so the command can look up the historic run.

```bash
# Basic run
dagu start my-workflow.yaml

# With parameters (note the -- separator)
dagu start etl.yaml -- DATE=2024-01-01 ENV=prod

# Custom run ID
dagu start --run-id batch-001 etl.yaml

# Select a runtime profile
dagu start --profile prod etl.yaml

# Override DAG name
dagu start --name my_custom_name my-workflow.yaml

# Clone parameters from a historic run
dagu start --from-run-id 20241031_235959 example-dag.yaml
```

### `stop`

Stop a running DAG.

```bash
dagu stop [options] DAG_NAME_OR_FILE
```

**Options:**
- `--run-id, -r` - Specific run ID (optional)

```bash
dagu stop my-workflow                     # Stop current run
dagu stop --run-id=20240101_120000 etl   # Stop specific run
```

### `restart`

Restart a DAG run with a new ID.

```bash
dagu restart [options] DAG_NAME
```

**Options:**
- `--run-id, -r` - Run to restart (optional)

```bash
dagu restart my-workflow                   # Restart the currently running DAG-run
dagu restart --run-id=20240101_120000 etl  # Restart a specific running DAG-run
```

### `retry`

Retry a failed DAG execution.

```bash
dagu retry [options] DAG_NAME_OR_FILE
```

**Options:**
- `--run-id, -r` - Run to retry (required)

```bash
dagu retry --run-id=20240101_120000 my-workflow
```

Retries inherit the original run's runtime profile. `dagu retry` does not accept `--profile`.

### `human-task complete`

Complete a waiting [human task](/writing-workflows/human-tasks) in a root DAG run.

```bash
dagu human-task complete [options] DAG_NAME_OR_FILE
```

**Options:**

- `--run-id, -r` - Root DAG-run ID containing the waiting task (required)
- `--step` - Explicit human-task step ID (required)
- `--input key=value` - String input, repeatable for multiple properties
- `--inputs-json object` - Typed input as one JSON object

```bash
# Complete an acknowledgement-only task
dagu human-task complete \
  --run-id maintenance-42 \
  --step maintenance_started \
  maintenance.yaml

# Submit values that are coerced using the form schema
dagu human-task complete \
  --run-id release-42 \
  --step release_review \
  --input environment=production \
  --input replicas=3 \
  release.yaml

# Submit typed JSON values
dagu human-task complete \
  --run-id release-42 \
  --step release_review \
  --inputs-json '{"environment":"production","replicas":3,"notify":false}' \
  release.yaml
```

`--input` and `--inputs-json` are mutually exclusive. Omitting both submits an empty object. The command matches `--step` against the explicit step `id`, not its display name.

This command only supports the local CLI context because it accesses the DAG-run store directly. The root run itself may have executed locally or on a distributed worker. When the last waiting task is completed, Dagu resumes the same run automatically; a distributed resume requires the scheduler to be running.

### `status`

Display current status of a DAG.

```bash
dagu status [options] DAG_NAME_OR_FILE
```

**Options:**
- `--run-id, -r` - Check specific run (optional)

```bash
dagu status my-workflow  # Latest run status
```

**Output:**
```
Status: running
Started: 2024-01-01 12:00:00
Steps:
  ✓ download     [completed]
  ⟳ process      [running]
  ○ upload       [pending]
```


### `history`

Display execution history of DAG runs with filtering and pagination.

**Usage:**
```bash
dagu history [flags] [DAG_NAME]
```

**Flags:**
- `--from` - Start date/time in UTC (formats: `2006-01-02` or `2006-01-02T15:04:05Z`)
- `--to` - End date/time in UTC (formats: `2006-01-02` or `2006-01-02T15:04:05Z`)
- `--last` - Relative time period (examples: `7d`, `24h`, `1w`, `30d`). Cannot combine with `--from`/`--to`
- `--status` - Filter by one or more statuses. Use a single status or a comma-separated list with OR logic: `running`, `succeeded`, `failed`, `aborted`, `queued`, `waiting`, `rejected`, `not_started`, `partially_succeeded`
  - Aliases: `success` (succeeded), `failure` (failed), `canceled`/`cancelled`/`cancel` (aborted)
- `--run-id` - Filter by run ID (partial match supported)
- `--labels` - Filter by labels, comma-separated with AND logic (e.g., `prod,critical`)
- `--format`, `-f` - Output format: `table` (default), `json`, or `csv`
- `--limit`, `-l` - Max results (default: `100`, max: `1000`)

**Default Behavior:**
- Shows last 30 days of runs
- Table format with columns: DAG NAME, RUN ID, STATUS, STARTED (UTC), DURATION, PARAMS
- Sorted newest first
- Limit 100 results
- **Run IDs are never truncated**

**Examples:**

```bash
# All runs from last 30 days
dagu history

# Specific DAG runs
dagu history my-workflow

# Recent failures and aborted runs for debugging
dagu history my-workflow --status failed,aborted --last 7d

# Date range query
dagu history --from 2026-01-01 --to 2026-01-31

# JSON export for analysis
dagu history --format json --limit 500 > history.json

# CSV export for spreadsheets
dagu history --format csv --limit 500 > history.csv

# Label filtering (AND logic)
dagu history --labels "prod,critical"

# Combined filters
dagu history my-workflow --status failed,partially_succeeded --last 24h --limit 10
```

**Output (table):**
```
DAG NAME      RUN ID                                STATUS     STARTED (UTC)        DURATION  PARAMS
my-workflow   019c1ca4-ba96-7599-80c9-773862801abc  Succeeded  2026-02-02 04:38:03  2m30s     -
my-workflow   019c1ca3-f123-4567-89ab-cdef01234567  Failed     2026-02-01 14:22:15  45s       env=prod
```

**Output (JSON):**
```json
[
  {
    "name": "my-workflow",
    "dagRunId": "019c1ca4-ba96-7599-80c9-773862801abc",
    "status": "succeeded",
    "startedAt": "2026-02-02T04:38:03Z",
    "finishedAt": "2026-02-02T04:40:33Z",
    "duration": "2m30s",
    "params": "",
    "labels": ["prod", "backend"],
    "workerId": "",
    "error": ""
  }
]
```

**Output (CSV):**
```csv
DAG NAME,RUN ID,STATUS,STARTED (UTC),DURATION,PARAMS
my-workflow,019c1ca4-ba96-7599-80c9-773862801abc,Succeeded,2026-02-02 04:38:03,2m30s,-
my-workflow,019c1ca3-f123-4567-89ab-cdef01234567,Failed,2026-02-01 14:22:15,45s,env=prod
```

**Note:** CSV output follows RFC 4180. Fields containing commas, quotes, or newlines are automatically quoted and escaped.

**Error Examples:**
```bash
# Conflicting flags
$ dagu history --last 7d --from 2026-01-01
Error: cannot use --last with --from or --to

# Invalid status
$ dagu history --status invalid
Error: invalid status 'invalid'. Valid values: running, succeeded, failed, ...

# Date validation
$ dagu history --from 2026-02-01 --to 2026-01-01
Error: --from date (2026-02-01) must be before --to date (2026-01-01)
```

**See Also:**
- [`status`](#status) - Current run status
- [`cleanup`](#cleanup) - Remove old run history

### `context`

Manage CLI contexts for local and remote Dagu servers.

```bash
dagu context list
dagu context add <name> [flags]
dagu context update <name> [flags]
dagu context remove <name>
dagu context use <name|local>
dagu context test <name|local>
```

**Add / Update Flags:**
- `--server` - Remote server base URL (`http://` or `https://`)
- `--api-key` - Remote API key (`dagu_...`)
- `--description` - Optional description shown in `dagu context list`
- `--skip-tls-verify` - Skip TLS certificate verification
- `--timeout` - HTTP timeout in seconds

```bash
# List contexts and show the current one
dagu context list

# Add a context (if --api-key is omitted in a terminal, Dagu prompts for it)
dagu context add prod \
  --server https://dagu.example.com \
  --api-key dagu_xxxxxxxxxxxxxxxxxxxx \
  --timeout 60

# Update selected fields
dagu context update prod --description "Production cluster"

# Switch back to the built-in local context
dagu context use local

# Test connectivity
dagu context test prod
```

### `server`

Start the web UI server.

```bash
dagu server [options]
```

**Options:**
- `--host, -s` - Host (default: localhost)
- `--port, -p` - Port (default: 8080)
- `--dags, -d` - DAGs directory

```bash
dagu server                               # Default settings
dagu server --host=0.0.0.0 --port=9000  # Custom host/port
```

### `scheduler`

Start the DAG scheduler daemon.

```bash
dagu scheduler [options]
```

**Options:**
- `--dags, -d` - DAGs directory

```bash
dagu scheduler                  # Default settings
dagu scheduler --dags=/opt/dags # Custom directory
```

### `start-all`

Start scheduler, web UI, and optionally coordinator service.

```bash
dagu start-all [options]
```

**Options:**
- `--host, -s` - Host (default: localhost)
- `--port, -p` - Port (default: 8080)
- `--dags, -d` - DAGs directory
- `--coordinator.host` - Coordinator bind address (default: 127.0.0.1)
- `--coordinator.advertise` - Address to advertise in service registry
- `--coordinator.port` - Coordinator gRPC port (default: 50055)

```bash
# Single instance mode (coordinator disabled)
dagu start-all

# Distributed mode with coordinator enabled
dagu start-all --coordinator.host=0.0.0.0 --coordinator.port=50055

# Production mode
dagu start-all --host=0.0.0.0 --port=9000 --coordinator.host=0.0.0.0
```

**Note:** The coordinator service is only started when `--coordinator.host` is set to a non-localhost address (not `127.0.0.1` or `localhost`). By default, `start-all` runs in single instance mode without the coordinator.

### `validate`

Validate a DAG specification for structural correctness.

```bash
dagu validate [options] DAG_FILE
```

Checks structural correctness and references (e.g., step dependencies) without evaluating variables or executing the DAG. Returns validation errors in a human-readable format.

```bash
dagu validate my-workflow.yaml
```

**Output when valid:**
```
DAG spec is valid: my-workflow.yaml (name: my-workflow)
```

**Output when invalid:**
```
Validation failed for my-workflow.yaml
- Step 'process' depends on non-existent step 'missing_step'
- Invalid cron expression in schedule: '* * * *'
```

### `dry`

Validate a DAG without executing it.

```bash
dagu dry [options] DAG_FILE [-- PARAMS...]
```

**Options:**
- `--params, -p` - Parameters as JSON
- `--name, -N` - Override the DAG name (default: name from DAG definition or filename)
- `--profile` - Runtime profile to use during the dry run

```bash
dagu dry my-workflow.yaml
dagu dry etl.yaml -- DATE=2024-01-01  # With parameters
dagu dry --name my_custom_name my-workflow.yaml  # Override DAG name
dagu dry --profile prod my-workflow.yaml
```

### `enqueue`

Add a DAG to the execution queue.

```bash
dagu enqueue [options] DAG_FILE [-- PARAMS...]
```

**Options:**
- `--run-id, -r` - Custom run ID
- `--params, -p` - Parameters as JSON
- `--name, -N` - Override the DAG name (default: name from DAG definition or filename)
- `--queue, -u` - Override DAG-level queue name for this enqueue
- `--profile` - Runtime profile to apply when the queued run starts

```bash
dagu enqueue my-workflow.yaml
dagu enqueue --run-id=batch-001 etl.yaml -- TYPE=daily
# Enqueue to a specific queue (override)
dagu enqueue --queue=high-priority my-workflow.yaml
# Override DAG name
dagu enqueue --name my_custom_name my-workflow.yaml
# Select a runtime profile
dagu enqueue --profile prod my-workflow.yaml
```

### `profile`

Manage runtime profiles in the local Dagu data directory.

```bash
dagu profile <command>
```

Subcommands:

- `list` - List runtime profiles.
- `show <profile>` - Show profile metadata and entries. Secret values are masked.
- `create <profile>` - Create a profile.
- `enable <profile>` - Enable a disabled profile.
- `disable <profile>` - Disable a profile so new runs cannot use it.
- `delete <profile>` - Delete a profile.
- `set-var <profile> <key> <value>` - Set a plain variable entry.
- `set-secret <profile> <key>` - Set or rotate a secret entry.
- `delete-key <profile> <key>` - Delete one profile entry.

Examples:

```bash
dagu profile create prod --description "Production runtime settings"
dagu profile set-var prod LOG_LEVEL info
printf '%s\n' "$PROD_API_TOKEN" | dagu profile set-secret prod API_TOKEN --value-stdin
dagu profile show prod
```

The `profile` command is local-only. Use [Profiles in the Web UI](/web-ui/profiles) or the REST API for a remote server.

See [Runtime Profiles](/writing-workflows/runtime-profiles) for behavior, permissions, and retry rules.

### `dequeue`

Remove a DAG from the execution queue.

```bash
dagu dequeue <queue-name> --dag-run=<dag-name>:<run-id>  # remove specific run
dagu dequeue <queue-name>                                # pop the oldest item
```

Example:

```bash
dagu dequeue default --dag-run=my-workflow:batch-001
dagu dequeue default
```

### `version`

Display version information.

```bash
dagu version
```

### `config`

Show the resolved filesystem paths used by Dagu.

```bash
dagu config
dagu config --dagu-home /custom/path
```

### `schema`

Browse the JSON schema for DAG definitions or server configuration.

```bash
dagu schema dag
dagu schema dag steps
dagu schema dag steps.container
dagu schema config
dagu schema config server
```

### `example`

List bundled example DAGs or print one example by numeric ID.

```bash
dagu example
dagu example 1
dagu example 7
```

### `completion`

Generate shell completion scripts.

```bash
dagu completion bash
dagu completion fish
dagu completion powershell
dagu completion zsh
```

### `upgrade`

Upgrade the Dagu binary to the latest release or a specified version.

```bash
dagu upgrade --check
dagu upgrade
dagu upgrade --version vX.Y.Z
dagu upgrade --dry-run
```

Use `--yes` to skip prompts in automation. Self-upgrade is unavailable for package-manager or container installs such as Homebrew, Snap, `go install`, and Docker.

### `license`

Activate, deactivate, or check Dagu license status.

```bash
dagu license activate <key>
dagu license check
dagu license deactivate
```

### `cleanup`

Remove old DAG run history for a specified DAG.

```bash
dagu cleanup [options] DAG_NAME
```

**Options:**
- `--retention-days` - Number of days to retain (default: `0` = delete all)
- `--dry-run` - Preview what would be deleted without actually deleting
- `--yes, -y` - Skip confirmation prompt

Active runs (running, queued) are never deleted for safety.

```bash
# Delete all history (with confirmation prompt)
dagu cleanup my-workflow

# Keep last 30 days of history
dagu cleanup --retention-days 30 my-workflow

# Preview what would be deleted
dagu cleanup --dry-run my-workflow

# Delete without confirmation (for scripts)
dagu cleanup -y my-workflow

# Combine options
dagu cleanup --retention-days 7 -y my-workflow
```

**Output:**
```
# Dry run output
Dry run: Would delete 5 run(s) for DAG "my-workflow":
  - 019b1c4b-1b1e-7232-b12d-e822dac72613
  - 019b1c4b-13e1-7251-a713-aaad60dfa88c
  ...

# Actual deletion output
Successfully removed 5 run(s) for DAG "my-workflow"
```

### `sync`

Manage Git sync operations.

```bash
dagu sync <subcommand>
```

Requires `git_sync.enabled: true` in configuration. See [Git Sync](/server-admin/git-sync) for full documentation.

#### `sync status`

Show current sync status.

```bash
dagu sync status
```

Displays repository URL, branch, last sync info, status counts per state, and a table of non-synced items.

#### `sync pull`

Pull changes from remote repository.

```bash
dagu sync pull
```

#### `sync publish`

Publish local changes to remote.

```bash
dagu sync publish <item-id> [options]
dagu sync publish --all [options]
```

**Options:**
- `-m, --message` - Commit message
- `--all` - Publish all modified and untracked items
- `-f, --force` - Force publish even with conflicts

Provide either an item ID or `--all`, not both.

```bash
dagu sync publish my-dag -m "Update dag"
dagu sync publish skills/review -m "Update review skill"
dagu sync publish --all -m "Batch update"
dagu sync publish my-dag --force -m "Overwrite remote"
```

#### `sync discard`

Discard local changes for an item.

```bash
dagu sync discard <item-id> [options]
```

**Options:**
- `-y, --yes` - Skip confirmation prompt

```bash
dagu sync discard my-dag
dagu sync discard skills/review -y
```

#### `sync forget`

Remove state entries for missing, untracked, or conflict items.

```bash
dagu sync forget <item-id> [item-id...] [options]
```

**Options:**
- `-y, --yes` - Skip confirmation prompt

Does not touch files on disk or remote. Rejects `synced` and `modified` items. Accepts multiple item IDs.

```bash
dagu sync forget missing-dag
dagu sync forget item-a item-b item-c -y
```

#### `sync cleanup`

Remove all missing entries from sync state.

```bash
dagu sync cleanup [options]
```

**Options:**
- `--dry-run` - Show what would be cleaned without making changes
- `-y, --yes` - Skip confirmation prompt

Does not touch files on disk or remote.

```bash
dagu sync cleanup --dry-run
dagu sync cleanup -y
```

#### `sync delete`

Delete items from remote repository, local disk, and sync state.

```bash
dagu sync delete <item-id> [options]
dagu sync delete --all-missing [options]
```

**Options:**
- `-m, --message` - Commit message
- `--force` - Force delete even with local modifications
- `--all-missing` - Delete all missing items
- `--dry-run` - Show what would be deleted without making changes
- `-y, --yes` - Skip confirmation prompt

Provide either an item ID or `--all-missing`, not both. Untracked items cannot be deleted (use `forget` instead).

```bash
dagu sync delete my-dag -m "Remove old dag"
dagu sync delete my-dag --force -m "Remove despite modifications"
dagu sync delete --all-missing -m "Clean up missing"
dagu sync delete my-dag --dry-run
dagu sync delete --all-missing --dry-run
```

#### `sync mv`

Atomically rename an item across local filesystem, remote repository, and sync state.

```bash
dagu sync mv <old-id> <new-id> [options]
```

**Options:**
- `-m, --message` - Commit message
- `--force` - Force move even with conflicts
- `--dry-run` - Show what would be moved without making changes
- `-y, --yes` - Skip confirmation prompt

Both source and destination must be of the same kind.

```bash
dagu sync mv old-dag new-dag -m "Rename workflow"
dagu sync mv old-dag new-dag --force -m "Move despite conflict"
dagu sync mv old-dag new-dag --dry-run
```

### External AI Coding Tool Integration

Install the Dagu skill for external AI coding tools with GitHub CLI:

```bash
gh skill install dagucloud/dagu dagu
```

The skill helps AI coding tools write correct Dagu workflow YAML. To let MCP-capable clients operate a running Dagu server, start Dagu and configure the client to use:

```text
http://localhost:8080/mcp
```

For details, run `gh skill install --help` and see [MCP Server](/mcp/).

### `coordinator`

Start the coordinator gRPC server for distributed task execution.

```bash
dagu coordinator [options]
```

**Options:**
- `--coordinator.host` - Host address to bind (default: `127.0.0.1`)
- `--coordinator.advertise` - Address to advertise in service registry (default: auto-detected hostname)
- `--coordinator.port` - Port number (default: `50055`)
- `--coordinator.health-port` - HTTP health check port (default: `8091`, `0` disables)
- `--peer.cert-file` - Path to TLS certificate file for peer connections
- `--peer.key-file` - Path to TLS key file for peer connections
- `--peer.client-ca-file` - Path to CA certificate file for client verification (mTLS)
- `--peer.insecure` - Use insecure connection (h2c) instead of TLS (default: `true`)
- `--peer.skip-tls-verify` - Skip TLS certificate verification (insecure)

```bash
# Basic usage
dagu coordinator --coordinator.host=0.0.0.0 --coordinator.port=50055

# Bind to all interfaces and advertise service name (for containers/K8s)
dagu coordinator \
  --coordinator.host=0.0.0.0 \
  --coordinator.advertise=dagu-server \
  --coordinator.port=50055 \
  --coordinator.health-port=8091

# With TLS
dagu coordinator \
  --peer.insecure=false \
  --peer.cert-file=server.pem \
  --peer.key-file=server-key.pem

# With mutual TLS
dagu coordinator \
  --peer.insecure=false \
  --peer.cert-file=server.pem \
  --peer.key-file=server-key.pem \
  --peer.client-ca-file=ca.pem
```

The coordinator service enables distributed task execution by:
- Automatically registering in the service registry system
- Accepting task polling requests from workers
- Matching tasks to workers based on labels
- Tracking worker health via heartbeats (every 10 seconds)
- Providing task distribution API with automatic failover
- Managing worker lifecycle through file-based registry

When run directly, the coordinator also exposes `GET /health` on `--coordinator.health-port` for per-instance liveness checks. `dagu start-all` does not expose this dedicated coordinator health port.

### `worker`

Start a worker that polls the coordinator for tasks.

```bash
dagu worker [options]
```

**Options:**
- `--worker.id` - Worker instance ID (default: `hostname@PID`)
- `--worker.max-active-runs` - Maximum number of active runs (default: `100`)
- `--worker.health-port` - HTTP health check port (default: `8092`, `0` disables)
- `--worker.labels, -l` - Worker labels for capability matching (format: `key1=value1,key2=value2`)
- `--peer.insecure` - Use insecure connection (h2c) instead of TLS (default: `true`)
- `--peer.cert-file` - Path to TLS certificate file for peer connections
- `--peer.key-file` - Path to TLS key file for peer connections
- `--peer.client-ca-file` - Path to CA certificate file for server verification
- `--peer.skip-tls-verify` - Skip TLS certificate verification (insecure)

```bash
# Basic usage
dagu worker

# With custom configuration
dagu worker \
  --worker.id=worker-1 \
  --worker.max-active-runs=50 \
  --worker.health-port=8092

# With labels for capability matching
dagu worker --worker.labels gpu=true,memory=64G,region=us-east-1
dagu worker --worker.labels cpu-arch=amd64,instance-type=m5.xlarge

# With TLS connection
dagu worker \
  --peer.insecure=false \
  --peer.client-ca-file=ca.pem

# With mutual TLS
dagu worker \
  --peer.insecure=false \
  --peer.cert-file=client.pem \
  --peer.key-file=client-key.pem \
  --peer.client-ca-file=ca.pem

# Temporarily skip certificate verification
dagu worker \
  --peer.insecure=false \
  --peer.client-ca-file=ca.pem \
  --peer.skip-tls-verify
```

Workers automatically register in the service registry system, send regular heartbeats, and poll the coordinator for tasks matching their labels to execute them locally.
Each worker also exposes `GET /health` on `--worker.health-port` for per-instance liveness checks.

## Configuration

Priority: CLI flags > Environment variables > Config file

### Using Custom Home Directory

The `--dagu-home` flag allows you to override the application home directory for a specific command invocation. This is useful for:
- Testing with different configurations
- Running multiple Dagu instances with isolated data
- CI/CD scenarios requiring custom directories

```bash
# Use a custom home directory for this command
dagu --dagu-home=/tmp/dagu-test start my-workflow.yaml

# Start server with isolated data
dagu --dagu-home=/opt/dagu-prod start-all

# Run scheduler with specific configuration
dagu --dagu-home=/var/lib/dagu scheduler
```

When `--dagu-home` is set, it overrides the `DAGU_HOME` environment variable and uses a unified directory structure:
```
$DAGU_HOME/
├── dags/              # DAG definitions
├── logs/              # All log files
├── data/              # Application data
├── suspend/           # DAG suspend flags
├── config.yaml        # Main configuration
└── base.yaml          # Shared DAG defaults
```

### Key Environment Variables

- `DAGU_HOME` - Set all directories to this path
- `DAGU_HOST` - Server host (default: `127.0.0.1`)
- `DAGU_PORT` - Server port (default: `8080`)
- `DAGU_DAGS_DIR` - DAGs directory
- `DAGU_LOG_DIR` - Log directory
- `DAGU_DATA_DIR` - Data directory
- `DAGU_AUTH_BASIC_USERNAME` - Basic auth username
- `DAGU_AUTH_BASIC_PASSWORD` - Basic auth password
