# Special Environment Variables

Dagu injects a small set of read-only environment variables whenever it runs a workflow. These variables carry metadata about the current DAG run (name, run identifier, log locations, status) and are available for interpolation inside commands, arguments, lifecycle handlers, and most other places where you can reference environment variables.

## Availability

- **Step execution** – Every step receives the run-level variables plus a step-specific name and log file paths while it executes.
- **Lifecycle handlers** – `onInit`, `onExit`, `onSuccess`, `onFailure`, `onCancel`, and `onWait` handlers inherit the same variables. They additionally receive the `DAG_RUN_STATUS` so that post-run automation can branch on success or failure. The `onWait` handler receives `DAG_WAITING_STEPS` with step names waiting for approval.
- **Nested contexts** – When a step launches a sub DAG through the `dagu` CLI, the sub run gets its own identifiers and log locations; the parent identifiers remain accessible in the parent process for chaining or notifications.

Values are refreshed for each step, so `DAG_RUN_STEP_NAME`, `DAG_RUN_STEP_STDOUT_FILE`, and `DAG_RUN_STEP_STDERR_FILE` always point at whichever step (or handler) is currently running.

## Reference

| Variable | Provided In | Description | Example |
|----------|-------------|-------------|---------|
| `DAG_NAME` | All steps & handlers | Name of the DAG definition being executed. | `daily-backup` |
| `DAG_RUN_ID` | All steps & handlers | Unique identifier for the current run. Combines timestamp and a short suffix. | `20241012_040000_c1f4b2` |
| `DAG_RUN_LOG_FILE` | All steps & handlers | Absolute path to the aggregated DAG run log. Useful for attaching to alerts. | `/var/log/dagu/daily-backup/20241012_040000.log` |
| `DAG_RUN_STEP_NAME` | Current step or handler only | Name field of the step that is currently executing. | `upload-artifacts` |
| `DAG_RUN_STEP_STDOUT_FILE` | Current step or handler only | File path backing the step's captured stdout stream. | `/var/log/dagu/daily-backup/upload-artifacts.stdout.log` |
| `DAG_RUN_STEP_STDERR_FILE` | Current step or handler only | File path backing the step's captured stderr stream. | `/var/log/dagu/daily-backup/upload-artifacts.stderr.log` |
| `DAG_RUN_STATUS` | Lifecycle handlers only | Canonical status: `running` (init handler), `succeeded`, `partially_succeeded`, `failed`, `rejected`, `aborted`, or `waiting` (wait handler). | `failed` |
| `DAG_WAITING_STEPS` | Wait handler only | Comma-separated list of step names currently waiting for human approval. | `approval-step,review-step` |
| `PWD` | Current step only | Working directory for the step. Defaults to DAG's `working_dir` or the DAG file's directory. | `/home/user/project` |
| `DAG_RUN_WORK_DIR` | All steps & handlers | Absolute path to the per-DAG-run working directory. Each run gets its own isolated directory. In local mode, this is `<dag-run-dir>/work/`. In shared-nothing (distributed) mode, this is a temporary directory under the system temp dir. Not set during dry runs. | `/data/dagu/dag-runs/daily-backup/dag-run_20241012_040000Z_c1f4b2/work` |
| `DAG_DOCS_DIR` | All steps & handlers | Per-DAG docs directory path. Computed as `<paths.docs_dir>/<dag name>`. Not set when `paths.docs_dir` resolves to empty. | `/var/dagu/dags/docs/daily-backup` |
| `DAG_PARAMS_JSON` | All steps & handlers | JSON string containing the resolved parameter map. If the run was started with JSON parameters, the original payload is preserved. Not set when the DAG has no resolved parameters. | `{"ENVIRONMENT":"prod","batchSize":1000}` |
| `WEBHOOK_PAYLOAD` | Webhook-triggered runs only | JSON string containing the payload from the webhook request body. Only available when the DAG was triggered via a webhook. | `{"branch":"main","commit":"abc123"}` |

## Per-Run Work Directory (`DAG_RUN_WORK_DIR`)

Each DAG run gets an isolated work directory. The path is set in `DAG_RUN_WORK_DIR` and is available to all steps and handlers during the run.

**Local mode:** The directory is `<dag-run-dir>/work/`. It lives at the dag-run level (not the attempt level), so it persists across retries of the same run. It is cleaned up automatically when the dag-run is removed (e.g., by history retention).

**Shared-nothing (distributed) mode:** The directory is a temporary directory under the system temp dir (`/tmp/dagu_<dag-name>_<run-id>`). It is cleaned up when the agent process exits.

**Dry runs:** The variable is not set.

**Sub-DAGs:** Each sub-DAG is a separate dag-run with its own `DAG_RUN_WORK_DIR`.

The directory is created lazily — the env var is always set, but the directory itself is only created on disk when a step accesses it (e.g., via `mkdir -p`).

### Default process working directory

When a DAG does **not** have an explicit `working_dir` in its YAML or base config, the process working directory (`PWD`) for each step defaults to `DAG_RUN_WORK_DIR`. This gives each run an isolated workspace without any configuration.

When `working_dir` **is** explicitly set (in the DAG YAML, base config, or via `DefaultWorkingDir` option), the explicit value is used as the process working directory. `DAG_RUN_WORK_DIR` is still available as an environment variable.

```yaml
# No working_dir set — steps run in DAG_RUN_WORK_DIR by default
steps:
  - name: write-scratch-file
    command: |
      # PWD is DAG_RUN_WORK_DIR (e.g., /data/dagu/dag-runs/my-dag/dag-run_.../work)
      echo "intermediate data" > scratch.txt

  - name: read-scratch-file
    command: cat scratch.txt   # finds the file — same PWD
    depends:
      - write-scratch-file
```

```yaml
# Explicit working_dir — PWD uses /app/project, but DAG_RUN_WORK_DIR is still available
working_dir: /app/project

steps:
  - name: build
    command: make build   # PWD is /app/project

  - name: save-artifact
    command: cp build/output.tar.gz "${DAG_RUN_WORK_DIR}/output.tar.gz"
    depends:
      - build
```

## Docs Directory (`DAG_DOCS_DIR`)

Dagu sets `DAG_DOCS_DIR` to `<paths.docs_dir>/<dag name>`. The `paths.docs_dir` configuration defaults to `<paths.dags_dir>/docs` (see [Configuration Reference](/configurations/reference)).

`DAG_DOCS_DIR` is **not set** when `paths.docs_dir` resolves to an empty string.

Markdown files written under `DAG_DOCS_DIR` appear in the web UI's [Documents](/features/documents) page automatically.

```yaml
steps:
  - name: generate-report
    command: |
      mkdir -p "${DAG_DOCS_DIR}"
      python generate_report.py > "${DAG_DOCS_DIR}/report.md"
```

## Parameter Payload (`DAG_PARAMS_JSON`)

`DAG_PARAMS_JSON` contains the resolved parameters serialized as JSON. It is not set when the DAG has no parameters and none were supplied at runtime.

- Defaults declared in the DAG plus CLI/API overrides are merged into a single JSON object.
- When the run was started with raw JSON parameters (e.g., `dagu start dag.yaml -- '{"foo":"bar"}'`), the original JSON string is preserved verbatim.

```yaml
steps:
  - name: inspect params
    command: echo "Full payload: ${DAG_PARAMS_JSON}"
  - name: read environment
    type: jq
    config:
      raw: true
    script: ${DAG_PARAMS_JSON}
    command: '"Environment: \(.ENVIRONMENT // "dev")"'
```

## Webhook Payload

When a DAG is triggered via a [webhook](/configurations/authentication/webhooks), the request payload is made available through the `WEBHOOK_PAYLOAD` environment variable. This allows your DAG steps to receive and process data from the triggering system.

### Example Usage

Access payload fields directly using Dagu's JSON field access syntax:

```yaml
name: webhook-triggered-dag
type: graph
steps:
  - name: deploy
    command: |
      echo "Deploying branch ${WEBHOOK_PAYLOAD.branch}"
      echo "Commit: ${WEBHOOK_PAYLOAD.commit}"
      ./scripts/deploy.sh

  - name: notify
    command: echo "Deployed by ${WEBHOOK_PAYLOAD.sender.login}"
    depends:
      - deploy
```

For complex payloads with nested structures:

```yaml
steps:
  - name: process-github-push
    command: |
      echo "Repository: ${WEBHOOK_PAYLOAD.repository.full_name}"
      echo "Pusher: ${WEBHOOK_PAYLOAD.pusher.name}"
      echo "First commit message: ${WEBHOOK_PAYLOAD.commits.0.message}"
```

### Notes

- Dagu automatically parses the JSON payload and allows direct field access using dot notation.
- For arrays, use numeric indices (e.g., `${WEBHOOK_PAYLOAD.commits.0}` for the first element).
- Maximum payload size is 1MB.
- The variable is empty when the DAG is triggered by other means (scheduler, API, CLI).
- Always validate the payload contents in your DAG before processing.
