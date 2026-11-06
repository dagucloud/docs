# Human-in-the-Loop

A workflow can stop at a step until a person acts on it. Two step forms do this: a [human task](/writing-workflows/human-tasks) waits for input before work continues, and an [approval gate](/writing-workflows/approval) waits for a review of the step it is attached to.

## Choosing a Step Form

| | Human task | Approval gate |
|---|---|---|
| YAML | Standalone step with `action: human.task` | `approval` field on an executable step |
| Before waiting | Runs nothing | Runs the step's command or action |
| Reviewer actions | Complete; push back when `with.push_back` is set | Approve, push back, or reject |
| Collected values | Typed form values, published as step outputs | String inputs, exposed as environment variables to downstream steps |
| Placement | Root DAGs, locally or on a distributed worker | Root DAGs and sub-DAGs; the DAG cannot set `worker_selector` |
| Act from | Web UI, REST API, local CLI | Web UI, REST API |

Use a human task when later steps need a decision or typed values from a person, or when a person reviews results that earlier steps produced. Use an approval gate when a person reviews the output of the step the gate is attached to, or must be able to reject the run.

## Lifecycle

```text
step becomes ready
        │
        ▼
runs its command                  (approval gate only)
        │
        ▼
     Waiting ── push back ──────▶ restart point and its dependents
        │                         run again, then the step waits again
        │
        ├── complete / approve ──▶ Succeeded; dependents can run
        │
        └── reject ─────────────▶ Rejected; the run ends   (approval gate only)
```

While a step waits:

- The step and the DAG run have status `Waiting`. Steps that depend on the waiting step stay `Not Started`.
- Branches that do not depend on the waiting step keep running. When nothing else can run, the run stops in `Waiting` and releases its process or worker slot.
- The waiting step has no timeout. It stays open until someone acts on it or the run is stopped.

### Resuming

Each decision is stored with the run before the run resumes. The run then continues as a new attempt of the same DAG run. Completed steps keep their results and do not run again. The resumed attempt uses the DAG definition stored with the run, so edits to the YAML file after the run started do not apply to it.

A decision resumes the run as soon as a step can run, even while other steps keep waiting. The resumed attempt runs the ready branch and returns to `Waiting` for the remaining steps. The run instead stays `Waiting` until no manual step remains when:

- any step in the run has failed, been aborted, been rejected, or is waiting for a retry, so those steps run again only once, or
- the step that became ready declares build `inputs`.

Each resumed attempt checks DAG-level preconditions again and runs `handler_on.init` again. Each return to `Waiting` runs the wait handler and sends wait notifications again.

Human tasks always resume through the queue. Approval gates resume directly unless the DAG belongs to an enabled [global queue](/server-admin/queues). Queued resumes need a running scheduler.

## Notifying Reviewers

| Surface | How |
|---|---|
| [Cockpit](/web-ui/cockpit) | The **Review** column lists root runs waiting for approval or human-task input. |
| [Notification rules](/web-ui/notifications) | Include the **Waiting** event in a rule. |
| [Wait handler](/writing-workflows/lifecycle-handlers) | `handler_on.wait` runs a step. `DAG_WAITING_STEPS` holds the comma-separated names of the waiting steps. |
| [Wait email](/writing-workflows/email-notifications) | Set `mail_on.wait: true` and configure `wait_mail`. |

```yaml
mail_on:
  wait: true

wait_mail:
  from: dagu@example.com
  to:
    - approvers@example.com
  prefix: "[REVIEW REQUIRED]"

handler_on:
  wait:
    run: './notify-slack.sh "Review required: $DAG_WAITING_STEPS"'

steps:
  - id: deploy_staging
    run: ./deploy.sh staging
    approval:
      prompt: Verify staging before production

  - id: deploy_prod
    depends: [deploy_staging]
    run: ./deploy.sh production
```

## Push-back

Push-back sends work back instead of accepting it. Dagu resets a restart point and every step downstream of it to `Not Started`, runs them again with the reviewer's feedback, and opens the checkpoint again. The reviewer can then accept the new result or push back again. Each push-back increments the iteration count.

| | Human task | Approval gate |
|---|---|---|
| Enabled by | [`with.push_back`](/writing-workflows/human-tasks#requesting-changes) | Always available |
| Restart point | `with.push_back.rewind_to`, an upstream step | The step itself, or [`approval.rewind_to`](/writing-workflows/approval#push-back) |
| Feedback | Fields declared in `with.push_back.form` | Any keys; `approval.input` limits the keys the step sees |
| Web UI action | **Request changes** | **Retry** |

### Push-back Context

Every step that runs again because of a push-back receives:

- each feedback value as an environment variable named after its key, such as `FEEDBACK`
- `DAG_PUSHBACK`, a JSON payload with the latest feedback and the push-back history, kept within 30 KiB
- `DAG_PUSHBACK_ITERATION` and `${context.pushback.iteration}`, the current iteration
- `DAG_PUSHBACK_PREVIOUS_STDOUT_FILE`, the path to the step's previous stdout log, when it had one

AI steps also receive the feedback without any wiring. A [`chat.completion`](/step-types/llm/) step continues its previous conversation with the feedback as the next user message. A [`harness.run`](/step-types/harness/) step gets a push-back block appended to its prompt, with the previous stdout as a file path only, because harness output can be large. A step that first runs after a push-back has no earlier work to revise, so its prompt stays as written, and it reads the feedback only from its environment.

The feedback of one push-back, encoded as a JSON object, is limited to 16 KiB because it is passed as environment variables. A larger push-back is rejected before the run changes.

See [Push-back Context](/writing-workflows/runtime-variables#push-back-context-dag-pushback) for the `DAG_PUSHBACK` payload format.

[Outer Loops](/ai/loops/outer-loop) builds coding-agent review on push-back: sending code back to the agent, approving plans before implementation, and handing work to a person when the agent runs out of attempts.

## Acting on a Waiting Step

| | Human task | Approval gate |
|---|---|---|
| Web UI | **Actions** tab: **Complete task**, **Request changes** | **Actions** tab: **Approve**, **Retry**; **Reject** in the run's action bar |
| REST API | [Human Task Endpoints](/web-ui/api#human-task-endpoints) | [Approval Endpoints](/web-ui/api#approval-endpoints) |
| CLI | [`dagu human-task complete`](/getting-started/cli#human-task-complete), [`dagu human-task push-back`](/getting-started/cli#human-task-push-back) | Not available |
| MCP | [`dagu_execute`](/mcp/tools#deciding-waiting-steps) `approve`, `push_back` | [`dagu_execute`](/mcp/tools#deciding-waiting-steps) `approve`, `push_back`, `reject` |

Acting on a waiting step requires permission to run DAGs in its workspace. The run records who acted: the authenticated user for Web UI, REST API, and MCP actions, and the OS user for the local CLI.
