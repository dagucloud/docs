# Agent

The Dagu agent is an LLM-powered assistant integrated into the Web UI. It can read, create, and modify your workflows through a chat interface with tool-calling capabilities.

## Accessing the Agent

Click the **Agent** button at the bottom-left corner of any page. The button shows a yellow pulsing indicator when the agent is processing.

## Setup

All agent configuration is managed through the Web UI at `/agent-settings` (requires admin role).

### 1. Enable the Agent

Toggle the agent on from the settings page. Alternatively, set the environment variable `DAGU_AGENT_ENABLED=true`.

This is the only setting configurable via environment variable. Everything else is configured through the Web UI.

### 2. Add a Model

Click **Add Model** to configure an LLM provider. Each model has:

| Field | Required | Description |
|-------|----------|-------------|
| Name | yes | Display name |
| Provider | yes | `anthropic`, `openai`, `gemini`, `openrouter`, `zai`, or `local` |
| Model | yes | Model identifier (e.g., `claude-sonnet-4-5`, `gpt-4o`) |
| API Key | yes* | Provider API key. Not required for `local` provider. |
| Base URL | no | Custom endpoint. Required for `local` provider (e.g., `http://localhost:11434/v1`). |
| Context Window | no | Token context size |
| Max Output Tokens | no | Maximum output tokens |
| Input Cost / 1M | no | Cost per 1M input tokens (for cost tracking) |
| Output Cost / 1M | no | Cost per 1M output tokens (for cost tracking) |
| Supports Thinking | no | Enable extended thinking capability |

The settings page includes presets for common models (Claude, GPT-4, Gemini, etc.) that pre-fill these fields.

### 3. Set a Default Model

Click the star icon next to a model to set it as the default. The agent uses this model unless overridden per-session or per-step.

## Chat Interface

### Sessions

- Each session is persisted per user
- Select previous sessions from the sidebar
- Click **+** in the header to start a new session
- Each session tracks cost (token usage × model pricing)

### DAG Context

The agent receives DAG context automatically:

1. **Automatic**: When viewing a DAG or run page, that DAG's name, file path, run ID, and status are included
2. **Manual**: Use the DAG picker in the input area to attach additional DAGs

### Model and Soul Selection

The input area includes dropdowns to override the default model and select a soul (personality) for the current message.

### Safe Mode

Toggle the shield icon in the header to enable/disable safe mode:

- **On** (default): Bash commands that match deny rules trigger an approval prompt
- **Off**: All commands execute immediately without approval

### Sending Messages

- Type in the input area at the bottom
- Press **Enter** to send (Shift+Enter for new line)
- Click **Stop** (square icon) to cancel processing

## Available Tools

| Tool | Description |
|------|-------------|
| `bash` | Execute shell commands (120s default timeout, 600s max) |
| `read` | Read file contents with line numbers |
| `patch` | Create, edit, or delete files |
| `think` | Record reasoning without side effects |
| `navigate` | Open pages in the Dagu UI |
| `ask_user` | Prompt the user with options or free-text input |
| `read_schema` | Look up DAG YAML schema documentation |
| `delegate` | Spawn sub-agents for parallel tasks |
| `use_skill` | Execute a skill from the skill store (when skills are configured) |
| `search_skills` | Search available skills by query (when skills are configured) |
| `remote_agent` | Delegate tasks to agents on remote nodes (when remote nodes are configured) |
| `list_remote_nodes` | List available remote nodes (when remote nodes are configured) |

Tools can be individually enabled/disabled in the Tool Policy section of the settings page.

See [Tools Reference](/features/agent/tools) for full parameter documentation.

## Bash Command Policy

Bash command execution is controlled by a configurable policy with regex-based rules. Configure this in the Tool Policy section of the settings page.

| Setting | Values | Default | Description |
|---------|--------|---------|-------------|
| Default Behavior | `allow`, `deny` | `allow` | Action when no rule matches |
| Deny Behavior | `ask_user`, `block` | `ask_user` | What happens when a command is denied. `ask_user` shows an approval prompt; `block` silently rejects. |

Rules are evaluated in order. Each rule has:

| Field | Description |
|-------|-------------|
| Pattern | Regex matched against the command |
| Action | `allow` or `deny` |
| Enabled | Toggle the rule on/off |

Example: to require approval for destructive commands while allowing everything else, set default behavior to `allow` and add deny rules:

```
Pattern: ^rm\s+      Action: deny
Pattern: ^chmod\s+    Action: deny
```

When a command is denied with `ask_user` behavior, a prompt appears showing the command and working directory. The user can approve or reject. Approval times out after 5 minutes.

The policy also blocks shell constructs that could bypass rule matching: backticks, `$(...)` command substitution, heredocs (`<<`), and process substitution (`<(...)`, `>(...)`).

## Configuration Storage

Agent configuration is stored in `{DAGU_HOME}/data/agent/config.json`. The actual structure:

```json
{
  "enabled": true,
  "defaultModelId": "claude-sonnet",
  "toolPolicy": {
    "tools": { "bash": true, "read": true, "patch": true, "...": true },
    "bash": {
      "rules": [],
      "defaultBehavior": "allow",
      "denyBehavior": "ask_user"
    }
  },
  "enabledSkills": [],
  "selectedSoulId": "",
  "webSearch": { "enabled": false }
}
```

Models are stored separately and managed through their own API. Do not edit these files directly — use the Web UI at `/agent-settings`.

## See Also

- [Agent Step](/features/agent/step) — Run the agent as a workflow step (`type: agent`)
- [Tools Reference](/features/agent/tools) — Full parameter documentation for each tool
- [Memory](/features/agent/memory) — Persistent context across sessions
- [Souls](/features/agent/souls) — Configurable agent personalities
- [Chat & AI Agents](/features/chat/) — `type: chat` for simpler LLM calls in DAG workflows
