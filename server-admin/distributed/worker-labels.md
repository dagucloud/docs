# Worker Labels

Worker labels are key-value pairs that describe worker capabilities. The coordinator uses labels to match tasks to workers via the `worker_selector` field in DAG definitions.

## Setting Labels

### CLI Flag

```bash
dagu worker --worker.labels gpu=true,memory=64G,region=us-east-1
```

Labels are comma-separated `key=value` pairs. Keys and values are trimmed of whitespace.

### Configuration File

```yaml
# config.yaml
worker:
  labels:
    gpu: "true"
    memory: "64G"
    region: "us-east-1"
```

### Environment Variable

```bash
export DAGU_WORKER_LABELS="gpu=true,memory=64G,region=us-east-1"
dagu worker
```

## Matching Algorithm

The coordinator's `matchesSelector()` function evaluates whether a worker is eligible for a task:

1. **Empty selector matches any worker** — a task without `worker_selector` (or with an empty map) can run on any available worker.
2. **All selector key-value pairs must match exactly** — every key in the selector must exist in the worker's labels with an identical value. Matching is case-sensitive.
3. **Workers can have extra labels** — a worker with `gpu=true,memory=64G,region=us-east-1` matches a selector of `gpu: "true"` because the worker satisfies all required keys. The extra `memory` and `region` labels are ignored.

## DAG-Level `worker_selector`

Set `worker_selector` at the top of a DAG file to route the entire DAG to a matching worker:

```yaml
worker_selector:
  gpu: "true"

steps:
  - run: python train.py
```

When the coordinator dispatches this DAG, it selects a worker whose labels include `gpu=true`.

## Step-Level `worker_selector`

Set `worker_selector` on a step to dispatch that step's sub-DAG to a different worker than the parent:

```yaml
steps:
  - action: dag.run
    with:
      dag: train-model
    worker_selector:
      gpu: "true"

  - action: dag.run
    with:
      dag: generate-report
    worker_selector:
      region: "us-east-1"
```

Step-level `worker_selector` is only valid on actions that launch sub-DAGs:

| Action | Supports `worker_selector` |
|--------|----------------------------|
| `dag.run` | Yes |
| `dag.enqueue` | Yes |
| All other actions (`http.request`, `docker.run`, etc.) and inline `run:` steps | No — validation error |

Setting `worker_selector` on an unsupported action produces a validation error.

## `worker_selector: local`

Setting `worker_selector` to the string `"local"` (case-insensitive) forces the DAG to run on the main instance, regardless of the `default_execution_mode` setting. This sets `ForceLocal=true` in the dispatch decision.

```yaml
worker_selector: local

steps:
  - run: curl -f http://localhost:8080/health
```

The string `"local"` is the only allowed string value for `worker_selector`. Any other string value produces a validation error.

## Example: GPU/CPU Routing

Workers:

```bash
# GPU worker
dagu worker --worker.labels gpu=true,cuda=12.0

# CPU worker
dagu worker --worker.labels cpu-optimized=true,cores=64
```

DAG with both DAG-level and step-level selectors:

```yaml
# Parent DAG — runs on any worker (or locally)
steps:
  # Dispatched to a GPU worker
  - action: dag.run
    with:
      dag: train-model
    worker_selector:
      gpu: "true"

  # Dispatched to a CPU worker
  - action: dag.run
    with:
      dag: aggregate-results
    worker_selector:
      cpu-optimized: "true"
---
name: train-model
worker_selector:
  gpu: "true"
steps:
  - run: python train.py

---
name: aggregate-results
worker_selector:
  cpu-optimized: "true"
steps:
  - run: python aggregate.py
```

The parent DAG's dispatch decision and each child's dispatch decision are evaluated independently. See [Distributed Execution — Sub-DAG Dispatch](/server-admin/distributed/#sub-dag-dispatch) for details.
