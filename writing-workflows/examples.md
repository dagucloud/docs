# Examples

Quick reference for all Dagu features. Each example is minimal and copy-paste ready.

## Basic Workflows

<div class="examples-grid">

<div class="example-card">

### Basic Sequential Steps

```yaml
steps:
  - id: first
    run: echo "Step 1"
  - id: second
    run: echo "Step 2"
    depends: first
```

```mermaid
graph LR
    A[first] --> B[second]
    style A stroke:lightblue,stroke-width:1.6px,color:#333
    style B stroke:lightblue,stroke-width:1.6px,color:#333
```

<a href="/writing-workflows/basics#sequential-execution" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Parallel Execution (Iterator)

```yaml
steps:
  - action: dag.run
    with:
      dag: processor
      params: "item=${env.ITEM}"
    parallel:
      items: [A, B, C]
      max_concurrent: 2
---
name: processor
params:
  - name: item
    required: true
steps:
  - run: echo "Processing ${params.item}"
```

```mermaid
graph TD
    A[Start] --> B[Process A]
    A --> C[Process B]
    A --> D[Process C]
    B --> E[End]
    C --> E
    D --> E
    style A stroke:lightblue,stroke-width:1.6px,color:#333
    style B stroke:lime,stroke-width:1.6px,color:#333
    style C stroke:lime,stroke-width:1.6px,color:#333
    style D stroke:lime,stroke-width:1.6px,color:#333
    style E stroke:green,stroke-width:1.6px,color:#333
```

<a href="/writing-workflows/execution-control#parallel" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Multiple Commands per Step

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
```

Share step config (`env`, `working_dir`, `retry_policy`, etc.) across commands instead of duplicating across steps.

<a href="/writing-workflows/basics#multiple-commands" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Reproducible CLI Tools

```yaml
tools:
  - jqlang/jq@jq-1.7.1

steps:
  - id: transform
    run: jq '.items[] | .name' input.json
```

Pin portable command-line dependencies in the DAG so workers install the expected binary before running host command steps.

<a href="/writing-workflows/tools" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Dependency Modes

```yaml
# Default graph mode: explicit dependencies define order
steps:
  - id: step_1
    run: echo "step 1"
  - id: step_2
    run: echo "step 2"
    depends: step_1

# Independent steps can run in parallel
---
steps:
  - id: a
    run: echo A
  - id: b
    run: echo B
```

```mermaid
graph LR
  subgraph Chain
    C1[step 1] --> C2[step 2]
  end
  subgraph Graph
    G1[a]
    G2[b]
  end
  style C1 stroke:lightblue,stroke-width:1.6px,color:#333
  style C2 stroke:lightblue,stroke-width:1.6px,color:#333
  style G1 stroke:lime,stroke-width:1.6px,color:#333
  style G2 stroke:lime,stroke-width:1.6px,color:#333
```

<a href="/writing-workflows/basics#parallel-execution" class="learn-more">Learn more →</a>

</div>

</div>

## Control Flow & Conditions

<div class="examples-grid">

<div class="example-card">

### Conditional Execution

```yaml
steps:
  - run: echo "Deploying application"
    preconditions:
      - condition: "${env.ENV}"
        expected: "production"
```

```mermaid
flowchart TD
    A[Start] --> B{ENV == production?}
    B --> |Yes| C[deploy]
    B --> |No| D[Skip]
    C --> E[End]
    D --> E
    
    style A stroke:lightblue,stroke-width:1.6px,color:#333
    style B stroke:lightblue,stroke-width:1.6px,color:#333
    style C stroke:green,stroke-width:1.6px,color:#333
    style D stroke:gray,stroke-width:1.6px,color:#333
    style E stroke:lightblue,stroke-width:1.6px,color:#333
```

<a href="/writing-workflows/control-flow#conditions" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Repeat Until Condition

> Looking for iteration over a list? See [Parallel Execution](#parallel-execution-iterator).

```yaml
steps:
  - run: curl -f http://service/health
    repeat_policy:
      repeat: true
      interval_sec: 10
      exit_code: [1]  # Repeat while exit code is 1
```

```mermaid
flowchart TD
  A[Execute curl -f /health] --> B{Exit code == 1?}
  B --> |Yes| W[Wait interval_sec] --> A
  B --> |No| N[Next step]
  style A stroke:lightblue,stroke-width:1.6px,color:#333
  style W stroke:lightblue,stroke-width:1.6px,color:#333
  style N stroke:green,stroke-width:1.6px,color:#333
```

<a href="/writing-workflows/control-flow#repeat" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Repeat Until Command Succeeds

```yaml
steps:
  - run: curl -f http://service:8080/health
    repeat_policy:
      repeat: until        # Repeat UNTIL service is healthy
      exit_code: [0]        # Exit code 0 means success
      interval_sec: 10      # Wait 10 seconds between attempts
      limit: 30            # Maximum 5 minutes
```

```mermaid
flowchart TD
  H[Health check] --> D{exit code == 0?}
  D --> |No| W[Wait 10s] --> H
  D --> |Yes| Next[Proceed]
  style H stroke:lightblue,stroke-width:1.6px,color:#333
  style W stroke:lightblue,stroke-width:1.6px,color:#333
  style Next stroke:green,stroke-width:1.6px,color:#333
```

<a href="/writing-workflows/control-flow#repeat" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Repeat Until Output Match

```yaml
 steps: 
  - run: echo "COMPLETED"  # Simulates job status check
    env:
      - JOB_STATUS: COMPLETED
    repeat_policy:
      repeat: until        # Repeat UNTIL job completes
      condition: "${env.JOB_STATUS}"
      expected: "COMPLETED"
      interval_sec: 30
      limit: 120           # Maximum 1 hour (120 attempts)
```

```mermaid
flowchart TD
  S[Emit JOB_STATUS] --> C{JOB_STATUS == COMPLETED?}
  C --> |No| W[Wait 30s] --> S
  C --> |Yes| Next[Proceed]
  style S stroke:lightblue,stroke-width:1.6px,color:#333
  style W stroke:lightblue,stroke-width:1.6px,color:#333
  style Next stroke:green,stroke-width:1.6px,color:#333
```

<a href="/writing-workflows/control-flow#repeat" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Repeat Steps

```yaml
steps:
  - run: echo "heartbeat"  # Sends heartbeat signal
    repeat_policy:
      repeat: while            # Repeat indefinitely while successful
      interval_sec: 60
```

<a href="/writing-workflows/control-flow#repeat-basic" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Repeat Steps Until Success

```yaml
steps:
  - run: echo "Checking status"
    repeat_policy:
      repeat: until        # Repeat until exit code 0
      exit_code: [0]
      interval_sec: 30
      limit: 20            # Maximum 10 minutes
```

<a href="/writing-workflows/control-flow#repeat-basic" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### DAG-Level Preconditions

```yaml
preconditions:
  - condition: "`date +%u`"
    expected: "re:[1-5]"  # Weekdays only

steps:
  - run: echo "Run on business days"
```

```mermaid
flowchart TD
  A[Start] --> B{Weekday?}
  B --> |Yes| C[Run on business days]
  B --> |No| D[Skip]
  C --> E[End]
  D --> E
  style A stroke:lightblue,stroke-width:1.6px,color:#333
  style B stroke:lightblue,stroke-width:1.6px,color:#333
  style C stroke:green,stroke-width:1.6px,color:#333
  style D stroke:gray,stroke-width:1.6px,color:#333
  style E stroke:lightblue,stroke-width:1.6px,color:#333
```

<a href="/writing-workflows/control-flow#dag-level-conditions" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Negated Preconditions

```yaml
steps:
  # Run only when NOT in production
  - run: echo "Running dev task"
    preconditions:
      - condition: "${env.ENVIRONMENT}"
        expected: "production"
        negate: true

  # Run only on weekends
  - run: echo "Weekend maintenance"
    preconditions:
      - condition: "`date +%u`"
        expected: "re:[1-5]"  # Weekdays
        negate: true          # Invert: run on weekends
```

```mermaid
flowchart TD
  A[Start] --> B{Production?}
  B --> |Yes| C[Skip]
  B --> |No| D[Run dev task]
  C --> E[End]
  D --> E
  style A stroke:lightblue,stroke-width:1.6px,color:#333
  style B stroke:lightblue,stroke-width:1.6px,color:#333
  style C stroke:gray,stroke-width:1.6px,color:#333
  style D stroke:green,stroke-width:1.6px,color:#333
  style E stroke:lightblue,stroke-width:1.6px,color:#333
```

<a href="/writing-workflows/control-flow#negated-conditions" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Routing Based on Value

```yaml
type: graph
env:
  - STATUS: production
steps:
  - id: router
    action: router.route
    with:
      value: ${env.STATUS}
      routes:
        "production": [prod_handler]
        "staging": [staging_handler]

  - id: prod_handler
    run: echo "Production"

  - id: staging_handler
    run: echo "Staging"
```

```mermaid
flowchart TD
    A[Start] --> R{router: STATUS?}
    R --> |production| P[prod_handler]
    R --> |staging| S[staging_handler]
    P --> E[End]
    S --> E
    style A stroke:lightblue,stroke-width:1.6px,color:#333
    style R stroke:lightblue,stroke-width:1.6px,color:#333
    style P stroke:green,stroke-width:1.6px,color:#333
    style S stroke:gray,stroke-width:1.6px,color:#333
    style E stroke:lightblue,stroke-width:1.6px,color:#333
```

<a href="/step-types/router" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Routing Based on Step Output

```yaml
type: graph
steps:
  - id: check_status
    run: printf 'status=success\n' >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: status

  - id: router
    action: router.route
    with:
      value: ${steps.check_status.outputs.status}
      routes:
        "success": [success_handler]
        "failure": [failure_handler]
    depends: check_status

  - id: success_handler
    run: echo "Handling success"

  - id: failure_handler
    run: echo "Handling failure"
```

```mermaid
flowchart TD
    C[check_status] --> R{router: STATUS?}
    R --> |success| S[success_handler]
    R --> |failure| F[failure_handler]
    S --> E[End]
    F --> E
    style C stroke:lightblue,stroke-width:1.6px,color:#333
    style R stroke:lightblue,stroke-width:1.6px,color:#333
    style S stroke:green,stroke-width:1.6px,color:#333
    style F stroke:gray,stroke-width:1.6px,color:#333
    style E stroke:lightblue,stroke-width:1.6px,color:#333
```

<a href="/step-types/router#routing-based-on-step-output" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Continue On: Exit Codes and Output

```yaml
steps:
  - id: optional_check
    run: exit 3  # This will exit with code 3
    continue_on:
      exit_code: [0, 3]        # Treat 0 and 3 as non-fatal
      output:
        - "WARNING"
        - "re:^INFO:.*"       # Regex match
      mark_success: true       # Mark as success when matched
  - id: continue_after_check
    run: echo "Continue regardless"
    depends: optional_check
```

```mermaid
stateDiagram-v2
  [*] --> Step
  Step --> Next: exit_code in {0,3} or output matches
  Step --> Failed: otherwise
  Next --> [*]
  Failed --> Next: continue_on.mark_success
  
  classDef step stroke:lightblue,stroke-width:1.6px,color:#333
  classDef next stroke:green,stroke-width:1.6px,color:#333
  classDef fail stroke:red,stroke-width:1.6px,color:#333
  class Step step
  class Next next
  class Failed fail
```

<a href="/writing-workflows/continue-on" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Nested Workflows

```yaml
steps:
  - id: run_etl
    action: dag.run
    with:
      dag: etl.yaml
      params: "ENV=prod DATE=today"

  - id: run_analysis
    action: dag.run
    with:
      dag: analyze.yaml
    depends: run_etl
```

```mermaid
graph TD
    subgraph Main[Main Workflow]
        A{{data-pipeline}} --> B{{analyze}}
    end
    
    subgraph ETL[etl.yaml]
        C[extract] --> D[transform] --> E[load]
    end
    
    subgraph Analysis[analyze.yaml]
        F[aggregate] --> G[visualize]
    end
    
    A -.-> C
    B -.-> F
    
    style A stroke:lightblue,stroke-width:1.6px,color:#333
    style B stroke:lightblue,stroke-width:1.6px,color:#333
    style C stroke:lightblue,stroke-width:1.6px,color:#333
    style D stroke:lightblue,stroke-width:1.6px,color:#333
    style E stroke:lightblue,stroke-width:1.6px,color:#333
    style F stroke:lightblue,stroke-width:1.6px,color:#333
    style G stroke:lightblue,stroke-width:1.6px,color:#333
```

<a href="/writing-workflows/control-flow#nested-workflows" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Multiple DAGs in One File

```yaml
steps:
  - action: dag.run
    with:
      dag: data-processor
      params: "TYPE=daily"
---

name: data-processor
params:
  - name: type
    default: batch
steps:
  - id: extract
    run: echo "Extracting ${params.type} data"

  - id: transform
    run: echo "Transforming data"
    depends: extract
```

```mermaid
graph TD
  M[Main] --> DP{{"dag.run: data-processor"}}
  subgraph data-processor
    E["Extract TYPE data"] --> T[Transform]
  end
  DP -.-> E
  style M stroke:lightblue,stroke-width:1.6px,color:#333
  style DP stroke:lightblue,stroke-width:1.6px,color:#333
  style E stroke:lime,stroke-width:1.6px,color:#333
  style T stroke:lime,stroke-width:1.6px,color:#333
```

<a href="/writing-workflows/control-flow#multiple-dags-in-one-file" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Dispatch to Specific Workers

```yaml
tools:
  - astral-sh/uv@0.11.14

steps:
  - id: prepare_dataset
    run: uv run --python 3.13.9 python prepare_dataset.py

  - id: train_model
    action: dag.run
    with:
      dag: train-model
    depends: prepare_dataset

  - id: evaluate_model
    action: dag.run
    with:
      dag: evaluate-model
    depends: train_model
---
name: train-model
worker_selector:
  gpu: "true"
  cuda: "11.8"
  memory: "64G"
tools:
  - astral-sh/uv@0.11.14

steps:
  - run: uv run --python 3.13.9 python train.py --gpu
---
name: evaluate-model
worker_selector:
  gpu: "true"
tools:
  - astral-sh/uv@0.11.14

steps:
  - run: uv run --python 3.13.9 python evaluate.py
```

```mermaid
flowchart LR
  P[prepare_dataset.py] --> TR["dag.run: train-model"]
  TR --> |worker_selector gpu=true,cuda=11.8,memory=64G| GW[(GPU Worker)]
  GW --> TE[python train.py --gpu]
  TE --> EV["dag.run: evaluate-model"]
  EV --> |gpu=true| GW2[(GPU Worker)]
  GW2 --> EE[python evaluate.py]
  style P,TR,EV stroke:lightblue,stroke-width:1.6px,color:#333
  style GW,GW2 stroke:orange,stroke-width:1.6px,color:#333
  style TE,EE stroke:green,stroke-width:1.6px,color:#333
```

<a href="/server-admin/distributed/" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Mixed Local and Worker Steps

```yaml
steps:
  # Runs on any available worker (local or remote)
  - id: download_dataset
    run: wget https://data.example.com/dataset.tar.gz

  # Must run on specific worker type
  - id: process_on_gpu
    action: dag.run
    with:
      dag: process-on-gpu
    depends: download_dataset

  # Runs locally (no selector)
  - id: finish
    run: echo "Processing complete"
    depends: process_on_gpu

---
name: process-on-gpu
worker_selector:
  gpu: "true"
  gpu-model: "nvidia-a100"
tools:
  - astral-sh/uv@0.11.14

steps:
  - run: uv run --python 3.13.9 python gpu_process.py
```

<a href="/server-admin/distributed/#task-routing" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Force Local Execution

```yaml
# When default_execution_mode is "distributed", use worker_selector: local
# to keep specific DAGs on the main instance
worker_selector: local

steps:
  - id: health_check
    run: curl -f http://localhost:8080/health

  - id: finish
    run: echo "Ran locally"
    depends: health_check
```

Use `worker_selector: local` as an escape hatch in distributed deployments for lightweight DAGs that should never leave the main instance.

<a href="/server-admin/distributed/#force-local-execution" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Parallel Distributed Tasks

```yaml
tools:
  - astral-sh/uv@0.11.14

steps:
  - id: split_data
    run: |
      chunks="$(uv run --python 3.13.9 python split_data.py --chunks=10)"
      printf 'chunks=%s\n' "$chunks" >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: chunks

  - action: dag.run
    with:
      dag: chunk-processor
      params: "chunk=${env.ITEM}"
    parallel:
      items: ${steps.split_data.outputs.chunks}
      max_concurrent: 5
    depends: split_data

  - run: uv run --python 3.13.9 python merge_results.py
---
name: chunk-processor
worker_selector:
  memory: "16G"
  cpu-cores: "8"
params:
  - name: chunk
    default: ""
tools:
  - astral-sh/uv@0.11.14

steps:
  - run: uv run --python 3.13.9 python process_chunk.py "${params.chunk}"
```

```mermaid
graph TD
  S[split_data -> CHUNKS] --> P{{"parallel dag.run: chunk-processor"}}
  P --> C1[process CHUNK 1]
  P --> C2[process CHUNK 2]
  P --> Cn[process CHUNK N]
  C1 --> M[merge_results]
  C2 --> M
  Cn --> M
  style S,P,M stroke:lightblue,stroke-width:1.6px,color:#333
  style C1,C2,Cn stroke:lime,stroke-width:1.6px,color:#333
```

<a href="/writing-workflows/execution-control#parallel" class="learn-more">Learn more →</a>

</div>

</div>

## Error Handling & Reliability

<div class="examples-grid">

<div class="example-card">

### Continue on Failure

```yaml
steps:
  # Optional task that may fail
  - id: optional_task
    run: exit 1  # This will fail
    continue_on:
      failure: true
  # This step always runs
  - id: required_task
    run: echo "This must succeed"
    depends: optional_task
```

<a href="/writing-workflows/error-handling#continue" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Continue on Skipped

```yaml
steps:
  # Optional step that may be skipped
  - id: optional_feature
    run: echo "Enabling feature"
    preconditions:
      - condition: "${env.FEATURE_FLAG}"
        expected: "enabled"
    continue_on:
      skipped: true
  # This step always runs
  - id: main_task
    run: echo "Processing main task"
    depends: optional_feature
```

<a href="/writing-workflows/control-flow#continue-on-skipped" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Retry on Failure

```yaml
steps:
  - run: curl https://api.example.com
    retry_policy:
      limit: 3
      interval_sec: 30
```

<a href="/writing-workflows/error-handling#retry" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Smart Retry Policies

```yaml
steps:
  - run: curl -f https://api.example.com/data
    retry_policy:
      limit: 5
      interval_sec: 30
      exit_code: [429, 503, 504]  # Rate limit, service unavailable
```

<a href="/writing-workflows/error-handling#retry" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Retry with Exponential Backoff

```yaml
steps:
  - run: curl https://api.example.com/data
    retry_policy:
      limit: 5
      interval_sec: 2
      backoff: true        # 2x multiplier
      max_interval_sec: 60   # Cap at 60s
      # Intervals: 2s, 4s, 8s, 16s, 32s → 60s
```

<a href="/writing-workflows/error-handling#exponential-backoff" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Repeat with Backoff

> Looking for iteration over a list? See [Parallel Execution](#parallel-execution-iterator).

```yaml
steps:
  - run: nc -z localhost 8080
    repeat_policy:
      repeat: while
      exit_code: [1]        # While connection fails
      interval_sec: 1
      backoff: 2.0
      max_interval_sec: 30
      limit: 20
      # Check intervals: 1s, 2s, 4s, 8s, 16s, 30s...
```

<a href="/writing-workflows/control-flow#exponential-backoff-for-repeats" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Lifecycle Handlers

```yaml
steps:
  - run: echo "Processing main task"
handler_on:
  success:
    run: echo "SUCCESS - Workflow completed"
  failure:
    run: echo "FAILURE - Cleaning up failed workflow"
  exit:
    run: echo "EXIT - Always cleanup"
```

```mermaid
stateDiagram-v2
    [*] --> Running
    Running --> Success: Success
    Running --> Failed: Failure
    Success --> NotifySuccess: handler_on.success
    Failed --> CleanupFail: handler_on.failure
    NotifySuccess --> AlwaysCleanup: handler_on.exit
    CleanupFail --> AlwaysCleanup: handler_on.exit
    AlwaysCleanup --> [*]
    
    classDef running stroke:lime,stroke-width:1.6px,color:#333
    classDef success stroke:green,stroke-width:1.6px,color:#333
    classDef failed stroke:red,stroke-width:1.6px,color:#333
    classDef handler stroke:lightblue,stroke-width:1.6px,color:#333
    
    class Running running
    class Success success
    class Failed failed
    class NotifySuccess,CleanupFail,AlwaysCleanup handler
```

<a href="/writing-workflows/lifecycle-handlers" class="learn-more">Learn more →</a>

</div>

</div>

## Data & Variables

<div class="examples-grid">

<div class="example-card">

### Environment Variables

```yaml
env:
  - SOME_DIR: ${HOME}/batch
  - SOME_FILE: ${env.SOME_DIR}/some_file
  - LOG_LEVEL: debug
  - API_KEY: ${SECRET_API_KEY}
tools:
  - astral-sh/uv@0.11.14

steps:
  - working_dir: ${env.SOME_DIR}
    run: uv run --python 3.13.9 python main.py "${env.SOME_FILE}"
```

<a href="/writing-workflows/data-variables#env" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Dotenv Files

```yaml
# Specify single dotenv file
dotenv: .env

# Load multiple files (all files loaded, later override earlier)
dotenv:
  - .env.defaults
  - .env.local
  - .env.production

steps:
  - run: echo "Database: ${env.DATABASE_URL}"
```

<a href="/writing-workflows/data-variables#dotenv" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Secrets

```yaml
secrets:
  - name: DB_PASSWORD
    ref: prod/db-password
  - name: API_TOKEN
    provider: env
    key: PROD_API_TOKEN

steps:
  - run: ./sync.sh
    env:
      - AUTH_HEADER: "Bearer ${env.API_TOKEN}"
      - STRICT_MODE: "1"
```

<a href="/writing-workflows/secrets" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Positional Parameters

```yaml
params: param1 param2  # Default values for $1 and $2
tools:
  - astral-sh/uv@0.11.14

steps:
  - run: uv run --python 3.13.9 python main.py $1 $2
```

<a href="/writing-workflows/data-variables#params" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Named Parameters

```yaml
params:
  - name: foo
    type: integer
    default: 1
  - name: bar
    default: "2"
  - name: environment
    type: string
    default: dev
    enum: [dev, staging, prod]
tools:
  - astral-sh/uv@0.11.14

steps:
  - run: uv run --python 3.13.9 python main.py "${params.foo}" "${params.bar}" --env="${params.environment}"
```

<a href="/writing-workflows/data-variables#named-params" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Output Variables

```yaml
steps:
  - id: get_today
    run: printf 'today=%s\n' "$(date +%Y%m%d)" >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: today
  - id: print_today
    run: echo "Today's date is ${steps.get_today.outputs.today}"
    depends: get_today
```

<a href="/writing-workflows/data-variables#output" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Parallel Child Runs

```yaml
steps:
  - id: process_regions
    action: dag.run
    with:
      dag: worker
      params: "region=${env.ITEM}"
    parallel:
      items: [east, west, eu]
---
name: worker
params:
  - name: region
    default: ""
steps:
  - run: echo "${params.region}"
```

```mermaid
graph TD
  A[Run worker] --> B[east]
  A --> C[west]
  A --> D[eu]
  B --> E[Aggregate RESULTS]
  C --> E
  D --> E
  style A stroke:lightblue,stroke-width:1.6px,color:#333
  style B stroke:lime,stroke-width:1.6px,color:#333
  style C stroke:lime,stroke-width:1.6px,color:#333
  style D stroke:lime,stroke-width:1.6px,color:#333
  style E stroke:green,stroke-width:1.6px,color:#333
```

<a href="/writing-workflows/execution-control#parallel" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Special Variables

```yaml
steps:
  - run: |
      echo "DAG: ${env.DAG_NAME}"
      echo "Run: ${env.DAG_RUN_ID}"
      echo "Step: ${env.DAG_RUN_STEP_NAME}"
      echo "Log: ${env.DAG_RUN_LOG_FILE}"
```

<a href="/writing-workflows/template-variables#special-environment-variables" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Output Size Limits

```yaml
# Set maximum output size to 5MB for all steps
max_output_size: 5242880  # 5MB in bytes

steps:
  - run: "cat large-file.txt"
    output: CONTENT  # Will fail if file exceeds 5MB
```

Control output size limits to prevent memory issues.

<a href="/writing-workflows/data-variables#output-limits" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Stream Output to Artifacts

```yaml
steps:
  - run: "echo hello"
    stdout:
      artifact: hello.txt
  
  - run: "echo error message >&2"
    stderr:
      artifact: error.txt
```

<a href="/writing-workflows/artifacts#stream-output-to-artifacts" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### JSON Path References

```yaml
steps:
  - id: produce_result
    run: |
      printf 'final_value=%s\n' "ok" >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: final_value

  - id: print_result
    run: echo "Result: ${steps.produce_result.outputs.final_value}"
    depends: produce_result
```

<a href="/writing-workflows/data-variables#json-paths" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Structured Step Output

```yaml
steps:
  - id: build
    run: |
      printf 'version=%s\n' "v1.2.3" >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: version

  - id: publish
    run: |
      printf 'version_label=%s\n' "ver - ${steps.build.outputs.version}" >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: version_label
    depends: build

  - id: print
    run: echo "${steps.publish.outputs.version_label}"
    depends: publish
```

<a href="/writing-workflows/outputs#object-form" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Step ID References

```yaml
type: graph
tools:
  - astral-sh/uv@0.11.14

steps:
  - id: extract
    run: |
      printf 'data_path=%s\n' "$(uv run --python 3.13.9 python extract.py)" >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: data_path
  - run: |
      echo "Extracted data path: ${steps.extract.outputs.data_path}"
    depends: extract
```

<a href="/writing-workflows/data-variables#step-references" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Command Substitution

```yaml
env:
  TODAY: "`date '+%Y%m%d'`"
steps:
  - run: echo hello, today is ${env.TODAY}
```

<a href="/writing-workflows/data-variables#command-substitution" class="learn-more">Learn more →</a>

</div>

</div>

## Scripts & Code

<div class="examples-grid">

<div class="example-card">

### Shell Scripts

```yaml
steps:
  - run: |
      #!/bin/bash
      cd /tmp
      echo "hello world" > hello
      cat hello
      ls -la
```

Run shell script with default shell.

<a href="/writing-workflows/basics#scripts" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Shebang Script

```yaml
tools:
  - astral-sh/uv@0.11.14

steps:
  - run: |
      #!/usr/bin/env -S uv run --python 3.13.9 python
      import platform
      print(platform.python_version())
```

Runs with the interpreter declared in the shebang.

<a href="/writing-workflows/basics#scripts" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Python Scripts

```yaml
tools:
  - astral-sh/uv@0.11.14

steps:
  - run: |
      import os
      import datetime
      
      print(f"Current directory: {os.getcwd()}")
      print(f"Current time: {datetime.datetime.now()}")
    with:
      shell: uv run --python 3.13.9 python
```

Execute script with specific interpreter.

<a href="/writing-workflows/basics#scripts" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Multi-Step Scripts

```yaml
steps:
  - run: |
      #!/bin/bash
      set -e
      
      echo "Starting process..."
      echo "Preparing environment"
      
      echo "Running main task..."
      echo "Running main process"
      
      echo "Cleaning up..."
      echo "Cleaning up"
```

<a href="/writing-workflows/basics#scripts" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Working Directory

```yaml
working_dir: /tmp
steps:
  - id: show_default_dir
    run: pwd               # Outputs: /tmp
  - id: create_data_dir
    run: mkdir -p data
    depends: show_default_dir

  - id: show_data_dir
    working_dir: /tmp/data
    run: pwd      # Outputs: /tmp/data
    depends: create_data_dir
```

<a href="/writing-workflows/basics#working-directory" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Shell Selection

```yaml
shell: /bin/bash             # Default shell for all steps
shell_args: ["-e"]           # Default shell args for all steps
steps:
  - run: echo hello world | xargs echo
  - run: echo "from zsh"     # Override for a single step
    with:
      shell: /bin/zsh
```

<a href="/writing-workflows/basics#shell" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Reproducible Env with Nix Shell

> **Note:** Requires nix-shell to be installed separately. Not included in Dagu binary or container.

```yaml
steps:
  - run: |
      python3 --version
      curl --version
      jq --version
    with:
      shell: nix-shell
      shell_packages: [python3, curl, jq]
```

<a href="/step-types/shell#nix-shell" class="learn-more">Learn more →</a>

</div>

</div>

## Actions & Integrations

<div class="examples-grid">

<div class="example-card">

### Custom Action

```yaml
actions:
  say:
    description: Print a reusable message
    input_schema:
      type: object
      additionalProperties: false
      required: [message]
      properties:
        message:
          type: string
    template:
      action: exec
      with:
        command: echo
        args:
          - {$input: message}

steps:
  - action: say
    with:
      message: "build finished"
```

`with` is validated by `input_schema`; the rendered template runs as a builtin `exec` action.

Add `outputs` when a step should publish validated values for downstream steps. Downstream references then use `steps.<id>.outputs.<name>`.

<a href="/dagu-actions/custom" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Container Workflow

```yaml
# DAG-level container for all steps
container:
  image: python:3.11
  env:
    - PYTHONPATH=/app
  volumes:
    - ./src:/app

steps:
  - id: install
    run: pip install -r requirements.txt
  - id: test
    run: pytest tests/
    depends: install

  - id: build
    run: python setup.py build
    depends: test
```

<a href="/writing-workflows/yaml-specification#container-configuration" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Keep Container Running

```yaml
# Use keep_container at DAG level
container:
  image: postgres:16
  keep_container: true
  env:
    - POSTGRES_PASSWORD=secret
  ports:
    - "5432:5432"

steps:
  - id: start_postgres
    run: postgres -D /var/lib/postgresql/data
  - id: wait_for_postgres
    run: pg_isready -U postgres -h localhost
    retry_policy:
      limit: 10
      interval_sec: 2
    depends: start_postgres
```

<a href="/writing-workflows/yaml-specification#container-configuration" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Step-Level Container

```yaml
steps:
  - id: build
    container:
      image: node:18
      volumes:
        - ./src:/app
      working_dir: /app
    run: npm run build
```

<a href="/step-types/docker" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Kubernetes Job

```yaml
kubernetes:
  namespace: batch
  service_account: dagu-runner

steps:
  - id: report
    action: k8s.run
    with:
      image: alpine:3.20
      command: [sh, -c, 'echo hello from kubernetes']
```

<a href="/step-types/kubernetes" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Exec Into Existing Container

```yaml
# Run commands in an already-running container
container: my-app-container

steps:
  - id: migrate
    run: php artisan migrate
  - id: clear_cache
    run: php artisan cache:clear
    depends: migrate
```

<a href="/writing-workflows/container#exec-mode-use-existing-container" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Exec Mode with Overrides

```yaml
# Override user and working directory
container:
  exec: my-app-container
  user: root
  working_dir: /var/www
  env:
    - APP_DEBUG=true

steps:
  - id: install
    run: composer install
  - id: fix_permissions
    run: chown -R www-data:www-data storage
    depends: install
```

<a href="/writing-workflows/container#exec-mode-use-existing-container" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Mixed Exec and Image Mode

```yaml
steps:
  # Exec into app container
  - id: maintenance_mode
    container: my-app
    run: php artisan down

  # Run migration in fresh container
  - id: migrate
    container:
      image: my-app:latest
    run: php artisan migrate
    depends: maintenance_mode

  # Exec back into app container
  - id: restart
    container: my-app
    run: php artisan up
    depends: migrate
```

<a href="/step-types/docker#mixed-mode-example" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Remote Commands via SSH

```yaml
# Configure SSH once for all steps
ssh:
  user: deploy
  host: production.example.com
  key: ~/.ssh/deploy_key

steps:
  - id: health_check
    run: curl -f localhost:8080/health
  - id: restart_app
    run: systemctl restart myapp
    depends: health_check
```

<a href="/step-types/ssh" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Container Volumes: Relative Paths

```yaml
working_dir: /app/project
container:
  image: python:3.11
  volumes:
    - ./data:/data        # Resolves to /app/project/data:/data
    - .:/workspace        # Resolves to /app/project:/workspace
steps:
  - run: python process.py
```

<a href="/writing-workflows/yaml-specification#working-directory-and-volume-resolution" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### HTTP Requests

```yaml
steps:
  - action: http.request
    with:
      method: POST
      url: https://api.example.com/webhook
      headers:
        Content-Type: application/json
      body: '{"status": "started"}'
```

<a href="/step-types/http" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Wait for Readiness

```yaml
steps:
  - id: wait_for_api
    action: wait.http
    with:
      url: https://api.example.com/health
      status: 200
      poll_interval: 5s
    timeout_sec: 300

  - id: continue_after_ready
    run: ./run-after-ready.sh
    depends: wait_for_api
```

<a href="/step-types/wait" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### JSON Processing

```yaml
steps:
  # Fetch sample users from a public mock API
  - id: fetch_users
    run: |
      response="$(curl -fsS https://reqres.in/api/users)"
      {
        printf 'api_response<<JSON\n'
        printf '%s\n' "$response"
        printf 'JSON\n'
      } >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: api_response
        type: json

  # Extract user emails from the JSON response
  - id: extract_emails
    action: jq.filter
    with:
      filter: '.data[] | .email'
      data: ${steps.fetch_users.outputs.api_response}
    depends: fetch_users
```

<a href="/step-types/jq" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Archive Extraction

```yaml
working_dir: /tmp/data

steps:
  - action: archive.extract
    with:
      source: dataset.tar.zst
      destination: ./dataset
```

<a href="/step-types/archive" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Container Startup & Readiness

```yaml
container:
  image: alpine:latest
  startup: command           # keepalive | entrypoint | command
  command: ["sh", "-c", "my-daemon"]
  wait_for: healthy           # running | healthy
  log_pattern: "Ready"        # Optional regex to wait for
  restart_policy: unless-stopped

steps:
  - run: echo "Service is ready"
```

```mermaid
stateDiagram-v2
  [*] --> Starting
  Starting --> Running: container running
  Running --> Healthy: healthcheck ok
  Running --> Ready: log_pattern matched
  Healthy --> Ready: log_pattern matched
  Ready --> [*]
  
  classDef node stroke:lightblue,stroke-width:1.6px,color:#333
  class Starting,Running,Healthy,Ready node
```

<a href="/writing-workflows/container#startup-modes" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Private Registry Auth

```yaml
registry_auths:
  ghcr.io:
    username: ${env.GITHUB_USER}
    password: ${env.GITHUB_TOKEN}

container:
  image: ghcr.io/myorg/private-app:latest

steps:
  - run: ./app
```

<a href="/step-types/docker#registry-authentication" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Multi-Container Workflow

```yaml
steps:
  - id: build
    container:
      image: node:24
      volumes:
        - ./src:/app
      working_dir: /app
    run: npm run build

  - id: test
    container:
      image: node:24
      volumes:
        - ./src:/app
      working_dir: /app
    run: npm test
    depends: build

  - id: deploy
    container:
      image: python:3.11
      env:
        - AWS_DEFAULT_REGION=us-east-1
    run: python deploy.py
    depends: test
```

```mermaid
flowchart LR
  B[build: node:24] --> T[test: node:24]
  T --> D[deploy: python:3.11]
  style B stroke:lightblue,stroke-width:1.6px,color:#333
  style T stroke:lime,stroke-width:1.6px,color:#333
  style D stroke:green,stroke-width:1.6px,color:#333
```

<a href="/writing-workflows/container#step-level-container" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### SSH: Advanced Options

```yaml
ssh:
  user: deploy
  host: app.example.com
  port: 2222
  key: ~/.ssh/deploy_key
  strict_host_key: true
  known_host_file: ~/.ssh/known_hosts

steps:
  - run: systemctl status myapp
```

<a href="/writing-workflows/yaml-specification#ssh-configuration" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Mail

```yaml
smtp:
  host: smtp.gmail.com
  port: "587"
  username: "${env.SMTP_USER}"
  password: "${env.SMTP_PASS}"

steps:
  - action: mail.send
    with:
      to: team@example.com
      from: noreply@example.com
      subject: "Weekly Report"
      message: "Attached."
      attachments:
        - run: report.txt
```

```mermaid
flowchart LR
  G[Generate report] --> M[Mail: Weekly Report]
  style G stroke:lightblue,stroke-width:1.6px,color:#333
  style M stroke:green,stroke-width:1.6px,color:#333
```

<a href="/step-types/mail" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Chat / LLM Request

```yaml
steps:
  - action: chat.completion
    with:
      provider: openai
      model: gpt-4o
      messages:
        - role: user
          content: |
            What is 2+2?
    output: ANSWER
```

<a href="/features/chat/" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Chat with DAG-Level Config

```yaml
params:
  - name: topic
    default: Dagu workflows

llm:
  provider: openai
  model: gpt-4o
  system: |
    You are a helpful assistant.

steps:
  - action: chat.completion
    with:
      messages:
        - role: user
          content: |
            Explain ${params.topic} briefly.
```

Steps inherit LLM config from DAG level.

<a href="/features/chat/#dag-level-configuration" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Multi-turn Session

```yaml
steps:
  - id: ask
    action: chat.completion
    with:
      provider: openai
      model: gpt-4o
      messages:
        - role: user
          content: |
            What is 2+2?

  - id: follow_up
    action: chat.completion
    with:
      provider: openai
      model: gpt-4o
      messages:
        - role: user
          content: |
            Now multiply that by 3.
    depends: ask
```

Steps inherit session history from previous steps.

<a href="/features/chat/#multi-turn-session" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Extended Thinking Mode

```yaml
steps:
  - action: chat.completion
    with:
      provider: anthropic
      model: claude-sonnet-4-20250514
      thinking:
        enabled: true
        effort: high
      messages:
        - role: user
          content: |
            Analyze this complex problem...
```

Enable deeper reasoning for complex tasks.

<a href="/features/chat/basics#extended-thinking-mode" class="learn-more">Learn more →</a>

</div>

</div>

## Scheduling & Automation

<div class="examples-grid">

<div class="example-card">

### Basic Scheduling

```yaml
schedule: "5 4 * * *"  # Run at 04:05 daily
steps:
  - run: echo "Running scheduled job"
```

<a href="/writing-workflows/scheduling" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Skip Redundant Runs

```yaml
schedule: "0 */4 * * *"    # Every 4 hours
skip_if_successful: true     # Skip if already succeeded
steps:
  - id: extract
    run: echo "Extracting data"
  - id: transform
    run: echo "Transforming data"
    depends: extract

  - id: load
    run: echo "Loading data"
    depends: transform
```

<a href="/writing-workflows/scheduling#skip-redundant" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Queue Management

```yaml
queue: "batch"        # Assign to global queue for concurrency control
steps:
  - run: echo "Processing data"
```

<a href="/writing-workflows/queues" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Multiple Schedules

```yaml
schedule:
  - "0 9 * * MON-FRI"   # Weekdays 9 AM
  - "0 14 * * SAT,SUN"  # Weekends 2 PM
steps:
  - run: echo "Run on multiple times"
```

<a href="/writing-workflows/scheduling#multiple-schedules" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Timezone

```yaml
schedule: "CRON_TZ=America/New_York 0 9 * * *"
steps:
  - run: echo "9AM New York"
```

<a href="/writing-workflows/scheduling#timezone-support" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Start/Stop/Restart Windows

```yaml
schedule:
  start: "0 8 * * *"     # Start 8 AM
  restart: "0 12 * * *"  # Restart noon
  stop: "0 18 * * *"     # Stop 6 PM
restart_wait_sec: 60
steps:
  - run: echo "Long-running service"
```

<a href="/writing-workflows/scheduling#restart-schedule" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Global Queue Configuration

```yaml
# Global queue config in ~/.config/dagu/config.yaml
queues:
  enabled: true
  config:
    - name: "critical"
      max_concurrency: 5
    - name: "batch"
      max_concurrency: 1

# DAG file
queue: "critical"  # Assign to queue for concurrency control
steps:
  - run: echo "Processing critical task"
```

Configure queues globally and assign DAGs using the `queue` field.

<a href="/server-admin/queues" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Email Notifications

```yaml
mail_on:
  failure: true
  success: true
smtp:
  host: smtp.gmail.com
  port: "587"
  username: "${env.SMTP_USER}"
  password: "${env.SMTP_PASS}"
steps:
  - run: echo "Running critical job"
    mail_on_error: true
```

<a href="/writing-workflows/email-notifications" class="learn-more">Learn more →</a>

</div>

</div>

## Operations & Production

<div class="examples-grid">

<div class="example-card">

### History Retention

```yaml
hist_retention_days: 30    # Keep 30 days of history
schedule: "0 0 * * *"     # Daily at midnight
steps:
  - id: archive_old_data
    run: echo "Archiving old data"
  - id: cleanup_archive
    run: rm -rf /tmp/archive/*
    depends: archive_old_data
```

Control how long execution history is retained.

<a href="/writing-workflows/yaml-specification#data-fields" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Output Size Management

```yaml
max_output_size: 10485760   # 10MB max output per step
steps:
  - run: ./analyze-logs --format markdown
    stdout:
      artifact: reports/analysis.md
```

<a href="/writing-workflows/yaml-specification#data-fields" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Custom Log Directory

```yaml
log_dir: /data/etl/logs/daily-etl
hist_retention_days: 90
steps:
  - id: extract
    run: echo "Extracting data"
    stdout: extract.log
    stderr: extract.err
  - id: transform
    run: echo "Transforming data"
    stdout: transform.log
    depends: extract
```

Organize logs in custom directories with retention.

<a href="/writing-workflows/yaml-specification#data-fields" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Timeout & Cleanup

```yaml
timeout_sec: 7200          # 2 hour timeout
max_clean_up_time_sec: 600    # 10 min cleanup window
steps:
  - run: sleep 5 && echo "Processing data"
    signal_on_stop: SIGTERM
handler_on:
  exit:
    run: echo "Cleaning up resources"
```

<a href="/writing-workflows/yaml-specification#execution-control-fields" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Production Monitoring

```yaml
hist_retention_days: 365    # Keep 1 year for compliance
max_output_size: 5242880    # 5MB output limit
mail_on:
  failure: true
error_mail:
  from: alerts@company.com
  to: oncall@company.com
  prefix: "[CRITICAL]"
  attach_logs: true
info_mail:
  from: notifications@company.com
  to: team@company.com
  prefix: "[SUCCESS]"
handler_on:
  failure:
    run: |
      curl -X POST https://metrics.company.com/alerts \
        -H "Content-Type: application/json" \
        -d '{"service": "critical-service", "status": "failed"}'
steps:
  - run: echo "Checking health"
    retry_policy:
      limit: 3
      interval_sec: 30
```

<a href="/writing-workflows/yaml-specification" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Distributed Tracing

```yaml
otel:
  enabled: true
  endpoint: "otel-collector:4317"
  resource:
    service.name: "dagu-daily-etl"
    deployment.environment: "production"
tools:
  - astral-sh/uv@0.11.14

steps:
  - id: fetch
    run: echo "Fetching data"
  - id: process
    run: uv run --python 3.13.9 python process.py
    depends: fetch

  - id: transform
    action: dag.run
    with:
      dag: pipelines/transform
    depends: process
```

Enable OpenTelemetry tracing for observability.

<a href="/server-admin/opentelemetry" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Execution Control

```yaml
type: graph
max_active_steps: 5         # Max 5 parallel steps
queue: "compute-queue"    # Assign to queue for concurrency control
delay_sec: 10              # 10 second initial delay
skip_if_successful: true    # Skip if already succeeded
steps:
  - id: validate
    run: echo "Validating configuration"
  - id: process_batch_1
    run: echo "Processing batch 1"
    depends: validate

  - id: process_batch_2
    run: echo "Processing batch 2"
    depends: validate

  - id: process_batch_3
    run: echo "Processing batch 3"
    depends: validate
```

<a href="/writing-workflows/yaml-specification#execution-control-fields" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Queuing

```yaml
queue: compute-queue      # Assign to specific queue
steps:
  - id: prepare
    run: echo "Preparing data"
  - id: compute
    run: echo "Running intensive computation"
    depends: prepare

  - id: store
    run: echo "Storing results"
    depends: compute
```

<a href="/writing-workflows/queues" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Limit History Retention

```yaml
hist_retention_days: 60     # Keep 60 days history
steps:
  - run: echo "Running periodic maintenance"
```

<a href="/writing-workflows/yaml-specification#data-fields" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Lock Down Run Inputs

```yaml
run_config:
  disable_param_edit: true   # Prevent editing params at start
  disable_run_id_edit: true   # Prevent custom run IDs

params:
  - ENVIRONMENT: production
  - VERSION: 1.0.0
```

<a href="/writing-workflows/yaml-specification#runconfig" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Complete DAG Configuration

```yaml
description: Daily ETL pipeline for analytics
schedule: "0 2 * * *"
skip_if_successful: true
group: DataPipelines
labels: daily,critical
queue: etl-queue          # Assign to global queue for concurrency control
max_output_size: 5242880  # 5MB
hist_retention_days: 90   # Keep history for 90 days
env:
  - LOG_LEVEL: info
  - DATA_DIR: /data/analytics
  - DATE: "`date '+%Y-%m-%d'`"
params:
  - name: ENVIRONMENT
    type: string
    default: production
  - name: DRY_RUN
    type: boolean
    default: false
mail_on:
  failure: true
smtp:
  host: smtp.company.com
  port: "587"
handler_on:
  success:
    run: echo "ETL completed successfully"
  failure:
    run: echo "Cleaning up after failure"
  exit:
    run: echo "Final cleanup"
steps:
  - id: validate_environment
    run: echo "Validating environment: ${env.ENVIRONMENT}"
```

<a href="/writing-workflows/yaml-specification" class="learn-more">Learn more →</a>

</div>

</div>
