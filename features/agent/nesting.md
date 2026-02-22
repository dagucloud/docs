# Nested Agents

Use the `call` field to invoke child DAGs that contain `type: agent` steps. This lets you compose agent workflows hierarchically — break complex agent tasks into focused child agents, chain their outputs, and run them in parallel.

## How It Works

1. A parent step uses `call: child-dag` to invoke a child DAG (a regular [sub-DAG call](/writing-workflows/control-flow#nested-workflows))
2. The child DAG contains one or more `type: agent` steps
3. Each agent calls the `output` tool → captured by the step's `output` field → included in the child DAG's output JSON
4. The parent accesses agent results via `${VAR.outputs.AGENT_OUTPUT}`

::: warning
`call` and `type: agent` cannot be on the **same** step. The `call` field sets the executor type to `dag`; adding `type: agent` on the same step will cause a validation error. Use `call` on a parent step to invoke a child DAG that *contains* agent steps.
:::

## Prerequisites

- A default model must be configured in Agent Settings (`/settings/agent`), or each agent step must specify `agent.model`
- Familiarity with [Agent Step](/features/agent/step) configuration
- Familiarity with [Nested Workflows](/writing-workflows/control-flow#nested-workflows) and [Sub DAG Outputs](/features/data-flow#sub-dag-outputs)

## Basic Example

A parent DAG calls a child DAG that contains a single agent step. The agent's output flows back to the parent.

```yaml
# parent.yaml
steps:
  - call: agent-child
    params: "TARGET_FILE=src/main.go"
    output: CHILD_RESULT

  - command: echo "Agent said - ${CHILD_RESULT.outputs.REVIEW}"
```

```yaml
# agent-child.yaml
params:
  - TARGET_FILE

steps:
  - type: agent
    messages:
      - role: user
        content: "Review the code in ${TARGET_FILE} for bugs and suggest fixes."
    output: REVIEW
```

The child DAG's output JSON looks like:

```json
{
  "name": "agent-child",
  "dagRunId": "...",
  "params": "TARGET_FILE=src/main.go",
  "outputs": {
    "REVIEW": "Found 2 potential issues..."
  },
  "status": "succeeded"
}
```

The parent accesses the agent's result via `${CHILD_RESULT.outputs.REVIEW}`.

## Inline Sub-DAGs

Define both parent and child in a single file using the `---` separator. The parent references the child by `name`.

```yaml
steps:
  - call: code-reviewer
    params: "FILE=README.md"
    output: RESULT

  - command: echo "Review - ${RESULT.outputs.SUMMARY}"

---

name: code-reviewer
params:
  - FILE

steps:
  - type: agent
    messages:
      - role: user
        content: "Summarize the contents of ${FILE} in one paragraph."
    output: SUMMARY
```

## Passing Parameters to Agent Sub-DAGs

Use `params` on the `call` step to pass values into the child DAG. The child DAG uses `${VAR}` in agent messages.

```yaml
steps:
  - call: service-analyzer
    params: "SERVICE_NAME=auth LOG_DIR=/var/log/auth"
    output: ANALYSIS

---

name: service-analyzer
params:
  - SERVICE_NAME
  - LOG_DIR

steps:
  - type: agent
    messages:
      - role: user
        content: |
          Analyze the ${SERVICE_NAME} service.
          Check logs in ${LOG_DIR} for errors from the last hour.
          Summarize root causes and suggest fixes.
    output: FINDINGS
```

The parent accesses the result via `${ANALYSIS.outputs.FINDINGS}`.

## Chaining Agent Outputs

Run multiple child agent DAGs in sequence, passing each agent's output to the next.

```yaml
steps:
  - call: analyzer-agent
    params: "REPO_PATH=/app/src"
    output: FIRST

  - call: implementer-agent
    params: "ANALYSIS=${FIRST.outputs.FINDINGS} REPO_PATH=/app/src"
    output: SECOND

  - call: verifier-agent
    params: "CHANGES=${SECOND.outputs.CHANGES} REPO_PATH=/app/src"
    output: THIRD

  - command: echo "Verification - ${THIRD.outputs.VERDICT}"
```

Each child DAG contains its own `type: agent` step focused on a specific task — analysis, implementation, or verification.

## Parallel Agent Sub-DAGs

Use `parallel.items` and `parallel.max_concurrent` to run the same agent child DAG with different parameters concurrently.

```yaml
steps:
  - call: file-reviewer
    parallel:
      items: ["src/auth.go", "src/api.go", "src/db.go"]
      max_concurrent: 3
    params: "FILE=${ITEM}"
    output: REVIEWS

  - command: |
      echo "Total: ${REVIEWS.summary.total}"
      echo "Succeeded: ${REVIEWS.summary.succeeded}"

---

name: file-reviewer
params:
  - FILE

steps:
  - type: agent
    messages:
      - role: user
        content: "Review ${FILE} for security issues. Be concise."
    output: RESULT
```

The parallel output structure aggregates all results:

```json
{
  "summary": {
    "total": 3,
    "succeeded": 3,
    "failed": 0
  },
  "results": [
    {
      "name": "file-reviewer",
      "params": "FILE=src/auth.go",
      "outputs": { "RESULT": "No issues found." },
      "status": "succeeded"
    },
    {
      "name": "file-reviewer",
      "params": "FILE=src/api.go",
      "outputs": { "RESULT": "Found SQL injection risk..." },
      "status": "succeeded"
    },
    {
      "name": "file-reviewer",
      "params": "FILE=src/db.go",
      "outputs": { "RESULT": "Connection pool not closed..." },
      "status": "succeeded"
    }
  ],
  "outputs": [
    { "RESULT": "No issues found." },
    { "RESULT": "Found SQL injection risk..." },
    { "RESULT": "Connection pool not closed..." }
  ]
}
```

Access individual results with `${REVIEWS.outputs[0].RESULT}`, `${REVIEWS.outputs[1].RESULT}`, etc.

## Mixing Agent Steps and Sub-DAG Calls

A parent DAG can have both `type: agent` steps and `call` steps. An agent step's output can feed into a sub-DAG call, or vice versa.

```yaml
steps:
  - type: agent
    messages:
      - role: user
        content: "List the top 3 files to refactor in /app/src. Output just the file paths, one per line."
    output: FILE_LIST

  - call: refactor-agent
    params: "FILES=${FILE_LIST}"
    output: REFACTOR_RESULT

  - type: agent
    messages:
      - role: user
        content: |
          The refactoring agent reported:
          ${REFACTOR_RESULT.outputs.CHANGES}

          Write a brief summary of what was changed and why.
    output: SUMMARY
```

The `plan` step (agent) identifies files, the `refactor` step (sub-DAG call) delegates the work to a child agent DAG, and the `summarize` step (agent) produces the final report.

## Examples

### Code Review Pipeline

A parent DAG delegates focused review tasks to specialized child agents, then combines the results.

```yaml
type: graph

steps:
  - name: lint-review
    call: lint-agent
    params: "REPO_PATH=/app"
    output: LINT

  - name: security-review
    call: security-agent
    params: "REPO_PATH=/app"
    output: SECURITY

  - name: docs-review
    call: docs-agent
    params: "REPO_PATH=/app"
    output: DOCS

  - type: agent
    messages:
      - role: user
        content: |
          Combine these review results into a single report:

          Lint: ${LINT.outputs.FINDINGS}
          Security: ${SECURITY.outputs.FINDINGS}
          Docs: ${DOCS.outputs.FINDINGS}
    depends: [lint-review, security-review, docs-review]
    output: FINAL_REPORT
```

In graph mode, `lint-review`, `security-review`, and `docs-review` run in parallel since they have no dependencies on each other.

### Inline Nested Agent

A single-file parent + child agent DAG.

```yaml
steps:
  - call: log-analyzer
    params: "LOG_PATH=/var/log/app.log"
    output: RESULT

  - command: echo "${RESULT.outputs.ANALYSIS}"

---

name: log-analyzer
params:
  - LOG_PATH

steps:
  - type: agent
    messages:
      - role: user
        content: "Read ${LOG_PATH} and identify the most frequent error patterns."
    output: ANALYSIS
```

### Parallel Analysis

Run the same agent child DAG across multiple inputs concurrently.

```yaml
steps:
  - call: service-health-check
    parallel:
      items: ["auth", "payments", "notifications"]
      max_concurrent: 3
    params: "SERVICE=${ITEM}"
    output: HEALTH

  - command: |
      echo "Health check complete: ${HEALTH.summary.succeeded}/${HEALTH.summary.total} passed"

---

name: service-health-check
params:
  - SERVICE

steps:
  - type: agent
    messages:
      - role: user
        content: "Check the health of the ${SERVICE} service. Report status and any issues found."
    output: STATUS
```

### Agent → Sub-DAG → Agent Chain

An agent produces a plan, a sub-DAG executes it, and another agent summarizes the results.

```yaml
steps:
  - type: agent
    messages:
      - role: user
        content: "Analyze /app/src and create a test plan. List files that need tests."
    output: TEST_PLAN

  - call: test-writer
    params: "PLAN=${TEST_PLAN}"
    output: EXECUTION

  - type: agent
    messages:
      - role: user
        content: |
          Test writing results:
          ${EXECUTION.outputs.RESULTS}

          Summarize what was accomplished and any remaining gaps.
    output: SUMMARY
```

## See Also

- [Agent Step](/features/agent/step) — Agent step configuration and tools
- [Nested Workflows](/writing-workflows/control-flow#nested-workflows) — General sub-DAG usage
- [Sub DAG Outputs](/features/data-flow#sub-dag-outputs) — Output structure and access patterns
- [Parallel Execution Outputs](/features/data-flow#parallel-execution-outputs) — Parallel output aggregation
- [Scheduled Agents](/features/agent/scheduling) — Running agent steps on a cron schedule
