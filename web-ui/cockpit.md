# Cockpit

<video src="/cockpit-demo.mp4" controls preload="metadata" playsinline aria-label="Cockpit demo" style="width: 100%; border-radius: 8px; margin: 16px 0 24px;"></video>

A kanban view for monitoring DAG runs across dates. Available at `/cockpit` in the Web UI.

Cockpit uses the global workspace selector in the Web UI navigation. The selector is no longer part of the Cockpit toolbar.

## Page Structure

The page renders two areas:

1. **Toolbar**: template selector and DAG preview side panel
2. **Kanban board**: DAG runs grouped by date and split into status columns

## Workspace Selection

Cockpit follows the global workspace selection:

| UI label | Behavior |
|----------|----------|
| `all` | Shows DAG runs from every workspace the current identity can access, plus `default` runs. |
| `default` | Shows DAG runs with no valid `workspace=<name>` tag. |
| `<workspace>` | Shows DAG runs for that named workspace. |

The selected workspace is remembered in `localStorage` under `dagu-selected-workspace`. See [Workspaces](/web-ui/workspaces) for workspace behavior, storage, and permissions.

Switching workspace or remote node closes the open DAG preview and resets Cockpit's loaded date sections.

## Template Selector

A dropdown to browse and select a DAG definition. Selecting a DAG opens the preview side panel.

- **Search**: text input with debounce, queries `GET /api/v1/dags`
- **Tag filter**: clickable tag badges below the search input; `workspace=` tags are hidden from the filter row
- **Grouping**: DAGs are grouped by their `group` field, sorted alphabetically; ungrouped DAGs appear last under `(ungrouped)`
- **Keyboard**: `ArrowDown` and `ArrowUp` to navigate, `Enter` to select, `Escape` to close and reset filters

Each item shows:

- DAG name, with a warning icon when it has load errors
- Description, truncated to one line
- First three tags as badges, with a `+N` overflow indicator
- Parameter count, for example `3p`

## Kanban Board

DAG runs for each date are grouped into columns:

| Column | Statuses |
|--------|----------|
| Queued | `queued`, `not_started` |
| Running | `running` |
| Review | `waiting` |
| Done | `success`, `partial_success` |
| Failed | `failed`, `aborted`, `rejected` |

### Date Sections

- **Initial load**: today and yesterday
- **Infinite scroll**: scrolling to the bottom loads older days, up to 30 days back
- **Real-time updates**: today's section uses live updates; past dates use one REST fetch without polling
- **Reset**: switching workspace resets the board state

### Kanban Cards

Each card displays:

| Field | Description |
|-------|-------------|
| Name | DAG run name, truncated |
| Status | Color-coded status chip |
| Elapsed time | Formatted as `Xs`, `Xm Ys`, or `Xh Ym`; running cards update once per second |
| Parameters | First 60 characters, monospace, truncated with `...` |

Clicking a card opens the DAG Run Details modal.

## DAG Preview Side Panel

The preview side panel renders the same DAG details component used on the DAG details page. It fetches the full DAG details before rendering the start/enqueue form, so `runConfig`, defaults, and `paramDefs` metadata match the full DAG view.

When `paramDefs` is present, enqueue/start controls are rendered as typed inputs. When it is absent, the modal falls back to the raw parameter editor.

### Enqueue Behavior

When enqueueing from Cockpit:

- If a named workspace is selected, Cockpit adds `workspace=<name>` to the enqueue request tags.
- If `all` or `default` is selected, Cockpit does not add a workspace tag.
- The server merges request tags with tags defined in the DAG spec.

Cockpit only adds sanitized workspace names matching `^[A-Za-z0-9_-]+$`.

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Escape` | Close the side panel |
| `f` or `F` | Navigate to the DAG in fullscreen view (`/dags/{fileName}/spec`) |
| `Cmd/Ctrl + Click` on fullscreen button | Open in a new tab |

Shortcuts are ignored while focus is inside an input or textarea.

## Data Flow

```text
Global workspace selection
  -> localStorage: dagu-selected-workspace
  -> GET /api/v1/dags for templates
  -> GET /api/v1/dag-runs for kanban columns
```

Date bounds are sent as Unix timestamps using the configured server timezone offset.
