# ACP Agents

The [Agent Client Protocol](https://agentclientprotocol.com/) (ACP) is an open protocol between clients and coding agents. A `harness.run` step can act as an ACP client instead of starting a CLI: it starts a session, sends the prompt, answers the agent's permission requests, and captures the agent's reply as step stdout.

Dagu connects to ACP agents in three ways:

| Transport | Agent runs | Endpoint |
|-----------|------------|----------|
| `stdio` (default) | On the Dagu host, as a local adapter process | `binary` |
| `websocket` | On another host, behind a WebSocket endpoint | `ws://` or `wss://` URL |
| `http` | On another host, behind ACP Streamable HTTP | `http://` or `https://` URL |

Select ACP with `protocol: acp` in a named [custom harness definition](./#custom-harness-definitions). Definitions without `protocol`, or with `protocol: cli`, keep the CLI behavior.

## Local Adapter

Install and authenticate an ACP adapter, such as `@agentclientprotocol/codex-acp`, on the host that runs the step:

```yaml
harnesses:
  coding-agent:
    protocol: acp
    binary: codex-acp

steps:
  - id: review
    action: harness.run
    with:
      provider: coding-agent
      prompt: Review the code in this directory and summarize its modules without modifying files.
    output: REVIEW
```

`binary`, `prefix_args`, `flag_style`, and `option_flags` configure how the adapter process starts. Other `with` keys become adapter CLI flags, using the same [`with`-to-flag mapping](./#with-to-flag-mapping) as CLI harnesses. The prompt travels over the protocol, so ACP definitions reject `prompt_mode`, `prompt_flag`, and `prompt_position`. `with.stdin` is appended to the prompt after a blank line.

The adapter process inherits the step environment, working directory, and resource limits.

## Remote Agent

A remote definition connects to an agent that another host runs. It needs a `url` and a `cwd`, the absolute working directory on the **agent host**:

```yaml
harnesses:
  remote-agent:
    protocol: acp
    transport: websocket          # http for an ACP Streamable HTTP endpoint
    url: wss://acp.example.com/acp
    cwd: /srv/project
    headers:
      Authorization: Bearer ${ACP_TOKEN}

steps:
  - id: review
    action: harness.run
    timeout_sec: 600
    with:
      provider: remote-agent
      prompt: Review the project without modifying files.
    output: REVIEW
```

Rules for remote definitions:

- `binary`, `prefix_args`, `flag_style`, and `option_flags` are rejected.
- A remote step accepts only `provider`, `fallback`, and `acp_permission` in `with`. Any other key fails the step, because a remote agent takes no CLI flags.
- `url`, `cwd`, `headers`, and `ca_file` support workflow variables. A `url` or `cwd` that references a variable is validated after it resolves.
- Dagu passes `cwd` to the agent unchanged. It never creates or translates the remote directory.
- TLS certificate and hostname verification always stay on. `ca_file` adds PEM roots for this connection only, alongside the system roots; a relative path resolves from the step's working directory.
- Redirects are refused, and network errors omit credentials and response bodies.
- Headers sent over `ws://` or `http://` to a host other than the local machine produce a warning in the step log.

Supply tokens through [secrets](/writing-workflows/secrets) or the workflow environment rather than literal values.

### WebSocket

The WebSocket transport offers the `acp.v1` subprotocol and sends `headers` with the upgrade request. WebSocket ping frames keep idle connections alive through proxies.

Bearer tokens stay in the `Authorization` header. Set `bearer_subprotocol: true` only for a bridge that requires the token as a `bearer.<token>` subprotocol. The token must then be a valid HTTP token, so tokens containing characters such as `/` or `=` cannot use it.

### Streamable HTTP

`transport: http` implements the experimental Streamable HTTP profile from the ACP TypeScript SDK. The endpoint must implement that profile: `initialize` returns JSON with an `Acp-Connection-Id` header, later POSTs return `202 Accepted`, and responses and agent requests arrive on server-sent event streams. Dagu keeps cookies for affinity and deletes the connection when the step ends. This is not the MCP Streamable HTTP transport.

## Definition Fields

| Field | Applies to | Meaning |
|-------|------------|---------|
| `protocol` | all | `acp` selects ACP; `cli` or omitted keeps CLI invocation |
| `transport` | ACP | `stdio` (default), `websocket`, or `http` |
| `binary` | stdio | Adapter binary name or path; required |
| `prefix_args` | stdio | Arguments placed before generated flags |
| `flag_style` | stdio | `gnu_long` or `single_dash` for generated flags |
| `option_flags` | stdio | Exact flag token per `with` key |
| `url` | remote | Endpoint; `ws://`/`wss://` for WebSocket, `http://`/`https://` for HTTP; required |
| `cwd` | remote | Absolute working directory on the agent host; required |
| `headers` | remote | Request headers, such as `Authorization` |
| `ca_file` | remote | Extra PEM certificate roots for this connection |
| `bearer_subprotocol` | WebSocket | Also send a Bearer token as a `bearer.<token>` subprotocol; defaults to `false` |

## Permissions

ACP agents ask the client before running tools that need approval. `with.acp_permission` sets how Dagu answers:

| Value | Behavior |
|-------|----------|
| `deny` (default) | Selects the agent's reject option and fails the attempt, even if the agent then ends its turn normally |
| `allow` | Selects an offered `allow_once` option; never grants persistent approval |

With `allow`, a request that offers no `allow_once` option is still rejected and fails the attempt.

```yaml
harnesses:
  coding-agent:
    protocol: acp
    binary: codex-acp

steps:
  - id: fix
    action: harness.run
    with:
      provider: coding-agent
      prompt: Fix the failing unit test.
      acp_permission: allow
```

This policy governs the protocol's permission requests only. It is not a sandbox around the agent's own tools; use [sandboxed execution](./sandbox/) or a remote host for isolation.

## Output

Assistant text becomes step stdout, so it works with `output:`, `outputs:`, and [`output_schema`](./#structured-json-output). Protocol messages, thoughts, and tool events are not included. The step succeeds only when the agent ends its turn with `end_turn`; any other stop reason, such as a refusal, fails the attempt.

Each execution starts a fresh ACP session. Session resume is not supported.

## DAG-Level Defaults

[DAG-level `harness:` defaults](./#dag-level-defaults) apply to ACP steps with two exceptions:

- A remote ACP step inherits only `provider` and `acp_permission`, because a remote agent takes no CLI flags. This also holds when a variable such as `${PROVIDER}` selects the provider.
- `acp_permission` affects only ACP steps. CLI providers never receive it as a flag, so one DAG can set it alongside CLI steps.

```yaml
harnesses:
  remote-agent:
    protocol: acp
    transport: http
    url: https://acp.example.com/acp
    cwd: /srv/project

harness:
  provider: claude
  model: sonnet
  acp_permission: allow

steps:
  - id: local_review
    action: harness.run
    with:
      prompt: Review the staged changes.

  - id: remote_review
    action: harness.run
    with:
      provider: remote-agent
      prompt: Review the deployment manifests.
```

`local_review` runs Claude Code with `--model sonnet`. `remote_review` gets `acp_permission: allow` but not `model`.

## Stopping and Timeouts

| Event | Behavior | Exit code |
|-------|----------|-----------|
| Graceful stop | Sends `session/cancel` and waits for the agent to end its turn | `143`, or `128` + the signal number |
| Forced stop, including once `max_clean_up_time_sec` elapses | Sends `session/cancel`, then terminates the local process tree or closes the remote connection | `137` |
| `timeout_sec` reached | Sends `session/cancel`, then interrupts the transport | `124` |

A stop skips any remaining fallback providers, including a stop that arrives while the agent is still starting. Remote agents must honor `session/cancel`; Dagu closes the connection but does not own the remote process.

When a local adapter crashes or exits after a failed turn, the step keeps the adapter's own exit code, so [`retry_policy`](/writing-workflows/error-handling) and `continue_on` rules can match it. Recent adapter stderr is included in the error.

## Fallbacks

ACP and CLI providers can appear in the same [fallback](./#fallbacks) list. Text from a failed attempt never reaches the output of a later successful attempt.

```yaml
harnesses:
  coding-agent:
    protocol: acp
    binary: codex-acp

steps:
  - id: review
    action: harness.run
    with:
      provider: coding-agent
      prompt: Review this repository.
      fallback:
        - provider: claude
```

## Limitations

- Adapters must be installed and authenticated beforehand; interactive authentication is not supported.
- Local ACP adapters cannot run inside containers. Remote steps ignore a DAG-level `container:` because no local process starts.
- Client filesystem and terminal callbacks are not offered to the agent.
- Session resume, automatic reconnect, and replay after a disconnect are not supported.

Need one of these? [Request it](https://github.com/dagucloud/dagu/issues).

## See Also

- [Harness](./) for the shared step contract, fallbacks, and DAG-level defaults
- [Harness Sandboxed Execution](./sandbox/) for isolating CLI agents
- [Agent Client Protocol](https://agentclientprotocol.com/)
