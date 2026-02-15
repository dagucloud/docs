# Agent

Tsumugi is an AI assistant integrated into the Boltbase Web UI for workflow management.

## Accessing the Agent

Click the **Agent** button at the bottom-right corner of any page. The button shows a yellow pulsing indicator when Tsumugi is processing.

## Enabling the Agent

### Configuration Storage

Configuration is stored in `{BOLTBASE_HOME}/data/agent/config.json`:

```json
{
  "enabled": true,
  "llm": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-5",
    "apiKey": "sk-...",
    "baseUrl": ""
  }
}
```

### Environment Variables

Environment variables override JSON configuration:

| Variable | Type | Description |
|----------|------|-------------|
| `BOLTBASE_AGENT_ENABLED` | boolean | Enable or disable the agent |
| `BOLTBASE_AGENT_LLM_PROVIDER` | string | LLM provider name |
| `BOLTBASE_AGENT_LLM_MODEL` | string | Model identifier |
| `BOLTBASE_AGENT_LLM_API_KEY` | string | API key |
| `BOLTBASE_AGENT_LLM_BASE_URL` | string | Custom API endpoint |

### Web UI Configuration

Navigate to `/settings/agent` (requires admin role) to configure via the UI.

## Supported Providers

| Provider | `provider` value | Notes |
|----------|------------------|-------|
| Anthropic | `anthropic` | Claude models |
| OpenAI | `openai` | GPT models |
| Google | `gemini` | Gemini models |
| OpenRouter | `openrouter` | Multiple providers |
| Local | `local` | Ollama, vLLM, LM Studio (OpenAI-compatible) |

For `local` provider, set `baseUrl` to your local endpoint (e.g., `http://localhost:11434/v1`).

## Chat Interface

### Sessions

- Each session is persisted per user
- Select previous sessions from the dropdown in the header
- Click **+** to start a new session

### DAG Context

Provide DAG context to Tsumugi by:

1. **Automatic**: When viewing a DAG or run page, that DAG is automatically included
2. **Manual**: Click the paperclip icon to select additional DAGs

DAG context includes:
- File path
- DAG name
- Run ID and status (when viewing a specific run)

### Sending Messages

- Type in the input area at the bottom
- Press **Enter** to send (Shift+Enter for new line)
- Click the send button (arrow icon)

### Stopping

Click the **Stop** button (square icon) to cancel processing.

## Command Approval

Commands matching these patterns require explicit approval before execution:

- `rm ` - File/directory removal
- `chmod ` - Permission changes
- `boltbase start` - DAG execution

When approval is required:
1. A prompt appears showing the command and working directory
2. Click **Approve** to execute or **Reject** to cancel
3. Approval times out after 5 minutes

## Available Tools

| Tool | Description |
|------|-------------|
| `bash` | Execute shell commands |
| `read` | Read file contents |
| `patch` | Create, edit, or delete files |
| `think` | Record reasoning |
| `navigate` | Open UI pages |
| `ask_user` | Interactive prompts |
| `read_schema` | Look up DAG YAML schema |
| `web_search` | Search the internet |

See [Tools Reference](/features/agent/tools) for parameters and examples.

## See Also

- [Agent Step](/features/agent/step) - Run the agent as a workflow step (`type: agent`)
- [Tools Reference](/features/agent/tools)
- [Web UI](/overview/web-ui)
- [Chat & AI Agents](/features/chat/) - LLM sessions in DAG workflows
