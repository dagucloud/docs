# Cockpit

A workspace-scoped kanban view for monitoring DAG runs across dates. Available at `/cockpit` in the Web UI.

## Page Structure

The page renders two areas unconditionally:

1. **Toolbar** -- workspace selector, template selector
2. **Kanban board** -- DAG runs grouped by date, split into status columns

## Workspace Selector

A dropdown listing all workspaces by name.

- **"All workspaces"** -- deselects the workspace filter, shows all DAG runs regardless of workspace tag
- **"New workspace"** -- opens an inline text input; only visible when the current user has the `canWrite` permission (checked via `useCanWrite()` from the auth context)
- **Delete** -- trash icon next to the currently selected workspace; opens a confirmation dialog before deleting

The selected workspace name is persisted to `localStorage` under the key `dagu_cockpit_workspace`. On page load, the previously selected workspace is restored from this key.

Workspace names are sanitized on creation: characters not matching `[a-zA-Z0-9_-]` are stripped.

See [Workspaces](/features/workspaces) for the API and storage details.

## Template Selector

A dropdown to browse and select a DAG definition. Selecting a DAG opens the preview modal.

- **Search** -- text input with 300ms debounce, queries `GET /api/v1/dags` with `name` filter and `perPage=50`
- **Tag filter** -- clickable tag badges below the search input; tags with `workspace=` prefix are hidden from the filter row
- **Grouping** -- DAGs are grouped by their `group` field, sorted alphabetically; ungrouped DAGs appear last under `(ungrouped)`
- **Workspace filtering** -- when a workspace is selected, DAGs with a `workspace=X` tag that doesn't match the selected workspace are excluded; DAGs with no `workspace=` tag are always shown
- **Keyboard** -- `ArrowDown`/`ArrowUp` to navigate, `Enter` to select, `Escape` to close and reset filters

Each item shows:
- DAG name (red with warning icon if it has load errors)
- Description (truncated to one line)
- First 3 tags as badges, with `+N` overflow indicator
- Parameter count (e.g., `3p`)

## Kanban Board

DAG runs for each date are grouped into four columns:

| Column | Statuses |
|--------|----------|
| Queued | `queued`, `not_started` |
| Running | `running`, `waiting` |
| Done | `success`, `partial_success` |
| Failed | `failed`, `aborted`, `rejected` |

### Date Sections

- **Initial load** -- today and yesterday
- **Infinite scroll** -- scrolling to the bottom loads the previous day, up to 30 days back
- **Real-time updates** -- today's section uses Server-Sent Events (SSE); past dates use a single REST fetch with `refreshInterval: 0` (no polling)
- **Reset** -- switching workspaces resets to today + yesterday

### Kanban Cards

Each card displays:

| Field | Description |
|-------|-------------|
| Name | DAG run name, truncated |
| Status | Color-coded status chip with label |
| Elapsed time | Formatted as `Xs`, `Xm Ys`, or `Xh Ym`. For `running` status, a `Ticker` component re-renders every 1000ms. |
| Parameters | First 60 characters, monospace font, truncated with `...` |

Clicking a card opens the DAG Run Details modal (same modal used elsewhere in the UI, not the DAG Preview modal).

Cards use Framer Motion `layoutId` animations keyed by `dagRunId`.

## DAG Preview Modal

Opens as a side panel from the right edge, covering 3/4 of the viewport (`md:w-3/4`), full width on mobile. Slides in with a 150ms CSS transition.

The modal renders the same `DAGDetailsContent` component used on `/dags/{fileName}/spec`, with real-time SSE updates via `useDAGSSE`.

### Enqueue Behavior

When enqueueing a DAG from the preview modal, the workspace tag `workspace=<name>` is injected into the YAML spec before submission:

1. The workspace name is sanitized: `name.replace(/[^a-zA-Z0-9_-]/g, '')`
2. The tag is injected into the YAML spec using string manipulation:
   - If a `tags:` key exists with array-style values (e.g., `- tag1`), a new `- workspace=<name>` line is appended
   - If a `tags:` key exists with scalar value (e.g., `tags: "foo,bar"`), it becomes `tags: "foo,bar,workspace=<name>"`
   - If no `tags:` key exists, `tags:\n  - workspace=<name>\n` is appended to the end
3. The modified spec is submitted via `POST /api/v1/dag-runs/enqueue`

If no workspace is selected (`selectedWorkspace` is empty), the enqueue handler returns early without submitting.

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Escape` | Close the modal |
| `f` or `F` | Navigate to the DAG in fullscreen view (`/dags/{fileName}/spec`) |
| `Cmd/Ctrl + Click` on fullscreen button | Open in new tab via `window.open` |

Shortcuts are suppressed when focus is inside an input/textarea (checked via `shouldIgnoreKeyboardShortcuts()`), or when `Cmd`/`Ctrl` is held.

## Data Flow

```
Workspace selected
  -> localStorage: dagu_cockpit_workspace = <name>
  -> Tag filter: workspace=<name>
  -> GET /api/v1/dag-runs?remoteNode=<node>&tags=workspace%3D<name>&fromDate=<unix>&toDate=<unix>
  -> groupByStatus() -> Kanban columns
```

For today's date, SSE replaces polling:
```
SSE {apiURL}/events/dag-runs?remoteNode=<node>&tags=workspace%3D<name>&fromDate=<unix>&toDate=<unix>
```

The `fromDate` and `toDate` are unix timestamps representing the start and end of the day, adjusted for the configured timezone offset (`tzOffsetInSec`).
