# Reasoning & Web Search

Configure provider-specific model reasoning and built-in web search for `action: chat.completion`.

Examples use OpenRouter; make the key reachable as shown in the [overview](/step-types/llm/#first-completion).

## Reasoning

The `thinking` object accepts:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable provider-specific reasoning mode. |
| `effort` | string | `medium` | Reasoning effort: `low`, `medium`, `high`, or `xhigh`. |
| `budget_tokens` | integer | provider-specific | Explicit reasoning token budget. |
| `include_in_output` | boolean | `false` | Reserved. The current chat providers do not consistently apply this field. |

Support and accepted limits depend on the provider and model:

| Provider | Mapping |
|----------|---------|
| Anthropic | Uses a reasoning token budget. |
| OpenAI | Uses reasoning effort. Sampling fields unsupported by a reasoning model are omitted. |
| Gemini | Uses a thinking level or token budget, depending on the model. |
| OpenRouter | Maps the common settings to its unified reasoning configuration. |
| Local | Sends standard chat-completion fields; local-provider reasoning controls are not currently serialized. |

Claude models do not accept a forced tool call while reasoning. When a step needs one, such as a step with [`output_schema`](/step-types/llm/#structured-output), Dagu offers the tool without forcing it for Anthropic and for Claude models through OpenRouter.

## Web Search

Anthropic and Gemini can use provider-native search. OpenRouter uses its web-search plugin.

```yaml
steps:
  - id: search_news
    action: chat.completion
    with:
      provider: openrouter
      model: deepseek/deepseek-v4-flash
      web_search:
        enabled: true
        max_uses: 3
      prompt: |
        What is the current stable version of the Linux kernel?
        Reply with just the version number.
```

For Anthropic, domain filtering is also available:

```yaml
      web_search:
        enabled: true
        max_uses: 3
        allowed_domains:
          - example.com
```

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | boolean | Enable the provider's built-in web-search integration. |
| `max_uses` | integer | Anthropic: maximum search invocations. OpenRouter: maximum results. Ignored by Gemini. |
| `allowed_domains` | array | Restrict results to these domains. Anthropic only. |
| `blocked_domains` | array | Exclude these domains. Anthropic only. |
| `user_location` | object | Approximate `city`, `region`, `country`, and `timezone`. Anthropic only. |

For Anthropic, set either `allowed_domains` or `blocked_domains`, not both.

Web search cannot be combined with [`output_schema`](/step-types/llm/#structured-output), whose answer comes from a tool call; search in an earlier step and pass the result on.

If a DAG whose tool name is `web_search` is also listed in `tools`, Dagu disables the built-in search integration for that request. The DAG tool remains available for the model to call; it is not called automatically.

## Related

- [LLM Completion](/step-types/llm/) for basic usage and configuration
- [Providers & Endpoints](/step-types/llm/providers) for provider credentials and endpoints
- [Tool Calling](/features/chat/tool-calling) for exposing DAGs as model tools
