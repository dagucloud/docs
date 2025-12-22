# What is Dagu?

<div style="text-align: center; margin: 2rem 0;">
  <img src="/logo.webp" alt="Dagu mascot - a squirrel pilot" style="max-width: 280px; height: auto;" />
</div>

**Workflow engine built for developers who want powerful workflow orchestration without the operational overhead.**

Define workflows in simple YAML, execute them anywhere with a single binary, compose complex pipelines from reusable sub-workflows, and distribute tasks across workers. All without requiring databases, message brokers, or code changes to your existing scripts. Dagu is a lightweight alternative to Cron, Airflow, Rundeck, etc.

### How it Works
Dagu executes your workflows, which are defined as a series of steps in a YAML file. These steps form a Directed Acyclic Graph (DAG), ensuring a clear and predictable flow of execution.

For example, a simple sequential DAG:
```yaml
type: chain
steps:
  - command: echo "Hello, dagu!"
  - command: echo "This is a second step"
```

```mermaid
graph LR
    A["Hello, dagu!"] --> B["This is a second step"]
    style A stroke:green,stroke-width:1.6px,color:#333
    style B stroke:lime,stroke-width:1.6px,color:#333
```

With parallel steps:
```yaml
type: graph
steps:
  - id: step_1
    command: echo "Step 1"
  - id: step_2a
    command: echo "Step 2a - runs in parallel"
    depends: [step_1]
  - id: step_2b
    command: echo "Step 2b - runs in parallel"
    depends: [step_1]
  - id: step_3
    command: echo "Step 3 - waits for parallel steps"
    depends: [step_2a, step_2b]
```

```mermaid
graph TD
    A[step_1] --> B[step_2a]
    A --> C[step_2b]
    B --> D[step_3]
    C --> D
    style A stroke:green,stroke-width:1.6px,color:#333
    style B stroke:lime,stroke-width:1.6px,color:#333
    style C stroke:lime,stroke-width:1.6px,color:#333
    style D stroke:lightblue,stroke-width:1.6px,color:#333
```

## Demo

**CLI Demo**: Create a simple DAG workflow and execute it using the command line interface.

![Demo CLI](/demo-cli.webp)

**Web UI Demo**: Create and manage workflows using the web interface, including real-time monitoring and control.

[Docs on CLI](/overview/cli)

![Demo Web UI](/demo-web-ui.webp)

[Docs on Web UI](/overview/web-ui)

## Learn More

- [Quick Start Guide](/getting-started/quickstart) - Up and running in 2 minutes
- [Core Concepts](/getting-started/concepts) - Understand how Dagu works
- [Examples](/writing-workflows/examples) - Ready-to-use workflow patterns
