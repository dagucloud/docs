# Web UI

Use Dagu's web UI to run workflows, inspect results, edit DAGs, maintain Markdown Wiki pages, review logs, and manage the server from a browser.

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
- **Wiki** for Markdown runbooks, Mermaid diagrams, and operational notes
- **Activity** for what needs attention, what is running, and what runs next
- **Workflows** for the list of workflows
- **Workflow page** for editing a workflow and following its runs, logs, outputs, artifacts, approvals, and human tasks
- **Executions** for runs across every workflow
- **Notifications** for Microsoft Teams, Slack, email, Telegram, webhook, and local command routing
- **Incidents** for PagerDuty and SolarWinds Incident Response routing
- **Profiles** for runtime variables and secrets selected when a run starts
- **Calendars** for the holidays and business days that schedules follow
- **Git Sync** for repository-managed workflows, calendars, Wiki content, and supporting files
- **Search** for finding workflows and Wiki page content quickly
- **System Status** for scheduler, coordinator, worker, and resource health

## Workspace Selector

The workspace selector sits at the top of the navigation and affects workspace-aware pages such as Overview, Wiki, Workflows, Executions, and Search.

![Workspace selector](/web-ui-workspace-selector-demo.png)

You can switch between:

- **all** to see everything your account can access
- **default** to see items with no named workspace
- **A named workspace** such as `ops`

See [Workspaces](/web-ui/workspaces) for the full behavior and admin setup.

## Cockpit

Cockpit is the quickest way to watch what is happening right now. Open it from the **Cockpit** tab of **Overview**.

![Cockpit](/cockpit.png)

Use it when you want to:

- scan today's runs by status
- spot failures or stuck work quickly
- peek at a run without leaving the board
- open a workflow from the template picker to start or enqueue it

See [Cockpit](/web-ui/cockpit) for the dedicated guide.

## Wiki

Wiki gives runbooks and workflow notes a first-class home in Dagu.

![Wiki editor](/wiki.png)

Use it to:

- organize Markdown files in a nested tree
- work across several Wiki pages with tabs
- edit and preview Markdown, including Mermaid diagrams
- navigate long Wiki pages from their heading outline
- search file names and contents
- keep Wiki pages scoped to a workspace
- publish and pull Wiki pages with Git Sync

Unsaved drafts are kept in browser storage, and the editor reports external changes before they can overwrite local work. See [Wiki](/web-ui/wiki) for file operations, workspace behavior, storage configuration, runtime paths, and Git Sync.

## Git Sync

The Git Sync page displays workflows, calendars, Wiki content, and supporting files from the configured repository. Type and status filters make it easy to find scripts, templates, binaries, and other files.

Use the page to pull remote changes, review text or binary differences, publish selected edits, and resolve conflicts. Supporting-file diffs also show executable permissions and remote deletions when applicable. See [Git Sync](/server-admin/git-sync) for repository layout, configuration, CLI commands, and production guidance.

## Calendars

Open **Configure > Calendars** to list the business calendars that start schedules name, with how many DAGs use each one and which need attention: a file that does not load, or holidays that run out within 30 days.

A calendar's page opens its YAML in an editor with schema completion and problems marked on their lines, beside a year view that follows each edit. It lists the DAGs and calendars that depend on the calendar, and a calendar in use cannot be deleted. See [Business Calendars](/writing-workflows/business-calendars).

## Activity

The **Activity** tab of **Overview** gives you a broader operations view than Cockpit.

![Dashboard](/dashboard.png)

Use it to review:

- failing workflows and runs waiting for input
- runs in progress and the scheduled runs up next
- runs by workflow over the last 24 hours or a chosen time range

For a run list filtered by status, date, and name, open **Executions**.

## Workflows

The **Workflows** page lists every workflow you can access and shows its current state.

![Definitions](/dag-definitions.png)

This is the best place to:

- browse workflows by workspace
- filter by name or label, and sort by name, status, or last run
- peek at a workflow or open its workflow page
- see whether a workflow is scheduled, suspended, or recently failed

Click a row to peek at the workflow in a side sheet: its description, schedule, labels, latest run, a read-only graph of the run's step states, and recent runs. Select **Open workflow**, or press `Enter` or `F`, to open the workflow page. `Ctrl`/`Cmd`+click a row, or press `Ctrl`/`Cmd`+`Enter` in the peek, to open the page in a new tab. `Esc` or the browser's Back button closes the peek. Runs listed on **Executions**, **Activity**, and **Cockpit** open the same peek, with **Open run**. On screens narrower than 768 pixels, a click opens the page directly.

Sorting by status or last run is available while 300 or fewer workflows match.

When [recursive DAG discovery](/server-admin/configuration#recursive-dag-discovery)
finds duplicate file names or effective DAG names, the Workflows page shows
an error with the conflicting paths. All DAGs in the conflict are hidden from
the list and excluded from scheduling until the files are renamed or removed.

## Workflow Page

Open a workflow from **Workflows** to edit it and follow its runs on one page.

The page has three parts:

- the workflow bar at the top, with the name, labels, the selected run, its actions, and **Start**
- the canvas, which draws the steps as a graph and marks each step with its state in the selected run
- **Activity** at the bottom, with the run timeline, the steps of the selected run, and its logs and results

The page shows the latest run until another run is selected. Select a run on the run timeline or the **History** tab, or use the arrows on the run chip in the bar. The URL records the selected run and step, so a copied link opens the same view. Run links of the form `/dag-runs/<name>/<run-id>`, such as those in notifications, open the run on its workflow page.

### Start And Control Runs

**Start** opens the start dialog. Set parameters, a runtime profile, and an optional run ID, then start or enqueue the run. For a [build workflow](/writing-workflows/incremental-workflows), the dialog also provides **Disable reuse for this run** when every eligible step should be recomputed. With unsaved edits, the menu next to **Start** offers **Run unsaved draft**.

The icons next to the run chip act on the selected run: stop, cancel auto-retry, reject, retry, reschedule, or dequeue, as its state allows. **Run details** shows the run's status, progress, timing, parameters, and reused outputs.

For a queued run, **Run details** also shows its queued runtime conditions: the latest observed reason the run has not started yet. See [Queued Runtime Conditions](/server-admin/queues#queued-runtime-conditions) for the exact condition fields and reason names.

When the selected run used a different definition from the saved file, a warning dot appears next to the run chip. Select it to show that run's definition, read-only, on the canvas. **Copy to editor** replaces the editor text with that definition.

### Edit The Workflow

Users with write access edit the workflow on the canvas.

- Press `N`, or select the **+** after a step, to add a step from the step palette.
- Drag from one step to another to add a dependency. Right-click a step or the canvas for more actions.
- **YAML** opens the whole file beside the canvas, with validation, schema-aware completion, formatting, and quick fixes.
- **Workflow** opens the Workflow panel. Its **Overview** tab shows the description, schedule, parameters, handlers, and the runtime profile that applies. The **Wiki**, **Incidents**, and **Notifications** tabs hold the workflow's Wiki pages and its incident and notification overrides.
- The **Manual**, **Cron**, and **Webhook** launchers on the canvas show how the workflow starts. **Cron** edits the schedule and previews upcoming runs. **Webhook** holds the webhook settings.
- **Save** shows the changes against the saved version before it writes the file. **Undo**, **Redo**, and **Revert to the last save** act on unsaved edits.

### Steps

Click a step to open its panel over the right side of the canvas. The panel shows the step in the selected run: its status, **Retry step** and **Change status** when they apply, a **Details** tab with its run facts and definition, and tabs such as **Log**, **Output**, and **History**. `Esc`, the close button, or a click on empty canvas closes it.

Double-click a step, or press `Enter` on it, to open the node view. It shows the data from upstream steps, the step's form or YAML, and its result in the selected run.

A build step shows its reuse decision, reason, and explanation. A reused materialization also links to the run that produced it.

**Run step**, on a step's toolbar or in the node view, runs that step now. When the step has upstream steps, the confirmation offers **Step only** to reuse their outputs from an earlier run, **Changed steps** to also rerun the upstream steps that changed since that run, and **Run** to run every upstream step first. A step run from the saved file is recorded like any other run. A step run from unsaved edits is a test run: it is not kept and disappears 10 minutes after it ends.

### Activity Panel

Select **Activity** at the bottom of the page to open the run panel. It shows a timeline of recent runs, the steps of the selected run, and tabs for the run, or for one step when a step is selected.

| Tab | Shows |
| --- | --- |
| **Log** | The log of the selected step, or the run's scheduler log when no step is selected |
| **Agent** | Agent sessions, and the decision timeline of an [agent DAG](/writing-workflows/agent) run |
| **Actions** | Approvals and [human tasks](/writing-workflows/human-tasks) that wait for input |
| **Timeline** | When each step ran and for how long |
| **History** | Each step's status across the runs on the timeline |
| **Outputs** | Output values collected from the steps |
| **Artifacts** | Files the run produced, with downloads and inline previews of Markdown, text, and images. See [Artifacts](/writing-workflows/artifacts). |
| **Tasks** | The tasks of an agent DAG run and how each was settled |
| **Chat** | Transcripts of chat and agent steps |
| **Continuous** | Samples, availability, and events of a step that repeats without a `limit` |

A tab appears only when the run has something to show in it. The run timeline can show a number of recent runs or a time range, and can filter runs by trigger.

On the **History** tab, select a cell to show that run and step, or select a step name for that step's history: its success rate, usual duration, and recent results with links to their logs.

When a run waits for an approval or a human task, the canvas shows a notice with **Open actions**, and the **Actions** tab shows how many items wait. Complete each generated form there, or select **Request changes** to push the work back when the task declares `with.push_back`. While the run is queued or running, open tasks stay visible but read-only, and typed input is kept. If the input was stored but the resume could not be queued, the same tab displays **Retry queue** so the run can recover without entering the values again.

### Logs

The **Log** tab opens a failed step on its stderr. The run's scheduler log offers a download of the full log or of every step log as a ZIP file. `Cmd`/`Ctrl`+click **View stdout** or **View stderr** in a step's run facts to open that log on a page of its own in a new tab.

### Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `[` / `]` | Select the older or newer run |
| `Shift+L` | Follow the latest run |
| `l` | Open the log of the selected step |
| `r` | Refresh the workflow and its runs |
| `N` | Add a step |
| `Enter` | Open the selected step in the node view |
| `F` or `0` | Fit the graph in view |
| `Esc` | Close the open panel or clear the selection |
| `Ctrl/Cmd+S` | Save |
| `Ctrl/Cmd+K` | Open the command palette, including **Go to step** |
| `Shift+?` | Show every canvas shortcut |

## Notifications

The Notifications section manages team messages from the Web UI.

![Notification rules](/notification-rules-light.png)

Use it to:

- create reusable Microsoft Teams, Slack, email, Telegram, webhook, and local command channels
- set Global notification defaults for all DAGs
- override Global rules for one workspace
- configure per-DAG exceptions from the **Notifications** tab of the workflow page's **Workflow** panel
- test channels before relying on them in production

See [Notifications](/web-ui/notifications) for the full routing model.

## Incidents

The Incidents section manages provider incidents for production workflow failures.

![Incident routing](/incident-routing-light.png)

Use it to:

- create reusable PagerDuty and SolarWinds Incident Response connections
- set a Global incident route for every DAG
- override the Global route for one workspace
- configure per-DAG exceptions from the **Incidents** tab of the workflow page's **Workflow** panel
- test provider credentials before relying on them in production

Incident routing opens incidents only after automatic retries are exhausted, deduplicates repeated failures for the same provider, workspace, and DAG, and resolves the same incident when a later run succeeds.

Incident connections and routing require an active Dagu license or trial on self-hosted deployments. See [Incident Routing](/web-ui/incidents) for the full model.

## Search

Search helps when you know roughly what you need but not exactly where it lives.

![Search](/search.png)

You can search:

- **Workflows** for workflow definitions
- **Wiki** for Markdown files and matching lines

## Profiles & Secrets

The Profiles & Secrets page separates runtime configuration into two tabs.

### Profiles

The **Profiles** tab manages named runtime profiles for DAG runs. A profile groups non-secret variables and write-only secret values, then makes that group selectable from the start and enqueue dialogs.

Use profiles when the same DAG should run against different environments, such as `dev`, `staging`, or `prod`, without changing the DAG YAML.

The **Executions** list and the run facts on the workflow page show the selected profile name when a profile was used. Retries inherit the original run's profile.

See [Profiles](/web-ui/profiles) for the Web UI workflow and [Runtime Profiles](/writing-workflows/runtime-profiles) for CLI, API, permission, and retry behavior.

### Secret Refs

The **Secret refs** tab manages encrypted Dagu-managed secret values for a selected scope. These secrets are referenced directly from DAG YAML with `secrets[].ref`.

Use it to:

- create a ref such as `prod/db-password`
- rotate the value without editing DAG YAML
- disable or enable a secret for future runs
- keep the plaintext value out of API responses and workflow files

DAGs reference Web UI-managed secrets with `ref`:

```yaml
secrets:
  - name: DB_PASSWORD
    ref: prod/db-password
```

Registry refs resolve from the DAG's own scope first, then **Global**. A DAG in `workspace=ops` checks `ops` before global. A DAG without a workspace label uses **Global** directly.

See [DAG Secret Refs](/web-ui/secrets) for the Web UI workflow and [Workflow Secrets](/writing-workflows/secrets) for the YAML reference.

## System Status

System Status shows the health of the scheduler, coordinator, and the current machine.

![Workers](/workers.webp)

This page helps you verify:

- scheduler and coordinator availability
- connected workers and all of their labels
- current CPU, memory, disk, and load trends

If you use distributed execution, this is the first place to look when workers appear missing or overloaded.

Administrators can also pause the scheduler here, which stops scheduled runs for every DAG without stopping the process. While it is paused, a banner appears on every page showing who paused it and why, so anyone can see why nothing is starting. See [Pausing the Scheduler](/writing-workflows/scheduling#pausing-the-scheduler).

## Admin Pages

Depending on your role and license, the navigation can also include pages such as:

- **Users**
- **API Keys**
- **Remote Nodes**
- **Base Config**
- **Profiles**
- **Notifications**
- **Incidents**
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
- [Wiki](/web-ui/wiki)
- [Profiles and profile-owned secrets](/web-ui/profiles)
- [Notifications](/web-ui/notifications)
- [Incident Routing](/web-ui/incidents)
- [DAG Secret Refs](/web-ui/secrets)
- [Learn the REST API](/web-ui/api)
- [Server Administration](/server-admin/)
