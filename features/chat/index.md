# Chat & LLM

::: tip
[AI Overview](/ai/) compares Dagu's model-powered workflow and external-client surfaces. This page covers the completion-focused subset.
:::

Dagu can call language models from workflows, let models invoke DAGs as tools, or run external agent CLIs. This section helps choose the right approach; exact `chat.completion` syntax lives in the [LLM action reference](/step-types/llm/).

## Choose an Approach

| Goal | Use |
|------|-----|
| Send prompts or message lists directly to a model provider | [`chat.completion`](/step-types/llm/) |
| Let a model call DAG workflows as functions | [Tool Calling](/features/chat/tool-calling) |
| Let a model decide which step runs next until stated goals are met | [Agent DAGs](/writing-workflows/agent) |
| Run an external coding-agent CLI inside a workflow | [`harness.run`](/step-types/harness/) |
| Let an external AI client inspect and operate Dagu | [MCP Server](/mcp/) |

## LLM Completions

Use `action: chat.completion` for provider API calls, multi-turn sessions, model fallback, reasoning, web search, and response routing.

- [LLM Completion](/step-types/llm/): quick start and complete field reference
- [Providers & Endpoints](/step-types/llm/providers): credentials, shared defaults, and compatible endpoints
- [Local Models](/step-types/llm/local-models): Ollama, vLLM, and LM Studio
- [Agent DAGs & Completions](/step-types/llm/agent-completions): the step-by-step path from one completion to LLM-directed workflows
- [Reasoning & Web Search](/step-types/llm/reasoning-web-search): provider reasoning and search capabilities
- [Reliability](/step-types/llm/reliability): provider retries and model fallback

## Agents and Tools

[Tool calling](/features/chat/tool-calling) turns selected DAGs into functions that a model can invoke during a completion. Use it when the model should choose and sequence workflow operations.

[Agent DAGs](/writing-workflows/agent) go one step further: `type: agent` makes the model the scheduler, picking one or more independent declared steps per turn until every stated goal is settled. The [Agent DAG examples](/writing-workflows/examples/agent) build the feature up capability by capability.

Use [`harness.run`](/step-types/harness/) instead when the workflow should launch a supported external coding-agent CLI such as Claude Code, Codex, Gemini CLI, Cursor, or DeepSeek Harness. Use the [MCP server](/mcp/) for the inverse relationship: an external AI client connects to Dagu and operates workflows through Dagu's tools and resources.
