# Reliability

Combine built-in provider retries, model fallback, and step-level retry policies to handle rate limits and temporary provider outages.

## Model Fallback

Set `model` to an ordered array to try another provider or model after an error:

```yaml
steps:
  - id: summarize
    action: chat.completion
    with:
      model:
        - provider: openai
          name: gpt-4o
        - provider: anthropic
          name: claude-sonnet-4-6
      prompt: |
        Summarize the incident report.
```

Each model entry requires `provider` and `name`. It can override `temperature`, `max_tokens`, `top_p`, `base_url`, and `api_key_name`. Streaming is disabled while fallback is configured so a partial response from a failed model is not mixed with the next response.

## Retries and Availability

Dagu's LLM clients automatically retry transient network failures, rate-limit responses (`429`), and common server failures (`500` through `504`). When model fallback is configured, Dagu tries the next model after retries for the current model are exhausted.

Add a step-level `retry_policy` when the complete action should be attempted again after the provider retries and all fallback models fail:

```yaml
steps:
  - id: summarize
    action: chat.completion
    with:
      provider: openai
      model: gpt-4o
      stream: false
      prompt: |
        Summarize the incident report.
    retry_policy:
      limit: 2
      interval_sec: 30
      backoff: true
      max_interval_sec: 300
```

`limit: 2` allows two retries after the initial attempt. Omit `exit_code` so any completion failure is retryable; HTTP status codes such as `429` and `503` are not exposed as step exit codes. See [Step `retry_policy`](/writing-workflows/durable-execution#step-retry-policy) for all fields and delay behavior.

Use a modest retry limit because every attempt can generate another billable request. Consider `stream: false` with whole-step retries so a failed streaming attempt does not leave partial response text in the run log before the action is rerun.

If the completion can call DAG tools, a step retry may repeat tool calls from the failed attempt. Make side-effecting tools idempotent or avoid retrying the complete action.

Do not use `repeat_policy` for failure recovery. A repeat policy intentionally runs the step again according to its condition and can repeat a successful completion; `retry_policy` runs only after failure.

## Retry Order

For each completion action, recovery happens in this order:

1. The selected provider retries retryable HTTP and transport failures.
2. If configured, Dagu tries the next fallback model.
3. After all models fail, the step's `retry_policy` can rerun the complete action.

## Related

- [LLM Completion](/step-types/llm/) for basic usage and configuration
- [Providers & Endpoints](/step-types/llm/providers) for provider and fallback endpoint configuration
- [Durable Execution](/writing-workflows/durable-execution) for step, default, and DAG retry policies

