# Architecture

Understanding how Dagu works under the hood.

## Design Philosophy

Dagu follows a simple philosophy: **do one thing well with minimal dependencies**.

For operating choices across single-server, temporary-worker, and distributed-worker topologies, see [Deployment Models](/overview/deployment-models).

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User Interfaces                     │
├─────────────┬──────────────────┬────────────────────────────┤
│     CLI     │     Web UI       │         REST API           │
└─────────────┴──────────────────┴────────────────────────────┘
                              │
┌─────────────────────────────┴───────────────────────────────┐
│                        Core Engine                          │
├─────────────┬──────────────────┬────────────────────────────┤
│  Scheduler  │     Agent        │  Execution Scheduler       │
├─────────────┼──────────────────┼────────────────────────────┤
│ DAG Loader  │    Executors     │    Persistence Layer       │
└─────────────┴──────────────────┴────────────────────────────┘
                              │
┌─────────────────────────────┴───────────────────────────────┐
│                      Storage Layer                          │
├─────────────┬──────────────────┬────────────────────────────┤
│  DAG Files  │    Log Files     │    State Files             │
└─────────────┴──────────────────┴────────────────────────────┘
```

## Core Components

### 1. DAG Loader
- Loads YAML workflow definitions and builds DAG structure
- Validates DAG syntax and dependencies

### 2. Scheduler
- Monitors and triggers DAGs based on cron expressions
- Consumes queued DAG runs and executes them
- Supports high availability through directory-based locking
- Automatic failover when primary scheduler fails
- See [Scheduling](/writing-workflows/scheduling) for details

### 3. Agent
- Manages complete lifecycle of a single DAG run
- Handles Unix socket communication for status updates
- Writes logs and updates run status

### 4. Executors
- Shell: Runs shell commands in subprocesses
- Docker: Executes in containers
- SSH: Remote command execution
- HTTP: Makes API requests
- Mail: Sends email notifications
- JQ: JSON data processing

### 5. Persistence Layer
- DAG Store: Manages DAG definitions
- DAG-run Store: Tracks execution history and attempts
- Proc Store: Process heartbeat tracking
- Queue Store: Dual-priority queue system
- By default, Dagu keeps workflows, history, and logs under `~/.config/dagu/` and `~/.local/share/dagu/`
- You can move those locations with the `DAGU_HOME` environment variable or configuration options

## Storage Architecture

Dagu follows the XDG Base Directory specification for file organization:

```
~/.config/dagu/
├── dags/              # Workflow definitions
│   ├── my-workflow.yaml
│   └── another-workflow.yaml
├── config.yaml        # Main configuration
└── base.yaml          # Shared base configuration

~/.local/share/dagu/
├── data/              # Main data directory
│   ├── dag-runs/      # Workflow execution history & state (hierarchical)
│   │   └── my-workflow/
│   │       └── dag-runs/
│   │           └── 2024/           # Year
│   │               └── 03/         # Month
│   │                   └── 15/     # Day
│   │                       └── dag-run_20240315_120000Z_abc123/
│   │                           ├── attempt_20240315_120001_123Z_def456/
│   │                           │   ├── status.jsonl     # Status updates (JSON Lines)
│   │                           │   ├── step1.stdout.log # Step stdout
│   │                           │   ├── step1.stderr.log # Step stderr
│   │                           │   └── step2.stdout.log
│   │                           └── subdags/           # Sub DAG runs (nested workflows)
│   │                               └── sub_xyz789/
│   │                                   └── attempt_20240315_120002_456Z_ghi012/
│   │                                       └── status.jsonl
│   ├── queue/         # File-based execution queue
│   │   └── my-workflow/
│   │       ├── item_high_20240315_120000_123Z_priority1.json  # High priority
│   │       └── item_low_20240315_120030_456Z_batch1.json      # Low priority
│   ├── suspend/       # Workflow suspend flags
│   │   └── my-workflow.suspend
│   └── proc/          # Process heartbeat files for liveness detection
│       └── {proc_group}/
│           └── {dag_name}/
│               └── proc_YYYYMMDD_HHMMSSZ_{run_id}.proc  # 8-byte binary timestamp
├── logs/              # Human-readable execution logs
│   ├── admin/         # Admin/scheduler logs
│   │   ├── scheduler.log
│   │   └── server.log
│   └── dags/          # DAG-specific logs (for web UI)
│       └── my-workflow/
│           └── 20240315_120000_abc123/
│               ├── step1.stdout.log
│               ├── step1.stderr.log
│               └── status.yaml
└── scheduler/         # Scheduler coordination
    └── locks/         # Directory-based locks for HA
        └── .dagu_lock.<hostname@pid>.<timestamp>/
```

## Distributed Execution Architecture

Dagu supports distributed execution through a coordinator-worker model. DAG definitions are transmitted to workers via gRPC. Workers return status, logs, artifacts, and persistent-state operations through the coordinator.

### Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Dagu Instance                           │
├──────────────┬────────────────┬─────────────────────────────┤
│  Scheduler   │   Web UI       │      Coordinator Service   │
│              │                │         (gRPC Server)       │
└──────────────┴────────────────┴─────────────────────────────┘
                                              │
                                              │ gRPC (Long Polling)
                                              │
                ┌─────────────────────────────┴────────────────┐
                │                                              │
         ┌──────▼───────┐                            ┌────────▼──────┐
         │   Worker 1   │                            │   Worker N    │
         │              │                            │               │
         │ Labels:      │                            │ Labels:       │
         │ - gpu=true   │                            │ - region=eu   │
         │ - memory=64G │                            │ - cpu=high    │
         └──────────────┘                            └───────────────┘
```

### Core Components

#### 1. Coordinator Service
- gRPC Server: Listens on configurable port (default: 50055)
- Task Distribution: Routes tasks to appropriate workers based on labels
- Long Polling: Workers poll for tasks using efficient long-polling mechanism
- Health Monitoring: Tracks worker heartbeats and health status
- Failure Detection: Marks tasks failed when workers become unresponsive
- Authentication: Supports signing keys and mutual TLS

#### 2. Worker Service
- Coordinator Discovery: Workers connect to configured coordinator addresses
- Task Polling: Multiple concurrent pollers per worker
- Label-Based Routing: Workers advertise capabilities via labels
- Task Execution: Runs DAGs using the same execution engine
- Heartbeat: Regular health updates every second
- Graceful Shutdown: Completes running tasks before terminating

#### 3. Task Routing

Tasks are routed to workers based on `worker_selector` in DAG definitions and the server-level `default_execution_mode` setting. When `default_execution_mode` is set to `distributed`, all DAGs are dispatched to workers even without an explicit `worker_selector`. DAGs that must remain on the main instance can use `worker_selector: local` to override this behavior.

```yaml
worker_selector:
  gpu: "true"
  memory: "64G"
tools:
  - astral-sh/uv@0.11.14

steps:
  - run: uv run --python 3.13.9 python train.py
```

### Communication Protocol

1. Worker Registration
   - Workers connect to configured coordinators via gRPC
   - Send regular heartbeats with status updates
   - Advertise labels for capability matching

2. Task Assignment
   - Scheduler creates tasks with worker requirements
   - Coordinator matches tasks to eligible workers
   - Workers poll and receive matching tasks

3. Status Updates
   - Workers track task execution status
   - Real-time updates visible in Web UI
   - Hierarchical DAG tracking (root/parent/child)

### Health Monitoring

Worker health is determined by heartbeat recency:
- `Healthy`: Last heartbeat < 5 seconds ago (green)
- `Warning`: Last heartbeat 5-15 seconds ago (yellow)
- `Unhealthy`: Last heartbeat > 15 seconds ago (red)
- `Offline`: No heartbeat for > 30 seconds

### Security Features

1. TLS Support
   - Server certificates for encrypted communication
   - Client certificates for mutual TLS authentication
   - CA certificate validation

2. Authentication
   - Signing key for request validation

3. Network Security
   - Configurable bind addresses
   - Firewall-friendly single port

### Deployment Patterns

#### Single Coordinator, Multiple Workers
```bash
# Start coordinator on main server
dagu coordinator --coordinator.host=0.0.0.0 --coordinator.advertise=coordinator.internal

# Start workers on compute nodes
dagu worker --worker.coordinators=coordinator.internal:50055 --worker.labels gpu=true
dagu worker --worker.coordinators=coordinator.internal:50055 --worker.labels region=us-east-1
```

### Requirements

- **DAG Definitions**: Workers receive DAG definitions via gRPC when tasks are dispatched. Workers do **not** need access to the `dags/` directory.
- **Storage**: Workers use local execution storage and send control-plane data to the coordinator. Do not mount server data or DAG directories on workers.

See [Workers](/server-admin/distributed/workers/) for detailed deployment documentation.
