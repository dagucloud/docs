# Agent Settings

The **Agent Settings** page in the Web UI (`/agent-settings`) configures the built-in AI agent itself.

This is broader than workflow `type: agent` or workflow `type: chat` configuration.

It controls:

- The Web UI assistant
- The model registry used by the built-in agent
- Tool permissions and bash command policy
- Provider-native web search for agent sessions
- The default soul/personality
- Prerequisites for Workflow Operator on Slack and Telegram

If you are looking for workflow YAML configuration, see [Agent Step](/features/agent/step) and [Chat & LLM](/features/chat/).

## Start Here

The settings surface is split into smaller pages:

- [Models & Providers](/features/agent/settings/models) for enabling the built-in agent, adding models, choosing a default model, and understanding model fields
- [OpenAI Subscription](/features/agent/settings/openai-subscription) for connecting a ChatGPT subscription and using the `openai-codex` provider
- [Tool Permissions & Bash Policy](/features/agent/settings/controls) for deciding which tools the agent may use and how bash commands are filtered
- [Personality & Web Search](/features/agent/settings/behavior) for selecting a default soul and enabling provider-native web search

## What This Page Does Not Replace

- It does not replace workflow `type: agent` settings in DAG YAML
- It does not replace workflow `type: chat` settings in DAG YAML
- It does not configure chat-bot platform tokens for Slack or Telegram

Those are separate features with their own documentation.

## Recommended Setup Order

1. Enable the built-in agent
2. Add at least one model
3. Set the default model
4. Review tool permissions and bash command policy
5. Optionally select a default soul
6. Optionally enable provider-native web search
7. Only then configure [Workflow Operator (Chat Bot)](/features/bots/)

## Relationship to Workflow Features

### Workflow `type: agent`

The settings page does not replace the `agent` workflow step. The `agent` step is a separate DAG feature for running a multi-turn tool-calling loop inside a workflow. See [Agent Step](/features/agent/step).

### Workflow `type: chat`

The settings page also does not replace the `chat` workflow step. `type: chat` is a workflow feature for direct LLM calls in DAGs. See [Chat & LLM](/features/chat/).

### Workflow Operator (Chat Bot)

Workflow Operator depends on the built-in AI agent being configured first. Slack and Telegram conversations are routed into agent sessions, so the agent must already have a working model and policy configuration.

See:

- [Workflow Operator (Chat Bot)](/features/bots/)
- [Workflow Operator on Slack](/features/bots/slack)
- [Workflow Operator on Telegram](/features/bots/telegram)

## See Also

- [AI Agent Overview](/features/agent/)
- [Models & Providers](/features/agent/settings/models)
- [OpenAI Subscription](/features/agent/settings/openai-subscription)
- [Tool Permissions & Bash Policy](/features/agent/settings/controls)
- [Personality & Web Search](/features/agent/settings/behavior)
- [Local AI](/features/chat/local-ai)
