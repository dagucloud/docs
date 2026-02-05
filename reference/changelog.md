# Changelog

## v2.0.0 (UNRELEASED)

### Changed

- **OS Environment Variable Expansion**: OS environment variables (e.g., `$HOME`, `$PATH`) are no longer expanded by Dagu for non-shell executor types (docker, http, ssh, jq, mail, s3, redis, etc.). Only variables explicitly defined in the DAG scope (`env:`, `params:`, `secrets:`, step outputs) are expanded. OS variables pass through unchanged, letting the target environment (container, remote shell, etc.) resolve them. To use a local OS variable in executor config, explicitly import it via the DAG-level `env:` block (e.g., `HOME: "${HOME}"`). Shell command execution is unaffected. See [RFC 007](https://github.com/dagu-org/dagu/blob/main/rfcs/007-os-env-expansion-rules.md).

- **DAG Type Validation**: DAGs with `type: chain` (the default) no longer allow the `depends` field on steps. Chain execution runs steps sequentially in definition order, making explicit dependencies redundant. To use the `depends` field for custom execution order, set `type: graph` explicitly. This change prevents confusion between chain's implicit sequential ordering and graph's explicit dependency-based execution.

### Removed

- **API v1**: The legacy v1 API (`/api/v1/*`) has been completely removed from the codebase. All clients should migrate to the v2 API (`/api/v1/*`). The v1 API was previously disabled when authentication was enabled (v1.26.2), and is now fully removed.

- **Deprecated YAML Fields**: The following deprecated fields have been removed from the YAML spec. Migrate to the replacement fields:

  | Removed Field | Replacement | Context |
  |---------------|-------------|---------|
  | `run` | `call` | Step field for sub-DAG execution |
  | `dir` | `workingDir` | Step field for working directory |
  | `executor` | `type` + `config` | Step field for executor configuration |
  | `precondition` (singular) | `preconditions` (array) | Both DAG-level and step-level |
  | `container.workDir` | `container.workingDir` | Container working directory |

### Added

- **Self-Upgrade Command**: New `dagu upgrade` command for in-place binary updates with SHA256 verification, backup support, and cross-platform compatibility. See [Self-Upgrade](/features/upgrade) for details.
- **Router Examples in Documentation**: Added two router examples to the [Examples](/writing-workflows/examples/) page under "Control Flow & Conditions": routing based on environment variable values and routing based on step output. Removed the "Complex Preconditions" example to streamline the page.

- **Agent (Tsumugi)**: AI assistant integrated into the Web UI for workflow management. Tsumugi helps create, review, debug, and manage DAG workflows through an interactive chat interface. Supports multiple LLM providers (Anthropic, OpenAI, Google, OpenRouter, local models). Features include shell command execution with approval for dangerous operations, file reading/editing, DAG schema lookup, UI navigation, and web search. See [Agent](/features/agent/) for details.

- **Trigger Type Visibility**: DAG runs now display how they were initiated (scheduler, manual, webhook, subdag, retry). The trigger type is shown in the DAG runs list and detail views with distinct icons and labels. Available via the `triggerType` field in the API response.

- **CLI History Command**: New `dagu history` command displays execution history for DAG runs with comprehensive filtering (by date, status, tags, run ID), pagination (limit support up to 1000 results), and multiple output formats (table, JSON, CSV). Essential for debugging patterns, monitoring workflows, and exporting run data. Features:
  - Date filtering: absolute (`--from`/`--to`) or relative (`--last 7d`, `24h`, `1w`)
  - Status filtering: all execution states with aliases (e.g., `success` → `succeeded`)
  - Tag filtering: comma-separated with AND logic
  - Run ID search: partial matching support
  - Default: last 30 days, 100 results, table format
  - **Run IDs never truncated** for reliable copy-paste
  - See [CLI Reference](/reference/cli#history) for full documentation.

- **LLM Model Fallback**: `model` field accepts array of model objects. First is primary, rest are fallbacks tried in order on any error. Per-model overrides for `temperature`, `maxTokens`, `topP`, `baseURL`, `apiKeyName`. See [Model Fallback](/features/chat/basics#model-fallback).

- **Container Shell Wrapper**: New `shell` field wraps step commands with a shell interpreter, enabling pipes, redirects, and command chaining without manual wrapping. Available in both image and exec modes.

  ```yaml
  container:
    image: alpine:latest
    shell: ["/bin/sh", "-c"]

  steps:
    - command: cat file.txt | grep error | wc -l
    - command: npm install && npm test
  ```

  Format: array where first element is the shell path, remaining elements are flags, and the step command is appended as the final argument. See [Container Field](/writing-workflows/container#shell-wrapper) for details.

- **Major UI Redesign**: Complete redesign of the user interface with improved dark mode support, modernized color palette, and streamlined navigation. Enhanced visual hierarchy across all pages including DAG lists, execution views, system status, and admin pages.

- **LLM Secret Masking**: Secrets defined in the `secrets` block are now automatically masked before being sent to LLM providers in chat steps. This prevents accidental exposure of sensitive values to external AI APIs while still allowing secrets to be used in message content via `${VAR}` substitution.

- **LLM Tool Calling**: Chat executor now supports function calling / tool use, enabling AI agents to execute workflows as tools during conversations. Tools are defined as DAGs with automatic parameter discovery from `defaultParams`.

  ```yaml
  # Main DAG that uses the tool
  steps:
    - type: chat
      llm:
        provider: anthropic
        model: claude-sonnet-4-20250514
        tools:
          - search_tool
        maxToolIterations: 10
      messages:
        - role: user
          content: "What's the latest news about AI?"

  ---
  # Define tool DAG
  name: search_tool
  description: "Search the web for information"
  defaultParams: "query max_results=10"

  steps:
    - command: echo "Searching for: $1"
    - command: curl "https://api.example.com/search?q=$1&limit=$2"
      output: SEARCH_RESULT
  ```

  **Key Features:**
  - **DAG-as-Tool**: Any DAG can be a tool - parameters auto-discovered from `defaultParams`
  - **Multi-turn Execution**: Automatic loop: LLM → Tool Calls → Execute DAGs → Results → LLM (up to `maxToolIterations`)
  - **Local Tool Discovery**: Tools searched in local DAGs (using `---` separator) first, then database
  - **UI Drill-down**: Tool executions tracked as sub-DAG runs with full execution details
  - **Tool Definitions Display**: UI shows available tools and their parameters
  - **Provider Support**: Anthropic, OpenAI, and Gemini with provider-specific API mappings
  - **Parameter Passing**: Tool arguments converted to DAG parameters (KEY=value format)
  - **Output Handling**: Tool results from DAG outputs passed back to LLM as tool results
  - **Error Handling**: Tool execution failures passed to LLM as error messages

  **Configuration:**
  - `llm.tools`: Array of DAG names to make available as tools
  - `llm.maxToolIterations`: Max tool calling loops (default: 10)
  - Tool DAG `name`: Used as function name for LLM
  - Tool DAG `description`: Shown to LLM in tool definition
  - Tool DAG `defaultParams`: Parsed to generate JSON Schema for parameters

  See [Chat - Tool Calling](/features/chat/tool-calling) for full documentation.

- **Tailscale Tunnel**: Built-in remote access via embedded Tailscale node. Access Dagu from anywhere without port forwarding or VPN setup.

  ```bash
  dagu server --tunnel
  ```

  **Modes:**
  - `--tunnel` - HTTP on tailnet (WireGuard encrypted, no setup)
  - `--tunnel --tunnel-https` - HTTPS on tailnet (requires HTTPS enabled in Tailscale admin)
  - `--tunnel --tunnel-funnel` - Public internet access (requires Funnel enabled in Tailscale admin)

  First run shows login URL. Subsequent runs auto-connect using saved state. See [Tunnel Configuration](/configurations/tunnel).

- **System Status Page**: New admin-only page consolidating system health monitoring in one place.

  **Features:**
  - Scheduler service status with all instances
  - Coordinator service status with all instances
  - Worker status with health, pollers, and running tasks
  - Resource usage charts (CPU, Memory, Disk, Load)

  **Dashboard Cleanup:** Removed Workers Summary and System Resources sections from the main dashboard to reduce clutter. These are now available in the dedicated System Status page.

  Access via the navigation menu under "Overview" (admin users only).

- **OIDC Integration for Builtin Auth (Recommended)**: Added OIDC/SSO login capability under builtin authentication mode. This is now the recommended way to use OIDC with Dagu, as it combines SSO convenience with full user management and RBAC.

  ```yaml
  auth:
    mode: builtin
    builtin:
      token:
        secret: your-jwt-secret
    oidc:
      enabled: true
      clientId: your-client-id
      clientSecret: your-client-secret
      clientUrl: https://dagu.example.com
      issuer: https://accounts.google.com
      autoSignup: true
      defaultRole: viewer
  ```

  Key features: auto-signup on first login, role mapping from IdP groups, email domain filtering, email whitelist, customizable login button. See [Builtin Authentication](/configurations/authentication/builtin#oidcsso-login) for details.
- **Synchronous Execution API**: New endpoint `POST /api/v1/dags/{fileName}/start-sync` that executes a DAG and waits for completion before returning. Returns full execution details including all node statuses. Useful for automation scripts, CI/CD pipelines, and any scenario where you need to wait for a DAG to finish.

  ```bash
  curl -X POST "http://localhost:8080/api/v1/dags/my-dag/start-sync" \
    -H "Content-Type: application/json" \
    -d '{"timeout": 300, "params": "{}"}'
  ```

  **Key Features:**
  - Required `timeout` parameter (1-86400 seconds) prevents indefinite waits
  - Returns full `DAGRunDetails` with all node statuses on completion
  - Returns HTTP 408 on timeout with error details
  - Returns immediately when DAG reaches "waiting" status (human approval needed)
  - Supports all existing options: `params`, `dagRunId`, `dagName`, `singleton`

  See [REST API Reference](/reference/api#start-dag-synchronous) for full documentation.

- **SFTP Executor**: New step type for transferring files between local and remote servers via SFTP. Supports upload and download of files and directories, with atomic uploads using temporary files to prevent partial transfers.

  ```yaml
  ssh:
    user: deploy
    host: server.example.com

  steps:
    - name: upload-config
      type: sftp
      config:
        direction: upload
        source: /local/config.yaml
        destination: /remote/config.yaml
  ```

  See [SFTP](/features/executors/sftp) for full documentation.

- **SSH Bastion Host Support**: SSH executor now supports connecting through a jump/bastion host for accessing servers in private networks.

  ```yaml
  ssh:
    user: deploy
    host: private-server.internal
    bastion:
      host: bastion.example.com
      user: jump-user
      key: ~/.ssh/bastion_key
  ```

  See [SSH - Bastion Host](/features/executors/ssh#bastion-host) for full documentation.

- **SSH Connection Timeout**: Added `timeout` field to SSH configuration (default: 30s) for controlling connection timeouts.

- **S3 Executor**: New step type for S3 operations with support for AWS S3 and S3-compatible services (MinIO, Google Cloud Storage, DigitalOcean Spaces, Backblaze B2).

  ```yaml
  s3:
    region: us-east-1
    accessKeyId: ${AWS_ACCESS_KEY_ID}
    secretAccessKey: ${AWS_SECRET_ACCESS_KEY}
    bucket: my-bucket

  steps:
    - name: upload-report
      type: s3
      config:
        key: reports/daily.csv
        source: /tmp/report.csv
      command: upload
  ```

  **Key Features:**
  - Operations: upload, download, list, delete
  - DAG-level connection defaults (steps inherit settings)
  - S3-compatible services via custom endpoint
  - Automatic multipart uploads for large files
  - Storage class selection
  - Object tagging and metadata
  - Streaming list output (JSONL format)

  See [S3](/features/executors/s3) for full documentation.

- **SQL Executor**: New step types for database operations with PostgreSQL and SQLite support. Execute queries, import data from CSV/TSV/JSONL, and export results in multiple formats.

  ```yaml
  steps:
    - name: query-users
      type: postgres
      config:
        dsn: "postgres://user:pass@localhost:5432/mydb"
      command: "SELECT * FROM users WHERE active = true"
      output: USERS
  ```

  **Key Features:**
  - PostgreSQL and SQLite drivers
  - Parameterized queries for SQL injection prevention
  - Transaction support with isolation levels
  - Data import from CSV, TSV, JSONL files
  - Output formats: JSONL, JSON, CSV
  - Advisory locks (PostgreSQL) and file locks (SQLite)
  - Global connection pooling for workers (prevents connection exhaustion)

  See [ETL](/features/etl/) for full documentation.

- **Redis Executor**: New step type for Redis operations with support for all major Redis commands, pipelines, transactions, Lua scripts, and distributed locking.

  ```yaml
  redis:
    host: localhost
    port: 6379
    password: ${REDIS_PASSWORD}

  steps:
    - name: cache-lookup
      type: redis
      config:
        command: GET
        key: user:${USER_ID}
      output: CACHED_USER
  ```

  **Key Features:**
  - All major Redis data types (strings, hashes, lists, sets, sorted sets, streams)
  - DAG-level connection defaults (steps inherit connection settings)
  - Pipeline and transaction support (MULTI/EXEC)
  - Lua script execution with EVALSHA optimization
  - Distributed locking for coordination
  - Connection modes: Standalone, Sentinel, Cluster
  - TLS support with certificate configuration
  - Global connection pooling for workers
  - Output formats: JSON, JSONL, raw, CSV

  See [Redis](/features/executors/redis) for full documentation.

- **PostgreSQL Connection Pool Management for Workers**: Added global PostgreSQL connection pool configuration at the worker level to prevent connection exhaustion when multiple DAGs run concurrently in shared-nothing mode.

  ```yaml
  worker:
    postgresPool:
      maxOpenConns: 25       # Total connections across ALL PostgreSQL DSNs
      maxIdleConns: 5        # Idle connections per DSN
      connMaxLifetime: 300   # Connection lifetime in seconds
      connMaxIdleTime: 60    # Idle connection timeout in seconds
  ```

  **Key Features:**
  - Automatically enabled in shared-nothing mode (when `worker.coordinators` is configured)
  - Shared across all PostgreSQL databases accessed by the worker
  - Prevents connection exhaustion with many concurrent DAGs
  - Only applies to PostgreSQL (SQLite unaffected)

  See [Shared Nothing Mode - PostgreSQL Connection Pool Management](/features/workers/shared-nothing#postgresql-connection-pool-management) for details.

- **DAG Runs Tag Filter**: Filter DAG runs by tags in the UI and API. Select multiple tags to filter runs from DAGs that have ALL specified tags (AND logic). Available via the new `tags` query parameter on `/api/v1/dag-runs` endpoint (comma-separated).

- **Key-Value Tags**: Tags now support key-value pairs in addition to simple tags. Multiple YAML formats supported:

  ```yaml
  # Map notation
  tags:
    env: prod
    team: platform

  # Array with key=value strings
  tags:
    - env=prod
    - critical

  # Space-separated string
  tags: "env=prod team=platform"
  ```

  Tag filtering supports four modes:
  - `env` - matches any tag with key `env` (regardless of value)
  - `env=prod` - matches exact key-value pair
  - `!env` - matches if key `env` does NOT exist
  - `env=prod*`, `team=*`, `te?m` - wildcard patterns (`*` any chars, `?` single char)

  Values are normalized to lowercase. See [Tags](/features/tags) for details.

- **Tag Validation**: Tags are validated at YAML load time. Keys must be 1-63 characters (alphanumeric, `-`, `_`, `.`), values 0-255 characters (alphanumeric, `-`, `_`, `.`, `/`). Invalid tags cause DAG load errors with descriptive messages.

- **Shared-Nothing Worker Architecture**: Workers can now operate without shared filesystem access. Enables deployment in Kubernetes, multi-cloud, and containerized environments where NFS/shared volumes are not available.

  **Key Features:**
  - **Static Discovery**: Configure workers with `--worker.coordinators=host:port` for direct coordinator connection
  - **Status Pushing**: Workers send execution status to coordinator via `ReportStatus` gRPC call
  - **Log Streaming**: Workers stream stdout/stderr to coordinator via `StreamLogs` gRPC call (32KB buffer, 64KB flush threshold)
  - **Zombie Detection**: Coordinator automatically marks tasks as FAILED when workers become unresponsive (30s heartbeat timeout)

  See [Workers](/features/workers/) for deployment options and configuration.

- **Web Terminal**: Added optional web-based terminal for executing shell commands directly from the Dagu UI. Disabled by default for security.

  ```yaml
  terminal:
    enabled: true   # default: false
  ```

  Or via environment variable: `DAGU_TERMINAL_ENABLED=true`

  See [Terminal Configuration](/configurations/server#terminal) for details.

- **Audit Logging Configuration**: Added configuration option to enable/disable audit logging. Enabled by default.

  ```yaml
  audit:
    enabled: true   # default: true
  ```

  Or via environment variable: `DAGU_AUDIT_ENABLED=false`

  See [Audit Logging](/configurations/server#audit-logging) for details.

- **Git Sync**: Synchronize DAG definitions with a Git repository. See [Git Sync](/features/git-sync).

### Deprecated

- **DAG-level `maxActiveRuns` field**: The `maxActiveRuns` field in DAG files is now deprecated for local (DAG-based) queues. Local queues now always use FIFO processing with concurrency of 1.

  **Migration**: For concurrency control, define global queues in `~/.config/dagu/config.yaml` and assign DAGs using the `queue` field:

  ```yaml
  # ~/.config/dagu/config.yaml
  queues:
    enabled: true
    config:
      - name: my-queue
        maxConcurrency: 3

  # In your DAG file
  name: my-dag
  queue: my-queue  # Use global queue for concurrency control
  ```

  The field is still accepted for backward compatibility but emits a build warning and is ignored for local queues.

- **`maxActiveRuns: -1` (queue bypass)**: Setting `maxActiveRuns` to `-1` to bypass queueing is deprecated. All DAGs now go through the queue system with local queues defaulting to FIFO (concurrency 1).

### Fixed

- **Sub-DAG Loading with Long Names**: Fixed a bug where sub-DAG execution failed for DAG names near the 40-character limit. Temp file naming now truncates the DAG name prefix so the generated filename (without extension) never exceeds the `DAGNameMaxLen` validation limit.

- **Sub-DAG Spec View**: Fixed "file not found" error when viewing the spec tab for sub-DAG runs in the UI. Added dedicated API endpoint `/dag-runs/{name}/{dagRunId}/sub-dag-runs/{subDAGRunId}/spec` that properly retrieves specs from the parent-child storage hierarchy.

- **Container Step Output Capture**: Fixed an issue where `container.command` was not executed when specified inside the container block without a top-level `command` field. Now `container.command` is properly used as the command to run, and output is correctly captured.

  ```yaml
  # This now works correctly
  steps:
    - name: step1
      container:
        image: alpine:3
        command:
          - echo
          - '{"name": "Alice", "age": 30}'
      output: RESULT  # Output is now captured
  ```

- **Sub-DAG Error Masking in Parallel Execution**: Fixed an issue where sub-DAG failures produced the cryptic error "no results available for node status determination" instead of the actual cause. When a child subprocess fails before writing status data, the error is now properly propagated with process exit details and captured stderr. Affected `node.go`, `dag_runner.go`, `parallel.go`, and `dag.go`.

## v1.30.0 (2026-01-04)

### Added

- **SSH Shell Configuration**: Added `shell` field to SSH executor configuration for wrapping remote commands in a shell. This enables shell features like variable expansion, pipes, and command chaining on remote servers. Supports both DAG-level and step-level configuration, with step-level `shell` field as a fallback for convenience.

  ```yaml
  ssh:
    user: deploy
    host: app.example.com
    shell: /bin/bash  # Commands wrapped as: /bin/bash -c 'command'
    # Or array syntax: shell: ["/bin/bash", "-e"]

  steps:
    - command: echo $HOME && ls -la  # Shell features now work
  ```

  See [SSH](/features/executors/ssh) for full documentation.

- **Simplified Executor Syntax**: Added `type` and `config` fields at step level as a cleaner alternative to the `executor` block. Both syntaxes are fully supported. (#1525)

  ```yaml
  # New shorthand syntax
  steps:
    - name: deploy
      type: ssh
      config:
        host: prod.example.com
        user: deploy
      command: ./deploy.sh

  # Legacy syntax (removed in v1.31.0)
  steps:
    - name: deploy
      executor:
        type: ssh
        config:
          host: prod.example.com
          user: deploy
      command: ./deploy.sh
  ```

- **Chat Step Type**: Added a new step type for integrating Large Language Models into workflows. Execute LLM requests to OpenAI, Anthropic, Google Gemini, OpenRouter, and local models (Ollama, vLLM). (#1548)

  ```yaml
  steps:
    - type: chat
      llm:
        provider: openai
        model: gpt-4o
      messages:
        - role: user
          content: "What is 2+2?"
      output: ANSWER
  ```

  **Key Features:**
  - **Multi-provider support**: OpenAI, Anthropic, Gemini, OpenRouter, and local OpenAI-compatible APIs (aliases: `ollama`, `vllm`, `llama` map to `local`)
  - **DAG-level configuration**: Define `llm:` at DAG level to share settings across multiple chat steps
  - **Multi-turn conversations**: Steps inherit conversation history from dependencies via `depends`, enabling context-aware AI workflows
  - **Extended thinking mode**: Enable deeper reasoning with `thinking.enabled` and effort levels (`low`, `medium`, `high`, `xhigh`)
  - **Streaming output**: Response tokens stream to stdout by default (disable with `stream: false`)
  - **Automatic retry**: Exponential backoff on transient errors (rate limits, server errors, timeouts)

  See [Chat](/features/chat/) for full documentation.

- **Per-DAG Prometheus Metrics**: Enhanced observability with granular per-DAG metrics and histograms. (#1411)
  - `dagu_dag_runs_currently_running_by_dag` - Running count per DAG
  - `dagu_dag_runs_queued_by_dag` - Queue depth per DAG
  - `dagu_dag_runs_total_by_dag` - Run counts by DAG and status
  - `dagu_dag_run_duration_seconds` - Duration histogram per DAG
  - `dagu_queue_wait_seconds` - Queue wait time histogram per DAG

  See [Prometheus Metrics](/features/prometheus-metrics) for full documentation.

- **Container Exec Mode**: Execute commands in already-running containers instead of creating new ones. This enables running workflows in containers started by Docker Compose or other orchestration tools. (#1515)

  **String form** - exec with container's default settings:
  ```yaml
  container: my-running-container

  steps:
    - command: php artisan migrate
    - command: php artisan cache:clear
  ```

  **Object form** - with user, workingDir, and env overrides:
  ```yaml
  container:
    exec: my-running-container
    user: root
    workingDir: /var/www
    env:
      - APP_DEBUG=true

  steps:
    - command: composer install
  ```

  Exec mode works at both DAG-level and step-level. The container must be running; Dagu waits up to 120 seconds for the container to be in running state.

  See [Container Field](/writing-workflows/container#exec-mode-use-existing-container) for full documentation.

- **Worker ID Tracking**: Added worker ID tracking to DAG runs for distributed setups. Users can now see which worker executed their jobs in both the DAG runs list and detail views. (#1500)
  - Local execution displays `local` as the worker ID
  - Distributed execution displays the worker ID (format: `{hostname}@{pid}`)
  - Worker ID is shown in the DAG runs table and run details panel

- **Configurable Cache Limits**: Added `cache` configuration option with presets to control memory usage for in-memory caches. (#1411)

  ```yaml
  cache: normal   # options: low, normal, high (default: normal)
  ```

  Or via environment variable: `DAGU_CACHE=low`

  | Preset | DAG | DAGRun | APIKey | Webhook |
  |--------|-----|--------|--------|---------|
  | `low`  | 500 | 5,000  | 100    | 100     |
  | `normal` | 1,000 | 10,000 | 500 | 500   |
  | `high` | 5,000 | 50,000 | 1,000 | 1,000 |

  See [Server Configuration](/configurations/server#cache-configuration) for details.

- **`DAGU_PARAMS_JSON` availability**: Every step now receives the merged parameter payload as JSON via the `DAGU_PARAMS_JSON` environment variable, even when parameters are supplied through legacy CLI strings. If a run starts with raw JSON parameters, the original payload is preserved verbatim. This makes it easier for scripts to consume structured parameter data without re-parsing shell strings. (#1550)
- **DAG Spec Tab in Status View**: Added a new "Spec" tab to the DAG status page and DAG run details modal/panel. This tab displays the DAG YAML specification in readonly mode with the Schema Documentation sidebar available for reference. The spec shown is the exact spec that was used at execution time, not the current spec. (#XXXX)
- **Wait Status Email Notifications**: Added `mailOn.wait` and `waitMail` configuration for sending email notifications when a DAG enters wait status (Human In The Loop). This enables teams to be notified when workflows require human approval.

  ```yaml
  mailOn:
    wait: true

  waitMail:
    from: dagu@example.com
    to: approvers@example.com
    prefix: "[WAITING]"
    attachLogs: false
  ```

  See [Email Notifications](/features/email-notifications#wait-status-notifications) for details.

- **HITL (Human-in-the-Loop)**: Added `hitl` executor for pausing workflows until human approval. Enables approval gates where manual review is required before proceeding.

  ```yaml
  steps:
    - command: ./deploy.sh staging
    - type: hitl
      config:
        prompt: "Approve production?"
        input: [APPROVED_BY]
        required: [APPROVED_BY]
    - command: ./deploy.sh production
  ```

  Key features:
  - Pause workflow execution for human review
  - Collect parameters from approvers as environment variables
  - Approve or reject via web UI or REST API
  - New statuses: `waiting` (paused for approval) and `rejected` (approval denied)

  See [HITL](/features/executors/hitl) for full documentation.

- **Wait Handler**: Added `handlerOn.wait` lifecycle handler that executes when a workflow enters wait status.

  ```yaml
  handlerOn:
    wait:
      command: notify-slack.sh "${DAG_WAITING_STEPS}"

  steps:
    - type: hitl
  ```

  See [Lifecycle Handlers](/writing-workflows/lifecycle-handlers) for full documentation.

- **Chat Executor**: Added a new executor for integrating Large Language Models into workflows. Supports OpenAI, Anthropic, Google Gemini, OpenRouter, and local models (Ollama, vLLM).

  ```yaml
  steps:
    - type: chat
      llm:
        provider: openai
        model: gpt-4o
      messages:
        - role: user
          content: "What is 2+2?"
      output: ANSWER
  ```

  Key features:
  - **Multi-turn conversations**: Steps inherit conversation history from dependencies
  - **Variable substitution**: Message content supports `${VAR}` syntax
  - **Streaming**: Response tokens are streamed to stdout by default
  - **Multiple providers**: `openai`, `anthropic`, `gemini`, `openrouter`, `local`
  - **Automatic retry**: Retries on rate limits and transient errors with exponential backoff

  See [Chat Executor](/features/chat/) for full documentation.

### Changed

- **Metrics Endpoint Access Control**: The `/api/v1/metrics` endpoint now requires authentication by default for improved security. Configure `metrics: "public"` or set `DAGU_SERVER_METRICS=public` to restore the previous public access behavior. When private, use API tokens or basic auth for Prometheus scraping. (#1411)

  ```yaml
  # Require authentication (new default)
  metrics: "private"

  # Allow public access (previous behavior)
  metrics: "public"
  ```

  See [Prometheus Metrics](/features/prometheus-metrics) for configuration examples.

### Fixed

- **Config Path Resolution**: All configuration paths (DAGsDir, LogDir, DataDir, etc.) are now resolved to absolute paths at load time with proper error handling. Previously, path resolution failures were silently logged and the original unresolved path was used, which could cause mysterious runtime failures. Now, if any config path cannot be resolved to an absolute path, configuration loading fails with a clear error message.

- **Multiple dotenv files**: Fixed loading of multiple `.env` files. Previously, only the first file was processed. Now all files are loaded sequentially, with later files overriding values from earlier ones. Duplicate file paths are automatically deduplicated. Note: `.env` is always prepended to the list unless `dotenv: []` is specified. (#1519)

  ```yaml
  # All files are now loaded, with later files overriding earlier ones
  dotenv:
    - .env.defaults    # .env loaded first (auto-prepended), then this
    - .env.local       # Overrides earlier files
    - .env.production  # Overrides all earlier files
  ```

- **Cache item counting**: Fixed cache `Store` method incorrectly incrementing item counter when updating existing keys, and `Invalidate` method decrementing counter for non-existent keys. (#1411)

## v1.29.0 (2025-12-28)

### Added
- Spec: Added `logOutput` field at DAG and step levels to control stdout/stderr logging behavior - `separate` (default) writes to separate `.out`/`.err` files, `merged` writes both to a single `.log` file with interleaved output (#1505)
- **DAG Run Outputs Collection**: Collect step outputs into a structured `outputs.json` file per DAG run. View collected outputs in the Web UI via the new Outputs tab. (#1466)
  - Outputs are automatically collected from steps with `output` field
  - Secret values are automatically masked in outputs
  - Enhanced `output` field syntax supports object form with `name`, `key`, and `omit` options:

```yaml
steps:
  # Simple string form (existing behavior)
  - name: get-count
    command: echo "42"
    output: COUNT

  # Object form with custom key
  - name: get-version
    command: cat VERSION
    output:
      name: VERSION
      key: appVersion  # Custom key in outputs.json (default: camelCase of name)

  # Object form with omit
  - name: internal-step
    command: echo "processing"
    output:
      name: TEMP
      omit: true  # Exclude from outputs.json but still usable in DAG
```

  - API endpoint: `GET /api/v1/dag-runs/{name}/{dagRunId}/outputs`
  - See [DAG Run Outputs](/features/outputs) for full documentation
- UI: Added wrap/unwrap toggle button in log viewer for better readability of long lines
- **API Key Management**: Added comprehensive API key management for programmatic access with role-based permissions. API keys provide a secure alternative to static tokens with fine-grained access control.
  - Create, list, update, and delete API keys via Web UI or REST API
  - Role-based permissions (admin, manager, operator, viewer) per key
  - Usage tracking with `lastUsedAt` timestamp
  - Secure key generation with bcrypt hashing
  - Keys use `dagu_` prefix for easy identification
  - Web UI management at Settings > API Keys (admin only)
  - Full REST API at `/api/v1/api-keys` endpoints

```bash
# Create an API key
curl -X POST http://localhost:8080/api/v1/api-keys \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "ci-pipeline", "role": "operator"}'

# Use the API key
curl -H "Authorization: Bearer dagu_your-key-here" \
  http://localhost:8080/api/v1/dags
```

Requires builtin authentication mode (`auth.mode: builtin`). See [API Keys documentation](/configurations/authentication/api-keys) for details.

- **Webhook Management**: Added DAG-specific webhooks for triggering workflow executions from external systems like CI/CD pipelines, GitHub, and Slack.
  - Create, regenerate, enable/disable, and delete webhooks via Web UI or REST API
  - DAG-specific tokens (one webhook per DAG) with `dagu_wh_` prefix
  - Payload passthrough via `WEBHOOK_PAYLOAD` environment variable
  - Idempotent execution support with custom `dagRunId`
  - Usage tracking with `lastUsedAt` timestamp
  - Secure token storage with bcrypt hashing
  - Full REST API at `/api/v1/webhooks` and `/api/v1/dags/{fileName}/webhook` endpoints

```bash
# Create a webhook for a DAG
curl -X POST http://localhost:8080/api/v1/dags/my-dag/webhook \
  -H "Authorization: Bearer $JWT_TOKEN"

# Trigger DAG via webhook with payload
curl -X POST http://localhost:8080/api/v1/webhooks/my-dag \
  -H "Authorization: Bearer dagu_wh_your-webhook-token" \
  -H "Content-Type: application/json" \
  -d '{"payload": {"branch": "main", "commit": "abc123"}}'
```

Requires builtin authentication mode (`auth.mode: builtin`). See [Webhooks documentation](/configurations/authentication/webhooks) for details.

- **Multiple Commands per Step**: Steps can now execute multiple commands sequentially using an array syntax. This allows sharing step configuration (`env`, `workingDir`, `retryPolicy`, `preconditions`, `container`, etc.) across multiple commands instead of duplicating it across separate steps.

```yaml
steps:
  - name: build-and-test
    command:
      - npm install
      - npm run build
      - npm test
    env:
      - NODE_ENV: production
    workingDir: /app
```

Commands run in order and stop on first failure. Retries restart from the first command (no checkpoint/resume from middle).

Supported executors: shell, command, docker, container, ssh. Executors that do not support multiple commands (jq, http, archive, mail, github_action, dag) will reject the configuration at parse time.

### Fixed
- Config: Fixed `errorMail` and `infoMail` partial field overrides not working when only specifying `prefix` or `attachLogs` without `from`/`to` fields. Previously, single-field overrides were silently ignored. (#1512)
- Config: Fixed `smtp` partial field overrides not working when only specifying `username` or `password` without `host`/`port` fields.


## v1.28.0 (2025-12-24)

### Added
- **Step-Level Container Field**: Added `container` field for individual steps, providing the same configuration options as DAG-level container but for per-step container execution. This is the recommended way to run steps in containers, replacing the verbose `executor: docker` syntax.

```yaml
steps:
  - name: build
    container:
      image: node:24
      volumes:
        - ./src:/app
      workingDir: /app
    command: npm run build

  - name: test
    container:
      image: python:3.11
      env:
        - PYTHONPATH=/app
    command: pytest
```

### Changed
- **Documentation**: Updated all documentation to use the new step-level `container` syntax instead of `executor: docker`
- **JSON Schema**: Updated DAG schema to include step-level `container` field with proper validation
- **Spec Refactor (internal)**: Restructured spec types and build logic for improved maintainability (#1499)
- **UI**: Removed link to Discord and Github from the frontend

### Validation
- Added validation to prevent using `container` field together with `executor` field (conflicting execution methods)
- Added validation to prevent using `container` field together with `script` field (scripts not supported in containers)


## v1.27.0 (2025-12-21)

### Added
- CLI: Added `cleanup` command for removing old DAG-run data for specified DAG-name

### Fixed
- Runtime, API: Fix issues that a DAG run often fails due to max active run check

### Changed
- UI: Updated frontend design color schema and removed dark mode UI

## v1.26.7 (2025-12-20)

### Added
- Runtime: Add support for multi-level nested DAG execution
- Spec: Add `containerName` field to DAG-level `container` field

## v1.26.4 (2025-12-14)

### Added
- API: Added optional `singleton` flag to `POST /dags/{fileName}/enqueue` endpoint to prevent duplicate runs when a DAG is already executing or queued; returns HTTP 409 Conflict when enabled and active/queued runs exist (#1483, #1460)

### Changed
- Deps: Upgraded gopsutil from v3 to v4 (#1470)
  - Note: On Linux, `UsedPercent` for memory now derives from `MemAvailable` rather than the previous method, which may alter reported values by 6-10%
- Release: Removed NetBSD from release targets

### Fixed
- Scheduler: Queue processor now respects `maxConcurrency` configuration in global config for DAG-based queues (#1482)
- Runtime: Fixed dequeue command missing queue name parameter, causing API-based dequeue operations to fail (#1481)
- Auth: API token authentication now works alongside builtin authentication mode; unified middleware supports JWT Bearer tokens, API tokens, Basic auth, and OIDC simultaneously (#1480, #1478, #1475)
- UI: User Management menu now only displays for admin users when authentication mode is "builtin"; reset password functionality restricted to admin users (#1484)
- Runtime: Special environment variables (`DAG_RUN_ID`, `DAG_NAME`, etc.) now work correctly in `handlerOn.exit` and other handler contexts (#1474)
- Security: Escaped config path strings injected into HTML templates to prevent potential JavaScript injection vulnerabilities on Windows (#1472)

### Contributors

Thanks to our contributors for this release:

| Contribution | Contributor |
| --- | --- |
| Dequeue command queue name fix (#1481) | [@kriyanshii](https://github.com/kriyanshii) |
| Singleton flag feature request (#1460) | [@kriyanshii](https://github.com/kriyanshii) |
| User creation error with builtin auth bug report (#1478) | [@Kaiden0001](https://github.com/Kaiden0001) |
| DAG_RUN_ID in handlers bug report (#1474) | [@Kaiden0001](https://github.com/Kaiden0001) |
| Remote node selection with builtin auth bug report (#1475) | [@jeremydelattre59](https://github.com/jeremydelattre59) |
| Singleton enqueue feedback | [@ghansham](https://github.com/ghansham) |

**Full Changelog**: [v1.26.2...v1.26.3](https://github.com/dagu-org/dagu/compare/v1.26.2...v1.26.3)

## v1.26.2 (2025-12-10)

### Added
- Spec: Added optional `negate` flag for preconditions at both DAG and step levels to invert condition evaluation (#1451)
- Spec: Added `init` handler field that executes after preconditions but before workflow steps - if it fails, subsequent steps are prevented from executing (#1455)
- Spec: Added `abort` handler as canonical replacement for the deprecated `cancel` handler (#1455)
- Spec: Added `skipBaseHandlers` option to prevent sub-DAGs from inheriting parent handler configurations (#1455)
- Spec: Added `continueOn` shorthand syntax - users can now specify `continueOn: "skipped"` or `continueOn: "failed"` instead of verbose object definitions (#1454)
- CLI: Added `--default-working-dir` flag to `start` and `enqueue` commands to specify a fallback working directory for DAG executions; automatically propagates to sub-DAGs (#1459)
- Feature: Added comprehensive resource monitoring for CPU, memory, disk, and system load with in-memory retention store and API endpoint (`GET /services/resources/history`) (#1461)
- UI: Added resource usage visualization charts on System Status page (#1461)
- Feature: Implemented built-in JWT-based authentication system with role-based access control (RBAC) (#1463)
  - Four-tier role hierarchy: admin, manager, operator, viewer
  - Complete user management APIs (create, list, view, update, delete)
  - File-backed user store with atomic writes and thread-safety
  - Login flow, protected routes, user management UI
- Config: Added `AUTH_MODE` environment variable supporting `none`, `builtin`, and `oidc` modes (#1463)

### Changed
- Config: Refactored configuration loader to use service-scoped loading that only loads necessary settings for each command context, improving startup performance (#1467)
- Config: Replaced public `Global` config field with `Core` across the codebase (#1467)
- Config: Standardized key=value parsing using `strings.Cut` instead of `strings.SplitN` (#1467)
- API: v1 API routes are now disabled when authentication is enabled (#1463)

### Fixed
- Runtime: Log tails and recent stderr now decode multiple encodings (Shift_JIS, EUC-JP, ISO-8859-1, Windows-1252, GBK, Big5, EUC-KR, UTF-8) properly based on system locale (#1449)
- Runtime: Special environment variables (`DAG_NAME`, `DAG_RUN_ID`, `DAG_RUN_LOG_FILE`) are now properly accessible in failure handlers and executor config evaluation (#1448)
- Queue: Fixed queued DAG jobs failing to process with "name or path is required" error - queue items now use lazy, file-backed loading with proper error handling (#1457, #1437)
- UI: Disabled step retry buttons while a DAG is actively running to prevent unintended behavior (#1447)
- Validation: Added maximum DAG name length validation (40 characters) with pre-validation on rename operations (#1469)
- Config: Made auth mode nullable in configuration, establishing "none" as the default with runtime validation (#1469)
- UI: Enhanced dark-mode text selection styling for input fields (#1469)

### Contributors

Thanks to our contributors for this release:

| Contribution | Contributor |
| --- | --- |
| Stop step retry while DAG is running UI fix (#1447) | [@kriyanshii](https://github.com/kriyanshii) |
| Queued DAGs not starting bug report (#1437) | [@kriyanshii](https://github.com/kriyanshii) |
| Init handler field feedback | [@ghansham](https://github.com/ghansham) |

**Full Changelog**: [v1.25.1...v1.26.0](https://github.com/dagu-org/dagu/compare/v1.25.1...v1.26.0)

## v1.25.1 (2025-12-05)

### Fixed
- Mail: Added STARTTLS and LOGIN auth support for SMTP servers (#1446)
- Windows: Fixed bug in command construction with PowerShell/cmd.exe (#1445)

## v1.25.0 (2025-12-04)

### Added
- UI: Display script detail dialog on steps list (#1435)
- UI: Added Paths display panel in System Status page, showing system filesystem locations (DAGs, logs, config files, etc.)
- Config: Resolve path environment variables to absolute paths and sync for subprocesses (#1430)

### Changed
- Config: Log encoding now auto-detected from system locale (Unix) or Windows code page instead of defaulting to UTF-8 (#1439)
- API: DAG rename no longer renames run history to prevent data loss

### Fixed
- Core: Resolve working directory relative paths correctly - DAG-level `workingDir` resolves against DAG file location, step-level `dir` resolves against DAG's `workingDir` (#1436)
- Windows: Improved PowerShell and cmd.exe shell handling (#1439)
  - Scripts in working directory now execute correctly (auto-prefixes `.\` when needed)
  - PowerShell scripts now fail properly on non-zero exit codes from external commands
  - Environment variable matching is now case-insensitive
  - Added platform-specific base environment variables
- UI: Fixed graph visualization crash when step names contain parentheses (#1440, #1434)

### Contributors

Thanks to our contributors for this release:

| Contribution | Contributor |
| --- | --- |
| Graph crash with parentheses in step names fix (#1440) | [@Tagnard](https://github.com/Tagnard) |
| Graph crash bug report (#1434) | [@DarkWiiPlayer](https://github.com/DarkWiiPlayer) |
| Windows version testing and bug report | O.Yena on Discord |

## v1.24.9 (2025-11-30)

### Added
- DAG: Set a default shell once per workflow via a new root-level `shell` field; both DAG and step `shell` values accept strings or arrays so you can pass shell flags without quoting hassles (#1426)
- UI: Running and failed step names displayed on the DAG runs page for quick status overview without navigating to details (#1420, #1401)
- Installer: Windows support with PowerShell and cmd.exe installation options (#1428)

### Changed
- CLI: `dequeue` now accepts a queue name positional argument and will pop the oldest item when `--dag-run` is omitted; provide `--dag-run` to target a specific run (#1421)
- Core: Refactored logging code to use typed attributes for better observability (#1422)

### Fixed
- Scheduler: Fixed DAG entry reader not starting on startup, causing scheduled runs not to execute (#1427, #1423)
- Executor: Handle Windows script extensions for proper command execution (#1425)
- Config: Use correct config file path on Windows (#1424)

### Contributors

Thanks to our contributors for this release:

| Contribution | Contributor |
| --- | --- |
| Running/failed steps list on DAG runs page (#1420) | [@kriyanshii](https://github.com/kriyanshii) |
| Running/failed steps feature request (#1401) | [@ghansham](https://github.com/ghansham) |
| Scheduled runs not executing bug report (#1423) | [@gyger](https://github.com/gyger) |
| Scheduled runs issue confirmation (#1423) | [@SGRelic](https://github.com/SGRelic) [@jeremydelattre59](https://github.com/jeremydelattre59) |
| Windows issues report (#1424, #1425) | O.Yena on Discord |

## v1.24.8 (2025-11-23)

### Fixed
  - Core: ensure DAG working directory exists
  - Core: fix bug in DAG-run data retrieval
  - API: fix bug in the queue items API endpoint
  - Core: fix bug in queue item processing

### Added
 - Spec/API/UI: Added `timeoutSec` step-level field to cap individual step execution time; when set it overrides any DAG-level timeout for that step (#1412)

### Contributors

Thanks to our contributors for this release:

| Contribution | Contributor |
| --- | --- |
| Step-level `timeoutSec` field (#1412) | [@kriyanshii](https://github.com/kriyanshii) |
| Queue issue report (#1417) | [@ghansham](https://github.com/ghansham) |

## v1.24.7

### Fixed
- Auth/API: Exempt `/api/v1/metrics` from authentication so Prometheus scrapes succeed out of the box (#1409)

### Contributors

Thanks to our contributors for this release:

| Contribution | Contributor |
| --- | --- |
| OIDC issue report | [@alangrafu](https://github.com/alangrafu) [@Netmisa](https://github.com/Netmisa) |


## v1.24.6

### Fixed
- Auth/API: Exempt `/api/v1/metrics` from authentication so Prometheus scrapes succeed out of the box (#1409)

### Contributors

Thanks to our contributors for this release:

| Contribution | Contributor |
| --- | --- |
| Metrics auth bypass report (#1409) | [@jeremydelattre59](https://github.com/jeremydelattre59) |

## v1.24.5

### Changed
- Status: Renamed the `canceled` lifecycle label to `aborted` across the CLI, runtime, APIs, schemas, and UI so status analytics and automations reference a single canonical value.

### Fixed
- Docker executor: Preserve step-level container entrypoints so step commands can rely on the image's default binary (#1403)
- Auth/API: Add configurable public paths so `/api/v*/health` bypasses authentication for uptime probes by default (#1404)
- Auth/OIDC: Guard verifier initialization so unreachable issuers fail gracefully instead of crashing the server (#1407)
- Auth/API: Exempt `/api/v1/metrics` from authentication so Prometheus scrapes succeed out of the box (#1409)

### Contributors

Thanks to our contributors for this release:

| Contribution | Contributor |
| --- | --- |
| Step-level Docker executor entrypoint fix (#1403) | [@vnghia](https://github.com/vnghia) |
| Status label rename to `aborted` | [@ghansham](https://github.com/ghansham) |
| Health endpoint access report (#1404) | [@jeremydelattre59](https://github.com/jeremydelattre59) |
| OIDC init panic report (#1407) | [@alangrafu](https://github.com/alangrafu) |
| Metrics auth bypass report (#1409) | [@jeremydelattre59](https://github.com/jeremydelattre59) |

## v1.24.2

### Added
- Executors: Added a `raw` output option to the JQ executor for emitting unquoted strings and primitives (#1392)
- Installer: Added a `--working-dir` flag to place temporary files outside `/tmp`, useful on constrained systems (#1388)
- Spec: Resolve parameter schema references relative to the process cwd, declared `workingDir`, or the DAG file location so JSON Schema files can be co-located with DAGs (#1371)

### Fixed
- UI: Ensure repeat-policy sub DAG run lists refresh their timestamps and counts without needing a window refocus by polling `/sub-dag-runs` while expanded (#1389)
- Spec/UI: Stabilize default parameter ordering so Start DAG modal fields stay in place while editing (#1395)
- OIDC: Automatically clear expired dashboard cookies and restart the auth flow so stale tokens no longer block the UI after restarts (#1394)

### Contributors

Thanks to our contributors for this release:

| Contribution                           | Contributor                              |
| -------------------------------------- | ---------------------------------------- |
| JQ executor raw output option (#1392) | [@kriyanshii](https://github.com/kriyanshii) |
| Repeat execution timestamp refresh report (#1389) | [@jeremydelattre59](https://github.com/jeremydelattre59) |
| Parameter field reorder report (#1395) | [@mitchplze](https://github.com/mitchplze) |
| OIDC dashboard lock-out report (#1394) | [@mitchplze](https://github.com/mitchplze) |
| Param schema resolution & skip validation option (#1371) | [@thefishhat](https://github.com/thefishhat) |
| Installer working directory flag request (#1388) | [@jeremydelattre59](https://github.com/jeremydelattre59) |

## v1.24.0 (2025-11-03)

### Added
- API: Added optional `dagName` field to `/dags/{fileName}/start` and `/dags/{fileName}/enqueue` for overriding the DAG name used at runtime (#1365)
- API: Added `GET /api/v1/dag-runs/{name}/{dagRunId}/sub-dag-runs` endpoint to retrieve timing and status information for all sub DAG runs, useful for tracking repeated executions of sub DAG steps (#1041)
- UI: Enhanced sub DAG run display with execution timeline showing datetime, status indicators, and lazy loading of execution details (#1041)
- API: Added `POST /api/v1/dag-runs/{name}/{dagRunId}/reschedule` endpoint for replaying runs while enforcing singleton mode to block reschedules when the DAG already has active or queued runs (#1347)
- API: Added `POST /api/v1/dag-runs/enqueue` to enqueue DAG-runs directly from inline YAML specs without creating DAG files, including optional queue overrides (#1375)
- CLI: Added `--from-run-id` flag to `dagu start` for cloning historic runs with their saved parameters (#1378)
- CLI: Added `dagu exec` command to run shell commands without writing YAML files, with full logging, history, environment control, and queue support (#1348)
- UI: Added grouped view with preset and specific date range selectors on the DAG-runs page for faster historical exploration (#1377)
- Executors: Added an archive executor (`type: archive`) with extract, create, and list operations

### Improved
- UI: Persisted DAG/queue/search filters across navigation using a remote-aware search state provider so bookmarked URLs and session filters stay aligned (#1379)

### Fixed
- Windows: Restored queued DAG execution by exporting the necessary environment variables when spawning processes from the queue runner (#1373)
- UI: Fixed DAG rendering while zooming out (#1380)
- Server/API: Run command/env substitution for base paths and auth credentials when wiring routes, keeping originals only if evaluation fails and logging a warning

### Contributors

Thanks to our contributors for this release:

| Contribution                           | Contributor                              |
| -------------------------------------- | ---------------------------------------- |
| `--name` flag feature clarification and feedback (#1349) | [@ghansham](https://github.com/ghansham) |
| Repeat execution timeline enhancements feature request (#1041) | [@jeremydelattre59](https://github.com/jeremydelattre59) |
| Serial number ordering feedback and suggestion (#1041) | [@ghansham](https://github.com/ghansham) |
| Singleton reschedule guard feedback (#1347) | [@hamadayouta](https://github.com/hamadayouta) |
| Windows queue execution failure report and verification (#1372) | [@lvoeg](https://github.com/lvoeg) |
| `--from-run-id` flag co-author (#1378) | [@kriyanshii](https://github.com/kriyanshii) |
| Inline spec enqueue implementation (#1375) | [@kriyanshii](https://github.com/kriyanshii) |
| DAG zoom out rendering fix (#1380) | [@kriyanshii](https://github.com/kriyanshii) |

## v1.23.3 (2025-10-26)

### Added
- CLI: Added `--name` flag to `start`, `retry`, and `enqueue` commands to override the DAG name specified in the YAML file (#1363)
- DAG: Support shell-like parameter expansion for `env` and `parameters` fields, including `${VAR:offset:length}` slices and shell-style defaults (`${VAR:-fallback}`) (#1354)
- Distributed: Added comprehensive Kubernetes deployment manifests with ConfigMaps, PVCs, and separate server/worker deployments (#1360)
- Distributed: Added automatic cleanup of stale coordinator service registrations (#1360)
- Distributed: Added retry mechanism with exponential backoff for coordinator client connections (#1360)

### Improved
- Distributed: Enhanced distributed execution with better worker coordination and status propagation (#1360)
- Distributed: Improved child DAG status propagation in distributed mode to correctly report final status to parent workflows (#1358)
- OIDC: Improved OIDC configuration validation with better error messages and logging (#1361)
- OIDC: Enhanced OIDC authentication flow with proper state management and error handling (#1361)
- API: Better error handling in API endpoints with more descriptive error messages (#1361)

### Fixed
- Distributed: Fixed child DAG status not being properly propagated to parent in distributed execution (#1358)
- Distributed: Fixed parallel execution status tracking for sub-DAGs (#1358)
- Distributed: Fixed service registry cleanup and stale entry detection (#1360)

### Contributors

Thanks to our contributors for this release:

| Contribution                           | Contributor                              |
| -------------------------------------- | ---------------------------------------- |
| OIDC authentication broken interface issue report (#1359) | [@mitchplze](https://github.com/mitchplze) |
| Distributed execution lock issue on Kubernetes (#1353) | [@yangkghjh](https://github.com/yangkghjh) |
| Shell-like parameter expansion feature request (#1352) | [@ghansham](https://github.com/ghansham) |

**Full Changelog**: [v1.23.2...v1.23.3](https://github.com/dagu-org/dagu/compare/v1.23.2...v1.23.3)

## v1.23.2 (2025-10-22)

### Fixed
- Server: Fixed subprocess environment variable propagation - server now correctly passes environment variables to subprocesses (#1351)

### Contributors

Thanks to our contributors for this release:

| Contribution                           | Contributor                              |
| -------------------------------------- | ---------------------------------------- |
| DAG manual launch bug report and detailed reproduction (#1345) | [@jeremydelattre59](https://github.com/jeremydelattre59) |
| WebUI blank page MIME type error report (#1350) | [@overflowy](https://github.com/overflowy) |

**Full Changelog**: [v1.23.1...v1.23.2](https://github.com/dagu-org/dagu/compare/v1.23.1...v1.23.2)

## v1.23.1 (2025-10-21)

### Documentation
- Updated GitHub Actions executor documentation

### Contributors

No external contributors for this release - documentation update only.

**Full Changelog**: [v1.23.0...v1.23.1](https://github.com/dagu-org/dagu/compare/v1.23.0...v1.23.1)

## v1.23.0 (2025-10-21)

### Changed
- Status: Adopted canonical lowercase tokens for DAG and node lifecycle states (`not_started`, `queued`, `running`, `succeeded`, `partially_succeeded`, `failed`, `canceled`), and updated API examples, docs, and telemetry labels to match.
- Security: Implemented security filtering for system environment variables passed to step processes and sub DAGs. System variables remain available for expansion (`${VAR}`) during DAG configuration parsing, but only whitelisted variables (`PATH`, `HOME`, `LANG`, `TZ`, `SHELL`) and variables with allowed prefixes (`DAGU_*`, `LC_*`, `DAG_*`) are passed to the step execution environment. This prevents accidental exposure of sensitive credentials to subprocess environments. Other variables must be explicitly defined in the workflow's `env` section to be available in step processes.
- Scheduler: Queue handler now processes items asynchronously, acknowledging work before heartbeat checks so long-running startups no longer starve the queue.
- Runtime: Subcommand execution inherits the filtered base environment and uses the caller's working directory.

### Added
- CLI: Added `--dagu-home` global flag to override the application home directory on a per-command basis. Useful for testing, running multiple instances with isolated data, and CI/CD scenarios.
- CLI: Added `dagu validate` command to validate DAG specifications without executing them. Prints human‑readable errors and exits with code 1 on failure.
- API: Added `POST /api/v1/dags/validate` to validate DAG YAML. Returns `{ valid: boolean, errors: string[], dag?: DAGDetails }`.
- API: `POST /api/v1/dags` now accepts optional `spec` to initialize a DAG. The spec is validated before creation and returns 400 on invalid input.
- API: Added `POST /api/v1/dag-runs` to create and start a DAG-run directly from an inline YAML `spec` without persisting a DAG file. Supports optional `name`, `params`, `dagRunId`, and `singleton`.
- API: Added `nextRun` sort option to `GET /api/v1/dags` to sort DAGs by their next scheduled run time. DAGs with earlier next runs appear first in ascending order, and DAGs without schedules appear last.
- Steps: Add support for shebang detection in `script`.
- Steps: Multi-line `command` strings now execute as inline scripts, including support for shebang.
- DAG: Introduced a `secrets` block that references external providers (built-in `env` and `file`) and resolves values at runtime with automatic log/output masking.
- Parameters: Added JSON Schema validation mode with `schema`.
- Runtime: Injects `DAG_RUN_STATUS` into handler environments so exit/success/failure/cancel scripts can branch on the final canonical status.
- Executors: Added an experimental GitHub Actions executor (`type: gha`) powered by nektos/act; action inputs come from the new step-level `params` map.
- UI: Added accordion-style expandable node rows to display step logs inline, similar to GitHub Actions, reducing the need to open popup windows (#1313).

### Fixed
- DAG name validation is centralized and enforced consistently: names must be `<= 40` chars and match `[A-Za-z0-9_.-]+`. Endpoints that accept `name` now return `400 bad_request` for invalid names.
- Docker: Fixed container initialization bug with `registryAuths` field (#1330)
- Windows: Fixed process cancellation not terminating subprocesses by recursively killing all child processes (#1342)
- UI: Fixed duration display update bug in DAG run details
- Other small issues and improvements

### Contributors

Thanks to our contributors for this release:

| Contribution                           | Contributor                              |
| -------------------------------------- | ---------------------------------------- |
| Docker-in-Docker container execution issues (#1228, #1231, #1235) and registryAuths bug report (#1327) | [@bellackn](https://github.com/bellackn) |
| Container name support (#1237), bash requirement (#1239), command field (#1261), log buttons (#1301), and scroll issues (#1324) | [@Pangolin2097](https://github.com/Pangolin2097) |
| Accordion-style log expansion feature request (#1313) | [@borestad](https://github.com/borestad) |
| SSH environment variables feature request (#1238) | [@n3storm](https://github.com/n3storm) |
| SSH config override issue report (#1249) | [@TrezOne](https://github.com/TrezOne) |
| DAG dependency resolution error report (#1262) | [@JuchangGit](https://github.com/JuchangGit) |
| Quickstart guide issue report (#1263) | [@Vad1mo](https://github.com/Vad1mo) |
| Parallel JSON execution issues (#1274) | [@tetedange13](https://github.com/tetedange13) |
| Grouped DAGs mobile UI bug report (#1294) | [@jarnik](https://github.com/jarnik) |
| Cleanup and status propagation feature request (#1305) | [@vnghia](https://github.com/vnghia) |
| Environment variables behavior bug report (#1320) | [@thibmart1](https://github.com/thibmart1) |
| System status UI issue report (#1224) | [@jeremydelattre59](https://github.com/jeremydelattre59) |
| Script execution error (#1203) and stop-all API feature request (#1211) | [@Kaiden0001](https://github.com/Kaiden0001) |
| Dotenv loading bug report (#1210) | [@don-philipe](https://github.com/don-philipe) |
| Script field issue report (#1334) | [@xinxinxinye](https://github.com/xinxinxinye) |
| Queue override implementation (#1240) and clear queue feature (#1298, #1299) | [@kriyanshii](https://github.com/kriyanshii) |
| JSON Schema validation for params implementation (#1273) | [@thefishhat](https://github.com/thefishhat) |
| SSH script validation implementation (#1308) | [@AdityaTel89](https://github.com/AdityaTel89) |
| README updates (#1326), unit tests (#1329), and legacy directory warning (#858, #1336) | [@arky](https://github.com/arky) |
| Windows process cancellation fix with recursive subprocess termination (#1207, #1342) | [@lvoeg](https://github.com/lvoeg) |
| Extensive troubleshooting and community support: container name (#1237), SSH environment variables (#1238), DAG dependency resolution (#1262), cleanup and status propagation (#1305), environment variables behavior (#1320), clear queue feature (#1298), Docker-in-Docker (#1235), and CLI/masking discussions (#1314, #1317, #1273) | [@ghansham](https://github.com/ghansham) |

## v1.22.0 (2025-08-24)

### New Features
- **Shorthand Step Syntax**: Added simplified step definition without requiring explicit name and command fields (#1206)
  ```yaml
  steps:
    - echo "hello"
  ```
  Equivalent to:
  ```yaml
  steps:
    - name: step 1
      command: echo "hello"
  ```
- **Working Directory Support**: Added DAG-level and step-level working directory configuration with inheritance for better file path management
- **Load Environment Support**: Enhanced environment variable loading capabilities with improved dotenv support
- **Queue Dashboard UI**: Complete queue management interface with visual feedback and improved user experience (#1217)
- **DAG Name Input Modal**: Improved UI for DAG name input and management with better validation (#1218)
- **Max Active Runs Enforcement**: DAG-level `maxActiveRuns` configuration enforcement in API and CLI when starting DAG-runs (#1214) - Thanks to [@ghansham](https://github.com/ghansham) for feedback
- **Queue Configuration Rename**: Renamed `queue.maxActiveRuns` to `queue.maxConcurrency` for clarity and consistency (#1215)

### Improvements
- **Directory Lock Management**: Improved directory lock and active process management for better reliability and reduced race conditions (#1202)
- **Empty Directory Cleanup**: Automatic removal of empty directories for proc and queue management to keep storage clean (#1208)
- **Default Start Command**: Made 'start' the default command, removing single flag requirement for better CLI usability
- **Max Active Runs Logic**: Enhanced check logic for `maxActiveRuns` configuration with improved validation (#1216)
- **Queue UI Enhancements**: Applied user feedback to improve queue UI usability and functionality (#1221, #1222)

### Bug Fixes
- **Script Execution**: Fixed script block execution that was failing with script parsing errors (#1204) - Thanks to [@Kaiden0001](https://github.com/Kaiden0001) for reporting the issue
- **Parallel Execution**: Fixed parallel execution parameter handling for JSON references and complex data structures (#1219) - Thanks to [@tetedange13](https://github.com/tetedange13) for reporting the issue

### Contributors

Thanks to our contributors for this release:

| Contribution                           | Contributor                              |
| -------------------------------------- | ---------------------------------------- |
| Script execution bug report (command not found error) | [@Kaiden0001](https://github.com/Kaiden0001) |
| Parallel execution with JSON references issue report | [@tetedange13](https://github.com/tetedange13) |
| Queue feature implementation feedback | [@ghansham](https://github.com/ghansham) |

**Full Changelog**: [v1.21.0...v1.22.0](https://github.com/dagu-org/dagu/compare/v1.21.0...v1.22.0)

## v1.21.0 (2025-08-17)

### New Features
- **Optional Step Names**: Made step names optional to remove the 40-character limit restriction, allowing more flexibility in workflow definitions (#1193) - Thanks to [@jonathonc](https://github.com/jonathonc) for raising the issue
- **Singleton DAG Execution**: Added `--singleton` flag to ensure only one instance of a DAG runs at a time, preventing duplicate executions (#1195) - Thanks to [@Kaiden0001](https://github.com/Kaiden0001) for the feature request
- **DAG-level SSH Configuration**: Implemented DAG-level SSH config for better control over remote executions across all steps (#1184)
- **Example DAGs for New Users**: Auto-create example DAGs when starting Dagu for the first time, helping new users get started quickly (#1190)
- **DAG-run Details Refresh**: Added refresh button to the DAG-run details page for immediate status updates (#1192)
- **Invalid DAG Handling**: Improved UI handling of invalid DAG configurations with better error messages and graceful degradation (#1186)

### Improvements
- **Queue Directory Management**: Ensure queue directory is created before starting file watch to prevent startup errors (#1191)
- **Coordinator Hostname Resolution**: Register configured hostname instead of resolved IP in coordinator.json for better network configuration (#1188) - Thanks to [@peterbuga](https://github.com/peterbuga) for reporting and proposing the solution

### Documentation
- **Examples Update**: Updated and cleaned up example DAGs to reflect current best practices (#1185)
- **Architecture Documentation**: Updated architecture diagrams and documentation

### Contributors

Thanks to our contributors for this release:

| Contribution                           | Contributor                              |
| -------------------------------------- | ---------------------------------------- |
| Optional step names feature request (40 char limit issue) | [@jonathonc](https://github.com/jonathonc) |
| Singleton flag feature request (split start API) | [@Kaiden0001](https://github.com/Kaiden0001) |
| Coordinator hostname resolution issue and solution | [@peterbuga](https://github.com/peterbuga) |

**Full Changelog**: [v1.20.0...v1.21.0](https://github.com/dagu-org/dagu/compare/v1.20.0...v1.21.0)

## v1.20.0 (2025-08-10)

### New Features
- **DAG Run Configuration**: Added ability to lock parameters and run ID in DAG configuration for controlled execution (#1176) - Thanks to [@kriyanshii](https://github.com/kriyanshii)
- **System Status UI**: Added comprehensive system health monitoring for scheduler and coordinator services (#1177)
- **Manual Refresh Controls**: Added refresh buttons to Dashboard, DAG-runs, and DAG-definitions pages for immediate data updates (#1178)
- **Immediate Execution Option**: Added checkbox to start DAGs immediately, bypassing the queue for urgent workflows (#1171)
- **Feedback Integration**: Added feedback button to sidebar with Web3Forms integration for better user communication (#1173)
- **Community Link**: Added Discord community link to navigation sidebar for easier access to support (#1175)
- **Auto-Navigation**: Automatically navigate to DAG-run detail page after starting or enqueuing a DAG (#1172)

### Improvements
- **Queue Management**: Refactored process store to use hierarchical directory structure, separating group names (queues) from DAG names for better organization (#1174)
- **Scheduler Timeout Handling**: Fixed scheduler queue reader to discard items when DAG runs don't become active within 10 seconds, preventing queue stacking (#1169) - Thanks to [@jrisch](https://github.com/jrisch) for reporting

### Bug Fixes
- **Status Display**: Fixed DAG header showing "0" instead of "not started" for DAGs that haven't been executed (#1168)

### Documentation
- **Roadmap**: Updated project roadmap with latest development priorities

### Contributors

Thanks to our contributors for this release:

| Contribution                           | Contributor                              |
| -------------------------------------- | ---------------------------------------- |
| DAG run configuration with parameter locking | [@kriyanshii](https://github.com/kriyanshii) |
| Timeout issues report and feedback | [@jrisch](https://github.com/jrisch) |

**Full Changelog**: [v1.19.0...v1.20.0](https://github.com/dagu-org/dagu/compare/v1.19.0...v1.20.0)

## v1.19.0 (2025-08-06)

### New Features
- **DAG-level Container Field**: Added support for running all steps in a single container with DAG-level container configuration (#1154)
- **Zombie DAG Detection**: Added automatic detection and cleanup of zombie DAG runs with configurable detection interval (#1163) - Thanks to [@jonasban](https://github.com/jonasban) for feedback
- **Container Registry Authentication**: Added support for pulling images from private registries with username/password and token-based authentication (#1165) - Thanks to [@vnghia](https://github.com/vnghia) for the feature request

### Improvements
- **Scheduler Health Check**: Fixed health check server startup to work correctly with multiple scheduler instances (#1157) - Thanks to [@jonasban](https://github.com/jonasban) for reporting
- **Stop Operation**: Fixed stop operation to properly handle multiple running instances of the same DAG (#1167) - Thanks to [@jeremydelattre59](https://github.com/jeremydelattre59) for reporting
- **Scheduler Queue Processing**: Fixed scheduler to use heartbeat monitoring instead of status files for more reliable process detection (#1166) - Thanks to [@jrisch](https://github.com/jrisch) for feedback
- **Environment Variables**: Corrected environment variable mapping for coordinator host and port configuration (#1162)
- **Docker Permissions**: Ensured DAGU_HOME directory has proper permissions in Docker containers (#1161)

### Bug Fixes
- **Continue On Skipped**: Fixed exit code 0 incorrectly triggering continuation for skipped steps with repeat policies (#1158) - Thanks to [@jeremydelattre59](https://github.com/jeremydelattre59) for reporting and [@thefishhat](https://github.com/thefishhat) for the fix
- **Queue Processing**: Fixed process store to correctly use queue name when specified (#1155) - Thanks to [@jonasban](https://github.com/jonasban) and [@ghansham](https://github.com/ghansham) for reporting

### Documentation
- **Docker Compose Example**: Added example configuration for Docker Compose setup
- **Roadmap**: Updated project roadmap based on general features

### Contributors

Thanks to our contributors for this release:

| Contribution                           | Contributor                              |
| -------------------------------------- | ---------------------------------------- |
| Zombie DAG detection feedback, health check and queue processing bug reports | [@jonasban](https://github.com/jonasban) |
| Continue on skipped bug report, stop operation issue report | [@jeremydelattre59](https://github.com/jeremydelattre59) |
| Exit code continuation fix | [@thefishhat](https://github.com/thefishhat) |
| Queue processing bug report | [@ghansham](https://github.com/ghansham) |
| Container registry authentication feature request | [@vnghia](https://github.com/vnghia) |
| Scheduler heartbeat monitoring feedback | [@jrisch](https://github.com/jrisch) |

**Full Changelog**: [v1.18.6...v1.19.0](https://github.com/dagu-org/dagu/compare/v1.18.6...v1.19.0)

## v1.18.6 (2025-08-03)

### Bug Fixes
- **Scheduler**: Fixed health check server startup race condition when multiple scheduler instances are deployed (#1157) - Thanks to [@jonasban](https://github.com/jonasban) for reporting

### Improvements
- **Node.js**: Upgraded to Node.js 22 (#1150) - Thanks to [@reneleonhardt](https://github.com/reneleonhardt)

### New Features
- **npm Package Verification**: Added automatic verification after npm package publishing (#1149)
- **npm Installation**: Added support for installing Dagu via npm

### Contributors

Thanks to our contributors for this release:

| Contribution                           | Contributor                              |
| -------------------------------------- | ---------------------------------------- |
| Health check race condition (report) | [@jonasban](https://github.com/jonasban) |
| Upgraded Node.js to 22 | [@reneleonhardt](https://github.com/reneleonhardt) |

**Full Changelog**: [v1.18.0...v1.18.6](https://github.com/dagu-org/dagu/compare/v1.18.5...v1.18.6)

## v1.18.0 (2025-07-29)

### New Features
- **Step-level Environment Variables**: Added support for environment variables at the step level (#1148) - Thanks to [@admerzeau](https://github.com/admerzeau) for reporting
- **Enhanced Repeat Policy**: Added explicit `until` and `while` modes for clearer repeat logic (#1050) - Thanks to [@thefishhat](https://github.com/thefishhat)
- **Live Log Loading**: Added real-time log streaming in the Web UI with reload button (#1085) - Thanks to [@tapir](https://github.com/tapir) for reporting
- **Exponential Backoff for RetryPolicy**: Added support for exponential backoff in retry policies (#1096, #1093) - Thanks to [@Sarvesh-11](https://github.com/Sarvesh-11)
- **OpenID Connect (OIDC) Authentication**: Added OIDC support for Web UI authentication (#1107) - Thanks to [@Arvintian](https://github.com/Arvintian)
- **Partial Success Status**: Added step-level partial success status for sub-DAG executions (#1115) - Thanks to [@ghansham](https://github.com/ghansham) for the feature request
- **Distributed Workflow Execution**: Implemented distributed task execution via worker processes (#1116, #1145)
- **Multiple Email Recipients**: Added support for multiple recipients in email notifications (#1125)
- **High Availability Support**: Added redundant scheduler support for high availability (#1147)
- **TLS/mTLS Support**: Added TLS/mTLS support for coordinator service
- **Scheduler Health Check**: Added health check endpoint for scheduler monitoring (#1129) - Thanks to [@jonasban](https://github.com/jonasban) for the feature request
- **Default DAG Sorting Configuration**: Added configuration for default DAG list sorting (#1135)
- **GitHub Repository Link**: Added GitHub repository link to sidebar
- **npm Installation Support**: Added global npm package for easy cross-platform installation via `npm install -g @dagu-org/dagu`

### Improvements
- **Output Capture**: Fixed maximum size setting for output capture
- **Web UI Sidebar**: Replaced automatic hover with manual toggle control, added persistence (#1121) - Thanks to [@ghansham](https://github.com/ghansham) for feedback
- **DAG Sorting**: Moved sorting logic from frontend to backend for proper pagination (#1123, #1134) - Thanks to [@ghansham](https://github.com/ghansham) for reporting
- **Dependency Upgrades**: Updated multiple dependencies (#1127) - Thanks to [@reneleonhardt](https://github.com/reneleonhardt)
- **Duration Display**: Fixed invalid date display in duration fields (#1137)
- **Orphaned DAG Handling**: Fixed handling of orphaned running DAGs after unexpected restarts (#1122)
- **Log File Migration**: Fixed log file path migration from legacy format (#1124)
- **Pagination**: Fixed hardcoded pagination limit (#1126)
- **DAG State Preservation**: Preserve previous DAG state when dequeuing (#1118)

### Bug Fixes
- **Installation Script**: Fixed installer script issues (#1091) - Thanks to [@Sarvesh-11](https://github.com/Sarvesh-11)
- **DAG List Sorting**: Fixed sort key issue in DAG list (#1134) - Thanks to [@ghansham](https://github.com/ghansham) for reporting
- **Next Run Display**: Fixed next run display for timezones (#1138)

### Documentation
- **OIDC Documentation**: Added comprehensive OIDC authentication documentation
- **Heartbeat Interval**: Documented heartbeat interval behavior

### Contributors

Thanks to our contributors for this release:

| Contribution | Contributor |
|--------------|--------|
| Installation script fixes, exponential backoff for retry policies | [@Sarvesh-11](https://github.com/Sarvesh-11) |
| Dependency upgrades | [@reneleonhardt](https://github.com/reneleonhardt) |
| Enhanced repeat policy with while/until modes | [@thefishhat](https://github.com/thefishhat) |
| OIDC authentication implementation | [@Arvintian](https://github.com/Arvintian) |
| Step-level environment variables feature request | [@admerzeau](https://github.com/admerzeau) |
| Live log loading feature request | [@tapir](https://github.com/tapir) |
| Partial success status request, DAG sorting issue, sidebar improvements | [@ghansham](https://github.com/ghansham) |
| Scheduler health check feature request | [@jonasban](https://github.com/jonasban) |

### New Contributors
- [@Sarvesh-11](https://github.com/Sarvesh-11) made their first contribution in [PR 1091](https://github.com/dagu-org/dagu/pull/1091)
- [@reneleonhardt](https://github.com/reneleonhardt) made their first contribution in [PR 1127](https://github.com/dagu-org/dagu/pull/1127)

**Full Changelog**: [v1.17.4...v1.18.0](https://github.com/dagu-org/dagu/compare/v1.17.4...v1.18.0)

## v1.17.4 (2025-06-30)

### New Features
- **Interactive DAG Selection**: Run `dagu start` without arguments to select DAGs interactively (#1074)
- **Bubble Tea Progress Display**: Replaced ANSI progress display with Bubble Tea TUI framework
- **OpenTelemetry Support**: Added distributed tracing with W3C trace context propagation (#1068)
- **Windows Support**: Initial Windows compatibility with PowerShell and cmd.exe (#1066)

### Improvements
- **Scheduler Refactoring**: Cleaned up scheduler code for better maintainability (#1062)
- **Error Handling**: Handle corrupted status files in scheduler queue processing

### Bug Fixes
- **UI**: Fixed 'f' key triggering fullscreen mode while editing DAGs (#1075)
- **SSH Executor**: Fixed handling of `||` and `&&` operators in command parsing (#1067)
- **JSON Schema**: Corrected DAG JSON schema for schedule field (#1071)
- **Scheduler**: Fixed scheduler discarding queued items when scheduled by `enqueue` (#1070)
- **Base DAG**: Fixed parameter parsing issue in base DAG loading

### Documentation
- Updated CLI documentation for interactive DAG selection
- Added OpenTelemetry configuration examples
- Fixed configuration documentation to match implementation
- Added missing feature pages to sidebar

### Contributors

Thanks to our contributors for this release:

| Contribution | Contributor |
|--------------|--------|
| Initial Windows support - PowerShell/cmd.exe compatibility | [@pdoronila](https://github.com/pdoronila) |
| Scheduler refactoring for improved maintainability | [@thefishhat](https://github.com/thefishhat) |
| Interactive DAG selection feature request | [@yottahmd](https://github.com/yottahmd) |
| OpenTelemetry distributed tracing feature request | [@jeremydelattre59](https://github.com/jeremydelattre59) |
| SSH executor double pipe operator (report) | [@NebulaCoding1029](https://github.com/NebulaCoding1029) |
| 'f' key interference in DAG editor (report) | [@NebulaCoding1029](https://github.com/NebulaCoding1029) |
| Log cleanup feature request | [@NebulaCoding1029](https://github.com/NebulaCoding1029) |
| Scheduler queue bug (report) | Jochen |

## v1.17.3 (2025-06-25)

### New Features
- **HTTP Executor**: Added `skipTLSVerify` option to support self-signed certificates (#1046)

### Bug Fixes
- **Configuration**: Fixed DAGU_DAGS_DIR environment variable not being recognized (#1060)
- **SSH Executor**: Fixed stdout and stderr streams being incorrectly merged (#1057)
- **Repeat Policy**: Fixed nodes being marked as failed when using repeat policy with non-zero exit codes (#1052)
- **UI**: Fixed retry individual step functionality for remote nodes (#1049)
- **Environment Variables**: Fixed environment variable evaluation and working directory handling (#1045)
- **Dashboard**: Prevented full page reload on date change and fixed invalid date handling (commit 58ad8e44)

### Documentation
- **Repeat Policy**: Corrected documentation and examples to accurately describe behavior (#1056)

### Contributors

Thanks to our contributors for this release:

| Contribution | Contributor |
|--------------|--------|
| HTTP executor skipTLSVerify feature | [@mnmercer](https://github.com/mnmercer) (report), [@nightly-brew](https://github.com/nightly-brew) (feedback) |
| DAGU_DAGS_DIR environment variable fix | [@Daffdi](https://github.com/Daffdi) (report) |
| SSH executor stdout/stderr separation | [@NebulaCoding1029](https://github.com/NebulaCoding1029) (report) |
| Repeat policy bug fixes and documentation | [@jeremydelattre59](https://github.com/jeremydelattre59) (reports) |
| Retry individual step UI fix | [@jeremydelattre59](https://github.com/jeremydelattre59) (report), [@thefishhat](https://github.com/thefishhat) (implementation) |
| Environment variable evaluation fixes | [@jhuang732](https://github.com/jhuang732) (report) |

## v1.17.2 (2025-06-20)

### Bug Fixes
- **HTTP Executor**: Fixed output not being written to stdout (#1042) - Thanks to [@nightly-brew](https://github.com/nightly-brew) for reporting

### Contributors

Thanks to our contributors for this release:

| Contribution | Contributor |
|--------------|--------|
| HTTP executor output capture fix | [@nightly-brew](https://github.com/nightly-brew) (report) |

## v1.17.1 (2025-06-20)

### New Features
- **One-click Step Re-run**: Retry an individual step without touching the rest of the DAG (#1030)
- **Nested-DAG Log Viewer**: See logs for every repeated sub run instead of only the last execution (#1029)

### Bug Fixes
- **Docker**: Fixed asset serving with base path and corrected storage volume locations (#1037)
- **Docker**: Updated Docker storage paths from `/dagu` to `/var/lib/dagu`
- **Steps**: Support camel case for step exit code field (#1031)

### Contributors

Thanks to our contributors for this release:

| Contribution | Contributor |
|--------------|--------|
| One-click Step Re-run – retry an individual step without touching the rest of the DAG | 🛠️ [@thefishhat](https://github.com/thefishhat) |
| Nested-DAG Log Viewer – see logs for every repeated sub run | 💡 [@jeremydelattre59](https://github.com/jeremydelattre59) |
| Docker image polish – fixes for asset paths & storage volumes | 🐳 [@jhuang732](https://github.com/jhuang732) (report) |

## v1.17.0 (2025-06-18)

### Major Features

####  Improved Performance
- Refactored execution history data for more performant history lookup
- Optimized internal data structures for better scalability

####  Hierarchical DAG Execution
Execute nested DAGs with full parameter passing and output bubbling:
```yaml
steps:
  - name: run_sub-dag
    run: sub-dag
    output: OUT
    params: "INPUT=${DATA_PATH}"

  - name: use output
    command: echo ${OUT.outputs.RESULT}
```

####  Multiple DAGs in Single File
Define multiple DAGs in one YAML file using `---` separator:
```yaml
name: main-workflow
steps:
  - name: process
    run: sub-workflow  # Defined below

---

name: sub-workflow
steps:
  - name: task
    command: echo "Hello from sub-workflow"
```

####  Parallel Execution with Parameters
Execute commands or sub-DAGs in parallel with different parameters for batch processing:
```yaml
steps:
  - name: get files
    command: find /data -name "*.csv"
    output: FILES
  
  - name: process files
    run: process-file
    parallel: ${FILES}
    params:
      - FILE_NAME: ${ITEM}
```

####  Enhanced Web UI
- Overall UI improvements with better user experience
- Cleaner design and more intuitive navigation
- Better performance for large DAG visualizations

####  Advanced History Search
New execution history page with:
- Date-range filtering
- Status filtering (success, failure, running, etc.)
- Improved search performance
- Better timeline visualization

####  Better Debugging
- **Precondition Results**: Display actual results of precondition evaluations in the UI
- **Output Variables**: Show output variable values in the UI for easier debugging
- **Separate Logs**: stdout and stderr are now separated by default for clearer log analysis

####  Queue Management
Added enqueue functionality for both API and UI:
```bash
# Queue a DAG for later execution
dagu enqueue --run-id=custom-id my-dag.yaml

# Dequeue
dagu dequeue default
```

####  Partial Success Status
New "partial success" status for workflows where some steps succeed and others fail, providing better visibility into complex workflow states.

####  API v2
- New `/api/v1` endpoints with refactored schema
- Better abstractions and cleaner interfaces
- Improved error handling and response formats
- See [OpenAPI spec](https://github.com/dagu-org/dagu/blob/main/api/v1/api.yaml) for details

### Docker Improvements

####  Optimized Images
Thanks to @jerry-yuan:
- Significantly reduced Docker image size
- Split into three baseline images for different use cases
- Better layer caching for faster builds

####  Container Enhancements
Thanks to @vnghia:
- Allow specifying container name
- Support for image platform selection
- Better container management options

### Enhanced Features

####  Advanced Repeat Policy
Thanks to @thefishhat:
- **Enhanced in v1.17.5**: Explicit 'while' and 'until' modes for clear repeat logic
- Conditions for repeat execution
- Expected output matching  
- Exit code-based repeats

```yaml
steps:
  - name: wait for service
    command: check_service.sh
    repeatPolicy:
      repeat: until        # NEW: Explicit mode (while/until)
      condition: "${STATUS}"
      expected: "ready"    # Repeat UNTIL status is ready
      intervalSec: 30
      limit: 60           # Maximum attempts
      
  - name: monitor process
    command: pgrep myapp
    repeatPolicy:
      repeat: while       # Repeat WHILE process exists
      exitCode: [0]       # Exit code 0 means found
      intervalSec: 10
```

### Bug Fixes & Improvements

- Fixed history data migration issues
- Improved error messages and logging
- Better handling of edge cases in DAG execution
- Performance improvements for large workflows
- Various UI/UX enhancements: #925, #898, #895, #868, #903, #911, #913, #921, #923, #887, #922, #932, #962

### Breaking Changes

####  DAG Type Field (v1.17.0-beta.13+)

Starting from v1.17.0-beta.13, DAGs now have a `type` field that controls step execution behavior:

- **`type: chain`** (new default): Steps are automatically connected in sequence, even if no dependencies are specified
- **`type: graph`** (previous behavior): Steps only depend on explicitly defined dependencies

To maintain the previous behavior, add `type: graph` to your DAG configuration:

```yaml
type: graph
steps:
  - name: task1
    command: echo "runs in parallel"
  - name: task2
    command: echo "runs in parallel"
```

Alternatively, you can explicitly set empty dependencies for parallel steps:

```yaml
type: graph
steps:
  - name: task1
    command: echo "runs in parallel"
    depends: []
  - name: task2
    command: echo "runs in parallel"
    depends: []
```

### Migration Required

 **History Data Migration**: Due to internal improvements, history data from 1.16.x requires migration:

```bash
# Migrate history data
dagu migrate history
```

After successful migration, legacy history directories are moved to `<DAGU_DATA_DIR>/history_migrated_<timestamp>` for safekeeping.

### Contributors

Huge thanks to our contributors for this release:

| Contribution | Contributor |
|--------------|--------|
| Optimized Docker image size and split into baseline images | [@jerry-yuan](https://github.com/jerry-yuan) |
| Container name & image platform support | [@vnghia](https://github.com/vnghia) |
| Enhanced repeat-policy conditions | [@thefishhat](https://github.com/thefishhat) |
| Queue functionality implementation | [@kriyanshii](https://github.com/kriyanshii) |
| Partial success status | [@thefishhat](https://github.com/thefishhat) |
| Countless reviews & feedback | [@ghansham](https://github.com/ghansham) |

### Installation

Try the beta version:

```bash
# Docker
docker run --rm -p 8080:8080 ghcr.io/dagu-org/dagu:latest dagu start-all

# Or download specific version
curl -L https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.sh | bash -s -- --version v1.17.0-beta
```

---

## v1.16.0 (2025-01-09)

### New Features

####  Enhanced Docker Image
- Base image updated to `ubuntu:24.04`
- Pre-installed common tools: `sudo`, `git`, `curl`, `jq`, `python3`, and more
- Ready for production use with essential utilities

####  Dotenv File Support
Load environment variables from `.env` files:

```yaml
dotenv: /path/to/.env
# or multiple files
dotenv:
  - .env
  - .env.production
```

#### 🔗 JSON Reference Expansion
Access nested JSON values with path syntax:

```yaml
steps:
  - name: sub workflow
    run: sub_workflow
    output: SUB_RESULT
  - name: use output
    command: echo "The result is ${SUB_RESULT.outputs.finalValue}"
```

If `SUB_RESULT` contains:
```json
{
  "outputs": {
    "finalValue": "success"
  }
}
```
Then `${SUB_RESULT.outputs.finalValue}` expands to `success`.

####  Advanced Preconditions

**Regex Support**: Use `re:` prefix for pattern matching:
```yaml
steps:
  - name: some_step
    command: some_command
    preconditions:
      - condition: "`date '+%d'`"
        expected: "re:0[1-9]"  # Run only on days 01-09
```

**Command Preconditions**: Test conditions with commands:
```yaml
steps:
  - name: some_step
    command: some_command
    preconditions:
      - command: "test -f /tmp/some_file"
```

####  Enhanced Parameter Support

**List Format**: Define parameters as key-value pairs:
```yaml
params:
  - PARAM1: value1
  - PARAM2: value2
```

**CLI Flexibility**: Support both named and positional parameters:
```bash
# Positional
dagu start my_dag -- param1 param2

# Named
dagu start my_dag -- PARAM1=value1 PARAM2=value2

# Mixed
dagu start my_dag -- param1 param2 --param3 value3
```

####  Enhanced Continue On Conditions

**Exit Code Matching**:
```yaml
steps:
  - name: some_step
    command: some_command
    continueOn:
      exitCode: [1, 2]  # Continue if exit code is 1 or 2
```

**Mark as Success**:
```yaml
steps:
  - name: some_step
    command: some_command
    continueOn:
      exitCode: 1
      markSuccess: true  # Mark successful even if failed
```

**Output Matching**:
```yaml
steps:
  - name: some_step
    command: some_command
    continueOn:
      output: "WARNING"  # Continue if output contains "WARNING"
      
  # With regex
  - name: another_step
    command: another_command
    continueOn:
      output: "re:^ERROR: [0-9]+"  # Regex pattern matching
```

#### 🐚 Shell Features

**Piping Support**:
```yaml
steps:
  - name: pipe_example
    command: "cat file.txt | grep pattern | wc -l"
```

**Custom Shell Selection**:
```yaml
steps:
  - name: bash_specific
    command: "echo ${BASH_VERSION}"
    shell: bash
    
  - name: python_shell
    command: "print('Hello from Python')"
    shell: python3
```

####  Sub-workflow Output
Parent workflows now receive structured output from sub-workflows:

```json
{
  "name": "some_subworkflow",
  "params": "PARAM1=param1 PARAM2=param2",
  "outputs": {
    "RESULT1": "Some output",
    "RESULT2": "Another output"
  }
}
```

#### 🔗 Simplified Dependencies
String format now supported:
```yaml
type: graph
steps:
  - name: first
    command: echo "First"
  - name: second
    command: echo "Second"
    depends: first  # Simple string instead of array
```

### Improvements

- **Environment Variable Expansion**: Now supported in most DAG fields
- **UI Enhancements**: Improved DAG visualization for better readability
- **Storage Optimization**: Reduced state file sizes by removing redundant data

### Bug Fixes

- Fixed: DAGs with dots (`.`) in names can now be edited in the Web UI

### Contributors

Thanks to our contributor for this release:

| Contribution | Contributor |
|--------------|--------|
| Improved parameter handling for CLI - support for both named and positional parameters | [@kriyanshii](https://github.com/kriyanshii) |

---

## Previous Versions

For older versions, please refer to the [GitHub releases page](https://github.com/dagu-org/dagu/releases).

## Version Support

- **Current**: v1.16.x (latest features and bug fixes)
- **Previous**: v1.15.x (bug fixes only)
- **Older**: Best effort support

## Migration Guides

### Upgrading to v1.16.0

Most changes are backward compatible. Key considerations:

1. **Docker Users**: The new Ubuntu base image includes more tools but is slightly larger
2. **Parameter Format**: Both old and new formats are supported
3. **State Files**: Old state files are automatically compatible

### Breaking Changes

None in v1.16.0

## See Also

- [Installation Guide](/getting-started/installation) - Upgrade instructions
- [Configuration Reference](/reference/config) - New configuration options
- [Examples](/writing-workflows/examples) - New feature examples
