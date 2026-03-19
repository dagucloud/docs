# Bots

Dagu can run bots that bridge external messaging platforms with the built-in AI agent. Each bot maps conversations in the external platform to agent sessions, forwarding messages in both directions.

Only one bot provider can be active at a time, configured via `bots.provider` in the config file or the `DAGU_BOTS_PROVIDER` environment variable.

::: tip Prerequisite
Configure the AI agent first. Go to **Agent Settings** (`/agent-settings`) in the Web UI and set your LLM provider and API key. See [Agent Overview](/features/agent/) for details.
:::

## Available Bots

| Bot | Platform | Connection | Description |
|-----|----------|------------|-------------|
| [Telegram](/features/bots/telegram) | Telegram | Long polling | Interact with the Dagu AI agent via Telegram chat |
| [Slack](/features/bots/slack) | Slack | Socket Mode (WebSocket) | Interact with the Dagu AI agent via Slack channels |
