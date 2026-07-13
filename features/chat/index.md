# Chat & LLM

Dagu can call language models from workflows, let models invoke DAGs as tools, or run external agent CLIs. This section helps choose the right approach; exact `chat.completion` syntax lives in the [LLM action reference](/step-types/llm/).

## Choose an Approach

| Goal | Use |
|------|-----|
| Send prompts or message lists directly to a model provider | [`chat.completion`](/step-types/llm/) |
| Let a model call DAG workflows as functions | [Tool Calling](/features/chat/tool-calling) |
| Run an external coding-agent CLI inside a workflow | [`harness.run`](/step-types/harness/) |
| Let an external AI client inspect and operate Dagu | [MCP Server](/mcp/) |

## LLM Completions

Use `action: chat.completion` for provider API calls, multi-turn sessions, model fallback, reasoning, web search, and response routing.

- [LLM Completion](/step-types/llm/) — quick start and complete field reference
- [Providers & Endpoints](/step-types/llm/providers) — credentials, shared defaults, and compatible endpoints
- [Local Models](/step-types/llm/local-models) — Ollama, vLLM, and LM Studio
- [OpenCode](/step-types/llm/opencode) — OpenCode provider setup
- [Outputs & Routing](/step-types/llm/outputs) — sessions, captured responses, artifacts, and branching
- [Reasoning & Web Search](/step-types/llm/reasoning-web-search) — provider reasoning and search capabilities
- [Reliability](/step-types/llm/reliability) — provider retries and model fallback

## Agents and Tools

[Tool calling](/features/chat/tool-calling) turns selected DAGs into functions that a model can invoke during a completion. Use it when the model should choose and sequence workflow operations.

Use [`harness.run`](/step-types/harness/) instead when the workflow should launch an external agent such as Claude Code, Codex, Copilot, or OpenCode. Use the [MCP server](/mcp/) for the inverse relationship: an external AI client connects to Dagu and operates workflows through Dagu's tools and resources.
