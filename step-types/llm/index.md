# LLM Completion

Send a prompt or message list to a large language model with `action: chat.completion`.

The response is written to stdout, so it can be viewed in the run log or [captured for later steps](/step-types/llm/outputs).

## Basic Usage

Use `prompt` for a single user message:

```yaml
steps:
  - id: summarize
    action: chat.completion
    with:
      provider: openai
      model: gpt-4o
      prompt: |
        Summarize the main causes of database connection exhaustion.
    output: SUMMARY
```

`SUMMARY` is a flat output variable. A dependent step can read it as `${SUMMARY}`. See [Outputs & Routing](/step-types/llm/outputs) for downstream steps, artifacts, and switch-style routing.

Use `messages` when the request needs an explicit system prompt or conversation:

```yaml
steps:
  - id: diagnose
    action: chat.completion
    with:
      provider: anthropic
      model: claude-sonnet-4-6
      system: |
        Answer as a concise operations runbook author.
      messages:
        - role: user
          content: |
            Explain how to diagnose a saturated connection pool.
```

Specify either `prompt` or `messages`. `prompt` is converted to one `user` message. If both fields are present, `prompt` takes precedence. Message roles can be `system`, `user`, or `assistant`.

## Configuration

All action-specific fields belong under `with`.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `prompt` | string | — | A non-empty user prompt. Required when `messages` is omitted. |
| `messages` | array | — | A non-empty list of `{role, content}` messages. Required when `prompt` is omitted. |
| `provider` | string | inherited | LLM provider. Required for a string `model` unless inherited; omit it when every fallback model entry has its own provider. |
| `model` | string or array | inherited | Model identifier, or an ordered list of model configurations for [fallback](/step-types/llm/reliability#model-fallback). Inherited only when the action sets no LLM configuration fields. |
| `system` | string | — | Default system prompt. An explicit system message in `messages` takes precedence. |
| `temperature` | number | provider default | Sampling randomness from `0.0` to `2.0`. |
| `max_tokens` | integer | provider default | Maximum number of tokens to generate. |
| `top_p` | number | provider default | Nucleus sampling value from `0.0` to `1.0`. |
| `base_url` | string | provider default | Base URL for a [custom or OpenAI-compatible endpoint](/step-types/llm/providers#openai-compatible-endpoints). |
| `api_key_name` | string | provider default | Environment variable that contains the API key. |
| `stream` | boolean | `true` | Stream response tokens to stdout as they arrive. |
| `thinking` | object | disabled | Provider-specific [extended reasoning](/step-types/llm/reasoning-web-search#reasoning). |
| `tools` | array | — | DAG names exposed to the model as callable tools. |
| `max_tool_iterations` | integer | `10` | Maximum tool-calling rounds. |
| `web_search` | object | disabled | [Built-in web-search integration](/step-types/llm/reasoning-web-search#web-search) settings. |

`messages[].content`, `system`, and `base_url` support scoped value references such as `${params.TOPIC}` and `${env.LLM_BASE_URL}`.

## Security

Values registered as Dagu secrets are masked before messages are sent to the provider. The run's saved session retains the resolved message content, so avoid placing unnecessary secrets in prompts and restrict access to run history.

## Next Steps

- [Providers & Endpoints](/step-types/llm/providers) for credentials, OpenRouter, local models, custom endpoints, and shared defaults
- [Reliability](/step-types/llm/reliability) for model fallback and failure retries
- [Outputs & Routing](/step-types/llm/outputs) for consuming responses, artifacts, sessions, and conditional branches
- [Reasoning & Web Search](/step-types/llm/reasoning-web-search) for model reasoning and provider search capabilities
- [Tool Calling](/features/chat/tool-calling) for exposing DAGs as model tools

