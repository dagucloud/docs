# Chat & AI Agents

Execute Large Language Model (LLM) requests and build AI agents that can use tools to perform actions.

## Capabilities

| Feature | Description |
|---------|-------------|
| [Basic Chat](/features/chat/basics) | Simple LLM sessions with OpenAI, Anthropic, Gemini, and more |
| [Tool Calling](/features/chat/tool-calling) | AI agents that execute DAG workflows as tools during sessions |

## Quick Start

### Simple Chat

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

### AI Agent with Tools

```yaml
# Main DAG that uses tools
steps:
  - type: chat
    llm:
      provider: anthropic
      model: claude-sonnet-4-20250514
      tools:
        - calculator
    messages:
      - role: user
        content: "What is 15 times 23?"

---
# Tool DAG definition
name: calculator
description: "Perform basic arithmetic operations"
params: "operation a b"

steps:
  - name: calculate
    script: |
      case "$1" in
        multiply) echo $(($2 * $3)) ;;
        *) echo "Unknown operation" ;;
      esac
    output: RESULT
```

## Supported Providers

| Provider | Environment Variable | Models |
|----------|---------------------|--------|
| `openai` | `OPENAI_API_KEY` | GPT-3.5, GPT-4, GPT-4o |
| `anthropic` | `ANTHROPIC_API_KEY` | Claude 3, Claude 4, Claude Sonnet |
| `gemini` | `GOOGLE_API_KEY` | Gemini 1.5, Gemini 2 |
| `openrouter` | `OPENROUTER_API_KEY` | 100+ models via OpenRouter |
| `local` | (none) | Ollama, vLLM, LM Studio (OpenAI-compatible) |

## Key Features

- **Multi-Provider Support** - Switch between OpenAI, Anthropic, Gemini, and local models
- **Session History** - Automatic message inheritance between dependent steps
- **Extended Thinking** - Enable reasoning mode for complex tasks (Anthropic, OpenAI, Gemini)
- **Secret Masking** - Automatic masking of sensitive values before sending to LLM
- **Tool Calling** - Build AI agents that execute workflows as function calls
- **Variable Substitution** - Use `${VAR}` in messages for dynamic content
- **DAG-Level Defaults** - Share LLM configuration across multiple steps

## Configuration

### Basic LLM Config

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `provider` | string | required | LLM provider (`openai`, `anthropic`, `gemini`, etc.) |
| `model` | string | required | Model identifier |
| `temperature` | float | provider default | Response randomness (0.0-2.0) |
| `max_tokens` | int | provider default | Maximum tokens to generate |
| `stream` | bool | `true` | Stream response tokens |

### Tool Calling Config

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `tools` | string[] | `[]` | DAG names to expose as callable tools |
| `max_tool_iterations` | int | `10` | Maximum tool calling loops |

## Examples

### Multi-turn Session

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

The `followup` step automatically inherits session history from `setup`.

### DAG-Level Configuration

```yaml
# Share LLM config across all chat steps
llm:
  provider: anthropic
  model: claude-sonnet-4-20250514
  temperature: 0.7

steps:
  - type: chat
    messages:
      - role: user
        content: "Explain quantum computing"

  - type: chat
    messages:
      - role: user
        content: "Now explain it to a 5-year-old"
```

Both steps inherit the DAG-level LLM configuration.

## See Also

- [Basic Chat](/features/chat/basics) - Complete reference for simple LLM sessions
- [Tool Calling](/features/chat/tool-calling) - Build AI agents with DAG-based tools
- [Secrets](/writing-workflows/secrets) - Secure handling of API keys
- [Variables](/reference/variables) - Dynamic content in messages
