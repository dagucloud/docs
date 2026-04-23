# Models & Providers

This page covers the part of `/agent-settings` where you decide whether the built-in agent can run and which models it can use.

## Enable The Agent

The **Enable Agent** toggle turns the built-in Web UI assistant on or off.

You can also enable it through configuration:

```bash
export DAGU_AGENT_ENABLED=true
```

## Models Table

When the agent is enabled, Dagu shows a models table where you can:

- add a model
- edit an existing model
- set the default model
- delete a model

The table helps you compare:

- display name
- provider
- model ID
- whether credentials are ready
- which model is the default

## Default Model

The default model is the one the Web UI agent uses unless you override it in a chat session.

Workflow steps with `type: agent` also fall back to this default unless the step sets its own model.

## Add Or Edit A Model

The form includes these common fields:

| Field | What It Means |
|-------|----------------|
| `Name` | Human-friendly label shown in the UI |
| `ID` | Stable short name for this saved model, used in the UI, config, and API |
| `Provider` | Which model service Dagu should call |
| `Model` | The provider's actual model name or tag |
| `API Key` | Credential for hosted providers; optional for `Local` unless your proxy requires it |
| `Base URL` | Optional endpoint override |
| `Description` | Optional note shown in the UI |
| `Context Window` | Optional capacity metadata |
| `Max Output Tokens` | Optional limit metadata |
| `Input Cost / 1M tokens` | Optional pricing metadata |
| `Output Cost / 1M tokens` | Optional pricing metadata |
| `Supports Thinking` | Whether this model should expose reasoning controls in Dagu |
| `Reasoning Effort` | Default reasoning depth when thinking is enabled |

On creation, Dagu can generate the `ID` from the `Name`. After a model exists, the `ID` is treated as stable.

## Providers In The UI

The provider list may include:

- `Anthropic`
- `OpenAI`
- `OpenAI Codex`
- `Google Gemini`
- `OpenRouter`
- `Local`
- `Z.AI`

Available providers can expand as Dagu adds support for more backends.

## Credential Patterns

Most providers use the **API Key** field.

The main exception is **OpenAI Codex**, which uses a ChatGPT Plus/Pro login flow instead of a raw API key. For that path, see [OpenAI Subscription](/features/agent/settings/openai-subscription).

## Local Models

For Ollama and other local servers:

- choose **Provider** = `Local`
- set **Model** to the exact local model tag
- leave **Base URL** empty or set `http://localhost:11434/v1`

See [Local AI](/features/chat/local-ai) for setup and troubleshooting.

## A Practical Rule

Not every field matters equally for every provider. Focus on the fields your provider actually needs:

- hosted models usually need provider, model, and API key
- local models usually need provider, model, and sometimes base URL
- pricing and context fields mostly help Dagu label and reason about the model in the UI

## Related Pages

- [Settings Overview](/features/agent/settings/)
- [OpenAI Subscription](/features/agent/settings/openai-subscription)
- [Local AI](/features/chat/local-ai)
