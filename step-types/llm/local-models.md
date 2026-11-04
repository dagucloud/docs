# Local Models

Use Dagu with local model servers such as Ollama, llama.cpp, vLLM, or LM Studio when they expose an OpenAI-compatible chat API.

This guide covers workflow steps that use `action: chat.completion` with a local model provider.

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

## Valid and Invalid Base URLs

| Value entered in Dagu | Result |
|---|---|
| `http://localhost:11434/v1` | Correct |
| `http://localhost:8080/v1` | Correct for a default llama.cpp `llama-server` |
| empty | Correct for a local Ollama server on the same machine as the Dagu process |
| `http://localhost:11434/api/generate` | Wrong |
| `http://localhost:11434/v1/chat/completions` | Wrong |

## Workflow Example

```yaml
steps:
  - action: chat.completion
    with:
      provider: local
      model: llama3.2
      base_url: http://localhost:11434/v1
      messages:
        - role: user
          content: |
            Summarize this repository in one paragraph.
    output: RESULT
```

Dagu also accepts aliases such as `ollama`, `vllm`, and `llama` in workflow YAML, but they all follow the same local-model path.

## llama.cpp

`llama-server` from llama.cpp exposes the same OpenAI-compatible API, serving the model it was started with:

```sh
llama-server -m ./model.gguf --port 8080
```

```yaml
steps:
  - action: chat.completion
    with:
      provider: llama
      model: model
      base_url: http://localhost:8080/v1
      prompt: |
        Summarize this repository in one paragraph.
```

`provider: llama` is an alias for `local`. The server reports the name it serves at `/v1/models`; use that as the `model` value.

## Important Networking Note

`localhost` means **the machine or container running Dagu**, not the browser.

Examples:

- if Dagu runs directly on your laptop, `localhost` usually means your laptop
- if Dagu runs in Docker or Kubernetes, `localhost` means that container or pod
- if a remote node runs the step, `localhost` means that remote node

## Current Limitations

The local-model path is intended for standard text chat.

Consider these constraints:

- Dagu expects the OpenAI-compatible route, not vendor-native endpoints.
- Provider-specific options, such as Ollama native `think` settings, cannot be configured here.
- Images from `files` are sent as OpenAI `image_url` content parts. They reach the model only if the local server and model accept images.

If you need vendor-specific behavior, place the service behind a compatible proxy or invoke the tool directly outside this path.

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
- [llama.cpp server](https://github.com/ggml-org/llama.cpp/tree/master/tools/server)

## Related Pages

- [LLM Completion](/step-types/llm/)
- [Providers & Endpoints](/step-types/llm/providers)
