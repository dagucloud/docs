# Lifecycle Handlers

Lifecycle handlers let you run extra steps after the main DAG completes. Use the `handler_on` block to trigger notifications, clean up resources, or kick off follow-up jobs without duplicating logic inside individual steps. Every handler runs with the canonical `DAG_RUN_STATUS` environment variable so you can branch on the final outcome inside a single script.

## Supported Triggers

| Handler | Trigger | Typical use cases |
|---------|---------|-------------------|
| `init` | Runs before any workflow steps (after DAG-level preconditions pass) | Setup tasks, acquire locks, validate environment |
| `success` | All steps completed successfully, or the DAG ended in `partially_succeeded` (some steps failed but were allowed via `continue_on`) | Deliver success notifications, enqueue downstream jobs |
| `failure` | The DAG ended with `failed` or `rejected` status (precondition failure) | Page on-call, collect diagnostics |
| `abort` | A stop request interrupted the run (manual stop, queue eviction, timeout cancellation) | Roll back partial work, release locks |
| `wait` | The DAG has paused waiting for human approval | Notify approvers, send Slack messages |
| `exit` | Always runs after the status-specific handler finishes (including when it fails or is skipped) | File system clean-up, archival tasks |

Only the handlers you define are executed. The `init` handler runs first (before any steps), then the main steps execute, then the status-specific handler runs (if present), and finally the `exit` handler runs last. The `wait` handler is special: it runs when the workflow pauses for approval, before the workflow completes.

## Basic Definition

```yaml
# dag.yaml
handler_on:
  init:
    command: acquire-lock.sh ${LOCK_NAME}   # runs before any steps
  success:
    command: notify.sh "${DAG_NAME} (${DAG_RUN_ID}) succeeded" # runs after a clean finish
  failure:
    command: alert.sh "${DAG_NAME} failed" "logs=${DAG_RUN_LOG_FILE}"
  abort:
    command: rollback.sh --lock ${LOCK_NAME}
  wait:
    command: notify-approvers.sh "${DAG_WAITING_STEPS}" # runs when waiting for approval
  exit:
    command: rm -rf /tmp/${DAG_RUN_ID} # always runs

steps:
  - command: ./extract.sh
  - command: ./load.sh
```

Each handler is a normal step definition. You can use `command`, `script`, `call` (or the legacy `run`), `executor`, containers, timeouts, or any other step field that makes sense for a single task.

## Execution Model

- The `init` handler runs first, before any main steps. If it fails, the DAG is aborted and no steps execute.
- The scheduler waits for all main steps to finish before evaluating status-specific handlers.
- It chooses the status-specific handler based on the canonical DAG status (`partially_succeeded` behaves like `success`).
- After the status-specific handler finishes (or if none was defined), the `exit` handler runs last.
- Handlers are executed sequentially and synchronously. The DAG is still considered running until they finish.
- If a handler exits with a non-zero status, the overall DAG run ends in `failed`, even if every main step succeeded.
- Handler logs appear alongside other steps in the run history and respect the same log retention policy.
- Each handler receives the `DAG_RUN_STATUS` environment variable. The value depends on when the handler runs: `running` (init), `succeeded`, `partially_succeeded`, `failed`, `rejected`, `aborted`, or `waiting` (wait handler).

## Sub-DAG Handler Isolation

**Important**: Sub-DAGs (workflows invoked via `call`) do **not** inherit `handler_on` configuration from the base DAG configuration. This design prevents unintended behavior such as:

- **Double notifications**: If a parent DAG has a failure handler that sends alerts, sub-DAGs would also trigger alerts, causing duplicate notifications.
- **Unintended cleanup**: Init, exit, or abort handlers meant for the root workflow would also run for every nested sub-DAG.

Each sub-DAG should define its own handlers explicitly if lifecycle handling is needed:

```yaml
# parent.yaml
handler_on:
  failure:
    command: notify.sh "Parent DAG failed"  # Only runs for parent

steps:
  - call: child-workflow

---
# child-workflow (in same file or separate file)
name: child-workflow
handler_on:
  failure:
    command: notify.sh "Child DAG failed"  # Define explicitly if needed

steps:
  - command: process-data.sh
```

This isolation ensures that each workflow in a hierarchy has predictable, self-contained lifecycle behavior.

## Patterns and Integrations

### Send Email with the Mail Step Type

```yaml
handler_on:
  failure:
    type: mail
    config:
      to: oncall@company.com
      from: dagu@company.com
      subject: "${DAG_NAME} failed"
      message: |
        Run ID: ${DAG_RUN_ID}
        Logs: ${DAG_RUN_LOG_FILE}
```

### Run a Follow-up DAG

```yaml
handler_on:
  success:
    call: sync-reporting
    params: |
      parent_run_id: ${DAG_RUN_ID}
```

### Guaranteed Cleanup

```yaml
handler_on:
  exit:
    command: |
      find /tmp/${DAG_RUN_ID} -maxdepth 1 -type f -delete
```

### Notify on Wait (Approval)

When using [approval steps](/features/approval), notify stakeholders:

```yaml
handler_on:
  wait:
    command: notify-slack.sh "Approval needed: ${DAG_WAITING_STEPS}"

steps:
  - name: deploy-staging
    command: ./deploy.sh staging
    approval:
      prompt: "Approve production?"
  - name: deploy-prod
    command: ./deploy.sh production
```

The `DAG_WAITING_STEPS` environment variable contains a comma-separated list of step names currently waiting for approval.

For the complete schema, refer to the [YAML specification](/reference/yaml#lifecycle-handlers). Combine handlers with the techniques from [Error Handling](/writing-workflows/error-handling) and [Data & Variables](/writing-workflows/data-variables) to build robust workflow lifecycles.
