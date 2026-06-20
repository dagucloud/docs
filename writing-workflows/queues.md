# Queue Assignment

Assign a DAG to a named queue to control how many instances of DAGs in that queue can run concurrently. Queues themselves are defined in `config.yaml` — see [Queue Configuration](/server-admin/queues).

## Assigning a DAG to a Queue

Set the `queue` field at the top level of a DAG file:

```yaml
queue: "batch"
schedule: "*/10 * * * *"

steps:
  - id: process
    run: echo "Processing batch"
```

The scheduler places this DAG into the `batch` queue. The queue's `max_concurrency` (defined in `config.yaml`) determines how many DAGs in this queue can run at the same time.

## Default Queue via Base Config

Set a default queue for all DAGs using `base.yaml`:

```yaml
# ~/.config/dagu/base.yaml
queue: "default"
```

Every DAG inherits this unless it sets its own `queue` field. The corresponding queue must be defined in `config.yaml`.

See [Base Configuration](/server-admin/base-config) for how base config merging works.

## Behavior Without a Queue

When a DAG does not set `queue` (and no base config default exists), it runs in a local queue named after the DAG itself. Local queues have a fixed concurrency of 1 — only one instance of that DAG runs at a time.

## Overriding at Enqueue Time

The `--queue` flag on `dagu enqueue` overrides the DAG's `queue` field:

```bash
dagu enqueue --queue=high-priority workflow.yaml
```

See [Queue Configuration](/server-admin/queues) for the full `enqueue` and `dequeue` CLI reference.

## Enqueueing from a Workflow

Use `action: dag.enqueue` to queue another DAG from a running workflow without waiting for that child DAG to finish:

```yaml
type: graph
params:
  - name: customer_id
    required: true

steps:
  - id: queue_customer_rollup
    action: dag.enqueue
    with:
      dag: customer-rollup
      params:
        customer_id: ${params.customer_id}
      queue: background
```

`with.queue` overrides the child DAG's queue for that enqueued run. If it is omitted, Dagu uses the child DAG's top-level `queue`, the base-config default, or the child's local queue. The parent step succeeds after the child run is persisted and added to the queue.

Use `action: dag.run` instead when the parent workflow must wait for the child DAG result before continuing.
