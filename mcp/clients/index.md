# MCP Clients

## Through Dagu Cloud

Every client uses one URL, `https://console.dagu.sh/mcp`, and signs in with OAuth. No API key or header is needed. See [Connect](/mcp/#connect) for the prompt to give a coding agent and the steps for Claude and ChatGPT.

## Direct to a Server

The rest of this page, and the client pages below, connect a client to one server's own `/mcp` endpoint. Dagu's MCP server is built into the Dagu HTTP server, so client setup means adding Dagu's Streamable HTTP endpoint to the tool. There is nothing to install per client.

### Before You Start

```bash
export DAGU_MCP_URL=http://localhost:8080/mcp
export DAGU_MCP_API_KEY=dagu_...
```

Use the HTTPS URL for a remote or shared Dagu server. See [Quickstart](/mcp/quickstart) for the URL table and [Authentication](/mcp/authentication) for key roles and surfaces.

### Pick Your Client

| Client | Page |
|--------|------|
| Claude Code | [Claude Code](./claude-code) |
| Codex | [Codex](./codex) |
| Cursor | [Cursor](./cursor) |
| VS Code and GitHub Copilot | [VS Code](./vscode) |
| Gemini CLI | [Gemini CLI](./gemini-cli) |
| OpenCode | [OpenCode](./opencode) |
| Zed | [Zed](./zed) |
| Cline | [Cline](./cline) |
| Windsurf | [Windsurf](./windsurf) |
| Claude Desktop and claude.ai | [Claude Apps](./claude-apps) |
| Anything else | [Other Clients](./other-clients) |

For a repository-wide setup that teammates share, see [Team Setup](./team-setup).

### Configuration Shapes

Clients agree on the concepts and disagree on the field names. This table is the fastest way to translate an example from one client to another.

| Client | Configuration | Endpoint field | Header auth | Secret from environment |
|--------|---------------|----------------|-------------|-------------------------|
| Claude Code | `claude mcp add`, `.mcp.json`, `~/.claude.json` | `"type": "http"` with `url` | Yes | `${VAR}`, `${VAR:-default}` |
| Codex | `codex mcp add`, `~/.codex/config.toml` | `url` | Bearer only, from an environment variable | `bearer_token_env_var` |
| Cursor | `.cursor/mcp.json`, `~/.cursor/mcp.json` | `url` | Yes | `${env:VAR}` |
| VS Code | `.vscode/mcp.json`, user `mcp.json` | `"type": "http"` with `url` | Yes | `${input:id}` prompt |
| Gemini CLI | `gemini mcp add`, `settings.json` | `httpUrl` | Yes | `$VAR`, `${VAR}` |
| OpenCode | `opencode.json` | `"type": "remote"` with `url` | Yes | `{env:VAR}` |
| Zed | `settings.json` | `url` | Yes | Not documented, value is literal |
| Cline | Cline MCP settings JSON | `"type": "streamableHttp"` with `url` | Yes | Not documented, value is literal |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | `serverUrl` | Yes | `${env:VAR}` |
| Claude Desktop and claude.ai | Connectors UI | Remote MCP server URL | No, OAuth or unauthenticated only | Not applicable |

Two field names cause most failures: Gemini CLI uses `httpUrl` for Streamable HTTP and reserves `url` for SSE, and Windsurf uses `serverUrl` instead of `url`.

### Transport

Dagu serves Streamable HTTP at `/mcp` and does not expose an SSE endpoint. Clients that only speak stdio or SSE need the `mcp-remote` bridge described in [Other Clients](./other-clients).

### Verify Any Client

After the client connects, three tools should be listed:

- `dagu_read`
- `dagu_change`
- `dagu_execute`

A good first read is the built-in authoring reference:

```text
dagu://reference/authoring
```

### Troubleshooting

| Symptom | Cause |
|---------|-------|
| `401 Unauthorized` | Missing or wrong API key, or a role without the needed permission. See [Authentication](/mcp/authentication). |
| `403 Forbidden` with `API key is not allowed for this surface` | The API key does not allow the `mcp` surface. Add it to the key's allowed surfaces. |
| `404 Not Found` | Server base path missing from the URL. A server mounted at `/dagu` exposes MCP at `/dagu/mcp`. |
| Client reports a missing command or a stdio server | The entry has a URL but no transport type. Add the client's HTTP type field. |
| Client connects but no tools appear | The key's role is too narrow, or the client cached an earlier failed session. Reconnect the server. |
| Client only supports SSE or stdio | Use the [`mcp-remote` bridge](./other-clients#stdio-only-clients). |
| Tools appear but every call fails against a remote server | The client cannot reach the Dagu URL. Confirm the host, port, and TLS from the machine running the client. |
