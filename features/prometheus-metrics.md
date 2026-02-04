# Prometheus Metrics

Dagu exposes Prometheus metrics for monitoring workflow execution, system health, and operational insights. These metrics can be scraped by Prometheus and visualized in tools like Grafana.

## Endpoint

Metrics are available at:

```
GET /api/v1/metrics
```

## Access Control

By default, the metrics endpoint requires authentication. You can configure public access if needed.

### Configuration

**Config file (`~/.config/dagu/config.yaml`):**
```yaml
# Require authentication (default)
metrics: "private"

# Allow public access (no authentication required)
metrics: "public"
```

**Environment variable:**
```bash
export DAGU_SERVER_METRICS=public
```

## Available Metrics

### System Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `dagu_info` | Gauge | Build information (version, go_version labels) |
| `dagu_uptime_seconds` | Gauge | Time since server start |
| `dagu_scheduler_running` | Gauge | Whether the scheduler is running (1) or not (0) |
| `dagu_dags_total` | Gauge | Total number of DAGs |

### Aggregate DAG Run Metrics

These metrics provide system-wide totals across all DAGs:

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `dagu_dag_runs_currently_running` | Gauge | - | Total number of currently running DAG runs |
| `dagu_dag_runs_queued_total` | Gauge | - | Total number of DAG runs in queue |
| `dagu_dag_runs_total` | Counter | `status` | Total DAG runs by status (today) |

**Status values:** `succeeded`, `failed`, `aborted`, `running`, `queued`, `not_started`, `partially_succeeded`

### Per-DAG Metrics

These metrics provide granular visibility into individual DAG performance:

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `dagu_dag_runs_currently_running_by_dag` | Gauge | `dag` | Running count per DAG |
| `dagu_dag_runs_queued_by_dag` | Gauge | `dag` | Queue depth per DAG |
| `dagu_dag_runs_total_by_dag` | Counter | `dag`, `status` | DAG runs by DAG and status (today) |
| `dagu_dag_run_duration_seconds` | Histogram | `dag` | Duration of completed DAG runs |
| `dagu_queue_wait_seconds` | Histogram | `dag` | Time spent waiting in queue |

### Histogram Buckets

**DAG Run Duration (`dagu_dag_run_duration_seconds`):**
- Buckets: 1s, 5s, 15s, 30s, 60s, 120s, 300s, 600s, 1800s, 3600s
- Designed for workflow-appropriate timescales

**Queue Wait Time (`dagu_queue_wait_seconds`):**
- Buckets: 1s, 5s, 10s, 30s, 60s, 120s, 300s, 600s
- Shorter timescales for queue latency monitoring

### Cache Metrics

Dagu exposes internal cache statistics for memory monitoring and debugging:

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `dagu_cache_entries_total` | Gauge | `cache` | Number of entries in each cache |

**Cache names:** `dag_definition`, `dag_run_status`, `api_key`, `webhook`

Cache limits are configurable via the `cache` setting:

```yaml
cache: normal   # options: low, normal, high (default: normal)
```

Or via environment variable: `DAGU_CACHE=low`

**Preset values:**
| Preset | DAG | DAGRun | APIKey | Webhook |
|--------|-----|--------|--------|---------|
| low    | 500 | 5,000  | 100    | 100     |
| normal | 1,000 | 10,000 | 500  | 500     |
| high   | 5,000 | 50,000 | 1,000 | 1,000  |

TTL: DAG/DAGRun=12h, APIKey/Webhook=15m

These metrics help identify memory growth issues by tracking cache sizes over time.

### Go Runtime Metrics

Standard Go runtime metrics are also exposed:
- `go_goroutines` - Number of goroutines
- `go_memstats_*` - Memory statistics
- `go_gc_*` - Garbage collection metrics
- `process_*` - Process-level metrics

## Prometheus Configuration

### Private Mode (Default)

When `metrics: "private"`, configure Prometheus to authenticate:

**Using API Token:**
```yaml
scrape_configs:
  - job_name: 'dagu'
    bearer_token: 'your-api-token'
    static_configs:
      - targets: ['dagu:8080']
    metrics_path: '/api/v1/metrics'
```

**Using Basic Auth:**
```yaml
scrape_configs:
  - job_name: 'dagu'
    basic_auth:
      username: 'admin'
      password: 'secret'
    static_configs:
      - targets: ['dagu:8080']
    metrics_path: '/api/v1/metrics'
```

### Public Mode

When `metrics: "public"`, no authentication is needed:

```yaml
scrape_configs:
  - job_name: 'dagu'
    static_configs:
      - targets: ['dagu:8080']
    metrics_path: '/api/v1/metrics'
```

## Example Queries

### DAG Success Rate (Today)

```promql
sum(dagu_dag_runs_total{status="succeeded"}) /
sum(dagu_dag_runs_total) * 100
```

### Per-DAG Success Rate

```promql
sum by (dag) (dagu_dag_runs_total_by_dag{status="succeeded"}) /
sum by (dag) (dagu_dag_runs_total_by_dag) * 100
```

### Average DAG Duration (Per DAG)

```promql
sum by (dag) (rate(dagu_dag_run_duration_seconds_sum[1h])) /
sum by (dag) (rate(dagu_dag_run_duration_seconds_count[1h]))
```

### Average DAG Duration (Overall)

```promql
sum(rate(dagu_dag_run_duration_seconds_sum[1h])) /
sum(rate(dagu_dag_run_duration_seconds_count[1h]))
```

### 95th Percentile Duration (Per DAG)

```promql
histogram_quantile(0.95,
  sum by (dag, le) (rate(dagu_dag_run_duration_seconds_bucket[1h]))
)
```

### 95th Percentile Duration (Overall)

```promql
histogram_quantile(0.95,
  sum by (le) (rate(dagu_dag_run_duration_seconds_bucket[1h]))
)
```

### Queue Depth Over Time

```promql
dagu_dag_runs_queued_total
```

### Currently Running DAGs

```promql
dagu_dag_runs_currently_running
```

### Slowest DAGs (P95 Duration)

```promql
topk(10,
  histogram_quantile(0.95,
    sum by (dag, le) (rate(dagu_dag_run_duration_seconds_bucket[24h]))
  )
)
```

### Cache Size Monitoring

```promql
dagu_cache_entries_total
```

### Cache Growth Rate

```promql
rate(dagu_cache_entries_total[1h])
```

## Grafana Dashboard

You can create a Grafana dashboard with panels for:

1. **Overview Panel**
   - Total DAGs
   - Running DAGs
   - Queued DAGs
   - Scheduler status

2. **Success/Failure Panel**
   - DAG runs by status (pie chart)
   - Success rate over time (graph)

3. **Performance Panel**
   - DAG duration histogram
   - P50, P95, P99 duration trends
   - Queue wait time distribution

4. **Per-DAG Details**
   - Table of DAGs with run counts, success rates, avg duration
   - Individual DAG duration trends

### Sample Dashboard JSON

```json
{
  "title": "Dagu Workflow Metrics",
  "panels": [
    {
      "title": "Running DAGs",
      "type": "stat",
      "targets": [{"expr": "dagu_dag_runs_currently_running"}]
    },
    {
      "title": "Queue Depth",
      "type": "stat",
      "targets": [{"expr": "dagu_dag_runs_queued_total"}]
    },
    {
      "title": "DAG Runs by Status",
      "type": "piechart",
      "targets": [{"expr": "sum by (status) (dagu_dag_runs_total)"}]
    }
  ]
}
```

## Alerting Examples

### High Failure Rate

```yaml
groups:
  - name: dagu
    rules:
      - alert: DaguHighFailureRate
        expr: |
          sum(rate(dagu_dag_runs_total{status="failed"}[1h])) /
          sum(rate(dagu_dag_runs_total[1h])) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High DAG failure rate"
          description: "More than 10% of DAG runs are failing"
```

### Long Queue Wait

```yaml
      - alert: DaguLongQueueWait
        expr: |
          histogram_quantile(0.95,
            sum by (le) (rate(dagu_queue_wait_seconds_bucket[15m]))
          ) > 300
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Long queue wait times"
          description: "P95 queue wait time exceeds 5 minutes"
```

### Scheduler Down

```yaml
      - alert: DaguSchedulerDown
        expr: dagu_scheduler_running == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Dagu scheduler is not running"
```

### Cache Size Growing

```yaml
      - alert: DaguCacheGrowing
        expr: dagu_cache_entries_total > 10000
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "Cache size is large"
          description: "Cache {{ $labels.cache }} has {{ $value }} entries"
```

## See Also

- [OpenTelemetry Tracing](/features/opentelemetry) - Distributed tracing for DAG execution
- [Server Configuration](/configurations/server) - Server settings including metrics access
- [Email Notifications](/features/email-notifications) - Alert notifications for DAG failures
