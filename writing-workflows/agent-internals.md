# Agent DAG Internals

[Agent DAGs](/writing-workflows/agent) explains how to write an Agent DAG.
This page explains how one runs: what the model is actually sent
each turn, where every limit sits, which failures end a run, and what survives
a crash or a retry. It is the page to read before putting an Agent DAG into
production, because the conversation *is* the run: its size
sets the cost, and its persistence sets the recovery story.

## The conversation

Each turn, the agent makes one completion request built from two parts:

- **A system prompt, rebuilt every turn.** Your `llm.system` text, the
  agent's own framing, every task with its current status and reason, every
  answer a person has given so far, and the rules of the loop. Task
  descriptions and collected answers are therefore paid for on every turn, not
  once.
- **The conversation history.** One assistant message per decision (containing
  every tool call the model made), one tool result per action observation, plus
  any reminders the loop injected. New observations enter at bounded size.
  When observation aging is active, older tool results are replaced with
  deterministic one-line summaries while their tool-call structure stays
  intact.

Until aging starts, requests grow with every turn: an observation added on turn
10 of a 40-turn run may be resent 30 times. That is why
[keeping reports small](/writing-workflows/agent#what-the-agent-sees)
is the main cost lever: a line saved in an observation is saved once per
remaining turn. Aging reduces the older part of the transcript, but the latest
observations stay complete so the model can reason about recent work.

## Context window

Agent context management has three settings on the root `llm` block:

```yaml
llm:
  max_context_tokens: 200000
  observation_max_bytes: 524288
  observation_keep_recent: 20
```

`max_context_tokens` is a proactive threshold, not a declaration of the
model's hard context window. After every successful decision, Dagu records the
prompt-token count reported by the provider. When that count reaches the
threshold, observation aging starts before the next decision and stays active
for the rest of the run. Dagu does not maintain a per-model context registry,
so lower the value when the provider needs more headroom for the next response.

While aging is active, the newest `observation_keep_recent` tool results remain
complete. Older results become deterministic summaries derived from the
decision timeline:

```text
turn 3: run_tests → failed (exit 1)
```

The assistant tool call, result role, and tool-call ID remain in place, so the
conversation still satisfies provider tool-calling protocols. The summaries
are saved in the run transcript and do not expand again after suspension or
`dagu retry`.

Provider overflow errors have one recovery path before model failover. Dagu
immediately ages every tool result whose summary would be smaller, including
recent results normally kept complete, then retries that decision once with
the current model. The rejected request does not consume an agent turn. If
compaction cannot reduce the request, or the rebuilt request still fails, Dagu
advances to the next configured model. The run fails if no model remains.

Zero values disable the limits independently:

- `observation_max_bytes: 0` keeps each new observation complete.
- `max_context_tokens: 0` disables proactive aging, but still allows recovery
  after a provider reports context overflow.
- `observation_keep_recent: 0` disables observation aging entirely, including
  overflow recovery.

The safeguards reduce risk, but input size still matters:

- Publish selectively from children with `outputs.write`, so internal
  variables never enter the transcript.
- Keep `llm.system` and task descriptions tight; they are resent every turn.
- Lower `llm.max_tool_iterations` for runs that should be short (the turn cap
  also caps how large the conversation can grow).
- Set `max_context_tokens` below the provider's hard window so the next decision
  and response have room to spare.

## Limits

| Limit | Default | Configurable | When hit |
|---|---|---|---|
| Turns per run | 50 | `llm.max_tool_iterations` | Run fails, naming the tasks still open. |
| Concurrent actions per turn | Unlimited | `max_active_steps` | Extra valid actions wait for a slot; `1` runs the batch serially. |
| Runs per action | 5 | No | The call is refused with an error the model reads; the run continues. |
| Questions per run | 5 | No | `ask_user` is refused; the model is told to decide with what it has. |
| Silent turns | 1 reminder | No | A second consecutive turn without a tool call fails the run. |
| Log observation | Last 40 lines each of stdout and stderr | No | Older lines never reach the model. |
| Child outputs (default listing) | 2,000 characters per value | No | Longer values are cut at the limit. |
| Stored step output | `max_output_size` (1 MiB) | Yes, per DAG | Captured output beyond the limit is not stored. |
| Agent-facing observation | 512 KiB | `llm.observation_max_bytes` | The transcript copy is truncated as valid UTF-8; stored step data stays complete. |
| Proactive aging threshold | 200,000 prompt tokens | `llm.max_context_tokens` | Older observations are compacted before the next decision. |
| Complete observations after aging | 20 most recent | `llm.observation_keep_recent` | Older observations become one-line summaries. |

Three details worth knowing:

- **A rejected call still costs a turn.** Calling a tool that does not exist,
  or with arguments that do not decode, produces an error observation and
  advances the turn counter like any other decision.
- **The turn counter survives suspension and retry.** A run that spent 30 turns
  before waiting on a person resumes with 20 left. Retrying a failed run
  continues the same budget; it does not reset it.
- **Storage and observation limits are separate.**
  [`max_output_size`](/writing-workflows/yaml-specification#history-and-output-limits)
  controls what the step stores. `llm.observation_max_bytes` controls only the
  copy added to the agent transcript. Setting either one to zero does not
  disable the other.
- **Human answers use the observation limit too.** Answers remain complete in
  their human-task records, but the copy repeated in the agent's system
  prompt is bounded by `llm.observation_max_bytes`.

## Decision calls

Every turn is a single non-streaming completion. The request carries the
model, the conversation, `temperature`, `max_tokens`, `top_p`, and the action
catalog as tools. `llm.stream` and `llm.thinking` are not applied to decision
calls. `llm.max_tokens` caps one reply, not the run.

A successful reply may contain one action call or several distinct action
calls. Dagu validates a multi-call reply as one unit before starting anything.
Every call must name a valid workflow action, no action may repeat, and the
per-action run limit must still have room. Control calls (`set_task_status` and
`ask_user`) are valid only as the sole call. If validation fails, every call
gets the same rejection and the batch has no side effects.

For a valid batch, every member's runtime context is resolved from the state at
the start of the turn, so sibling outputs are unavailable. Execution is bounded
by `max_active_steps`; failures do not cancel siblings. Events and tool results
are recorded in model call order after all members settle. If a member waits,
the complete ordered batch is persisted and no result is appended until every
waiting member finishes.

The array form of `llm.model` is an ordered fallback chain:

```yaml
llm:
  model:
    - provider: openrouter
      name: deepseek/deepseek-v4-flash
    - provider: anthropic
      name: claude-sonnet-4-5
```

The first entry is primary. A failed request is retried according to the rules
below, then the agent advances through the remaining entries. A fallback
that succeeds remains selected for later turns in the same process. If it
later fails, the agent continues forward through the chain; it does not
return to an earlier model.

Failed model requests neither advance the turn counter nor append an assistant
message. Each candidate sees the same provider-agnostic transcript, and the
assistant message produced by a successful candidate records its actual
provider and model. Entry-level `temperature`, `max_tokens`, `top_p`,
`base_url`, and `api_key_name` override the shared values for that candidate.

Transient failures are retried in two layers before a decision fails:

1. **Transport retries.** The HTTP client retries rate limits (`429`), server
   errors (`500` to `504`), and network failures up to 3 times, backing off
   exponentially from 1 second up to 30 seconds, with a 5-minute timeout per
   request.
2. **Logical retries.** Above that, the whole request is re-attempted, up to 3
   attempts in total, backing off from 1 second to 2 seconds. This catches
   interrupted responses (such as a decode failure or a connection dropped mid-body)
   and transient failures that outlived the transport retries.

Authentication failures, invalid requests, and unknown models are not retried
on the same model; they advance directly to the next candidate. Context
overflow is handled separately: when observation aging is enabled, Dagu
compacts the transcript and retries the current model once before advancing.
After every entry in a fallback chain fails, the run error identifies each
exhausted model and preserves the underlying errors. There is no step-level
`retry_policy` for decisions; the agent is not a step you configure.
`dagu retry` resumes the saved conversation rather than starting over.

## Durability and recovery

After every decision, the agent persists its state on the run: task
statuses and reasons, the decision timeline, per-action run counts, the turn
count, collected answers, whether observation aging is active, and the action
currently in flight. The conversation, including any compacted observations,
is stored as the run's chat transcript, which is the same data the **Chat** tab renders.

The selected fallback is process-local rather than persisted. A process
created by suspension recovery or `dagu retry` starts from the configured
primary, then uses the saved transcript to continue the conversation.

That persistence is what makes three things work:

- **Suspension.** When an action opens a human task, the run reports `waiting`
  and the process exits. Completing the task starts a new process that
  restores the state, reports what became of the pending action as the next
  observation, and asks for the next decision.
- **Retry as resume.** `dagu retry` on a failed run restores the same state
  and transcript. The agent continues from where it failed; it does not
  replay decisions or re-run actions that already succeeded.
- **A pinned definition.** Retry and resume replay the DAG recorded with the
  run, not the current source file. Editing the YAML between attempts changes
  future runs, never a run already underway. The model configuration, prompt,
  and catalog a run started with are the ones it finishes with.

## Cost observability

Every decision records the provider, the model, and the prompt, completion,
and total token counts on the assistant message. The **Chat** tab shows them
per message, so the growth of the conversation is visible turn by turn.

There is no aggregate budget: Dagu does not sum tokens per run or stop a run at
a spend threshold. The working controls are `llm.max_tool_iterations`, which
bounds how many completions a run can make; `llm.observation_max_bytes`, which
bounds each new observation; and `llm.max_context_tokens`, which starts aging
the older part of the transcript.

## Secrets in the transcript

Values resolved from the run scope can include secrets, and they appear in
prompts and observations. The copy sent to the provider is masked: the values
of declared `secrets` are replaced before the request leaves. The transcript
the run stores is not: it keeps the resolved values readable, so the **Chat**
tab and the run's data on disk contain them. Two consequences: treat access to
agent run data as access to the secrets the run resolved, and declare
sensitive values as `secrets` rather than plain `env` entries, because masking covers
only what is declared.
