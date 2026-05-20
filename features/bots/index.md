# Workflow Operator (Chat Bot)

Workflow Operator brings the built-in Dagu agent into Slack, Telegram, Discord, and LINE. Each channel, thread, DM, or LINE source keeps its own ongoing conversation, so you can ask follow-up questions and receive run notifications in the same place.

Only one messaging connector can be active at a time. Choose it with `bots.provider` in the config file or `DAGU_BOTS_PROVIDER` in the environment.

::: tip Prerequisite
Configure AI agent first. Go to **AI agent Settings** (`/agent-settings`) in the Web UI and set your model, tool policy, and related defaults. Start with [AI agent Settings](/features/agent/settings/), then use [Models & Providers](/features/agent/settings/models) and [Tool Permissions & Bash Policy](/features/agent/settings/controls) as needed.
:::

## Available Platforms

| Platform | Connection | Description |
|----------|------------|-------------|
| [Telegram](/features/bots/telegram) | Long polling | Use Workflow Operator from Telegram chat, receive notifications, and continue follow-up in the same conversation |
| [Slack](/features/bots/slack) | Socket Mode (WebSocket) | Use Workflow Operator from Slack channels and threads for operational follow-up without leaving chat |
| [Discord](/features/bots/discord) | Gateway (WebSocket) | Use Workflow Operator from Discord channels and DMs with button-driven prompts and inline notifications |
| [LINE](/features/bots/line) | Messaging API webhook | Use Workflow Operator from LINE one-on-one chats, groups, and rooms. Requires a public HTTPS webhook endpoint or a managed instance. |

## Relationship to AI agent

Workflow Operator is built on top of the same built-in steward used in the Web UI.

That means:

- AI agent must be enabled first
- A working default model must exist
- Tool permissions and bash policy still apply
- Provider-specific model issues such as local-model endpoint configuration still matter

Start with [AI agent Settings](/features/agent/settings/), then return here to configure Slack, Telegram, Discord, or LINE.
