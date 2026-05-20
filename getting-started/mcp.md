# MCP Server

Dagu includes a built-in Model Context Protocol (MCP) server. There is no separate Dagu MCP package to install: run the Dagu HTTP server and point your MCP client at the `/mcp` endpoint.

Use the MCP server when you want an MCP-capable AI tool to inspect Dagu state, edit workflow definitions, or control DAG runs through Dagu's authenticated API.

## Quick setup

1. Install Dagu with one of the [installation methods](/getting-started/installation/).
2. Start the server:

```bash
dagu start-all
```

3. In your MCP client, add an HTTP or Streamable HTTP MCP server with these values:

| Field | Value |
|-------|-------|
| Name | `dagu` |
| URL | `https://<your-dagu-host>/mcp`, or `http://localhost:8080/mcp` when Dagu runs on the same machine as the MCP client |
| Auth | Use `Authorization: Bearer <token>` when Dagu authentication is enabled |

If you changed Dagu's server base path, append `/mcp` under that base path instead.

## Install in an MCP client

Dagu's MCP server is built into the Dagu HTTP server, so there is no separate `dagu-mcp` package. Installing MCP for an AI tool means starting Dagu, then adding the Dagu Streamable HTTP endpoint to that tool.

### Before you configure a client

1. Start or identify the Dagu server. For a local same-machine setup:

```bash
dagu start-all
```

2. Set the MCP endpoint URL for your Dagu server:

```bash
export DAGU_MCP_URL=http://localhost:8080/mcp
```

Use `localhost` only when the AI tool and Dagu server run on the same machine. For a remote or shared Dagu server, use its reachable HTTPS URL instead:

```bash
export DAGU_MCP_URL=https://dagu.example.com/mcp
```

Common URL shapes:

| Server setup | MCP URL |
|--------------|---------|
| Same-machine local server | `http://localhost:8080/mcp` |
| Same-machine custom port | `http://localhost:<port>/mcp` |
| Remote or shared server | `https://dagu.example.com/mcp` |
| Server base path such as `/dagu` | `https://dagu.example.com/dagu/mcp` |

3. If Dagu uses `builtin` authentication, create an [API key](/server-admin/authentication/api-keys) and export it before launching the MCP client:

```bash
export DAGU_MCP_API_KEY=dagu_...
```

Use a role that matches what the client should do. For example, `viewer` is enough for read-only inspection, `operator` can run and stop workflows, and `developer` can create or edit workflows.

### Codex

Codex supports Streamable HTTP MCP servers through `config.toml`. The CLI and IDE extension share this configuration.

For a Dagu server without authentication:

```bash
codex mcp add dagu --url "$DAGU_MCP_URL"
```

For a Dagu server using `builtin` authentication:

```bash
export DAGU_MCP_API_KEY=dagu_...
codex mcp add dagu \
  --url "$DAGU_MCP_URL" \
  --bearer-token-env-var DAGU_MCP_API_KEY
```

This writes the same configuration you can also add manually to `~/.codex/config.toml`:

```toml
[mcp_servers.dagu]
url = "https://dagu.example.com/mcp"
bearer_token_env_var = "DAGU_MCP_API_KEY"
```

Verify the setup:

```bash
codex mcp list
```

In an interactive Codex session, use `/mcp` to see whether the `dagu` server is connected and which tools are available.

### Claude Code

Claude Code supports Streamable HTTP MCP servers with `claude mcp add --transport http`.

For a Dagu server without authentication:

```bash
claude mcp add --transport http dagu "$DAGU_MCP_URL"
```

For a Dagu server using `builtin` authentication:

```bash
export DAGU_MCP_API_KEY=dagu_...
claude mcp add --transport http dagu "$DAGU_MCP_URL" \
  --header "Authorization: Bearer ${DAGU_MCP_API_KEY}"
```

The default Claude Code scope is local to the current project. To make the server available in every Claude Code project on your machine, add `--scope user`:

```bash
claude mcp add --transport http --scope user dagu "$DAGU_MCP_URL" \
  --header "Authorization: Bearer ${DAGU_MCP_API_KEY}"
```

Verify the setup:

```bash
claude mcp list
claude mcp get dagu
```

Inside Claude Code, use `/mcp` to inspect the connection status.

### Share Claude Code setup with a team

Use project scope when you want a repository to include the MCP server definition. Keep the secret in each user's environment:

```bash
claude mcp add --transport http --scope project dagu "$DAGU_MCP_URL"
```

Then edit the generated `.mcp.json` so the API key is read from an environment variable instead of being committed:

```json
{
  "mcpServers": {
    "dagu": {
      "type": "http",
      "url": "${DAGU_MCP_URL}",
      "headers": {
        "Authorization": "Bearer ${DAGU_MCP_API_KEY}"
      }
    }
  }
}
```

Each teammate should set `DAGU_MCP_URL`, create their own Dagu API key, and export `DAGU_MCP_API_KEY` before starting Claude Code.

## Authentication

The MCP endpoint uses the same authentication mode as the Dagu server.

| Dagu auth mode | MCP client setup |
|----------------|------------------|
| `none` | No token is required. |
| `builtin` | Create an [API key](/server-admin/authentication/api-keys) and send it as `Authorization: Bearer dagu_...`. A login JWT also works, but API keys are better for tools and automation. |
| `basic` | Use HTTP Basic authentication if your MCP client supports it. |

Prefer an `Authorization` header. Codex and Claude Code both support sending headers to HTTP MCP servers. If a client cannot send headers, Dagu also accepts `?token=<token>` on stream endpoints, but headers are safer for shared or proxied environments.

## Tool surface

Dagu intentionally exposes a compact MCP surface:

| Tool | Use it for |
|------|------------|
| `dagu_read` | Read DAG lists, DAG details, DAG specs, DAG-run details, logs, and MCP reference resources. |
| `dagu_change` | Preview and apply DAG YAML upserts. Use `mode=preview` before `mode=apply`. |
| `dagu_execute` | Start, enqueue, retry, or stop DAG runs. |

The server also exposes resources such as `dagu://dags/{name}/spec`, `dagu://runs/{name}/{dagRunId}`, and `dagu://runs/{name}/{dagRunId}/logs`. MCP clients that support resource subscriptions can subscribe to a run resource and receive an update when the run reaches a terminal state.

## Skill vs MCP

The Dagu skill and the Dagu MCP server solve related but different problems.

| Integration | Install or configure | Best for |
|-------------|----------------------|----------|
| Dagu skill | `gh skill install dagucloud/dagu dagu` | Teaching AI coding tools how to write valid Dagu workflow YAML. |
| Dagu MCP server | `http://localhost:8080/mcp` | Letting MCP clients read Dagu state, validate or apply DAG edits, and control runs. |

Most AI-assisted workflow authoring setups benefit from both: install the skill for authoring guidance, then connect MCP when the tool should operate a running Dagu server.

## Troubleshooting

- **404 or connection refused**: confirm `dagu start-all` is running and the MCP URL matches your server address and base path.
- **401 unauthorized**: add an API key or login token as `Authorization: Bearer <token>`.
- **Client shows no tools**: configure Dagu as an HTTP or Streamable HTTP MCP server, not a stdio command.
- **Remote server access**: expose the Dagu server through your normal secure route, use HTTPS, and give the MCP client a least-privilege API key.

## See also

- [AI Agent](/getting-started/ai-agent) — built-in Steward and workflow agent steps
- [CLI Commands](/getting-started/cli) — command reference, including external AI tool integration
- [API Keys](/server-admin/authentication/api-keys) — bearer tokens for programmatic access
