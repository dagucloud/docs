# Chat

Execute Large Language Model (LLM) requests to AI providers like OpenAI, Anthropic, Google Gemini, OpenRouter, and local models.

## Basic Usage

```yaml
steps:
  - type: chat
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
| `apiKeyName` | string | (from provider) | Environment variable name for API key |
| `stream` | bool | `true` | Stream response tokens |
| `thinking` | object | (none) | Extended thinking/reasoning configuration |

### Thinking Configuration (`thinking` field)

Enable extended thinking/reasoning mode for more thorough, accurate responses on complex tasks:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | bool | `false` | Enable thinking mode |
| `effort` | string | `medium` | Reasoning depth: `low`, `medium`, `high`, `xhigh` |
| `budgetTokens` | int | (from effort) | Explicit token budget (provider-specific) |
| `includeInOutput` | bool | `false` | Include thinking blocks in stdout |

**Provider Support:**

| Provider | Implementation | Notes |
|----------|---------------|-------|
| Anthropic | `thinking.budget_tokens` | Claude 3.7+, Claude 4 models |
| OpenAI | `reasoning.effort` | o1, o3, GPT-5 models |
| Gemini | `thinkingLevel` / `thinkingBudget` | Gemini 2.5+, Gemini 3 models |
| OpenRouter | Unified `reasoning` | Auto-mapped to underlying provider |
| Local | Not supported | Thinking APIs vary by model; configure natively |

**Effort Level Mapping:**

| Effort | Anthropic Budget | Description |
|--------|-----------------|-------------|
| `low` | 1,024 tokens | Quick reasoning |
| `medium` | 4,096 tokens | Balanced (default) |
| `high` | 16,384 tokens | Thorough analysis |
| `xhigh` | 32,768 tokens | Maximum depth (capped at 32K for Anthropic) |

::: warning
When thinking is enabled for OpenAI reasoning models, `temperature` and `topP` are automatically disabled as these models don't support them.
:::

### Messages (`messages` field)

The `messages` field is a step-level field (not inside `llm`) containing the conversation messages.

| Field | Description |
|-------|-------------|
| `role` | `system`, `user`, or `assistant` |
| `content` | Message text (supports `${VAR}` substitution) |

## DAG-Level Configuration

Define LLM defaults at the DAG level to share configuration across multiple chat steps:

```yaml
# DAG-level defaults (including thinking mode)
llm:
  provider: anthropic
  model: claude-sonnet-4-20250514
  system: "You are a helpful assistant."
  temperature: 0.7
  thinking:
    enabled: true
    effort: medium

steps:
  # This step inherits the DAG-level llm config (including thinking)
  - type: chat
    messages:
      - role: user
        content: "What is 2+2?"

  # This step overrides DAG-level config
  - type: chat
    llm:
      provider: openai
      model: gpt-4o
    messages:
      - role: user
        content: "Different provider and model (no thinking)"
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
  - type: chat
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
  - type: chat
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
  - type: chat
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
  - type: chat
    llm:
      provider: openai
      model: gpt-4o
      baseURL: "https://my-proxy.example.com/v1"
      apiKeyName: CUSTOM_API_KEY
    messages:
      - role: user
        content: "Hello!"
```

### Disable Streaming

```yaml
steps:
  - type: chat
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
  - type: chat
    llm:
      provider: openai
      model: gpt-4o
    messages:
      - role: user
        content: "Generate a JSON object with name and age fields."
    output: CHAT_RESPONSE

  - command: echo "${CHAT_RESPONSE}" | jq '.name'
```

### Temperature Control

```yaml
steps:
  - type: chat
    llm:
      provider: openai
      model: gpt-4o
      temperature: 1.5
    messages:
      - role: user
        content: "Write a creative story opening."

  - type: chat
    llm:
      provider: openai
      model: gpt-4o
      temperature: 0.1
    messages:
      - role: user
        content: "What is the capital of France?"
```

### Extended Thinking Mode

Enable deeper reasoning for complex tasks:

```yaml
steps:
  # Using effort level (recommended)
  - type: chat
    llm:
      provider: anthropic
      model: claude-sonnet-4-20250514
      thinking:
        enabled: true
        effort: high
    messages:
      - role: user
        content: "Analyze the security implications of this code..."

  # Using explicit token budget
  - type: chat
    llm:
      provider: anthropic
      model: claude-sonnet-4-20250514
      thinking:
        enabled: true
        budgetTokens: 16384
    messages:
      - role: user
        content: "Solve this complex optimization problem..."

  # OpenAI reasoning model
  - type: chat
    llm:
      provider: openai
      model: o3
      thinking:
        enabled: true
        effort: high
    messages:
      - role: user
        content: "Prove this mathematical theorem..."
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

## Security

### Secret Masking

Secrets defined in the `secrets` block are automatically masked before messages are sent to LLM providers. This prevents accidental exposure of sensitive values to external AI APIs:

```yaml
secrets:
  - name: API_TOKEN
    provider: env
    key: PROD_API_TOKEN

steps:
  - type: chat
    llm:
      provider: openai
      model: gpt-4o
    messages:
      - role: user
        content: "Check if this token is valid: ${API_TOKEN}"
```

The `${API_TOKEN}` value is substituted in the message content, but the actual secret is replaced with `*******` before being sent to the LLM provider. The saved conversation history retains the original content for debugging.

## Notes

- Use `type: chat` explicitly with LLM configuration in the `llm` field
- The `llm` field is designed to be reusable for future executor types like `agent`
- API keys are read from environment variables by default
- Response tokens are streamed to stdout by default
- The full conversation (inherited + step messages + response) is saved after each step
- Secrets are automatically masked before sending to LLM providers
