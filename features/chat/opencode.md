# OpenCode

Use Dagu with [OpenCode](https://opencode.ai) — a subscription service that gives you access to Kimi, DeepSeek, GLM, Qwen, MiMo, and other models through a single OpenAI-compatible API.

This applies to both:

- the Web UI steward
- workflow steps that use `action: chat.completion` or `action: agent.run`

## What Is OpenCode

OpenCode (`opencode.ai`) provides a unified OpenAI-compatible endpoint for a rotating catalog of models. Access is subscription-based — you pay a flat monthly rate rather than per-token.

**Base URL**: `https://opencode.ai/zen/go/v1`

**Environment variable**: `OPENCODE_API_KEY`

## Available Models

| Model | ID |
|-------|----|
| Kimi K2.6 | `kimi-k2.6` |
| Kimi K2.5 | `kimi-k2.5` |
| DeepSeek V4 Pro | `deepseek-v4-pro` |
| DeepSeek V4 Flash | `deepseek-v4-flash` |
| GLM-5.1 | `glm-5.1` |
| GLM-5 | `glm-5` |
| Qwen3.6 Plus | `qwen3.6-plus` |
| MiMo V2.5 Pro | `mimo-v2.5-pro` |
| MiMo V2.5 | `mimo-v2.5` |

The model catalog may expand over time. Check [opencode.ai/docs/go](https://opencode.ai/docs/go/) for the current list.

## Web UI Steward Setup

1. Go to `/agent-settings`
2. Enable Steward if not already on
3. Click **Add Model**
4. Fill in:
   - **Provider**: `OpenCode`
   - **Model**: e.g. `kimi-k2.6`
   - **API Key**: your OpenCode API key
   - **Base URL**: leave empty (defaults to `https://opencode.ai/zen/go/v1`)
5. Enable **Supports Thinking** if the model supports it (Kimi, DeepSeek V4 Pro, GLM, Qwen)
6. Click the star to set it as default

You can also pick from the built-in presets when adding a model — OpenCode presets are listed for all supported models.

## Workflow Steps

### Chat Step

```yaml
steps:
  - action: chat.completion
    with:
      provider: opencode
      model: kimi-k2.6
      messages:
        - role: user
          content: "Summarize today's error logs."
    output: SUMMARY
```

The `OPENCODE_API_KEY` environment variable is read automatically. To use a different variable name:

```yaml
steps:
  - action: chat.completion
    with:
      provider: opencode
      model: kimi-k2.6
      api_key_name: MY_OPENCODE_KEY
      messages:
        - role: user
          content: "Hello!"
```

### With Thinking Enabled

Models that support reasoning (Kimi K2, DeepSeek V4 Pro, GLM-5, Qwen3):

```yaml
steps:
  - action: chat.completion
    with:
      provider: opencode
      model: kimi-k2.6
      thinking:
        enabled: true
        effort: high
      messages:
        - role: user
          content: "Analyze the security implications of this code..."
    output: ANALYSIS
```

### Agent Step

```yaml
steps:
  - id: fix_config
    action: agent.run
    with:
      model: opencode-kimi-k2-6
      messages:
        - role: user
          content: "Review and fix the invalid entries in /etc/app/config.yaml"
    output: RESULT
```

The `model` field here refers to the saved model ID from `/agent-settings`.

### Model Fallback

Use OpenCode as a fallback alongside other providers:

```yaml
llm:
  model:
    - provider: anthropic
      name: claude-sonnet-4-6
    - provider: opencode
      name: kimi-k2.6
    - provider: opencode
      name: deepseek-v4-pro

steps:
  - action: chat.completion
    with:
      messages:
        - role: user
          content: "Explain this error."
```

## Reasoning and Tool Calls

OpenCode reasoning models return thinking text in a `reasoning` field. Dagu preserves this between tool call turns, which is required by models like Kimi K2 when thinking is enabled. This is handled automatically — no extra configuration needed.

## Related Pages

- [Basic Chat](/features/chat/basics)
- [Local AI](/features/chat/local-ai)
- [Steward](/features/agent/)
- [Models & Providers](/features/agent/settings/models)
