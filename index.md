---
layout: doc
---

<img src="/dagu-logo.webp" alt="Dagu" style="display: block; margin: 0 auto; max-width: 400px">

<div class="tagline" style="text-align: center;">
  <h2>Lightweight workflow engine with distributed execution</h2>
  <p>Define workflows in YAML. Execute with a single binary. No database or message broker required. Ideal for VMs, containers, and bare metal.</p>
</div>

<div class="hero-section">
  <div class="hero-actions">
    <a href="/getting-started/quickstart" class="VPButton brand">Get Started</a>
    <a href="/writing-workflows/examples" class="VPButton alt">View Examples</a>
  </div>
</div>

## Demo

**[CLI](/overview/cli)**: Execute workflows from the command line.

![CLI Demo](/demo-cli.webp)

**[Web UI](/overview/web-ui)**: Monitor, control, and debug workflows visually.

![Web UI Demo](/demo-web-ui.webp)

::: tip Try It Live
Explore without installing: [Live Demo](http://23.251.149.55:8525/)

Credentials: `demouser` / `demouser`
:::

## Why Dagu?

- **Single binary** - No database, message broker, or external services. [Architecture](/overview/architecture)
- **Declarative YAML** - Define workflows without code. [YAML Reference](/reference/yaml)
- **Composable** - Nest sub-workflows with parameters. [Control Flow](/writing-workflows/control-flow)
- **Distributed** - Route tasks to workers via labels. [Distributed Execution](/features/distributed-execution)
- **Production-ready** - Retries, hooks, metrics, RBAC. [Error Handling](/writing-workflows/error-handling)

## Quick Start

### Install

::: code-group

```bash [macOS/Linux]
curl -L https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.sh | bash
```

```powershell [Windows (PowerShell)]
irm https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.ps1 | iex
```

```cmd [Windows (CMD)]
curl -fsSL https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.cmd -o installer.cmd && .\installer.cmd && del installer.cmd
```

```bash [Docker]
docker run --rm -v ~/.dagu:/var/lib/dagu -p 8080:8080 ghcr.io/dagu-org/dagu:latest dagu start-all
```

```bash [Homebrew]
brew install dagu
```

```bash [npm]
npm install -g --ignore-scripts=false @dagu-org/dagu
```

:::

### Create a Workflow

```bash
cat > hello.yaml << 'EOF'
steps:
  - command: echo "Hello from Dagu!"
  - command: echo "Step 2"
EOF
```

### Run

```bash
dagu start hello.yaml
```

### Start Web UI

```bash
dagu start-all
```

Visit [http://localhost:8080](http://localhost:8080)

## Key Capabilities

| Capability | Description |
|------------|-------------|
| [**Nested Workflows**](/writing-workflows/control-flow#nested-workflows) | Reusable sub-DAGs with full execution lineage tracking |
| [**Distributed Execution**](/features/distributed-execution) | Label-based worker routing with automatic service discovery |
| [**Error Handling**](/writing-workflows/error-handling) | Exponential backoff retries, lifecycle hooks, continue-on-failure |
| [**Step Types**](/reference/executors) | Shell, Docker, SSH, HTTP, JQ, Mail, and more |
| [**Observability**](/features/opentelemetry) | Live logs, Gantt charts, [Prometheus metrics](/features/prometheus-metrics), OpenTelemetry |
| [**Security**](/configurations/authentication) | Built-in RBAC with admin, manager, operator, and viewer roles |

## Example

A data pipeline with scheduling, parallel execution, sub-workflows, and retry logic:

```yaml
schedule: "0 2 * * *"
type: graph

steps:
  - name: extract
    command: python extract.py --date=${DATE}
    output: RAW_DATA

  - name: transform
    call: transform-workflow
    params: "INPUT=${RAW_DATA}"
    depends: extract
    parallel:
      items: [customers, orders, products]

  - name: load
    command: python load.py
    depends: transform
    retry_policy:
      limit: 3
      interval_sec: 10

handler_on:
  success:
    command: notify.sh "Pipeline succeeded"
  failure:
    command: alert.sh "Pipeline failed"
```

See [Examples](/writing-workflows/examples) for more patterns.

## Use Cases

- **Data Pipelines** - ETL/ELT with complex dependencies and parallel processing
- **ML Workflows** - GPU/CPU worker routing for training and inference
- **Deployment Automation** - Multi-environment rollouts with approval gates
- **Legacy Migration** - Wrap existing scripts without rewriting them

**Quick Links**: [Overview](/overview/) | [CLI](/overview/cli) | [Web UI](/overview/web-ui) | [API](/overview/api) | [Architecture](/overview/architecture)

## Learn More

<div class="next-steps">
  <div class="step-card">
    <h3><a href="/overview/">Overview</a></h3>
    <p>What is Dagu and how it works</p>
  </div>
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
  <div class="step-card">
    <h3><a href="/features/">Features</a></h3>
    <p>Scheduling, queues, distributed execution</p>
  </div>
  <div class="step-card">
    <h3><a href="/configurations/">Configuration</a></h3>
    <p>Server, authentication, operations</p>
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
