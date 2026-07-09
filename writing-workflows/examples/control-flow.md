# Control Flow Examples

Examples for conditions, repetition, routing, DAG composition, and worker placement.

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

> Looking for iteration over a list? See [Parallel Execution](/writing-workflows/examples/basic#parallel-execution-iterator).

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
  - eval: "$(date +%u)"
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
      - eval: "$(date +%u)"
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
      params: "type=daily"
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
      params: "chunk=${ITEM}"
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
