# YAML Specification

This page documents the YAML fields accepted by the current Dagu workflow parser. It is a reference for the top-level DAG document and for individual step definitions.

For the generated JSON Schema shipped with the Dagu binary, run:

```bash
dagu schema dag
dagu schema dag steps
```

## Minimal Workflow

```yaml
steps:
  - run: echo "hello"
```

A workflow file defines one DAG. If `name` is omitted, Dagu uses the file name without its extension.

## Typical Workflow

```yaml
name: daily_report
description: Build a weekday report
labels:
  env: prod
  team: analytics

schedule:
  start:
    - "0 8 * * MON-FRI"
catchup_window: 6h
overlap_policy: latest

type: graph
max_active_steps: 4
timeout_sec: 3600

params:
  - name: region
    type: string
    default: us-east-1
    enum: [us-east-1, us-west-2]

env:
  REPORT_DIR: reports

dotenv:
  - .env.production

tools:
  - jqlang/jq@jq-1.7.1

artifacts:
  enabled: true

defaults:
  retry_policy:
    limit: 2
    interval_sec: 30

steps:
  - id: fetch_data
    run: |
      printf 'raw_json={"count":3}\n' >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: raw_json
        type: json

  - id: summarize_data
    action: jq.filter
    with:
      raw: true
      filter: .count
      data: "${steps.fetch_data.outputs.raw_json}"
    depends: fetch_data

handler_on:
  failure:
    action: mail.send
    with:
      to: ops@example.com
      subject: "daily_report failed"
      message: "See ${context.paths.log_file}"
```

## Top-Level Fields

Unknown top-level fields are rejected. The accepted top-level fields are listed below.

### Metadata

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `name` | string | DAG name. Must be 40 characters or fewer and match `^[a-zA-Z0-9_.-]+$`. | File name without extension |
| `description` | string | Human-readable description. | - |
| `group` | string | Group name used for organization. | - |
| `labels` | string, array, or object | Labels for filtering and workspace selection. | `[]` |
| `tags` | string, array, or object | Deprecated alias for labels. Prefer `labels`. | `[]` |

### Execution Mode

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `type` | string | Step scheduling mode. Accepted values are `graph` and `chain`. | `graph` |

`graph` schedules steps from their `depends` relationships.

```yaml
type: graph

steps:
  - id: fetch_a
    run: curl https://api.example.com/a

  - id: fetch_b
    run: curl https://api.example.com/b

  - id: merge
    run: ./merge.sh
    depends: [fetch_a, fetch_b]
```

`chain` runs steps in definition order. In `chain` mode, `depends` is not allowed, and router steps are not allowed.

```yaml
type: chain

steps:
  - run: echo "first"
  - run: echo "second"
```

`type: agent` is reserved and is rejected by the current parser.

### Scheduling

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `schedule` | string, array, or object | Cron schedule, multiple schedules, one-off `at` entries, or a `start`/`stop`/`restart` schedule map. | - |
| `skip_if_successful` | boolean | Skip the scheduled run if the DAG already succeeded for that day. | `false` |
| `restart_wait_sec` | integer | Seconds to wait before a scheduled restart. | `0` |
| `catchup_window` | string | Duration for replaying missed cron runs after scheduler downtime. If omitted, missed runs are not replayed. | - |
| `overlap_policy` | string | Catchup overlap behavior: `skip`, `all`, or `latest`. | `skip` |

```yaml
# Single cron schedule
schedule: "0 2 * * *"

# Multiple cron schedules
schedule:
  - "0 9 * * MON-FRI"
  - "0 14 * * SAT,SUN"

# Cron with timezone
schedule: "CRON_TZ=America/New_York 0 9 * * *"

# One-off schedule
schedule:
  - at: "2026-03-29T09:30:00+09:00"

# Start, stop, and restart schedules
schedule:
  start:
    - "0 8 * * MON-FRI"
    - at: "2026-03-29T09:30:00+09:00"
  stop:
    - "0 18 * * MON-FRI"
  restart:
    - "0 12 * * MON-FRI"
```

`at` is accepted only in a top-level `schedule` array and under `schedule.start`. `schedule.stop` and `schedule.restart` accept cron entries only. `at` timestamps must be RFC 3339 timestamps with an explicit offset or `Z`, and seconds must be `:00`.

### Execution Control

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `queue` | string | Global queue name from `config.yaml`. If omitted, Dagu uses the DAG's local queue. | DAG name |
| `max_active_runs` | integer | Deprecated per-DAG run concurrency field. Local queues are FIFO with concurrency 1; use global queues for concurrency control. | `1` |
| `max_active_steps` | integer | Maximum number of concurrently running steps inside one DAG run. `0` means unlimited. | `0` |
| `timeout_sec` | integer | Whole-DAG timeout in seconds. `0` means no timeout. | `0` |
| `delay_sec` | integer | Initial delay before execution starts, in seconds. | `0` |
| `max_clean_up_time_sec` | integer | Maximum cleanup time after termination, in seconds. | `5` |
| `preconditions` | string or array | DAG-level preconditions evaluated before any step starts. | - |
| `retry_policy` | object | Scheduler-driven retry policy for the whole DAG run. | - |
| `run_config` | object | UI/API controls for starting DAG runs. | - |
| `worker_selector` | object or `local` | Distributed worker label selector, or `local` to force local execution. | - |

There is no accepted top-level `resources` field in the current YAML parser. For DAG-level concurrency use `max_active_steps` or `queue`. For Kubernetes resource defaults, use top-level `kubernetes.resources`, which applies only to explicit `k8s.run` or `kubernetes.run` steps.

### DAG Retry Policy

Root `retry_policy` retries the whole DAG through the scheduler. It is separate from a step-level `retry_policy`.

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `limit` | integer or string | Maximum number of scheduler-issued DAG retries. `0` disables DAG-level automatic retries. | required |
| `interval_sec` | integer or string | Base delay before retrying, in seconds. | `60` |
| `backoff` | boolean or number | `true` means `2.0`; a number greater than `1.0` is used as the multiplier. | fixed interval |
| `max_interval_sec` | integer | Maximum retry delay, in seconds. | `3600` |

```yaml
retry_policy:
  limit: 2
  interval_sec: 60
  backoff: true
  max_interval_sec: 900
```

### History And Output Limits

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `hist_retention_days` | integer | Days of DAG-run history to retain. `0` uses the default when `hist_retention_runs` is not set. Negative values disable automatic cleanup. | `30` |
| `hist_retention_runs` | integer | Number of DAG runs to retain. Must be greater than `0` if set. Cannot be set with `hist_retention_days`. | - |
| `max_output_size` | integer | Maximum captured output size per step, in bytes. | `1048576` |

### Data, Environment, And Files

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `params` | string, array, or object | DAG parameters. Supports legacy string/map forms, inline rich definitions, and JSON Schema mode. | `[]` |
| `env` | array or object | DAG environment variables. | `[]` |
| `secrets` | array | Secret references resolved at runtime and exposed as environment variables. | `[]` |
| `dotenv` | string or array | `.env` files to load. `[]` disables dotenv loading. | `[".env"]` |
| `tools` | array or object | Pinned external CLI tools installed before the DAG starts. | - |
| `working_dir` | string | DAG working directory. Relative paths resolve from the DAG file directory. | See below |
| `shell` | string or array | Default shell for `run` steps. Step `with.shell` overrides it. | System default |
| `shell_args` | array | Additional arguments appended to the DAG-level shell for `run` steps. Step `with.shell_args` overrides them. | `[]` |
| `log_dir` | string | Custom log directory. | System default |
| `log_output` | string | Log output mode: `separate` or `merged`. | `separate` |
| `artifacts` | object | Per-run artifact storage configuration. | - |

When `working_dir` is omitted from the YAML and base config, local runs use the per-run `DAG_RUN_WORK_DIR` as the process working directory. When `working_dir` is explicitly set, Dagu uses that path and still exposes `DAG_RUN_WORK_DIR` as an environment variable.

`shell` accepts a string such as `bash -e` or an array such as `["bash", "-e"]`. `shell_args` appends additional arguments to that DAG-level shell. Use step-level `with.shell` and `with.shell_args` when only one `run` step needs a different shell invocation.

`dotenv` behavior:

- If `dotenv` is omitted, Dagu loads `.env`.
- If `dotenv` is a string or array, Dagu still prepends `.env` at load time and de-duplicates entries.
- If `dotenv: []` is set, dotenv loading is disabled.
- Files are resolved from `working_dir`; if the DAG file directory differs, Dagu also searches there.
- Missing dotenv files are skipped.

```yaml
dotenv:
  - .env.defaults
  - .env.production
```

Top-level `tools` uses pinned package versions:

```yaml
tools:
  - jqlang/jq@jq-1.7.1
  - google/pprof@d04f2422c8a17569c14e84da0fae252d9529826b
```

Object form:

```yaml
tools:
  provider: aqua
  packages:
    - package: jqlang/jq
      version: jq-1.7.1
      commands: [jq]
```

The default provider is `aqua`. `latest` is rejected; package versions must be pinned. Managed tools are scoped to the current DAG run and are not inherited by sub-DAGs.

### Parameters

Recommended rich parameter form:

```yaml
params:
  - name: region
    type: string
    default: us-east-1
    enum: [us-east-1, us-west-2]
    description: Deployment region
  - name: count
    type: integer
    default: 3
    minimum: 1
    maximum: 10
  - name: debug
    type: boolean
    default: false
```

Rich parameter fields use snake_case:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Parameter name. Required in rich list entries. |
| `type` | string | `string`, `integer`, `number`, or `boolean`. |
| `default` | string, integer, number, or boolean | Literal default value. |
| `eval` | string | Expression evaluated at execution time to produce the effective default. |
| `description` | string | Help text. |
| `required` | boolean | Requires runtime input when no default exists. |
| `enum` | array | Allowed values. |
| `minimum`, `maximum` | number | Numeric bounds. |
| `min_length`, `max_length` | integer | String length bounds. |
| `pattern` | string | RE2 regex for string validation. |

`default` values are literal. `eval` is optional and runs at execution time. Runtime precedence is: explicit override, then `eval`, then `default`. DAG `env` is evaluated before params, and params are evaluated from top to bottom so later params can reference earlier params.

JSON Schema parameter mode is also accepted:

```yaml
params:
  type: object
  properties:
    region:
      type: string
      default: us-east-1
  required: [region]
```

External schema mode:

```yaml
params:
  schema: ./params.schema.json
  values:
    region: us-east-1
```

### Defaults

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `defaults` | object | Default values applied to every step and every `handler_on` step. | - |

Accepted `defaults` fields:

| Field | Type | Merge behavior |
|-------|------|----------------|
| `retry_policy` | object | Step value replaces default. |
| `continue_on` | string or object | Step value replaces default. |
| `repeat_policy` | object | Step value replaces default. |
| `timeout_sec` | integer | Step value replaces default. |
| `mail_on_error` | boolean | Step value replaces default. |
| `signal_on_stop` | string | Step value replaces default. |
| `env` | array or object | Prepended before step `env`. |
| `preconditions` | string or array | Prepended before step `preconditions`. |
| `agent` | object | Merged per supported agent subfield. |

Unknown keys inside `defaults` cause a validation error.

```yaml
defaults:
  retry_policy:
    limit: 3
    interval_sec: 5
  env:
    LOG_LEVEL: info

steps:
  - id: fetch_data
    run: ./fetch.sh

  - id: critical_step
    run: ./critical.sh
    retry_policy:
      limit: 1
      interval_sec: 60
```

### Custom Actions

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `actions` | object | Reusable custom action definitions for this YAML document. | - |
| `step_types` | object | Deprecated legacy custom step type definitions. Prefer `actions`. | - |

Custom action definitions expand to built-in step definitions during DAG load. They are not runtime plugins.

Each `actions` entry accepts:

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Required built-in step type or alias used by the action template. |
| `input_schema` | object | Required inline JSON Schema object schema for `with`. |
| `output_schema` | object | Optional inline JSON Schema object schema for stdout validation. |
| `template` | object | Required step fragment expanded at load time. |
| `description` | string | Optional fallback description. |

Action names in steps can refer to built-ins, local custom actions, base-config custom actions, or remote action refs such as `action@version`, `owner/repo@version`, or `source:...@version`.

### Integrations And Defaults

| Field | Type | Description |
|-------|------|-------------|
| `container` | string or object | DAG-level shared container context. Mutually exclusive with top-level `ssh`. |
| `registry_auths` | object or string | Docker registry auth configuration as a map or Docker auth JSON string. |
| `ssh` | object | DAG-level SSH defaults. Mutually exclusive with top-level `container`. |
| `s3` | object | DAG-level defaults for `s3.*` actions. |
| `llm` | object | DAG-level defaults for chat completion steps. |
| `redis` | object | DAG-level defaults for `redis.<operation>` actions. |
| `harnesses` | object | Named harness configurations used by `harness.run`. |
| `harness` | object | Default harness configuration used by `harness.run`. |
| `kubernetes` | object | DAG-level defaults for explicit `k8s.run` and `kubernetes.run` steps. |
| `otel` | object | OpenTelemetry tracing configuration. |
| `webhook` | object | Webhook controls such as `forward_headers`. |

Top-level `kubernetes` is not a global execution mode. It is only merged into steps that explicitly use `action: k8s.run` or `action: kubernetes.run`.

### Container

`container` has two modes. At the DAG level it creates or attaches to one
shared container for the run. Command steps and CLI-based `harness.run` steps
inherit that shared container unless the step defines a supported step-level
`container:`.

String form attaches to an existing running container:

```yaml
container: my-running-container
```

Object exec mode:

```yaml
container:
  exec: my-running-container
  user: root
  working_dir: /app
  env:
    DEBUG: "true"
  shell: ["/bin/sh", "-c"]
```

Object image mode:

```yaml
container:
  image: python:3.11
  name: report-runner
  pull_policy: missing
  env:
    PYTHONUNBUFFERED: "1"
  volumes:
    - ./data:/data
  working_dir: /app
  platform: linux/amd64
  user: "1000:1000"
  ports:
    - "8080:8080"
  network: host
  startup: keepalive
  wait_for: running
  log_pattern: "Ready"
  restart_policy: unless-stopped
  keep_container: false
  shell: ["/bin/bash", "-c"]
```

Rules:

- Object form must set exactly one of `exec` or `image`.
- Exec mode allows only `exec`, `user`, `working_dir`, `env`, and `shell`.
- Image mode requires `image` and accepts the remaining container fields.
- Container `shell` is array form only.
- Relative host paths in `volumes` resolve from the DAG `working_dir`.
- The container runtime is selected by the Dagu process environment
  (`DAGU_CONTAINER_RUNTIME`, `DAGU_PODMAN_HOST`), not by a YAML field.

### SSH

```yaml
ssh:
  user: deploy
  host: production.example.com
  port: "22"
  key: ~/.ssh/id_rsa
  strict_host_key: true
  known_host_file: ~/.ssh/known_hosts
  shell: "/bin/bash -e"

steps:
  - action: ssh.run
    with:
      command: systemctl status myapp
```

Step-level SSH values under `with` override the DAG-level SSH config for that step.

### S3

Top-level `s3` provides defaults for `s3.upload`, `s3.download`, `s3.list`, and `s3.delete`.

```yaml
s3:
  region: us-east-1
  bucket: reports
  profile: analytics

steps:
  - action: s3.upload
    with:
      local_path: ./report.csv
      key: daily/report.csv
```

Accepted top-level S3 fields are `region`, `endpoint`, `access_key_id`, `secret_access_key`, `session_token`, `profile`, `force_path_style`, `disable_ssl`, and `bucket`.

### LLM

```yaml
llm:
  provider: openai
  model: gpt-4o
  system: |
    You are a helpful assistant.
  temperature: 0.7

steps:
  - action: chat.completion
    with:
      messages:
        - role: user
          content: |
            Summarize ${env.REPORT_PATH}
```

Supported provider values in the schema are `openai`, `anthropic`, `gemini`, `google`, `openrouter`, `local`, `ollama`, `vllm`, and `llama`.

LLM config fields include `provider`, `model`, `system`, `temperature`, `max_tokens`, `top_p`, `base_url`, `api_key_name`, `stream`, `thinking`, `tools`, `max_tool_iterations`, and `web_search`.

### Redis

```yaml
redis:
  host: localhost
  port: 6379
  db: 0

params:
  - name: user_id
    required: true

steps:
  - action: redis.get
    with:
      key: cache:user:${params.user_id}
```

Top-level Redis fields are `url`, `host`, `port`, `password`, `username`, `db`, `tls`, `tls_skip_verify`, `mode`, `sentinel_master`, `sentinel_addrs`, `cluster_addrs`, and `max_retries`.

### Kubernetes

```yaml
kubernetes:
  namespace: batch
  context: production
  service_account: dagu-runner
  resources:
    requests:
      cpu: "100m"
      memory: "128Mi"

steps:
  - id: report
    action: k8s.run
    with:
      image: alpine:3.20
      command: echo hello
```

Step-level `with` overrides DAG-level `kubernetes` using Kubernetes merge rules: scalars replace, nested maps merge by key, arrays replace, and empty maps or arrays can clear inherited nested values.

### Notifications

| Field | Type | Description |
|-------|------|-------------|
| `mail_on` | object | Email notification triggers: `success`, `failure`, and `wait`. |
| `error_mail` | object | Mail settings for failure notifications. |
| `info_mail` | object | Mail settings for success notifications. |
| `wait_mail` | object | Mail settings for wait/approval notifications. |
| `smtp` | object | SMTP connection settings. |

```yaml
mail_on:
  success: true
  failure: true
  wait: true

error_mail:
  from: alerts@example.com
  to:
    - oncall@example.com
  prefix: "[ALERT]"
  attach_logs: true

smtp:
  host: smtp.example.com
  port: "587"
  username: notifications@example.com
  password: ${env.SMTP_PASSWORD}
```

`mail.send` step inputs use `message`, not `body`.

### Lifecycle Handlers

| Field | Type | Description |
|-------|------|-------------|
| `handler_on.init` | step | Runs before normal steps after DAG preconditions pass. |
| `handler_on.success` | step | Runs when the DAG succeeds. |
| `handler_on.failure` | step | Runs when the DAG fails. |
| `handler_on.abort` | step | Runs when the DAG is aborted. |
| `handler_on.wait` | step | Runs when the DAG enters wait status for approval. |
| `handler_on.exit` | step | Runs when the DAG exits. |

Handlers use the same step schema as normal steps and receive `defaults`.

```yaml
handler_on:
  init:
    run: echo "starting"
  failure:
    action: mail.send
    with:
      to: ops@example.com
      subject: "${context.dag.name} failed"
      message: "See ${context.paths.log_file}"
  exit:
    run: ./cleanup.sh
```

## Step Fields

Steps can be an array or a map. Array form is recommended because it preserves order clearly.

```yaml
type: graph

steps:
  - id: first
    run: echo "first"

  - id: second
    run: echo "second"
    depends: first
```

Map form is accepted:

```yaml
type: graph

steps:
  first:
    run: echo "first"
  second:
    run: echo "second"
    depends: first
```

In an array, nested arrays define a parallel group for chain dependency injection.

```yaml
type: chain

steps:
  - run: echo "start"
  - - run: echo "branch A"
    - run: echo "branch B"
  - run: echo "finish"
```

Plain string step entries are legacy syntax and normalize to the legacy command executor. Prefer object steps with `run`.

### Step Identity

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `name` | string | Step name. Auto-generated when omitted in array form. | Auto-generated |
| `id` | string | Stable identifier for references and dependencies. | - |
| `description` | string | Human-readable step description. | - |
| `depends` | string or array | Dependencies by step name or `id`. Not allowed in `type: chain`. | - |

Step `id` must be 40 characters or fewer, match `^[a-zA-Z][a-zA-Z0-9_]*$`, and cannot be one of `env`, `params`, `args`, `stdout`, `stderr`, `output`, or `outputs`. Hyphens are not allowed in step IDs. Use `load_data`, not `load-data`.

### Preferred Execution Fields

| Field | Type | Description |
|-------|------|-------------|
| `run` | string or array | Shell command or multi-line shell script. Array form is legacy compatibility. |
| `action` | string | Built-in, custom, or remote action name. |
| `with` | object | Inputs for `action`, or shell config for `run`. |
| `working_dir` | string | Step working directory. |
| `env` | array or object | Step-specific environment variables. |
| `stdout` | string or object | Redirect stdout to a file, artifact, or run outputs. |
| `stderr` | string or object | Redirect stderr to a file or artifact. |
| `log_output` | string | Step-level log output mode. |
| `output` | string or object | Captured step output variable or structured output mapping. |
| `output_schema` | object | Inline JSON Schema for stdout JSON validation. |
| `timeout_sec` | integer | Step timeout in seconds. |
| `container` | string or object | Step-level container override. |
| `worker_selector` | object | Step-level distributed worker selector. |

`run` and `action` are mutually exclusive.

Array-form `run` is accepted for legacy compatibility, but new workflows should use string `run`. Use `action: exec` when a command must run as direct argv without shell parsing.

For `run` steps, put shell controls under `with`:

```yaml
steps:
  - id: build
    run: |
      npm install
      npm run build
    with:
      shell: bash
      shell_args: [-e, -o, pipefail]
```

Accepted `with` keys for `run` are `shell`, `shell_args`, and `shell_packages`.

For action steps, action-specific inputs go under `with`:

```yaml
steps:
  - id: wait_for_api
    action: wait.http
    with:
      url: https://api.example.com/health
      status: 200
      poll_interval: 5s
    timeout_sec: 300
```

`with` and `config` cannot both be used. `config` is a legacy alias.

### Legacy Execution Fields

The parser still accepts these legacy step fields, but new workflow files should prefer `run` or `action`:

| Field | Replacement |
|-------|-------------|
| `command` | `run`, or `action: exec` for direct argv execution |
| `exec` | `action: exec` |
| `script` | `run` or action-specific input |
| `shell` | `with.shell` on a `run` step |
| `shell_args` | `with.shell_args` on a `run` step |
| `shell_packages` | `with.shell_packages` on a `run` step |
| `type` | `action` |
| `call` and step `params` | `action: dag.run` with `with.dag` and `with.params` |
| `messages`, `llm` | `action: chat.completion` with `with` |
| `value`, `routes` | `action: router.route` with `with` |

Do not combine `run` or `action` with legacy execution fields.

### Built-In Actions

Accepted built-in action names:

| Action | Purpose |
|--------|---------|
| `artifact.list`, `artifact.read`, `artifact.write` | DAG-run artifact operations. |
| `archive.create`, `archive.extract`, `archive.list` | Archive operations. |
| `chat.completion` | LLM chat completion. |
| `container.run` | Container executor. |
| `dag.run` | Run a child DAG synchronously. |
| `dag.enqueue` | Enqueue a child DAG asynchronously. |
| `data.convert`, `data.pick` | Data conversion and selection helpers. |
| `docker.run` | Docker executor. |
| `exec` | Direct process execution without shell parsing. |
| `file.copy`, `file.delete`, `file.list`, `file.mkdir`, `file.move`, `file.read`, `file.stat`, `file.write` | File operations. |
| `git.checkout` | Clone or update a Git repository. |
| `harness.run` | CLI coding-agent harness execution. |
| `http.request` | HTTP requests. |
| `jq.filter` | jq transforms. |
| `k8s.run`, `kubernetes.run` | Kubernetes job execution. |
| `log.write` | Write a log message. |
| `mail.send` | Send email. |
| `noop` | Placeholder step. |
| `outputs.write` | Write run-level or action outputs. |
| `postgres.query`, `postgres.import` | PostgreSQL query/import actions. |
| `redis.<operation>` | Redis operation selected by the action suffix. |
| `router.route` | Conditional routing. |
| `s3.delete`, `s3.download`, `s3.list`, `s3.upload` | S3 operations. |
| `sftp.download`, `sftp.upload` | SFTP transfers. |
| `sqlite.query`, `sqlite.import` | SQLite query/import actions. |
| `ssh.run` | Remote shell over SSH. |
| `state.get`, `state.set`, `state.delete`, `state.list`, `state.diff` | Persistent JSON state across DAG runs. See [Persistent State](/writing-workflows/persistent-state). |
| `template.render` | Template rendering. |
| `wait.duration`, `wait.file`, `wait.http`, `wait.until` | Wait and polling actions. |

DuckDB is provided as the official [`duckdb@v1` action](/step-types/sql/duckdb), not as a built-in SQL action.

### Direct Exec

Use `action: exec` to run a binary with explicit argv and no shell parsing.

```yaml
steps:
  - action: exec
    with:
      command: /usr/bin/python3
      args:
        - -u
        - app.py
        - --limit
        - 10
```

`with.command` is required. `with.args` accepts strings, numbers, and booleans.

### Child DAG Actions

```yaml
steps:
  - id: run_child
    action: dag.run
    with:
      dag: child_workflow
      params:
        MODE: blocking
```

```yaml
steps:
  - id: enqueue_child
    action: dag.enqueue
    with:
      dag: child_workflow
      params:
        MODE: background
      queue: background
```

`dag.run` waits for the child DAG to finish. `dag.enqueue` waits only until the child run is persisted and queued. `dag.enqueue` accepts the same `with.dag` and `with.params` inputs as `dag.run`, plus `with.queue`.

### Parallel Child DAG Runs

| Field | Type | Description |
|-------|------|-------------|
| `parallel.items` | array | Static items to fan out. |
| `parallel.variable` | string | Variable name whose value is expanded at runtime. |
| `parallel.max_concurrent` | integer | Maximum concurrent child runs. Must be greater than `0` if set. |

`parallel` is valid only with `action: dag.run` or `action: dag.enqueue`, and it requires `items` or `variable`.

```yaml
steps:
  - action: dag.run
    with:
      dag: file_processor
      params: "file=${env.ITEM}"
    parallel:
      items: [file1.csv, file2.csv, file3.csv]
      max_concurrent: 2
```

Inside each parallel child run, `ITEM` is set to the current item.

### Output

Declared outputs publish validated values for later steps:

```yaml
type: graph

steps:
  - id: get_version
    run: |
      printf 'version=%s\n' "$(cat VERSION)" >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: version

  - id: build
    run: docker build -t "app:${steps.get_version.outputs.version}" .
    depends: get_version
```

Use one declared output name per strict reference:

```yaml
type: graph

steps:
  - id: get_config
    run: cat config.json
    output_schema:
      type: object
      properties:
        port:
          type: integer
      required: [port]
```

`output_schema` must be an inline JSON Schema object. It is not a path. When present, Dagu captures stdout, decodes it as JSON, validates it, and fails the step on invalid JSON or schema mismatch.

Use `stdout.artifact` or `stderr.artifact` to write command output into the run artifact directory:

```yaml
steps:
  - id: report
    run: ./generate-report
    stdout:
      artifact: reports/report.md
```

Artifact stream paths are relative to the run artifact directory. Absolute paths, Windows drive paths, and paths containing `..` are rejected. Artifact stream outputs auto-enable artifacts unless `artifacts.enabled: false` is set.

### Conditions And Continuation

| Field | Type | Description |
|-------|------|-------------|
| `preconditions` | string or array | Conditions checked before the step executes. |
| `continue_on` | string or object | Conditions under which the DAG continues after failure or skip. |

```yaml
steps:
  - id: deploy
    run: ./deploy.sh
    preconditions:
      - condition: "${env.ENVIRONMENT}"
        expected: production
      - condition: "`git branch --show-current`"
        expected: main

  - id: optional
    run: ./optional.sh
    continue_on:
      failure: true
      skipped: true
      exit_code: [0, 1, 2]
      output: ["WARNING", "re:^INFO:"]
      mark_success: true
```

Precondition fields:

| Field | Type | Description |
|-------|------|-------------|
| `condition` | string | Expression or command check. |
| `expected` | string | Expected value or regex pattern with `re:`. |
| `negate` | boolean | Invert the condition result. |

If `expected` is omitted, Dagu evaluates `condition` and runs the result as a command check. Shell syntax requires a shell.

### Retry And Repeat

Step-level `retry_policy` retries one step.

| Field | Type | Description |
|-------|------|-------------|
| `limit` | integer or string | Maximum retry attempts after the first failure. Required when `retry_policy` is present. |
| `interval_sec` | integer or string | Base interval between retries, in seconds. Required when `retry_policy` is present. |
| `backoff` | boolean or number | `true` means `2.0`; a number greater than `1.0` is used as the multiplier. |
| `max_interval_sec` | integer | Maximum interval between retries. |
| `exit_code` | array | Exit codes that trigger retry. Default is all non-zero exits. |

```yaml
steps:
  - run: curl https://api.example.com
    retry_policy:
      limit: 5
      interval_sec: 2
      backoff: true
      max_interval_sec: 60
      exit_code: [429, 503]
```

`repeat_policy` repeats one step.

| Field | Type | Description |
|-------|------|-------------|
| `repeat` | string or boolean | `while`, `until`, or legacy `true` for `while`. |
| `interval_sec` | integer or string | Delay between repetitions. |
| `backoff` | boolean or number | Exponential backoff multiplier. |
| `max_interval_sec` | integer or string | Maximum repetition interval. |
| `limit` | integer or string | Maximum number of executions. |
| `condition` | string | Condition to evaluate. |
| `expected` | string | Expected value or pattern. |
| `exit_code` | array | Exit codes that trigger repeat. |

```yaml
steps:
  - run: check-process.sh
    repeat_policy:
      repeat: while
      exit_code: [0]
      interval_sec: 60
      limit: 30
```

### Approval

| Field | Type | Description |
|-------|------|-------------|
| `approval.prompt` | string | Message displayed to the approver. |
| `approval.input` | array | Parameter names to collect from the approver. |
| `approval.required` | array | Required parameters, as a subset of `input`. |
| `approval.rewind_to` | string | Optional step name or ID to restart from on push-back. |

```yaml
steps:
  - id: deploy_prod
    run: ./deploy.sh production
    approval:
      prompt: "Approve production deploy?"
      input: [APPROVED_BY]
      required: [APPROVED_BY]
```

The step runs, then enters waiting status until approved. Collected inputs become environment variables for subsequent steps.

### Step-Level Container

Step `container` uses the same string/object forms as top-level `container`.
For actions that support step-level containers, it overrides the DAG-level
container for that step. Without a step-level container, command steps and
CLI-based `harness.run` steps inherit the DAG-level shared container when one is
configured.

```yaml
steps:
  - id: run_in_container
    container:
      image: python:3.11
      volumes:
        - /data:/data:ro
    run: python process.py

  - id: run_migration
    container: my-app-container
    run: php artisan migrate
```

## Variable Substitution

Dagu resolves scoped references such as `${params.name}`, `${env.NAME}`, `${consts.name}`, and `${steps.step_id.outputs.name}` in fields that support value resolution before the field is used. In `run`, unqualified `$NAME` and `${NAME}` remain shell syntax. Dagu does not execute `$()` or backticks in `run`. Literal defaults in `params` are not executed; use `eval` when a parameter default must be computed by Dagu before steps start.

```yaml
params:
  - name: USER
    default: john
  - name: DOMAIN
    default: example.com
  - name: TODAY
    eval: `date +%Y-%m-%d`

steps:
  - run: echo "Hello ${params.USER} from ${params.DOMAIN}"
  - run: echo "Today is ${params.TODAY}"
  - run: echo "The shell can still run this: `date +%Y-%m-%d`"
```

Declared step outputs are referenced through the `steps` namespace:

```yaml
type: graph

steps:
  - id: get_config
    run: |
      printf 'port=5432\n' >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: port

  - id: print_port
    run: echo "Port is ${steps.get_config.outputs.port}"
    depends: get_config
```

## Built-In Run Context and Runtime Variables

Use `${context.*}` for Dagu-managed run metadata in value-resolved YAML fields. Dagu also projects selected values into process environment variables for scripts and tools.

Common structured references:

| Reference | Description |
|----------|-------------|
| `${context.dag.name}` | Current DAG name. |
| `${context.run.id}` | Current DAG-run ID. |
| `${context.run.status}` | Current status in lifecycle handlers and status-aware surfaces. |
| `${context.attempt.id}` | Current DAG-run attempt ID. |
| `${context.attempt.started_at}` | UTC timestamp for the current attempt start. |
| `${context.step.name}` | Current step or handler name. |
| `${context.trigger.type}` | Trigger type. |
| `${context.paths.log_file}` | Path to the DAG-run log file. |
| `${context.paths.work_dir}` | Per-run isolated work directory path. |
| `${context.paths.artifacts_dir}` | Per-run artifact directory when artifacts are enabled. |
| `${context.paths.step_stdout_file}` | Current step stdout file path. |
| `${context.paths.step_stderr_file}` | Current step stderr file path. |
| `${context.paths.step_output_file}` | Current step output file path for declared outputs. |

Common environment projections:

| Variable | Description |
|----------|-------------|
| `DAG_NAME` | Current DAG name. |
| `DAG_RUN_ID` | Current DAG-run ID. |
| `DAG_RUN_LOG_FILE` | Path to the DAG-run log file. |
| `DAG_RUN_STEP_NAME` | Current step name. |
| `DAG_RUN_STEP_STDOUT_FILE` | Current step stdout file path. |
| `DAG_RUN_STEP_STDERR_FILE` | Current step stderr file path. |
| `DAG_RUN_WORK_DIR` | Per-run isolated work directory path. |
| `DAG_RUN_ARTIFACTS_DIR` | Per-run artifact directory when artifacts are enabled. |
| `DAGU_OUTPUT_FILE` | Current step output file path for declared outputs. |
| `ITEM` | Current `parallel` item. |

See [Runtime Context and Variables](/writing-workflows/runtime-variables) for the full list and compatibility notes.

## Complete Example

```yaml
name: production_etl
description: Daily ETL pipeline for production data
labels:
  env: production
  type: etl
  priority: critical

schedule: "0 2 * * *"

max_active_steps: 5
timeout_sec: 7200
hist_retention_days: 90

params:
  - name: ENVIRONMENT
    default: production
  - name: DATE
    eval: `date +%Y-%m-%d`

env:
  DATA_DIR: /data/etl
  LOG_LEVEL: info

dotenv:
  - /etc/dagu/production.env

container:
  image: python:3.11-slim
  pull_policy: missing
  env:
    PYTHONUNBUFFERED: "1"
  volumes:
    - ./data:/data
    - ./scripts:/scripts:ro

preconditions:
  - condition: "`date +%u`"
    expected: "re:[1-5]"

type: graph

tools:
  - astral-sh/uv@0.11.14

steps:
  - id: validate_environment
    run: ./scripts/validate.sh

  - id: extract_data
    run: |
      raw_data_path="/data/raw/${params.DATE}.json"
      uv run --python 3.13.9 python extract.py --date="${params.DATE}" --output "$raw_data_path"
      printf 'raw_data_path=%s\n' "$raw_data_path" >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: raw_data_path
    retry_policy:
      limit: 3
      interval_sec: 300
    depends: validate_environment

  - id: transform_data
    action: dag.run
    with:
      dag: transform_module
      params: "type=${env.ITEM} input=${steps.extract_data.outputs.raw_data_path}"
    parallel:
      items: [customers, orders, products]
      max_concurrent: 2
    depends: extract_data

  - id: load_data
    container:
      image: postgres:16
      env:
        PGPASSWORD: ${env.DB_PASSWORD}
    run: psql -h "${env.DB_HOST}" -U "${env.DB_USER}" -f load.sql
    depends: transform_data

  - id: validate_results
    run: uv run --python 3.13.9 python validate_results.py --date="${params.DATE}"
    mail_on_error: true
    depends: load_data

handler_on:
  success:
    run: ./scripts/notify-success.sh
  failure:
    action: mail.send
    with:
      to: data-team@example.com
      subject: "ETL failed - ${params.DATE}"
      message: "Check logs at ${context.paths.log_file}"
      attach_logs: true
  exit:
    run: ./scripts/cleanup.sh "${params.DATE}"

mail_on:
  failure: true

smtp:
  host: smtp.company.com
  port: "587"
  username: etl-notifications@company.com
  password: ${env.SMTP_PASSWORD}
```

## Common Accuracy Gotchas

- Top-level `resources` is not accepted by the current YAML parser.
- Step IDs cannot contain hyphens. Use underscores.
- `max_active_steps` defaults to `0`, which means unlimited step concurrency inside one DAG run.
- `mail.send` uses `message`, not `body`.
- `type: chain` forbids explicit `depends` and router steps.
- `run` and `action` are mutually exclusive.
- `output_schema` is an inline JSON Schema object, not a file path.
- `dotenv` defaults to `.env`; specifying extra files does not remove `.env`. Use `dotenv: []` to disable dotenv loading.
