# Runtime Context and Variables

Dagu exposes run metadata in two forms:

- **Built-in run context references** are the canonical workflow-language form for Dagu-managed metadata in value-resolved YAML fields. Use forms such as `${context.run.id}`, `${context.dag.name}`, and `${context.paths.log_file}` when Dagu should resolve the value before a step or handler starts.
- **Environment variable projections** are the shell-oriented compatibility form. Use variables such as `$DAG_RUN_ID`, `$DAG_RUN_LOG_FILE`, and `$DAG_RUN_STEP_NAME` inside scripts and tools that read the process environment.

The structured `context` namespace is not sourced from user `env` values. It is Dagu-managed runtime data. A workflow can still define parameters or environment variables named `context`, `run`, or `step`; those remain addressable through their own namespaces, such as `${params.context}` or `${env.RUN}`.

## Built-In Run Context

Use `${context.*}` references in value-resolved fields such as `run`, `with`, `env`, `working_dir`, handler fields, stdout/stderr paths, and other fields documented by the YAML specification.

| Reference | Availability | Environment projection |
| --- | --- | --- |
| `${context.dag.name}` | All steps and handlers | `DAG_NAME` |
| `${context.run.id}` | All steps and handlers | `DAG_RUN_ID` |
| `${context.run.status}` | Lifecycle handlers and other status-aware surfaces | `DAG_RUN_STATUS` |
| `${context.run.scheduled_at}` | Scheduled, catchup, and one-off scheduled runs | None |
| `${context.run.root_name}` | Sub-DAG runs only | None |
| `${context.run.root_id}` | Sub-DAG runs only | None |
| `${context.attempt.id}` | Run-attempt-aware scopes | None |
| `${context.attempt.started_at}` | After the run attempt starts | None |
| `${context.step.id}` | Current executable step when it has an `id` | None |
| `${context.step.name}` | Current step or handler | `DAG_RUN_STEP_NAME` |
| `${context.trigger.type}` | When the trigger type is known | None |
| `${context.trigger.actor}` | Runs started by an attributable actor | None |
| `${context.paths.log_file}` | All steps and handlers | `DAG_RUN_LOG_FILE` |
| `${context.paths.work_dir}` | When a per-run work directory is available | `DAG_RUN_WORK_DIR` |
| `${context.paths.wiki_dir}` | All steps and handlers | `DAG_WIKI_DIR` |
| `${context.paths.artifacts_dir}` | When artifact storage is active | `DAG_RUN_ARTIFACTS_DIR` |
| `${context.paths.step_stdout_file}` | Current executable step after stdout is assigned | `DAG_RUN_STEP_STDOUT_FILE` |
| `${context.paths.step_stderr_file}` | Current executable step after stderr is assigned | `DAG_RUN_STEP_STDERR_FILE` |
| `${context.paths.step_output_file}` | Current step attempt after output publication is prepared | `DAGU_OUTPUT_FILE` |
| `${context.profile.name}` | Runs with a selected runtime profile | None |
| `${context.profile.resolved_at}` | Runs with a resolved runtime profile timestamp | None |
| `${context.pushback.iteration}` | Steps re-executed after an approval or human-task push-back | `DAG_PUSHBACK_ITERATION` |
| `${context.pushback.previous_stdout_file}` | Rewound steps that had stdout before reset | `DAG_PUSHBACK_PREVIOUS_STDOUT_FILE` |

Unknown fields under the `context` namespace are preserved at runtime. Inspection surfaces can report them with an `unknown_context_field` notice. Text outside supported Dagu-owned namespaces, such as `${not.a.supported.reference}`, is preserved as ordinary string content.

Older workflows may still contain short built-in context aliases such as `${run.id}`, `${dag.name}`, `${paths.log_file}`, or `${step.name}`. These aliases remain supported only for the exact fields that existed before the `context` namespace was introduced. New workflows and documentation should use `${context.*}`. Dagu does not reserve arbitrary descendants of the short aliases, so text such as `${step.xxx.foo}` is not a built-in context reference.

Webhook payloads, webhook headers, and parameter JSON payloads are object-valued compatibility environment variables. They are not structured `${context.*}` string references.

## Availability

- **Step execution**: Every step receives the run-level variables plus a step-specific name and log file paths while it executes.
- **Push-back re-executions**: Steps re-executed because of an approval or [human-task](/writing-workflows/human-tasks#requesting-changes) push-back also receive `DAG_PUSHBACK`, `DAG_PUSHBACK_ITERATION`, and the provided push-back inputs as individual environment variables. If the step had stdout before it was rewound, Dagu also provides `DAG_PUSHBACK_PREVIOUS_STDOUT_FILE`.
- **Lifecycle handlers**: `onInit`, `onExit`, `onSuccess`, `onFailure`, `onAbort`, and `onWait` handlers inherit the same variables. They additionally receive the `DAG_RUN_STATUS` so that post-run automation can branch on success or failure. The `onWait` handler receives `DAG_WAITING_STEPS` with step names waiting for human input.
- **Nested contexts**: When a step launches a sub DAG through the `dagu` CLI, the sub run gets its own identifiers and log locations; the parent identifiers remain accessible in the parent process for chaining or notifications.

Values are refreshed for each step, so `DAG_RUN_STEP_NAME`, `DAG_RUN_STEP_STDOUT_FILE`, `DAG_RUN_STEP_STDERR_FILE`, and their matching `${context.paths.*}` references always point at whichever step or handler is currently running.

## Environment Variable Reference

| Variable | Provided In | Description | Example |
|----------|-------------|-------------|---------|
| `DAG_NAME` | All steps & handlers | Name of the DAG definition being executed. | `daily-backup` |
| `DAG_RUN_ID` | All steps & handlers | Unique identifier for the current run. Combines timestamp and a short suffix. | `20241012_040000_c1f4b2` |
| `DAG_RUN_LOG_FILE` | All steps & handlers | Absolute path to the aggregated DAG run log. Useful for attaching to alerts. | `/var/log/dagu/daily-backup/20241012_040000.log` |
| `DAG_RUN_STEP_NAME` | Current step or handler only | Name field of the step that is currently executing. | `upload-artifacts` |
| `DAG_RUN_STEP_STDOUT_FILE` | Current step or handler only | File path backing the step's captured stdout stream. | `/var/log/dagu/daily-backup/upload-artifacts.stdout.log` |
| `DAG_RUN_STEP_STDERR_FILE` | Current step or handler only | File path backing the step's captured stderr stream. | `/var/log/dagu/daily-backup/upload-artifacts.stderr.log` |
| `DAGU_OUTPUT_FILE` | Current step attempt when declared outputs can be written | File path used to publish declared step outputs. | `/var/log/dagu/daily-backup/upload-artifacts.output` |
| `DAG_RUN_STATUS` | Lifecycle handlers only | Canonical status: `running` (init handler), `succeeded`, `partially_succeeded`, `failed`, `rejected`, `aborted`, or `waiting` (wait handler). | `failed` |
| `DAG_WAITING_STEPS` | Wait handler only | Comma-separated list of step names currently waiting for human-task completion or approval. | `release_review,security_review` |
| `PWD` | Current step only | Working directory for the step. Uses an explicit step or DAG `working_dir`; otherwise, it defaults to `DAG_RUN_WORK_DIR`. | `/data/dagu/dag-run-work/daily-backup/mtbry4u4rcyn6/root` |
| `DAG_RUN_WORK_DIR` | All steps & handlers | Absolute path to the per-DAG-run working directory. Each run gets its own isolated directory. In local mode, it is stored below `paths.dag_run_work_dir`. On distributed workers, it is temporary worker-local storage. Not set during dry runs. | `/data/dagu/dag-run-work/daily-backup/mtbry4u4rcyn6/root` |
| `DAG_WIKI_DIR` | All steps & handlers | Absolute path to the current DAG's Wiki page directory. Named-workspace DAGs include the workspace directory. | `/opt/dagu/dags/wiki/platform/daily-backup` |
| `DAG_RUN_ARTIFACTS_DIR` | All steps & handlers when artifact storage is active | Absolute path to the per-DAG-run artifact directory, or a worker-local staging directory during distributed execution. Artifact storage is active when enabled explicitly or auto-enabled by `${context.paths.artifacts_dir}` references, artifact actions, or artifact stream outputs. | `/data/dagu/artifacts/daily-backup/dag-run_20241012_040000Z_c1f4b2` |
| `DAG_PARAMS_JSON` | All steps & handlers | JSON string containing the resolved parameter map. Resolved DAG params are serialized as strings; if the run was started with raw JSON parameters, the original payload is preserved. Not set when the DAG has no resolved parameters. | `{"ENVIRONMENT":"prod","batchSize":"1000"}` |
| `DAG_PUSHBACK` | Steps re-executed after an approval or human-task push-back only | JSON string containing the current push-back iteration, latest inputs, authenticated actor, server timestamp, and chronological history. Not set on the initial execution. | `{"iteration":2,"by":"reviewer","at":"2026-04-26T06:18:43Z","inputs":{"FEEDBACK":"Tighten summary"},"history":[...]}` |
| `DAG_PUSHBACK_ITERATION` | Steps re-executed after an approval or human-task push-back only | Current push-back iteration as a plain integer string. Not set on the initial execution. | `2` |
| `DAG_PUSHBACK_PREVIOUS_STDOUT_FILE` | Rewound steps that had stdout before reset | Absolute path to the previous stdout log for the current step. Dagu passes the path instead of inlining stdout because logs can be large. | `/var/log/dagu/report/draft.stdout.log` |
| `WEBHOOK_PAYLOAD` | Webhook-triggered runs only | JSON string containing the payload from the webhook request body. Only available when the DAG was triggered via a webhook. | `{"branch":"main","commit":"abc123"}` |
| `WEBHOOK_HEADERS` | Webhook-triggered runs only | JSON object containing the allow-listed request headers configured by `webhook.forward_headers`. Header names are lowercase and values are arrays of strings. | `{"x-github-event":["push"]}` |

## Per-Run Work Directory (`DAG_RUN_WORK_DIR`)

Each DAG run gets an isolated work directory. The path is set in `DAG_RUN_WORK_DIR` and is available to all steps and handlers during the run.

**Local mode:** New runs are stored separately from history under `paths.dag_run_work_dir`, which defaults to `{paths.data_dir}/dag-run-work`. The file-backed layout is:

```text
<dag_run_work_dir>/<dag>/<root-run-id-hash>/
├── root/
└── <child-run-id-hash>/
```

The `<dag>` component is the same filesystem-safe DAG name used under `paths.dag_runs_dir`. The root run uses `root/`; each child run uses its hashed sibling directory. Run hashes are lowercase, unpadded Base32 encodings of the first 16 SHA-256 bytes of the run ID. Attempts are not represented, so retries reuse the same directory. Deleting a DAG run, including through history retention, removes its complete root-run work tree.

After an upgrade, an existing run continues using its previous nested work directory when that directory is already present. New runs use the separate root; Dagu does not copy or move legacy work files.

Do not let old and new Dagu versions execute the same run concurrently when they share a durable work root. Drain or stop those processes, upgrade them together, and then resume execution. Otherwise, the versions can select different work directories for the same run.

**Distributed workers:** The directory is a temporary directory under the system temp dir (`/tmp/dagu_<dag-name>_<run-id>`). When the DAG declares [file dependencies](/writing-workflows/file-dependencies), the worker materializes the DAG and matching files in a task workspace here before execution, then removes that task workspace when execution finishes. Other worker work directories are cleaned up when the worker process exits.

**Dry runs:** The variable is not set.

**Sub-DAGs:** Each sub-DAG is a separate dag-run with its own `DAG_RUN_WORK_DIR`.

The directory is created when the run agent prepares execution.

### Default process working directory

When a DAG does **not** have an explicit `working_dir` in its YAML or base config, the process working directory (`PWD`) for each step defaults to `DAG_RUN_WORK_DIR`. This gives each run an isolated workspace without any configuration.

When `working_dir` **is** explicitly set (in the DAG YAML, base config, or via `DefaultWorkingDir` option), the explicit value is used as the process working directory. `DAG_RUN_WORK_DIR` is still available as an environment variable.

```yaml
# No working_dir set: steps run in DAG_RUN_WORK_DIR by default
steps:
  - id: write_scratch_file
    run: |
      # PWD is DAG_RUN_WORK_DIR (e.g., /data/dagu/dag-run-work/my-dag/mtbry4u4rcyn6/root)
      echo "intermediate data" > scratch.txt

  - id: read_scratch_file
    run: cat scratch.txt   # finds the file in the same PWD
    depends:
      - write_scratch_file
```

```yaml
# Explicit working_dir: PWD uses /app/project, but DAG_RUN_WORK_DIR is still available
working_dir: /app/project

steps:
  - id: build
    run: make build   # PWD is /app/project

  - id: save_artifact
    run: cp build/output.tar.gz "${context.paths.work_dir}/output.tar.gz"
    depends:
      - build
```

## Wiki Directory (`${context.paths.wiki_dir}`)

`${context.paths.wiki_dir}` points to the Wiki page directory associated with the current DAG. Processes receive the same path through `DAG_WIKI_DIR`.

```yaml
steps:
  - id: show_runbook
    run: cat "${context.paths.wiki_dir}/runbook.md"
```

The path is derived from the server's `paths.wiki_dir` and the DAG identity:

| DAG scope | Runtime Wiki page directory |
| --- | --- |
| Default workspace, DAG `operations` | `<paths.wiki_dir>/operations` |
| Workspace `platform`, DAG `operations` | `<paths.wiki_dir>/platform/operations` |

This directory is shared across runs of the same DAG, unlike `${context.paths.work_dir}` and `${context.paths.artifacts_dir}`, which are run-specific. It is suitable for durable Markdown instructions and other Wiki pages managed from the [Wiki Web UI](/web-ui/wiki).

`DAGU_WIKI_DIR` is the process configuration variable that overrides the server-wide root. `DAG_WIKI_DIR` is the per-DAG runtime projection supplied to steps and handlers.

The deprecated `${context.paths.docs_dir}`, `${paths.docs_dir}`, and `DAG_DOCS_DIR` aliases resolve to the same directory for existing workflows.

See [Wiki](/web-ui/wiki) for editing, workspace scoping, and Git Sync, and [Configuration](/server-admin/configuration#wiki-directory) for the storage root.

## Artifacts Directory (`${context.paths.artifacts_dir}`)

`${context.paths.artifacts_dir}` is available, and `DAG_RUN_ARTIFACTS_DIR` is set for processes, when the DAG enables artifact storage explicitly:

```yaml
artifacts:
  enabled: true
```

Artifact storage is also auto-enabled by a `${context.paths.artifacts_dir}` reference, `artifact.*`, `stdout.artifact`, or `stderr.artifact`. If `artifacts.enabled: false` is set explicitly, artifact actions and artifact stream outputs are invalid, and the artifact path is not set.

The path uses the same per-run layout as `log_dir`:

```text
<base>/<safe dag name>/dag-run_<YYYYMMDD_HHMMSSZ>_<dag-run-id>/
```

Base directory resolution:

- If the DAG sets `artifacts.dir`, that value is used as `<base>`.
- Otherwise Dagu uses `paths.artifact_dir`.
- If `paths.artifact_dir` is not configured explicitly, the default is `<paths.data_dir>/artifacts`.

Execution mode behavior:

- **Local execution** uses the final artifact directory directly.
- **Distributed workers** receive a temporary worker-local artifact directory. Dagu uploads its contents to the coordinator when the attempt finishes.

Example:

```yaml
steps:
  - id: write_report
    run: ./generate-report --format markdown
    stdout:
      artifact: reports/summary.md
```

See [Artifacts](/writing-workflows/artifacts) for the full configuration, API, and Web UI behavior.

## Parameter Payload (`DAG_PARAMS_JSON`)

`DAG_PARAMS_JSON` contains the resolved parameters serialized as JSON. It is not set when the DAG has no parameters and none were supplied at runtime.

- Defaults declared in the DAG plus CLI/API overrides are merged into a single JSON object.
- Resolved DAG params are serialized as strings, even when inline param definitions use `integer`, `number`, or `boolean` types.
- Raw JSON input may be an object or an array. For named params, prefer an object.
- When the run was started with raw JSON parameters (e.g., `dagu start dag.yaml -- '{"foo":"bar"}'`), the original JSON string is preserved verbatim.

```yaml
steps:
  - id: inspect_params
    run: |
      printf '%s\n' "$DAG_PARAMS_JSON"
  - id: read_environment
    action: jq.filter
    with:
      filter: '"Environment: \(.ENVIRONMENT // "dev")"'
      raw: true
      data: ${env.DAG_PARAMS_JSON}
```

## Push-back Context (`DAG_PUSHBACK`)

`DAG_PUSHBACK` is set only when a step is executing as part of a push-back / rewind cycle for an `approval` step or a `human.task` with `with.push_back`. For a human task, the inputs are its declared feedback properties.

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
- For `chat` and `harness` steps, Dagu also passes this context to the executor so the step can incorporate reviewer feedback without wiring these variables into the DAG manually.

For approval semantics and examples, see [Approval](/writing-workflows/approval).

## Webhook Payload

When a DAG is triggered via a [webhook](/server-admin/authentication/webhooks), the request payload is made available through the `WEBHOOK_PAYLOAD` environment variable. This allows your DAG steps to receive and process data from the triggering system.

### Example Usage

Access payload fields directly using Dagu's JSON field access syntax:

```yaml
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
