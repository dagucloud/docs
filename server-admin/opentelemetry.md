# OpenTelemetry Tracing

Dagu supports OpenTelemetry (OTel) distributed tracing for workflow execution. You can monitor performance, debug issues, and track the flow of DAGs in your observability platform.

## Overview

When OpenTelemetry is enabled, Dagu creates:
- A root span for each DAG execution
- Child spans for each step execution
- Proper trace context propagation for nested DAGs
- Trace context for the processes that steps start (`TRACEPARENT`, `TRACESTATE`)
- Key attributes for filtering and analysis

## Configuration

### Basic Configuration

```yaml
otel:
  enabled: true
  endpoint: "localhost:4317"  # OTLP gRPC endpoint
tools:
  - astral-sh/uv@0.11.14

steps:
  - run: uv run --python 3.13.9 python process.py
```

### Full Configuration

```yaml
dotenv:
  - .env
otel:
  enabled: true
  endpoint: "otel-collector:4317"  # OTLP gRPC endpoint
  # endpoint: "http://otel-collector:4318/v1/traces"  # OTLP HTTP endpoint
  headers:
    Authorization: "Bearer ${env.OTEL_AUTH_TOKEN}"
  insecure: false  # Send plaintext instead of TLS (default: false)
  timeout: 30s     # Export timeout
  resource:
    # Resource attributes (all optional)
    service.name: "dagu-${DAG_NAME}"
    service.version: "1.0.0"
    deployment.environment: "production"
    # Custom attributes
    team: "data-engineering"
    cost_center: "analytics"
```

### Configuration Options

| Field | Description | Default |
|-------|-------------|---------|
| `enabled` | Enable/disable OpenTelemetry tracing | `false` |
| `endpoint` | OTLP endpoint URL (gRPC or HTTP) | Required |
| `headers` | HTTP headers for authentication | `{}` |
| `insecure` | Allow insecure connections | `false` |
| `timeout` | Export timeout duration | No default |
| `resource` | Resource attributes map | `{}` |

OTel resource attribute strings use environment-style expansion when the
tracer is created. `${DAG_NAME}` is the current DAG name; other unqualified
names read the Dagu process environment. Scoped workflow references such as
`${context.dag.name}` and `${env.NAME}` are not supported inside `resource`.

## Endpoint Configuration

Dagu automatically detects the protocol based on the endpoint:

- **gRPC endpoints**: `host:port` format (e.g., `localhost:4317`)
- **HTTP endpoints**: Must end with `/v1/traces` (e.g., `http://localhost:4318/v1/traces`)

An HTTP endpoint is a URL or a bare `host:port/v1/traces`, such as `localhost:4318/v1/traces`. For a URL, the scheme decides the transport and overrides `insecure`: `http://` sends plaintext and `https://` uses TLS. A bare endpoint uses TLS unless `insecure: true`. Any other scheme is an error; Dagu logs a warning and runs the DAG without tracing.

## Trace Structure

### Span Hierarchy

```
DAG: my-workflow (root span)
├── Step: fetch-data
├── Step: validate-data
├── Step: process-batch-1
├── Step: process-batch-2
└── Step: aggregate-results
```

### Span Attributes

#### DAG Root Span
- `dag.name`: Name of the DAG
- `dag.run_id`: Unique execution ID
- `dag.parent_run_id`: Parent DAG run ID (for nested DAGs)
- `dag.status`: Final execution status

#### Step Spans
- `step.name`: Name of the step
- `step.status`: Step execution status
- `step.exit_code`: Process exit code (when applicable)

## Nested DAGs

When a step executes another DAG, the trace context is automatically propagated:

```yaml
steps:
  - action: dag.run
    with:
      dag: workflows/child-workflow.yaml
      params: "PARAM1=value1"
```

The sub-DAG root span links to the parent step span, creating a complete trace across execution levels.

### Trace Context Propagation

Dagu uses the W3C Trace Context standard for propagating trace information between parent and sub-DAGs:

- **Automatic propagation**: Trace context passes to sub-DAGs automatically through environment variables
- **W3C format**: Uses standard `TRACEPARENT` and `TRACESTATE` environment variables
- **Cross-process tracing**: Supports distributed tracing across separate processes

Example trace hierarchy:
```
DAG: parent-workflow (trace_id: abc123)
└── Step: run-child-workflow
    └── DAG: child-workflow (same trace_id: abc123)
        ├── Step: child-step-1
        └── Step: child-step-2
```

### Step Processes

Each step process receives the trace context of its step span in the
`TRACEPARENT` and `TRACESTATE` environment variables (`TRACESTATE` only when
the span has a trace state). A program that uses an OpenTelemetry SDK can read
them to create child spans of the step span, and a script can forward the
value to the services it calls:

```yaml
otel:
  enabled: true
  endpoint: "otel-collector:4317"

steps:
  - id: trigger
    run: |
      curl -fsS -X POST \
        -H "traceparent: $TRACEPARENT" \
        http://report-service:8080/jobs
```

The spans of the called service then join the trace of the DAG run:

```
DAG: my-workflow
└── Step: trigger
    └── POST /jobs (report-service)
```

The variables are set only when OpenTelemetry is enabled for the DAG.
A `TRACEPARENT` or `TRACESTATE` that the step sets in its own `env`, or in
the `env` of its container, takes precedence, and Dagu then sets neither
variable; an inherited value of the other one becomes empty. Set
`TRACEPARENT` to an empty value in the step `env` to give the process no
trace context. A `TRACEPARENT` from the DAG-level `env` is replaced by the
step span, and an inherited `TRACESTATE` becomes empty when the step span has
none, because it belongs to another span. Lifecycle handlers do not receive
these variables.

## Using Base Configuration

You can set default OpenTelemetry configuration in your base DAG:

```yaml
# base.yaml
otel:
  enabled: true
  endpoint: "otel-collector:4317"
  resource:
    deployment.environment: "production"
```

The workflow can override individual attributes while inheriting the remaining base configuration:

```yaml
otel:
  resource:
    service.name: "dagu-${DAG_NAME}"  # Override specific attributes
steps:
  - run: echo "Processing with telemetry"
```

## Integration Examples

### Local Development with Jaeger

1. Start Jaeger with OTLP support:
```bash
docker run -d --name jaeger \
  -p 16686:16686 \
  -p 4317:4317 \
  jaegertracing/all-in-one:latest
```

2. Configure your DAG:
```yaml
otel:
  enabled: true
  endpoint: "localhost:4317"
  insecure: true
```

3. View traces at http://localhost:16686

### Production with OpenTelemetry Collector

```yaml
dotenv:
  - .env
otel:
  enabled: true
  endpoint: "otel-collector.monitoring:4317"
  headers:
    Authorization: "Bearer ${env.OTEL_TOKEN}"
  resource:
    service.name: "dagu-${DAG_NAME}"
    deployment.environment: "production"
    service.version: "${VERSION}"
```
