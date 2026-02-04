# Web UI

Monitor and manage workflows through Dagu's built-in web interface.

## Overview

Dagu includes a modern, responsive web UI that provides:
- Real-time DAG execution monitoring
- Visual DAG representation
- Log viewing and search
- DAG execution history
- DAG (YAML) editor with syntax highlighting and auto-completion
- Interactive DAG management (start, stop, retry, etc.)
- Web-based terminal (optional)
- Audit logging for security events

::: tip Configuration
For Web UI configuration options, see [Configuration Reference](/reference/config#ui-configuration).
:::

## Accessing the UI

```bash
# Start Dagu with web UI
dagu start-all

# Open in browser
# http://localhost:8080
```

Custom host/port:
```bash
dagu start-all --host 0.0.0.0 --port 9000

# Or via environment variables
export DAGU_HOST=0.0.0.0
export DAGU_PORT=9000
dagu start-all
```

## Dashboard

The main dashboard shows:

![Dashboard](/dashboard.png)

### Recent Executions
- Timeline of recent workflow runs
- Quick status indicators
- Click to view details

### Filters
- Filter by date range
- Filter by status (success, failed, running)
- Search by workflow name

## DAG Definitions

The DAGs page shows all DAGs and their real-time status. This gives you an immediate overview of your workflows.

![Definitions](/dag-definitions.png)

### DAG List Sorting
The DAG list can be sorted by:
- **Name**: Alphabetical order
- **Status**: Current execution status  
- **Last Run**: Most recent execution time
- **Schedule**: Cron schedule
- **Suspended**: Suspension state

Configure default sorting in `config.yaml`:
```yaml
ui:
  dags:
    sortField: "lastRun"  # Default sort field
    sortOrder: "desc"     # Default sort order (asc/desc)
```

Or via environment variables:
```bash
export DAGU_UI_DAGS_SORT_FIELD=lastRun
export DAGU_UI_DAGS_SORT_ORDER=desc
```

::: info Backend Sorting
Only the `name` field is sorted server-side. Other fields (status, lastRun, schedule, suspended) are sorted client-side for performance.
:::

## DAG Details

Click any DAG to see detailed information including real-time status, logs, and DAG configurations. You can edit DAG configurations directly in the browser.

![DAG Details](/dag-status.png)

### Controls
- **Start**: Run the workflow
- **Stop**: Cancel running execution
- **Retry**: Retry failed execution
- **Edit**: Modify workflow (if permitted)

### Information Tabs
- **Graph**: Visual representation
  - **Drill-down**: Navigate to sub DAG executions by double-clicking steps
  - **Update Status**: Change step status manually by right-clicking steps
- **Config**: YAML definition
- **History**: Past executions
- **Log**: Current execution logs

## Execution Details

The execution details page provides in-depth information about a specific workflow run, including real-time updates and logs.

![Execution Details](/status-details.png)

### Real-time Updates
- Live status changes
- Streaming logs
- Progress indicators

### Log Viewer
- Combined workflow log
- Per-step stdout/stderr
- Search within logs
- Download logs

### Step Information
- Start/end times
- Duration
- Exit code
- Output variables

## Execution History

The execution history page shows past execution results and logs, providing a comprehensive view of workflow performance over time.

![Execution History](/dag-history.png)

### Execution List
- Sortable by date, status, duration
- Pagination for large histories
- Quick actions (retry, view logs)

### Execution Timeline
- Visual timeline of executions
- Identify patterns and issues
- Performance trends

::: tip CLI Alternative
View execution history from the command line with `dagu history`:
- Faster for scripting and automation
- Export to JSON for analysis: `dagu history --format json`
- Advanced filtering: `dagu history --status failed --last 7d --tags prod`
- See [CLI Reference](/reference/cli#history) for details
:::

## Execution Log

The execution log view shows detailed logs and standard output of each execution and step, helping you debug and monitor workflow behavior.

![Execution Log](/dag-logs.png)

## DAG Editor

Edit workflows directly in the browser:

![DAG Editor](/dag-editor.png)

### Features
- Syntax highlighting
- YAML validation
- Auto-completion
- Save with validation

### Permissions
Requires `writeDAGs` permission:
```yaml
permissions:
  writeDAGs: true
```

## Search

The search functionality allows you to search for specific text across all DAGs in your system, making it easy to find workflows by content, variables, or any other text within the DAG definitions.

![Search](/search.png)

### Global Search
- Search across all DAGs
- Find by name, tags, or content

## System Status

The System Status page provides real-time monitoring of system health and resource usage.

### Service Status
- **Scheduler Service**: Shows running scheduler instances with host, status, and uptime
- **Coordinator Service**: Shows coordinator instances for distributed execution

### Resource Monitoring
Real-time charts display system resource usage:
- **CPU Usage**: Overall CPU utilization percentage
- **Memory Usage**: RAM utilization percentage
- **Disk Usage**: Storage utilization for the data directory
- **Load Average**: 1-minute system load average

Charts auto-refresh every 5 seconds and display historical data based on the configured retention period (default: 24 hours).

**Configuration:**
```yaml
# config.yaml
monitoring:
  retention: "24h"    # How long to keep history
  interval: "5s"      # Collection frequency
```

## Workers

![Workers](/workers.webp)

The Workers page provides real-time monitoring of distributed execution workers connected to the coordinator service.

### Worker List
- **Worker ID**: Unique identifier for each worker
- **Labels**: Capability labels (GPU, memory, region, etc.)
- **Health Status**: Visual health indicators
  - Green: Healthy (< 5s since last heartbeat)
  - Yellow: Warning (5-15s since last heartbeat)
  - Red: Unhealthy (> 15s since last heartbeat)
- **Last Heartbeat**: Time since last communication
- **Running Tasks**: Currently executing DAG runs

### Running Task Details
For each running task, you can see:
- **DAG Name**: The workflow being executed
- **DAG Run ID**: Unique execution identifier
- **Root DAG**: Top-level workflow (for nested DAGs)
- **Parent DAG**: Immediate parent (for sub DAGs)
- **Started At**: Task start time

### Navigating to Task Details
Click on any running task to open the DAG run details modal:
- For root tasks: Opens DAG run details directly
- For child tasks: Opens parent DAG with child view and breadcrumb navigation
- Ctrl/Cmd+Click: Opens task details in a new tab

### Worker Labels Display
Each worker shows its capability labels as badges:
```
Worker: gpu-worker-01
Labels: [gpu=true] [cuda=11.8] [memory=64G] [region=us-east-1]
```

## Agent

Tsumugi is an AI assistant that helps create, review, debug, and manage DAG workflows through a chat interface.

### Accessing the Agent

Click the **Agent** button at the bottom-right corner of any page.

### Capabilities

- Create and edit DAG YAML files
- Execute shell commands (with approval for dangerous operations)
- Read files and look up DAG schema documentation
- Navigate to UI pages
- Search the web for documentation

### Configuration

Configure the agent at `/settings/agent` (requires admin role).

See [Agent](/features/agent/) for complete documentation.

## Terminal

The web-based terminal allows executing shell commands directly from the Dagu UI.

### Enabling Terminal

Terminal is **disabled by default** for security reasons. Enable it in your configuration:

```yaml
# config.yaml
terminal:
  enabled: true
```

Or via environment variable:
```bash
export DAGU_TERMINAL_ENABLED=true
```

### Security Notes

- Commands run with the same permissions as the Dagu server process
- Only enable in trusted environments
- Consider enabling authentication when using terminal
- Terminal sessions are logged in the audit log

## Audit Logs

The Audit Logs page (under Settings) provides a searchable log of security-sensitive operations.

### Logged Events

- **Authentication**: Login attempts, password changes
- **User Management**: User creation, updates, deletion
- **API Keys**: Key creation, updates, deletion
- **Webhooks**: Webhook management operations
- **Terminal**: Shell command executions

### Configuration

Audit logging is **enabled by default**. To disable:

```yaml
# config.yaml
audit:
  enabled: false
```

Or via environment variable:
```bash
export DAGU_AUDIT_ENABLED=false
```

See [Audit Logging Configuration](/configurations/server#audit-logging) for more details.

## UI Customization

### Branding
```yaml
# config.yaml
ui:
  navbarColor: "#00D9FF"
  navbarTitle: "My Workflows"
```

### Display Options
```yaml
ui:
  maxDashboardPageLimit: 100  # Items per page
  logEncodingCharset: utf-8   # Log encoding
  dags:
    sortField: "name"         # Default sort field
    sortOrder: "asc"          # Default sort order
```

## Remote Nodes

Monitor multiple Dagu instances:

```yaml
remoteNodes:
  - name: staging
    apiBaseURL: https://staging.example.com/api/v1
    
  - name: production
    apiBaseURL: https://prod.example.com/api/v1
    authToken: ${PROD_TOKEN}
```

### Features
- Unified dashboard
- Centralized management

## Security Considerations

### HTTPS Setup
```yaml
tls:
  certFile: /path/to/cert.pem
  keyFile: /path/to/key.pem
```

### CORS Configuration
Configure for API access from different domains:
```yaml
cors:
  enabled: true
  allowedOrigins:
    - https://app.example.com
```

## See Also

- [Learn the REST API](/overview/api) for automation
- [Configure authentication](/configurations/server#authentication) for security
- [Configure terminal access](/configurations/server#terminal) for shell access
- [Configure audit logging](/configurations/server#audit-logging) for security monitoring
- [Set up monitoring](/configurations/operations#monitoring) for production
