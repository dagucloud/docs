# YAML Specification

## Overview

Dagu workflows are defined using YAML files. Each file represents a DAG (Directed Acyclic Graph) that describes your workflow steps and their relationships.

## Basic Structure

```yaml
# Workflow metadata
description: "What this workflow does"
labels: {env: prod, team: platform}  # Optional: key-value labels

# Scheduling
schedule: "0 * * * *"      # Optional: cron expression or typed start/stop/restart schedule map

# Execution control
max_active_steps: 10         # Max parallel steps
timeout_sec: 3600           # Workflow timeout (seconds)

# Parameters (`default` is literal; inline `eval` is optional)
params:
  - name: environment
    type: string
    default: staging
    enum: [dev, staging, prod]
  - name: batch_size
    type: integer
    default: 25
    minimum: 1
    maximum: 100

# Environment variables
env:
  - VAR_NAME: value
  - PATH: ${PATH}:/custom/path

# DAG run artifacts
artifacts:
  enabled: true

# Workflow steps (type: graph requires explicit depends)
type: graph
steps:
  - id: step_name          # Optional
    command: echo "Hello"
    depends: previous_step # Optional

# Lifecycle handlers
handler_on:
  success:
    command: notify-success.sh
  failure:
    command: cleanup-on-failure.sh
```

## Root Fields

### Metadata Fields

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `name` | string | Workflow name | Filename without extension |
| `description` | string | Human-readable description | - |
| `labels` | string/object/array | Labels for categorization. Supports key-value pairs. See [Labels](/writing-workflows/labels). | `[]` |
| `group` | string | Group name for organization | - |

### Execution Type

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `type` | string | Execution type: `chain` or `graph` | `chain` |

- **`chain`** (default): Steps execute sequentially in the order defined. Each step implicitly depends on the previous step. The `depends` field is **not allowed** in chain mode.
- **`graph`**: Steps execute based on explicit dependencies defined by the `depends` field. Steps without dependencies can run in parallel (up to `max_active_steps`).

```yaml
# Chain mode (default) - sequential execution
steps:
  - command: echo "First"
  - command: echo "Second"   # Waits for First
  - command: echo "Third"    # Waits for Second

---

# Graph mode - dependency-based execution
type: graph
steps:
  - id: fetch_a
    command: curl https://api.example.com/a
  - id: fetch_b
    command: curl https://api.example.com/b
  - id: merge
    command: ./merge.sh
    depends: [fetch_a, fetch_b]  # Runs after both complete
```

### Scheduling Fields

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `schedule` | string/array/object | Cron expression(s), one-off `at` entries in top-level arrays, or a `start`/`stop`/`restart` schedule map. `start` also accepts one-off `at` entries. | - |
| `skip_if_successful` | boolean | Skip if already succeeded today | `false` |
| `restart_wait_sec` | integer | Wait seconds before restart | `0` |
| `catchup_window` | string | Lookback horizon for replaying missed cron runs on scheduler restart. Duration string (e.g. `"6h"`, `"2d12h"`). If omitted, missed runs are not replayed. | - |
| `overlap_policy` | string | Catchup overlap behavior when DAG is already running: `"skip"` drops the run, `"all"` retries next tick, `"latest"` keeps only the newest missed interval. | `"skip"` |

#### Schedule Formats

```yaml
# Single schedule
schedule: "0 2 * * *"

# Multiple schedules
schedule:
  - "0 9 * * MON-FRI"   # 9 AM weekdays
  - "0 14 * * SAT,SUN"  # 2 PM weekends

# With timezone
schedule: "CRON_TZ=America/New_York 0 9 * * *"

# One-off schedule
schedule:
  - at: "2026-03-29T09:30:00+09:00"

# One-off start time
schedule:
  start:
    - at: "2026-03-29T09:30:00+09:00"

# Equivalent explicit kind
schedule:
  start:
    - kind: at
      at: "2026-03-29T09:30:00+09:00"

# Start/stop schedules
schedule:
  start:
    - "0 8 * * MON-FRI"   # Start at 8 AM
  stop:
    - "0 18 * * MON-FRI"  # Stop at 6 PM
  restart:
    - "0 12 * * MON-FRI"  # Restart at noon
```

`at` is supported in top-level `schedule` arrays and under `schedule.start`. `stop` and `restart` remain cron-only. The timestamp must be an RFC 3339 timestamp with an explicit offset or `Z`, and seconds must be `:00`.

### Execution Control Fields

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `max_active_runs` | integer | **DEPRECATED**: Use global queues with `queue` field instead. Local queues now use FIFO (concurrency 1). | `1` |
| `max_active_steps` | integer | Max parallel steps | `1` |
| `timeout_sec` | integer | Workflow timeout in seconds | `0` (no timeout) |
| `delay_sec` | integer | Initial delay before start (seconds) | `0` |
| `max_clean_up_time_sec` | integer | Max cleanup time (seconds) | `5` |
| `preconditions` | string/array | Workflow-level preconditions | - |
| `retry_policy` | object | Scheduler-driven retry policy for the whole DAG | - |
| `run_config` | object | User interaction controls when starting DAG | - |

### DAG Retry Policy

Root `retry_policy` is a DAG-level retry policy. It is different from step `retry_policy`.

- It retries the whole DAG after a failed attempt.
- It requires the scheduler.
- It creates a new attempt under the same DAG-run ID.
- It does not support `exit_code`.

See [Durable Execution](/writing-workflows/durable-execution) for the full behavior, including scheduler polling and `scheduler.retry_failure_window`.

#### DAG Retry Policy Fields

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `limit` | integer/string | Maximum number of scheduler-issued DAG retries. Must be non-negative. Numeric strings are accepted. Use `0` to disable DAG-level automatic retries, for example to override an inherited base config retry policy. | required |
| `interval_sec` | integer/string | Base delay before retrying, in seconds. Must be positive. Numeric strings are accepted. | `60` |
| `backoff` | boolean/number | `true` means `2.0`. A number greater than `1.0` is used as the multiplier. `false`, `0`, or omission keeps a fixed interval. | fixed interval |
| `max_interval_sec` | integer | Maximum retry delay in seconds. Must be positive. | `3600` |

```yaml
retry_policy:
  limit: 2
  interval_sec: 60
  backoff: true
  max_interval_sec: 900
```

### Step Defaults

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `defaults` | object | Default values applied to every step and `handler_on` step. Steps that define their own value override the default. | - |

The `defaults` block accepts the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `retry_policy` | object | Default [retry policy](#retry-policy-fields) for all steps |
| `continue_on` | string/object | Default [continue_on](#continueon-fields) condition for all steps |
| `repeat_policy` | object | Default [repeat policy](#repeat-policy-fields) for all steps |
| `timeout_sec` | integer | Default step timeout in seconds |
| `mail_on_error` | boolean | Default mail-on-error flag for all steps |
| `signal_on_stop` | string | Default signal sent when a step is stopped |
| `env` | array/object | Environment variables prepended to each step's own `env` |
| `preconditions` | string/array | Preconditions prepended to each step's own `preconditions` |
| `agent` | object | Default agent configuration merged per field into a step's `agent` block. See [Agent Step](/features/agent/step#dag-level-defaults). |

**Merge rules:**

- **Override fields** (`retry_policy`, `continue_on`, `repeat_policy`, `timeout_sec`, `mail_on_error`, `signal_on_stop`): Applied only when the step does not set its own value. A step-level value fully replaces the default.
- **Agent fields** (`agent`): Applied per subfield rather than as a whole-object replacement. Supported default subfields are `model`, `tools`, `soul`, `memory`, `prompt`, `max_iterations`, and `safe_mode`.
- **Additive fields** (`env`, `preconditions`): Default entries are prepended before the step's own entries. Both the default and step values are present at runtime.

Unknown keys inside `defaults` cause a validation error.

```yaml
# All steps inherit retry_policy and continue_on
defaults:
  retry_policy:
    limit: 3
    interval_sec: 5
    exit_code: [1]
  continue_on: failed

steps:
  - id: fetch_data
    command: curl https://api.example.com/data

  - id: process_data
    command: ./process.sh
```

```yaml
# Override + additive behavior
defaults:
  retry_policy:
    limit: 5
    interval_sec: 10
  env:
    - LOG_LEVEL: info

steps:
  # Inherits retry_policy (limit: 5) and gets LOG_LEVEL from defaults
  - id: step_a
    command: ./run.sh

  # Overrides retry_policy with its own; still gets LOG_LEVEL from defaults
  # plus its own TIMEOUT env var
  - id: step_b
    command: ./run-critical.sh
    retry_policy:
      limit: 1
      interval_sec: 0
    env:
      - TIMEOUT: "30"
    # Effective env: [LOG_LEVEL=info, TIMEOUT=30]
```

See [Step Defaults](/writing-workflows/step-defaults) for detailed documentation and examples.

### Custom Step Types

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `step_types` | object | Reusable custom step type definitions for this YAML document. Merged with base-config `step_types` per document. Duplicate names across scopes are rejected. | - |

Custom step types expand to builtin-backed steps during DAG load. They are not runtime plugins.

Each definition accepts:

- `type`: required builtin step type or builtin alias
- `input_schema`: required inline JSON Schema object, which must resolve to an object schema
- `template`: required step fragment expanded at build time
- `description`: optional fallback description for the expanded step

See [Custom Step Types](/writing-workflows/custom-step-types) for the full definition rules, template rendering behavior, and call-site restrictions.

### Data Fields

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `params` | string/array/object | Default DAG parameters. Supports positional strings, named params, inline rich definitions, and external schema mode. | `[]` |
| `env` | array | Environment variables | `[]` |
| `secrets` | array | External secret references resolved at runtime and exposed as environment variables | `[]` |
| `dotenv` | string/array | .env files to load | `[".env"]` |
| `working_dir` | string | Working directory for the DAG. Sub-DAGs inherit parent's working_dir if not set. When not set, the per-run work directory (`DAG_RUN_WORK_DIR`) is used as the process working directory. | Per-run work directory (or inherited from parent for sub-DAGs) |
| `shell` | string/array | Default shell program (and args) for all steps; accepts string (`"bash -e"`) or array (`["bash", "-e"]`). Step-level `shell` overrides. | System shell with errexit on Unix when no step shell is set |
| `log_dir` | string | Custom log directory | System default |
| `artifacts` | object | Per-run artifact storage configuration. Storage stays disabled unless `artifacts.enabled` is `true`. | - |
| `log_output` | string | Log output mode: `separate` (stdout/stderr to separate files) or `merged` (both to single file) | `separate` |
| `hist_retention_days` | integer | History retention days | `30` |
| `max_output_size` | integer | Max output size per step (bytes) | `1048576` |

#### `params`

Top-level DAG `params:` supports:

- Positional strings such as `params: first second`
- Named strings such as `params: ENV=dev PORT=8080`
- Ordered lists of strings or single-key maps
- Inline rich definitions in list form using objects with a required `name` field
- Top-level inline JSON Schema using `type: object` plus `properties`
- External schema mode with `{ schema, values }`
- In schema mode, `schema` can be a local path/URL string, an inline JSON Schema object, or a boolean schema

Literal `default` values stay inert. Inline rich definitions may also set `eval` to compute the effective default at execution time.

Recommended authored form:

```yaml
params:
  - name: region
    type: string
    default: us-east-1
    enum: [us-east-1, us-west-2]
    description: Deployment region
  - name: instance_count
    type: integer
    default: 3
    minimum: 1
    maximum: 10
  - name: debug
    type: boolean
    default: false
```

#### `artifacts`

Use `artifacts` to store arbitrary files for each DAG run.

```yaml
artifacts:
  enabled: true
  dir: /mnt/dagu-artifacts
```

Rules:

- `enabled: true` is required to turn artifact storage on.
- `dir` changes the base directory for this DAG only.
- `dir` without `enabled: true` does not enable artifact storage.
- Dagu sets `DAG_RUN_ARTIFACTS_DIR` for steps and handlers when artifact storage is enabled.
- The resolved per-run path is recorded in DAG run status as `archiveDir`.

See [Artifacts](/writing-workflows/artifacts) for directory layout, Web UI, and API details.

The older nested-map form such as `- region: { type: string }` is not accepted for rich definitions.

Inline definition fields use `snake_case` in YAML:

| Field | Type | Description |
|-------|------|-------------|
| `eval` | string | Expression evaluated at execution time for the effective default |
| `default` | string/integer/number/boolean | Default value |
| `description` | string | Help text |
| `type` | string | `string`, `integer`, `number`, or `boolean` |
| `required` | boolean | Requires runtime input when no default exists |
| `enum` | array | Allowed values |
| `minimum` / `maximum` | number | Numeric bounds |
| `min_length` / `max_length` | integer | String length bounds |
| `pattern` | string | RE2 regex for string validation |

Inline types affect validation and typed UI controls. Runtime shell variables and `DAG_PARAMS_JSON` remain string-based.

If both `eval` and `default` are present, `eval` wins at execution time and `default` becomes the literal fallback and display value.

For backward compatibility:

- `params: { schema: prod }` remains a legacy named param unless `schema` looks like a file path or URL or `values` is also present.
- `params: { schema: true }` remains a legacy named param unless `values` is also present.
- `params: { properties: { foo: bar } }` remains a legacy named param map unless the same object also has `type: object`.

#### `params[].eval`

`eval` is available on inline rich definitions:

```yaml
env:
  - BASE_DIR: /srv/data

params:
  - name: output_dir
    eval: "$BASE_DIR/out"
    default: /tmp/out
  - name: today
    eval: "`date +%Y-%m-%d`"
  - name: workers
    type: integer
    eval: "`nproc`"
```

Behavior:

- `default` remains literal.
- Runtime precedence is: override, then `eval`, then `default`.
- DAG `env:` is evaluated first, then params are evaluated sequentially from top to bottom.
- Later params can reference earlier params.
- Inline typed eval results are coerced before validation.
- If `eval` fails and `default` exists, Dagu falls back to `default`.
- If `eval` fails and no `default` exists, the run fails before any step starts.
- CLI, API, and sub-DAG runtime overrides are never evaluated.
- Metadata-only loads skip `eval`.
- External-schema-backed defaults are not evaluated.

### Container Configuration

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `container` | string/object | Container configuration. Can be a string (existing container name to exec into) or an object (container configuration with `exec` or `image` field). | - |

The `container` field supports two modes:
- **Image mode**: Create a new container from a Docker image (`image` field required)
- **Exec mode**: Execute in an existing running container (`exec` field or string form)

#### String Form (Exec Mode)

```yaml
container: my-running-container  # Exec into existing container with defaults
```

#### Object Form - Image Mode

```yaml
container:
  name: my-workflow        # Optional: custom container name
  image: python:3.11       # Required for image mode
  pull_policy: missing      # always, missing, never
  env:
    - API_KEY=${API_KEY}
  volumes:
    - /data:/data:ro
  working_dir: /app
  platform: linux/amd64
  user: "1000:1000"
  ports:
    - "8080:8080"
  network: host
  startup: keepalive       # keepalive | entrypoint | command
  command: ["sh", "-c", "my-daemon"]   # when startup: command
  wait_for: running         # running | healthy
  log_pattern: "Ready to accept connections"  # optional regex
  restart_policy: unless-stopped              # optional: no|always|unless-stopped
  keep_container: false     # Keep container after DAG run
  shell: ["/bin/bash", "-c"]  # Optional: shell wrapper for step commands (enables pipes, &&, etc.)
```

#### Object Form - Exec Mode

```yaml
container:
  exec: my-running-container  # Required for exec mode
  user: root                  # Optional: override user
  working_dir: /app            # Optional: override working directory
  env:                        # Optional: additional environment variables
    - DEBUG=true
  shell: ["/bin/sh", "-c"]    # Optional: shell wrapper for step commands
```

#### Field Availability by Mode

| Field | Exec Mode | Image Mode |
|-------|-----------|------------|
| `exec` | **Required** | Not allowed |
| `image` | Not allowed | **Required** |
| `user`, `working_dir`, `env`, `shell` | Optional | Optional |
| All other fields | Not allowed | Optional |

> Note: A DAG‑level `container` is started once (image mode) or attached to (exec mode)
> and kept alive while the workflow runs; each step executes via `docker exec` inside that container.
> This means step commands do not pass through the image's `ENTRYPOINT`/`CMD`.
> If your image's entrypoint dispatches subcommands, invoke it explicitly in
> the step command (see [Execution Model and Entrypoint Behavior](/writing-workflows/container#execution-model-and-entrypoint-behavior)).
> For exec mode, the container must be running; Dagu waits up to 120 seconds.
> For image mode, readiness waiting (running/healthy and optional log_pattern) times out after
> 120 seconds with a clear error including the last known state.

### Secrets

The `secrets` block defines environment variables whose values are fetched at runtime from a provider. Each item is an object with the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Environment variable name exposed to steps (required) |
| `provider` | string | Secret provider identifier (required). Built-in providers are `env`, `file`, `kubernetes`, and `vault`. |
| `key` | string | Provider-specific key (required). For `env` this is the source variable name. For `file` this is a path. For `kubernetes` this is a `secret-name/data-key` pair unless `options.secret_name` is set. For `vault` this is a Vault path or a `path/field` pair, depending on `options.field`. |
| `options` | object | Provider-specific options (optional). Values must be strings. |

`key` and `options` are literal provider inputs. Dagu does not expand `${...}` expressions inside them.

Example:

```yaml
secrets:
  - name: DB_PASSWORD
    provider: env
    key: PROD_DB_PASSWORD        # Read from process environment
  - name: API_TOKEN
    provider: file
    key: ../secrets/api-token    # Relative paths resolve using working_dir then DAG file directory
  - name: DB_PASSWORD
    provider: kubernetes
    key: app-secrets/db-password
    options:
      namespace: production
```

Secret values are injected after DAG-level variables and built-in runtime variables, meaning they take precedence over everything except step-level overrides. Dagu masks resolved secret values in its managed logs and captured outputs, but workflow code can still write those values elsewhere.

See [Secrets](/writing-workflows/secrets) for provider behavior and lookup rules.

### SSH Configuration

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `ssh` | object | Default SSH configuration for all steps | - |

```yaml
ssh:
  user: deploy
  host: production.example.com
  port: "22"           # Optional, defaults to "22"
  key: ~/.ssh/id_rsa   # Optional, defaults to standard keys
  password: "${SSH_PASSWORD}" # Optional; prefer keys for security
  strict_host_key: true  # Optional, defaults to true for security
  known_host_file: ~/.ssh/known_hosts  # Optional, defaults to ~/.ssh/known_hosts
  shell: "/bin/bash -e"  # Optional: shell (string or array) for remote execution
```

When configured at the DAG level, all steps using SSH executor will inherit these settings:

```yaml
# DAG-level SSH configuration
ssh:
  user: deploy
  host: app.example.com
  key: ~/.ssh/deploy_key
  shell: /bin/bash  # Commands wrapped in shell

steps:
  # These steps inherit the DAG-level SSH configuration
  - command: systemctl status myapp
  - command: systemctl restart myapp

  # Step-level with overrides DAG-level
  - type: ssh
    with:
      user: backup      # Override user
      host: db.example.com  # Override host
      key: ~/.ssh/backup_key  # Override key
      shell:
        - /bin/sh        # Override shell with explicit flags
        - -e
    command: mysqldump mydb > backup.sql
```

**Important Notes:**
- SSH and container fields are mutually exclusive at the DAG level
- Step-level SSH configuration completely overrides DAG-level configuration (no partial overrides)
- Password authentication is supported but not recommended; prefer key-based auth
- Default SSH keys are tried if no key is specified: `~/.ssh/id_rsa`, `~/.ssh/id_ecdsa`, `~/.ssh/id_ed25519`, `~/.ssh/id_dsa`
- `ssh.shell` at the DAG level accepts either a string (e.g., `"/bin/bash -e"`) or array form (e.g., `["/bin/bash","-e","-o","pipefail"]`). Dagu tokenizes the value into the remote shell executable and arguments before wrapping commands.
- For step-level SSH `with.shell`, use string form (e.g., `"/bin/bash -e"`). Array syntax is not supported when decoding the YAML map into the executor configuration.

### LLM Configuration

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `llm` | object | Default LLM configuration for all chat steps | - |

```yaml
llm:
  provider: openai
  model: gpt-4o
  system: "You are a helpful assistant."
  temperature: 0.7

steps:
  - type: chat
    messages:
      - role: user
        content: "What is 2+2?"
```

When configured at the DAG level, all chat steps inherit the LLM configuration. Step-level `llm:` completely overrides DAG-level configuration (no field-level merging).

See [Chat Executor](/features/chat/) for full documentation.

### Harness Configuration

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `harnesses` | object | Named custom harness definitions available to harness steps | - |
| `harness` | object | Default harness configuration inherited by harness steps | - |

```yaml
harnesses:
  gemini:
    binary: gemini
    prefix_args: ["run"]
    prompt_mode: flag
    prompt_flag: --prompt

harness:
  provider: gemini
  model: gemini-2.5-pro
  fallback:
    - provider: claude
      model: sonnet

steps:
  - command: "Summarize the repository status" # inferred as type: harness

  - type: harness
    command: "Review the auth module"
    with:
      provider: claude
      bare: true
```

`harnesses:` is a map from provider name to a custom harness definition. The name is referenced from `with.provider`.

Custom harness definition fields:

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `binary` | string | yes | - |
| `prefix_args` | string[] | no | `[]` |
| `prompt_mode` | `arg` \| `flag` \| `stdin` | no | `arg` |
| `prompt_flag` | string | only for `flag` mode | - |
| `prompt_position` | `before_flags` \| `after_flags` | no | `before_flags` |
| `flag_style` | `gnu_long` \| `single_dash` | no | `gnu_long` |
| `option_flags` | object | no | - |

Definition rules:

- custom harness names cannot be `claude`, `codex`, `copilot`, `opencode`, or `pi`
- `prompt_flag` is required and only valid when `prompt_mode: flag`
- unknown keys in a harness definition are rejected

If a DAG is loaded with a base config:

- `harnesses` entries merge by name
- redefining the same name replaces the entire inherited definition
- `harnesses.<name>: null` deletes the inherited definition

`harness:` is the DAG-level default config for harness steps.

- Steps with `type: harness` inherit the DAG-level primary config.
- Steps without an explicit `type:` are treated as `type: harness` when `harness:` is present.
- Step-level `with:` overrides DAG-level primary keys on conflict.
- Step-level `fallback:` replaces the DAG-level fallback list instead of merging with it.

The `harness:` block accepts the same fields as step-level harness `with:`:

- `provider`, which may be a built-in provider or a custom name from `harnesses:`
- arbitrary CLI flag keys passed through to the provider
- `fallback`, an ordered list of alternative provider configs

Reserved keys `provider` and `fallback` are consumed by the harness executor and are not passed through as CLI flags.

Flag generation rules:

- strings and numbers become `flag value`
- `true` becomes a bare flag
- `false` and empty strings are omitted
- arrays become repeated flags
- built-in providers use `--key` and normalize `snake_case` keys to kebab-case flag names
- custom definitions use `--key`, `-key`, or `option_flags` according to the selected harness definition
- provider-specific flag names and values are not validated by Dagu

`script` handling depends on the resolved provider:

- built-in providers and custom `arg` / `flag` definitions pass `command` on argv and pipe `script` to stdin
- custom `stdin` definitions put the prompt on stdin; if both `command` and `script` are present, stdin is `prompt + "\n\n" + script`

Harness steps accept one prompt command. Multiple command arrays are rejected.

See [Harness Step](/step-types/harness) for provider details, fallback behavior, and examples.

### Redis Configuration

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `redis` | object | Default Redis configuration for all redis steps | - |

```yaml
redis:
  host: localhost
  port: 6379
  password: ${REDIS_PASSWORD}
  db: 0

steps:
  - id: cache_lookup
    type: redis
    with:
      command: GET
      key: cache:user:${USER_ID}
    output: CACHED_DATA
```

When configured at the DAG level, all redis steps inherit the connection settings. Step-level `with` values override DAG-level defaults (field-level merging).

**Available fields:**
- `url` - Redis URL (`redis://user:pass@host:port/db`)
- `host` - Redis host (alternative to URL)
- `port` - Redis port (default: 6379)
- `password` - Authentication password
- `username` - ACL username (Redis 6+)
- `db` - Database number (0-15)
- `tls` - Enable TLS connection
- `mode` - Connection mode: `standalone`, `sentinel`, `cluster`
- `sentinel_master` - Sentinel master name
- `sentinel_addrs` - Sentinel addresses
- `cluster_addrs` - Cluster node addresses

See [Redis Executor](/step-types/redis) for full documentation.

### Kubernetes Configuration

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `kubernetes` | object | Default Kubernetes configuration for explicit `k8s` / `kubernetes` steps | - |

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
    type: k8s
    with:
      image: alpine:3.20
    command: echo hello
```

When configured at the DAG level, only steps with `type: k8s` or `type: kubernetes` inherit these defaults. The root `kubernetes:` block does not change the executor type of plain command steps.

Step-level `with` overrides DAG-level `kubernetes` using Kubernetes-specific merge rules:
- scalar values replace DAG defaults
- nested objects merge by key with the step value winning
- arrays replace the DAG value wholesale
- empty objects and empty arrays can be used to clear inherited nested values

The DAG-level block accepts the same fields as the step-level Kubernetes executor `with` block, except `image` is optional at the DAG level and must still be provided by the effective step configuration.

That includes cluster selection, image/runtime settings, env and env sources, resources, service account, scheduling controls, labels/annotations, volumes, lifecycle controls, and the typed Kubernetes additions:

- `security_context`
- `pod_security_context`
- `affinity`
- `termination_grace_period_seconds`
- `priority_class_name`
- `pod_failure_policy`

See [Kubernetes Step](/step-types/kubernetes) for the full executor reference and examples.

### Working Directory and Volume Resolution

When using container volumes with relative paths, the paths are resolved relative to the DAG's `working_dir`:

```yaml
# DAG with working directory and container volumes
working_dir: /app/project
container:
  image: python:3.11
  volumes:
    - ./data:/data        # Resolves to /app/project/data:/data
    - .:/workspace        # Resolves to /app/project:/workspace
    - /abs/path:/other   # Absolute paths are unchanged

steps:
  - command: python process.py
```

**Default Working Directory:**
- When `working_dir` is **not** set in the DAG YAML or base config, the per-run work directory (`DAG_RUN_WORK_DIR`) is used as the process working directory. This gives each run an isolated workspace automatically.
- When `working_dir` **is** explicitly set, the explicit value is used. `DAG_RUN_WORK_DIR` is still available as an environment variable.

**Working Directory Inheritance:**
- Steps inherit `working_dir` from the DAG if not explicitly set
- Step-level `working_dir` overrides DAG-level `working_dir`
- **Sub-DAGs (via `call`)** inherit the parent's `working_dir` when executed locally, unless they define their own explicit `working_dir`

```yaml
# Example of working_dir inheritance
working_dir: /project          # DAG-level working directory

steps:
  - command: pwd                   # Outputs: /project
  - working_dir: /custom   # Override DAG working_dir
    command: pwd          # Outputs: /custom
```

**Sub-DAG Working Directory Inheritance:**

When a parent DAG calls a child DAG using `call:`, the child inherits the parent's working directory for local execution:

```yaml
# Parent DAG with working_dir
working_dir: /app/project

steps:
  - call: child-workflow    # Child inherits /app/project as working_dir

---
# Child DAG without explicit working_dir
name: child-workflow
steps:
  - command: pwd                     # Outputs: /app/project (inherited from parent)

---
# Child DAG with explicit working_dir (overrides inheritance)
name: child-with-custom-wd
working_dir: /custom/path
steps:
  - command: pwd                     # Outputs: /custom/path
```

> **Note**: Working directory inheritance only applies to local execution. For distributed execution (using `worker_selector`), sub-DAGs use their own context on the worker node.

### Queue Configuration

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `queue` | string | Assign to a global queue defined in `config.yaml` for concurrency control. See [Queues](/writing-workflows/queues). | DAG name (local queue) |

> **Note**: For concurrency control, define global queues in `~/.config/dagu/config.yaml` and reference them with the `queue` field. Local (DAG-based) queues always use FIFO processing with concurrency of 1.

### OpenTelemetry Configuration

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `otel` | object | OpenTelemetry tracing configuration | - |

```yaml
otel:
  enabled: true
  endpoint: "localhost:4317"  # OTLP gRPC endpoint
  headers:
    Authorization: "Bearer ${OTEL_TOKEN}"
  insecure: false
  timeout: 30s
  resource:
    service.name: "dagu-${DAG_NAME}"
    service.version: "1.0.0"
    deployment.environment: "${ENVIRONMENT}"
```

See [OpenTelemetry Tracing](../server-admin/opentelemetry.md) for detailed configuration.

### Notification Fields

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `mail_on` | object | Email notification triggers | - |
| `error_mail` | object | Error email configuration | - |
| `info_mail` | object | Success email configuration | - |
| `wait_mail` | object | Wait status email configuration | - |
| `smtp` | object | SMTP server configuration | - |

```yaml
mail_on:
  success: true
  failure: true
  wait: true      # Email when DAG is waiting for approval

error_mail:
  from: alerts@example.com
  to: oncall@example.com  # Single recipient (string)
  # Or multiple recipients (array):
  # to:
  #   - oncall@example.com
  #   - manager@example.com
  prefix: "[ALERT]"
  attach_logs: true

info_mail:
  from: notifications@example.com
  to: team@example.com  # Single recipient (string)
  # Or multiple recipients (array):
  # to:
  #   - team@example.com
  #   - stakeholders@example.com
  prefix: "[INFO]"
  attach_logs: false

wait_mail:
  from: dagu@example.com
  to: approvers@example.com
  prefix: "[WAITING]"
  attach_logs: false

smtp:
  host: smtp.gmail.com
  port: "587"
  username: notifications@example.com
  password: ${SMTP_PASSWORD}
```

### Handler Fields

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `handler_on` | object | Lifecycle event handlers | - |

```yaml
handler_on:
  init:
    command: echo "Setting up"      # Runs before any steps
  success:
    command: echo "Workflow succeeded"
  failure:
    command: echo "Notifying failure"
  abort:
    command: echo "Cleaning up"
  wait:
    command: echo "Waiting for approval: ${DAG_WAITING_STEPS}"
  exit:
    command: echo "Always running"
```

> **Note**: Sub-DAGs (invoked via `call`) do **not** inherit `handler_on` from base configuration. Each sub-DAG must define its own handlers explicitly. See [Lifecycle Handlers](/writing-workflows/lifecycle-handlers#sub-dag-handler-isolation) for details.

### RunConfig

The `run_config` field allows you to control user interactions when starting DAG runs:

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `disable_param_edit` | boolean | Prevent parameter editing when starting DAG | `false` |
| `disable_run_id_edit` | boolean | Prevent custom run ID input when starting DAG | `false` |

Example usage:

```yaml
# Prevent users from modifying parameters at runtime
run_config:
  disable_param_edit: true
  disable_run_id_edit: false

params:
  - name: environment
    type: string
    default: production
    description: Users cannot change this
  - name: version
    default: 1.0.0
    description: Fixed release version
```

This is useful when:
- You want to enforce specific parameter values for production workflows
- You need consistent run IDs for tracking purposes
- You want to prevent accidental parameter changes

## Step Fields

Each step in the `steps` array can have these fields:

### Basic Fields

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `name` | string | Step name (optional - auto-generated if not provided) | Auto-generated |
| `id` | string | Optional stable identifier for references and dependencies | - |
| `command` | string/array | Command to execute. Can be a string (single command), array of strings (multiple commands executed sequentially), or multi-line string (runs as inline script). | - |
| `exec` | object | Direct binary execution with explicit argv and no shell parsing | - |
| `script` | string | Inline script (alternative to command). Honors shebang when no shell is set. | - |
| `depends` | string/array | Step dependencies | - |

#### Multiple Commands

The `command` field accepts an array of strings. Multiple commands share the same step configuration:

```yaml
steps:
  - id: build_and_test
    command:
      - npm install
      - npm run build
      - npm test
    env:
      - NODE_ENV: production
    working_dir: /app
```

Instead of duplicating `env`, `working_dir`, `retry_policy`, `preconditions`, `container`, etc. across multiple steps, combine commands into one step.

Commands run in order and stop on first failure. Retries restart from the first command.

**Trade-off:** You lose the ability to retry or resume from the middle of the command list.

**Supported step types:** shell, command, docker, container, ssh

**Not supported:** jq, http, archive, mail, dag, template, k8s, kubernetes, harness

These step types do not support multi-command arrays. Use `script:` for `template` steps. Unsupported configurations are rejected at parse time.

#### Direct Exec

For direct command execution steps, `exec` runs a binary with explicit argv and no shell parsing.

```yaml
steps:
  - exec:
      command: /usr/bin/python3
      args:
        - -u
        - app.py
        - --limit
        - 10
```

Rules:

- `exec.command` is required.
- `exec.args` accepts strings, numbers, and booleans.
- `exec` is supported only for direct command execution (`command`, `shell`, or the default command step type).
- `exec` cannot be combined with `command`, `script`, `shell`, or `shell_packages`.
- `working_dir`, `env`, `stdout`, `stderr`, `retry_policy`, `output`, and other normal orchestration fields still apply.

### Step Definition Formats

Steps can be defined in multiple formats:

#### Standard Format
```yaml
steps:
  - command: echo "Hello"
```

#### Shorthand String Format
```yaml
steps:
  - command: echo "Hello"     # Equivalent to: {command: echo "Hello"}
  - command: ls -la          # Equivalent to: {command: ls -la}
```

### Execution Fields

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `working_dir` | string | Working directory (inherits from DAG-level working_dir) | DAG's working_dir |
| `shell` | string/array | Shell program and args for this step; overrides DAG `shell` | DAG `shell` (system default when omitted) |
| `stdout` | string | Redirect stdout to file | - |
| `stderr` | string | Redirect stderr to file | - |
| `log_output` | string | Override DAG-level log output mode for this step | DAG's log_output |
| `output` | string/object | String form captures trimmed stdout into one variable. Object form publishes structured step output for `${step_id.output.*}` references. | - |
| `env` | array/object | Step-specific environment variables (overrides DAG-level) | - |
| `call` | string | Name of a DAG to execute as a sub DAG-run | - |
| `params` | string/object | Parameters passed to sub DAGs | - |

`shell` accepts either a string (e.g., `"bash -e"`) or an array (e.g., `["bash", "-e"]`). DAG-level values expand environment variables when the workflow loads; step-level values are evaluated at runtime so you can reference parameters, secrets, or previous outputs.

Object-form `output:` entries can be literal values or long-form publishers with `from`, `path`, `decode`, and `select`. Only string-form `output: NAME` is collected into the run's `outputs.json`.

### Parallel Execution

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `parallel` | array | Items to process in parallel | - |
| `max_concurrent` | integer | Max parallel executions | No limit |

```yaml
steps:
  - call: file-processor
    parallel:
      items: [file1.csv, file2.csv, file3.csv]
      max_concurrent: 2
    params: "FILE=${ITEM}"
```

### Conditional Execution

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `preconditions` | string/array | Conditions to check before execution | - |
| `continue_on` | string/object | Continue workflow on certain conditions | - |

#### ContinueOn Fields

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `failure` | boolean | Continue execution when step fails | `false` |
| `skipped` | boolean | Continue when step is skipped due to preconditions | `false` |
| `exit_code` | array | List of exit codes that allow continuation | `[]` |
| `output` | array | List of stdout patterns that allow continuation (supports regex with `re:` prefix) | `[]` |
| `mark_success` | boolean | Mark step as successful when continue conditions are met | `false` |

#### Precondition Fields

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `condition` | string | Command or expression to evaluate | - |
| `expected` | string | Expected value or regex pattern (prefix with `re:`) | - |
| `negate` | boolean | Invert the condition logic (run when condition does NOT match) | `false` |

```yaml
steps:
  - command: echo "Deploying"
    preconditions:
      - condition: "${ENVIRONMENT}"
        expected: "production"
      - condition: "`git branch --show-current`"
        expected: "main"

  # With negate: run only when NOT in production
  - command: echo "Running dev task"
    preconditions:
      - condition: "${ENVIRONMENT}"
        expected: "production"
        negate: true  # Runs when condition does NOT match

  - command: echo "Running optional task"
    continue_on:
      failure: true
      skipped: true
      exit_code: [0, 1, 2]
      output: ["WARNING", "SKIP", "re:^INFO:.*"]
      mark_success: true
```

See the [Continue On Reference](/writing-workflows/continue-on) for detailed documentation.

### Error Handling

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `retry_policy` | object | Retry configuration | - |
| `repeat_policy` | object | Repeat configuration | - |
| `mail_on_error` | boolean | Send email on error | `false` |
| `signal_on_stop` | string | Signal to send on stop | `SIGTERM` |

#### Retry Policy Fields

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `limit` | integer/string | Maximum retry attempts after the first failure. Required when `retry_policy` is present. | required |
| `interval_sec` | integer/string | Base interval between retries in seconds. Required when `retry_policy` is present. | required |
| `backoff` | boolean/number | Exponential backoff multiplier. `true` = 2.0, or specify a number greater than 1.0. `false`, `0`, or omission keeps a fixed interval. | fixed interval |
| `max_interval_sec` | integer | Maximum interval between retries in seconds. Applied only when greater than `0`. | uncapped |
| `exit_code` | array | Exit codes that trigger retry | All non-zero |

**Exponential Backoff**: When `backoff` is set, intervals increase exponentially using the formula:  
`interval * (backoff ^ attemptCount)`

String values for step `limit` and `interval_sec` are evaluated at runtime and must resolve to integers.

Root `retry_policy` is different from this step-level `retry_policy`. See [DAG Retry Policy](#dag-retry-policy).

#### Repeat Policy Fields

For iterating over a list of items, use [`parallel`](#parallel-execution) instead.

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `repeat` | string/boolean | Repeat mode: `"while"`, `"until"`, or `true` (legacy alias for `"while"`) | - |
| `interval_sec` | integer/string | Base interval between repetitions (seconds). Accepts variable references like `$VAR` or `${VAR}` resolved at runtime. | - |
| `backoff` | any | Exponential backoff multiplier. `true` = 2.0, or specify custom number > 1.0 | - |
| `max_interval_sec` | integer/string | Maximum interval between repetitions (seconds). Accepts variable references. | - |
| `limit` | integer/string | Maximum number of executions. Accepts variable references. | - |
| `condition` | string | Condition to evaluate | - |
| `expected` | string | Expected value/pattern | - |
| `exit_code` | array | Exit codes that trigger repeat | - |

**Repeat Modes:**
- `while`: Repeats while the condition is true or exit code matches
- `until`: Repeats until the condition is true or exit code matches

**Exponential Backoff**: When `backoff` is set, intervals increase exponentially using the formula:  
`interval * (backoff ^ attemptCount)`
```yaml
steps:
  - command: curl https://api.example.com
    retry_policy:
      limit: 3
      interval_sec: 30
      exit_code: [1, 255]  # Retry only on specific codes
      
  - command: curl https://api.example.com
    retry_policy:
      limit: 5
      interval_sec: 2
      backoff: true        # Exponential backoff (2.0x multiplier)
      max_interval_sec: 60   # Cap at 60 seconds
      exit_code: [429, 503] # Rate limit or unavailable
    
  - command: check-process.sh
    repeat_policy:
      repeat: while        # Repeat WHILE process is running
      exit_code: [0]        # Exit code 0 means process found
      interval_sec: 60
      limit: 30
      
  - command: echo "Checking status"
    output: STATUS
    repeat_policy:
      repeat: until        # Repeat UNTIL status is ready
      condition: "${STATUS}"
      expected: "ready"
      interval_sec: 5
      backoff: 1.5         # Custom backoff multiplier
      max_interval_sec: 300  # Cap at 5 minutes
      limit: 60
```

### Step-Level Container

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `container` | string/object | Container configuration for this step. Can be a string (exec mode) or object (exec or image mode). | - |

Use the `container` field to run a step in its own container:

```yaml
steps:
  # Image mode - create new container
  - id: run_in_container
    container:
      image: python:3.11
      volumes:
        - /data:/data:ro
      env:
        - API_KEY=${API_KEY}
    command: python process.py

  # Exec mode - string form
  - id: run_migration
    container: my-app-container
    command: php artisan migrate

  # Exec mode - object form with overrides
  - id: admin_task
    container:
      exec: my-app-container
      user: root
      working_dir: /app
    command: chown -R app:app /data
```

::: tip
The step-level `container` field uses the same format as DAG-level container configuration, supporting both image mode and exec mode.
:::

::: warning
When using `container`, you cannot use `executor` or `script` fields on the same step.
:::

### Step Type Configuration

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `type` | string | Builtin step type or custom step type name declared in `step_types` or base config | Inferred from other step fields when omitted |
| `with` | object | Builtin executor configuration, or validated input for a custom step type definition | - |

```yaml
steps:
  - type: archive
    with:
      source: assets.tar.gz
      destination: ./assets
    command: extract
```

If `type` refers to a custom step type, schema defaults are applied to `with`, the result is validated against that definition's `input_schema`, and then it is used to render the definition's `template` during DAG load. Runtime expressions can be written directly in `template` strings or used in custom `with` input as scalar leaves. Direct template expressions such as `${COUNT}` are preserved by custom template rendering and expand later only if the expanded builtin step field is runtime-evaluated. For custom `with` input, string schema fields may contain embedded expressions, while integer, number, boolean, and scalar enum fields require the expression to be the whole value. The template is not rendered again when the step executes.

Custom step call sites can still set orchestration fields such as `depends`, `retry_policy`, `env`, `timeout_sec`, `output`, and `approval`, but action-defining fields such as `command`, `exec`, `script`, `shell`, `shell_packages`, `working_dir`, `call`, `params`, `parallel`, `container`, `llm`, `messages`, `agent`, `value`, and `routes` are rejected at the call site.

Custom-step precedence is `call site > template > defaults` for replacement fields. For additive fields, `env` and `preconditions` compose as `defaults -> template -> call site`.

See [Custom Step Types](/writing-workflows/custom-step-types) for the exact allowed field set.

### Chat (LLM)

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `type` | string | Set to `chat` for LLM-based steps | - |
| `llm` | object | LLM configuration (provider, model, system prompt) | - |
| `messages` | array | Session messages for chat steps | - |

```yaml
steps:
  - type: chat
    llm:
      provider: openai
      model: gpt-4o
      system: "You are a helpful assistant."
    messages:
      - role: user
        content: "What is 2+2?"
    output: ANSWER
```

**LLM configuration fields:**
- `provider`: LLM provider (`openai`, `anthropic`, `gemini`, `openrouter`, `zai`, `local`)
- `model`: Model identifier (e.g., `gpt-4o`, `claude-sonnet-4-20250514`)
- `system`: Default system prompt (optional)
- `temperature`: Randomness control 0.0-2.0 (optional)
- `max_tokens`: Maximum tokens to generate (optional)
- `top_p`: Nucleus sampling 0.0-1.0 (optional)
- `base_url`: Custom API endpoint (optional)
- `api_key_name`: API key override (optional)
- `stream`: Enable streaming output (default: true)

**Message format:**
- `role`: Message role (`system`, `user`, `assistant`)
- `content`: Message content (supports `${VAR}` substitution)

See [Chat Executor](/features/chat/) for full documentation.

### Approval

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `approval.prompt` | string | Message displayed to the approver | - |
| `approval.input` | string[] | Parameter names to collect from approver | - |
| `approval.required` | string[] | Required parameters (subset of `input`) | - |
| `approval.rewind_to` | string | Optional step name or ID to restart from on push-back | - |

```yaml
steps:
  - id: deploy_staging
    command: ./deploy.sh staging
    approval:
      prompt: "Approve production?"
      input: [APPROVED_BY]
      required: [APPROVED_BY]
  - id: deploy_prod
    command: ./deploy.sh production
```

The step executes normally, then enters `Waiting` status until approved. Collected inputs become environment variables in subsequent steps.

See [Approval](/writing-workflows/approval) for full documentation.

### Distributed Execution

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `worker_selector` | object \| `"local"` | Worker label requirements for distributed execution, or `"local"` to force local execution | - |

When using distributed execution, specify `worker_selector` to route tasks to workers with matching labels:

```yaml
steps:
  - call: gpu-training
---
# Run on a worker with gpu
name: gpu-training
worker_selector:
  gpu: "true"
  memory: "64G"
steps:
  - command: python train_model.py
```

To force a DAG to run locally even when `default_execution_mode` is `distributed`, use the string `"local"`:

```yaml
# Always runs on the main instance
worker_selector: local
steps:
  - command: curl -f http://localhost:8080/health
```

**Worker Selection Rules:**
- All labels in `worker_selector` must match exactly on the worker
- Label values are case-sensitive strings
- Steps without `worker_selector` can run on any available worker
- If no workers match the selector, the task waits until a matching worker is available
- `worker_selector: local` overrides `default_execution_mode` and forces local execution

See [Distributed Execution](/server-admin/distributed/) for complete documentation.

## Variable Substitution

### Parameter References

```yaml
params:
  - USER: john
  - DOMAIN: example.com

steps:
  - command: echo "Hello ${USER} from ${DOMAIN}"
```

### Environment Variables

```yaml
env:
  - API_URL: https://api.example.com
  - API_KEY: ${SECRET_API_KEY}  # From system env

steps:
  - command: curl -H "X-API-Key: ${API_KEY}" ${API_URL}
```

### Loading Environment from .env Files

The `dotenv` field allows loading environment variables from `.env` files:

```yaml
# Load specific .env file
dotenv: .env.production

# Load multiple .env files (all files loaded, later override earlier)
dotenv:
  - .env.defaults
  - .env.local

# Disable all .env loading
dotenv: []
```

**Loading behavior:**
- If `dotenv` is not specified, Dagu loads `.env` by default
- When files are specified, `.env` is automatically prepended to the list (and deduplicated if already included)
- All files are loaded sequentially in order
- Variables from later files override variables from earlier files
- Missing files are silently skipped
- Files are loaded relative to the DAG's `working_dir`
- System environment variables take precedence over .env file variables
- .env files are loaded at DAG startup, before any steps execute

**Example .env file:**
```bash
# .env file
DATABASE_URL=postgres://localhost/mydb
API_KEY=secret123
DEBUG=true
```

```yaml
# DAG using .env variables
working_dir: /app
dotenv: .env          # Optional, this is the default

steps:
  - command: psql ${DATABASE_URL}
  - command: echo "Debug is ${DEBUG}"
```

### Command Substitution

```yaml
steps:
  - command: echo "Today is `date +%Y-%m-%d`"
    
  - command: deploy.sh
    preconditions:
      - condition: "`git branch --show-current`"
        expected: "main"
```

### Output Variables

```yaml
steps:
  - command: cat VERSION
    output: VERSION
  - command: docker build -t app:${VERSION} .
```

### JSON Path Access

```yaml
steps:
  - command: cat config.json
    output: CONFIG
  - command: echo "Port is ${CONFIG.server.port}"
```

## Special Variables

These variables are automatically available:

| Variable | Description |
|----------|-------------|
| `DAG_NAME` | Current DAG name |
| `DAG_RUN_ID` | Unique run identifier |
| `DAG_RUN_LOG_FILE` | Path to workflow log |
| `DAG_RUN_STEP_NAME` | Current step name |
| `DAG_RUN_STEP_STDOUT_FILE` | Step stdout file path |
| `DAG_RUN_STEP_STDERR_FILE` | Step stderr file path |
| `DAG_RUN_WORK_DIR` | Per-run isolated work directory path |
| `ITEM` | Current item in parallel execution |

## Complete Example

```yaml
name: production-etl
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
  - ENVIRONMENT: production

env:
  - DATE: "`date +%Y-%m-%d`"
  - DATA_DIR: /data/etl
  - LOG_LEVEL: info
  
dotenv:
  - /etc/dagu/production.env

# Default container for all steps
container:
  image: python:3.11-slim
  pull_policy: missing
  env:
    - PYTHONUNBUFFERED=1
  volumes:
    - ./data:/data
    - ./scripts:/scripts:ro

preconditions:
  - condition: "`date +%u`"
    expected: "re:[1-5]"  # Weekdays only

type: graph
steps:
  - command: ./scripts/validate.sh

  - command: python extract.py --date=${DATE}
    depends: validate-environment
    output: RAW_DATA_PATH
    retry_policy:
      limit: 3
      interval_sec: 300
    
  - call: transform-module
    parallel:
      items: [customers, orders, products]
      max_concurrent: 2
    params: "TYPE=${ITEM} INPUT=${RAW_DATA_PATH}"
    continue_on:
      failure: false

 # Use different container for this step
  - id: load_data
    container:
      image: postgres:16
      env:
        - PGPASSWORD=${DB_PASSWORD}
    command: psql -h ${DB_HOST} -U ${DB_USER} -f load.sql

  - command: python validate_results.py --date=${DATE}
    depends: load_data
    mail_on_error: true

handler_on:
  success:
    command: |
      echo "ETL completed successfully for ${DATE}"
      ./scripts/notify-success.sh
  failure:
    type: mail
    with:
      to: data-team@example.com
      subject: "ETL Failed - ${DATE}"
      body: "Check logs at ${DAG_RUN_LOG_FILE}"
      attach_logs: true
  exit:
    command: ./scripts/cleanup.sh ${DATE}

mail_on:
  failure: true
  
smtp:
  host: smtp.company.com
  port: "587"
  username: etl-notifications@company.com
```
