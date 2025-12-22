---
layout: doc
---

<img src="/dagu-logo.webp" alt="dagu Logo" style="display: block; margin: 0 auto; max-width: 100%">

<div class="tagline" style="text-align: center;">
  <h2>Workflow engine built for developers who want powerful workflow orchestration without the operational overhead.</h2>
  <p>Define workflows in simple YAML, execute them anywhere with a single binary, compose complex pipelines from reusable sub-workflows, and distribute tasks across workers. Do all this without requiring databases, message brokers, or code changes to your existing scripts.</p>
</div>

<div class="hero-section">
  <div class="hero-actions">
    <a href="/getting-started/quickstart" class="VPButton brand">Get Started</a>
    <a href="/writing-workflows/examples/" class="VPButton alt">View Examples</a>
  </div>
</div>

## What is Dagu?

Dagu is a lightweight, single-binary workflow engine with a modern Web UI.
Define workflows in simple YAML, execute them anywhere with a single binary, compose complex pipelines from reusable sub-workflows, and distribute tasks across workers. All without requiring databases, message brokers, or code changes to your existing scripts.

## Demo

**CLI Demo**: Create a simple DAG workflow and execute it using the command line interface.

![Demo CLI](/demo-cli.webp)

**Web UI Demo**: Create and manage workflows using the web interface, including real-time monitoring and control.

[Docs on CLI](/overview/cli)

![Demo Web UI](/demo-web-ui.webp)

[Docs on Web UI](/overview/web-ui)

## Why Dagu?

### Single binary file installation
**Single binary. No database, no message broker.** Deploy anywhere in seconds, from your laptop to bare metal servers to Kubernetes. Everything is stored in plain files (XDG compliant), making it transparent, portable, and easy to backup. [Learn more](/getting-started/quickstart)

### Composable Nested Workflows
**Build complex pipelines from reusable building blocks.** Define sub-workflows that can be called with parameters, executed in parallel, and fully monitored in the UI. See execution traces for every nested level. No black boxes. [Learn more](/writing-workflows/basics#calling-sub-dags)

### Declarative YAML Language - Programming Not Required
**Use your existing scripts without modification.** No need to wrap everything in Python decorators or rewrite logic. Dagu orchestrates shell commands, Docker containers, SSH commands, or HTTP calls. Use whatever you already have. [Learn more](/writing-workflows/basics)

### Distributed Execution
**Built-in queue system with intelligent task routing.** Route tasks to workers based on labels (GPU, region, compliance requirements). Automatic service registry and health monitoring included. No external coordination service needed. [Learn more](/features/distributed-execution)

### Production Ready
**Everything you need out of the box.** Battle-tested error handling with exponential backoff retries, lifecycle hooks (onSuccess, onFailure, onExit), real-time log streaming, email notifications, Prometheus metrics, and OpenTelemetry tracing out of the box. Built-in user management with role-based access control (RBAC) for team environments. [Learn more](/configurations/operations)

### Modern Web UI with RBAC
**Beautiful UI that actually helps you debug.** Live log tailing, DAG visualization with Gantt charts, execution history with full lineage, and drill-down into nested sub-workflows. Dark mode included. [Learn more](/configurations/server)

## Quick Start

### 1. Install dagu

::: code-group

```bash [macOS/Linux]
# Install to ~/.local/bin (default, no sudo required)
curl -L https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.sh | bash

# Install specific version
curl -L https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.sh | bash -s -- --version v1.17.0

# Install to custom directory
curl -L https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.sh | bash -s -- --install-dir /usr/local/bin
```

```powershell [Windows]
# Install latest version to default location (%LOCALAPPDATA%\Programs\dagu)
irm https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.ps1 | iex

# Install specific version
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.ps1))) v1.24.0
```

```bash [Docker]
docker run --rm \
  -v ~/.dagu:/var/lib/dagu \
  -p 8080:8080 \
  ghcr.io/dagu-org/dagu:latest \
  dagu start-all
```

```bash [Homebrew]
brew update && brew install dagu
```

```bash [npm]
npm install -g --ignore-scripts=false @dagu-org/dagu
```

:::

### 2. Create your first workflow

> **Note**: When you first start Dagu with an empty DAGs directory, it automatically creates example workflows to help you get started. To skip this, set `DAGU_SKIP_EXAMPLES=true`.

```bash
cat > ./hello.yaml << 'EOF'
steps:
  - echo "Hello from Dagu!"
  - echo "Running step 2"
EOF
```

### 3. Run the workflow

```bash
dagu start hello.yaml
```

### 4. Start the Web UI

```bash
dagu start-all
```

Visit [http://localhost:8080](http://localhost:8080)

## Key Features

### [Composable Nested Workflows](/writing-workflows/basics#calling-sub-dags)

Break complex workflows into reusable, maintainable sub-workflows:

```yaml
description: |
  data-pipeline: Extract, transform, and load data daily with retries and parallelism.
schedule: "0 2 * * *"  # Daily at 2 AM
type: graph

steps:
  # Extract raw data
  - name: extract
    command: python extract.py --date=${DATE}
    output: RAW_DATA

  # Transform in parallel for each data type
  - name: transform
    call: transform-data
    parallel:
      items: [customers, orders, products, inventory]
    params: "TYPE=${ITEM} INPUT=${RAW_DATA}"
    depends: extract

  # Load to warehouse with retry
  - name: load
    command: python load.py --batch=${RAW_DATA}
    depends: transform
    retryPolicy:
      limit: 3
      intervalSec: 10
      backoff: true

---
# Reusable sub-workflow
name: transform-data
params: [TYPE, INPUT]

steps:
  - name: validate
    command: python validate.py --type=${TYPE} --input=${INPUT}
    
  - name: transform
    command: python transform.py --type=${TYPE} --input=${INPUT}
    output: TRANSFORMED
    
  - name: quality-check
    command: python quality_check.py --data=${TRANSFORMED}
```

**Every sub-workflow run is tracked and visible in the UI with full execution lineage.**

### [Distributed Execution with Worker Labels](/features/distributed-execution)

Route tasks to specialized workers without managing infrastructure:

```yaml
description: |
  ML pipeline that preprocesses data on CPU workers and trains models on GPU workers.
workerSelector:
  gpu: "true"
  cuda: "11.8"
  memory: "64G"

steps:
  - name: preprocess
    command: python preprocess.py
    workerSelector:
      cpu-only: "true"  # Override for CPU task
    
  - name: train
    command: python train.py --gpu
    # Uses parent workerSelector (GPU worker)
    
  - name: evaluate
    call: model-evaluation
    params: "MODEL_PATH=/models/latest"
```

Start workers with labels:
```bash
# GPU worker
dagu worker --worker.labels gpu=true,cuda=11.8,memory=64G

# CPU worker  
dagu worker --worker.labels cpu-only=true,region=us-east-1
```

**Automatic service registry, health monitoring, and task redistribution included.**

### [Advanced Error Handling](/writing-workflows/error-handling)

Production-grade retry policies and lifecycle hooks:

```yaml
steps:
  - name: api-call
    executor:
      type: http
      config:
        method: POST
        url: https://api.example.com/process
        timeout: 30s
    retryPolicy:
      limit: 5
      intervalSec: 2
      backoff: true  # Exponential backoff
    continueOn:
      failure: true  # Keep going even if this fails

handlerOn:
  success:
    command: slack-notify.sh "✅ Pipeline succeeded"
    
  failure:
    executor:
      type: mail
      config:
        to: oncall@company.com
        from: alerts@company.com
        subject: "🚨 ALERT: Pipeline Failure - ${DAG_NAME}"
        message: |
          Pipeline failed.
          Run ID: ${DAG_RUN_ID}
          Check logs: ${DAG_RUN_LOG_FILE}
      
  exit:
    command: cleanup-temp-files.sh  # Always runs
```

### [Builtin Executors](/reference/executors)

Execute task in different ways.

```yaml
steps:
  # Shell command
  - name: local-script
    command: ./deploy.sh
    
  # Docker container
  - name: data-processing
    executor:
      type: docker
      config:
        image: python:3.11
        autoRemove: true
    command: python process.py
    
  # Remote SSH
  - name: remote-deploy
    executor:
      type: ssh
      config:
        user: ubuntu
        host: prod-server.internal
    command: sudo systemctl restart app
    
  # HTTP API call
  - name: trigger-webhook
    executor:
      type: http
      config:
        method: POST
        url: https://hooks.slack.com/services/xxx
        
  # JSON processing
  - name: parse-config
    executor:
      type: jq
      config:
        query: '.environments[] | select(.name=="prod")'
    command: cat config.json
```

## Use Cases

### 🔄 Data Pipelines
Extract, transform, and load data with complex dependencies. Use nested workflows for reusable transformations and parallel processing.

### 🤖 ML Workflows
Train models on GPU workers, preprocess on CPU workers, and orchestrate the entire lifecycle with automatic retries and versioning.

### 🚀 Deployment Automation
Multi-environment deployments (dev → staging → prod) with approval gates, rollback support, and notification integrations.

### 📊 ETL/ELT
Replace brittle cron jobs with visible, maintainable workflows. Visualize data lineage and debug failures with live logs.

### 🔧 Legacy System Migration
Wrap existing shell scripts and Perl code in Dagu workflows without rewriting them. Add retry logic, monitoring, and scheduling incrementally.

### ☁️ Multi-Cloud Orchestration
Route tasks to workers in different cloud regions based on compliance requirements, data locality, or cost optimization.

## Learn More

<div class="next-steps">
  <div class="step-card">
    <h3><a href="/getting-started/">Getting Started</a></h3>
    <p>Installation and first workflow</p>
  </div>
  <div class="step-card">
    <h3><a href="/writing-workflows/">Writing Workflows</a></h3>
    <p>Complete workflow authoring guide</p>
  </div>
  <div class="step-card">
    <h3><a href="/reference/yaml">YAML Reference</a></h3>
    <p>All configuration options</p>
  </div>
</div>

## Community

<div class="community-links">
  <a href="https://github.com/dagu-org/dagu" class="community-link">
    <span class="icon">GitHub</span>
  </a>
  <a href="https://discord.gg/gpahPUjGRk" class="community-link">
    <span class="icon">Discord</span>
  </a>
  <a href="https://bsky.app/profile/dagu-org.bsky.social" class="community-link">
    <span class="icon">Bluesky</span>
  </a>
  <a href="https://github.com/dagu-org/dagu/issues" class="community-link">
    <span class="icon">Issues</span>
  </a>
</div>
