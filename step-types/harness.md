# Harness

Run coding agent CLIs as workflow steps. The harness executor spawns a coding agent (Claude Code, Codex, OpenCode, or Pi) as a subprocess in non-interactive mode, captures its stdout/stderr, and reports its exit code.

The CLI binary must be pre-installed and available in `PATH`. If the binary is not found, the step fails at setup time before execution begins.

## Basic Usage

```yaml
steps:
  - name: generate-tests
    type: harness
    command: "Write unit tests for the auth module"
    config:
      provider: claude
```

The `command` field is the prompt sent to the coding agent. The `config.provider` field is required.

## Providers

Each provider maps to a specific CLI tool and its non-interactive invocation mode:

| Provider | Binary | Invocation | Install |
|----------|--------|------------|---------|
| `claude` | `claude` | `claude -p "<prompt>"` | [Claude Code](https://docs.anthropic.com/en/docs/claude-code) |
| `codex` | `codex` | `codex exec "<prompt>"` | [Codex CLI](https://github.com/openai/codex) |
| `opencode` | `opencode` | `opencode run "<prompt>"` | [OpenCode](https://opencode.ai) |
| `pi` | `pi` | `pi -p "<prompt>"` | [Pi Coding Agent](https://github.com/badlogic/pi-mono) |

## Common Configuration

These fields work across all providers (where the provider supports them):

| Field | Type | Description |
|-------|------|-------------|
| `provider` | string | **Required.** One of: `claude`, `codex`, `opencode`, `pi` |
| `model` | string | Model name passed to the provider's `--model` flag |
| `effort` | string | One of: `low`, `medium`, `high`, `max`. Mapped differently per provider (see below) |
| `max_turns` | integer | Maximum agentic iterations. Passed as `--max-turns` to Claude |
| `output_format` | string | One of: `text`, `json`, `stream-json`. Mapped to each provider's output flag |
| `extra_flags` | string[] | Additional CLI flags appended verbatim to the command |

### Effort Mapping

The `effort` field is translated differently per provider:

| Effort | Claude | Codex | OpenCode | Pi |
|--------|--------|-------|----------|-----|
| `low` | `--effort low` | (no effect) | (no effect) | `--thinking low` |
| `medium` | `--effort medium` | (no effect) | (no effect) | `--thinking medium` |
| `high` | `--effort high` | `--full-auto` | (no effect) | `--thinking high` |
| `max` | `--effort max` | `--full-auto` | (no effect) | `--thinking xhigh` |

### Output Format Mapping

| Format | Claude | Codex | OpenCode | Pi |
|--------|--------|-------|----------|-----|
| `json` | `--output-format json` | `--json` | `--format json` | `--mode json` |
| `stream-json` | `--output-format stream-json` | (no effect) | (no effect) | (no effect) |

## Claude Configuration

| Field | Type | CLI Flag |
|-------|------|----------|
| `allowed_tools` | string | `--allowedTools` (e.g., `"Bash,Read,Edit"`) |
| `disallowed_tools` | string | `--disallowedTools` |
| `permission_mode` | string | `--permission-mode` (e.g., `auto`, `plan`, `bypassPermissions`) |
| `system_prompt` | string | `--system-prompt` (replaces the default system prompt) |
| `append_system_prompt` | string | `--append-system-prompt` (appended to default system prompt) |
| `max_budget_usd` | number | `--max-budget-usd` |
| `bare` | boolean | `--bare` (skip auto-discovery of hooks, skills, MCP, CLAUDE.md) |
| `add_dir` | string | `--add-dir` (grant access to an additional directory) |
| `worktree` | boolean | `--worktree` (run in an isolated git worktree) |

## Codex Configuration

| Field | Type | CLI Flag |
|-------|------|----------|
| `sandbox` | string | `--sandbox` (`read-only`, `workspace-write`, `danger-full-access`) |
| `full_auto` | boolean | `--full-auto` (also set automatically when `effort` is `high` or `max`) |
| `output_schema` | string | `--output-schema` (path to JSON schema for structured output) |
| `ephemeral` | boolean | `--ephemeral` (don't persist session files) |
| `skip_git_repo_check` | boolean | `--skip-git-repo-check` |

## OpenCode Configuration

| Field | Type | CLI Flag |
|-------|------|----------|
| `agent` | string | `--agent` (agent name) |
| `file` | string | `--file` (attach file to message) |
| `title` | string | `--title` (session title) |

## Pi Configuration

| Field | Type | CLI Flag |
|-------|------|----------|
| `thinking` | string | `--thinking` (`off`, `minimal`, `low`, `medium`, `high`, `xhigh`). Overrides `effort` if both are set. |
| `pi_provider` | string | `--provider` (LLM provider: `anthropic`, `openai`, `google`, etc.) |
| `tools` | string | `--tools` (comma-separated tool list: `read`, `bash`, `edit`, `write`) |
| `no_tools` | boolean | `--no-tools` (disable all tools) |
| `no_extensions` | boolean | `--no-extensions` (disable extension auto-discovery) |
| `session` | string | `--session` (session path or UUID) |

## Stdin Piping

If the step has a `script` field, its content is piped to the CLI's stdin. This is useful for providing supplementary context alongside the prompt:

```yaml
steps:
  - name: review-code
    type: harness
    command: "Review this code for security issues"
    script: |
      func handleLogin(w http.ResponseWriter, r *http.Request) {
          username := r.FormValue("username")
          query := fmt.Sprintf("SELECT * FROM users WHERE name = '%s'", username)
          db.Query(query)
      }
    config:
      provider: claude
      model: sonnet
```

The prompt is passed via the CLI flag (`-p` for Claude, `exec` positional arg for Codex, etc.) and the script content arrives on stdin.

## Examples

### Claude Code with Output Capture

```yaml
steps:
  - name: analyze
    type: harness
    command: "Analyze the codebase and list all public API endpoints as JSON"
    config:
      provider: claude
      model: sonnet
      output_format: json
      bare: true
      permission_mode: plan
      max_turns: 10
      max_budget_usd: 1.00
    output: API_ENDPOINTS

  - name: process
    command: echo "${API_ENDPOINTS}" | jq '.endpoints | length'
    depends:
      - analyze
```

### Codex with Full Auto

```yaml
steps:
  - name: fix-tests
    type: harness
    command: "Run the test suite, identify failures, and fix them"
    config:
      provider: codex
      model: gpt-5-codex
      effort: high
      sandbox: workspace-write
      ephemeral: true
      skip_git_repo_check: true
    dir: ./src
```

### OpenCode with JSON Output

```yaml
steps:
  - name: refactor
    type: harness
    command: "Refactor the database layer to use connection pooling"
    config:
      provider: opencode
      model: anthropic/claude-sonnet-4-20250514
      output_format: json
```

### Pi with Thinking

```yaml
steps:
  - name: design
    type: harness
    command: "Design a rate limiting middleware for the API gateway"
    config:
      provider: pi
      pi_provider: anthropic
      model: claude-sonnet-4-20250514
      thinking: high
      tools: read,bash
```

### Using extra_flags

For CLI flags not yet modeled in the config, use `extra_flags`:

```yaml
steps:
  - name: task
    type: harness
    command: "Summarize the project"
    config:
      provider: claude
      extra_flags:
        - "--verbose"
        - "--no-session-persistence"
```

### With Timeout and Retry

Dagu's standard step-level `timeout_sec` and `retry_policy` work with harness steps:

```yaml
steps:
  - name: generate
    type: harness
    command: "Generate integration tests for the payment service"
    config:
      provider: claude
      model: opus
      effort: max
      max_turns: 30
    timeout_sec: 300
    retry_policy:
      limit: 2
      interval_sec: 10
```

### Variable Substitution in Config

Config values support `${VAR}` expansion:

```yaml
env:
  - MODEL: sonnet
  - PROVIDER: claude

steps:
  - name: task
    type: harness
    command: "Implement the feature described in ${SPEC_FILE}"
    config:
      provider: "${PROVIDER}"
      model: "${MODEL}"
      effort: high
```

## Exit Codes

| Exit Code | Meaning |
|-----------|---------|
| 0 | CLI completed successfully |
| 1 | CLI reported an error (check stderr in step logs) |
| 124 | Step timed out (Dagu killed the process) |

On non-zero exit, the last 1KB of stderr is included in the error message.
