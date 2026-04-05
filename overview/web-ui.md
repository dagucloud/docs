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
- Cockpit: workspace-scoped kanban view of DAG runs
- Web-based terminal (optional)
- Audit logs and centralized event logs

::: tip Configuration
For Web UI configuration options, see [Configuration Reference](/server-admin/reference#ui-configuration).
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

## Cockpit

The Cockpit page (`/cockpit`) provides a workspace-scoped kanban board for monitoring DAG runs across dates. DAG runs are grouped into four status columns (Queued, Running, Done, and Failed) with date sections that load incrementally via infinite scroll (up to 30 days back). Today's section receives real-time updates via SSE.

![Cockpit](/cockpit.png)

Workspaces organize DAG runs using `workspace=<name>` tags. The workspace selector lets you create, switch, and delete workspaces. A template selector lets you browse DAG definitions, preview them in a side panel, and enqueue runs with the workspace tag automatically injected.

See [Cockpit](/web-ui/cockpit) for full details.

## Documents

The Documents page (`/docs`) is a built-in markdown document manager with a full REST API. Documents are `.md` files stored under `{DAGsDir}/docs/`. They can be browsed, edited, and searched in the web UI, and created or updated programmatically through the `/api/v1/docs` endpoints.

![Documents](/docs.png)

The page uses a resizable split layout:

- **Left panel**: a file tree showing documents organized in directories. Supports expand/collapse all, inline renaming (double-click or F2), drag-and-drop to move files, multi-select (Ctrl/Cmd+Click or Shift+Click) with batch delete, and full-text search across document content. A collapsible **Outline** section at the bottom lists headings extracted from the active document; clicking a heading scrolls to it in the preview.
- **Right panel**: a tabbed editor. Multiple documents can be open simultaneously. Each tab shows an unsaved-changes indicator and provides close/close-others/close-all actions. The editor area toggles between **Edit** mode (Monaco editor with markdown syntax highlighting) and **Preview** mode (rendered markdown with GFM support and Mermaid diagram rendering). The mode preference persists across sessions.

DAG steps can generate documents at runtime using the `DAG_DOCS_DIR` environment variable. Files written there appear in the tree automatically.

### AI Agent Integration

Documents serve as a shared knowledge base between human operators and AI agents:

- **Built-in AI agent** (chat UI): can reference documents via `@` mentions in the agent chat, and navigate to the documents page or a specific document using its `navigate` tool.
- **Agent steps in workflows** (`type: agent`): have `read` and `bash` tools with access to the docs directory. The system prompt includes the docs directory path, so agents in workflows can read existing documents and write new ones directly to the filesystem.
- **DAG steps** (shell commands): can write documents using the `DAG_DOCS_DIR` environment variable. Files written there appear in the tree automatically.
- **External AI tools** (Claude Code, Codex, custom agents): can create, read, update, delete, and search documents through the REST API at `/api/v1/docs`.

See [Documents](/web-ui/documents) for storage format, API reference, and permissions.

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
- **Live / Schedule**: Scheduler-backed next run ordering plus schedule labels and live toggle state

The Web UI initializes this page with `name` / `asc` and sends explicit `sort` and `order` query parameters on requests. `ui.dags.sort_field` and `ui.dags.sort_order` are API fallback settings for clients that omit those parameters.

::: info Backend Sorting
`name` and `nextRun` are sorted server-side. `status` and `lastRun` are browser-side sorts on the current page only.
:::

## DAG Details

Click any DAG to see detailed information including real-time status, logs, and DAG configurations. You can edit DAG configurations directly in the browser.

![DAG Details](/dag-status.png)

### Controls
- **Start**: Run the workflow
- **Stop**: Cancel running execution
- **Retry**: Retry failed execution
- **Edit**: Modify workflow (if permitted)

When a DAG exposes `paramDefs` metadata, the Start and Enqueue dialogs render typed controls automatically:

- strings use text inputs
- enums use selects
- integers and numbers use numeric inputs with bounds
- booleans use a toggle or checkbox

Descriptions are shown inline, client-side validation runs before submission, and the server still performs the authoritative validation. If a DAG does not expose typed parameter metadata, the UI falls back to the raw parameter editor.

When a DAG uses `params[].eval`, computed defaults are resolved by the server when the run starts or is enqueued. The dialogs may not show those computed values ahead of time unless a literal `default` is also present.

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
- See [CLI Reference](/getting-started/cli#history) for details
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
Requires `write_dags` permission:
```yaml
permissions:
  write_dags: true
```

## Search

The Search page (`/search`) provides cursor-based full-text search with two scopes:

- **DAGs**: searches DAG definitions and returns lightweight results with preview snippets
- **Docs**: searches managed markdown documents and returns lightweight results with preview snippets

Each result can load additional snippets on demand through **Show more matches**, and the page supports infinite loading for more results.

![Search](/search.png)

The **Docs** scope is available only when document management is enabled on the server. When it is unavailable, the page returns a permission error instead of silently falling back.

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

The Dagu agent is an AI assistant that helps create, review, debug, and manage DAG workflows through a chat interface.

### Accessing the Agent

Click the **Agent** button at the bottom-left corner of any page.

### Capabilities

- Create and edit DAG YAML files
- Execute shell commands subject to the configured bash policy
- Read files and edit repository content
- Navigate to UI pages
- Use skills or remote nodes when those features are configured

### Configuration

Configure the agent at `/agent-settings` (requires admin role).

See [Agent](/features/agent/) for complete documentation.

## Terminal

The web-based terminal allows executing shell commands directly from the Dagu UI.

### Enabling Terminal

Terminal is **disabled by default** for security reasons. Enable it in your configuration:

```yaml
# config.yaml
terminal:
  enabled: true
  max_sessions: 5
```

Or via environment variable:
```bash
export DAGU_TERMINAL_ENABLED=true
export DAGU_TERMINAL_MAX_SESSIONS=5
```

### Security Notes

- Commands run with the same permissions as the Dagu server process
- Only enable in trusted environments
- Consider enabling authentication when using terminal
- Terminal sessions are logged in the audit log

## Audit Logs

::: info Self-Host License
On self-hosted Dagu, audit logs require an active self-host license. Hosted Dagu Cloud includes audit logging by default. See the [pricing page](https://dagu.sh/pricing) for current self-host and cloud availability.
:::

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

See [Audit Logging Configuration](/server-admin/server#audit-logging) for more details.

## Event Logs

The Event Logs page (`/event-logs`) shows centralized operational events recorded by the event store.

The current page focuses on DAG-run events and supports filtering by:

- outcome type
- DAG name
- DAG run ID
- attempt ID
- time range

The feed uses cursor pagination. Newer entries auto-refresh while you are at the head of the feed; loading older entries switches the page into manual historical browsing.

When builtin authentication is enabled, viewing event logs requires a `manager` or `admin` role.

## UI Customization

### Branding
```yaml
# config.yaml
ui:
  navbar_color: "#00D9FF"
  navbar_title: "My Workflows"
```

### Display Options
```yaml
ui:
  max_dashboard_page_limit: 100  # Items per page
  log_encoding_charset: utf-8   # Log encoding
  dags:
    sort_field: "name"         # Default request sort field (`name` or `nextRun`)
    sort_order: "asc"          # Default sort order
```

## Remote Nodes

Monitor multiple Dagu instances:

```yaml
remote_nodes:
  - name: staging
    api_base_url: https://staging.example.com/api/v1
    auth_type: basic
    basic_auth_username: admin
    basic_auth_password: ${STAGING_PASSWORD}

  - name: production
    api_base_url: https://prod.example.com/api/v1
    auth_type: token
    auth_token: ${PROD_TOKEN}
```

## Security Considerations

### HTTPS Setup
```yaml
tls:
  cert_file: /path/to/cert.pem
  key_file: /path/to/key.pem
```

## See Also

- [Learn the REST API](/overview/api) for automation
- [Configure authentication](/server-admin/server#authentication) for security
- [Configure terminal access](/server-admin/server#terminal) for shell access
- [Configure audit logging](/server-admin/server#audit-logging) for security monitoring
- [Set up monitoring](/server-admin/operations#monitoring) for production
