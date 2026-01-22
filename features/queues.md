# Queue Management

Control concurrent execution and resource usage with queues.

## Overview

Dagu's queue system helps you:
- Limit concurrent workflow executions
- Manage resource usage
- Prioritize critical workflows
- Prevent system overload

**How Queues Work:**

- **Global queues** (defined in `config.yaml`) control concurrency via `maxConcurrency`
- **Local queues** (per-DAG, used when no `queue` field is set) always process FIFO with concurrency of 1
- To control concurrent execution, define global queues and assign DAGs using the `queue` field

## Basic Queue Configuration

### Assign to Queue

```yaml
queue: "batch"              # Assign to global queue for concurrency control
schedule: "*/10 * * * *"    # Every 10 minutes

steps:
  - command: echo "Processing batch"
```

The queue's `maxConcurrency` (defined in `config.yaml`) controls how many DAGs assigned to this queue can run concurrently.

## Global Queue Configuration

Configure queues in server config:

```yaml
# ~/.config/dagu/config.yaml
queues:
  enabled: true
  config:
    - name: "critical"
      maxConcurrency: 5      # 5 critical jobs concurrently
    - name: "batch"
      maxConcurrency: 1      # One batch job at a time
    - name: "reporting"
      maxConcurrency: 3      # 3 reports concurrently
```

## Default Queue via Base Config

Set a default queue for all workflows in your base config:

```yaml
# ~/.config/dagu/base.yaml
queue: "default"

# All DAGs inherit this queue assignment
# Define the "default" queue in config.yaml with desired maxConcurrency
```

## Manual Queue Management

### Enqueue Workflows

```bash
# Basic enqueue
dagu enqueue workflow.yaml

# With custom run ID
dagu enqueue workflow.yaml --run-id=batch-2024-01-15

# With parameters
dagu enqueue process.yaml -- DATE=2024-01-15 TYPE=daily

# Override the queue at enqueue-time
dagu enqueue --queue=high-priority workflow.yaml
```

### Remove from Queue

```bash
# Remove the next item in a queue
dagu dequeue default

# Remove a specific run from a queue
dagu dequeue default --dag-run=workflow:batch-2024-01-15
```
