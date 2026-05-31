# Agent Step

Run the AI agent as a workflow step. The agent executes a multi-turn tool-calling loop to accomplish the task described in `with.messages`, `with.prompt`, or `with.task`. It can read files, run commands, edit code, and use web search when enabled.

## Basic Usage

```yaml
steps:
  - action: agent.run
    with:
      messages:
        - role: user
          content: |
            Analyze the error logs at /var/log/app/errors.log from the last hour.
            Summarize the root causes and suggest fixes.
    output: ANALYSIS_RESULT
```

The agent uses the default model configured in AI agent Settings (`/agent-settings`). No per-step model configuration is needed.

## Configuration

The `with` block provides the task through `task`, `prompt`, or `messages`. Other fields fall back to `defaults.agent` and then global AI agent Settings when omitted.

```yaml
steps:
  - action: agent.run
    with:
      model: claude-sonnet
      tools:
        enabled:
          - bash
          - read
          - patch
      prompt: |
        Focus only on files in /etc/app/.
      max_iterations: 30
      messages:
        - role: user
          content: |
            Fix the invalid database_url in /etc/app/config.yaml
    output: RESULT
```

### `agent` Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `model` | string | global default | Model ID from AI agent Settings. Overrides the default model for this step. |
| `tools` | object | — | Tool selection and bash policy. See [Tools](#tools). |
| `soul` | string | — | Profile (`soul`) ID for this step's identity. When omitted, inherits from `defaults.agent.soul`. |
| `memory` | object | `{ enabled: false }` | When `enabled: true`, loads global and per-DAG memory into the agent context. See [Memory](/features/agent/memory). |
| `prompt` | string | — | Additional instructions appended to the built-in system prompt. |
| `max_iterations` | int | `50` | Maximum tool-call rounds before the agent stops. |
| `web_search` | object | — | Provider-native model web search configuration. Overrides the global model web search setting. See [Model Web Search](#model-web-search). |
| `safe_mode` | bool | `true` | Passed through to the agent loop for compatibility with interactive sessions. Agent steps do not show approval prompts; bash commands denied by policy are blocked. |

## Model Resolution

The agent step resolves its model after DAG-level defaults are applied:

1. If `with.model` is set in the step, look up that model ID in the global `ModelStore`
2. If `defaults.agent.model` is set, use that model ID
3. Otherwise use the global default model (`DefaultModelID` from AI agent Settings)
4. If no model is configured, the step fails with: `"no model configured; set a default model in Agent Settings or specify agent.model in the step"`

Model configuration (provider, API key, base URL) is managed entirely through AI agent Settings. This avoids duplicating credentials in DAG files.

## DAG-Level Defaults

Use `defaults.agent` to set default agent configuration for all `action: agent.run` steps in the DAG. Each field is applied only when the step does not set its own value.

```yaml
defaults:
  agent:
    model: claude-opus
    soul: tsumugi
    max_iterations: 30

steps:
  - action: agent.run
    with:
      messages:
        - role: user
          content: |
            Analyze the logs
    # Uses defaults: model=claude-opus, soul=tsumugi, max_iterations=30

  - action: agent.run
    with:
      model: claude-sonnet   # overrides defaults.agent.model
      messages:
        - role: user
          content: |
            Review the analysis
    # Uses model=claude-sonnet (override), soul=tsumugi (default), etc.
```

**Resolution order (per field):** `step.with.<field>` → `defaults.agent.<field>` → global default when one exists for that field → built-in default

### Supported Default Fields

| Field | Type | Description |
|-------|------|-------------|
| `model` | string | Default model ID for agent steps |
| `tools` | object | Default tool selection and bash policy |
| `soul` | string | Default profile (`soul`) ID |
| `memory` | object | Default memory configuration |
| `prompt` | string | Default additional system prompt instructions |
| `max_iterations` | int | Default max tool-call rounds |
| `safe_mode` | bool | Default safe mode setting. Agent-step deny rules still block without prompting. |

## Tools

### Available Tools

The agent step has access to these tools:

| Tool | Description |
|------|-------------|
| `bash` | Execute shell commands (timeout: 120s default, max 600s) |
| `read` | Read file contents with line numbers (max 1MB, 2000 lines default) |
| `patch` | Create, edit, or delete files |
| `think` | Record reasoning without executing actions |
| `web_search` | Search the public web through Tavily or Firecrawl when a hosted web backend is configured |
| `web_extract` | Extract readable content from web page URLs through Tavily or Firecrawl when a hosted web backend is configured |
| `remote_agent` | Delegate tasks to agents through remote CLI contexts (available when contexts are configured) |
| `list_contexts` | List available remote CLI contexts for `remote_agent` (available when contexts are configured) |
| `output` | Write the final result to stdout (step-only, see [Output Capture](#output-capture)) |

The `navigate`, `ask_user`, and `delegate` tools are not available in agent steps because they require the Web UI.

See [Tools Reference](/features/agent/tools) for full parameter documentation.

### `output` Tool

The `output` tool is unique to agent steps. When the agent calls it, the `content` parameter is written directly to the step's stdout. This is how the step produces its output variable.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | string | Yes | The final result to output. Cannot be empty. |

The `output` tool is always included even if not listed in `tools.enabled`.

### Tool Selection

Tools are filtered in two layers:

1. **Global policy** (from AI agent Settings): Tools disabled in the global `ToolPolicy.Tools` are removed. You cannot re-enable a globally-disabled tool at the step level.
2. **Step-level `tools.enabled`**: If specified, only the listed tools are available (intersected with what's globally allowed).

When `tools.enabled` is omitted, all globally-enabled tools are available.

```yaml
agent:
  tools:
    enabled:
      - bash
      - read
      - think
```

If `read` is disabled in global AI agent Settings and the step specifies `enabled: [bash, read]`, only `bash` and `output` will be available. The step does not produce a warning for this.

## Bash Policy

Bash command policy rules are loaded from global AI agent Settings and enforced via a `BeforeToolExecHook` on every bash tool call. Rules are evaluated in order; the first matching rule determines the action.

Agent steps do not have an interactive approval UI. If a command is denied by policy, the step receives a policy error instead of a prompt.

### Step-Level Bash Policy

The step can define its own bash policy rules via `tools.bash_policy`:

```yaml
agent:
  tools:
    bash_policy:
      default_behavior: deny
      deny_behavior: block
      rules:
        - name: allow-read-commands
          pattern: "^(cat|head|tail|grep|find|ls)\\b"
          action: allow
        - name: deny-destructive
          pattern: "^(rm|chmod|chown|mkfs)\\b"
          action: deny
```

| Field | Type | Values | Description |
|-------|------|--------|-------------|
| `default_behavior` | string | `allow`, `deny` | Action when no rule matches. Global default: `allow`. |
| `deny_behavior` | string | `ask_user`, `block` | What happens when denied. In agent steps, `ask_user` behaves like `block` because there is no approval UI. Global default: `ask_user`. |
| `rules[].name` | string | — | Human-readable rule name. |
| `rules[].pattern` | string | — | Regex pattern matched against each command segment. Required. |
| `rules[].action` | string | `allow`, `deny` | Action when pattern matches. Required. |

When a bash command is denied, the agent receives: `"Blocked by policy: bash command denied by policy: {reason}"`.

## Model Web Search

Provider-native web search is configured via the `with.web_search` field. This uses the LLM provider's built-in web search capability (e.g., Anthropic's web search) rather than a separate tool. When omitted, the step falls back to the global agent web search setting.

```yaml
steps:
  - action: agent.run
    with:
      web_search:
        enabled: true
        max_uses: 10
        allowed_domains:
          - docs.example.com
          - github.com
        blocked_domains:
          - reddit.com
        user_location:
          city: San Francisco
          region: California
          country: US
          timezone: America/Los_Angeles
      task: |
        Research recent dependency changes
```

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | bool | Activates provider-native web search. |
| `max_uses` | *int | Limits search invocations per request. |
| `allowed_domains` | string[] | Restricts results to these domains (Anthropic only). |
| `blocked_domains` | string[] | Excludes results from these domains (Anthropic only). |
| `user_location` | object | Localizes search results. Fields: `city`, `region`, `country`, `timezone` (all string). |

## Provider-Backed Web Tools

Tavily and Firecrawl web tools are configured globally from **Agent Tools** at `/agent-tools`. They are not configured in DAG YAML because the API keys live in the agent config store.

When enabled, they add callable `web_search` and `web_extract` tools to agent steps. If the step sets `with.tools.enabled`, list the web tools explicitly:

```yaml
steps:
  - action: agent.run
    with:
      tools:
        enabled:
          - web_search
          - web_extract
      task: |
        Summarize the latest API changelog
```

The tools are still filtered by the global tool policy. If `web_search` or `web_extract` is disabled globally, a step cannot re-enable it.

See [Web Search](/features/agent/web-search) for backend setup and provider limits.

## Messages

At least one of `with.task`, `with.prompt`, or `with.messages` is required. Validation fails if the action does not describe a task.

Message content supports variable substitution with `${VAR}` syntax. Variables are evaluated at runtime via `runtime.EvalString`:

```yaml
params:
  - INPUT_FILE
  - OUTPUT_DIR

steps:
  - action: agent.run
    with:
      messages:
        - role: user
          content: |
            Analyze ${INPUT_FILE} and write results to ${OUTPUT_DIR}
    output: RESULT
```

## Execution

The agent runs as a single-shot loop. It processes the user messages, calls tools as needed, and stops when either:

- The agent finishes processing with no more tool calls (normal completion)
- `max_iterations` is reached (the loop is cancelled)

### Approval Push-back

When an agent step is re-executed because of approval push-back, Dagu restores the step's previous conversation and appends reviewer feedback from the push-back inputs. You do not need to add `${FEEDBACK}` or `DAG_PUSHBACK` references to the step messages manually.

If an approval step uses `approval.rewind_to` to restart an upstream agent step, that upstream step receives the push-back context even if it does not declare its own `approval`.

The same context is also exposed through the standard push-back environment variables, including `DAG_PUSHBACK`, `DAG_PUSHBACK_ITERATION`, and any reviewer-provided input keys. See [Approval](/writing-workflows/approval#push-back-environment) for the full reference.

### Stderr Logging

All agent activity is logged to stderr with `[agent]` prefix. This keeps stdout clean for output capture.

```
[agent] Starting (model: Claude Sonnet, tools: 7, safe_mode: true, max_iterations: 50)
[agent] Tool call: bash {"command":"ls -la /var/log/app/"}
[agent] Tool result: [success, 1234 chars]
[agent] Assistant: I found the following log files...
[agent] Tool call: read {"path":"/var/log/app/errors.log","limit":100}
[agent] Tool result: [success, 5678 chars]
[agent] Completed (2 iterations)
```

Tool call arguments are truncated at 200 characters. Assistant content is truncated at 500 characters with newlines replaced by spaces.

## Output Capture

The step's `output` field captures whatever the agent writes to stdout via the `output` tool:

```yaml
steps:
  - id: count_files
    action: agent.run
    with:
      messages:
        - role: user
          content: |
            Count the number of .go files in this directory
    output: FILE_COUNT

  - id: print_count
    run: echo "Found ${FILE_COUNT} Go files"
    depends: count_files
```

The agent is instructed (via system prompt) to call the `output` tool with its final result. The content is written directly to stdout and captured by the `output` field.

If the agent never calls the `output` tool, the output variable will be empty.

## Examples

### Minimal

```yaml
steps:
  - action: agent.run
    with:
      messages:
        - role: user
          content: |
            Summarize the README.md in this repository
    output: SUMMARY
```

### With Model Override

```yaml
steps:
  - action: agent.run
    with:
      model: claude-opus
      messages:
        - role: user
          content: |
            Review the code in src/main.go for bugs and security issues
    output: REVIEW
```

### Restricted Tools

```yaml
steps:
  - action: agent.run
    with:
      tools:
        enabled:
          - read
          - think
      messages:
        - role: user
          content: |
            Analyze the architecture of this codebase without modifying anything
    output: ANALYSIS
```

### With Bash Policy

```yaml
steps:
  - action: agent.run
    with:
      tools:
        bash_policy:
          default_behavior: deny
          deny_behavior: block
          rules:
            - name: allow-status-commands
              pattern: "^(kubectl get|kubectl describe|helm status)\\b"
              action: allow
      prompt: |
        Check the deployment status of the staging environment.
        Only use read-only kubectl and helm commands.
      max_iterations: 20
      messages:
        - role: user
          content: |
            Report the health of all pods in the staging namespace
    output: HEALTH_REPORT
```

### Pipeline with Multiple Agent Steps

```yaml
params:
  - REPO_PATH

steps:
  - id: analyze_coverage
    action: agent.run
    with:
      messages:
        - role: user
          content: |
            Analyze the test coverage of ${REPO_PATH} and identify untested code paths
    output: COVERAGE_ANALYSIS

  - id: write_tests
    action: agent.run
    with:
      model: claude-opus
      max_iterations: 100
      messages:
        - role: user
          content: |
            Based on this analysis:
            ${COVERAGE_ANALYSIS}

            Write unit tests for the untested code paths in ${REPO_PATH}.
    output: TEST_RESULT
    depends: analyze_coverage
```

### Graph DAG with Agent and Approval

```yaml
type: graph

steps:
  - id: draft
    action: agent.run
    with:
      messages:
        - role: user
          content: |
            Draft a migration plan for upgrading the database from v3 to v4
    output: MIGRATION_PLAN
    approval:
      prompt: "Review the migration plan and approve if acceptable"

  - id: execute
    action: agent.run
    with:
      messages:
        - role: user
          content: |
            Execute the approved migration plan: ${MIGRATION_PLAN}
    depends: draft
```

## See Also

- [AI agent Overview](/features/agent/) — Web UI steward with sessions and interactive tools
- [AI agent Tools Reference](/features/agent/tools) — Full parameter documentation for each tool
- [Chat & AI Agents](/features/chat/) — `action: chat.completion` for simple LLM calls with DAG-based tools
- [Approval](/writing-workflows/approval) — Human approval gates
- [Scheduled Agents](/features/agent/scheduling) — Running agent steps on a cron schedule
- [Nested Agents](/features/agent/nesting) — Compose agent workflows hierarchically via sub-DAGs
- [Data Flow](/writing-workflows/data-flow) — Passing data between steps with `output`
