# Workspaces

Workspaces organize workflows and runs inside one Dagu installation. Use them to separate workflows by team, business function, product, or operational responsibility, such as `finance`, `data-platform`, `customer-support`, or `platform-ops`.

Workspaces can also scope access, managed secrets, profile defaults, notifications, and incident routing.

![Workspace selector](/web-ui-workspace-selector-demo.png)

::: warning Workspaces Are Not Environment Boundaries
Workspaces share the same Dagu deployment, including its scheduler, local execution environment, coordinator, workers, queues, storage configuration, and Git Sync configuration. For development, staging, and production isolation, run [separate Dagu deployments](/server-admin/deployment/multi-environment).
:::

## When to Use Workspaces

Use workspaces when you want to:

- keep the DAG list focused on one team or business function
- review only the runs that belong to a project
- keep Web UI-managed secrets scoped to the workflows that use them
- route notifications to the responsible team's channels
- route incidents to the responsible team's PagerDuty or SolarWinds connections
- give a user or API key access to a selected set of workflows

Workspaces are an organizational and access-control feature inside one Dagu installation. They provide application-level scoping for several Dagu-managed resources, but they do not isolate execution infrastructure or replace deployment-level isolation.

## What Workspaces Do Not Separate

Adding `workspace=<name>` does not create an independent runtime. Workflows in every workspace still use the installation's process-level configuration.

| Concern | How to Control It |
| --- | --- |
| Local or distributed execution | Configure the deployment's `default_execution_mode` or use `worker_selector: local` on a DAG. |
| Distributed worker placement | Use [`worker_selector`](/server-admin/distributed/worker-labels) and worker labels. |
| Queue capacity and concurrency | Assign workflows to named [queues](/writing-workflows/queues). |
| Runtime variables and credentials | Use [runtime profiles](/writing-workflows/runtime-profiles) and workflow secrets. |
| Development, staging, and production isolation | Run [separate Dagu deployments](/server-admin/deployment/multi-environment). |

The scheduler loads and evaluates workflows across the deployment regardless of their workspace labels. Local runs use the same local execution environment, while distributed runs use the deployment's configured coordinator and worker pool unless the DAG applies its own worker selector.

## Selecting a Workspace

The workspace selector is in the left navigation above the remote node selector. It affects workspace-aware pages such as Cockpit, Dashboard, Definitions, Runs, Search, Design, Notifications, and Incident Routing.

| Selection | What You See |
| --- | --- |
| **All workspaces** | Everything your account can access. |
| **Default** | Workflows that do not have a workspace label. |
| **Named workspace** | Only workflows and runs for that workspace. |

The selector stays on your last choice in the browser, so switching from `finance` to Runs keeps the same focus.

## Creating a Workspace

Users who can write workflows can create workspaces from the selector:

1. Open the workspace selector.
2. Choose **New workspace**.
3. Enter a short name such as `finance` or `data-platform`.
4. Press **Enter**.

Use letters, numbers, underscores, and hyphens. Avoid spaces, slashes, dots, and punctuation. The names `all`, `default`, and `global` are reserved for built-in scopes and selector choices.

## Adding Workflows to a Workspace

A workflow belongs to a named workspace when its DAG labels include `workspace=<name>`:

```yaml
labels:
  - workspace=finance
  - team=accounting
steps:
  - id: run
    run: ./daily-report.sh
```

After saving the DAG, select `finance` in the Web UI to see it with the matching runs. A workflow with no workspace label appears under **Default**.

When you start or enqueue a workflow from Cockpit while a named workspace is selected, Dagu adds the matching workspace label to the run so it appears in the same workspace view.

## Secrets in Workspaces

The **DAG Secret Refs** tab on the **Profiles & Secrets** page supports global and workspace scopes. A Dagu-managed secret with ref `database/password` in `finance` is different from a secret with the same ref in `data-platform`.

DAGs resolve registry refs from their own workspace:

```yaml
labels:
  - workspace=finance

secrets:
  - name: DB_PASSWORD
    ref: database/password
```

Do not include the workspace name in the ref. Select the workspace in the Web UI, open **Profiles & Secrets**, create `database/password` from **DAG Secret Refs**, and use the same ref in DAGs for that workspace. Workflows without a workspace label use the **Global** secret scope.

Global secrets are workspace-less values. A workflow in `finance` checks `finance` first, then **Global**. It never reads another named workspace.

See [DAG Secret Refs](/web-ui/secrets) for the Web UI workflow and [Workflow Secrets](/writing-workflows/secrets) for the YAML reference.

## Profile Defaults in Workspaces

The **Profiles** tab on the **Profiles & Secrets** page supports workspace runtime profile defaults. These are variables and profile-owned secrets that apply automatically to DAGs in a named workspace.

A DAG in `workspace=finance` receives:

```text
Global profile defaults < finance workspace profile defaults < selected runtime profile
```

Workspace defaults are useful for baseline values that all workflows in a workspace need, such as `REGION`, internal service URLs, or team-specific credentials. They are not selectable profiles and do not apply to workflows in other workspaces.

See [Profiles](/web-ui/profiles) and [Runtime Profiles](/writing-workflows/runtime-profiles) for the full layering model.

## Notifications in Workspaces

Notification rules can be Global or workspace-scoped.

- **Global** rules are the default for every DAG.
- A named workspace can either inherit Global rules or configure its own routes.
- A DAG can still override the workspace when it needs a one-off destination.

Use workspace notification rules when each business function or team has its own Slack channel, email list, Telegram chat, or webhook endpoint. A workflow with `labels: [workspace=finance]` uses the `finance` workspace rules when they are configured; otherwise it falls back to Global.

See [Notifications](/web-ui/notifications) for the full routing model.

## Incidents in Workspaces

Incident routing can be Global or workspace-scoped.

- **Global** routing is the default for every DAG.
- A named workspace can inherit Global routing, configure its own incident routes, or turn incidents off.
- A DAG can still override the workspace from the DAG detail **Incidents** tab when it needs a one-off route.

Use workspace incident routing when each business function or team has its own PagerDuty service or SolarWinds Incident Response endpoint. A workflow with `labels: [workspace=finance]` uses the `finance` workspace incident route when it is configured; otherwise it falls back to Global.

See [Incident Routing](/web-ui/incidents) for the full routing model and license requirements.

## Access Rules

Admins can give users and API keys access to all workspaces or selected workspaces.

- **All workspaces**: the user's normal role applies everywhere.
- **Selected workspaces**: each workspace can have its own role, such as developer in `data-platform` and viewer in `finance`.
- **Default**: resources without a workspace label remain visible according to the user's top-level role.

Workspace access narrows what users see in list, search, and workspace-aware pages. It does not replace deployment-level isolation.

See [User Management](/server-admin/authentication/user-management) and [API Keys](/server-admin/authentication/api-keys) for the admin screens that assign workspace access.

## Deleting a Workspace

Deleting a workspace removes it from the selector. It does not delete DAG files, run history, users, or API keys.

Before deleting a workspace, check whether:

- any DAGs still use `workspace=<name>`
- users or API keys are scoped to that workspace

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
- [DAG Secret Refs](/web-ui/secrets)
- [Profiles](/web-ui/profiles)
- [User Management](/server-admin/authentication/user-management)
- [Multi-Environment Deployments](/server-admin/deployment/multi-environment)
