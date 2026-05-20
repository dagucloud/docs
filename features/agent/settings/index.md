# AI agent Settings

The **AI agent Settings** page in the Web UI (`/agent-settings`) configures the built-in steward itself.

This is broader than workflow `action: agent.run` or workflow `action: chat.completion` configuration.

It controls:

- The Web UI assistant
- The model registry used by the built-in steward
- Tool permissions and bash command policy from `/agent-tools`
- Model-native web search and provider-backed web tools from `/agent-tools`
- The default profile/personality
- Prerequisites for Workflow Operator on Slack, Telegram, Discord, and LINE

If you are looking for workflow YAML configuration, see [Agent Step](/features/agent/step) and [Chat & LLM](/features/chat/).

## Start Here

The settings surface is split into smaller pages:

- [Models & Providers](/features/agent/settings/models) for enabling AI agent, adding models, choosing a default model, and understanding model fields
- [OpenAI Subscription](/features/agent/settings/openai-subscription) for connecting a ChatGPT subscription and using the `openai-codex` provider
- [OpenCode](/features/chat/opencode) for Kimi, DeepSeek, GLM, Qwen, and other models via an OpenCode subscription
- [Tool Permissions & Bash Policy](/features/agent/settings/controls) for deciding which tools AI agent may use and how bash commands are filtered
- [Web Search](/features/agent/web-search) for selecting model-native search, Tavily, or Firecrawl
- [Personality](/features/agent/settings/behavior) for selecting a default profile

## What This Page Does Not Replace

- It does not replace workflow `action: agent.run` settings in DAG YAML
- It does not replace workflow `action: chat.completion` settings in DAG YAML
- It does not configure chat-bot platform tokens for Slack, Telegram, Discord, or LINE

Those are separate features with their own documentation.

## Recommended Setup Order

1. Enable AI agent
2. Add at least one model
3. Set the default model
4. Review tool permissions and bash command policy
5. Optionally select a default profile
6. Optionally enable web search
7. Only then configure [Workflow Operator (Chat Bot)](/features/bots/)

## Relationship to Workflow Features

### Workflow `action: agent.run`

The settings page does not replace the `agent` workflow step. The `agent` step is a separate DAG feature for running a multi-turn tool-calling loop inside a workflow. See [Agent Step](/features/agent/step).

### Workflow `action: chat.completion`

The settings page also does not replace the `chat` workflow step. `action: chat.completion` is a workflow feature for direct LLM calls in DAGs. See [Chat & LLM](/features/chat/).

### Workflow Operator (Chat Bot)

Workflow Operator depends on the built-in steward being configured first. Slack, Telegram, Discord, and LINE conversations are routed into steward sessions, so AI agent must already have a working model and policy configuration.

See:

- [Workflow Operator (Chat Bot)](/features/bots/)
- [Workflow Operator on Slack](/features/bots/slack)
- [Workflow Operator on Telegram](/features/bots/telegram)
- [Workflow Operator on Discord](/features/bots/discord)
- [Workflow Operator on LINE](/features/bots/line)

## See Also

- [AI agent Overview](/features/agent/)
- [Models & Providers](/features/agent/settings/models)
- [OpenAI Subscription](/features/agent/settings/openai-subscription)
- [Tool Permissions & Bash Policy](/features/agent/settings/controls)
- [Web Search](/features/agent/web-search)
- [Personality](/features/agent/settings/behavior)
- [Local AI](/features/chat/local-ai)
- [OpenCode](/features/chat/opencode)
