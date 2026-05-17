# Workflow Basics

Learn the fundamentals of writing Dagu workflows.

## Your First Workflow

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

A complete workflow contains:

```yaml
# Metadata
name: data-pipeline
description: Process daily data
labels: [etl, production]

# Configuration  
schedule: "0 2 * * *"
params:
  - DATE: "2026-03-14"

env:
  - RUN_DATE: "`date +%Y-%m-%d`"

# Steps
steps:
  - id: process
    run: python process.py ${DATE} ${RUN_DATE}

# Handlers
handler_on:
  failure:
    run: notify-error.sh
```

## Steps

The basic unit of execution.

### Step Names

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

Auto-generated names follow the pattern `{executor}_{number}`:
- `cmd_N` - single-line `run` steps
- `script_N` - multi-line `run` steps
- `http_N` - `http.request` actions
- `template_N` - `template.render` actions
- `dag_N` - `dag.run` actions
- `container_N` - Docker/container actions
- `ssh_N` - `ssh.run` actions
- `mail_N` - `mail.send` actions
- `jq_N` - `jq.filter` actions

For parallel steps (see below), the pattern is `parallel_{group}_{executor}_{index}`.

### Shell Commands

Use `run` for shell commands and scripts:

```yaml
steps:
  - run: echo "Hello World"
  - run: ls -la
  - run: python script.py
```

This is equivalent to:

```yaml
type: graph
steps:
  - id: step_1
    run: echo "Hello World"
  - id: step_2
    run: ls -la
    depends: step_1
  - id: step_3
    run: python script.py
    depends: step_2
```

### Multiple Commands

Multiple commands share the same step configuration:

```yaml
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
```

Instead of duplicating `env`, `working_dir`, `retry_policy`, `preconditions`, `container`, etc. across multiple steps, combine commands into one step.

Commands run in order and stop on first failure. Retries restart from the first command.

**Trade-off:** You lose the ability to retry or resume from the middle of the command list. If you need granular control over individual command retries, use separate steps.

For non-shell work, use an explicit `action` and put action-specific inputs under `with`.

### Multi-line Scripts

```yaml
steps:
  - run: |
      #!/bin/bash
      set -e

      echo "Processing..."
      python analyze.py data.csv
      echo "Complete"
```

If you omit `shell`, Dagu uses the interpreter declared in the script's shebang (`#!`) when present.

### Shell Selection

Set a default shell for every step at the DAG level, and override it per step when needed:

```yaml
shell: ["/bin/bash", "-e", "-u"]  # Default shell + args for the whole workflow
steps:
  - id: bash_task
    run: echo "Runs with bash -e -u"

  - id: zsh_override
    run: echo "Uses zsh instead"
    with:
      shell: /bin/zsh              # Step-level override
```

The `shell` value accepts either a string (`"bash -e"`) or an array (`["bash", "-e"]`). Arrays avoid quoting issues when you need multiple flags.

When you omit a step-level `shell`, Dagu runs through the DAG shell (or system default) and automatically adds `-e` on Unix-like shells so scripts stop on first error. If you explicitly set `shell` on a step, include `-e` yourself if you want the same errexit behavior.

```yaml
steps:
  - run: |
      import pandas as pd
      df = pd.read_csv('data.csv')
      print(df.head())
    with:
      shell: python3
```

## Dependencies

```yaml
steps:
  - id: download
    run: wget data.csv

  - id: process
    run: python process.py

  - id: upload
    run: aws s3 cp output.csv s3://bucket/
```

### Parallel Execution

You can run steps in parallel using explicit dependencies:

```yaml
type: graph
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

Set where commands execute:

```yaml
steps:
  - id: in_project
    working_dir: /home/user/project
    run: python main.py

  - id: in_data
    working_dir: /data/input
    run: ls -la
```

## Environment Variables

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

Store command output in variables:

```yaml
steps:
  - id: get_version
    run: git rev-parse --short HEAD
    output: VERSION

  - id: build
    run: docker build -t app:${VERSION} .
```

## Basic Error Handling

### Continue on Failure

```yaml
steps:
  - id: optional_step
    run: maybe-fails.sh
    continue_on:
      failure: true

  - id: always_runs
    run: cleanup.sh
```

### Simple Retry

```yaml
steps:
  - id: flaky_api
    run: curl https://unstable-api.com
    retry_policy:
      limit: 3
```

## Timeouts

Prevent steps from running forever:

```yaml
steps:
  - id: long_task
    run: echo "Processing data"
    timeout_sec: 300  # 5 minutes
```

## Step Descriptions

Document your steps:

```yaml
steps:
  - id: etl_process
    description: |
      Extract data from API, transform to CSV,
      and load into data warehouse
    run: python etl.py
```

## Labels and Organization

Group related workflows:

```yaml
name: customer-report
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
