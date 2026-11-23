---
description: Test how a DAG behaves with dagu test. A test file beside the DAG mocks its step actions and asserts run and step statuses, outputs, logs, and notifications, without running commands.
---

# Workflow Tests

A workflow test checks how a DAG behaves without running its commands. A test file sits beside the DAG it tests. It replaces step actions with scripted results and states what each case must end with: the run status, step statuses, attempts, outputs, logs, and the notifications the run would send.

`dagu test` runs each case through the same runner as `dagu start`. Dependencies, preconditions, routing, retries, repeats, `continue_on`, handlers, and status propagation behave as in a real run. Only the mocked actions differ. The DAG needs no change to be testable.

A missing mock never reaches a real system. When a step with side effects has no mock and is not listed as real, the case is invalid and nothing runs.

This page shows how to write and run tests. [Workflow Test Reference](/writing-workflows/workflow-test-reference) lists every field, error, and report format.

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

A DAG that already has such a name becomes a test file after the upgrade and stops running on its schedule. Rename it, for example from `smoke.test.yaml` to `smoke-test.yaml`, and update the DAGs that start it by its old name. See [Upgrades](/server-admin/upgrades#upgrading-from-2-27-0-or-earlier).

## Running Tests

```bash
dagu test [flags] [<test file or directory>...]
```

- A file argument must be a test file.
- A directory argument runs every test file under it, at any depth. Directories whose names start with `.` are skipped, and symbolic links are not followed.
- Without an argument, `dagu test` runs every test file under the DAGs directory of the loaded configuration.
- Test files run one at a time, in path order. The cases of a file run one at a time, in file order.
- An invalid test file or case does not stop the others.
- Each case runs in its own temporary directory, which holds its run history and logs. The configured data directory is not read or written. See [What changes under test](/writing-workflows/workflow-test-reference#what-changes-under-test).

```bash
dagu test workflows/release.test.yaml         # One test file
dagu test --run 'failed build' workflows/     # Cases whose name matches an RE2 expression
dagu test --timeout 30s workflows/            # Fail a case that runs longer than 30s (default 5m)
dagu test --keep workflows/                   # Keep each case directory and print its path
dagu test --format json workflows/            # One JSON object for CI
```

See the [CLI Reference](/getting-started/cli#test) for every flag.

### Reading the Report

Each case starts with one line: `PASS`, `FAIL`, or `INVALID`, the test file, the case name, and, for a case that ran, its duration. Lines indented under it give the details, and a summary line ends the report.

When the second case of the quick start expects `deploy: skipped` and is named `a failed build skips the deploy`, the report reads:

```text
PASS workflows/release.test.yaml: deploys the built image (0.21s)
FAIL workflows/release.test.yaml: a failed build skips the deploy (0.19s)
  step deploy: expected skipped, got aborted
2 cases: 1 passed, 1 failed
```

A failed case lists every failed assertion, not only the first. Under each case that ran, the report also lists the steps that took the [default mock](#the-default-mock), the waits [approved automatically](#steps-that-wait-for-a-person), and the notifications the run would have sent. An invalid case lists its errors and ends with the [fix](#the-fix-ready-to-paste).

## Writing a Test File

Fields at the top of a test file apply to every case: `params`, `env`, `secrets`, `mocks`, `default_mock`, and `real`. A case sets its own `params`, `env`, `mocks`, `default_mock`, and `real`, plus `trigger`, `scheduled_at`, `precondition`, and the required `name` and `expect`.

- A case's `params` and `env` merge over the file's, by name.
- A case's mock of a step replaces the file's mock of that step as a whole. Fields of the two mocks do not merge.
- A case's `real` adds to the file's.

`mocks`, `real`, and `expect.steps` name a step by its `id` or `name`, and a lifecycle handler as `handler_on.<event>`, such as `handler_on.failure`. A key that names no step or handler makes the case invalid. See [Workflow Test Reference](/writing-workflows/workflow-test-reference#the-test-file) for every field.

## Mocks

A mock replaces what a step's action returns. Its result fields, `exit_code`, `stdout`, `stderr`, `outputs`, and `condition`, script one execution. Its step fields, `precondition` and `review`, script what happens around the action. `{}` is a valid mock: on a step with side effects, it succeeds with exit code 0 and no output.

A mocked step keeps everything around its action. Retries read its exit code, `continue_on` and status propagation apply, string-form `output: VAR` captures its `stdout`, and its `env`, `with`, and `run` fields resolve as in a real run. It starts no process, opens no connection, creates no container, and reads no file.

### Results per Execution

`results` scripts each execution in turn: the first attempt takes the first result, and each retry and each repeat iteration takes the next. After the last result, later executions take the last result again.

```yaml
# workflows/poll.yaml
steps:
  - id: poll
    run: ./poll.sh
    repeat_policy:
      repeat: while
      condition: test -f pending.flag
      interval_sec: 30
      limit: 10
```

```yaml
# workflows/poll.test.yaml
cases:
  - name: polls until nothing is pending
    mocks:
      poll:
        results:
          - condition: met
          - condition: met
          - condition: not_met
    expect:
      steps:
        poll:
          status: succeeded
          attempts: 3
```

`condition` decides the command-check repeat condition after each execution, so `test -f pending.flag` never runs. `met` keeps a `while` step repeating and stops an `until` step. The case passes at once: Dagu does not wait for repeat or retry intervals. A step that retries takes its results the same way, as the [agent pipeline](#example-an-agent-pipeline) shows.

A mock sets either `results` or inline result fields, not both. Step fields sit beside `results`, never inside an item.

### Mocked Outputs

A step that declares outputs, through `outputs`, `output_schema`, object-form `output`, `stdout.outputs`, or its action, has known outputs. A mock with exit code 0 sets every known output and no other name. A missing or extra name makes the case invalid, as a real run would fail the step. A `type: json` output takes any YAML value. See [Mocked outputs](/writing-workflows/workflow-test-reference#mocked-outputs) for the rules.

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

Only a line in `real` runs such a step. A mock on a real step may set step fields, such as `precondition` or `review`, but no result field. A real `dag.run` or `parallel` step runs its child DAG in the case, and the child takes no mocks, so a child step with side effects makes the case invalid. Mock the parent step instead.

### The Default Mock

`default_mock` covers every step that needs a mock and that `mocks` and `real` do not name. It never runs anything real, so a test keeps the fail-closed guarantee without a line per step.

```yaml
# workflows/release.test.yaml
default_mock: {}
cases:
  - name: every step succeeds by default
    expect:
      status: succeeded
```

```text
PASS workflows/release.test.yaml: every step succeeds by default (0.16s)
  default mock: build, deploy
1 case: 1 passed, 0 failed
```

The report lists the steps it applied to, so the steps a test never scripted stay visible. It sets no `outputs`: `build` publishes `image_tag` as an empty string. A step named under `mocks` takes its own mock instead. The default mock does not handle DAG-level preconditions, `params[].eval`, or secrets.

### Preconditions

A precondition that compares a value, such as `${steps.plan.outputs.risk}` with `expected`, evaluates as in a real run, against mocked outputs and the case's params and env. A precondition that runs a command, or an `eval` with command substitution, runs only on a [real step](#steps-that-run-for-real) whose mock sets no `precondition`. Otherwise the test decides its outcome:

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

In the first case, the gate of `release` needs no values, so it is approved automatically, and the report lists `approved automatically: release`. The gate of `announce` takes its `review`. `reject` on an approval gate ends the step and the run `rejected`. A `human.task` takes only `approve`, and its `values` must pass its form. See [Approval Gates](/writing-workflows/approval) and [Human Tasks](/writing-workflows/human-tasks).

### Sub-DAG, Parallel, and Foreach Steps

- A mock of a `dag.run`, `dag.enqueue`, or `parallel` step replaces its child runs. No child starts or is queued. The mock's result and `outputs` are the step's.
- A mock of a `foreach` step replaces the whole construct: items, body, and aggregate status. Individual body steps take no mock, and `real` takes no `foreach` step.
- A `foreach` step whose body steps are all side-effect free runs for real, over items from mocked upstream outputs.

## Assertions

`expect` holds at least one assertion: the run `status` or `attempts`, an entry under `steps`, or `notifications`. A step entry is a status, or a map of `status`, `attempts`, `outputs`, `stdout`, and `stderr`. A step without an entry is not checked. A case passes when the run reaches a terminal status and every assertion holds.

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

`summary` runs its real `log.write` action with the mocked count, so the stream assertion checks the message the DAG builds. `notifications: []` asserts that the first case would send no mail. The second case asserts the failure mail. No mail is sent under test.

An output assertion on a mocked step checks only what the test supplied. It is most useful on side-effect-free steps, which run for real. See [Assertions](/writing-workflows/workflow-test-reference#assertions) for status values and matching rules.

## The Fail-Closed Rule

A case is invalid, and nothing runs, when the DAG has something that would run a command or reach a real system and the case does not handle it:

- a step action with side effects;
- a precondition or repeat condition that runs a command;
- an object-form `output` that reads a file;
- a side-effect-free step that repeats without a limit;
- a wait that needs values;
- a `params[].eval` with command substitution;
- a secret, in a case with a real step.

The rule covers every step and handler, reached or not, so the outcome does not depend on the branch a case takes. [Fail-closed sources](/writing-workflows/workflow-test-reference#fail-closed-sources) lists each error label and what it asks for.

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

`env` has no command substitution, so it needs nothing. Paste the lines under `fix, ready to paste:` into the case, merged with the fields it already has, and the case runs. A missing secret value appears under `fix for the test file, ready to paste:`, for the test file's `secrets`.

The fix uses neutral values: `{}` for an action, `""` for each declared output, `precondition: met`, a `condition` that stops a repeat, and `review` with `decision: approve` and a value for each required input. Edit them into the scenario the case tests.

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

## Writing Tests Faster

### Generate a Test File

`dagu test --init` writes the test file of a DAG beside it. With `workflows/release.yaml` from the quick start and no test file beside it:

```bash
dagu test --init workflows/release.yaml
```

It prints `workflows/release.test.yaml` and writes:

```yaml
mocks:
  build:
    outputs:
      image_tag: ""
  deploy: {}
cases:
  - name: initial
    expect:
      status: succeeded
      steps:
        build: succeeded
        deploy: succeeded
```

- The mocks and `params` are the ones the [fix](#the-fix-ready-to-paste) would print, plus a value for each required param without a default.
- The `initial` case expects what a run with those mocks did: the run status, every step's and handler's status, attempts above 1, and any notifications.
- It never replaces a test file. With one beside the DAG, it writes nothing and exits 2.
- `--timeout` bounds the run. `--run`, `--keep`, and `--format json` are rejected with it.

The written case records what the neutral mocks did, not what the DAG should do. On the [agent pipeline](#example-an-agent-pipeline), `risk: ""` matches no route, so `initial` expects `review` and `merge` to be `skipped`. Set the values each scenario needs, add cases, and remove the step entries a case does not care about.

When the case is still invalid, such as a form value marked `# replace with a value the form accepts`, the file expects `status: succeeded`, the case's report follows the path, and `dagu test --init` exits 2.

### When the DAG Changes

A step with side effects added to the DAG makes every case invalid until the test handles it, and each case prints the [fix](#the-fix-ready-to-paste) for it. Paste the fix into the file's `mocks`, or set `default_mock: {}` to cover new steps without a line each. The report then lists the steps that took the default mock.

### Editor Support

Dagu publishes a JSON Schema for test files, so an editor with YAML schema support validates and completes them. `dagu schema test` prints it; save it beside your DAGs:

```bash
dagu schema test > workflow-test.schema.json
```

Write the file again after upgrading Dagu, since the schema follows the binary. `dagu schema test <path>` prints one part, such as `dagu schema test cases.expect` for the assertions.

A running Dagu server also serves it at `/assets/workflow-test.schema.json`, under the server's base path, so an editor can use that URL instead of a file.

Name the schema in the first line of a test file:

```yaml
# yaml-language-server: $schema=./workflow-test.schema.json
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
    "./workflow-test.schema.json": ["*.test.yaml", "*.test.yml"]
  }
}
```

The schema rejects unknown fields and wrong types. `dagu test` stays the authority: it also checks what only the DAG can tell, such as a mock for a step the DAG lacks.

## Running Tests in CI

`dagu test` runs headless. It exits 0 when every selected case passed, 1 when a case failed, and 2 when a test file, a case, or the arguments are invalid. The highest status that applies wins.

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

`--format json` writes exactly one JSON object to stdout once every case has ended, and logs go to stderr. For the failing test file of [Reading the Report](#reading-the-report):

```json
{"cases":[{"file":"workflows/release.test.yaml","name":"deploys the built image","result":"pass","duration_ms":207},{"file":"workflows/release.test.yaml","name":"a failed build skips the deploy","result":"fail","duration_ms":138,"failures":[{"step":"deploy","field":"status","expected":"skipped","actual":"aborted"}]}]}
```

To list only the cases that did not pass:

```bash
dagu test --format json workflows/ | jq '.cases[] | select(.result != "pass")'
```

See [JSON report](/writing-workflows/workflow-test-reference#json-report) for every field.

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

`route` runs its real `router.route` action, so the cases test the routing the DAG defines. No agent, `make`, or `gh` command runs, and the flaky case finishes without waiting for either 60-second retry interval. Removing the `handler_on.failure` mock makes every case invalid before any step runs.

## Limits

- A case runs the DAG locally, in the `dagu test` process. Scheduler, queue, coordinator, and worker behavior, and the restart loop of a [service](/writing-workflows/services), are out of scope.
- `type: agent` DAGs are not covered, and a test of a `type: build` DAG is invalid.
- `foreach` body steps and the steps of a real step's child run take no mocks.
- A mock replaces a whole action. Dagu does not virtualize HTTP or other services, and a test makes no timing assertions.
- Push-back of a waiting step, seeding `state`, and the Web UI, REST API, and MCP are not covered.
