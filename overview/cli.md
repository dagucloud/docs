# Command Line Interface

## Overview

The Dagu CLI provides all the necessary commands to manage and execute DAGs (workflows) directly from the terminal. It allows you to start, stop, retry, and monitor workflows, as well as manage the underlying scheduler and web server.

::: tip Complete Reference
For the full CLI command reference, see [CLI Commands Reference](/getting-started/cli).
:::

## Basic Usage

```bash
dagu [global options] command [command options] [arguments...]
```

### Getting Help

```bash
# General help
dagu --help

# Command-specific help
dagu start --help

# Show version
dagu version
```

## Remote Contexts

The CLI can route context-aware commands to a remote Dagu server through named CLI contexts.

```bash
# Register a remote server
dagu context add staging \
  --server https://staging.example.com \
  --api-key dagu_xxxxxxxxxxxxxxxxxxxx

# Use it for later commands
dagu context use staging

# Or target it explicitly for one command
dagu --context staging status nightly-backup
```

Only these commands are context-aware: `start`, `enqueue`, `status`, `history`, `stop`, `retry`, `restart`, and `dequeue`.

Remote contexts only work with DAGs that already exist on the remote server. Local YAML paths are rejected.

## Essential Commands

### Running Workflows

#### Start a Workflow
```bash
# Basic execution
dagu start my-workflow.yaml

# With named parameters (use -- separator)
dagu start etl.yaml -- DATE=2024-01-01 ENV=prod

# With positional parameters
dagu start my-workflow.yaml -- value1 value2 value3

# Override DAG name
dagu start --name my_custom_name my-workflow.yaml

# Queue for later
dagu enqueue my-workflow.yaml

# Remove a queued run (by queue name)
dagu dequeue default
```

`dagu start` requires a DAG name or file path.

#### Stop a Running Workflow
```bash
# Stop currently running workflow
dagu stop my-workflow

# Stop specific run
dagu stop --run-id=20240101_120000 my-workflow

# Can also use file path
dagu stop my-workflow.yaml
```

#### Restart a Workflow
```bash
# Restart the currently running DAG-run for this workflow
dagu restart my-workflow

# Restart a specific running DAG-run
dagu restart --run-id=20240101_120000 my-workflow
```

#### Retry Failed Workflow
```bash
# Retry specific run (run-id is required)
dagu retry --run-id=20240101_120000 my-workflow

# Can also use file path
dagu retry --run-id=20240101_120000 my-workflow.yaml
```

### Monitoring Workflows

#### Check Status
```bash
# Check latest run status
dagu status my-workflow

# Check specific run status
dagu status --run-id=20240101_120000 my-workflow

# Can also use file path
dagu status my-workflow.yaml
```

#### View Status of a DAG run
```bash
# Check detailed status and output
dagu status my-workflow.yaml

# Note: For detailed logs, use the web UI at http://localhost:8080
# or check log files in the configured log directory
```

#### View Execution History

The `history` command displays past DAG executions with filtering and export capabilities:

```bash
# View recent runs
dagu history my-workflow

# Debug recent failures
dagu history my-workflow --status failed --last 7d

# Export to JSON for analysis
dagu history --format json --limit 500 > history.json

# Export to CSV for spreadsheets
dagu history --format csv > history.csv

# Filter by tags (AND logic)
dagu history --tags "prod,critical"
```

**Key features:**
- Default: last 30 days, 100 results
- Date filters: absolute (`--from`/`--to`) or relative (`--last 7d`)
- Status filters: `succeeded`, `failed`, `running`, etc. (with aliases)
- Output: table (default), JSON, or CSV
- Run IDs never truncated

See [`history` reference](/getting-started/cli#history) for all options.

### Testing and Validation

#### Validate DAG Specification
```bash
# Validate DAG structure and references
dagu validate my-workflow.yaml

# Returns human-readable validation errors if any
```

#### Dry Run
```bash
# Test DAG execution without running it
dagu dry my-workflow.yaml

# With parameters
dagu dry my-workflow.yaml -- DATE=2024-01-01

# Override DAG name
dagu dry --name my_custom_name my-workflow.yaml
```

### Server Commands

#### Start Everything
```bash
# Start scheduler, web UI, and coordinator service (default: localhost:8080)
dagu start-all

# Custom host and port
dagu start-all --host=0.0.0.0 --port=9000

# Custom DAGs directory
dagu start-all --dags=/path/to/directory
```

#### Start Scheduler Only
```bash
# Run just the scheduler (no UI)
dagu scheduler

# Custom DAGs directory
dagu scheduler --dags=/opt/workflows
```

#### Start Web UI Only
```bash
# Run just the web server (no scheduler)
dagu server

# Custom host and port
dagu server --host=0.0.0.0 --port=9000

# Custom DAGs directory
dagu server --dags=/path/to/directory
```

### Distributed Execution Commands

#### Start Coordinator
```bash
# Start the coordinator gRPC server
dagu coordinator

# Custom host and port
dagu coordinator --coordinator.host=0.0.0.0 --coordinator.port=50055

# With TLS
dagu coordinator \
  --peer.cert-file=server.pem \
  --peer.key-file=server-key.pem
```

The coordinator service manages task distribution to workers for distributed execution with automatic service registry and health monitoring.

#### Start Worker
```bash
# Start a worker that polls for tasks
dagu worker

# With labels for capability matching
dagu worker --worker.labels gpu=true,memory=64G,region=us-east-1

# With custom worker ID and concurrency
dagu worker \
  --worker.id=gpu-worker-01 \
  --worker.max-active-runs=50
```

Workers automatically register in the service registry system and poll the coordinator for matching tasks based on their labels.

### AI Coding Tool Integration

#### Install Dagu Skill
Use Dagu's built-in installer:

```bash
dagu ai install --skills-dir ~/.agents/skills
```

Or use the shared `skills` CLI:

```bash
npx skills add https://github.com/dagu-org/dagu --skill dagu
```

See [CLI Commands](/getting-started/cli#ai) for more details.

## Advanced Usage

### Queue Management

```bash
# Add to queue
dagu enqueue my-workflow.yaml

# Add to queue with custom ID
dagu enqueue --run-id=custom-001 my-workflow.yaml

# Add to queue with parameters
dagu enqueue my-workflow.yaml -- KEY=value

# Add to queue using a specific queue (override)
dagu enqueue --queue=high-priority my-workflow.yaml

# Override DAG name
dagu enqueue --name my_custom_name my-workflow.yaml

# Remove next item from queue
dagu dequeue default

# Remove specific run from queue
dagu dequeue default --dag-run=my-workflow:custom-001
```

### Working with Parameters

Parameters can be passed in multiple ways:

```bash
# Positional parameters (use -- separator)
dagu start my-workflow.yaml -- param1 param2 param3

# Named parameters (use -- separator)
dagu start my-workflow.yaml -- KEY1=value1 KEY2=value2

# Mixed (use -- separator)
dagu start my-workflow.yaml -- param1 KEY=value param2
```

## CLI Configuration

### Global Options

| Option | Description | Default |
|--------|-------------|---------|
| `--config` | Config file path | `~/.config/dagu/config.yaml` |
| `--log-level` | Log verbosity | `info` |
| `--log-format` | Output format | `text` |
| `--quiet` | Suppress output | `false` |

## See Also

- [Explore the REST API](/overview/api) for programmatic access
- [Set up the Web UI](/overview/web-ui) for visual monitoring
- [Learn workflow syntax](/writing-workflows/) to build complex DAGs
- [Configure distributed execution](/server-admin/distributed/) for scaling workflows
