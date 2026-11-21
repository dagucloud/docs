---
description: Delegate work to a remote A2A agent from a workflow step with a2a.send and a2a.get_task, over JSON-RPC and HTTPS and without a model.
---

# A2A

Hand work to a remote agent that speaks the [A2A protocol](https://github.com/a2aproject/A2A) and use its result, without a model in the workflow. `a2a.send` sends one message and publishes the agent's answer: a Task to check on later, or a direct Message. `a2a.get_task` reads one Task by ID, so a step with `repeat_policy` can poll it until it ends.

Use these actions when a separately deployed agent does the work and the workflow only submits the request, waits, and uses the artifacts. To call a tool on an MCP server, see [MCP Call](/step-types/mcp). To run a coding agent CLI as a step, see [Harness Steps](/step-types/harness/).

## Requirements

- A Dagu release after v2.27.0.
- An agent that serves an A2A 1.0 Agent Card with a JSON-RPC interface over HTTPS.

## Basic Usage

Send a request, poll the task until it ends, and print its report:

```yaml
env:
  - A2A_URL: https://agents.example.com/diagnostics

secrets:
  - name: A2A_TOKEN
    provider: env
    key: A2A_TOKEN

steps:
  - id: send
    action: a2a.send
    with:
      agent_url: ${A2A_URL}
      message: Diagnose TICKET-123
      headers:
        Authorization: Bearer ${A2A_TOKEN}
    output: SEND

  - id: wait
    depends: send
    action: a2a.get_task
    with:
      agent_url: ${A2A_URL}
      task_id: ${SEND.task_id}
      history_length: 0
      headers:
        Authorization: Bearer ${A2A_TOKEN}
    output: TASK
    repeat_policy:
      repeat: until
      condition: ${TASK.state}
      expected: "re:^(completed|failed|canceled|rejected|input-required|auth-required)$"
      interval_sec: 10
      limit: 360
      on_limit: fail

  - id: report
    depends: wait
    env:
      - STATE: ${TASK.state}
      - REPORT: ${TASK.artifacts[0].parts[0].text}
    run: |
      test "$STATE" = completed || { echo "task ended as $STATE" >&2; exit 1; }
      printf '%s\n' "$REPORT"
```

Each execution of a step:

1. Reads the Agent Card with one `GET` of `<agent_url>/.well-known/agent-card.json`. An `agent_url` whose path already ends in `.json` is used as the card URL.
2. Picks the first interface on the card with `protocolBinding: JSONRPC` and `protocolVersion: 1.0`. Other interfaces are ignored.
3. Sends one JSON-RPC request: `SendMessage` for `a2a.send`, `GetTask` for `a2a.get_task`.
4. Writes the result to stdout as one JSON object.

The card is read on every execution, so each poll makes two requests. If the agent can answer with a direct Message instead of a Task, branch on the answer as in [Direct Messages](#direct-messages).

## Configuration

Both actions:

| Field | Required | Description |
|-------|----------|-------------|
| `agent_url` | Yes | Absolute `https` URL of the agent. User info, a query string, and a fragment are rejected. Set it in the DAG rather than from a parameter; see [Credentials](#credentials). |
| `headers` | No | Headers for the Agent Card and JSON-RPC requests. Use `${...}` references to [secrets](/writing-workflows/secrets) for credentials. `Content-Type`, `Accept`, `A2A-Version`, `Host`, `Content-Length`, `Idempotency-Key`, and `X-Idempotency-Key` are rejected. |
| `tenant` | No | Tenant to route the request to. Defaults to the tenant of the selected card interface. |

`a2a.send`:

| Field | Required | Description |
|-------|----------|-------------|
| `message` | Yes | Text of the user message. |
| `context_id` | No | Context to continue, such as the `context_id` of an earlier answer. |
| `return_immediately` | No | Ask the agent to answer at once instead of when the task ends. Default `true`. With `false`, set `timeout_sec` long enough for the whole task. |

`a2a.get_task`:

| Field | Required | Description |
|-------|----------|-------------|
| `task_id` | Yes | ID of the task to read, such as `${SEND.task_id}`. |
| `history_length` | No | Number of the most recent history messages to return. `0` returns none. Without it, the agent returns its default, which can be the whole history on every poll. Accepts a reference that resolves to an integer. |

Unknown fields fail validation. `task_id`, `context_id`, and `tenant` must be at most 512 characters without control characters.

## Output

A Task answer, from either action:

```json
{"kind": "task", "agent_url": "https://agents.example.com/diagnostics", "task_id": "task-1", "context_id": "ctx-1", "state": "working", "status_message": null, "history": [], "artifacts": [], "sent_message_id": "a3f0c1"}
```

| Field | Description |
|-------|-------------|
| `kind` | `task` or `message`. |
| `agent_url` | The `agent_url` the step called. |
| `tenant` | The tenant, when one applies. |
| `task_id`, `context_id` | IDs to read the task again or to continue the context. |
| `state` | The task state. See [Task States](#task-states). |
| `status_message` | The agent's status message, or `null`. |
| `history` | Messages of the task, as the agent wrote them. |
| `artifacts` | Results of the task, as the agent wrote them, such as `${TASK.artifacts[0].parts[0].text}`. |
| `metadata` | The task's metadata, when the agent sent any. |
| `sent_message_id` | `a2a.send` only: ID of the message the step sent. |

Numbers keep the digits the agent wrote, so integers beyond 2<sup>53</sup> reach later steps unchanged.

### Direct Messages

An agent can answer `a2a.send` with a Message instead of a Task. The output then has `kind: message`, `message_id`, `context_id`, `task_id` (empty when absent), `role`, `parts`, and `text`, which joins the text parts with newlines. A Message ends the exchange, so there is nothing to poll. Branch on `${SEND.kind}`:

```yaml
env:
  - A2A_URL: https://agents.example.com/diagnostics

steps:
  - id: send
    action: a2a.send
    with:
      agent_url: ${A2A_URL}
      message: Summarize TICKET-123
    output: SEND

  - id: use_message
    depends: send
    preconditions:
      - condition: ${SEND.kind}
        expected: message
    env:
      - REPLY: ${SEND.text}
    run: |
      printf 'agent replied: %s\n' "$REPLY"

  - id: wait
    depends: send
    preconditions:
      - condition: ${SEND.kind}
        expected: task
    action: a2a.get_task
    with:
      agent_url: ${A2A_URL}
      task_id: ${SEND.task_id}
      history_length: 0
    output: TASK
    repeat_policy:
      repeat: until
      condition: ${TASK.state}
      expected: "re:^(completed|failed|canceled|rejected|input-required|auth-required)$"
      interval_sec: 10
```

Text from the agent is data. Pass it to scripts through `env`, as above, never inline in `run`, so quotes or `$(...)` in it cannot change the command.

### Task States

`state` is one of `submitted`, `working`, `completed`, `failed`, `canceled`, `rejected`, `input-required`, or `auth-required`. A state is data, not a failure: the step succeeds whatever the state, so a later step must check for `completed`.

`submitted` and `working` mean the task is still running. `input-required` and `auth-required` mean the agent is waiting for someone. Poll until any state other than the first two, as in [Basic Usage](#basic-usage). With `on_limit: fail`, the polling step fails when the repeat limit ends the loop first.

## Errors

The step fails when the call fails. stdout then holds:

```json
{"error": {"kind": "auth", "message": "agent rejected credentials (HTTP 401)"}}
```

The step error starts with `a2a.send: <kind> error:` or `a2a.get_task: <kind> error:`. Text that the message quotes from the agent or its Agent Card is cut to 1 KiB.

| Kind | Meaning |
|------|---------|
| `discovery` | The Agent Card is missing, malformed, an A2A 0.3 card, without a JSON-RPC 1.0 interface, or advertises an endpoint that cannot be used. |
| `auth` | HTTP 401 or 403, or an A2A unauthenticated or unauthorized error. |
| `not_found` | The agent reports that the task does not exist: wrong `task_id`, agent, or tenant. |
| `remote` | Another A2A error from the agent. |
| `protocol` | A redirect, or a response that is not a valid A2A answer. |
| `transport` | A network failure, a response lost mid-body, or HTTP 400 or above without an A2A error. |
| `timeout` | The step or DAG timeout elapsed. |
| `canceled` | The run was stopped. |
| `output_limit` | The result is larger than the output capture limit. |

Redirects are not followed. Configure the final URL of the agent.

### Output Limit

When the step sets `output` and the result is larger than the DAG's `max_output_size` (1MB by default), the step fails with `output_limit` instead of capturing a truncated value. With `output`, `a2a.get_task` stops reading a response that is over twice the limit. Raise `max_output_size`, drop `output`, or set `history_length` to shorten the result.

For `a2a.send`, the agent has already accepted the message, so the error names `message_id` and, for a Task, its `task_id`. Read that task with `a2a.get_task` instead of sending again.

## Timeouts

Without `timeout_sec` on the step, the Agent Card request and the call share the DAG timeout when one is set, and otherwise a default of 60 seconds. Set `timeout_sec` for longer calls, such as `a2a.send` with `return_immediately: false`.

Stopping or timing out the local run does not cancel the remote task.

## Retries

`a2a.send` sends `SendMessage` once per step execution and never retries on its own. When a failure leaves open whether the agent received the message, such as a dropped connection, a lost response, a 5xx status, or a timeout, the error message says `Outcome unknown` and the error output carries `message_id`. A `retry_policy` on the step or under `defaults`, a rerun, or a `repeat_policy` on `a2a.send` sends the message again and can duplicate the remote work. Put `repeat_policy` on `a2a.get_task`, and add a retry policy to `a2a.send` only when duplicate work is acceptable.

A 401, 403, or A2A error proves that the agent did not accept the message, so those errors carry no `Outcome unknown` note.

`a2a.get_task` only reads, so a retry policy on it is safe.

## Recovery

To resume a task in a new run, for example after Dagu restarted between sending and polling, save `task_id` and `tenant` from the `a2a.send` output. A DAG that starts at `a2a.get_task` with those values and the same `agent_url` reads the same task and sends nothing:

```yaml
env:
  - A2A_URL: https://agents.example.com/diagnostics

params:
  - TASK_ID: task-123
  - TENANT: ""

secrets:
  - name: A2A_TOKEN
    provider: env
    key: A2A_TOKEN

steps:
  - id: wait
    action: a2a.get_task
    with:
      agent_url: ${A2A_URL}
      task_id: ${TASK_ID}
      tenant: ${TENANT}
      history_length: 0
      headers:
        Authorization: Bearer ${A2A_TOKEN}
    output: TASK
    repeat_policy:
      repeat: until
      condition: ${TASK.state}
      expected: "re:^(completed|failed|canceled|rejected|input-required|auth-required)$"
      interval_sec: 10

  - id: verify
    depends: wait
    env:
      - STATE: ${TASK.state}
    run: test "$STATE" = completed
```

Start it with `dagu start recover.yaml -- TASK_ID=task-123`. Credentials come from secrets again; they are not stored with the task. If Dagu stops after the agent accepted a message but before `task_id` was saved, the task ID is lost; the actions do not reconcile it.

## Credentials

Put credentials in `headers` and read them from [secrets](/writing-workflows/secrets), which Dagu resolves at run time and masks in step logs.

- `headers` are sent to the Agent Card request, and to the JSON-RPC request only when its origin (scheme, host, and port) matches `agent_url`. `https://h` and `https://h:443` are the same origin.
- With `headers` set, a card that advertises a JSON-RPC endpoint on another origin fails with `discovery`. Without `headers`, that endpoint is used.
- Redirects are never followed, and only `https` is used.
- Set `agent_url` in the DAG, for example in `env`, not from a parameter. Credentials go to whatever origin `agent_url` names, so a parameter would let whoever starts a run send them to their own server.

The step also replaces these values with `***` in its output and error messages:

- the value of a header whose name contains `auth`, `cookie`, `key`, `token`, `secret`, or `password`, in any case
- the part after the first space of such a value, such as the token in `Bearer <token>`
- the JSON-escaped form of each

Other header values are left alone, so ordinary values such as `X-Region: us` never alter the agent's result. Masking applies to string values, not to object keys.

## Not Supported

- Hosting A2A agents.
- Streaming, push notifications, canceling or listing tasks, and extended Agent Cards.
- The gRPC and HTTP+JSON bindings, A2A versions other than 1.0, and plain `http`.
- Reconciling a task whose ID was lost in a crash.

Need one of these? [Request it](https://github.com/dagucloud/dagu/issues).
