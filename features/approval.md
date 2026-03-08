# Approval

Add `approval` to any step to pause execution after the step completes and wait for human review.

## Usage

```yaml
steps:
  - name: deploy-staging
    command: ./deploy.sh staging
    approval:
      prompt: "Verify staging deployment before production"
  - name: deploy-prod
    depends: [deploy-staging]
    command: ./deploy.sh production
```

The `deploy-staging` step runs `./deploy.sh staging`, then enters `Waiting` status. The `deploy-prod` step remains `Not Started` until the approval is resolved.

## Configuration

| Field | Type | Description |
|-------|------|-------------|
| `prompt` | string | Message displayed to the approver |
| `input` | string[] | Parameter names to collect from the approver |
| `required` | string[] | Parameters that must be provided (subset of `input`) |

All fields are optional. A bare `approval: {}` is valid — no prompt, no inputs, just a pause.

Validation: every entry in `required` must also appear in `input`. The build fails otherwise.

## How It Works

1. The step executes normally (command runs, produces stdout/stderr)
2. After successful execution, the step enters `Waiting` status
3. The DAG status becomes `Waiting`
4. Dependent steps remain `Not Started`
5. A human reviews the step output and chooses one of:
   - **Approve** — step succeeds, dependents execute
   - **Push back** — step resets to `Not Started` and re-executes (see [Push-back](#push-back))
   - **Reject** — step enters `Rejected` status, DAG becomes `Rejected`, dependents are aborted

## Examples

### Collecting Inputs

Approved inputs become environment variables in subsequent steps:

```yaml
type: graph
steps:
  - name: generate-plan
    command: ./generate-migration-plan.sh
    approval:
      prompt: "Review migration plan"
      input: [APPROVED_BY, MAINTENANCE_WINDOW]
      required: [APPROVED_BY]
  - name: execute-migration
    depends: [generate-plan]
    command: ./migrate.sh --approver "${APPROVED_BY}" --window "${MAINTENANCE_WINDOW}"
```

`APPROVED_BY` must be provided (it's in `required`). `MAINTENANCE_WINDOW` is optional. Both are injected as environment variables into `execute-migration` after approval.

### Gating a Sub-DAG

Use `call` with `approval` to gate a multi-step workflow behind a single approval point. The sub-DAG runs to completion first, then the step waits for review:

```yaml
type: graph
steps:
  - name: run-integration-tests
    call: integration-test-suite
    approval:
      prompt: "Review test results before deploying"
  - name: deploy
    depends: [run-integration-tests]
    command: ./deploy.sh production
```

The `integration-test-suite` DAG (which may contain many steps internally) executes fully. Once finished, `run-integration-tests` enters `Waiting`. The approver reviews the sub-DAG's results before `deploy` proceeds.

This pattern is useful when you want human review over a complex operation that involves multiple internal steps — tests, builds, migrations — without adding approval to each individual sub-step.

### Approval Before a Sub-DAG

The reverse pattern: approve first, then trigger multi-step execution. Place approval on the step *before* a `call`:

```yaml
type: graph
steps:
  - name: review-config
    command: ./validate-deploy-config.sh production
    approval:
      prompt: "Config validated. Approve production deployment?"
      input: [DEPLOY_VERSION]
      required: [DEPLOY_VERSION]
  - name: deploy-pipeline
    depends: [review-config]
    call: production-deploy
    params: "deploy_version=${DEPLOY_VERSION}"
```

`validate-deploy-config.sh` runs and shows the configuration diff. The approver reviews it, provides `DEPLOY_VERSION`, and approves. Then `production-deploy` (a full deployment pipeline with its own steps) executes with the approved version.

## Push-back

Push-back resets a waiting step to `Not Started` and re-executes it. This is useful when a step's output needs revision — the approver provides feedback, and the step re-runs with that feedback available as environment variables.

Push-back is only available on steps with the `approval` field.

### How Push-back Works

1. A step executes and enters `Waiting`
2. The approver reviews the output and pushes back with input parameters
3. The step resets to `Not Started`
4. All transitive downstream dependents also reset to `Not Started`
5. The step re-executes with push-back inputs injected as environment variables
6. The `approvalIteration` counter increments (starts at 0, becomes 1 after first push-back)
7. The step enters `Waiting` again — the approver can approve, push back again, or reject

### Example

A step queries metrics and outputs a summary. The approver can push back with different parameters until the output looks right:

```yaml
steps:
  - name: query-metrics
    script: |
      SINCE="${SINCE:-7d}"
      GROUPING="${GROUPING:-daily}"
      echo "Querying error rates (since=$SINCE, grouping=$GROUPING)"
      curl -s "https://metrics.internal/api/errors?since=$SINCE&group=$GROUPING" \
        | jq '.[] | "\(.date): \(.count) errors (\(.rate)%)"'
    approval:
      prompt: "Review error rate summary. Push back to adjust query parameters."
      input: [SINCE, GROUPING]
  - name: send-report
    depends: [query-metrics]
    command: ./send-to-slack.sh
```

First run: `SINCE` and `GROUPING` are unset, so the script defaults to `7d` and `daily`. The approver reviews the output and pushes back with `SINCE=30d` and `GROUPING=weekly`. The step re-runs with those values, producing a different summary. The approver can push back again or approve.

### Example: Iterating on LLM Output

Use `claude -p` in a command step to generate content, then push back with feedback to regenerate:

```yaml
steps:
  - name: draft-changelog
    script: |
      PROMPT="Generate a changelog from these git commits for a public release blog post."
      if [ -n "$FEEDBACK" ]; then
        PROMPT="$PROMPT Incorporate this feedback: $FEEDBACK"
      fi
      git log --oneline v1.2.0..HEAD | claude -p "$PROMPT"
    approval:
      prompt: "Review the draft changelog. Push back with feedback to revise."
      input: [FEEDBACK]
  - name: publish
    depends: [draft-changelog]
    command: ./publish-changelog.sh
```

First run: Claude generates a changelog from the git log. The reviewer reads the output in the Approval tab and pushes back with `FEEDBACK="Make it more concise and group by feature area"`. The step re-runs, this time passing the feedback into the prompt. This loop continues until the reviewer approves.

### REST API

```bash
curl -X POST "http://localhost:8080/api/v1/dag-runs/{name}/{dagRunId}/steps/{stepName}/push-back" \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {
      "SINCE": "30d",
      "GROUPING": "weekly"
    }
  }'
```

Response:

```json
{
  "dagRunId": "...",
  "stepName": "query-metrics",
  "approvalIteration": 1,
  "resumed": true
}
```

| Field | Type | Description |
|-------|------|-------------|
| `approvalIteration` | integer | How many times this step has been pushed back |
| `resumed` | boolean | Whether the DAG run was re-enqueued for execution |

For sub-DAG runs, use the sub-DAG endpoint:

```
POST /api/v1/dag-runs/{name}/{dagRunId}/sub-dag-runs/{subDAGRunId}/steps/{stepName}/push-back
```

## Approval and Rejection

### Web UI

When steps enter `Waiting` status, an **Approval** tab appears in the DAG run view. The tab shows:

- Each waiting step with its name and prompt
- The step's stdout output inline
- **Approve** and **Retry** (push-back) buttons per step
- The current approval iteration count (if pushed back)

To reject all waiting steps at once, use the **Reject** button in the DAG run action bar (replaces the Stop button when the DAG is in `Waiting` status). An optional rejection reason can be provided.

### REST API

#### Approve a Step

```bash
curl -X POST "http://localhost:8080/api/v1/dag-runs/{name}/{dagRunId}/steps/{stepName}/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {
      "APPROVED_BY": "john@example.com"
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

The `reason` field is optional.

For sub-DAG runs, use the sub-DAG variants:

```
POST /api/v1/dag-runs/{name}/{dagRunId}/sub-dag-runs/{subDAGRunId}/steps/{stepName}/approve
POST /api/v1/dag-runs/{name}/{dagRunId}/sub-dag-runs/{subDAGRunId}/steps/{stepName}/reject
```

## Email Notifications

Configure email notifications when a workflow enters wait status:

```yaml
mail_on:
  wait: true

wait_mail:
  from: dagu@example.com
  to:
    - approvers@example.com
  prefix: "[APPROVAL REQUIRED]"
```

See [Email Notifications](/features/email-notifications) for details.

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
  - name: deploy
    command: ./deploy.sh
    approval:
      prompt: "Approve deployment"
```

The `DAG_WAITING_STEPS` environment variable contains a comma-separated list of waiting step names.

See [Lifecycle Handlers](/writing-workflows/lifecycle-handlers) for details.

## Rejection Behavior

When a step is rejected:

1. The step status changes to `Rejected`
2. The overall DAG status becomes `Rejected`
3. All dependent steps are marked as `Aborted` and will not execute
4. The `onFailure` handler is executed (if configured)

The following information is recorded:

| Field | Description |
|-------|-------------|
| `rejectedAt` | Timestamp of the rejection |
| `rejectedBy` | Username of the person who rejected (if authenticated) |
| `rejectionReason` | Optional reason provided during rejection |

## Limitations

- Steps with `approval` cannot use `worker_selector` (distributed execution) because approval state is stored locally

## See Also

- [Lifecycle Handlers](/writing-workflows/lifecycle-handlers) — Execute handlers on wait status
- [Email Notifications](/features/email-notifications) — Configure wait status emails
- [Step Types Reference](/reference/executors) — All available step types
