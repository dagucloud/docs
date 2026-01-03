# Chat Executor

Execute Large Language Model (LLM) requests to AI providers like OpenAI, Anthropic, Google Gemini, OpenRouter, and local models.

## Basic Usage

```yaml
steps:
  - name: ask-question
    type: chat
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

### LLM Configuration (`llm` field)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `provider` | string | (required) | LLM provider to use |
| `model` | string | (required) | Model identifier |
| `system` | string | (none) | Default system prompt |
| `temperature` | float | (provider default) | Randomness (0.0-2.0) |
| `maxTokens` | int | (provider default) | Maximum tokens to generate |
| `topP` | float | (provider default) | Nucleus sampling (0.0-1.0) |
| `baseURL` | string | (provider default) | Custom API endpoint |
| `apiKey` | string | (from env) | API key override |
| `stream` | bool | `true` | Stream response tokens |

### Messages (`messages` field)

The `messages` field is a step-level field (not inside `llm`) containing the conversation messages.

| Field | Description |
|-------|-------------|
| `role` | `system`, `user`, or `assistant` |
| `content` | Message text (supports `${VAR}` substitution) |

## DAG-Level Configuration

Define LLM defaults at the DAG level to share configuration across multiple chat steps:

```yaml
# DAG-level defaults
llm:
  provider: openai
  model: gpt-4o
  system: "You are a helpful assistant."
  temperature: 0.7

steps:
  # This step inherits the DAG-level llm config
  - name: ask1
    type: chat
    messages:
      - role: user
        content: "What is 2+2?"

  # This step overrides DAG-level config
  - name: ask2
    type: chat
    llm:
      provider: anthropic
      model: claude-sonnet-4-20250514
    messages:
      - role: user
        content: "Different provider and model"
```

::: warning Full Override Pattern
When a step specifies `llm:`, it **completely replaces** the DAG-level configuration. There is no field-level merging - the step must provide all required fields (provider, model).
:::

### Inheritance with Base DAG

DAG-level `llm` configuration also works with base DAG inheritance:

```yaml
# ~/.config/dagu/base.yaml
llm:
  provider: openai
  model: gpt-4o
  temperature: 0.5
```

All DAGs using this base config will inherit the LLM defaults.

## Examples

### Using Secrets

```yaml
secrets:
  - name: OPENAI_API_KEY
    provider: env
    key: OPENAI_API_KEY

steps:
  - name: generate
    type: chat
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
    type: chat
    llm:
      provider: anthropic
      model: claude-sonnet-4-20250514
    messages:
      - role: user
        content: "Explain ${TOPIC} in ${LANGUAGE}."
```

### Multi-turn Conversation

Steps automatically inherit conversation history from their dependencies:

```yaml
type: graph

steps:
  - name: setup
    type: chat
    llm:
      provider: openai
      model: gpt-4o
      system: "You are a math tutor."
    messages:
      - role: user
        content: "What is 2+2?"

  - name: followup
    depends: [setup]
    type: chat
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

### Local Model (Ollama)

```yaml
steps:
  - name: local-inference
    type: chat
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
    type: chat
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
    type: chat
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
    type: chat
    llm:
      provider: openai
      model: gpt-4o
    messages:
      - role: user
        content: "Generate a JSON object with name and age fields."
    output: CHAT_RESPONSE

  - name: process
    command: echo "${CHAT_RESPONSE}" | jq '.name'
```

### Temperature Control

```yaml
steps:
  - name: creative
    type: chat
    llm:
      provider: openai
      model: gpt-4o
      temperature: 1.5
    messages:
      - role: user
        content: "Write a creative story opening."

  - name: precise
    type: chat
    llm:
      provider: openai
      model: gpt-4o
      temperature: 0.1
    messages:
      - role: user
        content: "What is the capital of France?"
```

## Error Handling

The chat executor automatically retries on transient errors:

- **Timeout**: 5 minutes per request
- **Max retries**: 3
- **Initial retry interval**: 1 second
- **Max retry interval**: 30 seconds
- **Backoff multiplier**: 2.0

Retryable errors include rate limits (429), server errors (5xx), and network timeouts.

## Saved Message Format

Conversations are persisted with metadata:

```json
[
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
```

Metadata is only attached to assistant responses and includes:
- `provider`: The LLM provider used
- `model`: The model identifier
- `promptTokens`, `completionTokens`, `totalTokens`: Token usage statistics

## Notes

- Use `type: chat` explicitly with LLM configuration in the `llm` field
- The `llm` field is designed to be reusable for future executor types like `agent`
- API keys are read from environment variables by default
- Response tokens are streamed to stdout by default
- The full conversation (inherited + step messages + response) is saved after each step
