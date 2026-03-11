# AI Agent

The Dagu agent is an LLM-powered assistant integrated into the Web UI. It can read, create, and modify your workflows through a chat interface with tool-calling capabilities.

## Quick Setup

1. **Enable the agent** — Toggle it on in the Web UI at `/agent-settings`, or set the environment variable `DAGU_AGENT_ENABLED=true`.

2. **Add a model** — Click **Add Model** in the settings page and configure an LLM provider. Supported providers: `anthropic`, `openai`, `gemini`, `openrouter`, `local` (Ollama, vLLM, etc.).

3. **Set a default model** — Click the star icon next to a model to make it the default.

Once configured, click the **Agent** button at the bottom-left corner of any page to start chatting.

## Available Tools

The agent has access to 12 built-in tools:

| Tool | Description |
|------|-------------|
| `bash` | Execute shell commands (120s default timeout, 600s max) |
| `read` | Read file contents with line numbers |
| `patch` | Create, edit, or delete files |
| `think` | Record reasoning without side effects |
| `navigate` | Open pages in the Dagu UI |
| `ask_user` | Prompt the user with options or free-text input |
| `read_schema` | Look up DAG YAML schema documentation |
| `delegate` | Spawn sub-agents for parallel tasks |
| `use_skill` | Execute a skill from the skill store |
| `search_skills` | Search available skills by query |
| `remote_agent` | Delegate tasks to agents on remote nodes |
| `list_remote_nodes` | List available remote nodes |

Tools can be individually enabled or disabled in the Tool Policy section of the settings page.

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

Run `dagu ai install` to teach external AI coding tools (Claude Code, Codex, Gemini CLI, etc.) how to write correct Dagu DAG files. The command auto-detects installed tools and copies skill files into each tool's configuration directory.

```bash
# Interactive — prompts for each detected tool
dagu ai install

# Non-interactive — installs to all detected tools
dagu ai install --yes
```

See [`ai` in CLI Commands](/getting-started/cli#ai) for details.

## See Also

- [Full Agent Documentation](/features/agent/) — Complete guide to the agent's features and configuration
- [Agent Step](/features/agent/step) — Using the agent as a workflow step
- [Tools Reference](/features/agent/tools) — Detailed tool parameter documentation
- [Basic Chat](/features/chat/basics) — Single-shot LLM calls in workflows
