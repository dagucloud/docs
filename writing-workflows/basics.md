# Workflow Basics

Learn the fundamentals of writing Dagu workflows.

## Your First Workflow

Details: [write your first workflow](/getting-started/quickstart#_2-write-your-first-workflow) and [run it](/getting-started/quickstart#_3-run-it).

Create `hello.yaml`:

```yaml
steps:
  - run: echo "Hello from Dagu!"
```

Run it:
```bash
dagu start hello.yaml
```

## Workflow Structure

Details: [typical workflow](/writing-workflows/yaml-specification#typical-workflow) and [top-level fields](/writing-workflows/yaml-specification#top-level-fields).

A typical workflow uses these top-level fields:

```yaml
# Metadata
description: Process daily data
group: Analytics
labels: [etl, production]

# Run control
schedule: "0 2 * * *"
working_dir: /srv/dagu/data-pipeline

# Defaults for every step
defaults:
  retry_policy:
    limit: 2
    interval_sec: 30
  timeout_sec: 600

# Runtime inputs
params:
  - name: DATE
    eval: "`date +%Y-%m-%d`"
    default: "2026-03-14"

# Environment
env:
  - RUN_DATE: ${params.DATE}

# Tool versions
tools:
  - astral-sh/uv@0.11.14

# Steps
steps:
  - id: process
    run: uv run --python 3.13.9 python process.py "${params.DATE}" "${env.RUN_DATE}"

# Handlers
handler_on:
  failure:
    run: notify-error.sh
```

Add `defaults` when several steps share retry, timeout, environment, or precondition settings.

## Steps

The basic unit of execution.

Details: [step fields](/writing-workflows/yaml-specification#step-fields).

### Step Names

Details: [step identity](/writing-workflows/yaml-specification#step-identity).

Step names are optional. When omitted, Dagu automatically generates names based on the action:

```yaml
steps:
  - run: echo "First step"                  # Auto-named: cmd_1

  - run: |                                  # Auto-named: cmd_2
      echo "Multi-line"
      echo "Script"

  - id: explicit_name              # Explicit name
    run: echo "Third step"

  - action: http.request           # Auto-named: http_4
    with:
      method: GET
      url: https://api.example.com

  - action: template.render        # Auto-named: template_5
    with:
      template: "Hello, {{ .name }}!"
      data:
        name: Dagu

  - action: dag.run                # Auto-named: dag_6
    with:
      dag: child-workflow
```

### Shell Commands

Details: [shell command steps](/step-types/shell#running-commands).

Use `run` for shell commands and scripts:

```yaml
tools:
  - astral-sh/uv@0.11.14

steps:
  - run: echo "Hello World"
  - run: ls -la
  - run: uv run --python 3.13.9 python script.py
```

This is equivalent to:

```yaml
tools:
  - astral-sh/uv@0.11.14

steps:
  - id: step_1
    run: echo "Hello World"
  - id: step_2
    run: ls -la
    depends: step_1

  - id: step_3
    run: uv run --python 3.13.9 python script.py
    depends: step_2
```

### Multiple Commands

Details: [multiple shell commands](/step-types/shell#running-commands).

Multiple commands share the same step configuration:

```yaml
tools:
  - nodejs/node@v22.21.1

steps:
  - id: build_and_test
    run: |
      npm install
      npm run build
      npm test
    env:
      - NODE_ENV: production
    working_dir: /app
    retry_policy:
      limit: 3
      interval_sec: 10
```

Instead of duplicating `env`, `working_dir`, `retry_policy`, `preconditions`, `container`, etc. across multiple steps, combine commands into one step.

Commands run in order and stop on first failure. Retries restart from the first command.

**Trade-off:** You lose the ability to retry or resume from the middle of the command list. If you need granular control over individual command retries, use separate steps.

For non-shell work, use an explicit `action` and put action-specific inputs under `with`.

### Multi-line Scripts

Details: [script behavior](/step-types/shell#script-behavior).

```yaml
tools:
  - astral-sh/uv@0.11.14

steps:
  - run: |
      #!/bin/bash
      set -e

      echo "Processing..."
      uv run --python 3.13.9 python analyze.py data.csv
      echo "Complete"
```

If you omit `shell`, Dagu uses the interpreter declared in the script's shebang (`#!`) when present.

### Shell Selection

Details: [configure the shell](/step-types/shell#configure-the-shell).

Set a default shell for every step at the DAG level, and override it per step when needed:

```yaml
shell: /bin/bash                  # Default shell for the whole workflow
shell_args: ["-e", "-u"]          # Default shell args for every run step

steps:
  - id: bash_task
    run: echo "Runs with bash -e -u"

  - id: zsh_override
    run: echo "Uses zsh instead"
    with:
      shell: /bin/zsh              # Step-level override
```

The `shell` value accepts either a string (`"bash -e"`) or an array (`["bash", "-e"]`). Use `shell_args` when you want to keep the shell command and its default arguments separate. Arrays avoid quoting issues when you need multiple flags.

When you omit a step-level `shell`, Dagu runs through the DAG shell (or system default) and automatically adds `-e` on Unix-like shells so scripts stop on first error. If you explicitly set `shell` on a step, include `-e` yourself if you want the same errexit behavior.

```yaml
tools:
  - astral-sh/uv@0.11.14

steps:
  - run: |
      import pandas as pd
      df = pd.read_csv('data.csv')
      print(df.head())
    with:
      shell: uv run --python 3.13.9 python
```

## Dependencies

Details: [execution order](/writing-workflows/execution-control#execution-order).

```yaml
tools:
  - astral-sh/uv@0.11.14

steps:
  - id: download
    run: wget data.csv

  - id: process
    run: uv run --python 3.13.9 python process.py
    depends: download

  - id: upload
    run: aws s3 cp output.csv s3://bucket/
    depends: process
```

### Parallel Execution

Details: [parallel execution](/writing-workflows/execution-control#parallel-execution) and [parallel with dependencies](/writing-workflows/execution-control#parallel-with-dependencies).

You can run steps in parallel using explicit dependencies:

```yaml
steps:
  - id: setup
    run: echo "Setup"

  - id: task1
    run: echo "Task 1"
    depends: setup

  - id: task2
    run: echo "Task 2"
    depends: setup

  - id: finish
    run: echo "All tasks complete"
    depends: [task1, task2]
```

## Working Directory

Details: [`working_dir` field](/writing-workflows/yaml-specification#data-environment-and-files) and [quickstart example](/getting-started/quickstart#working-directory).

Set `working_dir` at the DAG level when most steps run from the same project directory. Relative paths resolve from the DAG file directory.

```yaml
working_dir: /home/user/project

tools:
  - astral-sh/uv@0.11.14

steps:
  - id: process
    run: uv run --python 3.13.9 python main.py

  - id: inspect_input
    working_dir: /data/input
    run: ls -la
```

Use step-level `working_dir` only for the steps that need a different directory.

## Defaults

Details: [step defaults](/writing-workflows/step-defaults#supported-fields) and [merge rules](/writing-workflows/step-defaults#merge-rules).

Use `defaults` for settings that most steps should share. A step can override the default when it needs different behavior.

```yaml
defaults:
  retry_policy:
    limit: 3
    interval_sec: 10
  timeout_sec: 300
  env:
    LOG_LEVEL: info

steps:
  - id: fetch
    run: ./fetch.sh

  - id: publish
    run: ./publish.sh
    retry_policy:
      limit: 1
      interval_sec: 60
    depends: fetch
```

## Environment Variables

Details: [DAG-level variables](/writing-workflows/environment-variables#dag-level-variables), [step-level variables](/writing-workflows/environment-variables#step-level-variables), and [variable expansion](/writing-workflows/environment-variables#variable-expansion-syntax).

Define environment variables at DAG-level or step-level:

```yaml
env:
  - API_KEY: secret123
  - ENV: production

steps:
  - id: dev_test
    run: echo "Running in $ENV"
    env:
      - ENV: development  # Overrides DAG-level
```

::: tip
Dagu filters system environment variables for security. See [Environment Variables](/writing-workflows/environment-variables) for details on filtering, inheritance, and `.env` file support.
:::

## Capturing Output

Details: [output basics](/writing-workflows/outputs#basic-example), [output file format](/writing-workflows/outputs#output-file-format), and [output names](/writing-workflows/outputs#output-names).

Store command output in variables:

```yaml
steps:
  - id: get_version
    run: |
      printf 'version=%s\n' "$(git rev-parse --short HEAD)" >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: version

  - id: build
    run: docker build -t "app:${steps.get_version.outputs.version}" .
    depends: get_version
```

## Basic Error Handling

Details: [error handling](/writing-workflows/error-handling#continue-on-conditions).

### Continue on Failure

Details: [continue_on syntax](/writing-workflows/continue-on#syntax) and [failure behavior](/writing-workflows/continue-on#failure).

```yaml
steps:
  - id: optional_step
    run: maybe-fails.sh
    continue_on:
      failure: true

  - id: always_runs
    run: cleanup.sh
    depends: optional_step
```

### Simple Retry

Details: [step retry policy](/writing-workflows/durable-execution#step-retry-policy) and [retry backoff](/writing-workflows/execution-control#retry-with-backoff).

```yaml
steps:
  - id: flaky_api
    run: curl https://unstable-api.com
    retry_policy:
      limit: 3
      interval_sec: 10
```

## Timeouts

Details: [step timeouts](/writing-workflows/execution-control#step-timeout-timeout-sec) and [timeout limits](/writing-workflows/resource-limits#timeouts).

Prevent steps from running forever:

```yaml
steps:
  - id: long_task
    run: echo "Processing data"
    timeout_sec: 300  # 5 minutes
```

## Step Descriptions

Details: [step identity fields](/writing-workflows/yaml-specification#step-identity).

Document your steps:

```yaml
tools:
  - astral-sh/uv@0.11.14

steps:
  - id: etl_process
    description: |
      Extract data from API, transform to CSV,
      and load into data warehouse
    run: uv run --python 3.13.9 python etl.py
```

## Labels and Organization

Details: [label YAML formats](/writing-workflows/labels#yaml-formats) and [metadata fields](/writing-workflows/yaml-specification#metadata).

Group related workflows:

```yaml
labels:
  - reports
  - customer
  - daily

group: Analytics  # UI grouping
```

## See Also

- [Control Flow](/writing-workflows/control-flow) - Conditionals and loops
- [Data & Variables](/writing-workflows/data-variables) - Pass data between steps
- [Error Handling](/writing-workflows/error-handling) - Advanced error recovery
- [Parameters](/writing-workflows/parameters) - Make workflows configurable
