# Web Search

Dagu supports web access for AI agent in two different ways:

| Backend | What The Agent Gets | Best For | Requires |
|---------|---------------------|----------|----------|
| `Model Web Search` | The selected model/provider uses its native web search capability. | Models that already support hosted search and citations. | A model/provider that supports provider-native search. |
| `Tavily` | First-class `web_search` and `web_extract` tools. | Consistent search tools across models, including models without native search. | Tavily API key. |
| `Firecrawl` | First-class `web_search` and `web_extract` tools. | Search plus page extraction through Firecrawl. | Firecrawl API key. |

Use `Model Web Search` when you want the model provider to manage the search. Use `Tavily` or `Firecrawl` when you want Dagu to expose explicit tools that the agent can call during the tool loop.

## Configure In The Web UI

You need admin access to change agent settings.

1. Open **AI agent Settings** at `/agent-settings`
2. Enable AI agent, add a model, and set a default model
3. Open **Agent Tools** at `/agent-tools`
4. Turn on **Web Search Backend**
5. Choose `Model Web Search`, `Tavily`, or `Firecrawl`
6. Fill in the backend-specific fields
7. Save settings

API keys are write-only. After saving, the UI only shows whether a key is configured. Use **Clear Key** and save again to remove a stored key.

## Model Web Search

`Model Web Search` enables provider-native web search on the model request. It is not exposed as a separate Dagu tool, and it is not controlled by the tool permission list.

The only UI setting for this backend is **Max Uses per Request**. Leave it empty for no Dagu-level limit, or set a positive integer to cap search invocations for one model request.

Provider-native search support depends on the selected model provider and model. If a provider does not support native search in Dagu, use `Tavily` or `Firecrawl` instead.

## Tavily Backend

The Tavily backend exposes:

- `web_search` backed by Tavily Search
- `web_extract` backed by Tavily Extract

Fields:

| Field | Description |
|-------|-------------|
| `Tavily API Key` | Tavily API key. Stored write-only. |
| `Max Results` | Maximum `web_search.limit` allowed by Dagu. Tavily allows up to `20`. If the model omits `limit`, Dagu requests `5` results. |
| `Search Depth` | Tavily `search_depth`: `basic`, `advanced`, `fast`, or `ultra-fast`. |

Dagu uses `https://api.tavily.com` by default. API/config users can set a Tavily-compatible `baseUrl` when routing through a proxy or compatible service.

## Firecrawl Backend

The Firecrawl backend exposes:

- `web_search` backed by Firecrawl Search
- `web_extract` backed by Firecrawl Scrape

Fields:

| Field | Description |
|-------|-------------|
| `Firecrawl API Key` | Firecrawl API key. Stored write-only. |
| `Max Results` | Maximum `web_search.limit` allowed by Dagu. Firecrawl allows up to `100`. If the model omits `limit`, Dagu requests `5` results. |

Dagu uses `https://api.firecrawl.dev` by default. API/config users can set a Firecrawl-compatible `baseUrl` when routing through a proxy or compatible service.

## Tool Behavior

Hosted backends add two callable tools to the agent tool loop.

| Tool | Input | Description |
|------|-------|-------------|
| `web_search` | `query` string, optional `limit` integer | Search the public web for current information. |
| `web_extract` | `urls` array, up to `10` HTTP/HTTPS URLs | Extract readable text content from public web pages. |

The tools are available only when:

- **Web Search Backend** is enabled
- the selected backend is `Tavily` or `Firecrawl`
- the selected backend has an API key configured
- the tool is allowed by the global tool policy

If a workflow `action: agent.run` step sets `with.tools.enabled`, include `web_search` or `web_extract` there when the step should use them.

```yaml
steps:
  - action: agent.run
    with:
      tools:
        enabled:
          - web_search
          - web_extract
          - think
      max_iterations: 20
      messages:
        - role: user
          content: |
            Find the latest release notes for the service dependency.
            Extract the most relevant source page and summarize breaking changes.
    output: RELEASE_SUMMARY
```

The step still inherits the backend credentials and provider choice from the global agent settings. DAG YAML does not store Tavily or Firecrawl API keys.

## Workflow Agent Steps

Workflow agent steps can use both web access styles:

- `Model Web Search`: inherited from the global agent setting, or overridden with `with.web_search`
- `Tavily` / `Firecrawl`: inherited from the global agent web tool setting and filtered by tool policy

Provider-native search can be overridden in YAML:

```yaml
steps:
  - action: agent.run
    with:
      web_search:
        enabled: true
        max_uses: 5
      messages:
        - role: user
          content: "Summarize current incident reports for this vendor."
    output: INCIDENT_SUMMARY
```

Provider-backed tools are configured globally, then selected like other tools:

```yaml
steps:
  - action: agent.run
    with:
      tools:
        enabled:
          - web_search
          - web_extract
      messages:
        - role: user
          content: "Find and extract the current API changelog."
    output: CHANGELOG_SUMMARY
```

## Distributed Workers

Agent web settings are part of the agent configuration. In shared-nothing distributed execution, Dagu sends the execution snapshot to the worker, including the agent config needed by `action: agent.run` steps.

Workers still need outbound network access to the selected search provider. If a worker cannot reach Tavily, Firecrawl, or the model provider, the tool call fails in that worker process.

## Advanced Configuration

The Web UI writes the agent configuration to the agent config store under Dagu's data directory. For file-based deployments, that store is `{data_dir}/agent/config.json`.

The REST API uses camelCase fields:

```json
{
  "webSearch": {
    "enabled": true,
    "maxUses": 5
  },
  "webTools": {
    "enabled": true,
    "backend": "tavily",
    "tavily": {
      "apiKey": "tvly-...",
      "maxResults": 10,
      "searchDepth": "basic"
    }
  }
}
```

Supported backend values are `tavily` and `firecrawl`.

## Provider Docs

- [Tavily Search API](https://docs.tavily.com/documentation/api-reference/endpoint/search)
- [Tavily Extract API](https://docs.tavily.com/documentation/api-reference/endpoint/extract)
- [Firecrawl Search API](https://docs.firecrawl.dev/api-reference/v2-endpoint/search)
- [Firecrawl Scrape API](https://docs.firecrawl.dev/api-reference/v2-endpoint/scrape)

## Related Pages

- [Agent Step](/features/agent/step)
- [AI agent Tools Reference](/features/agent/tools)
- [Tool Permissions & Bash Policy](/features/agent/settings/controls)
- [Models & Providers](/features/agent/settings/models)
