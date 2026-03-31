# Agent Settings

The **Agent Settings** page in the Web UI (`/agent-settings`) configures the built-in AI agent itself.

This is broader than workflow `type: agent` or `type: chat` configuration:

- It controls the Web UI assistant
- It configures the model registry used by the built-in agent
- It controls tool permissions and bash policy
- It configures provider-native web search for agent sessions
- It selects the default soul/personality
- It is a prerequisite for **Workflow Operator** on Slack and Telegram

If you are looking for workflow YAML configuration, see [Agent Step](/features/agent/step) and [Chat & AI Agents](/features/chat/).

## What the Page Controls

The `/agent-settings` page is the control plane for the built-in AI assistant that appears in the Web UI and for features that depend on that assistant.

In practice, the page manages:

- Whether the built-in agent is enabled
- Which model is used by default
- Which tools the agent may use
- How bash command approval and blocking works
- Which soul/personality the agent uses
- Whether provider-native web search is allowed

It does not replace workflow YAML configuration for `type: agent` or `type: chat`. Those remain per-workflow features.

## General Settings

### Enable Agent

The page includes an **Enable Agent** toggle that turns the built-in Web UI assistant on or off.

This is also the one agent setting exposed through an environment variable:

```bash
export DAGU_AGENT_ENABLED=true
```

Everything else on the page is managed through the Web UI.

### Agent Personality

If souls are configured, the page shows an **Agent Personality** selector.

This chooses the default soul for the built-in agent. Souls define the agent's identity and communication style. See [Souls](/features/agent/souls) for the authoring model and storage format.

### Web Search

The page includes a **Web Search** toggle and optional **Max Uses per Request** field.

This controls provider-native web search for agent sessions. It is not exposed as a standalone callable tool in the agent chat UI. Whether it works depends on the selected provider and model.

## Models

When the built-in agent is enabled, the page shows a **Models** table and **Add Model** action.

Each model entry stores:

- Display name
- Internal ID
- Provider
- Provider model name
- API key presence
- Description and pricing metadata
- Default-model status

### Default Model

One model can be marked as the default. The Web UI agent uses that model unless the user overrides it in the chat UI.

### Model Fields

When creating or editing a model, the form includes these main fields:

| Field | Purpose |
|---|---|
| `Name` | Human-readable display name |
| `ID` | Stable internal identifier used by Dagu |
| `Provider` | Backend provider implementation |
| `Model` | Provider-specific model identifier |
| `API Key` | Optional for `local`, required for most hosted providers |
| `Base URL` | Custom endpoint override |
| `Description` | Optional UI description |
| `Context Window` | Model metadata used by Dagu |
| `Max Output Tokens` | Model metadata |
| `Input / Output Cost` | Cost tracking metadata |
| `Supports Thinking` | Model metadata for UI/preset purposes |

### Local Models

For Ollama and other local servers, use the `Local` provider in the UI.

Important:

- For local models, the `Base URL` is a base prefix, not a full endpoint
- If left empty, Dagu defaults to `http://localhost:11434/v1`
- Dagu's local provider uses OpenAI-compatible chat completions, not native Ollama `/api/generate`

See [Local AI](/features/chat/local-ai) for the exact behavior and troubleshooting.

## Tool Permissions

The settings page includes a **Tool Permissions** section listing the built-in agent tools.

Each tool can be enabled or disabled individually. This affects the built-in Web UI agent and features built on top of it.

Examples include:

- `bash`
- `read`
- `patch`
- `think`
- `navigate`
- `ask_user`
- `delegate`

Skills and remote-node tools appear only when those features are configured.

See [Tools Reference](/features/agent/tools) for what each tool does.

## Bash Command Policy

The settings page includes a **Bash Command Policy** section under Tool Permissions.

This controls how the built-in agent evaluates bash commands before execution.

### Main policy controls

| Setting | Meaning |
|---|---|
| `No Match Behavior` | What happens when no regex rule matches |
| `On Deny` | Whether denied commands are blocked or sent to the user for approval |

### Ordered regex rules

Rules are evaluated top-down. Each rule includes:

- `Name`
- `Regex Pattern`
- `Action` (`allow` or `deny`)
- `Enabled`

This is the main place to restrict dangerous shell activity while still keeping the agent useful.

## Relationship to Safe Mode

Safe mode is not configured on the Settings page.

It is a runtime control in the Web UI agent chat header. Safe mode determines how the agent behaves when a bash rule denies a command with `ask_user` behavior:

- **Safe mode on**: the user is prompted
- **Safe mode off**: the command runs without prompting

Hard `block` denials still block regardless of safe mode.

## Relationship to Workflow Features

### Workflow `type: agent`

The Settings page does not replace the `agent` workflow step. The `agent` step is a separate DAG feature for running a multi-turn tool-calling loop inside a workflow. See [Agent Step](/features/agent/step).

### Workflow `type: chat`

The Settings page also does not replace the `chat` workflow step. `type: chat` is a workflow feature for direct LLM calls in DAGs. See [Chat & AI Agents](/features/chat/).

### Workflow Operator

Workflow Operator depends on the built-in AI agent being configured first. Slack and Telegram conversations are routed into agent sessions, so the agent must already have a working model and policy configuration.

See:

- [Workflow Operator](/features/bots/)
- [Workflow Operator on Slack](/features/bots/slack)
- [Workflow Operator on Telegram](/features/bots/telegram)

## Recommended Setup Order

For most teams, the clean order is:

1. Enable the built-in agent
2. Add at least one model
3. Set the default model
4. Review tool permissions and bash policy
5. Optionally configure a soul
6. Optionally enable provider-native web search
7. Only then enable Workflow Operator on Slack or Telegram

## See Also

- [AI Agent Overview](/features/agent/)
- [Agent Step](/features/agent/step)
- [Tools Reference](/features/agent/tools)
- [Local AI](/features/chat/local-ai)
- [Workflow Operator](/features/bots/)
