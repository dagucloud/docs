# Special Environment Variables

Dagu injects a small set of read-only environment variables whenever it runs a workflow. These variables carry metadata about the current DAG run (name, run identifier, log locations, status) and are available for interpolation inside commands, arguments, lifecycle handlers, and most other places where you can reference environment variables.

## Availability

- **Step execution** – Every step receives the run-level variables plus a step-specific name and log file paths while it executes.
- **Push-back re-executions** – Steps re-executed because of approval push-back also receive `DAG_PUSHBACK`, `DAG_PUSHBACK_ITERATION`, and the provided push-back inputs as individual environment variables. If the step had stdout before it was rewound, Dagu also provides `DAG_PUSHBACK_PREVIOUS_STDOUT_FILE`.
- **Lifecycle handlers** – `onInit`, `onExit`, `onSuccess`, `onFailure`, `onAbort`, and `onWait` handlers inherit the same variables. They additionally receive the `DAG_RUN_STATUS` so that post-run automation can branch on success or failure. The `onWait` handler receives `DAG_WAITING_STEPS` with step names waiting for approval.
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
| `DAG_RUN_ARTIFACTS_DIR` | All steps & handlers when artifact storage is active | Absolute path to the per-DAG-run artifact directory, or a worker-local staging directory in shared-nothing mode. Artifact storage is active when enabled explicitly or auto-enabled by `DAG_RUN_ARTIFACTS_DIR` references, artifact actions, or artifact stream outputs. | `/data/dagu/artifacts/daily-backup/dag-run_20241012_040000Z_c1f4b2` |
| `DAG_DOCS_DIR` | All steps & handlers | Per-DAG docs directory path. Computed as `<paths.docs_dir>/<dag name>` for `default` DAGs, or `<paths.docs_dir>/<workspace>/<dag name>` when the DAG has one valid `workspace=<name>` label. Not set when `paths.docs_dir` resolves to empty. | `/var/dagu/dags/docs/ops/daily-backup` |
| `DAG_PARAMS_JSON` | All steps & handlers | JSON string containing the resolved parameter map. Resolved DAG params are serialized as strings; if the run was started with raw JSON parameters, the original payload is preserved. Not set when the DAG has no resolved parameters. | `{"ENVIRONMENT":"prod","batchSize":"1000"}` |
| `DAG_PUSHBACK` | Steps re-executed after approval push-back only | JSON string containing the current push-back iteration, latest inputs, authenticated actor, server timestamp, and chronological history. Not set on the initial execution. | `{"iteration":2,"by":"reviewer","at":"2026-04-26T06:18:43Z","inputs":{"FEEDBACK":"Tighten summary"},"history":[...]}` |
| `DAG_PUSHBACK_ITERATION` | Steps re-executed after approval push-back only | Current push-back iteration as a plain integer string. Not set on the initial execution. | `2` |
| `DAG_PUSHBACK_PREVIOUS_STDOUT_FILE` | Rewound steps that had stdout before reset | Absolute path to the previous stdout log for the current step. Dagu passes the path instead of inlining stdout because logs can be large. | `/var/log/dagu/report/draft.stdout.log` |
| `WEBHOOK_PAYLOAD` | Webhook-triggered runs only | JSON string containing the payload from the webhook request body. Only available when the DAG was triggered via a webhook. | `{"branch":"main","commit":"abc123"}` |
| `WEBHOOK_HEADERS` | Webhook-triggered runs only | JSON object containing the allow-listed request headers configured by `webhook.forward_headers`. Header names are lowercase and values are arrays of strings. | `{"x-github-event":["push"]}` |

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
  - id: write_scratch_file
    run: |
      # PWD is DAG_RUN_WORK_DIR (e.g., /data/dagu/dag-runs/my-dag/dag-run_.../work)
      echo "intermediate data" > scratch.txt

  - id: read_scratch_file
    run: cat scratch.txt   # finds the file — same PWD
    depends:
      - write_scratch_file
```

```yaml
# Explicit working_dir — PWD uses /app/project, but DAG_RUN_WORK_DIR is still available
working_dir: /app/project

steps:
  - id: build
    run: make build   # PWD is /app/project

  - id: save_artifact
    run: cp build/output.tar.gz "${env.DAG_RUN_WORK_DIR}/output.tar.gz"
    depends:
      - build
```

## Artifacts Directory (`DAG_RUN_ARTIFACTS_DIR`)

`DAG_RUN_ARTIFACTS_DIR` is set when the DAG enables artifact storage explicitly:

```yaml
artifacts:
  enabled: true
```

It is also set when artifact storage is auto-enabled by a `DAG_RUN_ARTIFACTS_DIR` reference, `artifact.*`, `stdout.artifact`, or `stderr.artifact`. If `artifacts.enabled: false` is set explicitly, artifact actions and artifact stream outputs are invalid, and `DAG_RUN_ARTIFACTS_DIR` is not set.

The path uses the same per-run layout as `log_dir`:

```text
<base>/<safe dag name>/dag-run_<YYYYMMDD_HHMMSSZ>_<dag-run-id>/
```

Base directory resolution:

- If the DAG sets `artifacts.dir`, that value is used as `<base>`.
- Otherwise Dagu uses `paths.artifact_dir`.
- If `paths.artifact_dir` is not configured explicitly, the default is `<paths.data_dir>/artifacts`.

Execution mode behavior:

- **Local** and **shared-filesystem distributed** execution use the final artifact directory directly.
- **Shared-nothing distributed** workers receive a temporary worker-local directory in `DAG_RUN_ARTIFACTS_DIR`. Dagu uploads its contents to the coordinator when the attempt finishes.

Example:

```yaml
artifacts:
  enabled: true

steps:
  - id: write-report
    run: ./generate-report --format markdown
    stdout:
      artifact: reports/summary.md
```

See [Artifacts](/writing-workflows/artifacts) for the full configuration, API, and Web UI behavior.

## Docs Directory (`DAG_DOCS_DIR`)

Dagu sets `DAG_DOCS_DIR` from `paths.docs_dir`. The `paths.docs_dir` configuration defaults to `<paths.dags_dir>/docs` (see [Configuration Reference](/server-admin/reference)).

For a DAG with no valid workspace label, Dagu sets:

```text
DAG_DOCS_DIR=<paths.docs_dir>/<dag name>
```

For a DAG with exactly one valid `workspace=<name>` label, Dagu sets:

```text
DAG_DOCS_DIR=<paths.docs_dir>/<workspace>/<dag name>
```

For example, a DAG named `daily-backup` with `workspace=ops` gets:

```text
/var/dagu/dags/docs/ops/daily-backup
```

Invalid or conflicting workspace labels fall back to the `default` path, `<paths.docs_dir>/<dag name>`.

`DAG_DOCS_DIR` is **not set** when `paths.docs_dir` resolves to an empty string.

Markdown files written under `DAG_DOCS_DIR` appear in the web UI's [Documents](/web-ui/documents) page automatically. Workspace-scoped files appear only when the matching workspace, or `all`, is selected.

```yaml
labels:
  - workspace=ops

tools:
  - astral-sh/uv@0.11.14

steps:
  - id: generate_report
    run: |
      mkdir -p "${env.DAG_DOCS_DIR}"
      uv run --python 3.13.9 python generate_report.py > "${env.DAG_DOCS_DIR}/report.md"
```

## Parameter Payload (`DAG_PARAMS_JSON`)

`DAG_PARAMS_JSON` contains the resolved parameters serialized as JSON. It is not set when the DAG has no parameters and none were supplied at runtime.

- Defaults declared in the DAG plus CLI/API overrides are merged into a single JSON object.
- Resolved DAG params are serialized as strings, even when inline param definitions use `integer`, `number`, or `boolean` types.
- Raw JSON input may be an object or an array. For named params, prefer an object.
- When the run was started with raw JSON parameters (e.g., `dagu start dag.yaml -- '{"foo":"bar"}'`), the original JSON string is preserved verbatim.

```yaml
steps:
  - id: inspect_params
    run: echo "Full payload: ${env.DAG_PARAMS_JSON}"
  - id: read_environment
    action: jq.filter
    with:
      filter: '"Environment: \(.ENVIRONMENT // "dev")"'
      raw: true
      data: ${env.DAG_PARAMS_JSON}
```

## Push-back Context (`DAG_PUSHBACK`)

`DAG_PUSHBACK` is set only when a step is executing as part of a push-back / rewind cycle for an `approval` step.

- It is not set on the first execution before any push-back happens.
- It is available to every step that was reset and later re-executed within the rewound scope.
- Dagu also injects the provided push-back keys as individual environment variables on those steps.
- `DAG_PUSHBACK_ITERATION` provides the same iteration count as a plain value for scripts that do not need the full JSON payload.
- `DAG_PUSHBACK_PREVIOUS_STDOUT_FILE` points to the current step's previous stdout log when one exists. Dagu never inlines the previous stdout content into this variable.

Example payload:

```json
{
  "iteration": 2,
  "by": "reviewer",
  "at": "2026-04-26T06:18:43Z",
  "inputs": {
    "FEEDBACK": "Tighten the executive summary",
    "FORMAT": "markdown"
  },
  "history": [
    {
      "iteration": 1,
      "by": "reviewer",
      "at": "2026-04-26T06:12:10Z",
      "inputs": {
        "FEEDBACK": "Add error counts",
        "FORMAT": "markdown"
      }
    },
    {
      "iteration": 2,
      "by": "reviewer",
      "at": "2026-04-26T06:18:43Z",
      "inputs": {
        "FEEDBACK": "Tighten the executive summary",
        "FORMAT": "markdown"
      }
    }
  ]
}
```

Notes:

- `at` is a server-generated UTC timestamp in RFC3339 format.
- `history` is ordered oldest to newest.
- If the current step declares `approval.input`, the `inputs` object is filtered to that allowlist for that step.
- If the current step does not declare `approval.input`, all provided push-back keys are exposed on that step.
- For `agent`, `chat`, and `harness` steps, Dagu also passes this context to the executor so the step can incorporate reviewer feedback without wiring these variables into the DAG manually.

For approval semantics and examples, see [Approval](/writing-workflows/approval).

## Webhook Payload

When a DAG is triggered via a [webhook](/server-admin/authentication/webhooks), the request payload is made available through the `WEBHOOK_PAYLOAD` environment variable. This allows your DAG steps to receive and process data from the triggering system.

### Example Usage

Access payload fields directly using Dagu's JSON field access syntax:

```yaml
name: webhook-triggered-dag
type: graph
steps:
  - id: deploy
    run: |
      printf '%s\n' "$WEBHOOK_PAYLOAD" | jq -r '"Deploying branch \(.branch)"'
      printf '%s\n' "$WEBHOOK_PAYLOAD" | jq -r '"Commit: \(.commit)"'
      ./scripts/deploy.sh

  - id: notify
    run: printf '%s\n' "$WEBHOOK_PAYLOAD" | jq -r '"Deployed by \(.sender.login)"'
    depends:
      - deploy
```

For complex payloads with nested structures:

```yaml
steps:
  - id: process_github_push
    run: |
      printf '%s\n' "$WEBHOOK_PAYLOAD" | jq -r '"Repository: \(.repository.full_name)"'
      printf '%s\n' "$WEBHOOK_PAYLOAD" | jq -r '"Pusher: \(.pusher.name)"'
      printf '%s\n' "$WEBHOOK_PAYLOAD" | jq -r '"First commit message: \(.commits[0].message)"'
```

### Notes

- Dagu exposes the JSON payload as `WEBHOOK_PAYLOAD`.
- Parse nested payload fields with `jq`, Python, Node.js, or your shell tooling.
- In shell scripts, read the JSON from `$WEBHOOK_PAYLOAD` instead of inlining it with `${env.WEBHOOK_PAYLOAD}` so payload quotes cannot break the script.
- Maximum payload size defaults to 1MB and can be changed with `webhooks.max_payload_size` in the server configuration.
- The variable is empty when the DAG is triggered by other means (scheduler, API, CLI).
- Always validate the payload contents in your DAG before processing.

## Webhook Headers

When a webhook-triggered DAG needs request metadata such as event type or
delivery ID, configure an allowlist under `webhook.forward_headers`. Dagu then
exposes the selected headers through the `WEBHOOK_HEADERS` environment variable.

```yaml
webhook:
  forward_headers:
    - X-GitHub-Event
    - X-GitHub-Delivery

tools:
  - jqlang/jq@jq-1.7.1

steps:
  - id: route
    run: |
      echo "$WEBHOOK_HEADERS" | jq -r '."x-github-event"[0]'
      echo "$WEBHOOK_HEADERS" | jq -r '."x-github-delivery"[0]'
```

### Notes

- Header names are matched case-insensitively and emitted as lowercase keys.
- Header values are always arrays, even when only one value is present.
- Only headers listed in `webhook.forward_headers` are exposed.
- `Authorization` can never be forwarded.
- When no configured headers are present on the request, `WEBHOOK_HEADERS` is `{}`.
- Because header names often contain hyphens, parsing the JSON string directly with `jq`, Python, Node.js, or your shell tooling is usually clearer than dot-notation access.

## GitHub Integration Variables

When the run comes from the Dagu Cloud GitHub App integration, the workflow receives more than the raw webhook payload.

In addition to `WEBHOOK_PAYLOAD` and `WEBHOOK_HEADERS`, Dagu injects GitHub-specific convenience variables such as:

- `GITHUB_EVENT_NAME`
- `GITHUB_EVENT_ACTION`
- `GITHUB_REPOSITORY`
- `GITHUB_SHA`
- `GITHUB_REF`
- `GITHUB_ACTOR`
- `GITHUB_PR_NUMBER`
- `GITHUB_ISSUE_NUMBER`
- `GITHUB_COMMAND`
- `GITHUB_RELEASE_TAG`
- `GITHUB_WORKFLOW`
- `GITHUB_DISPATCH_EVENT_TYPE`

Example:

```yaml
steps:
  - id: inspect_github_context
    run: |
      echo "event=${env.GITHUB_EVENT_NAME}"
      echo "action=${env.GITHUB_EVENT_ACTION}"
      echo "repo=${env.GITHUB_REPOSITORY}"
      echo "pr=${env.GITHUB_PR_NUMBER}"
      printf '%s\n' "$WEBHOOK_PAYLOAD" | jq -r '"body=\(.comment.body)"'
```

For the full GitHub integration model, supported triggers, binding rules, and end-to-end examples, see [GitHub Integration](/github-integration/).
