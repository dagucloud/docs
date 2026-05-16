# Steward

Dagu Steward is an LLM-powered assistant integrated into the Web UI. It can read, create, and modify your workflows through a chat interface with tool-calling capabilities.

## Quick Setup

1. **Enable Steward** — Toggle it on in the Web UI at `/agent-settings`, or set the environment variable `DAGU_AGENT_ENABLED=true`.

2. **Add a model** — Click **Add Model** in the settings page and configure an LLM provider. Supported providers: `anthropic`, `openai`, `openai-codex`, `gemini`, `openrouter`, `zai`, `local` (Ollama, vLLM, etc.).

   For `openai-codex`, connect the ChatGPT Plus/Pro subscription in the model form before saving the model.

3. **Set a default model** — Click the star icon next to a model to make it the default.

Once configured, click the **Steward** button at the bottom-left corner of any page to start chatting.

If you are using Ollama or another local model server, read [Local AI](/features/chat/local-ai) before setting the `Base URL`. Dagu expects an OpenAI-compatible base such as `http://localhost:11434/v1`, not a native Ollama endpoint like `/api/generate`.

For the full built-in steward configuration surface, start with [Steward Settings](/features/agent/settings/). The settings docs are split into focused pages for models, tool policy, personality, and web search.

## CLI Agent

Use `dagu agent` to chat with the same agent from a terminal.

```bash
dagu agent -p "create a DAG that backs up /var/log every night"
dagu agent --model gpt-4.1 -p "review this workflow"
dagu agent history
dagu agent resume <session-id>
dagu agent resume <session-id> -p "continue from here"
```

`dagu agent` uses the active CLI context. To connect to a remote Dagu server, configure it with `dagu context add` and then use `dagu context use <name>` or `dagu --context <name> agent ...`.

## Available Tools

Steward can use these built-in tools. Some are only available when the corresponding feature is configured:

| Tool | Description |
|------|-------------|
| `bash` | Execute shell commands (120s default timeout, 600s max) |
| `read` | Read file contents with line numbers |
| `patch` | Create, edit, or delete files |
| `think` | Record reasoning without side effects |
| `navigate` | Open pages in the Dagu UI |
| `ask_user` | Prompt the user with options or free-text input |
| `delegate` | Spawn sub-agents for parallel tasks |
| `web_search` | Search the web through Tavily or Firecrawl when a hosted web backend is configured |
| `web_extract` | Extract readable content from web pages through Tavily or Firecrawl when a hosted web backend is configured |
| `remote_agent` | Delegate tasks to agents on remote nodes (when remote nodes are configured) |
| `list_contexts` | List available remote nodes for `remote_agent` (when remote nodes are configured) |

Model-native web search is configured from [Web Search](/features/agent/web-search) and is not exposed as a separate callable tool.

Tools can be individually enabled or disabled in [Tool Permissions & Bash Policy](/features/agent/settings/controls).

## Agent in Workflows

You can use AI capabilities directly in your DAG steps in two ways.

### Agent Step (`type: agent`)

A multi-turn tool-calling loop — the agent reads files, runs commands, edits code, and iterates until the task is complete:

```yaml
steps:
  - id: fix_config
    type: agent
    messages:
      - role: user
        content: |
          Fix the invalid database_url in /etc/app/config.yaml
    output: RESULT
```

### Chat Step (`type: chat`)

A single-shot LLM call — send a prompt and get a response, no tool use:

```yaml
steps:
  - id: summarize
    type: chat
    llm:
      provider: openai
      model: gpt-4o
    messages:
      - role: user
        content: "Summarize today's error logs."
    output: SUMMARY
```

## AI Coding Tool Integration

Install the Dagu skill for external AI coding tools (Claude Code, Codex, Gemini CLI, etc.) so they can write correct Dagu DAG files.

Use GitHub CLI's skill installer:

```bash
gh skill install dagucloud/dagu dagu
```

See [CLI Commands](/getting-started/cli#external-ai-coding-tool-integration) for more details.

## External Chat Apps Through MCP

Use the [Dagu MCP Server](/server-admin/mcp) when an external chat app or agent client should operate a running Dagu server directly. The client connects to the Dagu HTTP endpoint, so it does not need a local Dagu binary when it can reach the server.

Typical setup:

1. Start Dagu with `dagu start-all`.
2. Configure the MCP client for Streamable HTTP at `http://localhost:8080/mcp`.
3. Add a Dagu API key or other supported auth credential when authentication is enabled.

The MCP server exposes three tools: `dagu_read`, `dagu_change`, and `dagu_execute`. `dagu_execute` includes `start`, `enqueue`, `retry`, and `stop` actions.

## See Also

- [Steward Documentation](/features/agent/) — Complete guide to Steward and its configuration
- [Steward Settings](/features/agent/settings/) — Start here for the built-in Web UI steward settings
- [Models & Providers](/features/agent/settings/models) — Add models and set the default model
- [Tool Permissions & Bash Policy](/features/agent/settings/controls) — Control tools and bash rules
- [Web Search](/features/agent/web-search) — Configure model-native search, Tavily, or Firecrawl
- [Personality](/features/agent/settings/behavior) — Configure profiles
- [Agent Step](/features/agent/step) — Using the agent as a workflow step
- [Steward Tools Reference](/features/agent/tools) — Detailed tool parameter documentation
- [Workflow Operator](/features/bots/) — Use the built-in steward from Slack or Telegram
- [MCP Server](/server-admin/mcp) — Connect external chat and agent clients to Dagu
- [Basic Chat](/features/chat/basics) — Single-shot LLM calls in workflows
