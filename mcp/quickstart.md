# MCP Quickstart

This guide connects an MCP-capable client to a running Dagu server.

## Start Dagu

Install Dagu with one of the [installation methods](/getting-started/installation/), then start the HTTP server:

```bash
dagu start-all
```

Set the MCP endpoint URL for the server:

```bash
export DAGU_MCP_URL=http://localhost:8080/mcp
```

Use `localhost` only when the MCP client and Dagu server run on the same machine.

| Server setup | MCP URL |
|--------------|---------|
| Same-machine local server | `http://localhost:8080/mcp` |
| Same-machine custom port | `http://localhost:<port>/mcp` |
| Remote or shared server | `https://dagu.example.com/mcp` |
| Server base path such as `/dagu` | `https://dagu.example.com/dagu/mcp` |

## Add Authentication

If Dagu uses `builtin` authentication, create an [API key](/server-admin/authentication/api-keys) and export it before launching the MCP client:

```bash
export DAGU_MCP_API_KEY=dagu_...
```

For most self-hosted MCP clients, API keys are the recommended setup. Use a role that matches what the client should do: `viewer` is enough for read-only inspection, `operator` can run and stop workflows, and `developer` can create or edit workflows.

For shared teams, prefer individual keys when you need per-user auditability.

## Connect A Client

In your MCP client, add an HTTP or Streamable HTTP MCP server:

| Field | Value |
|-------|-------|
| Name | `dagu` |
| URL | `$DAGU_MCP_URL` |
| Auth | `Authorization: Bearer $DAGU_MCP_API_KEY` when Dagu authentication is enabled |

For specific client commands, see [Clients](/mcp/clients).

## First Operations

After the client connects, verify the three core tools are available:

- `dagu_read`
- `dagu_change`
- `dagu_execute`

A good first read is the built-in authoring reference:

```text
dagu://reference/authoring
```

For workflow edits, call `dagu_change` with `mode=preview` before `mode=apply`. For run control, call `dagu_execute`, then read the returned run and log resources.
