---
description: Automate desktop applications on macOS and Windows with computer.run and computer.extract, driven by a model that reads screenshots and clicks and types.
---

# Computer

Automate desktop applications that have no API, such as an ERP client or a legacy Windows program. A computer step operates the desktop of the host that runs it: a model looks at screenshots and clicks and types to complete tasks described in natural language. The step can start applications, read values from the screen into step outputs, check the screen, and pause for a person, then continue where it stopped.

Every model request goes through Dagu's own [LLM providers](/step-types/llm/providers), so the step uses the same `llm` configuration as `chat.completion`.

## Requirements

- A Dagu version newer than v2.17.2.
- macOS or Windows. On other systems the step fails with `desktop automation is supported on macOS and Windows only`.
- Dagu running in a logged-in user session with the screen unlocked. On Windows it must not run as a service. On macOS, Screen Recording and Accessibility must be granted to the application that starts Dagu, or to the `dagu` binary. See [Setting Up a Desktop Host](#setting-up-a-desktop-host).
- A model configured with a DAG-level `llm` block or `with.llm`. A computer step without one fails validation.

Run `dagu computer check` on the host to confirm it can be automated.

## Quick Start

`computer.extract` reads structured data from the screen:

```yaml
llm:
  provider: anthropic
  model: claude-sonnet-5

steps:
  - id: balance
    action: computer.extract
    with:
      instruction: The account balance shown in the banking application
      schema:
        type: object
        properties:
          balance: { type: number }
          currency: { type: string }

  - id: report
    depends: balance
    run: echo "${steps.balance.outputs.balance} ${steps.balance.outputs.currency}"
```

`computer.run` runs several operations on one desktop:

```yaml
secrets:
  - name: ERP_PASSWORD
    provider: env
    key: ERP_PASSWORD

params:
  INVOICE_ID: INV-0001

llm:
  provider: anthropic
  model: claude-opus-5

worker_selector:
  desktop: finance

steps:
  - id: post
    action: computer.run
    with:
      variables:
        password: ${ERP_PASSWORD}
      do:
        - launch: C:\Program Files\ERP\client.exe
        - act: Log in as clerk with password %password%
        - act: Open the invoice entry form and post invoice ${params.INVOICE_ID}
        - expect: {statement: A document number is shown, within: 30s}
        - extract:
            instruction: The document number in the status bar
            schema:
              type: object
              properties:
                document_number: { type: string }

  - id: record
    depends: post
    run: echo "${steps.post.outputs.document_number}"
```

On macOS, start applications through `open`:

```yaml
llm:
  provider: anthropic
  model: claude-sonnet-5

steps:
  - id: note
    action: computer.run
    with:
      do:
        - launch: {command: open, args: [-a, TextEdit]}
        - act: Create a new document and type "Hello from Dagu"
        - expect: The document shows Hello from Dagu
```

## Operations

`with.do` lists operations that run in order on one desktop. Each item sets exactly one operation:

| Operation | Value | Effect |
|-----------|-------|--------|
| `launch` | Program, or `{command, args}` | Start an application. |
| `act` | Instruction, or `{instruction, cache, max_actions}` | Complete a task described in natural language. See [Acts](#acts). |
| `extract` | `{instruction, schema}` | Read data from the screen. The schema must be a JSON Schema with `type: object`. |
| `expect` | [Condition](#conditions) | Fail the step unless the condition holds. |
| `wait` | Duration | Pause, such as `2s`. |
| `screenshot` | Name | Save a PNG of the screen as a run artifact. |
| `ask` | `{prompt, as, timeout}` | Wait for a person's answer. See [Human Input](#human-input). |

Any operation can also set:

| Field | Description |
|-------|-------------|
| `when` | A [condition](#conditions) checked before the operation. The operation is skipped unless it holds. |
| `timeout` | Maximum time for the operation, such as `30s`. Defaults to `5m`. |

`launch` starts the application in the step's working directory without a shell and does not wait for it; the application keeps running after the step ends. A string is the program itself, so a path with spaces needs no quoting. Pass arguments with `{command, args}`.

## Acts

An `act` is a whole task, not a single click. The step shows the model a screenshot, performs the pointer and keyboard actions it answers with, waits for the screen to stop changing, and sends the next screenshot with the results, until the model reports the task done. Write the instruction as a task, such as "Log in as clerk with password %password%".

An action that fails, such as a key the keyboard does not have, skips the rest of that round and is reported to the model, which can try another way.

The act fails when:

- the model reports that the task cannot be done, with its reason;
- the model twice answers without an action or a report;
- the task needs more than `max_actions` actions (`with.max_actions`, default `50`, or `max_actions` on the act);
- the model provider asks a person to confirm the next actions and `with.on_confirmation` is `fail` (the default). With `allow`, the actions run and the approval is sent with the next screenshot. To keep a person in the loop, put an [`ask`](#human-input) before such an act instead;
- the operation timeout passes.

## When a Person Uses the Desktop

A desktop that runs computer steps is often one a person also works at. Before a step launches an application, replays a recorded turn, or starts an act, it waits until nobody has touched the mouse or keyboard for `with.idle` (default `15s`), and logs `Waiting until nobody has used the desktop for 15s`. On the step's timeline, this wait is a `waiting` event named `person`. Input the step sent itself does not count, and neither does input from the computer step that used the desktop before it.

When a person uses the desktop while the model is choosing its next actions, those actions are not run, because they were chosen for a screen that may have changed. The step waits for the idle period again and sends the model the new screen with a note saying why. Skipped actions do not count toward `max_actions`.

The waiting counts toward the operation's `timeout`. An operation whose timeout passes while someone keeps working fails with `a person kept using the desktop until the operation timed out`. On a dedicated host, `idle: 0` turns the waiting off:

```yaml
with:
  idle: 0
  do:
    - act: Post the invoice
```

## Conditions

`expect` and `when` take a statement the model judges against a screenshot:

```yaml
- expect: The invoice list shows INV-0001
- act: Close the reminder dialog
  when: A reminder dialog is open
```

With `{statement, within}`, a false statement is checked again every few seconds until it holds or `within` passes:

```yaml
- expect: {statement: A document number is shown, within: 30s}
```

Each check is a model request, and results can vary between runs.

## Model

Computer steps use the DAG-level `llm` block. `with.llm` replaces it entirely for one step.

`with.mode` chooses how an `act` talks to the model:

| Mode | Behavior |
|------|----------|
| `auto` (default) | The provider's native computer-use tool for `anthropic`, `openai`, and `gemini` models that support it; plain function tools for other providers and older models. |
| `native` | The native tool only. A provider without one fails validation, and a model without one fails the step. |
| `generic` | Plain function tools, which work with any tool-calling model that accepts images, such as models through OpenRouter or a local server. |

Native tools are available on Claude Opus 4.8, Sonnet 5, and later; GPT-5.4 and later, except nano models; and Gemini 3.5 and later.

When several models are listed, an `act` moves to the next model only when a model fails before any action ran, so a half-finished task is never handed to another model. `extract` and conditions try the models in order for every request.

## Secrets and Variables

Declare secrets under `secrets:`, put them in `with.variables`, and reference them as `%name%` in `act` instructions. The model sees only the placeholder; when it types text containing `%name%`, the value is typed instead.

```yaml
secrets:
  - name: ERP_PASSWORD
    provider: env
    key: ERP_PASSWORD

llm:
  provider: anthropic
  model: claude-sonnet-5

steps:
  - id: login
    action: computer.run
    with:
      variables:
        password: ${ERP_PASSWORD}
      do:
        - act: Log in as clerk with password %password%
```

- Do not write `${ERP_PASSWORD}` inside an instruction. The step fails before operating the desktop when an `act`, `extract`, `ask`, `expect`, or `when` text contains the value of a declared secret of four or more characters.
- A `%name%` must be a `with.variables` key or the `as` of an earlier `ask`; anything else fails validation.
- Declared secrets and `ask` answers of four or more characters are masked in the step log, the timeline, and errors.
- A value typed into a field that shows it, rather than a password field, appears in later screenshots, which are sent to the model and saved as artifacts.

## What Is Sent to the Model

Each model request carries:

- screenshots of the primary display, scaled to the size the model accepts;
- the operation's instruction, or the statement a condition checks;
- the `extract` schema, and for an `act`, the results of the previous actions.

Screenshots show the whole display, including other open windows and notifications, and are not masked. Keep unrelated applications closed on a desktop host, and run it under an account that holds only what the workflows need.

## Outputs

The top-level properties each `extract` schema lists become step outputs, readable as `${steps.<id>.outputs.<name>}` and checked when the DAG loads. Fields a schema does not list are dropped. Two extracts in one step cannot list the same property.

When the step succeeds with outputs, stdout is one JSON object of them, so `output:` also works. Operation progress is written to the step's stderr log.

## Screenshots

Computer steps store screenshots as [run artifacts](/writing-workflows/artifacts) under `computer/<step id>/`, scaled to at most 1920 pixels on the long edge. A DAG with a computer step enables artifact storage automatically. Screenshots are not masked; use `screenshots: never` or `artifacts.enabled: false` to keep them out of run history.

| `with.screenshots` | Automatic screenshots |
|--------------------|-----------------------|
| `on_failure` (default) | When the step fails. |
| `final` | When the step fails, and at the end of a successful step. |
| `each` | After every operation, plus the `final` ones. |
| `never` | None. `screenshot` operations still save. |

With `artifacts.enabled: false`, no screenshots are saved and a `screenshot` operation fails.

## Replay Cache

With `with.cache` true (the default), an `act` records each screen the model saw and the actions it chose on it. The next run of the same step on the same host replays them without asking the model when the operation's position, its instruction, and the display size match, and each screen, including the area around each click, still looks as recorded. The log marks a full replay `cache-hit`. When a screen differs or an action fails, the model continues from the current screen, the new actions are recorded, and the operation is marked `healed`.

- Recordings are kept only when the whole step succeeds. When an operation fails after a replay, the step drops the recordings it replayed, so the next run asks the model again. A failure of a model request, the screen capture, a launch, or an `ask`, a person using the desktop, or a canceled run, leaves them.
- A replay follows the step's current settings: it hands the task to the model before a recorded turn that would exceed `max_actions`, or that the model provider asked a person to confirm while `on_confirmation` is not `allow`.
- Typed text is recorded with its `%name%` placeholders, never the values.
- A replay repeats recorded input whenever the screens match. Disable the cache for acts that must not repeat blindly, such as a payment, with `act: {instruction: ..., cache: false}`, or for the whole step with `with.cache: false`.
- `dagu computer cache clear <dag>` removes the recordings of every step of a DAG, or of one step with `--step <id>`. Removing all of a DAG's history with `dagu rm --history` also clears them. Both work on the host they run on.

## Trying One Step

While you reword instructions or adjust conditions, run the computer step on its own instead of the whole workflow:

```bash
dagu start --only post workflow.yaml
```

The other steps are recorded as skipped, and the run keeps the workflow's name, so the replay cache applies as in a full run. See [Running One Step](/writing-workflows/outputs#running-one-step).

## Human Input

`ask` pauses the step until someone answers in the Web UI:

```yaml
do:
  - act: Log in as clerk with password %password%
  - ask:
      prompt: Enter the 6-digit code sent to the clerk's phone
      as: otp
      timeout: 15m
    when: {statement: A verification code prompt is shown, within: 10s}
  - act: Type %otp% into the verification code field and continue
    when: A verification code prompt is shown
```

The step enters **Waiting** with the question in the step's **Agent** tab. The desktop stays as it is, and other computer steps can use it while the step waits. Answering resumes the step on the same host at the next operation, with the answer available as `%otp%` and the outputs extracted before the pause. Like a variable, the answer reaches the model only as the placeholder, so the model cannot act on what it says; it can only type it. While other steps of the run are still running, answering is rejected; try again after they finish.

Rejecting the question fails the step, so an `ask` before an act that is hard to undo works as an approval gate. An answer after `timeout` (default `1h`) fails the step, and **Start clean session** runs the step again from the first operation.

Answers are stored in the run's history, like other human input. Use `ask` for approvals and short-lived codes, not long-term secrets.

## Setting Up a Desktop Host

A computer step operates the primary display of the session Dagu runs in. `dagu computer check` reports whether that works, as the user and in the session that runs the worker:

```text
$ dagu computer check
System:  darwin
Display: 3024x1964 pixels
Ready:   computer steps can operate this desktop
```

It exits nonzero and prints a `Problem:` line for each missing condition. With `--format json` it prints the same result as JSON, with a code for each problem, for tools that prepare desktop hosts; see the [CLI reference](/getting-started/cli#computer-check).

**macOS**

- Grant **Screen Recording** and **Accessibility** in System Settings > Privacy & Security to the application that starts Dagu, such as Terminal, or to the `dagu` binary when it runs on its own. `dagu computer check` also asks macOS to show the Screen Recording and Accessibility prompts for the permissions that are missing.
- macOS ties the grants to the binary. After replacing an unsigned `dagu` binary, grant them again.
- Keep the user logged in and turn off the automatic screen lock. While a step uses the desktop, Dagu keeps the display and the Mac awake, but a screen that locks, or another user's session taking the display, fails the step.

**Windows**

- Run Dagu in the user's logged-in session, for example from Task Scheduler with **Run only when user is logged on**, or from the Startup folder. A Windows service runs in session 0, which has no desktop.
- Sign the user in automatically and turn off the screen lock. While a step uses the desktop, Dagu keeps the display and the system awake, but a locked screen or a secure prompt fails the step.
- Over Remote Desktop, a minimized or disconnected session stops rendering. Use the console session, or keep the remote window open.
- Input cannot reach windows that run as administrator, such as UAC prompts, unless Dagu runs elevated too.

One computer step at a time uses a user's desktop, across every Dagu process that user runs on the host, even ones with different data directories. A step that finds the desktop in use waits for it and logs `Waiting for another computer step to finish using the desktop`, recorded on its timeline as a `waiting` event named `desktop`.

## Distributed Mode

Computer steps run on the worker that picks them up, so route computer DAGs to desktop workers with a DAG-level `worker_selector` and [worker labels](/server-admin/distributed/worker-labels):

```yaml
worker_selector:
  desktop: finance
```

The replay cache and the state of a paused step are stored on that worker. An answered `ask` resumes on the same worker, and `dagu computer cache clear` must run there.

## Web UI

The step's **Agent** tab shows each operation with its status, token use, and screenshot thumbnails, and holds pending questions.

## Options

`computer.run` takes:

| Field | Description |
|-------|-------------|
| `do` | Operations to run in order. Required. |
| `variables` | Values referenced as `%name%` in instructions. |
| `mode` | `auto`, `native`, or `generic`. See [Model](#model). |
| `max_actions` | Actions an `act` may perform. Defaults to `50`. |
| `on_confirmation` | `fail` (default) or `allow`, for model provider confirmation requests. |
| `idle` | How long nobody may have used the desktop before the step sends input, such as `30s`. Defaults to `15s`; `0` turns it off. See [When a Person Uses the Desktop](#when-a-person-uses-the-desktop). |
| `screenshots` | `on_failure`, `final`, `each`, or `never`. |
| `cache` | Record and replay acts. Defaults to `true`. |
| `llm` | Model configuration that replaces the DAG-level `llm` block. |

`computer.extract` takes `instruction` and `schema`, with optional `timeout`, `mode`, `screenshots`, and `llm`, and behaves as `computer.run` with one `extract` operation.

## Safety

- Everything on the screen is sent to the model and is untrusted. A document, email, or web page that is visible can try to steer an `act`. Keep instructions specific and follow important acts with an `expect`.
- The model acts with the permissions of the logged-in user on whatever is on screen. Use a dedicated account or virtual machine for desktop hosts.
- Put an `ask` before acts that are hard to undo, and disable the replay cache for them.
- Screenshots saved as artifacts can show personal data. Use `screenshots: never` when they must not be kept.

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `desktop automation is supported on macOS and Windows only` | The step ran on another system. | Route the DAG to a macOS or Windows worker with `worker_selector`. |
| `the process runs in session 0, which has no desktop` | Dagu runs as a Windows service. | Run the worker in a logged-in user session. See [Setting Up a Desktop Host](#setting-up-a-desktop-host). |
| `the input desktop is not accessible; the screen may be locked` | The Windows screen is locked or a secure prompt is shown. | Unlock the screen and turn off the screen lock. |
| `the screen is locked; unlock it and keep it unlocked while computer steps run` | The Mac screen locked before or during the step. | Unlock it and turn off the automatic screen lock. |
| `another user's session has the display; switch back to this user` | Fast user switching moved the Mac's display to another user. | Switch back to the user that runs Dagu. |
| `a person kept using the desktop until the operation timed out` | Someone used the mouse or keyboard for the whole operation timeout. | Run the step when the desktop is free, raise `timeout`, or set `idle: 0` on a dedicated host. |
| `Screen Recording permission is missing` or `Accessibility permission is missing` | macOS has not granted the permission to the process that runs Dagu. | Grant it in System Settings > Privacy & Security, then restart Dagu. |
| `SendInput delivered ... events; the target may run elevated or the desktop is locked` | The target window runs as administrator, or the screen locked. | Run Dagu elevated, or keep the screen unlocked. |
| `the task needed more than max_actions (...) actions` | The act is too large, or the model is going in circles. | Split the task into smaller acts, or raise `max_actions`. |
| `the model could not complete the task: ...` | The model reported the task impossible from what it saw. | Look at the failure screenshot; fix the instruction or the starting screen. |
| `the model stopped without reporting the task done` | The model answered twice without acting. | Make the instruction concrete, or try another model. |
| `the model provider asks a person to confirm the next actions (...)` | The provider's safety check wants a person to approve. | Add an `ask` before the act and set `on_confirmation: allow`. |
| `provider "..." has no native computer use; set mode to "generic"` | `mode: native` with a provider that has no native tool. | Use `mode: auto` or `generic`. |
| `the model does not support the provider's native computer use` | `mode: native` with an older model. | Use a newer model, or `mode: auto`. |
| `contains the value of secret ...` | A declared secret is written in an instruction. | Pass it in `with.variables` and reference it as `%name%`. |
| `act references %name%, which is not in with.variables or an earlier ask` | A misspelled or missing variable. | Add it to `with.variables` or fix the name. |
| `computer actions need a model` | No `llm` block applies to the step. | Add a DAG-level `llm` block or `with.llm`. |
| `act did not finish within ...` | The act ran past its `timeout`. | Raise the operation's `timeout`, or split the task. |

## Not Supported Yet

- Linux desktops.
- Displays other than the primary one.
- Operating a desktop from a Dagu process that runs as a service, or from another machine.

## Related

- [Browser](/step-types/browser)
- [LLM Providers](/step-types/llm/providers)
- [Artifacts](/writing-workflows/artifacts)
- [Worker Labels](/server-admin/distributed/worker-labels)
- [CLI Reference](/getting-started/cli#computer-check)
