---
description: Run an AI workflow in under five minutes. Launch a coding agent with harness.run, or let an LLM direct an Agent DAG.
---

# AI Quickstart

There are three AI surfaces:

| What you want | Start with |
|---|---|
| Run Codex, Claude Code, Copilot, OpenCode, or another agent inside a predictable workflow | [`harness.run`](#_3-run-a-coding-agent) |
| Let an LLM decide which declared action should run next | [`type: agent`](#_4-try-an-agent-dag) |
| Let an AI client inspect and control a running server | [MCP](#_5-connect-an-mcp-client) |

Start with `harness.run` when the workflow order is known and the agent has a specific job. Reach for an Agent DAG when choosing the next action is itself part of the problem. Those two run AI inside a workflow and share one OpenRouter key. MCP is the reverse direction and needs a running server instead.

## 1. Install Dagu

```bash
curl -fsSL https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.sh | bash
```

Other platforms and methods: [Quickstart](/getting-started/quickstart) and the [Installation Guide](/getting-started/installation/).

## 2. Get an OpenRouter key

One [OpenRouter](https://openrouter.ai) key reaches models from every major vendor. Sign in, create a key under **Keys**, and export it:

```bash
export OPENROUTER_API_KEY=sk-or-...
```

## 3. Run a coding agent

Save this as `review.yaml` in a Git repository. It installs a pinned OpenCode CLI for the run, asks it to review the latest commit without modifying files, and stores the response as a Markdown artifact:

```yaml
working_dir: .

tools:
  - anomalyco/opencode@v1.18.11

secrets:
  - name: OPENROUTER_API_KEY
    provider: env
    key: OPENROUTER_API_KEY

steps:
  - id: review
    action: harness.run
    with:
      provider: opencode
      model: openrouter/deepseek/deepseek-v4-flash
      prompt: |
        Review the most recent commit in this repository.
        Do not modify any files.
        Return short Markdown with: summary, risks, and verdict.
    stdout:
      artifact: ai/repository-review.md
```

Run it:

```bash
dagu start review.yaml
```

The first run downloads the pinned OpenCode release. `harness.run` is an ordinary workflow step, so it composes with dependencies, retries, approvals, and every other graph feature. The agent's response is stored at `ai/repository-review.md` in the run's artifacts.

Start the Web UI from the same directory:

```bash
dagu start-all --dags .
```

Open <http://localhost:8080>, open the `review` workflow from **Workflows**, then open **Activity** at the bottom of the page and select the **Artifacts** tab to preview or download the result.

Already have Codex, Claude Code, Copilot, or another agent installed and authenticated? Remove the `tools` block and choose that provider instead. The [Harness Run examples](/writing-workflows/examples/harness-run) cover those setups, structured results, custom harnesses, and more artifact patterns.

## 4. Try an Agent DAG

An Agent DAG solves a different problem: the model chooses which declared step runs next. Save this as `triage.yaml`:

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
  - id: disk
    description: Show filesystem usage.
    run: df -h
    output: DISK

  - id: load
    description: Show uptime and load average.
    run: uptime
    output: LOAD

  - id: processes
    description: List processes with CPU and memory usage.
    run: ps aux | head -20

  - id: summarize
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

There is no `depends` anywhere: the steps are a catalog, the task states the goal, and the model picks what runs next.

Run it:

```bash
dagu start triage.yaml
```

On a healthy machine the agent checks disk and load, skips the process listing, runs `summarize` last, and settles the task with a reason in its own words. Under load it can inspect processes first. Run it twice and the order can differ; the goal is what stays fixed.

In the Web UI, open the `triage` workflow. The **Agent** tab of **Activity** shows each decision in a timeline. The **Chat** tab holds the full transcript: what the agent saw after each step and why it settled the task.

## 5. Connect an MCP client

Steps 3 and 4 put AI inside a workflow. MCP runs the other direction: an AI client connects to a running server and operates it, using the same authenticated boundary as the REST API.

Start the server and point the client at the `/mcp` endpoint:

```bash
dagu start-all
export DAGU_MCP_URL=http://localhost:8080/mcp
```

In the client, add an HTTP (Streamable HTTP) MCP server named `dagu` with that URL. Once it connects, three tools are available: `dagu_read` for workflows and run state, `dagu_change` for scoped edits, and `dagu_execute` for run control. A good first read is the built-in authoring reference at `dagu://reference/authoring`.

Use `localhost` only when the client and the server run on the same machine. If the server uses `builtin` authentication, create an [API key](/server-admin/authentication/api-keys) and send it as a bearer token; pick a role that matches what the client should do, so `viewer` for read-only inspection and `operator` to start and stop runs.

The [MCP Quickstart](/mcp/quickstart) covers remote URLs, base paths, and the auth setup in full. [Clients](/mcp/clients/) has the exact commands per client.

## How harness.run and Agent DAGs differ

| | `harness.run` | `type: agent` |
|---|---|---|
| AI's job | Perform one scoped task | Choose the next workflow action |
| Workflow order | Declared with normal graph dependencies | Decided at runtime from the step catalog |
| Best fit | Coding, review, research, or generation inside a predictable pipeline | Triage and other workflows whose path depends on what earlier actions reveal |
| Output | Step logs, declared outputs, or artifacts | Decision timeline, transcript, and results from chosen steps |

The patterns also compose: an Agent DAG can dispatch a graph workflow containing a `harness.run` step when both adaptive planning and agent execution are useful.

## Next steps

- [Harness Run Examples](/writing-workflows/examples/harness-run) covers Codex patch review, validated JSON, zero-install OpenCode, and custom harnesses.
- [Harness](/step-types/harness/) covers providers, configuration, approvals, fallbacks, and sandboxed execution.
- [Agent DAG Examples](/writing-workflows/examples/agent) builds the feature step by step: failure recovery, asking a person, and dispatching sub-workflows.
- [Agent DAGs & Completions](/step-types/llm/agent-completions) shows how scheduling decisions and LLM generation fit together.
- [LLM Overview](/step-types/llm/) covers `chat.completion`, local models, and provider configuration.
- [MCP Tools](/mcp/tools) and [Resources](/mcp/resources) cover what a connected client can read and change.
- [AI](/ai/) compares every surface on one page, including the approval gates and sandboxing that bound what an agent can do.
