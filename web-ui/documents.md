# Docs

Docs is Dagu's built-in Markdown workspace. Use it for operational notes, generated reports, handoff notes, and other documents that should live next to the workflows that create or use them.

![Docs page](/web-ui-documents-demo.png)

## What You Can Do

Use Docs to:

- create and edit Markdown documents in the Web UI
- browse documents by folder and workspace
- preview rendered Markdown before saving
- search Markdown content from the Docs page and global search
- publish generated Markdown from DAG steps
- keep document changes visible in Git Sync when Git Sync is enabled

Docs stores documents as files with a lowercase `.md` extension under the configured docs directory. Other file types are ignored by the Docs UI.

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

You can create or edit documents when your role allows workflow edits in the selected workspace. **All workspaces** is an aggregate view, so switch to **Default** or a named workspace before creating or moving documents.

## Creating and Editing Documents

To create a document:

1. Select **Default** or a named workspace.
2. Click the new document button in the Docs toolbar.
3. Enter a path such as `operations/deploy-checklist`.
4. Write Markdown in the editor.
5. Click **Save**.

Document paths can use folders. Good examples:

- `onboarding`
- `operations/deployment`
- `daily-report/latest-run`

Avoid leading slashes, hidden-file names, empty path segments, and file extensions. Docs adds the `.md` extension on disk.

## Preview and Search

The editor supports Markdown preview, heading outline navigation, and multiple open tabs. Use the search box in the document tree to find text across the current workspace.

Global search can also search Docs. Search results show matching snippets and can load more matches for long documents.

## Generated Docs from DAGs

Workflow steps can write Markdown files that appear in Docs automatically. Dagu exposes `DAG_DOCS_DIR` to step scripts when `paths.docs_dir` is configured. In value-resolved workflow fields, the same path is available as `${context.paths.docs_dir}`.

```yaml
name: daily-report
labels:
  - workspace=ops

steps:
  - id: write_report
    run: |
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
title: Deployment Checklist
---

## Steps

1. Pull latest changes.
2. Run migrations.
3. Deploy.
```

If no title is set, Docs uses the file name.

## Configuration

Docs uses `paths.docs_dir` as the root directory for stored Markdown files. If it is not set, Dagu defaults it to `<paths.dags_dir>/docs`.

```yaml
paths:
  docs_dir: /var/lib/dagu/docs
```

You can also set it with the environment variable:

```bash
export DAGU_DOCS_DIR=/var/lib/dagu/docs
```

For a workflow named `daily-report` in workspace `ops`, `DAG_DOCS_DIR` resolves to:

```text
<paths.docs_dir>/ops/daily-report
```

For a workflow without a workspace label, it resolves to:

```text
<paths.docs_dir>/daily-report
```

## Git Sync

Git Sync can track Markdown documents under `docs/` in the repository. A file such as `docs/ops/daily-report/latest-run.md` appears as a `doc` item in sync status.

When Git Sync is read-only, Docs remains browsable but Web UI writes are blocked.

## API Access

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
| Delete documents in bulk | `POST /api/v1/docs/delete-batch` |

Global search uses `GET /api/v1/search/docs` and `GET /api/v1/search/docs/matches`.

## Permissions

Docs uses the same access model as workspace-aware workflow pages:

- authenticated users can read documents they can access
- developers, managers, and admins can create or edit documents where workflow writing is allowed
- Git Sync read-only mode blocks Web UI document edits

See [Workspaces](/web-ui/workspaces) for workspace behavior and [Git Sync](/server-admin/git-sync) for repository-backed document workflows.

## Related

- [Workspaces](/web-ui/workspaces)
- [Runtime Context and Variables](/writing-workflows/runtime-variables)
- [Git Sync](/server-admin/git-sync)
