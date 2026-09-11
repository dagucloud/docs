# Agent DAGs & Completions

Dagu gives a model two different jobs. A `chat.completion` step generates content inside a workflow you laid out. An Agent DAG (`type: agent`) hands the model the layout itself: it decides which step runs next until stated goals are met. This page builds from one to the other, ending with both at once.

Every example runs as-is with an `OPENROUTER_API_KEY` exported; swap the `llm` block for [any configured provider](/step-types/llm/providers).

## A model call in a fixed order

The starting point: the workflow decides everything, the model fills in content.

```yaml
secrets:
  - name: OPENROUTER_API_KEY
    provider: env
    key: OPENROUTER_API_KEY

llm:
  provider: openrouter
  model: deepseek/deepseek-v4-flash

steps:
  - id: ask
    action: chat.completion
    with:
      prompt: |
        What is 2+2? Reply with just the number.
    output: ANSWER

  - id: use_answer
    run: echo "The model said ${ANSWER}"
    depends: ask
```

The order is yours, the retries are yours, the model never chooses anything. For many workflows this is exactly right. The [LLM overview](/step-types/llm/) covers this shape and its options.

## Invert control

Add `type: agent` and the relationship flips: steps stop being a plan and become a catalog, and `tasks` state what must be true when the run is done.

```yaml
type: agent

secrets:
  - name: OPENROUTER_API_KEY
    provider: env
    key: OPENROUTER_API_KEY

llm:
  provider: openrouter
  model: deepseek/deepseek-v4-flash

steps:
  - name: disk
    description: Show filesystem usage.
    run: df -h
  - name: load
    description: Show uptime and load average.
    run: uptime

tasks:
  - name: checked
    description: Finished when both disk and load have been checked.
```

No `depends` anywhere, and none allowed: ordering belongs to the model now. Each turn it picks one action or a batch of independent actions, observes the ordered outputs after the batch settles, and decides again; the run records the decision timeline and full transcript. The steps themselves stay deterministic commands, which is the point: the model chooses *what runs*, never *what the commands are*. `max_active_steps` bounds batch concurrency.

[Agent DAGs](/writing-workflows/agent) is the full reference; the [Agent DAG examples](/writing-workflows/examples/agent) build every capability step by step, including failure recovery and asking a person.

## Generate inside the loop

The two jobs compose directly: a `chat.completion` step can sit in the agent's catalog. The model schedules it like any other action, and because finished actions are upstream of the one starting now, the completion can read their `output:` variables.

```yaml
type: agent

secrets:
  - name: OPENROUTER_API_KEY
    provider: env
    key: OPENROUTER_API_KEY

llm:
  provider: openrouter
  model: deepseek/deepseek-v4-flash

steps:
  - name: disk
    description: Show filesystem usage.
    run: df -h
    output: DISK
  - name: load
    description: Show uptime and load average.
    run: uptime
    output: LOAD
  - name: processes
    description: List processes with CPU and memory usage.
    run: ps aux | head -20
  - name: summarize
    description: Write the health summary. Run last, after the checks.
    action: chat.completion
    with:
      prompt: |
        Summarize this machine's health in three sentences:
        ${DISK}
        ${LOAD}

tasks:
  - name: triage
    description: >
      Finished when the machine has been checked and a health summary has been
      written. Inspect processes only if disk or load looks unhealthy.
```

One model decides the order and depth of the checks; the same model, invoked as a step, writes the summary. The chat step inherits the workflow's `llm` block, so composing the two costs no configuration.

When a goal cannot be settled without a person, the agent's built-in `ask_user` tool opens a human task, the run releases its process while it waits, and the answer becomes the next observation. See [asking a person](/writing-workflows/examples/agent#asking-a-person).

## LLM at both layers

The ceiling of the pattern: the agent dispatches a sub-workflow, filling its parameters from the goal, and the sub-workflow runs its own completion. The model above schedules; the model below writes.

```yaml
type: agent

secrets:
  - name: OPENROUTER_API_KEY
    provider: env
    key: OPENROUTER_API_KEY

llm:
  provider: openrouter
  model: deepseek/deepseek-v4-flash

steps:
  - name: investigate
    description: Investigate a reported symptom on this machine and write findings.
    action: dag.run
    with:
      dag: investigate

tasks:
  - name: reported
    description: >
      Finished when the symptom "disk filling up" has been investigated
      and findings were written.

---
name: investigate
description: Probe the machine and write findings about a symptom.

secrets:
  - name: OPENROUTER_API_KEY
    provider: env
    key: OPENROUTER_API_KEY

llm:
  provider: openrouter
  model: deepseek/deepseek-v4-flash

params:
  - name: symptom
    type: string

steps:
  - id: probe
    run: df -h
    output: EVIDENCE

  - id: findings
    action: chat.completion
    with:
      prompt: |
        Symptom reported: ${params.symptom}

        Evidence:
        ${EVIDENCE}

        Write findings in two sentences.
    output: FINDINGS
    depends: probe
```

The `investigate` step leaves `symptom` open, so it becomes an argument of the tool offered to the agent, which fills it from the goal text: the child run receives `symptom="disk filling up"`. Inside the child, order is fixed again (`probe` then `findings`), and the child's `FINDINGS` output is reported back to the agent as the observation it settles the task against.

This is the shape that scales: a library of reviewed, parameterized sub-workflows as the vocabulary, goals as the interface, and every model decision and generation persisted per run, at both layers. See [a catalog of workflows](/writing-workflows/examples/agent#a-catalog-of-workflows) for the dispatch pattern on its own.

## Cost and control

The agent normally resends each observation on every later turn, so keep step output small and publish selectively from children with `outputs.write`. Each agent-facing observation is capped at 512 KiB by default. After the provider reports a 200,000-token prompt, older observations are compacted while the 20 most recent remain complete. Configure those values with `llm.observation_max_bytes`, `llm.max_context_tokens`, and `llm.observation_keep_recent` on the Agent DAG root. `llm.max_tool_iterations` separately bounds the run at 50 decisions by default. The [Agent DAG reference](/writing-workflows/agent#what-the-agent-sees) covers the author-facing controls, and [Agent DAG Internals](/writing-workflows/agent-internals) covers the runtime mechanics behind them, including limits, overflow recovery, and durability.

## Related

- [LLM Overview](/step-types/llm/) for `chat.completion` itself
- [Agent DAG Examples](/writing-workflows/examples/agent) for the capability-by-capability tutorial
- [When to reach for an Agent DAG](/writing-workflows/examples/agent#when-to-reach-for-an-agent-dag) for use cases and the inverse cases
