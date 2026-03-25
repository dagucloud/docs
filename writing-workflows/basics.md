# Workflow Basics

Learn the fundamentals of writing Dagu workflows.

## Your First Workflow

Create `hello.yaml`:

```yaml
steps:
  - command: echo "Hello from Dagu!"
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
tags: [etl, production]

# Configuration  
schedule: "0 2 * * *"
params:
  - DATE: "2026-03-14"

env:
  - RUN_DATE: "`date +%Y-%m-%d`"

# Steps
steps:
  - id: process
    command: python process.py ${DATE} ${RUN_DATE}

# Handlers
handler_on:
  failure:
    command: notify-error.sh
```

## Steps

The basic unit of execution.

### Step Names

Step names are optional. When omitted, Dagu automatically generates names based on the step type:

```yaml
steps:
  - command: echo "First step"              # Auto-named: cmd_1
  - script: |                      # Auto-named: script_2
      echo "Multi-line"
      echo "Script"
  - id: explicit_name              # Explicit name
    command: echo "Third step"
  - type: http                     # Auto-named: http_4
    config:
      url: https://api.example.com
  - type: template                 # Auto-named: template_5
    config:
      data:
        name: Dagu
    script: "Hello, {{ .name }}!"
  - call: child-workflow           # Auto-named: dag_6
```

Auto-generated names follow the pattern `{type}_{number}`:
- `cmd_N` - Command steps
- `script_N` - Script steps
- `http_N` - HTTP steps
- `template_N` - Template steps
- `dag_N` - DAG steps
- `container_N` - Docker/container steps
- `ssh_N` - SSH steps
- `mail_N` - Mail steps
- `jq_N` - JQ steps

For parallel steps (see below), the pattern is `parallel_{group}_{type}_{index}`.

### Shorthand Command Syntax

For simple commands, you can use an even more concise syntax:

```yaml
steps:
  - command: echo "Hello World"
  - command: ls -la
  - command: python script.py
```

This is equivalent to:

```yaml
type: graph
steps:
  - id: step_1
    command: echo "Hello World"
  - id: step_2
    command: ls -la
    depends: step_1
  - id: step_3
    command: python script.py
    depends: step_2
```

### Multiple Commands

Multiple commands share the same step configuration:

```yaml
steps:
  - id: build_and_test
    command:
      - npm install
      - npm run build
      - npm test
    env:
      - NODE_ENV: production
    working_dir: /app
    retry_policy:
      limit: 3
```

Instead of duplicating `env`, `working_dir`, `retry_policy`, `preconditions`, `container`, etc. across multiple steps, combine commands into one step.

Commands run in order and stop on first failure. Retries restart from the first command.

**Trade-off:** You lose the ability to retry or resume from the middle of the command list. If you need granular control over individual command retries, use separate steps.

**Supported step types:** shell, command, docker, container, ssh

**Not supported:** jq, http, archive, mail, github_action, dag, template

These step types do not support multi-command arrays. Use `script:` for `template` steps.

### Multi-line Scripts

```yaml
steps:
  - script: |
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
    command: echo "Runs with bash -e -u"

  - id: zsh_override
    shell: /bin/zsh                # Step-level override
    command: echo "Uses zsh instead"
```

The `shell` value accepts either a string (`"bash -e"`) or an array (`["bash", "-e"]`). Arrays avoid quoting issues when you need multiple flags.

When you omit a step-level `shell`, Dagu runs through the DAG shell (or system default) and automatically adds `-e` on Unix-like shells so scripts stop on first error. If you explicitly set `shell` on a step, include `-e` yourself if you want the same errexit behavior.

```yaml
steps:
  - shell: python3
    script: |
      import pandas as pd
      df = pd.read_csv('data.csv')
      print(df.head())
```

## Dependencies

Steps run sequentially by default. Use `depends` for parallel execution or to control order.

```yaml
steps:
  - id: download
    command: wget data.csv

  - id: process
    command: python process.py

  - id: upload
    command: aws s3 cp output.csv s3://bucket/
```

### Parallel Execution

You can run steps in parallel using explicit dependencies:

```yaml
type: graph
steps:
  - id: setup
    command: echo "Setup"

  - id: task1
    command: echo "Task 1"
    depends: setup

  - id: task2
    command: echo "Task 2"
    depends: setup

  - id: finish
    command: echo "All tasks complete"
    depends: [task1, task2]
```

## Working Directory

Set where commands execute:

```yaml
steps:
  - id: in_project
    working_dir: /home/user/project
    command: python main.py

  - id: in_data
    working_dir: /data/input
    command: ls -la
```

## Environment Variables

Define environment variables at DAG-level or step-level:

```yaml
env:
  - API_KEY: secret123
  - ENV: production

steps:
  - id: dev_test
    command: echo "Running in $ENV"
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
    command: git rev-parse --short HEAD
    output: VERSION

  - id: build
    command: docker build -t app:${VERSION} .
```

## Basic Error Handling

### Continue on Failure

```yaml
steps:
  - id: optional_step
    command: maybe-fails.sh
    continue_on:
      failure: true

  - id: always_runs
    command: cleanup.sh
```

### Simple Retry

```yaml
steps:
  - id: flaky_api
    command: curl https://unstable-api.com
    retry_policy:
      limit: 3
```

## Timeouts

Prevent steps from running forever:

```yaml
steps:
  - id: long_task
    command: echo "Processing data"
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
    command: python etl.py
```

## Tags and Organization

Group related workflows:

```yaml
name: customer-report
tags: 
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
