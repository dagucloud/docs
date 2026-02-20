# HITL (Human in the Loop)

Pause workflow execution until human approval is granted. The `hitl` step type enables human-in-the-loop (HITL) workflows where manual review or authorization is required before proceeding.

## Basic Usage

```yaml
steps:
  - command: ./deploy.sh staging
  - type: hitl
  - command: ./deploy.sh production
```

## Configuration

| Field | Type | Description |
|-------|------|-------------|
| `prompt` | string | Message displayed to the approver in the UI |
| `input` | string[] | Parameter names to collect from the approver |
| `required` | string[] | Parameters that must be provided (subset of `input`) |

## How It Works

1. When a HITL step executes, it immediately enters `Waiting` status
2. The workflow pauses and the DAG status becomes `Waiting`
3. Subsequent steps remain in `Not Started` status until approval or rejection
4. Approval or rejection can be performed via the Web UI or REST API
5. Upon **approval**, the HITL step succeeds and execution continues
6. Upon **rejection**, the HITL step enters `Rejected` status, the DAG status becomes `Rejected`, and dependent steps are aborted

## Examples

### With Prompt

```yaml
steps:
  - command: ./deploy.sh staging
  - type: hitl
    config:
      prompt: "Staging verified. Approve production?"
  - command: ./deploy.sh production
```

### Collecting Inputs

Collected parameters become environment variables in subsequent steps:

```yaml
steps:
  - type: hitl
    config:
      prompt: "Provide deployment details."
      input: [APPROVED_BY, RELEASE_NOTES]
      required: [APPROVED_BY]
  - command: |
      echo "Approved by: ${APPROVED_BY}"
      ./deploy.sh
```

### Parallel Branches

Use `type: graph` when you need parallel branches with approval gates:

```yaml
type: graph

steps:
  # Branch A - requires approval
  - name: approval
    type: hitl

  - name: migrate
    command: ./migrate.sh
    depends: [approval]

  # Branch B - runs independently
  - name: report
    command: ./report.sh
```

Branch B executes while Branch A waits for approval.

### Multiple Gates

```yaml
steps:
  - command: ./build.sh
  - type: hitl
    config:
      prompt: "QA: Approve for staging?"
  - command: ./deploy.sh staging
  - type: hitl
    config:
      prompt: "Release manager: Approve for production?"
  - command: ./deploy.sh production
```

## Approval and Rejection

### Web UI

1. Navigate to the DAG run in the Dagu web interface
2. The HITL step displays with "Waiting" status
3. Click the step to view the prompt and input fields
4. Fill in any required inputs and click **Approve** to continue, or click **Reject** to stop the workflow

When rejecting, you can optionally provide a reason that will be recorded with the rejection.

### REST API

#### Approve a Step

```bash
curl -X POST "http://localhost:8080/api/v1/dag-runs/{name}/{dagRunId}/steps/{stepName}/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {
      "APPROVED_BY": "john@example.com",
      "RELEASE_NOTES": "Bug fixes for v2.1"
    }
  }'
```

#### Reject a Step

```bash
curl -X POST "http://localhost:8080/api/v1/dag-runs/{name}/{dagRunId}/steps/{stepName}/reject" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Deployment blocked due to pending security review"
  }'
```

The `reason` field is optional but recommended for audit purposes.

## Email Notifications

Configure email notifications when a workflow enters wait status:

```yaml
smtp:
  host: smtp.example.com
  port: "587"
  username: ${SMTP_USER}
  password: ${SMTP_PASSWORD}

wait_mail:
  from: dagu@example.com
  to:
    - approvers@example.com
  prefix: "[APPROVAL REQUIRED]"

steps:
  - name: approval
    type: hitl
    config:
      prompt: "Please approve the deployment."
```

See [Email Notifications](/features/email-notifications) for more details.

## Wait Handler

Execute custom logic when the workflow enters wait status:

```yaml
handler_on:
  wait:
    command: |
      echo "Waiting steps: ${DAG_WAITING_STEPS}"
      curl -X POST https://slack.com/webhook \
        -d '{"text": "Approval required for ${DAG_NAME}"}'

steps:
  - name: approval
    type: hitl
```

The `DAG_WAITING_STEPS` environment variable contains a comma-separated list of waiting step names.

See [Lifecycle Handlers](/writing-workflows/lifecycle-handlers) for more details.

## Rejection Behavior

When a HITL step is rejected:

1. The step status changes to `Rejected`
2. The overall DAG status becomes `Rejected`
3. All dependent steps are marked as `Aborted` and will not execute
4. The `onFailure` handler is executed (if configured)

### Rejection Information

The following information is recorded when a step is rejected:

| Field | Description |
|-------|-------------|
| `rejectedAt` | Timestamp of the rejection |
| `rejectedBy` | Username of the person who rejected (if authenticated) |
| `rejectionReason` | Optional reason provided during rejection |

This information is visible in the Web UI and accessible via the REST API.

## Limitations

- HITL steps cannot be used with `worker_selector` (distributed execution) because approval state is stored locally

## See Also

- [Lifecycle Handlers](/writing-workflows/lifecycle-handlers) - Execute handlers on wait status
- [Email Notifications](/features/email-notifications) - Configure wait status emails
- [Step Types Reference](/reference/executors) - All available step types
