# Core Concepts

Essential concepts for working with Dagu.

## DAG (Directed Acyclic Graph)

A DAG defines your workflow as a graph of dependencies:

- **Directed**: Steps execute in a specific order
- **Acyclic**: No circular dependencies allowed
- **Graph**: Steps connected by dependency relationships

```mermaid
graph LR
    A[Extract] --> B[Transform]
    B --> C[Load]
    B --> D[Report]
    C --> E[Notify]
    D --> E
```

## Workflow Components

### Steps

The basic unit of execution. Each step runs a command:

```yaml
steps:
  - command: curl -O https://example.com/data.csv  # Download data
  - command: python analyze.py data.csv           # Process data
```

Steps can execute multiple commands that share the same configuration:

```yaml
steps:
  - id: build_and_test
    command:
      - npm install
      - npm run build
      - npm test
    env:
      - NODE_ENV: production
```

### Dependencies

By default, steps run sequentially. Use `depends` for parallel execution:

```yaml
type: graph
steps:
  - id: A
    command: echo "First"

  - id: B
    command: echo "Second (after A)"
    depends: A

  - id: C
    command: echo "Parallel with B"
    depends: A  # Only depends on A, runs parallel to B

  - id: D
    command: echo "After both B and C"
    depends: [B, C]
```

### Parameters

```yaml
params:
  - name: env
    type: string
    default: dev
    enum: [dev, staging, prod]
    description: Target environment
  - name: region
    default: us-east-1
    description: Deployment region

steps:
  - command: echo "Deploying to ${env} in ${region}"
```

Override at runtime:
```bash
dagu start workflow.yaml -- env=prod region=eu-west-1
```

Parameter defaults are literal by default. If you need `$VAR` or backtick evaluation for a DAG param, use `eval:` on an inline rich parameter definition. Runtime overrides from the CLI, API, and sub-DAG calls remain literal.

### Variables

Pass data between steps using `output`:

```yaml
steps:
  - command: date +%Y%m%d
    output: TODAY
  - command: tar -czf backup_${TODAY}.tar.gz /data
```

## Status Management

### Execution States

- `not_started`: DAG has been defined but execution has not begun
- `queued`: DAG is waiting to be executed
- `running`: DAG is currently executing
- `succeeded`: All steps completed successfully
- `partially_succeeded`: Some steps failed but execution continued (via `continue_on`)
- `failed`: DAG execution failed
- `aborted`: DAG was manually aborted

### Status Transitions

```mermaid
graph LR
    N[not_started] --> Q[queued]
    Q --> R[running]
    R --> S[succeeded]
    R --> PS[partially_succeeded]
    R --> F[failed]
    R --> C[aborted]
```

### Step Status

- `not_started`: Step is waiting for dependencies
- `running`: Step is executing
- `succeeded`: Step completed successfully
- `partially_succeeded`: Step completed with warnings or continue-on logic
- `failed`: Step execution failed
- `aborted`: Step was aborted
- `skipped`: Step was skipped (precondition not met)

### Status Hooks

```yaml
handler_on:
  success:
    command: notify-team.sh "Workflow succeeded"
  failure:
    command: alert-oncall.sh "Workflow failed"
  partial_success:
    command: log-partial.sh "Some steps partially succeeded"
```

## Step Types

### Shell (Default)

Runs commands in the system shell. Set it once per DAG or override per step:

```yaml
shell: [bash, -e]  # Default shell + args for all steps
steps:
  - command: echo "Hello"   # Uses DAG shell
  - shell: /usr/bin/zsh     # Per-step override
    command: echo "Using zsh"
```

See [Shell](/step-types/shell) for more details.

### Docker

Execute in containers:

```yaml
container:
  image: python:3.11
  working_dir: /app
  volumes:
    - /app/data:/data
steps:
  - command: python script.py
```

See [Docker](/step-types/docker) for more details.

### SSH

Run on remote machines:

```yaml
ssh:
  user: ubuntu
  host: server.example.com
  key: ~/.ssh/id_rsa

steps:
  - command: echo "Running remote script"
```

See [SSH](/step-types/ssh) for more details.

### HTTP

Make API calls:

```yaml
steps:
  - type: http
    with:
      method: POST
      url: https://api.example.com/trigger
      headers:
        Authorization: Bearer ${API_TOKEN}
```

See [HTTP](/step-types/http) for more details.

### Custom Step Types

Define reusable step types in `step_types` when you want a typed wrapper around a builtin step type:

```yaml
step_types:
  greet:
    type: command
    input_schema:
      type: object
      additionalProperties: false
      required: [message]
      properties:
        message:
          type: string
    template:
      script: |
        #!/bin/bash
        printf '%s\n' {{ json .input.message }}

steps:
  - type: greet
    with:
      message: hello
```

The common case is a `type: command` custom step with a templated `script`. Schema defaults can be applied to the `with` object, the result is validated against `input_schema`, and then the template expands to a builtin step before execution. See [Custom Step Types](/writing-workflows/custom-step-types) for the full rules.

## Scheduling

Cron-based scheduling:

```yaml
schedule: "0 2 * * *"  # Daily at 2 AM
```

Multiple schedules:

```yaml
schedule:
  - "0 9 * * MON-FRI"  # Weekdays at 9 AM
  - "0 14 * * SAT,SUN" # Weekends at 2 PM
```

Start/stop schedules:

```yaml
schedule:
  start: "0 8 * * *"   # Start at 8 AM
  stop: "0 18 * * *"   # Stop at 6 PM
```

See [Scheduling](/writing-workflows/scheduling) for more details.

## Lifecycle Handlers

Execute commands on workflow events:

```yaml
handler_on:
  init:
    command: echo "Setting up environment"  # Runs before any steps

  success:
    command: echo "Workflow succeeded"

  failure:
    command: |
      echo "Workflow failed" | mail -s "Alert" admin@example.com

  abort:
    command: echo "Cleaning up resources"

  exit:
    command: echo "Always runs"
```

## See Also

- [Writing Workflows](/writing-workflows/) - Create your own workflows
- [Examples](/writing-workflows/examples) - Ready-to-use patterns
- [CLI Reference](/getting-started/cli) - Command-line usage
