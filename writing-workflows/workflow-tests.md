---
description: Test how a DAG behaves with dagu test. A test file beside the DAG mocks its step actions and asserts run and step statuses, outputs, logs, and notifications, without running commands.
---

# Workflow Tests

A workflow test checks how a DAG behaves without running its commands. A test file sits beside the DAG it tests. It replaces step actions with scripted results and states what each case must end with: the run status, step statuses, attempts, outputs, logs, and the notifications the run would send.

`dagu test` runs each case through the same runner as `dagu start`. Dependencies, preconditions, routing, retries, repeats, `continue_on`, handlers, and status propagation behave as in a real run. Only the mocked actions differ. The DAG needs no change to be testable.

A missing mock never reaches a real system. When a step with side effects has no mock and is not listed as real, the case is invalid and nothing runs.

## Requirements

- A Dagu release after v2.27.0.

## Quick Start

Save a DAG and its test file in one directory:

```yaml
# workflows/release.yaml
steps:
  - id: build
    run: ./build.sh
    outputs:
      - name: image_tag

  - id: deploy
    depends: build
    run: ./deploy.sh "${steps.build.outputs.image_tag}"
```

```yaml
# workflows/release.test.yaml
mocks:
  build:
    outputs:
      image_tag: v1.2.3
  deploy: {}
cases:
  - name: deploys the built image
    expect:
      status: succeeded
  - name: a failed build stops the deploy
    mocks:
      build:
        exit_code: 1
    expect:
      status: failed
      steps:
        build: failed
        deploy: aborted
```

Run the tests:

```bash
dagu test workflows/
```

```text
PASS workflows/release.test.yaml: deploys the built image (0.17s)
PASS workflows/release.test.yaml: a failed build stops the deploy (0.14s)
2 cases: 2 passed, 0 failed
```

Neither `build.sh` nor `deploy.sh` runs. `build` publishes `image_tag` from its mock, and `deploy: {}` succeeds with no output. The second case replaces the file's `build` mock with a failing one. `deploy` then ends `aborted`, not `skipped`, because Dagu aborts the steps that depend on a failed step.

## Where Test Files Live

A test file ends in `.test.yaml` or `.test.yml` and sits beside the DAG it tests:

```text
workflows/
  release.yaml
  release.test.yaml
  etl/
    daily.yaml
    daily.test.yaml
```

- `release.test.yaml` and `release.test.yml` test `release.yaml`, or `release.yml` when there is no `release.yaml`.
- `dag` names another DAG file. A relative path resolves from the directory that holds the test file.
- One test file per DAG is the convention. Its scenarios are its `cases`.
- Moving or renaming a DAG together with its test file keeps the test working.

### Test Files Are Not DAGs

DAG discovery, the DAGs directory watcher, and DAG name lookup skip every file whose name ends in `.test.yaml` or `.test.yml`. The DAG list does not show a test file, the scheduler never runs one, and a change to one reloads nothing. `dagu start release.test` fails with a message that names `dagu test`.

A DAG that already has such a name becomes a test file after the upgrade and stops running on its schedule. Rename it, for example from `smoke.test.yaml` to `smoke-test.yaml`. See [Upgrades](/server-admin/upgrades#upgrading-from-2-27-0-or-earlier). `dagu test` reports a file with top-level `steps` and no `cases` as invalid and asks for the rename.

## Running Tests

```bash
dagu test [flags] [<test file or directory>...]
```

- A file argument must be a test file.
- A directory argument runs every test file under it, at any depth. Directories whose names start with `.` are skipped.
- Without an argument, `dagu test` runs every test file under the DAGs directory of the loaded configuration.
- Test files run one at a time, in path order. The cases of a file run one at a time, in file order.
- An invalid test file or case does not stop the others.

| Flag | Default | Meaning |
|------|---------|---------|
| `--run <regexp>` | none | Run only the cases whose `name` the RE2 regular expression matches, anywhere in the name. |
| `--timeout <duration>` | `5m` | Longest a case may run, such as `30s`. A case that runs longer fails with a `timeout` failure. |
| `--format`, `-f` | `text` | `text` or `json`. See [JSON Report](#json-report). |
| `--keep` | off | Keep each case directory, with its logs and redirect files, and print its path. |

```bash
dagu test workflows/release.test.yaml
dagu test --run 'failed build' workflows/
dagu test --format json --keep workflows/
```

### Reading the Report

Each case starts with one line: `PASS`, `FAIL`, or `INVALID`, the test file, the case name, and, for a case that ran, its duration. Lines indented under it give the details, and a summary line ends the report.

When the second case of the quick start expects `deploy: skipped` and is named `a failed build skips the deploy`, the report reads:

```text
PASS workflows/release.test.yaml: deploys the built image (0.21s)
FAIL workflows/release.test.yaml: a failed build skips the deploy (0.19s)
  step deploy: expected skipped, got aborted
2 cases: 1 passed, 1 failed
```

A failed case lists every failed assertion, not only the first. Under each case that ran, the report also lists:

- `default mock: <steps>`, the steps that took the [default mock](#the-default-mock);
- `approved automatically: <steps>`, the waits approved with no values (see [Steps that wait for a person](#steps-that-wait-for-a-person));
- `notification <kind>: <recipients>`, each notification the run would have sent;
- `case directory <path>`, with `--keep`.

An invalid case lists its errors and ends with the [fix](#the-fix-ready-to-paste). An invalid test file has one `INVALID <file>` line with its errors, and none of its cases runs.

## The Test File

| Field | Required | Meaning |
|-------|----------|---------|
| `dag` | No | Path of the tested DAG file. Defaults to the DAG beside the test file. |
| `params` | No | Run parameters for every case, by name. |
| `env` | No | DAG-level `env` entries for every case, by name. |
| `secrets` | No | Values for DAG `secrets` entries and SSH credential refs. Needed only in a case with a real step. See [Secrets](#secrets). |
| `mocks` | No | Mocks for every case, by step key. |
| `default_mock` | No | A mock for every step that needs one and that `mocks` and `real` do not name. |
| `real` | No | Step keys of the steps that run their real action in every case. |
| `cases` | Yes | The cases. Must not be empty. |

Each case is one run of the DAG:

| Field | Required | Meaning |
|-------|----------|---------|
| `name` | Yes | Unique in the file. |
| `params` | No | Merged over the file's `params`, by name. |
| `env` | No | Merged over the file's `env`, by name. |
| `mocks` | No | Replaces the file's mock of each step it names, as a whole. Fields of the two mocks do not merge. |
| `default_mock` | No | Replaces the file's `default_mock`. |
| `real` | No | Added to the file's `real`. |
| `precondition` | No | `met` or `not_met`: the outcome of the DAG-level preconditions that run a command. |
| `trigger` | No | `context.trigger.type` of the run: `manual` (default), `scheduler`, `webhook`, `retry`, `catchup`, `restart`, `backfill`, or `file`. It changes nothing else. |
| `scheduled_at` | No | Schedule slot of the run, in the forms `dagu dry --scheduled-at` takes. |
| `expect` | Yes | The [assertions](#assertions). |

A test file accepts only these fields. Any other field makes the file invalid. `params` and `env` values are YAML scalars. An `env` value is used as written, without variable expansion. Each `params` entry is one `name=value` assignment, as `dagu start -- name=value` takes it. A param given a value does not run its `eval`.

### Step Keys

`mocks`, `real`, and `expect.steps` name steps by step key:

- the `id` or `name` of a step of the tested DAG;
- `handler_on.<event>` for a lifecycle handler: `init`, `success`, `failure`, `abort`, `exit`, or `wait`, including a handler that the [base configuration](/server-admin/base-config) adds.

A key that names no step or handler makes the case invalid. Steps of other documents in the DAG file and `foreach` body steps have no key.

## Mocks

A mock replaces what a step's action returns. Result fields script one execution. Step fields script what happens around the action, once for the step.

| Result field | Default | Meaning |
|--------------|---------|---------|
| `exit_code` | `0` | Exit code of the execution. A non-zero code fails the attempt. |
| `stdout` | empty | Written to the step's stdout as given. |
| `stderr` | empty | Written to the step's stderr as given. |
| `outputs` | none | Named outputs the execution publishes. |
| `condition` | none | `met` or `not_met`: the outcome of a command-check `repeat_policy.condition` after this execution. |
| `results` | none | One result per execution. Each item takes the fields above. |

| Step field | Meaning |
|------------|---------|
| `precondition` | `met` or `not_met`: the outcome of the step's preconditions that run a command. |
| `review` | How each wait of the step is settled. See [Steps that wait for a person](#steps-that-wait-for-a-person). |

`{}` is a valid mock. On a step with side effects, it succeeds with exit code 0 and no output.

A mocked step keeps everything around its action. Retries read its exit code, `continue_on` and status propagation apply, string-form `output: VAR` captures its `stdout`, and its `env`, `with`, and `run` fields resolve as in a real run. It starts no process, opens no connection, creates no container, and reads no file.

### Results per Execution

`results` scripts each execution in turn: the first attempt takes the first result, and each retry and each repeat iteration takes the next. After the last result, later executions take the last result again.

```yaml
# workflows/implement.yaml
steps:
  - id: implement
    run: agent implement
    retry_policy:
      limit: 2
      interval_sec: 60
```

```yaml
# workflows/implement.test.yaml
cases:
  - name: a flaky step passes on the third attempt
    mocks:
      implement:
        results:
          - exit_code: 1
          - exit_code: 1
          - exit_code: 0
    expect:
      status: succeeded
      steps:
        implement:
          status: succeeded
          attempts: 3
```

The case passes at once. Dagu does not wait for the two 60-second retry intervals.

A mock sets either `results` or inline result fields, not both. Step fields sit beside `results`, never inside an item.

### Mocked Outputs

A step that declares outputs, through `outputs`, `output_schema`, object-form `output`, `stdout.outputs`, or its action, has known outputs.

- A mock under `mocks` with exit code 0 sets every known output and no other name. A missing or extra name makes the case invalid, as a real run would fail the step.
- `outputs` needs a step with an `id`.
- A `type: json` output takes any YAML value and publishes it as JSON. A string output takes a YAML string.
- A step whose output names are known only at run time, such as a `dag.run` step, takes any name.
- A result with a non-zero exit code publishes no outputs.
- Dagu does not parse `stdout` to publish outputs and does not check `output_schema` against mocked values.

### Steps That Run for Real

Four actions read only their inputs and write only their stdout, stderr, and outputs. They run for real without a mock:

- `router.route`, including a router written with the `value` and `routes` step fields
- `outputs.write`
- `log.write`
- `noop`

A test therefore exercises the routing and outputs the DAG defines, from the mocked outputs of earlier steps. Every other action has side effects, including command steps, `decision.evaluate`, which calls a model provider, and `wait.duration`.

To run a step with side effects for real, list it under `real`:

```yaml
real: [lint]
```

Only a line in `real` runs such a step. A mock on a real step may set step fields, such as `precondition` or `review`, but no result field. A real `dag.run` or `parallel` step runs its child DAG in the case, and the child takes no mocks, so a child step with side effects makes the case invalid. Mock the parent step instead. `real` takes no `foreach` step.

### The Default Mock

`default_mock` covers every step that needs a mock and that `mocks` and `real` do not name. It never runs anything real, so a test keeps the fail-closed guarantee without a line per step.

```yaml
# workflows/release.test.yaml
default_mock: {}
cases:
  - name: every step succeeds by default
    expect:
      status: succeeded
  - name: a failed build stops the deploy
    mocks:
      build:
        exit_code: 1
    expect:
      steps:
        build: failed
        deploy: aborted
```

```text
PASS workflows/release.test.yaml: every step succeeds by default (0.16s)
  default mock: build, deploy
PASS workflows/release.test.yaml: a failed build stops the deploy (0.13s)
  default mock: deploy
2 cases: 2 passed, 0 failed
```

- The report lists the steps it applied to, so steps the test never scripted stay visible.
- It sets no `outputs`. A step it replaces publishes each known output as an empty string, or `null` for a `type: json` output.
- Each field applies only where the step needs it: `precondition` to a step with a command precondition, `condition` to a step with a command repeat condition, and `review` to a wait that needs values.
- It does not handle DAG-level preconditions, `params[].eval`, or secrets.
- A step with a side-effect-free action and nothing else to handle runs for real, as without a mock.

### Preconditions and Repeat Conditions

A precondition that compares a value, such as `${steps.plan.outputs.risk}` with `expected`, evaluates as in a real run, against mocked outputs and the case's params and env. A precondition that runs a command, or an `eval` with command substitution, never runs under test. The test decides its outcome:

```yaml
# workflows/migrate.yaml
preconditions:
  - condition: test -f /etc/release.lock
    negate: true
steps:
  - id: migrate
    preconditions:
      - condition: test -f migrations/pending
    run: ./migrate.sh
  - id: notify
    depends: migrate
    run: ./notify.sh
```

```yaml
# workflows/migrate.test.yaml
mocks:
  migrate:
    precondition: not_met
  notify: {}
cases:
  - name: nothing pending skips the migration
    precondition: met
    expect:
      status: succeeded
      steps:
        migrate: skipped
        notify: skipped
  - name: a release lock aborts the run
    precondition: not_met
    expect:
      status: aborted
      steps:
        migrate: not_started
```

- `precondition` in a mock decides the step's command conditions, after `negate` applies. `not_met` skips the step. The step's value conditions still evaluate.
- `precondition` in a case decides the DAG-level command conditions. `not_met` aborts the run before any step starts.
- `condition` in each result of a mock decides a command-check `repeat_policy.condition` after that execution. `met` keeps a `while` step repeating and stops an `until` step. See [Repetition](/writing-workflows/control-flow#repetition).

A mocked step that repeats without a `limit` runs one execution per result, then stops, since nothing else bounds it under test.

### Steps That Wait for a Person

A `human.task` step or a step with `approval` waits as in a real run: the run reaches `waiting`, and `handler_on.wait` runs. The test then settles each wait and the run resumes. Nothing waits for a person.

- A wait that needs no values is approved automatically, and the report lists it under `approved automatically`.
- A wait that needs values takes `review` in the step's mock: a `human.task` whose form has a `required` property without a `default`, or an `approval` with `required` inputs.

```yaml
# workflows/gate.yaml
steps:
  - id: release
    run: ./release.sh
    approval:
      prompt: Ship it?
  - id: announce
    depends: release
    run: ./announce.sh
    approval:
      prompt: Announce it?
      input: [channel]
      required: [channel]
```

```yaml
# workflows/gate.test.yaml
mocks:
  release: {}
  announce:
    review:
      decision: approve
      values:
        channel: releases
cases:
  - name: an approved release is announced
    expect:
      status: succeeded
      steps:
        announce: succeeded
  - name: a rejected release ends the run
    mocks:
      release:
        review:
          decision: reject
    expect:
      status: rejected
      steps:
        release: rejected
        announce: not_started
```

In the first case, the gate of `release` needs no values, so it is approved automatically, and the report lists `approved automatically: release`. The gate of `announce` takes its `review`.

| `review` field | Meaning |
|----------------|---------|
| `decision` | `approve` or `reject`. Settles every wait of the step. |
| `values` | The completion input of a `human.task`, or the inputs of an `approval` gate. |

`reject` on an approval gate ends the step and the run `rejected`. A `human.task` takes only `approve`, and its `values` must pass its form. See [Approval Gates](/writing-workflows/approval) and [Human Tasks](/writing-workflows/human-tasks).

### Sub-DAG, Parallel, and Foreach Steps

- A mock of a `dag.run`, `dag.enqueue`, or `parallel` step replaces its child runs. No child starts or is queued. The mock's result and `outputs` are the step's.
- A mock of a `foreach` step replaces the whole construct: items, body, and aggregate status. Individual body steps take no mock.
- A `foreach` step whose body steps are all side-effect free runs for real, over items from mocked upstream outputs.

## Assertions

`expect` holds at least one assertion. A step without an assertion is not checked.

```yaml
expect:
  status: failed
  attempts: 1
  steps:
    test:
      status: failed
      stderr:
        contains: FAIL ./uploader
    route: aborted
    handler_on.failure: succeeded
  notifications:
    - kind: mail_on.failure
```

| Field | Meaning |
|-------|---------|
| `status` | Run status: `succeeded`, `failed`, `aborted`, `partially_succeeded`, or `rejected`. |
| `attempts` | Run attempts, counting retries of a DAG-level `retry_policy`. |
| `steps.<key>` | A step status, or a map with one or more of `status`, `attempts`, `outputs`, `stdout`, and `stderr`. |
| `steps.<key>.status` | `succeeded`, `failed`, `aborted`, `skipped`, `partially_succeeded`, `rejected`, or `not_started`. |
| `steps.<key>.attempts` | Executions of the step's action, counting retries and repeat iterations. A skipped step has 0. |
| `steps.<key>.outputs` | Expected named outputs. |
| `steps.<key>.stdout`, `stderr` | `contains` (text), `matches` (RE2 regular expression), or both, on the last execution's stream. |
| `notifications` | The notifications the run would have sent. |

A case passes when the run reaches a terminal status and every assertion holds.

### Outputs, Logs, and Notifications

```yaml
# workflows/report.yaml
mail_on:
  failure: true
error_mail:
  from: dagu@example.com
  to: oncall@example.com
steps:
  - id: count
    run: ./count.sh
    outputs:
      - name: files
      - name: stats
        type: json
  - id: summary
    depends: count
    action: log.write
    with:
      message: ${steps.count.outputs.files} files changed
  - id: check
    depends: summary
    run: ./check.sh
```

```yaml
# workflows/report.test.yaml
mocks:
  count:
    outputs:
      files: "3"
      stats:
        files: 3
        lines: 40
  check: {}
cases:
  - name: the summary reports the count
    expect:
      status: succeeded
      steps:
        summary:
          stdout:
            contains: 3 files changed
            matches: '^\d+ files changed'
      notifications: []
  - name: a failed check sends one mail
    mocks:
      check:
        exit_code: 1
    expect:
      status: failed
      notifications:
        - kind: mail_on.failure
          to: [oncall@example.com]
```

`summary` runs its real `log.write` action with the mocked count.

- A string output matches a YAML string exactly. A `type: json` output, or any expected value that is not a string, matches when every listed key matches, recursively. Keys it does not list are ignored, and arrays and scalars match exactly.
- An output assertion on a mocked step checks only what the test supplied. It is most useful on side-effect-free steps, which run for real.
- A stream assertion reads the step's log of its last execution, with secrets masked. A step that never ran fails it.
- `notifications` compares without regard to order. Each item has `kind`: `mail_on.failure`, `mail_on.success`, `mail_on.wait`, or `mail_on_error`. It may set `to`, compared as a set, and, for `mail_on_error`, `step`. `notifications: []` asserts that the run would send none. No mail is sent under test.

## The Fail-Closed Rule

A case is invalid, and nothing runs, when the DAG has something that would run a command or reach a real system and the case does not handle it. The rule covers every step and handler, reached or not, so the outcome does not depend on the branch a case takes.

| Error label | Source | What the case adds |
|-------------|----------------|--------------------|
| `step <step>` | An action with side effects | A mock, `{}` included, or the step under `real` |
| `step <step>` | A precondition that runs a command | `precondition` in the step's mock, or the step under `real` |
| `step <step>` | A repeat condition that runs a command | `condition` in every result of the step's mock, or the step under `real` |
| `step <step>` | An object-form `output` with `from: file` | A mock that replaces the action, or the step under `real` |
| `step <step>` | A side-effect-free step that repeats without a `limit` | A mock with a result field, or the step under `real` |
| `step <step>, body step <body>` | A `foreach` body step with side effects | A mock of the `foreach` step |
| `step <step>` | A wait that needs values | `review` in the step's mock, also for a real step |
| `handler_on.<event>` | Any of the above on a handler | The same, keyed by `handler_on.<event>` |
| `secret <name>` | A secret, in a case with a real step | A value under the test file's `secrets` |
| `precondition` | A DAG-level precondition that runs a command | The case's `precondition` |
| `param <name>` | A `params[].eval` with command substitution | A value under `params` |
| `step <step>, child <dag>, ...` | Anything above in the child DAG of a real step | Nothing. Mock the parent step |

`<step>` is the step's `id`, or its `name` when it has none.

### The Fix, Ready to Paste

The error of an invalid case lists every unhandled source at once and ends with YAML that handles them:

```yaml
# workflows/ship.yaml
params:
  - name: env
    default: prod
  - name: build_date
    eval: $(date +%F)
steps:
  - id: build
    run: ./build.sh
  - id: deploy
    depends: build
    action: ssh.run
    with:
      host: prod.example.com
      user: deploy
      command: ./deploy.sh
handler_on:
  failure:
    action: mail.send
    with:
      from: dagu@example.com
      to: oncall@example.com
      subject: ship failed
      message: ship failed
```

```yaml
# workflows/ship.test.yaml
mocks:
  build: {}
cases:
  - name: ships
    expect:
      status: succeeded
```

```text
INVALID workflows/ship.test.yaml: ships
  param build_date: eval runs a command; give it a value under params
  step deploy: action ssh.run has side effects; mock it or list it under real
  handler_on.failure: action mail.send has side effects; mock it or list it under real
  fix, ready to paste:
    params:
      build_date: ""
    mocks:
      deploy: {}
      handler_on.failure: {}
1 case: 0 passed, 0 failed, 1 invalid
```

Paste the lines under `fix, ready to paste:` into the case, merged with the fields it already has, and the case runs. A missing secret value appears under `fix for the test file, ready to paste:`, for the test file's `secrets`.

The fix uses neutral values: `{}` for an action, `""` for each declared output, `precondition: met`, a `condition` that stops a repeat, and `review` with `decision: approve` and a value for each required input. Edit them into the scenario the case tests. A value that a form constraint such as `pattern` rejects carries the comment `# replace with a value the form accepts`, and the case stays invalid until it is replaced.

Other mistakes also make a case invalid, each with an error that names the field: a key that names no step, an output the step does not declare, an unknown status, a `matches` value that is not a valid RE2 expression, or a `review` on a step that does not wait.

## Secrets

Secrets never resolve through their providers under test. No registry, vault, file, or environment variable is read.

- A case without a real step needs no secret values. Each DAG `secrets` entry resolves to the placeholder `<secret:NAME>`, which is masked in logs like a secret value.
- A case with a real step needs a value in the test file's `secrets` for every DAG `secrets` entry and every SSH credential ref, since Dagu cannot tell which of them the real step reads. A missing one makes the case invalid.

```yaml
# workflows/publish.yaml
secrets:
  - name: API_TOKEN
    ref: prod/publish-token
steps:
  - id: lint
    run: echo "lint passed"
  - id: publish
    depends: lint
    run: ./publish.sh
```

```yaml
# workflows/publish.test.yaml
secrets:
  API_TOKEN: fake-token
mocks:
  publish: {}
cases:
  - name: publishes with every step mocked
    mocks:
      lint: {}
    expect:
      status: succeeded
  - name: lint runs for real
    real: [lint]
    expect:
      steps:
        lint:
          stdout:
            contains: lint passed
```

The first case would pass without `secrets`: `API_TOKEN` would resolve to its placeholder. The second case runs `lint` for real, so it needs a value for `API_TOKEN`. Without one, it is invalid, and its error starts with `secret API_TOKEN:`.

Test files are committed with the DAGs, so their `secrets` hold fake values. A step that needs a real credential to pass belongs under a mock, not under `real`. A committed test file never holds a real credential, and a case does not depend on the environment of the host that runs it.

## What Changes Under Test

| Behavior | Under test |
|----------|------------|
| Retry and repeat intervals, backoff, and `delay_sec` | Not waited for, except by real steps. The order and count of executions do not change. |
| `timeout_sec` | Applies as in a real run. A mocked action returns at once. |
| Run history, logs, artifacts, and `state` | Kept in a temporary case directory, removed when the case ends unless `--keep` is set. The configured data directory is not read or written. |
| `mail_on` and `mail_on_error` | Not sent. The report lists each notification the run would have sent. |
| OpenTelemetry export | Off. |
| `stdout` and `stderr` redirect files | Written inside the case directory. |
| The DAG's `working_dir`, DAG-level `container` and `ssh`, `tools`, and native resource limits | Set up only when the case has a real step. |
| A DAG-level `retry_policy` | `dagu test` retries the run in the same case without waiting. Mock results keep counting across run attempts. |
| `queue` and `worker_selector` | Ignored. The case runs locally, in the `dagu test` process. |

A test runs beside live runs of the same DAG. Neither sees the other, and the test's run does not appear in the DAG's history.

## Writing Tests Faster

### Start From the Fix

Write a case with the expectation you want, run it, and paste the fix:

1. Create the test file with one case and its `expect`.
2. Run `dagu test` on it. The case is invalid and lists every source the DAG has.
3. Paste the fix into the case, or move the mocks to the file level to share them across cases.
4. Change the pasted values into the scenario, such as a failing `exit_code` or a `high` risk output, and run again.

`default_mock: {}` is a shorter start: every step with side effects succeeds with no output, and the report lists the steps that took it.

### Generate a Test File

::: info Coming in a later release
`dagu test --init <dag file>` writes the DAG's test file beside it, with a mock for every source the fail-closed rule needs and one case named `initial` whose `expect` holds the result of a run with those mocks. It refuses to replace an existing test file. It ships in a release after `dagu test` itself.
:::

### Editor Support

Dagu publishes a JSON Schema for test files, so an editor with YAML schema support validates and completes them. A running Dagu server serves it at `/assets/workflow-test.schema.json`, under the server's base path, and the Dagu repository holds it at `schemas/workflow-test.schema.json`.

Name the schema in the first line of a test file:

```yaml
# yaml-language-server: $schema=http://localhost:8080/assets/workflow-test.schema.json
mocks:
  deploy: {}
cases:
  - name: deploys
    expect:
      status: succeeded
```

Or map every test file to it in VS Code `settings.json`, with the YAML extension:

```json
{
  "yaml.schemas": {
    "http://localhost:8080/assets/workflow-test.schema.json": ["*.test.yaml", "*.test.yml"]
  }
}
```

The schema rejects unknown fields and wrong types. `dagu test` stays the authority: it also checks what only the DAG can tell, such as a mock for a step the DAG lacks.

## Running Tests in CI

`dagu test` runs headless. Its exit status tells the result:

| Status | Meaning |
|--------|---------|
| `0` | Every selected case passed, or no case was selected. |
| `1` | At least one case failed. |
| `2` | At least one test file or case is invalid, or the arguments are invalid. |

The highest status that applies wins: a run with a failed case and an invalid case exits 2.

```yaml
# .github/workflows/dagu-test.yaml
name: Workflow tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Dagu
        run: npm install -g --ignore-scripts=false @dagucloud/dagu
      - name: Run workflow tests
        run: dagu test workflows/
```

Pass the directory that holds the DAGs. Without an argument, `dagu test` reads the DAGs directory of the loaded configuration, which is usually empty on a CI runner, and selecting no case exits 0.

A case without a real step needs no credential, container runtime, or network access, so a job that runs only such cases needs no CI secrets.

### JSON Report

`--format json` writes exactly one JSON object to stdout once every case has ended. Logs go to stderr. For the failing test file of [Reading the Report](#reading-the-report):

```bash
dagu test --format json workflows/release.test.yaml
```

```json
{"cases":[{"file":"workflows/release.test.yaml","name":"deploys the built image","result":"pass","duration_ms":207},{"file":"workflows/release.test.yaml","name":"a failed build skips the deploy","result":"fail","duration_ms":138,"failures":[{"step":"deploy","field":"status","expected":"skipped","actual":"aborted"}]}]}
```

To list only the cases that did not pass:

```bash
dagu test --format json workflows/ | jq '.cases[] | select(.result != "pass")'
```

| Case field | Present | Meaning |
|------------|---------|---------|
| `file` | Always | The test file. |
| `name` | Always | The case name. |
| `result` | Always | `pass`, `fail`, or `invalid`. |
| `duration_ms` | When the case ran | Wall-clock time in milliseconds. |
| `failures` | When `result` is `fail` | One object per failed assertion: `step`, `field`, `expected`, and `actual`. `field` is `status`, `attempts`, `outputs.<name>`, `stdout.contains`, `stdout.matches`, `stderr.contains`, `stderr.matches`, `notifications`, `timeout`, `limit`, or `error`. |
| `errors` | When `result` is `invalid` | One object per error: `source`, the label, and `message`. |
| `fix`, `file_fix` | When an invalid case has a fix | The fix for the case, and for the test file's `secrets`, as YAML text. |
| `default_mocked` | When the default mock applied | Step labels. |
| `auto_approved` | When a wait was approved automatically | Step labels. |
| `notifications` | When the run would have sent one | Objects with `kind`, `to`, and, for `mail_on_error`, `step`. |
| `case_dir` | With `--keep` | Absolute path of the kept case directory. |

An invalid test file appears under a top-level `invalid_files` list, each with `file` and `errors`.

## Example: An Agent Pipeline

A pipeline plans a change with a coding agent, implements it with retries, runs the tests, and routes on the planned risk:

```yaml
# workflows/change.yaml
params:
  - name: task
    type: string
    required: true
steps:
  - id: plan
    run: agent plan "${params.task}"
    outputs:
      - name: risk
  - id: implement
    depends: plan
    run: agent implement
    retry_policy:
      limit: 2
      interval_sec: 60
  - id: test
    depends: implement
    run: make test
  - id: route
    depends: test
    action: router.route
    with:
      value: ${steps.plan.outputs.risk}
      routes:
        high: [review]
        low: [merge]
  - id: review
    run: agent review
  - id: merge
    run: gh pr merge --auto
handler_on:
  failure:
    action: mail.send
    with:
      from: dagu@example.com
      to: oncall@example.com
      subject: change failed
      message: change failed
```

```yaml
# workflows/change.test.yaml
params:
  task: Add retries to the uploader
mocks:
  plan:
    outputs:
      risk: low
  implement: {}
  test: {}
  review: {}
  merge: {}
  handler_on.failure: {}
cases:
  - name: low risk merges without review
    expect:
      status: succeeded
      steps:
        merge: succeeded
        review: skipped
        handler_on.failure: not_started

  - name: high risk goes to review
    mocks:
      plan:
        outputs:
          risk: high
    expect:
      steps:
        review: succeeded
        merge: skipped

  - name: flaky implement passes on the third attempt
    mocks:
      implement:
        results:
          - exit_code: 1
          - exit_code: 1
          - exit_code: 0
    expect:
      steps:
        implement:
          status: succeeded
          attempts: 3

  - name: failing tests stop the run
    mocks:
      test:
        exit_code: 2
        stderr: FAIL ./uploader
    expect:
      status: failed
      steps:
        test:
          status: failed
          stderr:
            contains: FAIL ./uploader
        route: aborted
        handler_on.failure: succeeded
```

`route` runs its real `router.route` action, so the cases test the routing the DAG defines. No agent, `make`, or `gh` command runs, and the four cases finish without waiting for either 60-second retry interval. Removing the `handler_on.failure` mock makes every case invalid before any step runs.

## Limits

- A case runs the DAG locally, in the `dagu test` process. Scheduler, queue, coordinator, and worker behavior, and the restart loop of a [service](/writing-workflows/services), are out of scope.
- `type: agent` DAGs are not covered, and a test of a `type: build` DAG is invalid.
- `foreach` body steps and the steps of a real step's child run take no mocks.
- A mock replaces a whole action. Dagu does not virtualize HTTP or other services, and a test makes no timing assertions.
- Push-back of a waiting step, seeding `state`, and the Web UI, REST API, and MCP are not covered.
