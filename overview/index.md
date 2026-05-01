---
title: What is Dagu?
---

<div class="overview-hero">
  <div class="overview-hero-copy">
    <h2>The workflow engine that doesn't turn into an SRE project.</h2>
    <p>
      Dagu turns scripts, cron jobs, containers, HTTP tasks, SQL jobs, SSH operations, sub-workflows, and AI-assisted steps into one visible workflow system without forcing a rewrite.
    </p>
    <p>
      Dagu runs as a single binary and keeps workflows, history, and logs locally by default. It does not require a database, message broker, or language-specific SDK. It adds scheduling, dependencies, retries, queues, logs, a Web UI, and optional distributed workers around existing operations automation.
    </p>
    <div class="overview-actions">
      <a href="/getting-started/quickstart" class="overview-button overview-button-primary">Start in minutes</a>
      <a href="/overview/deployment-models" class="overview-button overview-button-secondary">Deployment models</a>
      <a href="/writing-workflows/examples" class="overview-button overview-button-secondary">Browse examples</a>
    </div>
  </div>
  <div class="overview-command-card" aria-label="Example Dagu workflow">
    <div class="overview-command-header">
      <span>workflow.yaml</span>
    </div>
    <div class="overview-code-lines" aria-hidden="true">
      <span>params:</span>
      <span>&nbsp;&nbsp;- name: DATE</span>
      <span>&nbsp;&nbsp;&nbsp;&nbsp;type: string</span>
      <span>&nbsp;&nbsp;&nbsp;&nbsp;default: "2026-04-18"</span>
      <span>&nbsp;&nbsp;- name: BUCKET</span>
      <span>&nbsp;&nbsp;&nbsp;&nbsp;type: string</span>
      <span>&nbsp;&nbsp;&nbsp;&nbsp;default: "s3://reports"</span>
      <span></span>
      <span>steps:</span>
      <span>&nbsp;&nbsp;- id: extract</span>
      <span>&nbsp;&nbsp;&nbsp;&nbsp;command: python extract.py --date ${DATE}</span>
      <span></span>
      <span>&nbsp;&nbsp;- id: transform</span>
      <span>&nbsp;&nbsp;&nbsp;&nbsp;command: python transform.py --date ${DATE}</span>
      <span></span>
      <span>&nbsp;&nbsp;- id: load</span>
      <span>&nbsp;&nbsp;&nbsp;&nbsp;type: docker</span>
      <span>&nbsp;&nbsp;&nbsp;&nbsp;with:</span>
      <span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;image: acme/loader:v1</span>
      <span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;auto_remove: true</span>
      <span>&nbsp;&nbsp;&nbsp;&nbsp;command: python load.py --bucket ${BUCKET}</span>
    </div>
  </div>
</div>

<div class="overview-statement">
  <strong>Dagu makes existing ops automation easy to inspect, rerun, and manage.</strong>
  <span>Define the workflow in YAML, keep the underlying scripts and commands, inspect every step in the browser, and rerun or approve operational work without SSHing into servers or chasing crontabs.</span>
</div>

## Motivation

Many environments grow into hundreds of cron jobs and shell scripts on large servers. The jobs may be important, but their dependencies are hidden in crontabs, comments, filenames, and operator knowledge. When one job fails, it is hard to know which downstream jobs were affected, which script should be rerun, and where the relevant logs are.

Dagu was built for teams that already have important automation but lack a practical way to manage it in one place. Instead of forcing application code into a workflow SDK, Dagu wraps existing operational work with scheduling, visible dependencies, execution status, logs, retries, approvals, and Web UI controls.

## Core Terminology

Understanding Dagu is easier once the main terms are clear.

| Term | Meaning |
|------|---------|
| **DAG** | A workflow file written in [YAML](/writing-workflows/yaml-specification). Steps run according to dependencies, so the execution order is explicit. |
| **Step** | One unit of work. A step can run a [command](/step-types/shell), [container](/step-types/docker), [SSH command](/step-types/ssh), [HTTP request](/step-types/http), [SQL query](/step-types/sql/), [sub-workflow](/writing-workflows/control-flow), or [AI agent task](/features/agent/step). |
| **Step type** | The kind of work a step runs, such as [`command`](/step-types/shell), [`docker`](/step-types/docker), [`kubernetes`](/step-types/kubernetes), [`ssh`](/step-types/ssh), [`http`](/step-types/http), [`postgres`](/step-types/sql/postgresql), [`s3`](/step-types/s3), or [`agent`](/features/agent/step). You can also define custom step types with the [`step_types`](/writing-workflows/custom-step-types) field. |
| **Run** | One execution of a DAG. Runs keep [status](/web-ui/cockpit), [logs](/overview/web-ui#run-history-and-logs), [timing](/overview/web-ui#run-details), [outputs](/writing-workflows/outputs), and [artifacts](/writing-workflows/artifacts). |
| **Schedule** | [Cron-based automation](/writing-workflows/scheduling) for starting DAG runs, including timezone support. |
| **Queue** | [Concurrency control](/server-admin/queues) for workflows, useful when jobs must not overlap or when workers are shared. |
| **Worker** | A machine that executes tasks in [distributed mode](/server-admin/distributed/). Workers can be selected by [labels](/server-admin/distributed/worker-labels) such as region, GPU, or environment. |
| **Artifact** | A file produced by a run and stored with the [run history](/getting-started/cli#history) for [preview, download, or audit](/writing-workflows/artifacts). |

See [Core Concepts](/getting-started/concepts) for the deeper model.

## How a Workflow Runs

Dagu keeps the workflow definition separate from the code it executes. Your scripts, containers, or services stay the same. Dagu wraps them with orchestration.

```yaml
steps:
  - id: fetch_orders
    command: python scripts/fetch_orders.py

  - id: normalize
    command: python scripts/normalize.py

  - id: load_warehouse
    type: postgres
    with:
      dsn: "${WAREHOUSE_DSN}"
    command: "CALL load_daily_orders()"
```

<div class="overview-lifecycle" aria-label="Dagu workflow lifecycle">
  <span>Write YAML</span>
  <span>Validate</span>
  <span>Schedule or Run</span>
  <span>Monitor</span>
  <span>Retry or Approve</span>
  <span>Notify and Audit</span>
</div>

During a run, Dagu resolves dependencies, starts ready steps, captures stdout and stderr, tracks status, applies retry rules, stores artifacts, and updates the Web UI in real time.

## Why Teams Choose Dagu

The main reason teams choose Dagu is that it modernizes existing operations automation without turning orchestration itself into another platform project.

<div class="overview-card-grid overview-strengths-grid">
  <div class="overview-card">
    <h3><a href="/getting-started/installation/">Single binary</a></h3>
    <p>Install <a href="/getting-started/installation/">one executable</a>. The default <a href="/getting-started/quickstart">quickstart setup</a> runs without an external <a href="/overview/architecture">database or broker</a> and without splitting the <a href="/writing-workflows/scheduling">scheduler</a> or <a href="/overview/web-ui">Web UI</a> into separate required services.</p>
  </div>
  <div class="overview-card">
    <h3><a href="/overview/architecture">Local-first storage</a></h3>
    <p><a href="/getting-started/cli#history">Run history</a> and <a href="/overview/web-ui#run-history-and-logs">logs</a> stay local by default, which keeps <a href="/overview/deployment-models">self-hosting</a> simple and fits private-network deployment patterns.</p>
  </div>
  <div class="overview-card">
    <h3><a href="/writing-workflows/examples">Zero-invasive workflows</a></h3>
    <p>Wrap existing <a href="/step-types/shell">scripts and commands</a>, <a href="/step-types/sql/">SQL</a>, <a href="/step-types/docker">containers</a>, and other <a href="/writing-workflows/examples">operational tasks</a> instead of rewriting application code around a workflow SDK.</p>
  </div>
  <div class="overview-card">
    <h3><a href="/overview/web-ui">Observable by default</a></h3>
    <p>Every run has <a href="/web-ui/cockpit">status</a>, <a href="/overview/web-ui#run-history-and-logs">per-step logs</a>, <a href="/overview/web-ui#run-details">timing and history</a>, <a href="/writing-workflows/artifacts">artifacts</a>, <a href="/writing-workflows/approval">approvals</a>, and <a href="/overview/web-ui">UI controls</a> for debugging, recovery, and operator handoff.</p>
  </div>
  <div class="overview-card">
    <h3><a href="/server-admin/distributed/">Scales gradually</a></h3>
    <p>Start on <a href="/getting-started/quickstart">one machine</a>, then move heavy or specialized jobs to <a href="/server-admin/distributed/">distributed workers</a> with <a href="/server-admin/distributed/worker-labels">label-based routing</a>.</p>
  </div>
  <div class="overview-card">
    <h3><a href="/writing-workflows/yaml-specification">Plain YAML</a></h3>
      <p>Workflows live as <a href="/writing-workflows/yaml-specification">plain YAML</a>, can be reviewed in <a href="/server-admin/git-sync">Git</a>, generated with <a href="/writing-workflows/custom-step-types">reusable tooling</a>, edited by <a href="/getting-started/ai-agent">AI agents</a>, and checked with <a href="/getting-started/cli#validate">validation</a> before they run.</p>
  </div>
</div>

## Architecture at a Glance

Dagu can run in a small local setup or scale out when workloads grow. The operating model changes, but the workflow YAML does not need to be rewritten.

<div class="overview-mode-grid">
  <div class="overview-mode-card">
    <h3>Standalone</h3>
    <p><code>dagu start-all</code> runs the Web UI, scheduler, and workflow engine in one process.</p>
    <p>Best for one server, a team utility box, a private automation host, or getting started quickly.</p>
  </div>
  <div class="overview-mode-card">
    <h3>Headless</h3>
    <p>Run workflows from the CLI or API without relying on the Web UI.</p>
    <p>Best for CI-like automation, locked-down servers, or environments where Dagu is managed by another system.</p>
  </div>
  <div class="overview-mode-card">
    <h3>Coordinator and Workers</h3>
    <p>The scheduler queues work, the coordinator assigns tasks, and workers execute DAGs over gRPC.</p>
    <p>Best for many machines, GPU jobs, regional routing, mixed workloads, and high-throughput batch processing.</p>
  </div>
</div>

```mermaid
flowchart LR
    subgraph Interfaces["Interfaces"]
        CLI["CLI"]
        UI["Web UI"]
        API["REST API"]
    end

    subgraph Dagu["Dagu Engine<br/>single process in standalone mode"]
        Scheduler["Scheduler"]
        Queue["Queue"]
        Runs["Run state<br/>logs<br/>artifacts<br/>status"]
    end

    subgraph Distributed["Distributed Mode"]
        Coordinator["Coordinator"]
        WorkerA["Worker"]
        WorkerB["Worker"]
    end

    CLI --> Scheduler
    UI --> Scheduler
    API --> Scheduler

    Scheduler --> Runs
    Scheduler --> Queue
    Queue --> Coordinator
    Coordinator --> WorkerA
    Coordinator --> WorkerB
    WorkerA --> Runs
    WorkerB --> Runs

    classDef interface fill:#2a2420,stroke:#c4956a,color:#e8e2d8
    classDef engine fill:#1f1a16,stroke:#8b7355,color:#e8e2d8
    classDef distributed fill:#1f1a16,stroke:#7da87d,color:#e8e2d8
    class CLI,UI,API interface
    class Scheduler,Queue,Runs engine
    class Coordinator,WorkerA,WorkerB distributed
```

See [Architecture](/overview/architecture) for internals and storage, and [Deployment Models](/overview/deployment-models) for local, self-hosted, managed, and hybrid deployment options.

## How Dagu Is Different

<div class="comparison-table">
  <table>
    <thead>
      <tr>
        <th>Tool</th>
        <th>Best For</th>
        <th>Where Dagu Is Different</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Cron</td>
        <td>Simple scheduled commands</td>
        <td>Dagu makes dependencies visible and adds logs, history, retries, status, UI controls, notifications, and approval gates.</td>
      </tr>
      <tr>
        <td>Airflow</td>
        <td>Large data platforms</td>
        <td>Dagu has a smaller default footprint, does not require a DBMS server, and uses YAML instead of a Python platform model.</td>
      </tr>
      <tr>
        <td>GitHub Actions</td>
        <td>Repository CI/CD</td>
        <td>Dagu runs inside your own infrastructure and can manage servers, containers, edge devices, and internal operations.</td>
      </tr>
      <tr>
        <td>Temporal</td>
        <td>Durable application workflows</td>
        <td>Dagu is simpler for command, script, and container orchestration when you do not want to write workflow code.</td>
      </tr>
      <tr>
        <td>Rundeck</td>
        <td>Operations runbooks</td>
        <td>Dagu focuses on DAG-based YAML workflows, explicit dependencies, local-first execution, and simple file-backed operation.</td>
      </tr>
    </tbody>
  </table>
</div>

## Real-World Use Cases

Dagu is useful anywhere existing scripts, containers, operational tasks, or agent-driven jobs need scheduling, retries, visibility, and a safe way for a team to run them.

<div class="overview-card-grid">
  <div class="overview-card overview-usecase-card">
    <h3>Cron and Legacy Script Management</h3>
    <p><strong>Run:</strong> existing <a href="/step-types/shell">shell scripts</a>, Python scripts, <a href="/step-types/http">HTTP calls</a>, and <a href="/writing-workflows/scheduling">scheduled jobs</a> without rewriting them.</p>
    <p><strong>Why Dagu fits:</strong> <a href="/getting-started/concepts">dependencies</a>, <a href="/overview/web-ui#run-history-and-logs">logs</a>, <a href="/writing-workflows/durable-execution">retries</a>, and <a href="/getting-started/cli#history">run history</a> become visible in the <a href="/overview/web-ui">Web UI</a> instead of being hidden across crontabs and server log files.</p>
  </div>
  <div class="overview-card overview-usecase-card">
    <h3>ETL and Data Operations</h3>
    <p><strong>Run:</strong> <a href="/step-types/sql/postgresql">PostgreSQL</a> or <a href="/step-types/sql/sqlite">SQLite</a> queries, <a href="/step-types/s3">S3 transfers</a>, <a href="/step-types/jq"><code>jq</code> transforms</a>, validation steps, and <a href="/writing-workflows/control-flow">sub-workflows</a>.</p>
    <p><strong>Why Dagu fits:</strong> daily data workflows stay declarative, remain easy to inspect in the <a href="/overview/web-ui">Web UI</a>, and are straightforward to <a href="/writing-workflows/durable-execution">retry</a> when one step fails.</p>
  </div>
  <div class="overview-card overview-usecase-card">
    <h3>Media Conversion</h3>
    <p><strong>Run:</strong> shell-driven media tools like <code>ffmpeg</code>, thumbnail extraction, audio normalization, image processing, and other compute-heavy jobs.</p>
    <p><strong>Why Dagu fits:</strong> conversion work can run across <a href="/server-admin/distributed/">distributed workers</a> while <a href="/getting-started/cli#history">run history</a>, <a href="/overview/web-ui#run-history-and-logs">logs</a>, and <a href="/writing-workflows/artifacts">artifacts</a> stay visible in one place for monitoring, debugging, and <a href="/writing-workflows/durable-execution">retries</a>.</p>
  </div>
  <div class="overview-card overview-usecase-card">
    <h3>Infrastructure and Server Automation</h3>
    <p><strong>Run:</strong> <a href="/step-types/ssh">SSH backups</a>, cleanup jobs, deploy scripts, patch windows, precondition checks, and <a href="/writing-workflows/lifecycle-handlers">lifecycle hooks</a>.</p>
    <p><strong>Why Dagu fits:</strong> remote operations get <a href="/writing-workflows/scheduling">schedules</a>, <a href="/writing-workflows/durable-execution">retries</a>, <a href="/writing-workflows/email-notifications">notifications</a>, and <a href="/overview/web-ui#run-history-and-logs">per-step logs</a> without requiring operators to SSH into servers for every recovery.</p>
  </div>
  <div class="overview-card overview-usecase-card">
    <h3>Container and Kubernetes Workflows</h3>
    <p><strong>Run:</strong> <a href="/step-types/docker">Docker images</a>, <a href="/step-types/kubernetes">Kubernetes Jobs</a>, shell glue, and follow-up validation steps.</p>
    <p><strong>Why Dagu fits:</strong> teams can compose image-based tasks and route them to the right workers with <a href="/server-admin/distributed/worker-labels">worker labels</a> instead of building a custom control plane.</p>
  </div>
  <div class="overview-card overview-usecase-card">
    <h3>Customer Support Automation</h3>
    <p><strong>Run:</strong> diagnostics, account repair jobs, data checks, and <a href="/writing-workflows/approval">approval-gated support actions</a>.</p>
    <p><strong>Why Dagu fits:</strong> non-engineers can run reviewed workflows from the <a href="/overview/web-ui">Web UI</a> while engineers keep <a href="/overview/web-ui#run-history-and-logs">logs</a> and <a href="/writing-workflows/outputs">results</a> traceable.</p>
  </div>
  <div class="overview-card overview-usecase-card">
    <h3>IoT and Edge Workflows</h3>
    <p><strong>Run:</strong> sensor polling, local cleanup, offline sync, health checks, and device maintenance jobs.</p>
    <p><strong>Why Dagu fits:</strong> the <a href="/getting-started/installation/">single binary</a> works well on small devices while still providing visibility through the <a href="/overview/web-ui">Web UI</a>.</p>
  </div>
  <div class="overview-card overview-usecase-card">
    <h3>AI Agent Workflows</h3>
    <p><strong>Run:</strong> <a href="/features/agent/step">AI agent steps</a>, <a href="/step-types/harness">agent CLIs</a>, agent-authored <a href="/writing-workflows/yaml-specification">YAML workflows</a>, log analysis, repair steps, and <a href="/writing-workflows/approval">human-reviewed automation</a>.</p>
    <p><strong>Why Dagu fits:</strong> workflows stay in <a href="/writing-workflows/yaml-specification">plain YAML</a>, so agents can create and debug them while humans keep <a href="/overview/web-ui#run-history-and-logs">logs</a>, <a href="/writing-workflows/approval">approvals</a>, and <a href="/getting-started/cli#history">run history</a> in one place.</p>
  </div>
</div>

::: tip
If it can run from a <a href="/step-types/shell">shell command</a>, <a href="/step-types/docker">Docker image</a>, <a href="/step-types/kubernetes">Kubernetes Job</a>, <a href="/step-types/ssh">SSH session</a>, <a href="/step-types/http">HTTP call</a>, <a href="/step-types/sql/">SQL query</a>, or <a href="/step-types/harness">AI agent CLI</a>, Dagu can usually orchestrate it without changing the application code.
:::

## AI Agent Workflows and Workflow Operator

Dagu includes AI features, but they build on the same command-native workflow engine. The agent can read, create, update, and debug DAGs. Agent steps and external agent CLIs can also run inside workflows, with the same scheduling, logs, retries, approvals, and run history as any other step.

```yaml
steps:
  - id: analyze_logs
    type: agent
    messages:
      - role: user
        content: |
          Analyze /var/log/app/errors.log from the last hour.
          Summarize likely causes and suggest a safe recovery plan.
    output: ANALYSIS_RESULT
```

Workflow Operator connects Slack or Telegram to the built-in steward, so teams can ask for run status, debug failures, re-run workflows, and approve actions from chat.

- [Steward Overview](/features/agent/) explains interactive workflow generation and debugging.
- [Agent Step](/features/agent/step) explains how to run agent tasks inside DAGs.
- [Workflow Operator](/features/bots/) explains Slack and Telegram operation.

## Learn More

<div class="next-steps">
  <div class="step-card">
    <h3><a href="/getting-started/quickstart">Quick Start</a></h3>
    <p>Install Dagu, create your first workflow, and run it locally.</p>
  </div>
  <div class="step-card">
    <h3><a href="/getting-started/concepts">Core Concepts</a></h3>
    <p>Learn workflows, steps, dependencies, parameters, and execution behavior.</p>
  </div>
  <div class="step-card">
    <h3><a href="/step-types/shell">Step Types</a></h3>
    <p>Explore command, Docker, Kubernetes, SSH, HTTP, SQL, S3, and agent execution.</p>
  </div>
  <div class="step-card">
    <h3><a href="/overview/architecture">Architecture</a></h3>
    <p>Understand standalone mode, distributed workers, storage, queues, and service layout.</p>
  </div>
  <div class="step-card">
    <h3><a href="/writing-workflows/examples">Examples</a></h3>
    <p>Start from practical workflow patterns and adapt them to your environment.</p>
  </div>
  <div class="step-card">
    <h3><a href="/features/agent/">Steward</a></h3>
    <p>Use Dagu's built-in steward to create, update, and debug workflows.</p>
  </div>
</div>
