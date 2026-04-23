# Personality & Web Search

This page covers the parts of `/agent-settings` that shape how the built-in agent behaves by default.

## Agent Personality

If souls are configured, the settings page shows an **Agent Personality** selector.

This selects the default personality for the built-in agent.

Use souls when you want different default styles for different teams or jobs, such as concise operations help, support-oriented replies, or a stricter code-review voice.

In the current UI:

- The selector only appears when at least one soul exists
- You can choose `Default (no soul)` or a configured soul

See [Souls](/features/agent/souls) for how to create and manage personalities.

## When the Selected Soul Is Used

The selected soul becomes the default for the built-in agent. Users can still override the soul in the chat UI for a message or session when that UI control is available.

## Web Search

The settings page includes a **Web Search** toggle.

This enables provider-native web search for agent sessions. It does not appear as a separate tool button in the built-in tool list.

Whether it actually works depends on the selected provider and model.

## Max Uses per Request

When web search is enabled, the current UI also shows **Max Uses per Request**.

Behavior:

- Empty means no UI-level limit is saved here
- Values below `1` are not kept by the UI

## Scope of This Setting

This setting controls the built-in agent configuration.

Workflow `type: agent` steps can also define their own `agent.web_search` settings in DAG YAML. Those are documented separately in [Agent Step](/features/agent/step).

## Important Distinction

Provider-native web search is different from exposing a generic "search the web" tool.

In Dagu's built-in agent:

- Web search runs through the selected model/provider
- Tool permissions do not show it as a standalone tool

## See Also

- [Agent Settings](/features/agent/settings/)
- [Souls](/features/agent/souls)
- [Agent Step](/features/agent/step)
- [Models & Providers](/features/agent/settings/models)
