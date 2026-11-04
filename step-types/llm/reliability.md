# Reliability

Combine built-in provider retries, model fallback, and step-level retry policies to handle rate limits and temporary provider outages.

Examples use OpenRouter; make the key reachable as shown in the [overview](/step-types/llm/#first-completion).

## Model Fallback

Set `model` to an ordered array to try another provider or model after an error:

```yaml
steps:
  - id: summarize
    action: chat.completion
    with:
      model:
        - provider: openrouter
          name: deepseek/deepseek-v4
        - provider: openrouter
          name: deepseek/deepseek-v4-flash
      prompt: |
        Summarize the incident report.
```

Each model entry requires `provider` and `name`. It can override `temperature`, `max_tokens`, `top_p`, `base_url`, and `api_key_name`, and an `openrouter` entry can set its own [`provider_order`](/step-types/llm/providers#openrouter-provider-order). Streaming is disabled while fallback is configured so a partial response from a failed model is not mixed with the next response.

Fallback applies to both `chat.completion` actions and `type: agent`
decision calls. An agent starts with the first entry and advances in order
when the current model fails. Once a fallback succeeds, later decisions in the
same process start with that model instead of probing the primary again.

A failed decision request does not consume an agent turn or append an
assistant message. The next model receives the same provider-agnostic
transcript, including every earlier decision and observation. An agent
process created by resume or `dagu retry` starts from the configured primary
again, while keeping the saved transcript. Successful decisions record the
provider and model that actually answered.

Context-overflow recovery runs before agent failover. When observation
aging is enabled, Dagu compacts the transcript and retries the current model
once. If compaction cannot reduce the request or the retry still fails, Dagu
advances to the next model. With `llm.observation_keep_recent: 0`, the recovery
attempt is disabled and a context-overflow error advances directly to the next
model. The run fails only after no configured model remains.

## Retries and Availability

Dagu's LLM clients automatically retry transient network failures, rate-limit responses (`429`), and server failures (`500`, `502`, `503`, `504`, and `529`). OpenRouter can report an upstream failure inside a `200` response; Dagu retries such an error when its code is a rate limit or a server error, and retries an answer that carries no choices and no error. When model fallback is configured, Dagu tries the next model after retries for the current model are exhausted.

Add a step-level `retry_policy` when the complete action should be attempted again after the provider retries and all fallback models fail:

```yaml
steps:
  - id: summarize
    action: chat.completion
    with:
      provider: openrouter
      model: deepseek/deepseek-v4-flash
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

For a `chat.completion` action, recovery happens in this order:

1. The selected provider retries retryable HTTP and transport failures.
2. If configured, Dagu tries the next fallback model.
3. After all models fail, the step's `retry_policy` can rerun the complete action.

For each agent decision:

1. The current model receives the provider and logical retry layers described in
   [Agent DAG Internals](/writing-workflows/agent-internals#decision-calls).
2. A context-overflow response can trigger one compaction and retry of that
   model.
3. Dagu advances through the remaining models in order.

Agent decisions do not have a step-level `retry_policy`.

## Related

- [LLM Completion](/step-types/llm/) for basic usage and configuration
- [Providers & Endpoints](/step-types/llm/providers) for provider and fallback endpoint configuration
- [Durable Execution](/writing-workflows/durable-execution) for step, default, and DAG retry policies
