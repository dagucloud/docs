---
description: Automate desktop applications on macOS and Windows with computer.run and computer.extract, driven by a model that reads screenshots and clicks and types, and replayed without one.
---

# Computer

Automate desktop applications that have no API, such as an ERP client or a legacy Windows program. A computer step operates the desktop of the host that runs it: a model looks at screenshots and clicks and types to complete tasks described in natural language. The step can start applications, read values from the screen into step outputs, check the screen, and pause for a person, then continue where it stopped.

A task that succeeded is recorded and replayed on later runs without the model, by the buttons and fields it used where the application exposes them. Checks can read the window's elements exactly instead of asking the model, so a step that repeats can run with no model at all.

Every model request goes through Dagu's own [LLM providers](/step-types/llm/providers), so the step uses the same `llm` configuration as `chat.completion`.

::: tip Prefer a desktop app?
[Kitewell](https://kitewell.app/) is a separate app for automating desktop applications on your own Mac or Windows PC without YAML.
:::

## Requirements

- Dagu v2.18.0 or later. A Dagu release after v2.22.2 is needed for [window maximizing](#window-size), [checks on values](#checks-on-values), [handlers](#screens-that-come-up-sometimes), and `check` and `uncheck`, and on macOS for [exact checks](#exact-checks), [element replay](#replaying-by-element), and [pins](#pinned-steps).
- macOS or Windows. On other systems the step fails with `desktop automation is supported on macOS and Windows only`.
- Dagu running in a logged-in user session with the screen unlocked. On Windows it must not run as a service. On macOS, Screen Recording and Accessibility must be granted to the application that starts Dagu, or to the `dagu` binary. See [Setting Up a Desktop Host](#setting-up-a-desktop-host).
- A model configured with a DAG-level `llm` block or `with.llm`, unless no operation of the step can call one. See [How Much AI Decides](#how-much-ai-decides).

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
| `act` | Instruction, or `{instruction, ai, max_actions, find_within, input, maximize, recorded}` | Complete a task described in natural language. See [Acts](#acts). |
| `extract` | `{instruction, schema, ai, max_rows, maximize, fields}` | Read data from the screen. The schema must be a JSON Schema with `type: object`. See [Outputs](#outputs). |
| `expect` | [Condition](#conditions) | Fail the step unless the condition holds. |
| `wait` | Duration | Pause, such as `2s`. |
| `screenshot` | Name | Save a PNG of the screen as a run artifact. |
| `ask` | `{prompt, as, timeout}` | Wait for a person's answer. See [Human Input](#human-input). |

Any operation can also set:

| Field | Description |
|-------|-------------|
| `when` | A [condition](#conditions) checked before the operation. The operation is skipped unless it holds, and the timeline records it as skipped with the reason. |
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

A desktop that runs computer steps is often one a person also works at. Before a step launches an application, maximizes a window, replays a recorded turn, or starts an act, it waits until nobody has touched the mouse or keyboard for `with.idle` (default `5s`), and logs `Waiting until nobody has used the desktop for 5s`. On the step's timeline, this wait is a `waiting` event named `person`. Input the step sent itself does not count, and neither does input from the computer step that used the desktop before it.

When a person uses the desktop while the model is choosing its next actions, those actions are not run, because they were chosen for a screen that may have changed. The step waits for the idle period again and sends the model the new screen with a note saying why. Skipped actions do not count toward `max_actions`.

A replay, of a recording or a [pin](#pinned-steps), checks before each action, and while it waits for an element or an exact check, whether a person used the desktop since the step's own last input. If so, it waits for the idle period, brings back the application it last found an element or saw a check hold in, with that application's front window on top so an open dialog stays above its main window, and starts the wait for the element or check over. The application carries over to the next computer step of the same run, so a person who works between two steps is handled the same way. A switch to another application that the step's own action caused, such as a click that opens another application, is left as it is.

Waiting for a person does not count toward the operation's `timeout`. A step that has waited an hour for someone to stop fails with `a person kept using the desktop for 1h 0m, so the step gave up waiting`. On a dedicated host, `idle: 0s` turns the waiting off, and actions are no longer skipped when someone uses the desktop:

```yaml
with:
  idle: 0s
  do:
    - act: Post the invoice
```

## Conditions

`expect` and `when` take a statement the model judges against a screenshot, an [exact check](#exact-checks) of the window's elements, or a [check on a value](#checks-on-values) the step was given:

```yaml
- expect: The invoice list shows INV-0001
- act: Close the reminder dialog
  when: A reminder dialog is open
```

With `{statement, within}`, a false statement is checked again every few seconds until it holds or `within` passes:

```yaml
- expect: {statement: A document number is shown, within: 30s}
```

Each statement check is a model request, and results can vary between runs.

### Exact Checks

An exact check reads the elements of the window in front, such as its buttons, fields, and labels, through Accessibility on macOS and UI Automation on Windows. It takes no screenshot and calls no model, so it gives the same answer on every run and works under `ai: never`.

| Check | Holds when |
|-------|------------|
| `{text: ...}` | The name or value of a visible element contains the text. |
| `{element: {role, name, id, near, in, nth}}` | The selector matches exactly one visible element. Several matches are a miss, never a guess. |
| `{window: ...}` | The title of the window in front contains the text. `*` matches any run of characters. |

A selector names an element by `role`, such as `button`, `text_field`, `text`, `checkbox`, `combo_box`, or `list_item`, and at least one of `name`, `id`, or `near: {label, side}`, the label the element sits next to and on which `side` (`right`, `below`, `left`, or `above`). `in` narrows the search to a container, itself a selector, and `nth` picks one of several equal matches in reading order, from 0. Names take `*` for any run of characters.

```yaml
- act: Post invoice ${params.INVOICE_ID}
- expect: {text: Posted, within: 30s}
- expect: {element: {role: button, name: Print}}
- act: Close the warning
  when: {window: "Warning*"}
```

An exact `expect` keeps looking until it holds, `within` passes, or, without `within`, the operation timeout passes. An exact `when` keeps looking for two seconds unless `within` is set. `%name%` placeholders are replaced from `with.variables` and earlier `ask` answers. A window that exposes no elements, such as one an application draws itself, is a miss while it is in front; check it with a statement instead.

`dagu computer elements` lists the elements of the window in front, and `dagu computer elements --at-pointer` the one under the pointer, to find the role and name to write. See the [CLI reference](/getting-started/cli#computer-elements).

Exact checks need macOS or 64-bit Windows. On other hosts the step fails at the first one with `exact checks need macOS or 64-bit Windows`.

### Checks on Values

`{value, equals}` holds when the value is the text, and `{value, not_equals}` when it is not. The value is data the step was given, such as a parameter, an earlier step's output, or a `%name%` placeholder from `with.variables` or an earlier `ask`. The check reads no screen and calls no model, so it is decided at once and takes no `within`, works under `ai: never`, and skips an operation without maximizing a window. An empty value is allowed, so `not_equals: ""` asks whether a value was given. Both sides are compared after folding full-width characters and whitespace, as names are, without `*` patterns.

Use it for a part of a task that only some runs need, rather than an instruction that leaves the model to decide whether it applies. Pinned steps take no condition of their own, so such a part is an operation of its own:

```yaml
with:
  variables:
    contact: ${params.SECOND_CONTACT}
    same: ${params.SAME_ADDRESS}
  do:
    - act: Enter the first contact
    - act: Enter %contact% as the second contact
      when: {value: "%contact%", not_equals: ""}
    - act:
        instruction: Tick Same as billing address
        recorded:
          macos:
            - check: {role: checkbox, name: Same as billing address}
      when: {value: "%same%", equals: "yes"}
    - act:
        instruction: Untick Same as billing address
        recorded:
          macos:
            - uncheck: {role: checkbox, name: Same as billing address}
      when: {value: "%same%", equals: "no"}
```

The timeline records a skipped operation with the reason, such as `"" is ""`. Passing the data as variables rather than writing `${params...}` into the instruction keeps the instruction the same on every run, so one [recording](#replay-cache) serves them all. An `expect` on a value fails the step when it does not hold.

## Window Size

Before an operation looks at the screen, a step maximizes the window in front, and during an act it maximizes each new window that comes to the front. The application is then operated at one size every run, so recordings replay and the model reads larger text.

- On Windows the window is maximized as its maximize button would. On macOS it fills the main display between the menu bar and the Dock, without entering full screen, which would move it to a Space of its own. A window on another display moves to the main display, the only one captured.
- A dialog, a sheet, a panel, a window of fixed size, and a window already maximized are left as they are.
- Each window is maximized at most once per run, so a window a person or its application resizes afterwards keeps its size.
- Maximizing waits for an idle desktop, as input does, and the step log names each window it maximized.

`with.maximize: false` turns it off for the step, and `maximize` on an `act` or an `extract` sets it for that operation:

```yaml
with:
  maximize: false
  do:
    - act: {instruction: Fill in the order form, maximize: true}
```

## Model

Computer steps use the DAG-level `llm` block. `with.llm` replaces it entirely for one step.

`with.mode` chooses how an `act` talks to the model:

| Mode | Behavior |
|------|----------|
| `auto` (default) | The provider's native computer-use tool for `anthropic`, `openai`, and `gemini` models that support it; plain function tools for other providers and older models. |
| `native` | The native tool only. A provider without one fails validation, and a model without one fails the step. |
| `generic` | Plain function tools, which work with any tool-calling model that accepts images, such as models through OpenRouter or a local server. |

Native tools are available on Claude Opus 4.8, Claude 5 models, and later; GPT-5.4 and later, except nano models; and Gemini 3.5 and later. A model ID Dagu does not recognize, such as a custom deployment name, is treated as having the native tool; set `mode: generic` for such a model when it has none.

When several models are listed, an `act` moves to the next model only when a model fails before any action ran, so a half-finished task is never handed to another model. `extract` and conditions try the models in order for every request.

`extract` and conditions ask the model for a `respond` tool call whose arguments are the answer. An answer with no valid JSON, in that call or as plain text, gets one correction: the same model is shown its answer and the reason and asked again, and the step log shows the rejected answer after `warning: <provider>/<model> answer rejected: <reason>`. When the corrected answer is still unusable, the next model is tried. Every call's tokens count, the rejected one's included.

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
- A `%name%` in an `act` must be a `with.variables` key or the `as` of an earlier `ask`; anything else fails validation. Other operations send `%name%` to the model as written.
- Declared secrets and `ask` answers of four or more characters are masked in the step log, the timeline, and errors.
- A value typed into a field that shows it, rather than a password field, appears in later screenshots, which are sent to the model and saved as artifacts.

## What Is Sent to the Model

Each model request carries:

- screenshots of the primary display, scaled to the size the model accepts;
- the operation's instruction, or the statement a condition checks;
- the `extract` schema, and for an `act`, the results of the previous actions.

Screenshots show the whole display, including other open windows and notifications, and are not masked. Keep unrelated applications closed on a desktop host, and run it under an account that holds only what the workflows need.

Replays, exact checks, and extracts read from bound elements send nothing to the model.

## Outputs

The top-level properties each `extract` schema lists become step outputs, readable as `${steps.<id>.outputs.<name>}` and checked when the DAG loads. Fields a schema does not list are dropped. Two extracts in one step cannot list the same property.

When the step succeeds with outputs, stdout is one JSON object of them, so `output:` also works. Operation progress is written to the step's stderr log.

A successful `extract` binds each field to where its value was read, so later runs read it again exactly, with no model:

- A scalar field (`string`, `number`, `integer`) binds to its element when exactly one element in the window gives that value and the model read it from an element. A later run reads that element and converts its value to the field's type: a string is trimmed, and a number loses grouping and currency, with full-width digits folded.
- A `boolean` field binds to a checkbox's state.
- A table field, an array of objects of scalars, binds to a grid, table, or list. The model names the container and each column's header, and a later run reads every row by header, up to `with.max_rows` (default `10000`; `max_rows` on the extract), so a moved column still reads and a missing header is a miss.

Under `ai: on_miss` the model is asked only when a field's element is missing. Under `ai: never` the extract reads the bound elements alone, and fails when a field's element or a column header is missing. A schema that lists a plain object or a free array needs the model, so such an extract under `never` fails validation.

## Screenshots

Computer steps store screenshots as [run artifacts](/writing-workflows/artifacts) under `computer/<step id>/`, scaled to at most 1920 pixels on the long edge. A DAG with a computer step enables artifact storage automatically. Screenshots are not masked; use `screenshots: never` or `artifacts.enabled: false` to keep them out of run history.

| `with.screenshots` | Automatic screenshots |
|--------------------|-----------------------|
| `on_failure` (default) | When the step fails. |
| `final` | When the step fails, and at the end of a successful step. |
| `each` | After every operation, plus the `final` ones. |
| `never` | None. `screenshot` operations still save. |

With `artifacts.enabled: false`, no screenshots are saved and a `screenshot` operation fails.

## How Much AI Decides

`with.ai` chooses how much the model decides, and `ai` on an `act` or an `extract` sets it for that operation:

| `ai` | Behavior |
|------|----------|
| `on_miss` (default) | Each task that succeeds is recorded and replayed on later runs without the model while each screen still matches, reported as `cache-hit`. When a screen differs, the model continues from there and repairs the recording, reported as `healed`. |
| `every_run` | The model decides every run. A successful act is still recorded. |
| `never` | Replay only. When the screen differs or the host has no recording, the step fails and says why, and the recording is kept for a run under `on_miss` to repair. |

A step whose operations never call the model needs no `llm`. A statement `expect` or `when` needs the model, so a step-level `never` refuses it; [exact checks](#exact-checks) are allowed. `cache: false` is the older spelling of `every_run`; set `ai` or `cache`, not both.

```yaml
with:
  ai: never
  do:
    - act: Open the invoice entry form and post invoice ${params.INVOICE_ID}
    - expect: {text: Posted, within: 30s}
```

Run a step under `on_miss` until it succeeds once, then switch it to `never` for runs that must repeat at no cost and fail rather than improvise.

## Replay Cache

An `act` records each screen the model saw and the actions it chose on it. The next run of the same step on the same host replays them when the operation's position and its instruction match.

- Recordings are kept only when the whole step succeeds. When an operation fails after a replay, the step drops the recordings it replayed, so the next run asks the model again. A failure of a model request, the screen capture, a launch, or an `ask`, a person using the desktop, or a canceled run, leaves them.
- A replay follows the step's current settings: it hands the task to the model before a recorded turn that would exceed `max_actions`, or that the model provider asked a person to confirm while `on_confirmation` is not `allow`.
- Typed text is recorded with its `%name%` placeholders, never the values.
- A replay repeats recorded input whenever the screens match. Use `ai: every_run` for acts that must not repeat blindly, such as a payment.
- `dagu computer cache clear <dag>` removes the recordings of every step of a DAG, of one step with `--step <id>`, or of one task with `--op <position>`. Removing all of a DAG's history with `dagu rm --history` also clears them. Both work on the host they run on.

### Replaying by Element

Where the application exposes its elements, a recording keeps the element each action landed on beside its pixels, and a replay finds that button or field where it is now. A moved window, another display, or a screen showing other data still replays, and the model is asked only when an element is missing. An element named by a variable's value is recorded as `%name%`, so one recording serves every row of a loop.

- `with.find_within` (default `10s`; `find_within` on an act) is how long a replayed action waits for its element before it counts as a miss. `0` looks once.
- Names and labels are compared after folding full-width characters and whitespace, and without a label's trailing colon.
- `with.input: direct` (or `input` on an act) has a replayed element act itself instead of receiving the pointer and keys: a click invokes a button, toggles a checkbox, selects a list item, or opens a combo box, and typing sets the field's value at once when the recording showed the typed text became the value. An element without that ability replays on the screen. An application that reacts to each key or to the pointer alone sees nothing, so `screen` stays the default.

### Replaying by Pixels

A turn the model ran on the screen, rather than on an element, is recorded on the application window its first click landed on, or the window with the keyboard focus for a turn that only types. A replay compares only that window, including the area around each click, and clicks relative to its corner. A window that moved, or a change elsewhere on the screen such as another window, a notification, or the clock, still replays; a window of another size is a miss. Where the system names no window, the replay compares the whole display, which then needs the size it was recorded on. [Maximizing](#window-size) keeps the window at one size every run.

## Pinned Steps

A recording lives on the host that learned it. To run a task on every host of a system with no first-time learning, write it into the step: an `act` takes `recorded` and an `extract` takes `fields`, keyed by system (`windows` or `macos`). A host of the matching system runs them ahead of its own recording; a block for another system is ignored.

```yaml
- act:
    instruction: Log in as clerk with password %password%
    recorded:
      windows:
        - type: {into: {role: text_field, name: User}, text: clerk}
        - type: {into: {role: text_field, name: Password}, text: "%password%"}
        - click: {role: button, name: Log in}
      macos:
        - type: {into: {role: text_field, name: User}, text: clerk}
        - type: {into: {role: text_field, name: Password}, text: "%password%"}
        - key: return
- extract:
    instruction: The customer's phone number
    schema:
      type: object
      properties:
        phone: {type: string}
    fields:
      macos:
        phone: {role: text_field, near: {label: Phone, side: right}}
```

`recorded` lists steps, each one of `click`, `double_click`, or `right_click` (a selector), `check` or `uncheck` (a `checkbox` selector), `type` (`{into, text}`), `key` (a chord such as `ctrl+s`, with an optional `focus` selector to focus first), `scroll` (`{on, dy}`), or `wait` (a duration). Each pointer step acts on the centre of the element its selector names, waiting up to `find_within` for it. When every step runs, the act is a `cache-hit` with no model. When a step misses, `on_miss` lets the model finish, and `never` fails naming the step. A pinned act has no screen check of its own, so follow it with an exact `expect`.

`check` and `uncheck` leave a checkbox checked or unchecked: they click only when it is not already, then wait until the checkbox shows the state, so running the step again changes nothing. A click the model makes on a checkbox is recorded the same way, so a pin printed from a recording uses them. In Chrome and Electron applications on macOS, toggle buttons read as checkboxes too; `dagu computer elements` shows the role.

To choose an option of a list box on macOS, click the box, then click the option inside it by name:

```yaml
- click: {role: combo_box, id: category}
- click: {role: menu_item, name: "%category%", in: {role: combo_box, id: category}}
```

The option is chosen through Accessibility rather than at a position, so it works where the open menu is drawn apart from the window, as in Chrome and Electron applications.

`fields` maps each output to a selector, or to `{container, columns}` for a table, where `columns` maps each item property to its column header. A host reads pinned fields with no model, and a field with no pin falls back to the host's own binding.

Pins are kept per system because Accessibility and UI Automation expose an application differently. Pins travel with the step; the per-host cache does not. Rather than writing a pin by hand, run the step until it succeeds, then print the host's recordings in pinned form with `dagu computer cache show <dag> --step <id>` and copy them into the step. See the [CLI reference](/getting-started/cli#computer-cache-show).

## Screens That Come Up Sometimes

Some screens appear only on some runs, such as a confirmation that asks whether to discard what is already entered, or a notice after an update. `with.handle` lists such screens with the steps that clear them, so no operation has to say when they appear:

```yaml
with:
  handle:
    - name: Discard confirmation
      when: {text: Discard the entered data?}
      recorded:
        macos:
          - click: {role: button, name: Discard}
        windows:
          - click: {role: button, name: Discard}
  do:
    - act:
        instruction: Press Reset
        recorded:
          macos:
            - click: {role: button, name: Reset}
          windows:
            - click: {role: button, name: Reset}
    - expect: {element: {role: text_field, name: Customer}, within: 10s}
```

A handler's `when` is an [exact check](#exact-checks) without `within`, and its `recorded` lists [pinned steps](#pinned-steps) by system. The step checks the handlers in the window in front before each replayed action, while it waits for something that is not there yet (an element, an exact check, or the screen a recording continues from), and before the model looks at the screen or its chosen actions run. The first handler whose check holds runs its steps for the host's system, and the step carries on where it was.

- `name` names the handler in the timeline, which logs `handling <name>` each time it runs. Without one, the check names it.
- A handler with no steps for the host's system is ignored, and a handler's steps look for no handler themselves.
- `%name%` placeholders in a handler come from `with.variables`.
- A handler that runs 20 times in one step fails it with `handle "...": the screen was still there after 20 times`, so a screen its steps do not clear cannot hold the step forever.

Write the check so that it matches only the screen to clear, such as by its message, never by something the next screen also shows.

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

Rejecting the question fails the step, so an `ask` before an act that is hard to undo works as an approval gate. After `timeout` (default `1h`), the step can no longer resume: an answer is refused, or fails the step on a distributed worker. **Start clean session** runs the step again from the first operation.

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
- The Accessibility permission also lets steps read windows' elements for [exact checks](#exact-checks), [element replay](#replaying-by-element), and [extract binding](#outputs). An Electron or Chromium application builds its element tree when a step first asks for it.
- Keep the user logged in and turn off the automatic screen lock. While a step uses the desktop, Dagu keeps the display and the Mac awake, but a screen that locks, or another user's session taking the display, fails the step.

**Windows**

- Run Dagu in the user's logged-in session, for example from Task Scheduler with **Run only when user is logged on**, or from the Startup folder. A Windows service runs in session 0, which has no desktop.
- Sign the user in automatically and turn off the screen lock. While a step uses the desktop, Dagu keeps the display and the system awake, but a locked screen or a secure prompt fails the step.
- Over Remote Desktop, a minimized or disconnected session stops rendering. Use the console session, or keep the remote window open.
- Input cannot reach windows that run as administrator, such as UAC prompts, unless Dagu runs elevated too.

A step that starts on a locked screen, while nobody is logged in, or while another user's session has the display, such as a scheduled run that starts before anyone unlocks the screen, waits for the desktop to become usable instead of failing. The wait is recorded on its timeline as a `waiting` event named `screen` and is bounded by the step's timeout, or 24 hours without one. A screen that locks while a step runs still fails the step.

One computer step at a time uses a user's desktop, across every Dagu process that user runs on the host, even ones with different data directories. A step that finds the desktop in use waits for it and logs `Waiting for another computer step to finish using the desktop`, recorded on its timeline as a `waiting` event named `desktop`.

A step never operates or maximizes the windows of its own process, nor those of applications named in the `DAGU_DESKTOP_PROTECTED_APPS` environment variable of the Dagu process, a comma-separated list of executable names such as `Kitewell`. Name the application a person starts automation from, so a step never clicks into it.

## Distributed Mode

Computer steps run on the worker that picks them up, so route computer DAGs to desktop workers with a DAG-level `worker_selector` and [worker labels](/server-admin/distributed/worker-labels):

```yaml
worker_selector:
  desktop: finance
```

The replay cache and the state of a paused step are stored on that worker. An answered `ask` resumes on the same worker, and `dagu computer cache clear` and `dagu computer cache show` must run there. [Pinned steps](#pinned-steps) travel with the DAG, so every worker of a system runs them.

## Web UI

The step's **Agent** tab shows each operation with its status, token use, duration, how it ran (`element`, `screen`, `model`, or `exact`), and screenshot thumbnails, and holds pending questions.

## Options

`computer.run` takes:

| Field | Description |
|-------|-------------|
| `do` | Operations to run in order. Required. |
| `variables` | Values referenced as `%name%` in instructions. |
| `mode` | `auto`, `native`, or `generic`. See [Model](#model). |
| `ai` | `on_miss` (default), `every_run`, or `never`. See [How Much AI Decides](#how-much-ai-decides). |
| `max_actions` | Actions an `act` may perform. Defaults to `50`. |
| `find_within` | How long a replayed action waits for its element. Defaults to `10s`; `0` looks once. See [Replaying by Element](#replaying-by-element). |
| `input` | `screen` (default) or `direct`, for how a replayed element is operated. |
| `maximize` | Maximize the window in front. Defaults to `true`. See [Window Size](#window-size). |
| `max_rows` | Rows a bound table field reads. Defaults to `10000`. |
| `handle` | Screens that may come up at any point, each `{name, when, recorded}`. See [Screens That Come Up Sometimes](#screens-that-come-up-sometimes). |
| `on_confirmation` | `fail` (default) or `allow`, for model provider confirmation requests. |
| `idle` | How long nobody may have used the desktop before the step sends input, such as `30s`. Defaults to `5s`; `0s` turns it off. See [When a Person Uses the Desktop](#when-a-person-uses-the-desktop). |
| `screenshots` | `on_failure`, `final`, `each`, or `never`. |
| `cache` | `false` means `ai: every_run`. Set `ai` or `cache`, not both. |
| `llm` | Model configuration that replaces the DAG-level `llm` block. |

`computer.extract` takes `instruction` and `schema`, with optional `timeout`, `mode`, `ai`, `maximize`, `max_rows`, `screenshots`, and `llm`, and behaves as `computer.run` with one `extract` operation.

## Safety

- Everything on the screen is sent to the model and is untrusted. A document, email, or web page that is visible can try to steer an `act`. Keep instructions specific and follow important acts with an `expect`.
- The model acts with the permissions of the logged-in user on whatever is on screen. Use a dedicated account or virtual machine for desktop hosts.
- Put an `ask` before acts that are hard to undo, and set `ai: every_run` on them so they never replay blindly.
- Screenshots saved as artifacts can show personal data. Use `screenshots: never` when they must not be kept.

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `desktop automation is supported on macOS and Windows only` | The step ran on another system. | Route the DAG to a macOS or Windows worker with `worker_selector`. |
| `the process runs in session 0, which has no desktop` | Dagu runs as a Windows service. | Run the worker in a logged-in user session. See [Setting Up a Desktop Host](#setting-up-a-desktop-host). |
| `the input desktop is not accessible; the screen may be locked` | The Windows screen is locked or a secure prompt is shown. | Unlock the screen and turn off the screen lock. |
| `the screen is locked; unlock it and keep it unlocked while computer steps run` | The Mac screen locked before or during the step. | Unlock it and turn off the automatic screen lock. |
| `another user's session has the display; switch back to this user` | Fast user switching moved the Mac's display to another user. | Switch back to the user that runs Dagu. |
| `a person kept using the desktop for 1h 0m, so the step gave up waiting` | Someone kept using the mouse or keyboard for an hour. | Run the step when the desktop is free, or set `idle: 0s` on a dedicated host. |
| `Screen Recording permission is missing` or `Accessibility permission is missing` | macOS has not granted the permission to the process that runs Dagu. | Grant it in System Settings > Privacy & Security, then restart Dagu. |
| `SendInput delivered ... events; the target may run elevated or the desktop is locked` | The target window runs as administrator, or the screen locked. | Run Dagu elevated, or keep the screen unlocked. |
| `the task needed more than max_actions (...) actions` | The act is too large, or the model is going in circles. | Split the task into smaller acts, or raise `max_actions`. |
| `expectation not met: ...` | An `expect` statement did not hold. The message gives the model's reason. | Look at the failure screenshot; fix the act before it, or add `within` when the screen needs time to change. |
| `the model could not complete the task: ...` | The model reported the task impossible from what it saw. | Look at the failure screenshot; fix the instruction or the starting screen. |
| `the model stopped without reporting the task done` | The model answered twice without acting. | Make the instruction concrete, or try another model. |
| `the model provider asks a person to confirm the next actions (...)` | The provider's safety check wants a person to approve. | Add an `ask` before the act and set `on_confirmation: allow`. |
| `provider "..." has no native computer use; set mode to "generic"` | `mode: native` with a provider that has no native tool. | Use `mode: auto` or `generic`. |
| `the model does not support the provider's native computer use` | `mode: native` with an older model. | Use a newer model, or `mode: auto`. |
| `contains the value of secret ...` | A declared secret is written in an instruction. | Pass it in `with.variables` and reference it as `%name%`. |
| `act references %name%, which is not in with.variables or an earlier ask` | A misspelled or missing variable. | Add it to `with.variables` or fix the name. |
| `the instruction uses %name%, but the ask that sets it did not run` | The `ask` was skipped because its `when` did not hold. | Give the act the same `when` as the `ask`. |
| `computer actions need a model` | No `llm` block applies to the step. | Add a DAG-level `llm` block or `with.llm`. |
| `act did not finish within ...` | The act ran past its `timeout`. | Raise the operation's `timeout`, or split the task. |
| `the act cannot run without AI: ...` or `the extract cannot run without AI: ...` | Under `ai: never`, the host has no recording or binding, or the screen or an element differs. The message says which. | Run the step once under `on_miss` to record or repair it, or [pin](#pinned-steps) the task. |
| `... was not found within ...` | A recorded element did not appear within `find_within`. | Raise `find_within`, or let the model repair the recording once under `on_miss`. |
| `... is not there; N elements match` | An exact check's selector matched several elements. | Add `in`, `near`, the window, or `nth` to the selector. |
| `... is not there` | No element matched an exact check. | Check the role and name with `dagu computer elements`, or raise `within`. |
| `... is in front, not ...` | A `window` check found another window in front. | Fix the title, or the operation before it. |
| `handle "...": the screen was still there after 20 times` | The handler's steps do not clear its screen, or its check also matches a screen the step goes on to. | Make the check match only the screen to clear, and check the steps' selectors with `dagu computer elements`. |
| `... does not say whether it is checked` | A `check` or `uncheck` names an element that reports no checked state. | Use `click`, and follow it with an exact `expect`. |
| `... it is not checked after the click` or `... unchecked after the click` | The click did not change the checkbox within `find_within`, or the application changed it back. | Look at the failure screenshot; check that the selector names the box itself, not its label. |
| `the window in front exposes no elements` | The application draws its own controls, or runs as administrator on Windows. | Check it with a statement instead. |
| `exact checks need macOS or 64-bit Windows` | An exact check ran on another system. | Route the DAG to a macOS or 64-bit Windows worker, or check with a statement. |
| `... belongs to the application that runs this step, which it never operates` | The element or window is in the Dagu process's own application, or one named in `DAGU_DESKTOP_PROTECTED_APPS`. | Bring the target application to the front first, with `launch` or an act. |

## Not Supported Yet

- Linux desktops.
- Displays other than the primary one. A window on another display moves to the main display when it is [maximized](#window-size).
- Operating a desktop from a Dagu process that runs as a service, or from another machine.

## Related

- [Browser](/step-types/browser)
- [LLM Providers](/step-types/llm/providers)
- [Artifacts](/writing-workflows/artifacts)
- [Worker Labels](/server-admin/distributed/worker-labels)
- [CLI Reference](/getting-started/cli#computer-check)
