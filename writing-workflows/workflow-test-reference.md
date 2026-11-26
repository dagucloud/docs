---
description: Every field of a Dagu workflow test file, the fail-closed sources and fixes, the assertions, and the text and JSON reports of dagu test.
---

# Workflow Test Reference

This page lists every field of a workflow test file, the errors `dagu test` reports, and its report formats. [Workflow Tests](/writing-workflows/workflow-tests) shows how to write and run tests. `dagu schema test` prints the JSON Schema of the same fields.

## The Test File

| Field | Required | Meaning |
|-------|----------|---------|
| `dag` | No | Path of the tested DAG file. A relative path resolves from the directory that holds the test file. Defaults to the DAG beside the test file. |
| `params` | No | Run parameters for every case, by name. |
| `env` | No | DAG-level `env` entries for every case, by name. |
| `secrets` | No | Values for DAG `secrets` entries, by `name`, and for SSH credential refs, by ref. Needed only in a case with a real step. |
| `mocks` | No | Mocks for every case, by step key. |
| `default_mock` | No | A mock for every step and handler that needs one and that `mocks` and `real` do not name. |
| `real` | No | Step keys of the steps that run their real action in every case. |
| `cases` | Yes | The cases. Must not be empty. |

A test file accepts only the fields on this page, at every level. The keys of `params`, `env`, `secrets`, `mocks`, `outputs`, `expect.steps`, and `review.values` are names, not fields.

### Cases

| Field | Required | Meaning |
|-------|----------|---------|
| `name` | Yes | Name of the case. Not empty, and unique in the file. |
| `params` | No | Merged over the file's `params`, by name. |
| `env` | No | Merged over the file's `env`, by name. |
| `scheduled_at` | No | Schedule slot of the run, in the forms `dagu dry --scheduled-at` takes. The run gets that slot's schedule time and window. |
| `trigger` | No | `context.trigger.type` of the run: `manual` (default), `scheduler`, `webhook`, `retry`, `catchup`, `restart`, `backfill`, or `file`. It changes nothing else. |
| `precondition` | No | `met` or `not_met`: the outcome of the DAG-level preconditions that run a command or a substituting `eval`. Valid only when the DAG has one. |
| `mocks` | No | Replaces the file's mock of each step it names, as a whole. |
| `default_mock` | No | Replaces the file's `default_mock`. |
| `real` | No | Added to the file's `real`. |
| `expect` | Yes | [Assertions](#assertions). |

- `params` and `env` values are YAML scalars.
- Each `params` entry is one `name=value` assignment, as `dagu start -- name=value` takes it. A case whose params `dagu start` would reject is invalid. A param given a value does not run its `eval`.
- An `env` entry replaces the DAG's entry of the same name, or adds one. Its value is used as written, without variable expansion.
- A file key and a case key that name the same step, one by `name` and one by `id`, name one step.

### Step Keys

A step key names a step or handler in `mocks`, `real`, and `expect.steps`:

- the `id` or `name` of a step of the tested DAG's first document;
- `handler_on.<event>` for a lifecycle handler: `init`, `success`, `failure`, `abort`, `exit`, or `wait`, including a handler that the [base configuration](/server-admin/base-config) adds.

A key that names no step or handler, or two keys of one map or list that name the same step, make the case invalid. Steps of other documents in the DAG file and `foreach` body steps have no key.

## Mocks

### Result Fields

| Field | Default | Meaning |
|-------|---------|---------|
| `exit_code` | `0` | Exit code of the execution. A non-zero code fails the attempt. |
| `stdout` | empty | Written to the step's stdout exactly as given. Dagu adds no newline. |
| `stderr` | empty | Written to the step's stderr exactly as given. |
| `outputs` | none | Named outputs the execution publishes. See [Mocked outputs](#mocked-outputs). |
| `condition` | none | `met` or `not_met`: the outcome of the step's command-check `repeat_policy.condition` after this execution. |
| `results` | none | One result per execution. Each item takes the fields above, except `results`. |

- A mock with inline result fields is a one-item `results`. A mock sets either, not both, and `results` must not be empty.
- The first attempt takes the first result, and each retry and each repeat iteration takes the next. After the last result, each later execution takes the last result again. A mocked step that repeats without a `limit` stops after its last result instead.
- A result field that a result leaves out takes its default.
- Mock results keep counting across the run attempts of a DAG-level `retry_policy`.

### Step Fields

| Field | Meaning |
|-------|---------|
| `precondition` | `met` or `not_met`: the outcome of each of the step's preconditions that runs a command or a substituting `eval`, after `negate` applies, decided once per step start. Valid only on a step that has one. |
| `review` | How each wait of the step is settled. Valid only on a step that waits for a person. |

Step fields sit beside `results` or the inline result fields, never inside a `results` item.

### Review

| Field | Required | Meaning |
|-------|----------|---------|
| `decision` | Yes | `approve` or `reject`. Settles every wait of the step. |
| `values` | No | The completion input of a `human.task`, or the inputs of an `approval` gate. |

- A `human.task` takes only `approve`. Its `values` are typed as `--inputs-json` types them and must pass its form. Its outputs come from them.
- An `approval` gate takes `approve` or `reject`. `reject` ends the step and the run `rejected`. Each value is a scalar. `values` must give every name `approval.required` lists, and an empty value counts as left out.
- A wait that needs no values is approved automatically when the step's mock sets no `review`.

### Replaced Actions

- A mock replaces the step's action when it sets a result field.
- A mock that sets no result field also replaces the action of a step that is not real and whose action has side effects. The step then succeeds with no output.
- A mock that sets only step fields keeps the real action of a step with a side-effect-free action, and of a real step.
- A mock that sets a result field on a real step or on a `human.task` step makes the case invalid.
- A replaced step starts no process, opens no connection, creates no container, and reads no file, including its `stdin` and an `output` entry with `from: file`.

The side-effect-free actions are `router.route`, `outputs.write`, `log.write`, and `noop`. A `foreach` step is side-effect free when every body step is.

### Mocked Outputs

A step has known outputs when its output names are known before the run: the names its `outputs`, `output_schema`, object-form `output`, `stdout.outputs`, and action declare. A step whose output names are known only during a run, such as a `dag.run`, `parallel`, or manifest-resolved action step, has runtime outputs.

- `outputs` needs a step with an `id`.
- A result with exit code 0 under `mocks` sets every known output and no other name. On a step with runtime outputs, it may set any name that matches `^[A-Za-z][A-Za-z0-9_]*$`.
- A `type: string` output, the default, takes a YAML string. A `type: json` output takes any YAML value, published as JSON. Any other output publishes a YAML string as written and any other value as JSON.
- A result with a non-zero exit code publishes no outputs.
- Dagu does not parse `stdout` or read a file to publish outputs, and it does not check `output_schema` against mocked values.

### The Default Mock

`default_mock` takes the fields of a mock and applies to every step and handler that has a [fail-closed source](#fail-closed-sources) and that `mocks` and `real` do not name.

- On a step whose action has side effects, it replaces the action as `{}` does, with its result fields when it sets any.
- On a step with a side-effect-free action, it replaces the action only when it sets a result field and the step reads a file through `output`, repeats without a limit, or has a command repeat condition that its results decide with `condition`.
- `precondition` applies to a step with a command or substituting `eval` precondition, `condition` to a step with a command repeat condition, and `review` to a wait that needs values. A field that handles none of a step's sources does not apply to it.
- It sets no `outputs`. A step it replaces publishes each known output as an empty string, or `null` for a `type: json` output.
- It does not handle DAG-level preconditions, `params[].eval`, secrets, or the child DAG of a real step.

## Assertions

| Field | Meaning |
|-------|---------|
| `status` | Run status: `succeeded`, `failed`, `aborted`, `partially_succeeded`, or `rejected`. |
| `attempts` | Run attempts, counting retries of a DAG-level `retry_policy`. |
| `steps.<key>` | A step status, or a map with one or more of `status`, `attempts`, `outputs`, `stdout`, and `stderr`. |
| `steps.<key>.status` | `succeeded`, `failed`, `aborted`, `skipped`, `partially_succeeded`, `rejected`, or `not_started`. |
| `steps.<key>.attempts` | Executions of the step's action in every run attempt, counting retries and repeat iterations. |
| `steps.<key>.outputs` | Expected named outputs, by name. |
| `steps.<key>.stdout`, `steps.<key>.stderr` | A map with `contains`, `matches`, or both. |
| `notifications` | The notifications the run would have sent. |

- `expect` holds at least one assertion. An empty `steps.<key>` map, an unknown step key or status, and a negative `attempts` make the case invalid.
- A step or handler that never started is `not_started`. A step whose action never ran, such as a skipped step, has 0 attempts, and so does a `human.task` step.
- A case passes when the run reaches a terminal status and every assertion holds. The report lists every failed assertion.

**Outputs.** A string output matches a YAML string when its text equals the string. A `type: json` output, or an expected value that is not a string, matches by the JSON rule: an object matches when every key it lists has a matching value, recursively, and keys it does not list are ignored. Arrays and scalars match only an equal value, and numbers compare by value. An output the step did not publish does not match. On a step with known outputs, an assertion on another name makes the case invalid.

**Streams.** `contains` holds when the stream contains its text. `matches` holds when its RE2 regular expression matches anywhere in the stream. The stream is the step's stdout or stderr of its last execution, as the step's log holds it, with secrets masked. A step with no execution fails a stream assertion. An invalid `matches` expression makes the case invalid.

**Notifications.** Each item has `kind`: `mail_on.failure`, `mail_on.success`, `mail_on.wait`, or `mail_on_error`. It may set `to`, a list of recipients compared as a set, and, with `mail_on_error` only, `step`. The list holds when the run would have sent as many notifications as it lists, and each item pairs with a different one, in any order. `notifications: []` asserts that the run would send none. Without `notifications`, notifications are not checked.

## Fail-Closed Sources

A case is invalid, and none of its steps runs, while the DAG has a source in this table that the case does not handle. The rule covers every step and handler, reached or not.

| Error label | Source | Handled by |
|-------------|--------|------------|
| `param <name>` | A `params[].eval` with command substitution | A value under `params` |
| `secret <name>` | A DAG `secrets` entry or an SSH credential ref, in a case with a real step | A value under the test file's `secrets` |
| `precondition` | A DAG-level precondition with a command check or a substituting `eval` | The case's `precondition` |
| `step <step>` | A step action with side effects | A mock, `{}` and the default mock included, or the step under `real` |
| `step <step>` | A step precondition with a command check or a substituting `eval` | `precondition` in the step's mock, or the step under `real` |
| `step <step>` | A command-check `repeat_policy.condition` | `condition` in every result of the step's mock, or the step under `real` |
| `step <step>` | An object-form `output` entry with `from: file` | A mock that replaces the action, or the step under `real` |
| `step <step>` | A side-effect-free step that repeats without a `limit` | A mock that sets a result field, or the step under `real` |
| `step <step>, body step <body>` | A `foreach` body step with any source above | A mock of the `foreach` step |
| `step <step>` | A wait that needs values | `review` in the step's mock, also for a real step |
| `handler_on.<event>` | A source above on a lifecycle handler | The same, keyed by `handler_on.<event>` |
| `step <step>, child <dag>, ...` | A source above in the child DAG of a real step | Nothing. Mock the parent step |

- `<step>` and `<body>` are the step's `id`, or its `name` when it has none.
- The errors list params, secrets, DAG-level preconditions, steps in DAG order, then handlers.
- A wait needs values when completing it with none would fail: a `human.task` whose form has a `required` property without a `default`, or an `approval` with `required` inputs.

### The Fix

An invalid case ends with `fix, ready to paste:` and the case fields that handle every listed source, in the order `params`, `precondition`, `mocks`. Missing secrets follow under `fix for the test file, ready to paste:`. Each source adds:

| Source | Entry |
|--------|-------|
| A step action with side effects, or a `foreach` body step | `{}` on the step or its `foreach` step, with `outputs` set to `""` for each known output, or `null` for a `type: json` one |
| An `output` with `from: file`, or a step that repeats without a limit, on a side-effect-free step | `exit_code: 0`, with `outputs` as above |
| A step precondition | `precondition: met` in the step's mock |
| A command-check repeat condition | A `condition` that stops the step, `not_met` for `while` and `met` for `until`, in each result |
| A wait that needs values | `review` with `decision: approve` and a value for each required name |
| A secret or SSH credential ref | Its name under `secrets` with `""` |
| A DAG-level precondition | The case's `precondition: met` |
| A substituting `params[].eval` | The param's `default`, else its first `enum` value, else `""` |

A required `human.task` value is its first `enum` or `oneOf` value, else `""`, `0`, or `false` by type. A required `approval` input is `TODO`. A value that another form constraint, such as `pattern`, rejects carries the comment `# replace with a value the form accepts`, and the case stays invalid until it is replaced.

### Other Invalid Cases

A case is also invalid when:

- a mock sets `outputs` that [Mocked outputs](#mocked-outputs) rejects, or the default mock sets `outputs`;
- a mock sets `precondition`, `condition`, or `review` on a step that has no such source;
- `real` lists a `foreach` step;
- a `secrets` key names neither a DAG `secrets` entry nor an SSH credential ref of the DAG;
- `trigger`, `scheduled_at`, `precondition`, `condition`, or `decision` has a value this page does not list;
- `expect` breaks a rule of [Assertions](#assertions), or a `notifications` item has an unknown `kind` or sets `step` without `mail_on_error`.

The error line names the field, such as `mocks.build.outputs` or `expect.steps.deploy`. The other cases of the file still run.

### Invalid Test Files

A test file is invalid, and none of its cases runs, when:

- it is not valid YAML, or its top level is not a map;
- it has a field this page does not define, or a field of the wrong type;
- `cases` is missing or empty, a case has no `name` or `expect`, or two cases share a `name`;
- its first document has top-level `steps` and no `cases`, which reads as a DAG. The error suggests a name, such as `smoke-test.yaml` for `smoke.test.yaml`;
- the tested DAG file does not exist, `dag` names a test file, or the DAG fails to load as `dagu start` loads it;
- the tested DAG is a `type: build` DAG.

The other test files still run.

## What Changes Under Test

| Behavior | Under test |
|----------|------------|
| Retry and repeat intervals, backoff, and `delay_sec` | Not waited for, except by real steps. The order and count of executions do not change. |
| `timeout_sec` | Applies as in a real run. A replaced action returns at once. |
| A DAG-level `retry_policy` | `dagu test` retries the run in the same case directory, without waiting, with the trigger type `retry`. |
| Run history, logs, artifacts, and `state` | Kept in a new case directory, removed when the case ends unless `--keep` is set. The configured data directory is not read or written, and `state` starts empty. |
| `mail_on` and `mail_on_error` | Not sent. The report lists each notification the run would have sent. |
| OpenTelemetry export | Off. |
| `stdout` and `stderr` redirect files | Written inside the case directory, for every step that is not real. |
| The DAG's `working_dir`, DAG-level `container` and `ssh`, `tools`, and native resource limits | Set up only when the case has a real step. |
| Secrets | Resolved by no provider. A placeholder `<secret:NAME>` without a real step, the test file's value otherwise. Both are masked. |
| `queue` and `worker_selector` | Ignored. The case runs in the `dagu test` process. |

A case runs beside the live runs of the same DAG. Neither sees the other, and the case's run does not appear in the DAG's history. An interrupted `dagu test` stops the running case, starts no other, and exits with a non-zero status.

## Updating Expectations

`dagu test --update` selects test files and cases as `dagu test` does, runs each selected case, and rewrites its `expect` from the run.

- An asserted run `status` or `attempts`, step `status` or `attempts`, or `notifications` list that does not hold takes the run's value. An assertion that holds stays exactly as written, such as `total: 7.0` against a published `"7"`.
- An asserted output takes its published value. For an object, each key it lists takes its published value, recursively, and no key is added. No output assertion is added.
- A step or handler without an assertion gains its status, and `attempts` when above 1, after the case's last step entry, in DAG order and then handler order. A step entry keeps its form: a status stays a status, and a map keeps its fields.
- No assertion is removed. These stay as written and still fail when they do not hold: `stdout` and `stderr` assertions, an output the step did not publish, a listed key the published object lacks, an object where the published value is not one, and a number that YAML cannot write exactly, such as an integer above 18446744073709551615.
- Only the changed text is rewritten. Comments, quotes, and the other cases stay. A flow-style map or list that gains an entry is rewritten in block style.
- Each rewrite is read back before it is kept, so the file never gets invalid YAML or a value other than the run's.
- A test file is written once its selected cases have run, and only when an `expect` changed, through a temporary file renamed over it. It keeps its mode.

The last line under each case says what happened to its `expect`, whether or not the case passes:

| Text report | JSON `update` | Meaning |
|-------------|---------------|---------|
| `expect updated` | `updated` | The run changed its text. |
| `expect unchanged` | `unchanged` | The run left its text as it was. |
| `expect kept: <reason>` | `kept` | It stays as written whatever the run did. |

The reasons are:

- `the case is invalid`
- `the run did not finish`, such as a case that ran longer than `--timeout`
- `the case is written in flow style or uses a YAML anchor, alias, or merge key`, since a rewrite could change another part of the file. A flow-style `expect` or list inside a block-style case is rewritten.
- `the expect could not be rewritten in place`

The report and the exit status are those of the rewritten cases. A rewritten case passes unless an assertion that stays as written fails.

A test file edited while its cases ran is not written. The other test files still run and the report ends as usual. Then an error goes to stderr, `Error: <path> changed while its cases ran, so its expects were not updated`, with the file's absolute path, and the command exits 1, or 2 when a case or file is invalid. An interrupt leaves the test file whose cases were running as it was.

## Report

The report goes to stdout. A test file appears by its path relative to the current directory when it is under it, and by its absolute path otherwise.

### Text Report

- `PASS <file>: <case> (<duration>)`, `FAIL <file>: <case> (<duration>)`, or `INVALID <file>: <case>` starts each case, in run order.
- `INVALID <file>` starts an invalid test file, whose cases do not appear.
- Under a case that ran, in this order: one line per failed assertion, `default mock: <steps>`, `approved automatically: <steps>`, one `notification <kind>: <recipients>` line per notification, `case directory <path>` with `--keep`, and, with `--update`, the [update outcome](#updating-expectations).
- Under an invalid case or file: one `<label>: <message>` line per error, then the fix of an invalid case.
- The last line is the summary: `<n> cases: <passed> passed, <failed> failed`, followed by `, <invalid> invalid` and `, <files> invalid files` when there are any.

A failed assertion reads, for example, `status: expected succeeded, got failed`, `step deploy: expected skipped, got aborted`, `step deploy attempts: expected 3, got 1`, or `step count output files: expected "3", got "2"`. A case that runs longer than `--timeout` fails with `timeout: did not finish within <timeout>`, and its assertions are not evaluated.

### JSON Report

`--format json` writes exactly one JSON object to stdout once every case has ended.

| Top-level field | Present | Meaning |
|-----------------|---------|---------|
| `cases` | Always | One object per case that ran or was invalid, in run order. |
| `invalid_files` | When a test file is invalid | One object per invalid test file, with `file` and `errors`. |

| Case field | Present | Meaning |
|------------|---------|---------|
| `file` | Always | The test file. |
| `name` | Always | The case name. |
| `result` | Always | `pass`, `fail`, or `invalid`. |
| `duration_ms` | When the case ran | Wall-clock time in milliseconds. |
| `failures` | When `result` is `fail` | Failure objects, run assertions first, then steps in `expect.steps` order, then `notifications`. |
| `errors` | When `result` is `invalid` | Error objects: `source`, the label, when there is one, and `message`. |
| `fix` | When an invalid case has a fix | The fix for the case, as YAML text. |
| `file_fix` | When the fix has `secrets` | The fix for the test file, as YAML text. |
| `default_mocked` | When the default mock applied | Step labels. |
| `auto_approved` | When a wait was approved automatically | Step labels. |
| `notifications` | When the run would have sent one | Objects with `kind`, `to`, and, for `mail_on_error`, `step`. |
| `case_dir` | With `--keep`, when the case ran | Absolute path of the kept case directory. |
| `update` | With `--update` | `updated`, `unchanged`, or `kept`. See [Updating expectations](#updating-expectations). |

| Failure field | Meaning |
|---------------|---------|
| `step` | The step key, for a step assertion, or the step label, for `limit`. |
| `field` | `status`, `attempts`, `outputs.<name>`, `stdout.contains`, `stdout.matches`, `stderr.contains`, `stderr.matches`, `notifications`, `timeout`, `limit`, or `error`. |
| `expected` | The expected value. For `timeout`, the limit in milliseconds. |
| `actual` | The actual value, when there is one. |

### Exit Status

| Status | Meaning |
|--------|---------|
| `0` | Every selected case passed, or no case was selected. |
| `1` | At least one case failed. |
| `2` | At least one test file or case is invalid, or the arguments are invalid. |

The highest status that applies wins. Invalid arguments are an argument that is neither an existing path nor a DAG name in the DAGs directory, a file argument that is neither a test file nor a `.yaml` or `.yml` DAG file, a DAG file or DAG name with no test file beside it, an invalid `--run` expression, `--format` other than `text` or `json`, a `--timeout` that is not a positive duration, an unknown flag, and `--init` with other than one DAG file or with `--update`, `--run`, `--keep`, or `--format json`. With `--update`, a test file edited during the run makes the command exit 1, or 2, as [Updating expectations](#updating-expectations) describes.
