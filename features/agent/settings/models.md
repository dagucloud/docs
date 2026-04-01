# Models & Providers

This page covers the parts of `/agent-settings` that decide whether the built-in agent can run and which model it uses.

## Enable Agent

The **Enable Agent** toggle turns the built-in Web UI assistant on or off.

This is also exposed through the environment variable:

```bash
export DAGU_AGENT_ENABLED=true
```

When the agent is disabled, the built-in chat UI is off and the **Models** table is hidden in the current Web UI.

## Models Table

When the built-in agent is enabled, the page shows a **Models** table and an **Add Model** action.

The table shows:

- `Name`
- `ID`
- `Provider`
- `Model`
- Whether an API key is configured
- Which model is the default

From the row menu, you can:

- Edit a model
- Set a model as the default
- Delete a model

## Default Model

One model can be marked as the default. The Web UI agent uses that model unless the user overrides it in the chat UI.

The workflow `type: agent` step also falls back to this default model unless the step explicitly sets `agent.model`.

## Add / Edit Model Fields

The current Web UI form includes these fields:

| Field | Meaning |
|---|---|
| `Name` | Human-readable display name |
| `ID` | Stable internal identifier used by Dagu |
| `Provider` | Backend provider implementation |
| `Model` | Provider-specific model identifier |
| `API Key` | Credential for hosted providers; optional for `local` unless your proxy requires one |
| `Base URL` | Custom endpoint override |
| `Description` | Optional UI description |
| `Context Window` | Optional model metadata |
| `Max Output Tokens` | Optional model metadata |
| `Input Cost / 1M tokens` | Optional pricing metadata |
| `Output Cost / 1M tokens` | Optional pricing metadata |
| `Supports Thinking` | Optional capability metadata |

## ID Behavior

On model creation, the UI auto-generates the `ID` from the `Name` unless you override it.

In the current edit form, the `ID` is read-only after the model is created.

## Provider Choices in the Current UI

The current Web UI provider dropdown offers:

- `Anthropic`
- `OpenAI`
- `OpenAI Codex`
- `Google Gemini`
- `OpenRouter`
- `Local`
- `Z.AI`

If presets are available, the create form also shows **Import from Preset**.

For the subscription-backed `OpenAI Codex` path, see [OpenAI Subscription](/features/agent/settings/openai-subscription).

## Local Models

For Ollama and other local servers, choose the `Local` provider in the UI.

Important details:

- `Base URL` is a base prefix, not a full endpoint
- If `Base URL` is left empty, Dagu defaults to `http://localhost:11434/v1`
- Dagu's local provider appends `/chat/completions`
- Dagu does not call Ollama's native `/api/generate` endpoint from this path

That means these values are correct for a typical local Ollama setup:

- `Provider`: `Local`
- `Model`: your installed model tag such as `qwen3.5` or `qwen3.5:latest`
- `Base URL`: empty, or `http://localhost:11434/v1`

See [Local AI](/features/chat/local-ai) for exact endpoint behavior and troubleshooting.

## What These Fields Mean in Practice

Not every saved field is guaranteed to become a provider request parameter in every runtime path.

For example:

- `Base URL` changes where requests are sent
- Pricing fields are stored as model metadata used by Dagu
- Some fields are capability or UI metadata rather than provider-native knobs

When the exact runtime behavior matters, use the provider-specific documentation for that path. For local models, see [Local AI](/features/chat/local-ai).

## See Also

- [Agent Settings](/features/agent/settings/)
- [OpenAI Subscription](/features/agent/settings/openai-subscription)
- [Tool Permissions & Bash Policy](/features/agent/settings/controls)
- [Personality & Web Search](/features/agent/settings/behavior)
- [Local AI](/features/chat/local-ai)
