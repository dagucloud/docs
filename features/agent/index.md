# AI Agent

The Dagu AI Agent is the built-in assistant integrated into the Web UI. It can read files, modify workflows, run tools, and help users operate Dagu through a persistent chat interface.

The same agent foundation also powers:

- The Web UI assistant
- The workflow `type: agent` step
- Workflow Operator for Slack and Telegram

## Accessing the Agent

Click the **Agent** button at the bottom-left corner of any page. The button shows a yellow pulsing indicator when the agent is processing.

## Documentation Map

Use this section as the entry point for the agent-related docs:

- [Settings Overview](/features/agent/settings/) — Start here for the built-in Web UI agent settings
- [Models & Providers](/features/agent/settings/models) — Enable the built-in agent, add models, and set the default model
- [Tool Permissions & Bash Policy](/features/agent/settings/controls) — Decide which tools the agent may use and how bash commands are filtered
- [Personality & Web Search](/features/agent/settings/behavior) — Choose the default soul and provider-native web search behavior
- [Agent Step](/features/agent/step) — Run the agent as a workflow step inside a DAG
- [Tools Reference](/features/agent/tools) — Understand the built-in tools and their parameters
- [Workflow Operator](/features/bots/) — Use the built-in agent through Slack or Telegram chatbots
- [Chat & AI Agents](/features/chat/) — Use `type: chat` for direct LLM calls in workflows

## Settings

All built-in agent configuration is managed through the Web UI at `/agent-settings`.

The documentation is split into smaller pages:

- [Settings Overview](/features/agent/settings/)
- [Models & Providers](/features/agent/settings/models)
- [Tool Permissions & Bash Policy](/features/agent/settings/controls)
- [Personality & Web Search](/features/agent/settings/behavior)

For Ollama and other local model servers, see [Local AI](/features/chat/local-ai) for the exact `Base URL` format Dagu expects.

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

- **On** (default): Bash commands denied by policy with `ask_user` behavior trigger an approval prompt
- **Off**: Those same commands run immediately without prompting. Commands denied with `block` still fail.

### Sending Messages

- Type in the input area at the bottom
- Press **Enter** to send (Shift+Enter for new line)
- Click **Stop** (square icon) to cancel processing

## Available Tools

The agent tool registry currently includes these tools. Skills and remote-node tools appear only when those features are configured:

| Tool | Description |
|------|-------------|
| `bash` | Execute shell commands (120s default timeout, 600s max) |
| `read` | Read file contents with line numbers |
| `patch` | Create, edit, or delete files |
| `think` | Record reasoning without side effects |
| `navigate` | Open pages in the Dagu UI |
| `ask_user` | Prompt the user with options or free-text input |
| `delegate` | Spawn sub-agents for parallel tasks |
| `remote_agent` | Delegate tasks to agents on remote nodes (when remote nodes are configured) |
| `list_contexts` | List available remote nodes for `remote_agent` (when remote nodes are configured) |

Provider-native web search is configured separately in agent settings. It is not exposed as a standalone tool.

Tools can be individually enabled or disabled in [Tool Permissions & Bash Policy](/features/agent/settings/controls).

See [Tools Reference](/features/agent/tools) for full parameter documentation.

## Bash Command Policy

Bash command execution is controlled by a configurable policy with regex-based rules. Configure this in [Tool Permissions & Bash Policy](/features/agent/settings/controls).

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

When a command is denied with `ask_user` behavior and safe mode is on, a prompt appears showing the command and working directory. The user can approve or reject. Approval times out after 5 minutes. When safe mode is off, `ask_user` behaves like allow. `block` always blocks.

The policy also blocks shell constructs that could bypass rule matching: backticks, `$(...)` command substitution, heredocs (`<<`), and process substitution (`<(...)`, `>(...)`).

## Configuration Storage

Agent configuration is stored in `{DAGU_HOME}/data/agent/config.json`. A typical structure looks like:

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
  "selectedSoulId": "",
  "webSearch": { "enabled": true }
}
```

Models are stored separately and managed through their own API. Do not edit these files directly — use the Web UI at `/agent-settings`.

## See Also

- [Settings Overview](/features/agent/settings/) — Start here for the built-in Web UI agent settings
- [Models & Providers](/features/agent/settings/models) — Built-in agent model registry and default model behavior
- [Tool Permissions & Bash Policy](/features/agent/settings/controls) — Global tool gating and bash command filtering
- [Personality & Web Search](/features/agent/settings/behavior) — Default soul and provider-native web search
- [Agent Step](/features/agent/step) — Run the agent as a workflow step (`type: agent`)
- [Tools Reference](/features/agent/tools) — Full parameter documentation for each tool
- [Memory](/features/agent/memory) — Persistent context across sessions
- [Souls](/features/agent/souls) — Configurable agent personalities
- [Workflow Operator](/features/bots/) — Use the built-in agent through Slack or Telegram
- [Chat & AI Agents](/features/chat/) — `type: chat` for simpler LLM calls in DAG workflows
