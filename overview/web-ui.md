# Web UI

Use Dagu's web UI to run workflows, inspect results, edit DAGs, review logs, and manage the server from a browser.

## Start the UI

```bash
dagu start-all
```

Then open `http://localhost:8080`.

To bind a different address or port:

```bash
dagu start-all --host 0.0.0.0 --port 9000
```

## Main Areas

Dagu's UI is organized around a few everyday jobs:

- **Cockpit** for a live board of recent runs
- **Dashboard** for recent activity and trends
- **Definitions** for the list of workflows
- **Run details** for outputs, artifacts, logs, and retries
- **Docs** for markdown documents and runbooks
- **Search** for finding workflows and documents quickly
- **System Status** for scheduler, coordinator, worker, and resource health

## Workspace Selector

The workspace selector sits at the top of the navigation and affects workspace-aware pages such as Cockpit, Dashboard, Definitions, Runs, Search, Design, and Docs.

![Workspace selector](/web-ui-workspace-selector-demo.png)

You can switch between:

- **all** to see everything your account can access
- **default** to see items with no named workspace
- **A named workspace** such as `ops`

See [Workspaces](/web-ui/workspaces) for the full behavior and admin setup.

## Cockpit

Cockpit is the quickest way to watch what is happening right now.

![Cockpit](/cockpit.png)

Use it when you want to:

- scan today’s runs by status
- spot failures or stuck work quickly
- open run details without leaving the board
- start or enqueue workflows from the template picker

See [Cockpit](/web-ui/cockpit) for the dedicated guide.

## Agent

The built-in agent helps with workflow authoring, debugging, and day-to-day operations directly in the UI.

![Agent Chat](/agent-modal.png)

Typical uses:

- draft or edit DAG YAML
- explain failures and suggest fixes
- navigate to related pages
- work with local files when allowed by policy

Configure it from `/agent-settings`.

See [AI Agent](/features/agent/) for the full setup and usage guide.

## Dashboard

The Dashboard gives you a broader operations view than Cockpit.

![Dashboard](/dashboard.png)

Use it to review:

- recent workflow activity
- success and failure patterns
- filtered run lists by status, date, and name

## Definitions

The Definitions page lists every workflow you can access and shows its current state.

![Definitions](/dag-definitions.png)

This is the best place to:

- browse workflows by workspace
- open a DAG for details or editing
- start or enqueue a workflow from its detail view
- see whether a workflow is scheduled, suspended, or recently failed

## Workflow Details

Open any workflow from **Definitions** to inspect its latest run, schedule, webhook settings, history, and YAML.

![DAG Details](/dag-status.png)

From this page you can usually:

- start, stop, or retry runs
- review the latest graph or timeline
- inspect step-level status
- move between **Latest Run**, **Spec**, **Webhook**, and **History**

## Run Details

When you open a specific run, Dagu shows the full execution view.

![Execution Details](/status-details.png)

This is where you troubleshoot and verify results:

- **Status** for the graph and step table
- **Timeline** for execution ordering and duration
- **Outputs** for collected output values
- **Artifacts** for generated files
- **Logs** for the run and each step

The dedicated outputs view is also available inside the run screen:

![Outputs Tab](/outputs-tab.png)

## Run History And Logs

Use workflow history when you want to compare multiple attempts of the same DAG:

![Execution History](/dag-history.png)

Use the log view when you want the detailed text output for a run or a single step:

![Execution Log](/dag-logs.png)

## DAG Editor

You can edit workflow YAML directly in the browser when your role allows writes.

![DAG Editor](/dag-editor.png)

The editor includes:

- YAML editing with validation
- schema-aware help and completion
- save actions tied to normal DAG permissions

## Search

Search helps when you know roughly what you need but not exactly where it lives.

![Search](/search.png)

You can search:

- **DAGs** for workflow definitions
- **Docs** for markdown content when document management is enabled

## Documents

The Documents page is Dagu's built-in markdown workspace for runbooks, reports, and generated documents.

![Documents](/docs.png)

Common workflows:

- maintain team runbooks
- keep operating notes next to workflows
- publish run-generated markdown with `DAG_DOCS_DIR`
- browse and preview documents by workspace

See [Documents](/web-ui/documents) for the dedicated guide.

## API Docs

The **API Docs** page exposes the REST API reference from inside the application.

![API Docs](/web-ui-api-docs-demo.png)

Use it when you need to:

- inspect endpoints before automating a task
- check request and response shapes
- test ideas before wiring them into scripts or CI

For the narrative API overview, see [API](/overview/api). For the full generated reference, see [Web UI API](/web-ui/api).

## System Status

System Status shows the health of the scheduler, coordinator, and the current machine.

![Workers](/workers.webp)

This page helps you verify:

- scheduler and coordinator availability
- connected workers
- current CPU, memory, disk, and load trends

If you use distributed execution, this is the first place to look when workers appear missing or overloaded.

## Admin Pages

Depending on your role and license, the navigation can also include pages such as:

- **Users**
- **API Keys**
- **Remote Nodes**
- **Base Config**
- **Events**
- **Audit Logs**
- **License**

These pages are intended for administrators and operators rather than day-to-day workflow users.

## Optional Features

### Terminal

The browser terminal is disabled by default. Enable it only in environments where shell access through the UI is acceptable.

```yaml
terminal:
  enabled: true
  max_sessions: 5
```

### Remote Nodes

Remote nodes let one Dagu UI manage multiple Dagu servers.

```yaml
remote_nodes:
  - name: production
    api_base_url: https://prod.example.com/api/v1
    auth_type: token
    auth_token: ${PROD_TOKEN}
```

### Branding

You can adjust the title and accent color shown in the navigation bar.

```yaml
ui:
  navbar_title: "My Workflows"
  navbar_color: "#00D9FF"
```

## Security Notes

- Enable authentication before exposing the UI outside a trusted network.
- Use HTTPS for any remote or shared deployment.
- Treat terminal access and write access as admin-level capabilities.

## See Also

- [Workspaces](/web-ui/workspaces)
- [Cockpit](/web-ui/cockpit)
- [Documents](/web-ui/documents)
- [Learn the REST API](/overview/api)
- [Server Administration](/server-admin/)
