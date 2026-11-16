---
description: Call one tool on a remote MCP server from a workflow step with mcp.call, over Streamable HTTP and without a model.
---

# MCP Call

Call one tool on a remote MCP server from a step, without a model. The step connects, sends one `tools/call`, closes the session, and publishes the result as step output.

Use `mcp.call` when the workflow already knows which tool to call and with which arguments, such as a scraper, a search index, or an internal service that is exposed as an MCP server. To let a model choose tools, see [Tool Calling](/features/chat/tool-calling). To let an external AI client operate Dagu, see [MCP](/mcp/).

## Requirements

- A Dagu release after v2.26.0.
- An MCP server reachable over Streamable HTTP or HTTPS. Local stdio servers and the legacy HTTP+SSE transport are not supported.

## Basic Usage

```yaml
secrets:
  - name: MCP_TOKEN
    provider: env
    key: MCP_TOKEN

steps:
  - id: scrape
    action: mcp.call
    with:
      url: https://mcp.example.com/mcp
      tool: scrape
      arguments:
        url: https://example.com
        formats: [markdown]
      headers:
        Authorization: Bearer ${MCP_TOKEN}
    timeout_sec: 60
    output: PAGE

  - id: report
    depends: scrape
    run: echo "${PAGE.content[0].text}"
```

## Configuration

| Field | Required | Description |
|-------|----------|-------------|
| `url` | Yes | Absolute `http` or `https` endpoint of the server. Accepts references such as `${MCP_URL}`. User info such as `https://user:pass@host` is rejected. |
| `tool` | Yes | Name of the tool to call. |
| `arguments` | No | Tool arguments as an object, or a `${...}` reference that resolves to a JSON object. |
| `headers` | No | Request headers sent with every request of the session. Use `${...}` references to [secrets](/writing-workflows/secrets) for credentials. |
| `include_raw` | No | When `true`, also writes the full MCP result under `raw`. Default `false`. |

Unknown fields fail validation.

## Arguments

Values in an `arguments` object keep their YAML types, so numbers, booleans, lists, and nested objects reach the tool as JSON of the same type. References resolve as in other `with` values:

```yaml
params:
  - QUERY: dagu

steps:
  - id: search
    action: mcp.call
    with:
      url: ${MCP_URL}
      tool: search
      arguments:
        query: ${params.QUERY}
        limit: 10
```

To pass a whole object from a parameter or an earlier step, set `arguments` to a single reference that resolves to a JSON object:

```yaml
params:
  - ARGS: '{"query": "dagu", "limit": 10}'

steps:
  - id: search
    action: mcp.call
    with:
      url: ${MCP_URL}
      tool: search
      arguments: ${params.ARGS}
```

Integers in a JSON string keep full precision, so IDs beyond 2<sup>53</sup> reach the tool unchanged.

## Output

A completed call writes one JSON object to stdout:

```json
{"content": [{"type": "text", "text": "# Example Domain"}], "structured_content": {"pages": 1}, "is_error": false}
```

| Field | Description |
|-------|-------------|
| `content` | The tool's content list, or `[]` when the tool returned none. |
| `structured_content` | The tool's structured result, or `null`. |
| `is_error` | The MCP `isError` flag. |
| `raw` | The full MCP result. Present only with `include_raw: true`. |

With `output: PAGE`, later steps read fields by path. To hand a JSON value to a shell command, pass it through `env` instead of splicing it into the command, so its quotes do not end the shell string:

```yaml
steps:
  - id: scrape
    action: mcp.call
    with:
      url: ${MCP_URL}
      tool: scrape
      arguments: {url: https://example.com}
    output: PAGE

  - id: count
    depends: scrape
    run: echo "pages=${PAGE.structured_content.pages}"

  - id: save
    depends: scrape
    env:
      - CONTENT: ${PAGE.content}
    run: printf '%s\n' "$CONTENT" > content.json
```

Numbers in `structured_content` and `raw` are decoded as 64-bit floating point, so integers beyond 2<sup>53</sup> lose precision. A tool that returns such IDs should return them as strings.

## Errors

The step fails when the call fails or the tool reports `isError: true`. When the call produced no result, stdout is:

```json
{"error": {"kind": "auth", "message": "server rejected credentials (HTTP 401)"}}
```

The step error starts with `mcp.call: <kind> error:`. When the step's own `timeout_sec` elapses, Dagu reports its step timeout error instead, and stdout still carries the kind.

| Kind | Meaning |
|------|---------|
| `tool` | The tool ran and reported `isError: true`. The normal output is still written. |
| `auth` | The server answered HTTP 401 or 403. |
| `protocol` | A JSON-RPC error such as an unknown tool, a lost session, an invalid response, or an HTTP 3xx redirect. |
| `transport` | A network failure, such as a refused connection or a connection lost mid-response, or HTTP 429, 500, 502, 503, or 504. |
| `timeout` | The step or DAG timeout elapsed. |
| `canceled` | The run was stopped. |

Redirects are not followed. Configure the final URL of the endpoint.

## Credentials

Put credentials in `headers` and read them from [secrets](/writing-workflows/secrets), which Dagu resolves at run time and masks in step logs. Never put them in the URL.

The step also replaces these values with `***` in its output and error messages:

- the value of a header whose name contains `auth`, `cookie`, `key`, `token`, `secret`, or `password`, in any case, and the part after the first space, such as the token in `Bearer <token>`
- the value of a URL query parameter whose name contains one of those words, both decoded and as written

Other header and query values are left alone, so ordinary values such as `X-Region: us` never alter the tool result. Masking applies to string values in the output, not to object keys.

## Retries, Timeouts, and Stop

`mcp.call` never retries on its own. A step `retry_policy`, or one under `defaults`, runs the whole call again, so the tool runs again too. Set a retry policy only for tools that are safe to call twice.

```yaml
steps:
  - id: lookup
    action: mcp.call
    with:
      url: ${MCP_URL}
      tool: lookup
      arguments: {id: "42"}
    retry_policy:
      limit: 3
      interval_sec: 10
```

When the server ends the call's event stream after an event ID, the client resumes the stream with `Last-Event-ID`. Resumption replays events the server stored and does not send `tools/call` again.

The action sets no timeout of its own, and a tool may run as long as the server allows. Set `timeout_sec` on the step to bound it. On a timeout or a stop, the client tells the server that the request is canceled and then closes the session. Against a server that does not answer, the step can take up to 10 seconds longer to return.

## Not Supported

- Local stdio servers and the legacy HTTP+SSE transport.
- MCP resources, prompts, and tasks.
- Server-initiated requests such as sampling and elicitation.
- OAuth sign-in flows. Send a token the server accepts in `headers`.
- Connection pooling. Each run opens and closes its own session.

Need one of these? [Request it](https://github.com/dagucloud/dagu/issues).
