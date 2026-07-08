# Workspaces

Workspaces help teams focus the Web UI on the workflows, runs, and documents they use together. Use them for environments such as `ops`, `data`, `staging`, or `production`, or for teams that share one Dagu installation.

![Workspace selector](/web-ui-workspace-selector-demo.png)

## When to Use Workspaces

Use workspaces when you want to:

- keep the DAG list focused on one team or environment
- review only the runs that belong to a project
- keep generated documents grouped with the workflows that produced them
- keep Web UI-managed secrets scoped to the workflows that use them
- route notifications to team- or environment-specific channels
- route incidents to team- or environment-specific PagerDuty or SolarWinds connections
- give a user or API key access to a selected set of workflows

Workspaces are a navigation and access-control feature inside one Dagu installation. If you need hard tenant isolation, run separate Dagu deployments with separate storage and credentials.

## Selecting a Workspace

The workspace selector is in the left navigation above the remote node selector. It affects workspace-aware pages such as Cockpit, Dashboard, Definitions, Runs, Search, Design, Docs, Notifications, and Incident Routing.

| Selection | What You See |
| --- | --- |
| **All workspaces** | Everything your account can access. |
| **Default** | Workflows and documents that do not have a workspace label. |
| **Named workspace** | Only workflows, runs, and documents for that workspace. |

The selector stays on your last choice in the browser, so switching from `ops` to Runs or Docs keeps the same focus.

## Creating a Workspace

Users who can write workflows can create workspaces from the selector:

1. Open the workspace selector.
2. Choose **New workspace**.
3. Enter a short name such as `ops` or `data-platform`.
4. Press **Enter**.

Use letters, numbers, underscores, and hyphens. Avoid spaces, slashes, dots, and punctuation. The names `all`, `default`, and `global` are reserved for built-in scopes and selector choices.

## Adding Workflows to a Workspace

A workflow belongs to a named workspace when its DAG labels include `workspace=<name>`:

```yaml
labels:
  - workspace=ops
  - team=platform
steps:
  - id: run
    run: ./daily-report.sh
```

After saving the DAG, select `ops` in the Web UI to see it with the matching runs and documents. A workflow with no workspace label appears under **Default**.

When you start or enqueue a workflow from Cockpit while a named workspace is selected, Dagu adds the matching workspace label to the run so it appears in the same workspace view.

## Docs in Workspaces

The Docs page follows the same workspace selector. When a workflow in `ops` writes a Markdown file to its docs directory, the file appears under `ops` in Docs.

For a DAG named `daily-report` with `workspace=ops`, Dagu sets `DAG_DOCS_DIR` to:

```text
<paths.docs_dir>/ops/daily-report
```

For a DAG without a workspace label, Dagu sets `DAG_DOCS_DIR` to:

```text
<paths.docs_dir>/daily-report
```

See [Docs](/web-ui/documents) for browsing, editing, searching, and generated Markdown.

## Secrets in Workspaces

The Secrets page supports global and workspace scopes. A Dagu-managed secret with ref `prod/db-password` in `ops` is different from a secret with the same ref in `production`.

DAGs resolve registry refs from their own workspace:

```yaml
labels:
  - workspace=ops

secrets:
  - name: DB_PASSWORD
    ref: prod/db-password
```

Do not include the workspace name in the ref. Select the workspace in the Web UI, create `prod/db-password` there, and use the same ref in DAGs for that workspace. Workflows without a workspace label use the **Global** secret scope.

Global secrets are workspace-less values. A workflow in `ops` checks `ops` first, then **Global**. It never reads another named workspace.

See [Secrets](/web-ui/secrets) for the Web UI workflow and [Workflow Secrets](/writing-workflows/secrets) for the YAML reference.

## Profile Defaults in Workspaces

The Profiles page supports workspace runtime profile defaults. These are variables and profile-owned secrets that apply automatically to DAGs in a named workspace.

A DAG in `workspace=ops` receives:

```text
Global profile defaults < ops workspace profile defaults < selected runtime profile
```

Workspace defaults are useful for baseline values that all workflows in a workspace need, such as `REGION`, internal service URLs, or team-specific credentials. They are not selectable profiles and do not apply to workflows in other workspaces.

See [Profiles](/web-ui/profiles) and [Runtime Profiles](/writing-workflows/runtime-profiles) for the full layering model.

## Notifications in Workspaces

Notification rules can be Global or workspace-scoped.

- **Global** rules are the default for every DAG.
- A named workspace can either inherit Global rules or configure its own routes.
- A DAG can still override the workspace when it needs a one-off destination.

Use workspace notification rules when each team or environment has its own Slack channel, email list, Telegram chat, or webhook endpoint. A workflow with `labels: [workspace=ops]` uses the `ops` workspace rules when they are configured; otherwise it falls back to Global.

See [Notifications](/web-ui/notifications) for the full routing model.

## Incidents in Workspaces

Incident routing can be Global or workspace-scoped.

- **Global** routing is the default for every DAG.
- A named workspace can inherit Global routing, configure its own incident routes, or turn incidents off.
- A DAG can still override the workspace from the DAG detail **Incidents** tab when it needs a one-off route.

Use workspace incident routing when each team or environment has its own PagerDuty service or SolarWinds Incident Response endpoint. A workflow with `labels: [workspace=ops]` uses the `ops` workspace incident route when it is configured; otherwise it falls back to Global.

See [Incident Routing](/web-ui/incidents) for the full routing model and license requirements.

## Access Rules

Admins can give users and API keys access to all workspaces or selected workspaces.

- **All workspaces**: the user's normal role applies everywhere.
- **Selected workspaces**: each workspace can have its own role, such as developer in `ops` and viewer in `production`.
- **Default**: resources without a workspace label remain visible according to the user's top-level role.

Workspace access narrows what users see in list, search, and workspace-aware pages. It does not replace deployment-level isolation.

See [User Management](/server-admin/authentication/user-management) and [API Keys](/server-admin/authentication/api-keys) for the admin screens that assign workspace access.

## Deleting a Workspace

Deleting a workspace removes it from the selector. It does not delete DAG files, run history, documents, users, or API keys.

Before deleting a workspace, check whether:

- any DAGs still use `workspace=<name>`
- users or API keys are scoped to that workspace
- documents should be moved, kept as files, or regenerated elsewhere

After deletion, update affected DAG labels and access grants so future work stays easy to find.

## API Access

Most users manage workspaces from the Web UI. Automation can use the REST API when needed:

| Action | Endpoint |
| --- | --- |
| List workspaces | `GET /api/v1/workspaces` |
| Create a workspace | `POST /api/v1/workspaces` |
| Rename or update a workspace | `PATCH /api/v1/workspaces/{workspaceId}` |
| Delete a workspace | `DELETE /api/v1/workspaces/{workspaceId}` |

For request and response details, see [REST API](/web-ui/api).

## Related

- [Cockpit](/web-ui/cockpit)
- [Notifications](/web-ui/notifications)
- [Incident Routing](/web-ui/incidents)
- [Secrets](/web-ui/secrets)
- [Profiles](/web-ui/profiles)
- [Docs](/web-ui/documents)
- [User Management](/server-admin/authentication/user-management)
