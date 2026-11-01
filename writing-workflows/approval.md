# Approval Gates

Add `approval` to an executable step to pause the run after the step succeeds. A person reviews the step's output, then approves it, pushes it back to run again, or rejects the run.

To pause without running a command first, or to collect typed values, use a [human task](/writing-workflows/human-tasks) instead. [Human-in-the-Loop](/writing-workflows/human-in-the-loop) compares the two and describes the waiting and resume behavior they share.

## Quick Start

```yaml
steps:
  - id: deploy_staging
    run: ./deploy.sh staging
    approval:
      prompt: Verify the staging deployment before production

  - id: deploy_prod
    depends: [deploy_staging]
    run: ./deploy.sh production
```

`deploy_staging` runs `./deploy.sh staging`. When the command succeeds, the step and the run enter `Waiting`, and `deploy_prod` stays `Not Started`. Open the run's **Actions** tab, review the output, and select **Approve**. The run resumes and `deploy_prod` runs.

A step that fails does not wait for approval. It fails like any other step.

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `prompt` | string | Message shown to the reviewer. |
| `input` | string[] | Names of values the reviewer can provide. |
| `required` | string[] | Values that must be provided when approving. Each name must also appear in `input`. |
| `rewind_to` | string | Step name or ID that push-back restarts from. It must be this step or one of its upstream dependencies. Defaults to this step. |

All fields are optional. `approval: {}` pauses with no prompt and no inputs.

## Reviewing a Step

When a step waits, the run's **Actions** tab shows each waiting step's prompt and stdout, **Approve** and **Retry** buttons, and, after a push-back, the iteration and push-back history. The reviewer has three choices:

| Action | Web UI | Result |
|--------|--------|--------|
| Approve | **Approve** | The step succeeds and its dependents can run. |
| Push back | **Retry** | The restart point and its dependents run again with feedback, then the step waits again. |
| Reject | **Reject** in the run's action bar | The step becomes `Rejected` and the run ends. |

Approving, pushing back, and rejecting require permission to run DAGs. The run records who acted on each step.

### Approve

Approving marks the step `Succeeded`. Values provided for `input` become environment variables in downstream steps:

```yaml
steps:
  - id: generate_plan
    run: ./generate-migration-plan.sh
    approval:
      prompt: Review the migration plan
      input: [APPROVED_BY, MAINTENANCE_WINDOW]
      required: [APPROVED_BY]

  - id: execute_migration
    depends: [generate_plan]
    run: ./migrate.sh --approver "${env.APPROVED_BY}" --window "${env.MAINTENANCE_WINDOW}"
```

The reviewer must provide `APPROVED_BY`. `MAINTENANCE_WINDOW` is optional.

### Push Back

Push-back resets a waiting step to `Not Started` and runs it again with the reviewer's feedback. With `rewind_to`, Dagu resets that earlier step and every step that depends on it instead. The step then waits again, and the reviewer can approve, push back again, or reject. Each push-back increments the step's `approvalIteration`.

```yaml
steps:
  - id: prepare_report
    run: ./prepare-report.sh

  - id: draft_report
    depends: [prepare_report]
    run: ./draft-report.sh
    approval:
      prompt: Review the draft report
      input: [FEEDBACK]
      rewind_to: prepare_report

  - id: publish_report
    depends: [draft_report]
    run: ./publish-report.sh
```

Pushing back `draft_report` resets `prepare_report`, `draft_report`, and `publish_report`. `prepare_report` runs again, `draft_report` runs again and waits, and `publish_report` runs after approval.

Each step that runs again receives the feedback through the [push-back context](/writing-workflows/human-in-the-loop#push-back-context): one environment variable per feedback key, plus `DAG_PUSHBACK`, `DAG_PUSHBACK_ITERATION`, and `DAG_PUSHBACK_PREVIOUS_STDOUT_FILE`. Feedback keys are free-form. `FEEDBACK` is common, but any name works. A step that declares `approval.input` sees only those keys from an approval push-back. A step without `approval.input` sees every key.

`chat.completion` and `harness.run` steps receive the feedback automatically, including a rewound upstream AI step that has no `approval` of its own.

### Reject

While an approval waits, the run's action bar shows **Reject** in place of **Stop**. The reviewer can enter an optional reason. The rejected step becomes `Rejected`, the run ends with status `Rejected`, and steps that depend on the rejected step do not run.

The step records the rejection:

| Field | Description |
|-------|-------------|
| `rejectedAt` | Time of the rejection |
| `rejectedBy` | Name of the user who rejected, when authenticated |
| `rejectedById` | ID of the user who rejected, when authenticated |
| `rejectionReason` | Reason entered by the reviewer, if any |

## Resuming After Approval

The run resumes once an approval lets a step run. It starts directly, or through the queue when the DAG belongs to an enabled [global queue](/server-admin/queues). Queued resumes need a running scheduler. A [sub-DAG](/writing-workflows/sub-dags) run resumes only after every waiting step inside it is resolved.

### Parallel Approvals

In a root run, approving one step resumes the run even while other approvals keep waiting. The resumed attempt runs the ready branch and returns to `Waiting` for the rest.

```yaml
type: graph
steps:
  - id: build_web
    run: ./build-web.sh
    approval:
      prompt: Release the web build?

  - id: deploy_web
    depends: [build_web]
    run: ./deploy-web.sh

  - id: build_api
    run: ./build-api.sh
    approval:
      prompt: Release the API build?

  - id: deploy_api
    depends: [build_api]
    run: ./deploy-api.sh
```

Approving `build_web` runs `deploy_web` while `build_api` keeps waiting. See [Resuming](/writing-workflows/human-in-the-loop#resuming) for the cases in which the run waits until every approval is resolved.

### Recovering a Failed Resume

The approval and its inputs are stored before the run resumes. If the resume cannot be accepted, the run view shows **Approval saved; resume failed.** with a **Retry resume** button, and the REST API returns `503` with `approvalStored: true` and `resumePending: true` in `details`. Do not approve again. Select **Retry resume**, or retry only the resume:

```bash
curl -X POST "http://localhost:8080/api/v1/dag-runs/{name}/{dagRunId}/resume"
```

Retrying while the run is already queued or running does not start another execution.

## Examples

### Gating a Sub-DAG

Attach `approval` to a `dag.run` step to review the result of a whole child workflow at one point. The child DAG runs to completion, then the step waits:

```yaml
steps:
  - id: run_integration_tests
    action: dag.run
    with:
      dag: integration-test-suite
    approval:
      prompt: Review the test results before deploying

  - id: deploy
    depends: [run_integration_tests]
    run: ./deploy.sh production
```

### Approving Before a Sub-DAG

To approve before a child workflow starts, put the approval on the step before it:

```yaml
steps:
  - id: review_config
    run: ./validate-deploy-config.sh production
    approval:
      prompt: Config validated. Approve the production deployment?
      input: [DEPLOY_VERSION]
      required: [DEPLOY_VERSION]

  - id: deploy_pipeline
    depends: [review_config]
    action: dag.run
    with:
      dag: production-deploy
      params: "deploy_version=${env.DEPLOY_VERSION}"
```

The reviewer reads the validation output, enters `DEPLOY_VERSION`, and approves. `production-deploy` then runs with that version.

### Adjusting a Query

Push-back inputs can change the parameters of a step instead of carrying prose feedback:

```yaml
tools:
  - jqlang/jq@jq-1.7.1

steps:
  - id: query_metrics
    run: |
      SINCE="${SINCE:-7d}"
      GROUPING="${GROUPING:-daily}"
      echo "Querying error rates (since=$SINCE, grouping=$GROUPING)"
      curl -s "https://metrics.internal/api/errors?since=$SINCE&group=$GROUPING" \
        | jq '.[] | "\(.date): \(.count) errors (\(.rate)%)"'
    approval:
      prompt: Review the error rate summary. Push back to adjust the query.
      input: [SINCE, GROUPING]

  - id: send_report
    depends: [query_metrics]
    run: ./send-to-slack.sh
```

The first run uses `7d` and `daily`. Pushing back with `SINCE=30d` and `GROUPING=weekly` reruns the query with those values.

### Revising LLM Output from a Shell Step

`chat.completion` and `harness.run` steps receive feedback automatically. A shell step that calls an LLM CLI reads it from the environment:

```yaml
steps:
  - id: draft_changelog
    run: |
      PROMPT="Generate a changelog from these git commits for a public release blog post."
      if [ -n "$FEEDBACK" ]; then
        PROMPT="$PROMPT Incorporate this feedback: $FEEDBACK"
      fi
      git log --oneline v1.2.0..HEAD | claude -p "$PROMPT"
    approval:
      prompt: Review the draft changelog. Push back with feedback to revise it.
      input: [FEEDBACK]

  - id: publish
    depends: [draft_changelog]
    run: ./publish-changelog.sh
```

## REST API

| Action | Endpoint |
|--------|----------|
| Approve | `POST /api/v1/dag-runs/{name}/{dagRunId}/steps/{stepName}/approve` |
| Push back | `POST /api/v1/dag-runs/{name}/{dagRunId}/steps/{stepName}/push-back` |
| Reject | `POST /api/v1/dag-runs/{name}/{dagRunId}/steps/{stepName}/reject` |
| Retry a failed resume | `POST /api/v1/dag-runs/{name}/{dagRunId}/resume` |

For a step inside a sub-DAG run, insert `/sub-dag-runs/{subDAGRunId}` before `/steps`.

```bash
# Approve with inputs
curl -X POST "http://localhost:8080/api/v1/dag-runs/{name}/{dagRunId}/steps/{stepName}/approve" \
  -H "Content-Type: application/json" \
  -d '{"inputs": {"APPROVED_BY": "john@example.com"}}'

# Push back with feedback
curl -X POST "http://localhost:8080/api/v1/dag-runs/{name}/{dagRunId}/steps/{stepName}/push-back" \
  -H "Content-Type: application/json" \
  -d '{"inputs": {"SINCE": "30d", "GROUPING": "weekly"}}'

# Reject with an optional reason
curl -X POST "http://localhost:8080/api/v1/dag-runs/{name}/{dagRunId}/steps/{stepName}/reject" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Blocked by a pending security review"}'
```

DAG-run node responses expose who acted in `approvedBy`/`approvedById`, `rejectedBy`/`rejectedById`, and each `pushBackHistory` entry's `by`/`byId`. IDs may be absent on older runs or when authentication is disabled. See [Approval Endpoints](/web-ui/api#approval-endpoints) for request and response details.

## Limitations

- A DAG with approval steps cannot set `worker_selector`, and a `dag.run` step with a worker selector cannot run it as a child.
- There is no CLI command for approving, pushing back, or rejecting a step. MCP clients use [`dagu_execute`](/mcp/tools#deciding-waiting-steps) with `approve`, `push_back`, or `reject`.

## See Also

- [Human-in-the-Loop](/writing-workflows/human-in-the-loop): Choosing between approval gates and human tasks, resume rules, and notifications
- [Human Tasks](/writing-workflows/human-tasks): Pausing for typed input without running a command
- [Lifecycle Handlers](/writing-workflows/lifecycle-handlers): Running a handler when the run enters `Waiting`
- [Email Notifications](/writing-workflows/email-notifications): Sending an email when the run enters `Waiting`
