# Worker Labels

Worker labels are key-value pairs that describe worker capabilities. The coordinator uses labels to match tasks to workers via the `workerSelector` field in DAG definitions.

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

1. **Empty selector matches any worker** — a task without `workerSelector` (or with an empty map) can run on any available worker.
2. **All selector key-value pairs must match exactly** — every key in the selector must exist in the worker's labels with an identical value. Matching is case-sensitive.
3. **Workers can have extra labels** — a worker with `gpu=true,memory=64G,region=us-east-1` matches a selector of `gpu: "true"` because the worker satisfies all required keys. The extra `memory` and `region` labels are ignored.

## DAG-Level `workerSelector`

Set `workerSelector` at the top of a DAG file to route the entire DAG to a matching worker:

```yaml
workerSelector:
  gpu: "true"

steps:
  - command: python train.py
```

When the coordinator dispatches this DAG, it selects a worker whose labels include `gpu=true`.

## Step-Level `workerSelector`

Set `workerSelector` on a step to dispatch that step's sub-DAG to a different worker than the parent:

```yaml
steps:
  - call: train-model
    workerSelector:
      gpu: "true"

  - call: generate-report
    workerSelector:
      region: "us-east-1"
```

Step-level `workerSelector` is only valid on executor types that launch sub-DAGs:

| Executor Type | Supports `workerSelector` |
|---------------|--------------------------|
| `dag` | Yes |
| `subworkflow` | Yes |
| `parallel` | Yes |
| All others (`shell`, `http`, `docker`, etc.) | No — validation error |

Setting `workerSelector` on an unsupported step type produces a validation error: `executor type "shell" does not support workerSelector field`.

## `workerSelector: local`

Setting `workerSelector` to the string `"local"` (case-insensitive) forces the DAG to run on the main instance, regardless of the `defaultExecutionMode` setting. This sets `ForceLocal=true` in the dispatch decision.

```yaml
workerSelector: local

steps:
  - command: curl -f http://localhost:8080/health
```

The string `"local"` is the only allowed string value for `workerSelector`. Any other string value produces a validation error.

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
  - call: train-model
    workerSelector:
      gpu: "true"

  # Dispatched to a CPU worker
  - call: aggregate-results
    workerSelector:
      cpu-optimized: "true"

---
name: train-model
workerSelector:
  gpu: "true"
steps:
  - command: python train.py

---
name: aggregate-results
workerSelector:
  cpu-optimized: "true"
steps:
  - command: python aggregate.py
```

The parent DAG's dispatch decision and each child's dispatch decision are evaluated independently. See [Distributed Execution — Sub-DAG Dispatch](/features/distributed-execution#sub-dag-dispatch) for details.
