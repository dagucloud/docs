# Reasoning & Web Search

Configure provider-specific model reasoning and built-in web search for `action: chat.completion`.

## Reasoning

The `thinking` object accepts:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable provider-specific reasoning mode. |
| `effort` | string | `medium` | Reasoning effort: `low`, `medium`, `high`, or `xhigh`. |
| `budget_tokens` | integer | provider-specific | Explicit reasoning token budget. |
| `include_in_output` | boolean | `false` | Reserved. The current chat providers do not consistently apply this field. |

Support and accepted limits depend on the provider and model. See [Basic Chat](/features/chat/basics#thinking-configuration-thinking-field) for provider behavior.

## Web Search

Anthropic and Gemini can use provider-native search. OpenRouter uses its web-search plugin.

```yaml
steps:
  - id: search_release_notes
    action: chat.completion
    with:
      provider: anthropic
      model: claude-sonnet-4-6
      web_search:
        enabled: true
        max_uses: 3
        allowed_domains:
          - example.com
      prompt: |
        Find the latest release notes and summarize the changes.
```

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | boolean | Enable the provider's built-in web-search integration. |
| `max_uses` | integer | Anthropic: maximum search invocations. OpenRouter: maximum results. Ignored by Gemini. |
| `allowed_domains` | array | Restrict results to these domains. Anthropic only. |
| `blocked_domains` | array | Exclude these domains. Anthropic only. |
| `user_location` | object | Approximate `city`, `region`, `country`, and `timezone`. Anthropic only. |

For Anthropic, set either `allowed_domains` or `blocked_domains`, not both.

If a DAG whose tool name is `web_search` is also listed in `tools`, Dagu disables the built-in search integration for that request. The DAG tool remains available for the model to call; it is not called automatically.

## Related

- [LLM Completion](/step-types/llm/) for basic usage and configuration
- [Providers & Endpoints](/step-types/llm/providers) for provider credentials and endpoints
- [Tool Calling](/features/chat/tool-calling) for exposing DAGs as model tools

