# Workspaces

Workspaces help teams focus the Web UI on the workflows, runs, and documents they use together. Use them for environments such as `ops`, `data`, `staging`, or `production`, or for teams that share one Dagu installation.

![Workspace selector](/web-ui-workspace-selector-demo.png)

## When to Use Workspaces

Use workspaces when you want to:

- keep the DAG list focused on one team or environment
- review only the runs that belong to a project
- keep generated documents grouped with the workflows that produced them
- give a user or API key access to a selected set of workflows

Workspaces are a navigation and access-control feature inside one Dagu installation. If you need hard tenant isolation, run separate Dagu deployments with separate storage and credentials.

## Selecting a Workspace

The workspace selector is in the left navigation above the remote node selector. It affects workspace-aware pages such as Cockpit, Dashboard, Definitions, Runs, Search, Design, and Docs.

| Selection | What You See |
| --- | --- |
| **All workspaces** | Everything your account can access. |
| **Default** | Workflows and documents that do not have a workspace label. |
| **Named workspace** | Only workflows, runs, and documents for that workspace. |

The selector stays on your last choice in the browser, so switching from `ops` to Docs or Runs keeps the same focus.

## Creating a Workspace

Users who can write workflows can create workspaces from the selector:

1. Open the workspace selector.
2. Choose **New workspace**.
3. Enter a short name such as `ops` or `data-platform`.
4. Press **Enter**.

Use letters, numbers, underscores, and hyphens. Avoid spaces, slashes, dots, and punctuation. The names `all` and `default` are reserved for the built-in selector choices.

## Adding Workflows to a Workspace

A workflow belongs to a named workspace when its DAG labels include `workspace=<name>`:

```yaml
name: daily-report
labels:
  - workspace=ops
  - team=platform
steps:
  - id: run
    command: ./daily-report.sh
```

After saving the DAG, select `ops` in the Web UI to see it with the matching runs and documents. A workflow with no workspace label appears under **Default**.

When you start or enqueue a workflow from Cockpit while a named workspace is selected, Dagu adds the matching workspace label to the run so it appears in the same workspace view.

## Documents in Workspaces

The Docs page follows the same workspace selector. When a workflow in `ops` writes a Markdown file to its document directory, the file appears under `ops` in Docs.

See [Documents](/web-ui/documents) for the Web UI workflow for browsing, editing, searching, and linking documents.

## Access Rules

Admins can give users and API keys access to all workspaces or selected workspaces.

- **All workspaces**: the user's normal role applies everywhere.
- **Selected workspaces**: each workspace can have its own role, such as developer in `ops` and viewer in `production`.
- **Default**: resources without a workspace label remain visible according to the user's top-level role.

Workspace access narrows what users see in list, search, and workspace-aware pages. It does not replace deployment-level isolation.

See [User Management](/server-admin/authentication/user-management) and [API Keys](/server-admin/authentication/api-keys) for the admin screens that assign workspace access.

## Deleting a Workspace

Deleting a workspace removes it from the selector. It does not delete DAG files, run history, generated documents, users, or API keys.

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

For an interactive reference, open **API Docs** in the Web UI or visit `/api-docs`.

## Related

- [Cockpit](/web-ui/cockpit)
- [Documents](/web-ui/documents)
- [User Management](/server-admin/authentication/user-management)
