# What is Boltbase?

<div style="text-align: center; margin: 2rem 0;">
  <img src="/boltbase-logo.webp" alt="Boltbase" style="max-width: 280px; height: auto;" />
</div>

Boltbase is a self-contained workflow engine for orchestrating shell commands, containers, and remote tasks. Define workflows in declarative YAML, execute them with a single binary, and compose complex pipelines from reusable sub-workflows. No database, message broker, or external dependencies required.

## Key Capabilities

- **Single binary deployment** - Install and run without external services
- **Declarative YAML** - JSON Schema validation with clear error messages
- **Composable workflows** - Nest sub-DAGs with parameters (depth limited only by available memory)
- **Distributed execution** - Route tasks to workers via labels (GPU, region, etc.)
- **Built-in scheduling** - Cron expressions with start/stop/restart support
- **Web UI** - Monitor, control, and debug workflows in real-time

## How It Works

Boltbase executes workflows defined as steps in YAML. Steps form a Directed Acyclic Graph (DAG), ensuring predictable execution order.

### Sequential Execution

```yaml
type: chain
steps:
  - command: echo "Step 1"
  - command: echo "Step 2"
```

```mermaid
graph LR
    A["Step 1"] --> B["Step 2"]
    style A stroke:green,stroke-width:1.6px,color:#333
    style B stroke:lime,stroke-width:1.6px,color:#333
```

### Parallel Execution

```yaml
type: graph
steps:
  - id: step_1
    command: echo "Step 1"
  - id: step_2a
    command: echo "Step 2a"
    depends: [step_1]
  - id: step_2b
    command: echo "Step 2b"
    depends: [step_1]
  - id: step_3
    command: echo "Step 3"
    depends: [step_2a, step_2b]
```

```mermaid
graph TD
    A[step_1] --> B[step_2a]
    A --> C[step_2b]
    B --> D[step_3]
    C --> D
    style A stroke:green,stroke-width:1.6px,color:#333
    style B stroke:lime,stroke-width:1.6px,color:#333
    style C stroke:lime,stroke-width:1.6px,color:#333
    style D stroke:lightblue,stroke-width:1.6px,color:#333
```

## Architecture Overview

```mermaid
graph TB
    subgraph Interfaces["User Interfaces"]
        CLI[CLI]
        UI[Web UI]
        API[REST API]
    end

    subgraph Engine["Core Engine"]
        SCH[Scheduler]
        AGT[Agent]
        EXE[Executors]
    end

    subgraph Distributed["Distributed Mode"]
        COORD[Coordinator]
        W1["Worker 1"]
        WN["Worker N"]
    end

    CLI --> AGT
    UI --> AGT
    API --> AGT
    SCH --> AGT
    AGT --> EXE
    SCH -.->|gRPC| COORD
    COORD --> W1
    COORD --> WN
```

**Local mode**: CLI, Web UI, or API triggers the Agent, which runs steps via Executors.

**Distributed mode**: Scheduler dispatches work to a Coordinator, which routes tasks to Workers based on label selectors (e.g., `gpu=true`, `region=us-east`).

See [Architecture](/overview/architecture) for details.

## Built-in Step Types

| Type | Description |
|------|-------------|
| `command` | Shell commands (bash, sh, PowerShell, cmd) |
| `docker` | Container execution with volume mounts and registry auth |
| `ssh` | Remote command execution via SSH |
| `http` | HTTP/REST API requests |
| `jq` | JSON query and transformation |
| `mail` | Email notifications with attachments |
| `dag` | Sub-workflow execution (hierarchical composition) |

See [Step Types Reference](/reference/executors) for configuration details.

## Demo

**CLI**: Create and execute workflows from the command line.

![CLI Demo](/demo-cli.webp)

[CLI Documentation](/overview/cli)

**Web UI**: Monitor executions, view logs, and manage workflows visually.

![Web UI Demo](/demo-web-ui.webp)

[Web UI Documentation](/overview/web-ui)

## Learn More

- [Quick Start](/getting-started/quickstart) - Running in minutes
- [Core Concepts](/getting-started/concepts) - Workflows, steps, and dependencies
- [Architecture](/overview/architecture) - System internals and distributed execution
- [Examples](/writing-workflows/examples) - Ready-to-use workflow patterns
