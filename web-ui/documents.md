# Documents

Docs is a built-in Markdown workspace for runbooks, reports, handoff notes, and workflow-generated pages. You can browse, edit, preview, rename, move, delete, and search documents from the Web UI.

![Documents page](/web-ui-documents-demo.png)

## What You Can Do

Use Docs to:

- keep operational runbooks next to the workflows that use them
- publish Markdown reports from DAG steps
- search workflow notes and generated summaries
- reference documents from the AI agent with `@` mentions
- edit Markdown without leaving the Web UI

Docs works best for text that should stay close to Dagu workflows. Use a separate knowledge base for broad company documentation.

## Opening Docs

Open **Docs** from the left navigation. The page has two main areas:

- **Document tree**: folders and Markdown files, with search and outline controls.
- **Editor and preview**: open one or more documents, edit Markdown, preview the rendered page, and save changes.

The page follows the global workspace selector:

| Workspace Selection | What Docs Shows |
| --- | --- |
| **All workspaces** | Documents from every workspace you can access. |
| **Default** | Documents not tied to a named workspace. |
| **Named workspace** | Documents for that workspace only. |

You can create or edit documents when your role allows workflow edits in the selected workspace. **All workspaces** is a read-focused aggregate view, so switch to **Default** or a named workspace before creating or moving documents.

## Creating and Editing Documents

To create a document:

1. Select **Default** or a named workspace.
2. Click the new document button in the Docs toolbar.
3. Enter a path such as `runbooks/deploy-checklist`.
4. Write Markdown in the editor.
5. Click **Save**.

Document paths can use folders. Good examples:

- `onboarding`
- `runbooks/deployment`
- `daily-report/latest-run`

Avoid leading slashes, hidden-file names, and empty path segments.

## Preview and Search

The editor supports Markdown preview, heading outline navigation, and multiple open tabs. Use the search box in the document tree to find text across the current workspace.

The preview supports common Markdown features, including tables and diagrams rendered by the docs viewer.

## Generated Documents from DAGs

Workflow steps can write Markdown files that appear in Docs automatically. Dagu exposes `DAG_DOCS_DIR` to steps when document management is configured.

```yaml
name: daily-report
labels:
  - workspace=ops
steps:
  - id: write_report
    command: |
      mkdir -p "$DAG_DOCS_DIR"
      cat > "$DAG_DOCS_DIR/latest-run.md" <<'DOC'
      ---
      title: Daily Report
      ---

      ## Summary

      All scheduled checks completed successfully.
      DOC
```

In the Web UI, select the `ops` workspace and open **Docs**. The generated file appears as `daily-report/latest-run`.

For workflows without a workspace label, generated documents appear under **Default**.

## Document Titles

Add a `title` field in Markdown frontmatter when you want a friendly display name:

```markdown
---
title: Deployment Runbook
---

## Steps

1. Pull latest changes.
2. Run migrations.
3. Deploy.
```

If no title is set, Docs uses the file name.

## Agent Integration

The AI agent can use documents as context:

1. Open the agent chat.
2. Type `@`.
3. Select a document from the picker.
4. Ask the agent to explain, summarize, or apply the document.

The picker follows the current workspace, so users see only documents available to them.

## Automation

Most document work happens in the Web UI, but automation can use the REST API:

| Action | Endpoint |
| --- | --- |
| List documents | `GET /api/v1/docs` |
| Search documents | `GET /api/v1/docs/search` |
| Read a document | `GET /api/v1/docs/doc` |
| Create a document | `POST /api/v1/docs` |
| Update a document | `PATCH /api/v1/docs/doc` |
| Delete a document | `DELETE /api/v1/docs/doc` |
| Rename or move a document | `POST /api/v1/docs/doc/rename` |

Open **API Docs** in the Web UI for request fields, response examples, and interactive testing.

## Permissions

Docs uses the same access model as workspace-aware workflow pages:

- authenticated users can read documents they can access
- developers, managers, and admins can create or edit documents where workflow writing is allowed
- Git Sync read-only mode blocks Web UI document edits

See [Workspaces](/web-ui/workspaces) for workspace behavior and [Git Sync](/server-admin/git-sync) for repository-backed document workflows.

## Related

- [Workspaces](/web-ui/workspaces)
- [Runtime Variables](/writing-workflows/runtime-variables)
- [Git Sync](/server-admin/git-sync)
- [Agent Overview](/features/agent/)
