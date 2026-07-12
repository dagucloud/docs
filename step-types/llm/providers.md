# Providers & Endpoints

Configure provider credentials, custom endpoints, local models, and shared LLM defaults for `action: chat.completion`.

## Providers and Credentials

By default, Dagu reads credentials from the provider's standard environment variable:

| Provider | API key environment variable |
|----------|------------------------------|
| `openai` | `OPENAI_API_KEY` |
| `anthropic` | `ANTHROPIC_API_KEY` |
| `gemini` | `GOOGLE_API_KEY` |
| `openrouter` | `OPENROUTER_API_KEY` |
| `zai` | `ZAI_API_KEY` |
| `opencode` | `OPENCODE_API_KEY` |
| `local` | None |

Provider aliases include `google` for `gemini`; `ollama`, `vllm`, and `llama` for `local`; and `zhipu`, `zhipuai`, and `glm` for `zai`.

Use `api_key_name` when the credential is stored under another environment variable. Use `base_url` for a proxy or a compatible local endpoint.

## OpenAI-Compatible Endpoints

Prefer a native provider when Dagu supports it. For example, OpenRouter has its own provider, default endpoint, credential name, reasoning mapping, and web-search integration:

```yaml
steps:
  - id: summarize
    action: chat.completion
    with:
      provider: openrouter
      model: anthropic/claude-sonnet-4
      prompt: |
        Summarize the incident report.
```

This configuration uses `https://openrouter.ai/api/v1` and reads the API key from `OPENROUTER_API_KEY`; neither `base_url` nor `api_key_name` is required.

For another gateway, proxy, or hosted service that implements OpenAI's Chat Completions API, use the `openai` provider with a custom endpoint:

```yaml
steps:
  - id: summarize
    action: chat.completion
    with:
      provider: openai
      model: vendor/model-name
      base_url: https://gateway.example.com/v1
      api_key_name: GATEWAY_API_KEY
      prompt: |
        Summarize the incident report.
```

`base_url` is the API root, not the full completion endpoint. Include any required version prefix, such as `/v1`, and omit the trailing slash because Dagu appends `/chat/completions`. The model identifier is passed to the endpoint unchanged.

`api_key_name` contains the name of an environment variable, not the credential value. In the example, the Dagu process must have access to `GATEWAY_API_KEY`.

OpenAI compatibility varies between services. Basic completions may work while streaming, tool calls, reasoning fields, web search, or usage metadata do not. Use the native provider when one exists so Dagu can apply provider-specific request and response handling.

For an OpenAI-compatible server that does not require a key, use the `local` provider:

```yaml
steps:
  - id: summarize
    action: chat.completion
    with:
      provider: local
      model: llama3.2
      base_url: http://localhost:11434/v1
      prompt: |
        Summarize the incident report.
```

## DAG-Level Defaults

Put shared model settings in the top-level `llm` block:

```yaml
llm:
  provider: openai
  model: gpt-4o
  temperature: 0.2

steps:
  - id: summarize
    action: chat.completion
    with:
      prompt: |
        Summarize today's run failures.
```

If an action sets any LLM configuration field under `with`, its action-level LLM configuration replaces the complete top-level `llm` configuration. Include `provider` and `model` in that action unless `model` is a fallback array with a provider on each entry.

## Related

- [LLM Completion](/step-types/llm/) for basic usage and the configuration reference
- [Local AI](/features/chat/local-ai) for Ollama and other OpenAI-compatible local servers
- [OpenCode](/features/chat/opencode) for OpenCode setup and models
- [Reasoning & Web Search](/step-types/llm/reasoning-web-search) for provider-specific capabilities

