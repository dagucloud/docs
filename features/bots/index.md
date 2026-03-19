# Workflow Operator

Workflow Operator is Dagu's persistent AI operator for Slack and Telegram. Slack and Telegram bots act as connectors that map conversations in those platforms to agent sessions, forward messages in both directions, and keep follow-up in the same context.

Only one messaging connector can be active at a time. Technically this is configured via `bots.provider` in the config file or the `DAGU_BOTS_PROVIDER` environment variable.

::: tip Prerequisite
Configure the AI agent first. Go to **Agent Settings** (`/agent-settings`) in the Web UI and set your LLM provider and API key. See [Agent Overview](/features/agent/) for details.
:::

## Available Platforms

| Platform | Connection | Description |
|----------|------------|-------------|
| [Telegram](/features/bots/telegram) | Long polling | Use Workflow Operator from Telegram chat, receive notifications, and continue follow-up in the same conversation |
| [Slack](/features/bots/slack) | Socket Mode (WebSocket) | Use Workflow Operator from Slack channels and threads for operational follow-up without leaving chat |
