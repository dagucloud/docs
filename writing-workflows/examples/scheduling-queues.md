# Scheduling & Queues Examples

Examples for schedules, time zones, watched folders, queue assignment, global queues, and notifications.

<div class="examples-grid">

<div class="example-card">

### Basic Scheduling

```yaml
schedule: "5 4 * * *"  # Run at 04:05 daily
steps:
  - run: echo "Running scheduled job"
```

```mermaid
flowchart LR
    S["schedule · 04:05 daily"] --> A["scheduled job"]
    style S stroke:lightblue,stroke-width:1.6px,color:#333
    style A stroke:green,stroke-width:1.6px,color:#333
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

```mermaid
flowchart LR
    E["extract"] --> T["transform"]
    T --> L["load"]
    style E stroke:lightblue,stroke-width:1.6px,color:#333
    style T stroke:lightblue,stroke-width:1.6px,color:#333
    style L stroke:green,stroke-width:1.6px,color:#333
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

```mermaid
flowchart LR
    Q["queue: batch"] --> A["Processing data"]
    style Q stroke:orange,stroke-width:1.6px,color:#333
    style A stroke:green,stroke-width:1.6px,color:#333
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

```mermaid
flowchart LR
    S1["weekdays · 09:00"] --> A["Run on multiple times"]
    S2["weekends · 14:00"] --> A
    style S1 stroke:lightblue,stroke-width:1.6px,color:#333
    style S2 stroke:lightblue,stroke-width:1.6px,color:#333
    style A stroke:green,stroke-width:1.6px,color:#333
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

```mermaid
flowchart LR
    S["schedule · CRON_TZ New_York 09:00"] --> A["9AM New York"]
    style S stroke:lightblue,stroke-width:1.6px,color:#333
    style A stroke:green,stroke-width:1.6px,color:#333
```

<a href="/writing-workflows/scheduling#timezone-support" class="learn-more">Learn more →</a>

</div>

<div class="example-card">

### Watched Folder

```yaml
watch:
  path: ~/Downloads/invoices
  pattern: "*.pdf"
  interval: 30s
steps:
  - id: read
    action: chat.completion
    with:
      provider: anthropic
      model: claude-sonnet-5
      prompt: Read the invoice and give its number, date, and total.
      files: ${WATCH_FILE}
    output_schema:
      type: object
      properties:
        number: {type: string}
        date: {type: string}
        total: {type: number}
      required: [number]

  - id: file
    depends: read
    action: file.move
    with:
      source: ${WATCH_FILE}
      destination: ~/Documents/invoices/${steps.read.outputs.number}.pdf
      create_dirs: true
```

```mermaid
flowchart LR
    W["watch · *.pdf arrives"] --> R["read · chat.completion"]
    R --> F["file · file.move"]
    style W stroke:lightblue,stroke-width:1.6px,color:#333
    style R stroke:lime,stroke-width:1.6px,color:#333
    style F stroke:green,stroke-width:1.6px,color:#333
```

<a href="/writing-workflows/watched-folders" class="learn-more">Learn more →</a>

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

```mermaid
flowchart LR
    S["start · 08:00"] --> R["long-running service"]
    R -->|"restart · 12:00"| R2["restart"]
    R -->|"stop · 18:00"| E["stop"]
    style S stroke:lightblue,stroke-width:1.6px,color:#333
    style R stroke:green,stroke-width:1.6px,color:#333
    style R2 stroke:orange,stroke-width:1.6px,color:#333
    style E stroke:orange,stroke-width:1.6px,color:#333
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
```

Assign the queue in the DAG file:

```yaml
queue: "critical"  # Assign to queue for concurrency control
steps:
  - run: echo "Processing critical task"
```

```mermaid
flowchart LR
    Q["queue: critical · max 5"] --> A["Processing critical task"]
    style Q stroke:orange,stroke-width:1.6px,color:#333
    style A stroke:green,stroke-width:1.6px,color:#333
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

```mermaid
flowchart LR
    A["Running critical job"] --> M["mail_on · failure/success"]
    style A stroke:lightblue,stroke-width:1.6px,color:#333
    style M stroke:orange,stroke-width:1.6px,color:#333
```

<a href="/writing-workflows/email-notifications" class="learn-more">Learn more →</a>

</div>

</div>
