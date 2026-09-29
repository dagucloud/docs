# OpenCode

[OpenCode](https://opencode.ai) is an open-source AI coding agent.

## Installation

See the [OpenCode installation guide](https://opencode.ai).

For containerized Dagu runs, see [Run OpenCode in a Container](./sandbox/opencode).

## Managed Sessions

Built-in OpenCode harness steps use a host-owned OpenCode server session by default when launched by a standalone Dagu server, by `dagu start-all`, or on a distributed worker. The run page gets an **Agent** tab with the live timeline, tool activity, changed files, token usage, and native controls for permission requests and questions. Each managed step has its own conversation by default; when a run has multiple managed steps, choose the conversation by step name in the Agent tab. When OpenCode needs an answer, the step enters `waiting`, and the DAG-run enters `waiting` once no other step is running. Answering resumes the same session. While other steps of the run are still running, answering and starting a clean session are rejected; try again after they finish. In a root run, answering resumes the run even while other manual steps keep waiting. If the DAG belongs to an enabled [global queue](/server-admin/queues), the resume goes through the scheduler; use `dagu start-all` so the scheduler shares the server's OpenCode host.

```yaml
steps:
  - id: implement
    action: harness.run
    with:
      provider: opencode
      model: openai/gpt-5
      variant: high
      prompt: Implement the requested change and run the relevant tests.
```

The final assistant text is captured as step stdout. Resuming a waiting or interrupted attempt reconnects to work already submitted to OpenCode without sending the prompt twice. Retrying a step after a terminal session error starts a new session generation and submits the original prompt again. Rescheduling as a new DAG run starts an independent conversation. In distributed mode, Dagu pins retries and resumes to the worker that owns the session.

The session survives Dagu and OpenCode server restarts when the same service account, OpenCode data directory, workspace, and worker identity are retained. If the owning worker is offline or the session cannot be found, an answer remains pending and the run offers a clean-session restart.

### Service setup

Install OpenCode for the Dagu service account and authenticate that same account with `opencode auth login`. OpenCode normally stores those credentials in `~/.local/share/opencode/auth.json`. Alternatively, explicitly pass selected provider credentials to the managed host:

```yaml
opencode:
  executable: opencode
  env_passthrough:
    - OPENAI_API_KEY
```

The environment equivalents are `DAGU_OPENCODE_EXECUTABLE` and comma-separated `DAGU_OPENCODE_ENV_PASSTHROUGH`.

Dagu does not add a Dagu MCP entry, install an OpenCode plugin, or modify configuration files. Existing OpenCode configuration, including user-configured MCP servers, is honored. Any environment variables referenced by those MCP servers must be included in `opencode.env_passthrough`. Add the [Dagu MCP configuration](/mcp/clients/opencode) yourself only when the agent needs to operate Dagu.

Managed mode supports `agent`, `model`, `variant`, `session`, `fork`, `title`, `file`, `command`, and `format: default`. OpenCode sharing is disabled in managed mode. `share: true` uses the CLI integration and may publish the conversation at a public URL; combining it with `managed: true` is rejected. Use `managed: false` for the one-shot CLI path:

```yaml
with:
  provider: opencode
  managed: false
  format: json
  prompt: Review the current branch.
```

Containers, non-default output formats, unsupported OpenCode flags, standalone scheduler launches, embedded-engine runs, and direct Dagu CLI execution use the CLI path automatically. Set `managed: true` when falling back would be undesirable; Dagu then reports a configuration or host-availability error. Automatic fallback occurs only before a managed session is created.

"Allow for this Dagu session" applies only OpenCode's proposed wildcard scope to the current Dagu session generation. Dagu answers matching later requests once and never stores an OpenCode process-wide `always` grant.

Dagu-created and forked OpenCode sessions belong to the DAG run, not to one attempt. They remain available after success, failure, abort, and retry. Manual DAG-run deletion and history retention enqueue their removal; Dagu completes that cleanup when the owning server or worker is available. Sessions supplied with `session:` are externally owned and are never deleted by Dagu.

**Start clean session** creates a new conversation generation and retries the step with its original prompt. Previous generations remain registered until the DAG run is deleted. This does not revert file changes already made in the workspace.

The managed server shares one service identity among trusted workflows in the same Dagu process. Use separate workers or containerized CLI execution for untrusted workloads that need isolation. Dagu checks required API capabilities at host startup rather than relying on a version range; OpenCode v1.18.11 is the currently tested release.

## CLI Installation via Tools

Declare OpenCode under DAG-level [`tools`](/writing-workflows/tools) to install a pinned release for the one-shot CLI integration:

```yaml
working_dir: .

tools:
  - anomalyco/opencode@v1.18.11

secrets:
  - name: OPENROUTER_API_KEY
    provider: env
    key: OPENROUTER_API_KEY

steps:
  - id: review
    action: harness.run
    with:
      provider: opencode
      managed: false
      model: openrouter/deepseek/deepseek-v4-flash
      prompt: |
        Review the most recent commit in this repository.
        Reply with: what changed, one risk, a verdict.
```

The managed toolset is prepended to the step `PATH`, so the pinned release wins for CLI execution. It does not install the long-lived process-owned managed server. The `secrets` block supplies the CLI step only; it is not an authentication source for managed mode.

## CLI Fallback Invocation

```text
opencode run "<prompt>"
```

## Common Flags

| Flag | Type | Description |
|------|------|-------------|
| `--model` | string | Model in `provider/model` format |
| `--variant` | string | Provider-specific reasoning effort, such as `high` |
| `--pure` | boolean | Run without external plugins |

## Example

```yaml
steps:
  - name: review
    action: harness.run
    with:
      provider: opencode
      prompt: |
        Review the current branch and list problems
      model: openai/gpt-5
```

Generated invocation:

```text
opencode run "Review the current branch and list problems" --model openai/gpt-5
```

## YOLO Mode

OpenCode runs non-interactively by default when using `run` mode. For fully autonomous execution without any interactive prompts, ensure you are using the `run` subcommand and not the interactive TUI:

```yaml
steps:
  - name: auto-implement
    action: harness.run
    with:
      provider: opencode
      prompt: |
        Implement the feature described in the issue
      auto: true
```

Generated invocation:

```text
opencode run "Implement the feature described in the issue" --auto
```

For CI/CD environments, you may also want to set the `OPENCODE_API_KEY` environment variable to avoid authentication prompts.

## See Also

- [OpenCode CLI Docs](https://opencode.ai/docs/cli/)
- [Providers Directory](https://opencode.ai/docs/providers/)
- [Configuration](https://opencode.ai/docs/config/)
- [Custom Commands](https://opencode.ai/docs/commands/)
- [OpenCode on GitHub](https://github.com/anomalyco/opencode)
