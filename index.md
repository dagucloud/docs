---
layout: doc
---

<img src="/hero-logo.webp" alt="Dagu" style="display: block; margin: 0 auto; width: 100%">

<div class="tagline" style="text-align: center;">
  <h2>Local-first workflow engine.</h2>
  <p>Declarative, file-based, self-contained, and air-gapped ready. One binary that scales from laptop to distributed cluster.</p>
</div>

<div class="hero-section">
  <div class="hero-actions">
    <a href="/getting-started/quickstart" class="VPButton brand">Get Started</a>
    <a href="/writing-workflows/examples" class="VPButton alt">View Examples</a>
  </div>
</div>

<img src="/cockpit-demo.gif" alt="Cockpit demo" style="width: 100%; border-radius: 12px; margin: 8px 0 24px;" />

::: tip Try It Live
Explore without installing: [Live Demo](https://demo-instance.dagu.sh/)

Credentials: `demouser` / `demouser`
:::

## Why Dagu?

- **Single binary** - No database, message broker, or external services. [Architecture](/overview/architecture)
- **Declarative YAML** - Define workflows without code. [YAML Reference](/writing-workflows/yaml-specification)
- **Composable** - Nest sub-workflows with parameters. [Control Flow](/writing-workflows/control-flow)
- **Distributed** - Route tasks to workers via labels. [Distributed Execution](/server-admin/distributed/)
- **AI Agent** - Built-in LLM-powered assistant with tools, memory, and configurable personalities. [AI Agent](/features/agent/)
- **Slack & Telegram Bots** - Talk to the AI agent from Slack or Telegram. Debug issues, check logs, and recover from incidents through chat. [Bots](/features/bots/)
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
| [**Distributed Execution**](/server-admin/distributed/) | Label-based worker routing with automatic service discovery |
| [**Error Handling**](/writing-workflows/error-handling) | Exponential backoff retries, lifecycle hooks, continue-on-failure |
| [**Step Types**](/step-types/shell) | Shell, Docker, SSH, HTTP, JQ, Mail, and more |
| [**Observability**](/server-admin/opentelemetry) | Live logs, Gantt charts, [Prometheus metrics](/server-admin/prometheus-metrics), OpenTelemetry |
| [**AI Agent**](/features/agent/) | Built-in LLM assistant with tool calling, persistent memory, and souls |
| [**Slack & Telegram Bots**](/features/bots/) | Chat with the AI agent from Slack or Telegram to manage workflows |
| [**Security**](/server-admin/authentication/) | Built-in RBAC (Pro) with admin, manager, operator, and viewer roles |

## Examples

### CLI Orchestration

```yaml
schedule: "0 2 * * *"
type: graph

steps:
  - id: build
    command: make build

  - id: test
    command: make test
    depends: build
    retry_policy:
      limit: 3
      interval_sec: 10

  - id: deploy
    type: ssh
    config:
      host: prod-server
    command: ./deploy.sh
    depends: test

handler_on:
  success:
    command: notify.sh "Deployment succeeded"
  failure:
    command: alert.sh "Deployment failed"
```

### AI Agent Workflow

```yaml
type: graph
steps:
  - id: analyze
    type: agent
    messages:
      - role: user
        content: "Review error logs and suggest fixes"
    output: ANALYSIS
    approval:
      prompt: "Review AI analysis before applying"

  - id: apply
    command: ./apply-fix.sh "${ANALYSIS}"
    depends: [analyze]
```

See [Examples](/writing-workflows/examples) for more patterns.

## Use Cases

- **CLI Orchestration** - Chain shell scripts, Docker containers, and remote commands into reliable workflows
- **AI-Agent Workflows** - LLM-powered agents with tool calling, approval gates, and memory. Manage workflows from [Slack or Telegram](/features/bots/)
- **Deployment Automation** - Multi-environment rollouts with approval gates
- **Scheduled Operations** - Cron-based maintenance, backups, and reporting
- **Legacy Migration** - Wrap existing scripts without rewriting them

**Quick Links**: [Overview](/overview/) | [CLI](/overview/cli) | [Web UI](/overview/web-ui) | [API](/overview/api) | [Architecture](/overview/architecture)

## Learn More

<div class="next-steps">
  <div class="step-card">
    <h3><a href="/overview/">Overview</a></h3>
    <p>What is Dagu and how it works</p>
  </div>
  <div class="step-card">
    <h3><a href="/getting-started/quickstart">Getting Started</a></h3>
    <p>Installation and first workflow</p>
  </div>
  <div class="step-card">
    <h3><a href="/writing-workflows/">Writing Workflows</a></h3>
    <p>Complete workflow authoring guide</p>
  </div>
  <div class="step-card">
    <h3><a href="/writing-workflows/yaml-specification">YAML Reference</a></h3>
    <p>All configuration options</p>
  </div>
  <div class="step-card">
    <h3><a href="/features/agent/">AI Agent</a></h3>
    <p>Chat, tools, memory, and souls</p>
  </div>
  <div class="step-card">
    <h3><a href="/features/bots/">Slack & Telegram Bots</a></h3>
    <p>Manage workflows through chat</p>
  </div>
  <div class="step-card">
    <h3><a href="/step-types/shell">Step Types</a></h3>
    <p>Shell, Docker, SSH, HTTP, SQL, Redis, and more</p>
  </div>
  <div class="step-card">
    <h3><a href="/server-admin/">Configuration</a></h3>
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
