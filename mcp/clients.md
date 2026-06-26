# MCP Clients

Dagu's MCP server is built into the Dagu HTTP server, so client setup means adding Dagu's Streamable HTTP endpoint to the tool.

Before configuring a client:

```bash
export DAGU_MCP_URL=http://localhost:8080/mcp
export DAGU_MCP_API_KEY=dagu_...
```

Use the HTTPS URL for a remote or shared Dagu server.

## Codex

Codex supports Streamable HTTP MCP servers through `config.toml`. The CLI and IDE extension share this configuration.

For a Dagu server without authentication:

```bash
codex mcp add dagu --url "$DAGU_MCP_URL"
```

For a Dagu server using `builtin` authentication:

```bash
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

## Claude Code

Claude Code supports Streamable HTTP MCP servers with `claude mcp add --transport http`.

For a Dagu server without authentication:

```bash
claude mcp add --transport http dagu "$DAGU_MCP_URL"
```

For a Dagu server using `builtin` authentication:

```bash
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

## Shared Claude Code Setup

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
