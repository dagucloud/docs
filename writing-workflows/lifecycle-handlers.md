# Lifecycle Handlers

Lifecycle handlers let you run extra steps after the main DAG completes. Use the `handler_on` block to trigger notifications, clean up resources, or kick off follow-up jobs without duplicating logic inside individual steps. Every handler runs in a status-aware context, so `${context.run.status}` is available in value-resolved fields and `DAG_RUN_STATUS` is available to scripts.

## Supported Triggers

| Handler | Trigger | Typical use cases |
|---------|---------|-------------------|
| `init` | Runs before any workflow steps (after DAG-level preconditions pass) | Setup tasks, acquire locks, validate environment |
| `success` | All steps completed successfully, or the DAG ended in `partially_succeeded` (some steps failed but were allowed via `continue_on`) | Deliver success notifications, enqueue downstream jobs |
| `failure` | The DAG ended with `failed` or `rejected` status, including DAG-level precondition evaluation errors | Page on-call, collect diagnostics |
| `abort` | The run was aborted by a stop request, queue eviction, timeout cancellation, or unmet DAG-level precondition | Roll back partial work, release locks |
| `wait` | The DAG has paused waiting for approval or human-task completion | Notify operators, send Slack messages |
| `exit` | Always runs after the status-specific handler finishes (including when it fails or is skipped) | File system clean-up, archival tasks |

Only the handlers you define are executed. The `init` handler runs first (before any steps), then the main steps execute, then the status-specific handler runs (if present), and finally the `exit` handler runs last. The `wait` handler is special: it runs when the workflow pauses for human input, before the workflow completes.

## Basic Definition

```yaml
# dag.yaml
env:
  - LOCK_NAME: daily-load

handler_on:
  init:
    run: acquire-lock.sh "${env.LOCK_NAME}"   # runs before any steps
  success:
    run: notify.sh "${context.dag.name} (${context.run.id}) succeeded" # runs after a clean finish
  failure:
    run: alert.sh "${context.dag.name} failed" "logs=${context.paths.log_file}"
  abort:
    run: rollback.sh --lock "${env.LOCK_NAME}"
  wait:
    run: notify-operators.sh "$DAG_WAITING_STEPS" # runs when waiting for human input
  exit:
    run: rm -rf "/tmp/${context.run.id}" # always runs

steps:
  - run: ./extract.sh
  - run: ./load.sh
```

Each handler is a normal step definition. You can use `run`, `script`, `action` (for built-in, official, or third-party actions), `executor`, containers, timeouts, or any other step field that makes sense for a single task.

## Execution Model

- The `init` handler runs first, before any main steps. If it fails, the DAG is aborted and no steps execute.
- The scheduler waits for all main steps to finish before evaluating status-specific handlers.
- It chooses the status-specific handler based on the canonical DAG status (`partially_succeeded` behaves like `success`).
- After the status-specific handler finishes (or if none was defined), the `exit` handler runs last.
- Handlers are executed sequentially and synchronously. The DAG is still considered running until they finish.
- If a handler exits with a non-zero status, the overall DAG run ends in `failed`, even if every main step succeeded.
- Handler logs appear alongside other steps in the run history and respect the same log retention policy.
- Each handler receives `${context.run.status}` and the `DAG_RUN_STATUS` environment variable. The value depends on when the handler runs: `running` (init), `succeeded`, `partially_succeeded`, `failed`, `rejected`, `aborted`, or `waiting` (wait handler).

## Sub-DAG Handler Isolation

**Important**: Sub-DAGs (workflows invoked via `call`) do **not** inherit `handler_on` configuration from the base DAG configuration. This design prevents unintended behavior such as:

- **Double notifications**: If a parent DAG has a failure handler that sends alerts, sub-DAGs would also trigger alerts, causing duplicate notifications.
- **Unintended cleanup**: Init, exit, or abort handlers meant for the root workflow would also run for every nested sub-DAG.

Each sub-DAG should define its own handlers explicitly if lifecycle handling is needed:

```yaml
# parent.yaml
handler_on:
  failure:
    run: notify.sh "Parent DAG failed"  # Only runs for parent

steps:
  - action: dag.run
    with:
      dag: child-workflow
---
# child-workflow (in same file or separate file)
name: child-workflow
handler_on:
  failure:
    run: notify.sh "Child DAG failed"  # Define explicitly if needed

steps:
  - run: process-data.sh
```

This isolation ensures that each workflow in a hierarchy has predictable, self-contained lifecycle behavior.

## Patterns and Integrations

### Send Email with the Mail Action

```yaml
handler_on:
  failure:
    action: mail.send
    with:
      to: oncall@company.com
      from: dagu@company.com
      subject: "${context.dag.name} failed"
      message: |
        Run ID: ${context.run.id}
        Logs: ${context.paths.log_file}
```

### Run a Follow-up DAG

```yaml
handler_on:
  success:
    action: dag.run
    with:
      dag: sync-reporting
      params: |
        parent_run_id: ${context.run.id}
```

### Guaranteed Cleanup

```yaml
handler_on:
  exit:
    run: |
      find "/tmp/${context.run.id}" -maxdepth 1 -type f -delete
```

### Notify on Wait

When using [human tasks](/writing-workflows/human-tasks) or [approval gates](/writing-workflows/approval), notify stakeholders:

```yaml
handler_on:
  wait:
    run: notify-slack.sh "Approval needed: $DAG_WAITING_STEPS"

steps:
  - id: choose_target
    action: human.task
    with:
      prompt: "Choose the production deployment target"
      form:
        type: object
        properties:
          target:
            type: string
        required: [target]
  - id: deploy_prod
    run: ./deploy.sh production
    depends: choose_target
```

The `DAG_WAITING_STEPS` environment variable contains a comma-separated list of step names currently waiting for human input.

For the complete schema, refer to the [YAML specification](/writing-workflows/yaml-specification#lifecycle-handlers). Combine handlers with the techniques from [Error Handling](/writing-workflows/error-handling) and [Data & Variables](/writing-workflows/data-variables) to build robust workflow lifecycles.
