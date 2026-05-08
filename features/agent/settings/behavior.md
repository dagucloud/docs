# Personality

This page covers the parts of `/agent-settings` that shape how the built-in steward behaves by default.

## Default Profile

If profiles are configured, the settings page shows a **Default Profile** selector.

This selects the default personality for the built-in steward.

Use profiles when you want different default styles for different teams or jobs, such as concise operations help, support-oriented replies, or a stricter code-review voice.

In the current UI:

- The selector only appears when at least one profile exists
- You can choose `Default (no profile)` or a configured profile

See [Profiles](/features/agent/souls) for how to create and manage personalities.

## When the Selected Profile Is Used

The selected profile becomes the default for the built-in steward. Users can still override the profile in the chat UI for a message or session when that UI control is available.

## Web Search Moved To Agent Tools

Web access is configured from **Agent Tools** at `/agent-tools`.

Use [Web Search](/features/agent/web-search) for:

- `Model Web Search`
- Tavily-backed `web_search` and `web_extract`
- Firecrawl-backed `web_search` and `web_extract`
- workflow `action: agent.run` behavior

## See Also

- [Steward Settings](/features/agent/settings/)
- [Profiles](/features/agent/souls)
- [Agent Step](/features/agent/step)
- [Web Search](/features/agent/web-search)
- [Models & Providers](/features/agent/settings/models)
