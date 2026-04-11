# AI Agent

The Dagu agent is an LLM-powered assistant integrated into the Web UI. It can read, create, and modify your workflows through a chat interface with tool-calling capabilities.

## Quick Setup

1. **Enable the agent** — Toggle it on in the Web UI at `/agent-settings`, or set the environment variable `DAGU_AGENT_ENABLED=true`.

2. **Add a model** — Click **Add Model** in the settings page and configure an LLM provider. Supported providers: `anthropic`, `openai`, `openai-codex`, `gemini`, `openrouter`, `zai`, `local` (Ollama, vLLM, etc.).

   For `openai-codex`, connect the ChatGPT Plus/Pro subscription in the model form before saving the model.

3. **Set a default model** — Click the star icon next to a model to make it the default.

Once configured, click the **Agent** button at the bottom-left corner of any page to start chatting.

If you are using Ollama or another local model server, read [Local AI](/features/chat/local-ai) before setting the `Base URL`. Dagu expects an OpenAI-compatible base such as `http://localhost:11434/v1`, not a native Ollama endpoint like `/api/generate`.

For the full built-in agent configuration surface, start with [Agent Settings](/features/agent/settings/). The settings docs are split into focused pages for models, tool policy, personality, and web search.

## Available Tools

The agent can use these built-in tools. Some are only available when the corresponding feature is configured:

| Tool | Description |
|------|-------------|
| `bash` | Execute shell commands (120s default timeout, 600s max) |
| `read` | Read file contents with line numbers |
| `patch` | Create, edit, or delete files |
| `think` | Record reasoning without side effects |
| `navigate` | Open pages in the Dagu UI |
| `ask_user` | Prompt the user with options or free-text input |
| `delegate` | Spawn sub-agents for parallel tasks |
| `remote_agent` | Delegate tasks to agents on remote nodes (when remote nodes are configured) |
| `list_contexts` | List available remote nodes for `remote_agent` (when remote nodes are configured) |

Provider-native web search is configured in model and agent settings rather than exposed as a separate callable tool.

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

Use Dagu's built-in installer:

```bash
dagu ai install --skills-dir ~/.agents/skills
```

Or use the shared `skills` CLI:

```bash
npx skills add https://github.com/dagucloud/dagu --skill dagu
```

See [`ai` in CLI Commands](/getting-started/cli#ai) for more details.

## See Also

- [Full Agent Documentation](/features/agent/) — Complete guide to the agent's features and configuration
- [Agent Settings](/features/agent/settings/) — Start here for the built-in Web UI agent settings
- [Models & Providers](/features/agent/settings/models) — Add models and set the default model
- [Tool Permissions & Bash Policy](/features/agent/settings/controls) — Control tools and bash rules
- [Personality & Web Search](/features/agent/settings/behavior) — Configure souls and provider-native search
- [Agent Step](/features/agent/step) — Using the agent as a workflow step
- [Tools Reference](/features/agent/tools) — Detailed tool parameter documentation
- [Workflow Operator](/features/bots/) — Use the built-in agent from Slack or Telegram
- [Basic Chat](/features/chat/basics) — Single-shot LLM calls in workflows
