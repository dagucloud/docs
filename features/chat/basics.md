# Basic Chat

Execute Large Language Model (LLM) requests to AI providers like OpenAI, Anthropic, Google Gemini, OpenRouter, Z.AI, and local models.

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
| `zai` | `ZAI_API_KEY` | `https://api.z.ai/api/paas/v4` |
| `local` | (none) | `http://localhost:11434/v1` |

::: tip
The `local` provider works with any OpenAI-compatible API including Ollama, vLLM, and LM Studio. Provider aliases `ollama`, `vllm`, and `llama` also map to `local`.
:::

For detailed setup and troubleshooting, especially for Ollama base URLs and Web UI agent configuration, see [Local AI](/features/chat/local-ai).

## Configuration

### LLM Configuration (`llm` field)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `provider` | string | (required*) | LLM provider to use |
| `model` | string or array | (required*) | Model identifier or array of models for fallback |
| `system` | string | (none) | Default system prompt |
| `temperature` | float | (provider default) | Randomness (0.0-2.0) |
| `max_tokens` | int | (provider default) | Maximum tokens to generate |
| `top_p` | float | (provider default) | Nucleus sampling (0.0-1.0) |
| `base_url` | string | (provider default) | Custom API endpoint |
| `api_key_name` | string | (from provider) | Environment variable name for API key |
| `stream` | bool | `true` | Stream response tokens |
| `thinking` | object | (none) | Extended thinking/reasoning configuration |

\* When using model array, `provider` is specified per model entry instead of at the top level. See [Model Fallback](#model-fallback) for details.

### Thinking Configuration (`thinking` field)

Enable extended thinking/reasoning mode for more thorough, accurate responses on complex tasks:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | bool | `false` | Enable thinking mode |
| `effort` | string | `medium` | Reasoning depth: `low`, `medium`, `high`, `xhigh` |
| `budget_tokens` | int | (from effort) | Explicit token budget (provider-specific) |
| `include_in_output` | bool | `false` | Include thinking blocks in stdout |

**Provider Support:**

| Provider | Implementation | Notes |
|----------|---------------|-------|
| Anthropic | `thinking.budget_tokens` | Claude 3.7+, Claude 4 models |
| OpenAI | `reasoning.effort` | o1, o3, GPT-5 models |
| Gemini | `thinkingLevel` / `thinkingBudget` | Gemini 2.5+, Gemini 3 models |
| OpenRouter | Unified `reasoning` | Auto-mapped to underlying provider |
| Local | Not currently serialized by Dagu's local provider | Some local servers now document reasoning controls, but Dagu's current local-provider request builder sends standard chat-completions fields only |

**Effort Level Mapping:**

| Effort | Anthropic Budget | Description |
|--------|-----------------|-------------|
| `low` | 1,024 tokens | Quick reasoning |
| `medium` | 4,096 tokens | Balanced (default) |
| `high` | 16,384 tokens | Thorough analysis |
| `xhigh` | 32,768 tokens | Maximum depth (capped at 32K for Anthropic) |

::: warning
When thinking is enabled for OpenAI reasoning models, `temperature` and `top_p` are automatically disabled as these models don't support them.
:::

### Messages (`messages` field)

The `messages` field is a step-level field (not inside `llm`) containing the session messages.

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

### Multi-turn Session

Steps automatically inherit session history from their dependencies:

```yaml
type: graph

steps:
  - id: setup
    type: chat
    llm:
      provider: openai
      model: gpt-4o
      system: "You are a math tutor."
    messages:
      - role: user
        content: "What is 2+2?"

  - id: followup
    depends: [setup]
    type: chat
    llm:
      provider: openai
      model: gpt-4o
    messages:
      - role: user
        content: "Now multiply that by 3."
```

The `followup` step receives the full session history from `setup`, including the assistant's response.

::: info Message Inheritance Rules
- **Transitive history**: Each step saves its complete session (inherited + own + response). When step C depends on B which depends on A, C receives all messages from A→B→C.
- **Multiple dependencies**: Messages are merged in the order listed in `depends`. Example: `depends: [step1, step2]` merges step1's history first, then step2's.
- **System message deduplication**: Only the **first** system message is kept. Later system messages from dependencies or the step itself are discarded.
- **Retry-safe history**: Conversation history stays attached to the DAG run, so a retry can continue with the earlier context instead of starting from scratch.
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

See [Local AI](/features/chat/local-ai) for the correct Ollama `base_url`, current limitations, and common `404` causes.

### Custom Endpoint

```yaml
steps:
  - type: chat
    llm:
      provider: openai
      model: gpt-4o
      base_url: "https://my-proxy.example.com/v1"
      api_key_name: CUSTOM_API_KEY
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
        budget_tokens: 16384
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

### Conditional Routing

Use a chat step to classify input, then route based on the response:

```yaml
type: graph

steps:
  - id: classify
    type: chat
    llm:
      provider: openai
      model: gpt-4o
      system: "Classify the request. Reply with exactly: bug, feature, or question"
    messages:
      - role: user
        content: "${USER_REQUEST}"
    output: TYPE

  - id: route
    type: router
    depends: [classify]
    value: ${TYPE}
    routes:
      "bug": [handle_bug]
      "feature": [handle_feature]
      "question": [handle_question]

  - id: handle_bug
    type: chat
    llm:
      provider: anthropic
      model: claude-sonnet-4-20250514
      system: "You are a debugging expert."
    messages:
      - role: user
        content: "${USER_REQUEST}"

  - id: handle_feature
    type: chat
    llm:
      provider: anthropic
      model: claude-sonnet-4-20250514
      system: "You are a product designer."
    messages:
      - role: user
        content: "${USER_REQUEST}"

  - id: handle_question
    type: chat
    llm:
      provider: anthropic
      model: claude-sonnet-4-20250514
      system: "You are a helpful assistant."
    messages:
      - role: user
        content: "${USER_REQUEST}"
```

The `classify` step analyzes the request and outputs a category. The router then executes only the matching handler.

## Error Handling

The chat executor automatically retries on transient errors:

- **Timeout**: 5 minutes per request
- **Max retries**: 3
- **Initial retry interval**: 1 second
- **Max retry interval**: 30 seconds
- **Backoff multiplier**: 2.0

Retryable errors include rate limits (429), server errors (5xx), and network timeouts.

## Model Fallback

Use an array of model objects instead of a single model string:

```yaml
llm:
  temperature: 0.7
  max_tokens: 4096
  model:
    - provider: openai
      name: gpt-4o
    - provider: anthropic
      name: claude-sonnet-4-20250514
    - provider: local
      name: llama3.1:8b
      base_url: http://localhost:11434/v1

steps:
  - type: chat
    messages:
      - role: user
        content: "What is the capital of France?"
```

First model is primary, rest are fallbacks tried in order on any error. Shared config (`temperature`, `max_tokens`, `top_p`) applies to all models.

### Per-Model Overrides

Shared `llm` config applies to all models. Override per model when needed (e.g., different token limits):

```yaml
llm:
  temperature: 0.7
  max_tokens: 4096
  model:
    - provider: openai
      name: gpt-4o
      max_tokens: 8192  # GPT-4o supports larger context
    - provider: anthropic
      name: claude-sonnet-4-20250514
      # Uses shared max_tokens=4096
    - provider: local
      name: llama3.1:8b
      max_tokens: 2048  # Local model has smaller context window
      temperature: 0.5
      base_url: http://localhost:11434/v1
```

### Model Entry Fields

| Field | Type | Description |
|-------|------|-------------|
| `provider` | string | Required. LLM provider (openai, anthropic, gemini, etc.) |
| `name` | string | Required. Model name (e.g., gpt-4o, claude-sonnet-4-20250514) |
| `temperature` | float | Override temperature for this model |
| `max_tokens` | int | Override max_tokens for this model |
| `top_p` | float | Override top_p for this model |
| `base_url` | string | Custom API endpoint for this model |
| `api_key_name` | string | Environment variable for API key |

### How Fallback Works

```
Request Flow:
┌─────────────────────────────────────────────────────────┐
│ Model[0]: gpt-4o                                        │
│  └─ HTTP Client: 3 retries with exponential backoff     │
│      └─ All retries failed? Try next model              │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼ (on error)
┌─────────────────────────────────────────────────────────┐
│ Model[1]: claude-sonnet                                 │
│  └─ HTTP Client: 3 retries with exponential backoff     │
│      └─ All retries failed? Try next model              │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼ (on error)
┌─────────────────────────────────────────────────────────┐
│ Model[2]: llama3.1:8b (local)                           │
│  └─ HTTP Client: 3 retries with exponential backoff     │
│      └─ All retries failed? Step fails                  │
└─────────────────────────────────────────────────────────┘
```

### Backward Compatibility

Single model strings still work as before:

```yaml
llm:
  provider: openai
  model: gpt-4o  # String format still supported
```

## Message Metadata

Dagu keeps provider, model, and token-usage metadata for assistant responses so the UI and APIs can show what happened during a run.

In practice, this means you can review:

- which provider answered
- which model was used
- how many tokens were consumed

You normally do not need to manage that metadata yourself.

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

The `${API_TOKEN}` value is substituted in the message content, but the actual secret is replaced with `*******` before being sent to the LLM provider. The saved session history retains the original content for debugging.

## Notes

- Use `type: chat` explicitly with LLM configuration in the `llm` field
- The `llm` field is designed to be reusable for future executor types like `agent`
- API keys are read from environment variables by default
- Response tokens are streamed to stdout by default
- The full session (inherited + step messages + response) is saved after each step
- Secrets are automatically masked before sending to LLM providers
- For AI agents with tool calling capabilities, see [Tool Calling](/features/chat/tool-calling)
