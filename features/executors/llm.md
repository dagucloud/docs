# LLM Executor

Execute Large Language Model (LLM) requests to AI providers like OpenAI, Anthropic, Google Gemini, OpenRouter, and local models.

## Basic Usage

```yaml
steps:
  - name: ask-question
    llm:
      provider: openai
      model: gpt-4o
      messages:
        - role: user
          content: "What is 2+2?"
    output: ANSWER
```

## Providers

| Provider | Environment Variable | Default Base URL |
|----------|---------------------|------------------|
| `openai` | `OPENAI_API_KEY` | `https://api.openai.com/v1` |
| `anthropic` | `ANTHROPIC_API_KEY` | `https://api.anthropic.com` |
| `gemini` | `GOOGLE_API_KEY` | `https://generativelanguage.googleapis.com/v1beta` |
| `openrouter` | `OPENROUTER_API_KEY` | `https://openrouter.ai/api/v1` |
| `local` | (none) | `http://localhost:11434/v1` |

::: tip
The `local` provider works with any OpenAI-compatible API including Ollama, vLLM, and LM Studio. Provider aliases `ollama`, `vllm`, and `llama` also map to `local`.
:::

## Configuration

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `provider` | string | `openai` | LLM provider to use |
| `model` | string | (required) | Model identifier |
| `messages` | array | `[]` | Messages to send |
| `temperature` | float | (provider default) | Randomness (0.0-2.0) |
| `maxTokens` | int | (provider default) | Maximum tokens to generate |
| `topP` | float | (provider default) | Nucleus sampling (0.0-1.0) |
| `baseURL` | string | (provider default) | Custom API endpoint |
| `apiKey` | string | (from env) | API key override |
| `history` | bool | `true` | Inherit messages from dependencies |
| `stream` | bool | `true` | Stream response tokens |

### Message Format

| Field | Description |
|-------|-------------|
| `role` | `system`, `user`, or `assistant` |
| `content` | Message text (supports `${VAR}` substitution) |

## Examples

### Using Secrets

```yaml
secrets:
  - name: OPENAI_API_KEY
    provider: env
    key: OPENAI_API_KEY

steps:
  - name: generate
    llm:
      provider: openai
      model: gpt-4o
      messages:
        - role: user
          content: "Explain quantum computing briefly."
```

### Variable Substitution

Message content supports variable substitution with `${VAR}` syntax:

```yaml
params:
  - TOPIC: "machine learning"
  - LANGUAGE: "Spanish"

steps:
  - name: translate
    llm:
      provider: anthropic
      model: claude-sonnet-4-20250514
      messages:
        - role: user
          content: "Explain ${TOPIC} in ${LANGUAGE}."
```

### Multi-turn Conversation

When `history: true` (default), steps inherit conversation history from their dependencies:

```yaml
type: graph

steps:
  - name: setup
    llm:
      provider: openai
      model: gpt-4o
      messages:
        - role: system
          content: "You are a math tutor."
        - role: user
          content: "What is 2+2?"

  - name: followup
    depends: [setup]
    llm:
      provider: openai
      model: gpt-4o
      messages:
        - role: user
          content: "Now multiply that by 3."
```

The `followup` step receives the full conversation history from `setup`, including the assistant's response.

::: info Message Inheritance Rules
- **Transitive history**: Each step saves its complete conversation (inherited + own + response). When step C depends on B which depends on A, C receives all messages from A→B→C.
- **Multiple dependencies**: Messages are merged in the order listed in `depends`. Example: `depends: [step1, step2]` merges step1's history first, then step2's.
- **System message deduplication**: Only the **first** system message is kept. Later system messages from dependencies or the step itself are discarded.
- **Retry persistence**: Messages are stored at the DAG run level (not per-attempt), so conversation history survives retries. If step A succeeds and step B fails, retrying will allow step B to access step A's messages.
:::

### Disable History

Set `history: false` to start a fresh conversation:

```yaml
steps:
  - name: independent
    depends: [previous-step]
    llm:
      provider: openai
      model: gpt-4o
      history: false
      messages:
        - role: user
          content: "This is a new conversation."
```

### Local Model (Ollama)

```yaml
steps:
  - name: local-inference
    llm:
      provider: local
      model: llama3
      messages:
        - role: user
          content: "Hello!"
```

### Custom Endpoint

```yaml
steps:
  - name: custom-api
    llm:
      provider: openai
      model: gpt-4o
      baseURL: "https://my-proxy.example.com/v1"
      apiKey: "${CUSTOM_API_KEY}"
      messages:
        - role: user
          content: "Hello!"
```

### Disable Streaming

```yaml
steps:
  - name: no-stream
    llm:
      provider: openai
      model: gpt-4o
      stream: false
      messages:
        - role: user
          content: "Generate a haiku."
```

### Capture Output

The response is written to stdout and can be captured with `output`:

```yaml
steps:
  - name: generate
    llm:
      provider: openai
      model: gpt-4o
      messages:
        - role: user
          content: "Generate a JSON object with name and age fields."
    output: LLM_RESPONSE

  - name: process
    command: echo "${LLM_RESPONSE}" | jq '.name'
```

### Temperature Control

```yaml
steps:
  - name: creative
    llm:
      provider: openai
      model: gpt-4o
      temperature: 1.5
      messages:
        - role: user
          content: "Write a creative story opening."

  - name: precise
    llm:
      provider: openai
      model: gpt-4o
      temperature: 0.1
      messages:
        - role: user
          content: "What is the capital of France?"
```

## Error Handling

The LLM executor automatically retries on transient errors:

- **Timeout**: 5 minutes per request
- **Max retries**: 3
- **Initial retry interval**: 1 second
- **Max retry interval**: 30 seconds
- **Backoff multiplier**: 2.0

Retryable errors include rate limits (429), server errors (5xx), and network timeouts.

## Saved Message Format

When `history: true`, conversations are persisted with metadata:

```json
{
  "steps": {
    "ask": [
      {"role": "user", "content": "What is 2+2?"},
      {
        "role": "assistant",
        "content": "4",
        "metadata": {
          "provider": "openai",
          "model": "gpt-4o",
          "promptTokens": 12,
          "completionTokens": 1,
          "totalTokens": 13
        }
      }
    ]
  }
}
```

Metadata is only attached to assistant responses and includes:
- `provider`: The LLM provider used
- `model`: The model identifier
- `promptTokens`, `completionTokens`, `totalTokens`: Token usage statistics

::: tip
Messages are always saved regardless of the `history` setting:
- `history: true` - Saves full conversation (inherited + step messages + response)
- `history: false` - Saves only this step's messages + response (no inherited messages)
:::

## Notes

- The executor type is inferred from the `llm` field (no need for `type: llm`)
- Configuration goes in the `llm` field, not in `executor.config`
- API keys are read from environment variables by default
- Response tokens are streamed to stdout by default
- The full conversation (including response) is saved when `history: true`
