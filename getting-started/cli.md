# CLI Reference

Commands accept either DAG names (from YAML `name` field) or file paths.

- Both formats: `start`, `stop`, `status`, `retry`
- File path only: `dry`, `enqueue`
- DAG name only: `restart`
- History by DAG name or YAML path; definition by filename, stem, or configured path: `rm`
- Local-only commands: `ls`, `rm`, `profile`, `ps`, `human-task complete`, `human-task push-back`, `browser cache clear`, `browser session`, `computer check`, `computer cache clear`, `xlsx inspect`, `xlsx read`, `xlsx cache clear`

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

`--server` is the REST API base URL, not the Web UI URL. The default API path is `/api/v1`. If the server uses `base_path: /dagu`, use `https://example.com/dagu/api/v1`.

```bash
# Add a remote server
dagu context add staging \
  --server https://staging.example.com/api/v1 \
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
- `--no-reuse` - Recompute eligible build steps instead of reusing prior materializations
- `--only` - Run only this step (name or ID); repeatable. Every other step is recorded as skipped
- `--outputs-from` - Finished run of the same DAG whose step outputs and work directory feed the steps selected by `--only`
- `--output` - Output of a step skipped by `--only`, as `<step>.<name>=<value>`; repeatable, and wins over `--outputs-from`

> **Note:** `--from-run-id` cannot be combined with `--params`, `--parent`, or `--root`. Provide exactly one DAG name or file so the command can look up the historic run.

> **Note:** `--only` starts a new run of the current definition, with its env, secrets, and params, under the DAG's own name. Only the selected steps run. Lifecycle handlers and preconditions apply as usual.
> - A skipped step's outputs come from `--outputs-from`, `--output`, or neither. Without them, a `${steps.<id>.outputs.<name>}` reference to a skipped step stays unresolved.
> - With `--outputs-from`, only steps that succeeded in that run contribute outputs, and their work-directory files are copied into the new run.
> - `--output` sets a declared output, or any name when the step declares none. Naming the step's `output: VAR` sets that variable instead. See [Running One Step](/writing-workflows/outputs#running-one-step).
> - `--only` cannot be combined with `--from-run-id`, `--parent`, or `--root`, and is not supported for agent DAGs.
> - Retrying a failed `--only` run follows normal retry rules, so steps downstream of the failed step run too; use `dagu retry --step` to re-run one step.

```bash
# Basic run
dagu start my-workflow.yaml

# With parameters (note the -- separator)
dagu start etl.yaml -- DATE=2024-01-01 ENV=prod

# Custom run ID
dagu start --run-id batch-001 etl.yaml

# Select a runtime profile
dagu start --profile prod etl.yaml

# Recompute every eligible build step
dagu start --no-reuse report-pipeline.yaml

# Override DAG name
dagu start --name my_custom_name my-workflow.yaml

# Clone parameters from a historic run
dagu start --from-run-id 20241031_235959 example-dag.yaml

# Run one step on its own
dagu start --only scrape example-dag.yaml

# Run two steps with the outputs of an earlier run
dagu start --only test --only report --outputs-from 20241031_235959 example-dag.yaml

# Run one step with an upstream output supplied by hand
dagu start --only fetch --output login.token=abc123 example-dag.yaml
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

Retry a previous DAG run using the same run ID.

```bash
dagu retry [options] DAG_NAME_OR_FILE
```

**Options:**
- `--run-id, -r` - Run to retry (required)
- `--step` - Retry only the named step
- `--downstream` - Also retry reachable descendants of `--step`; requires `--step`
- `--sub-run-id` - Select a persisted child run containing `--step`; requires `--step`
- `--bypass-preconditions` - Skip step preconditions for the selected retry steps; requires `--step` and a local CLI context

```bash
dagu retry --run-id=20240101_120000 my-workflow

# Retry a step whose precondition is no longer satisfied
dagu retry --run-id=20240101_120000 --step=upload --bypass-preconditions my-workflow

# Also retry its downstream steps, bypassing their step preconditions
dagu retry --run-id=20240101_120000 --step=upload --downstream --bypass-preconditions my-workflow
```

For example, an upload step may fail before a 10 AM cutoff and become ready to retry after that cutoff. A normal retry checks the time precondition again and skips the step. `--bypass-preconditions` allows that retry to execute.

The override applies only to this retry. Unrelated steps, lifecycle handlers, and DAG-level preconditions keep their normal behavior. The workflow definition is unchanged, and a later retry without the flag checks preconditions again.

Retrying a parent step does not bypass preconditions inside its child DAGs, including automatic child step retries. Use `--sub-run-id` with `--step` to target a step inside a child DAG.

`--bypass-preconditions` is unavailable with a remote CLI context. A local-context retry can still target a child run hosted on a worker; see [retrying child runs](/writing-workflows/sub-dags#observing-and-retrying-child-runs).

Retries inherit the original run's runtime profile. `dagu retry` does not accept `--profile`.

### `human-task complete`

Complete a waiting [`human.task`](/writing-workflows/human-tasks) step and enqueue the same DAG run when the completion unblocks a step or no other manual steps remain waiting.

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

The command is local-only and rejects remote CLI contexts, but the target root DAG run may have executed locally or on a distributed worker. Human tasks are not supported in sub-DAGs. Each resume enqueues the run; completion never starts it immediately. Keep the scheduler running so the queued run can resume. See [Human Tasks](/writing-workflows/human-tasks#completing-a-task-from-the-cli) for form validation, persistence, idempotency, and recovery behavior.

### `human-task push-back`

Send a waiting [`human.task`](/writing-workflows/human-tasks#requesting-changes) step that declares `with.push_back` back to its rewind target. The rewind target and every step that depends on it, directly or transitively, run again with the feedback, then the task opens again.

```bash
dagu human-task push-back [options] DAG_NAME
```

**Options:**

- `--run-id, -r` - Root DAG-run ID containing the waiting task (required)
- `--step` - Explicit human-task step ID (required)
- `--input key=value` - String feedback value, repeatable for multiple properties
- `--inputs-json object` - Typed feedback as one JSON object
- `--expected-iteration n` - Fail unless the task is at this push-back iteration (`0` before the first push-back)

```bash
dagu human-task push-back \
  --run-id review-42 \
  --step review \
  --input feedback="Add coverage for the empty input case" \
  --expected-iteration 0 \
  review-loop
```

Feedback is validated against `with.push_back.form` with the same parsing rules as completion and is limited to 16 KiB as JSON. The command prints `Pushed back human task <step> to <target>;` followed by whether the DAG-run was queued for resume or remains waiting. The push-back is stored before the run is queued; if queueing fails, run the same command again. Until the task opens again, an identical repeat only retries the queue and prints `Human task <step> was already pushed back to <target>`. Like `human-task complete`, the command is local-only.

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

### `ps`

List DAG runs with a fresh heartbeat in the local process store.

```bash
dagu ps [options]
```

**Options:**

- `--dag, -d` - Filter by exact DAG name
- `--run-id, -r` - Filter by run ID; partial matches are accepted

```bash
# List all running processes
dagu ps

# List processes for one DAG
dagu ps --dag my-workflow

# Combine the DAG filter with a partial run ID
dagu ps -d my-workflow -r 019c1ca4
```

The output includes the DAG name, run ID, attempt ID, UTC start time, process group, and heartbeat freshness. The process group is the configured queue name, or the DAG name when the DAG does not use a queue. Stale process entries are omitted.

`dagu ps` is local-only and reads the process store configured for the local Dagu installation. If the current CLI context is remote, select the built-in local context explicitly:

```bash
dagu --context local ps
```

### `ls`

List DAG definitions in the local Dagu installation. An optional pattern filters by a substring of the DAG name or filename.

```bash
dagu ls [options] [PATTERN]
```

**Options:**

- `--next, -n` - Show the next scheduled run and sort by it, earliest first
- `--last, -l` - Show the latest run status and start time
- `--history, -H` - Show a compact summary of the five most recent run statuses
- `--sort-last, -t` - Sort by latest run time, newest first
- `--reverse, -r` - Reverse the selected sort direction

```bash
# List all local DAG definitions
dagu ls

# Filter by DAG name or filename
dagu ls nightly

# Show the scheduler's next-run projection and latest run details
dagu ls -n -l

# Sort by latest run, oldest first
dagu ls -t -r

# Show recent status history for matching DAGs
dagu ls -H batch-
```

`NEXT_RUN` follows the scheduler's recorded projection for both display and sorting. Suspended DAGs and profile-scoped schedules that are inactive for the DAG's effective default profile show `-`, as does every DAG while the [scheduler is paused](/writing-workflows/scheduling#pausing-the-scheduler). A pending one-off schedule keeps its scheduled timestamp after it becomes overdue until the scheduler marks it consumed. See [Scheduling](/writing-workflows/scheduling) for schedule behavior and profile activation rules.

`dagu ls` is local-only. If a remote CLI context is selected, target the built-in local context explicitly:

```bash
dagu --context local ls -n
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
- [`rm`](#rm) - Remove run history or a DAG definition

### `rm`

Remove DAG run history, the DAG YAML definition, or both. At least one of `--history` or `--definition` is required.

```bash
dagu rm [options] DAG
```

**Options:**

- `--history, -H` - Delete DAG run history
- `--definition, -d` - Delete the DAG YAML definition
- `--older-than, -t` - With `--history`, delete runs older than a duration such as `10d`, `24h`, or `1w`; when omitted, delete all history
- `--force, -f` - Skip the confirmation prompt
- `--dry-run` - Preview deletions without changing history or the definition

History removal also deletes the logs and artifact directories recorded for each removed run. Removing all history, without `--older-than`, also clears the DAG's [browser](/step-types/browser#replay-cache) and [computer](/step-types/computer#replay-cache) replay caches on this host; `--dry-run` lists them. Active runs are preserved. Definition removal is refused while the DAG has an active local or distributed run.

With `--definition`, identify the DAG by its filename, file stem, or configured path. If the YAML `name` differs from its filename, Dagu resolves the definition first and removes history under the configured DAG name.

```bash
# Preview all history that would be removed
dagu rm --history --dry-run my-workflow

# Remove history older than 30 days
dagu rm -H --older-than 30d my-workflow

# Remove only the YAML definition
dagu rm --definition my-workflow.yaml

# Remove history and the YAML definition together
dagu rm -H -d my-workflow.yaml

# Skip confirmation in a non-interactive script
dagu rm -H -t 24h --force my-workflow
```

The command prompts before making changes unless `--force` is set. `--quiet` suppresses regular output but does not bypass confirmation. Definition-only removal leaves run history intact; include `--history` to remove both.

`dagu rm` is local-only. If a remote CLI context is selected, target the built-in local context explicitly:

```bash
dagu --context local rm -H my-workflow
```

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
- `--server` - Remote API base URL, including its API path
- `--api-key` - Remote API key (`dagu_...`)
- `--description` - Optional description shown in `dagu context list`
- `--skip-tls-verify` - Skip TLS certificate verification
- `--timeout` - HTTP timeout in seconds

```bash
# List contexts and show the current one
dagu context list

# Add a context (if --api-key is omitted in a terminal, Dagu prompts for it)
dagu context add prod \
  --server https://dagu.example.com/api/v1 \
  --api-key dagu_xxxxxxxxxxxxxxxxxxxx \
  --timeout 60

# Update selected fields
dagu context update prod --description "Production cluster"

# Switch back to the built-in local context
dagu context use local

# Test connectivity
dagu context test prod
```

`context add` and `context use` only update local context settings. Run `context test` to verify the API URL, credentials, and network connection.

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

**Note:** The coordinator service starts only when `--coordinator.host` is set to a non-localhost address (not `127.0.0.1` or `localhost`). By default, `start-all` runs in single instance mode without the coordinator.

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
- `--no-reuse` - Preview a build run with reuse disabled

```bash
dagu dry my-workflow.yaml
dagu dry etl.yaml -- DATE=2024-01-01  # With parameters
dagu dry --name my_custom_name my-workflow.yaml  # Override DAG name
dagu dry --profile prod my-workflow.yaml
dagu dry --no-reuse report-pipeline.yaml
```

### `browser cache clear`

Clear the recorded `act` operations that [browser steps](/step-types/browser#replay-cache) replay, so the next run asks the model again.

```bash
dagu browser cache clear [options] DAG
```

**Options:**
- `--step` - Clear only the step with this ID, or its name when the step has no ID

Without `--step`, every step of the DAG is cleared. The cache lives on the host that ran the step; in distributed mode, run the command on the worker.

```bash
dagu browser cache clear billing
dagu browser cache clear billing --step login
```

### `browser session`

Work a site in a browser kept open between commands, one operation at a time, and turn what worked into a [browser step](/step-types/browser#building-a-step-in-a-browser-session). Every command prints one JSON object. A command that fails prints `{"error": {"code", "message"}}` and exits 1; the codes are `invalid_input`, `session_not_found`, `session_busy`, `session_ended`, `model_required`, `profile_in_use`, `launch_failed`, `operation_failed`, `export_invalid`, and `failed`. Sessions are kept on the host that runs the commands.

#### `browser session open`

Open a browser, go to the URL if given, and leave the browser waiting for the session's commands.

```bash
dagu browser session open [options] [URL]
```

**Options:**
- `--provider`, `--model`, `--base-url`, `--api-key-name` - The model acts, extracts, and judged conditions ask. The API key is read from the environment variable named by `--api-key-name`, or the provider's usual one, on every command
- `--llm` - The model as a step's `llm` field, in YAML or JSON, such as `'{provider: openai, model: gpt-5-mini}'`; use it or the flags above
- `--profile` - Keep cookies and storage under this profile, shared with browser steps that name it
- `--headed` - Show the browser window
- `--viewport` - Size of the page area, as `WIDTHxHEIGHT`
- `--executable`, `--proxy` - As in a step's `browser` options
- `--allowed-domain` - Keep the browser on this host or `*.domain`; repeat for more
- `--idle-timeout` - Close the browser when no command arrives for this long (default: `30m`, at most `24h`)
- `--outline-chars` - Most characters of the page outline to report (default: `4000`; `0` leaves it out)

The result carries the session `id` the other commands take, the page's `url`, `title`, and `outline`, and `cdp_url`, the browser's DevTools address, where an application can show the page and let a person act on it. Without a model, the session runs only operations that need none.

#### `browser session do`

Read one operation from stdin, in JSON or YAML, and run it in the session.

```bash
echo '{"act": "Click the Sign in button"}' | dagu browser session do [options] ID
```

**Options:**
- `--outline-chars` - Most characters of the page outline to report (default: `4000`)

The operation is written as an item of a browser step's `with.do`: `goto`, `act`, `extract`, `expect`, `wait`, or `screenshot`, with `when` and `timeout`. Give the values of the variables an act uses under `variables`:

```json
{"act": "Type %password% into the Password field",
 "variables": {"password": {"env": "PORTAL_PASSWORD"}}}
```

A variable given as `{"env": NAME}` is read from the environment on this and every later command of the session, which then need it set, and is masked like a secret in everything the session reports. A plain string serves this command only. Values are never kept.

An element the outline shows with its ID can be acted on by that ID, without the model: `{"click": "0-131"}`, `{"type": {"into": "0-229", "text": "%user%"}}`, or `{"select": {"in": "0-106", "option": "未出荷"}}`. The session keeps each as the act a step writes, such as `Click the "Sign in" button`, reported as `act`, with the action it took as the act's recording.

The result reports the operation's `index` in the session's history, its `status` (`done`, `failed`, or `skipped` when its `when` does not hold), the `actions` an act performed and whether an exported step replays them (`recorded`), what an extract read (`outputs`), saved files, accepted dialogs, blocked requests, `tokens`, and the page the browser is on next with its `outline`. A failed operation exits 1, but the session stays open.

#### `browser session describe`

Report what the session's page shows, without asking a model.

```bash
dagu browser session describe [options] ID
```

**Options:**
- `--find` - Show only the outline's entries containing this text, with the entries they sit in
- `--max-chars` - Most characters of the outline (default: `8000`)
- `--tree` - Report the page's accessibility tree as the model sees it, in place of the outline
- `--screenshot` - Also save a screenshot of the page under this name
- `--format, -f` - `json` (default) or `text`

The outline lists headings, fields with their labels, selects with their choice and options, buttons, checkboxes, links with their addresses, messages, and tables and lists by their columns and rows, the page's own content before the site's header, menus, and footer. Each element `do` can act on shows its ID in brackets, and a link to the page's own site shows its path; a long run of alike rows shows the first three and counts the rest. Text typed into fields is never shown.

#### `browser session export`

Build a `browser.run` step from the operations the session ran.

```bash
dagu browser session export [options] ID
```

**Options:**
- `--dag` - The DAG the step goes in, by name or YAML file path (required)
- `--step` - The step's ID (required)
- `--skip` - Leave out the operation with this index in the session's history; repeat for more
- `--dry-run` - Build the step without writing its recordings
- `--close` - Close the session afterwards
- `--format, -f` - `json` (default), or `yaml` for the step alone

The step holds the operations that succeeded and those skipped because their `when` did not hold, in order; failed operations and screenshots are left out. A variable read from the environment becomes `${NAME}`, which the DAG declares under its secrets; a literal one becomes a parameter of its own name. The acts' recordings are written to the step's replay cache on this host, so its first run replays them without a model request when it meets the pages the session met. A session whose browser has closed can still be exported for a day.

#### `browser session close`

Close the session's browser and remove the session with its history.

```bash
dagu browser session close [--force] [--keep] ID
```

`--force` closes it even while another command holds it. `--keep` ends the session instead: its browser closes and its profile is free for a step, and its history can still be exported for a day.

#### `browser session list`

List the host's sessions, oldest first, after closing those idle past their timeout. Each has a `state`: `idle` while it waits for a command, `busy` while one runs, or `ended` once its browser closed.

```bash
dagu browser session list
```

### `computer check`

Check that [computer steps](/step-types/computer) can capture the screen and send input on this host. Run it as the same user and in the same session as the worker that runs computer steps.

```bash
dagu computer check [--format json]
```

**Options:**
- `--format`, `-f` - Output format: `text` (default) or `json`

On macOS, the command also asks macOS to show the Screen Recording and Accessibility prompts for the permissions that are missing. Grant Screen Recording and Accessibility to the application that starts Dagu, such as Terminal, or to the `dagu` binary when it runs on its own. On Windows, the worker must run in a logged-in user session, not as a service, and the screen must stay unlocked.

**Output:**
```
System:  darwin
Display: 3024x1964 pixels
Ready:   computer steps can operate this desktop
```

When the desktop cannot be automated, the command prints a `Problem:` line for each missing condition and exits nonzero.

With `--format json`, it prints one object for programs to read, and exits nonzero the same way:

```json
{
  "os": "darwin",
  "width": 3024,
  "height": 1964,
  "ready": false,
  "problems": [
    {
      "code": "accessibility",
      "message": "Accessibility permission is missing; grant it in System Settings > Privacy & Security > Accessibility"
    }
  ]
}
```

`width` and `height` are `0` when the display size is unknown, and `problems` is empty when `ready` is `true`. Each problem has one of these codes:

| Code | Meaning |
|------|---------|
| `unsupported` | The system is not macOS or Windows. |
| `load_failed` | The macOS system frameworks could not be loaded. |
| `no_session` | There is no graphical login session (macOS). |
| `other_session` | Another user's session has the display (macOS). |
| `service_session` | The process runs as a Windows service, in session 0. |
| `screen_locked` | The screen is locked, or on Windows a secure prompt is shown. |
| `screen_recording` | Screen Recording permission is missing (macOS). |
| `accessibility` | Accessibility permission is missing (macOS). |
| `no_display` | The display size is unavailable. |

### `computer cache clear`

Clear the recorded `act` operations that computer steps replay, so the next run asks the model again.

```bash
dagu computer cache clear [options] DAG
```

**Options:**
- `--step` - Clear only the step with this ID, or its name when the step has no ID

Without `--step`, every step of the DAG is cleared. The cache lives on the host that ran the step; in distributed mode, run the command on the worker.

```bash
dagu computer cache clear invoices
dagu computer cache clear invoices --step post
```

### `xlsx inspect`

Describe every sheet of a workbook before writing [xlsx steps](/step-types/xlsx) for it: its used range, the detected data block, the header row and column names, the type and a profile of each column, the number of data rows, its tables, and a few typed sample rows. Named ranges and the date system are listed for the workbook. This is what `xlsx.info` publishes, read straight from the file; nothing is written and no run is created.

Types and the profile come from every data row of the block, up to 5000: how many cells are filled and blank, how many distinct values there are, the values themselves when a few repeat, the lowest and highest number or date, and the cells that do not read as the column's type, such as `未定` in a number column. The text format shows the profile after each column name:

```text
Columns: 状態 (string: 済, 未; 40 blank), 数量 (number; 1..250; 1 odd: D300 "未定")
```

```bash
dagu xlsx inspect <path> [options]
```

**Options:**
- `--sheet` - Describe this sheet only
- `--rows`, `-n` - Typed sample rows to show per sheet (default: 5)
- `--format`, `-f` - Output format: `text` (default) or `json`

```bash
dagu xlsx inspect orders.xlsx
dagu xlsx inspect orders.xlsx --sheet Orders --rows 10
dagu xlsx inspect orders.xlsx --format json
```

With `--format json`, the result is one object with `path`, `date_system`, `sheets` (each with `name`, `used_range`, `range`, `header_row`, `headers`, `types`, `row_count`, `columns`, `profile_truncated`, `tables`, and `sample`), `named_ranges`, and `warnings`. Each entry of `columns` has `name`, `type`, `filled`, `blank`, `distinct`, and, when there is something to report, `values`, `min`, `max`, `odd`, and `odd_cells`; see [Looking at a Workbook First](/step-types/xlsx#looking-at-a-workbook-first). The command exits nonzero with the error on stderr when the file cannot be read.

### `xlsx read`

Print the rows of a sheet the way `xlsx.read` publishes them: numbers stay numbers, dates become ISO 8601 text, text keeps its leading zeros, and each row carries `_row`, its sheet row number.

```bash
dagu xlsx read <path> [options]
```

**Options:**
- `--sheet` - Sheet name; the first sheet by default
- `--range` - Cell range, `Sheet!A2:F` reference, named range, or table name
- `--header` - `true` (default), `false`, a row number, or rows such as `3,4`
- `--columns` - Columns to keep, comma-separated, with optional `name:alias` renames
- `--max-rows` - Most rows to print (default: 5000)
- `--format`, `-f` - Output format: `text` (default) or `json`

```bash
dagu xlsx read orders.xlsx
dagu xlsx read orders.xlsx --sheet Orders --range A2:F --header false
dagu xlsx read orders.xlsx --columns "Invoice No,Amount" --format json
```

The text format prints a tab-separated header line and one line per row. With `--format json`, the result is one object with `rows`, `count`, `headers`, `sheet`, `range`, `warnings`, and `truncated`.

### `xlsx cache clear`

Remove the cells an [`xlsx.extract`](/step-types/xlsx#extracting-fields-from-a-form) step cached by sheet layout on this host, so its next run asks the model again.

```bash
dagu xlsx cache clear [options] DAG
```

**Options:**
- `--step` - Clear one step by its ID or name; by default every extract step of the DAG

```bash
dagu xlsx cache clear quotes
dagu xlsx cache clear quotes --step fields
```

Prints `Removed xlsx replay cache for step "fields" of DAG "quotes"` for each step cleared, or `No xlsx replay cache for DAG "quotes"`. `dagu rm --history` removes the cache together with the run history.

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
- `--no-reuse` - Recompute eligible build steps when the queued run starts

```bash
dagu enqueue my-workflow.yaml
dagu enqueue --run-id=batch-001 etl.yaml -- TYPE=daily
# Enqueue to a specific queue (override)
dagu enqueue --queue=high-priority my-workflow.yaml
# Override DAG name
dagu enqueue --name my_custom_name my-workflow.yaml
# Select a runtime profile
dagu enqueue --profile prod my-workflow.yaml
dagu enqueue --no-reuse report-pipeline.yaml
```

See [Build Workflows](/writing-workflows/incremental-workflows) for reuse decisions and dry-run behavior.

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

### `secret`

Read secrets from the local Dagu data directory.

```bash
dagu secret resolve <ref> [--workspace <name>]
```

`resolve` prints the current value of a [DAG secret ref](/web-ui/secrets) to stdout without a trailing newline. With `--workspace`, it checks that workspace first and then Global, like a DAG run. It fails for an unknown workspace and for disabled, missing, or empty secrets.

```bash
export OPENAI_API_KEY="$(dagu secret resolve prod/openai-api-key)"
```

Each read is recorded in the [audit log](/server-admin/server#audit-logging) when audit logging is enabled. If the entry cannot be written, the value is not printed.

The `secret` command is local-only. The Web UI and REST API do not return secret values.

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

`cleanup` is a deprecated compatibility alias for `dagu rm --history`. It removes DAG run history only; use `dagu rm --definition` to remove a DAG YAML definition.

```bash
dagu cleanup [options] DAG_NAME
```

**Options:**
- `--retention-days` - Number of days to retain (default: `0` = delete all)
- `--dry-run` - Preview what would be deleted without actually deleting
- `--yes, -y` - Skip confirmation prompt

Active runs (running, queued) are never deleted for safety. Unlike `dagu rm --history`, it does not clear the DAG's browser and computer replay caches; use `dagu browser cache clear` or `dagu computer cache clear`.

```bash
# Deprecated: delete all history
dagu cleanup my-workflow

# Preferred equivalent
dagu rm --history my-workflow

# Deprecated: keep the last 30 days
dagu cleanup --retention-days 30 my-workflow

# Preferred equivalent
dagu rm -H --older-than 30d my-workflow

# Preview without deleting
dagu cleanup --dry-run my-workflow
dagu rm -H --dry-run my-workflow

# Skip confirmation
dagu cleanup -y my-workflow
dagu rm -H --force my-workflow
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

Manage Git synchronization for workflows, Wiki content, and supporting files.

```bash
dagu sync <subcommand>
```

Requires `git_sync.enabled: true` in configuration. See [Git Sync](/server-admin/git-sync) for full documentation.

#### `sync status`

Show current sync status.

```bash
dagu sync status
```

Displays repository URL, branch, last sync info, status counts per state, and a table of non-synced items. Supporting-file IDs include their file extensions.

#### `sync pull`

Pull changes from remote repository.

```bash
dagu sync pull
```

Reports how many items were synchronized and how many unchanged local supporting files were removed after a remote deletion. Locally edited files remain as conflicts.

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
dagu sync publish wiki/operations/runbook -m "Update runbook"
dagu sync publish scripts/report.py -m "Update report script"
dagu sync publish skills/review/SKILL.md -m "Update review skill"
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
dagu sync discard scripts/report.py -y
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
dagu sync delete wiki/operations/runbook -m "Remove old runbook"
dagu sync delete scripts/report.py -m "Remove report script"
dagu sync delete my-dag --force -m "Remove despite modifications"
dagu sync delete --all-missing -m "Clean up missing"
dagu sync delete my-dag --dry-run
dagu sync delete --all-missing --dry-run
```

#### `sync mv`

Rename a tracked item locally and in the remote repository.

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
dagu sync mv wiki/operations/runbook wiki/operations/deploy -m "Rename runbook"
dagu sync mv scripts/report.py scripts/render.py -m "Rename report script"
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
- Accepting task polling requests from workers
- Matching tasks to workers based on labels
- Tracking worker health via heartbeats
- Providing task distribution API with automatic failover
- Receiving run status, logs, artifacts, and state requests over gRPC

When run directly, the coordinator also exposes `GET /health` on `--coordinator.health-port` for per-instance liveness checks. `dagu start-all` does not expose this dedicated coordinator health port.

### `worker`

Start a worker that polls the coordinator for tasks.

```bash
dagu worker [options]
```

**Options:**
- `--worker.coordinators` - Required coordinator addresses (format: `host1:port1,host2:port2`)
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
export DAGU_WORKER_COORDINATORS=coordinator-1:50055

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

Workers connect to the configured coordinators, send regular heartbeats, and poll for tasks matching their labels. They report status, logs, artifacts, and state operations over gRPC.
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
│   └── suspend/       # DAG suspend flags
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
