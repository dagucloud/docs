# Features

Dagu provides a comprehensive set of features for building and managing workflows.

## Interface
- [Command Line Interface](/overview/cli)
- [Web UI](/overview/web-ui)
- [REST API](/overview/api)

## Workflow Features
- [Learn by Examples](/writing-workflows/examples)
- [Data Flow](/features/data-flow)
- [Execution Control](/features/execution-control)
- [Scheduling with Cron Expressions](/features/scheduling)
- [Secrets Management](/writing-workflows/secrets)

### Step Types
- [Shell](/features/executors/shell)
- [Shell (macOS / Linux)](/features/executors/shell-unix)
- [Shell (Windows)](/features/executors/shell-windows)
- [Docker](/features/executors/docker)
- [SSH](/features/executors/ssh)
- [HTTP](/features/executors/http)
- [Archive](/features/executors/archive)
- [Mail](/features/executors/mail)
- [JQ](/features/executors/jq)
- [GitHub Actions](/features/executors/github-actions)
- [Human in the Loop (HITL)](/features/executors/hitl)
- [S3](/features/executors/s3)
- [Redis](/features/executors/redis)

### ETL & SQL
- [Overview](/features/etl/) - SQL queries and data operations
- [PostgreSQL](/features/etl/postgresql) - PostgreSQL database operations
- [SQLite](/features/etl/sqlite) - SQLite database operations

### Chat & AI Agents
- [Overview](/features/chat/) - LLM sessions and AI agents
- [Basic Chat](/features/chat/basics) - Simple LLM sessions
- [Tool Calling](/features/chat/tool-calling) - AI agents with DAG-based tools

### Agent
- [Overview](/features/agent/) - AI assistant (Tsumugi) in the Web UI
- [Tools Reference](/features/agent/tools) - Available tools and parameters

## Authentication & Authorization
- [Authentication Options](/configurations/authentication)
- [Web UI Configuration](/configurations/server)

## Monitoring & Observability
- [Prometheus Metrics](/features/prometheus-metrics)
- [OpenTelemetry Tracing](/features/opentelemetry)
- [Email Notifications](/features/email-notifications)
- [Remote Instance Management](/configurations/remote-nodes)

## Advanced Features
- [Git Sync](/features/git-sync) - Synchronize DAG and memory files with a Git repository
- [Distributed Execution](/features/distributed-execution)
- [Workers Overview](/features/workers/)
- [Worker Labels](/features/worker-labels)
- [Shared Filesystem Mode](/features/workers/shared-filesystem)
- [Shared Nothing Mode](/features/workers/shared-nothing)
- [Kubernetes (Helm) Deployment](/configurations/deployment/kubernetes)
- [Queue](/features/queues)
