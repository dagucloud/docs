# Local AI

Use Dagu with local model servers such as Ollama, vLLM, or LM Studio when they expose an OpenAI-compatible chat API.

This applies to both:

- the Web UI agent
- workflow steps that use `type: chat`

## What Dagu Expects

For local models, Dagu expects an OpenAI-compatible **`/v1` base URL**.

Typical value:

```text
http://localhost:11434/v1
```

Dagu then calls the normal chat-completions route under that base URL.

::: warning
Enter the **base URL**, not a full endpoint. Do not paste vendor-native endpoints such as `/api/generate`.
:::

## Correct And Incorrect Base URLs

| Value entered in Dagu | Result |
|---|---|
| `http://localhost:11434/v1` | Correct |
| empty | Correct for a local Ollama server on the same machine as the Dagu process |
| `http://localhost:11434/api/generate` | Wrong |
| `http://localhost:11434/v1/chat/completions` | Wrong |

## Web UI Agent Setup

1. Start your local model server
2. Make sure the model you want is already available there
3. Open `/agent-settings`
4. Add a model with:
   - **Provider**: `Local`
   - **Model**: your installed model tag
   - **Base URL**: leave empty or set `http://localhost:11434/v1`
5. Set that model as the default if you want the built-in agent to use it

### Typical Ollama Example

- **Provider**: `Local`
- **Model**: `llama3.2`
- **Base URL**: `http://localhost:11434/v1`

## Workflow Example

```yaml
steps:
  - type: chat
    llm:
      provider: local
      model: llama3.2
      base_url: http://localhost:11434/v1
    messages:
      - role: user
        content: "Summarize this repository in one paragraph."
    output: RESULT
```

Dagu also accepts aliases such as `ollama`, `vllm`, and `llama` in workflow YAML, but they all follow the same local-model path.

## Important Networking Note

`localhost` means **the machine or container running Dagu**, not the browser.

Examples:

- if Dagu runs directly on your laptop, `localhost` usually means your laptop
- if Dagu runs in Docker or Kubernetes, `localhost` means that container or pod
- if a remote node runs the step, `localhost` means that remote node

## Current Limits On This Path

The local-model path is intended for normal text chat use.

Plan around these limits:

- Dagu expects the OpenAI-compatible route, not vendor-native endpoints
- provider-specific knobs such as Ollama native `think` options are not configured from this path
- multimodal/image message content is not the target use case here

If you need vendor-specific behavior, put that behind a compatible proxy or use the vendor tool directly outside this path.

## Troubleshooting

### `404` From Ollama

Most often the base URL is wrong. Use:

```text
http://localhost:11434/v1
```

Do not use:

- `http://localhost:11434/api/generate`
- `http://localhost:11434/v1/chat/completions`

### `model not found`

The model name in Dagu must exactly match the model tag available in your local server.

### Works On My Laptop, Fails In Dagu

Check where Dagu is actually running. If Dagu runs in Docker, Kubernetes, or on a remote node, the local server must also be reachable from there.

## External References

- [Ollama Quickstart](https://docs.ollama.com/quickstart)
- [Ollama OpenAI Compatibility](https://docs.ollama.com/api/openai-compatibility)

## Related Pages

- [Basic Chat](/features/chat/basics)
- [AI Agent](/features/agent/)
- [Models & Providers](/features/agent/settings/models)
