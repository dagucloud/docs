# Cockpit

Cockpit is a kanban-style view for monitoring workflow runs across days. It provides a quick overview of what is queued, running, waiting for review, done, or failed.

![Cockpit](/cockpit.png)

<video src="/cockpit-demo.mp4" poster="/cockpit-demo-poster.jpg" controls preload="none" playsinline aria-label="Cockpit demo" style="width: 100%; border-radius: 8px; margin: 16px 0 24px;"></video>

## Opening Cockpit

Open **Overview** from the left navigation and select the **Cockpit** tab, or visit `/cockpit`. Overview reopens the tab you used last.

The page follows the global workspace selector:

| Selection | What Cockpit Shows |
| --- | --- |
| **All workspaces** | Runs from every workspace you can access. |
| **Default** | Runs from workflows without a workspace label. |
| **Named workspace** | Runs from that workspace only. |

Switching workspaces refreshes the board so you can focus on one team, environment, or project.

## Board Layout

Cockpit groups runs by date and status:

| Column | Meaning |
| --- | --- |
| **Queued** | Runs waiting to start. |
| **Running** | Runs currently executing. |
| **Review** | Local or distributed root runs paused for approval or human-task input. Open the run and complete the generated form in its **Actions** tab. |
| **Done** | Successful or partially successful runs. |
| **Failed** | Failed, aborted, or rejected runs. |

Each card shows the workflow name, status, elapsed time, and a short parameter preview. Click a card to open the run over the board without leaving it.

## Browsing Older Runs

Cockpit starts with recent days. Scroll down and click **Load older day** to inspect earlier activity. Today's runs update live while the page is open.

## Opening a Run

A click on a card opens the run on its [workflow page](/overview/web-ui#workflow-page) over the board, on the **Artifacts** tab when the run has artifacts. The page has the run's steps, logs, outputs, and run controls. The board stays below, and the browser's Back button or the close button returns to it. **Open workflow** keeps the workflow page as the page. On screens narrower than 768 pixels, a click on a card opens the workflow page directly.

## Starting a Workflow from Cockpit

Use the template selector at the top of the page to find a workflow:

1. Click **Select template**.
2. Search by workflow name or browse grouped workflows.
3. Select a workflow to open its workflow page.
4. Click **Start**, review parameters, and choose **Start** or **Enqueue**.

The template list follows the workspace selector, and the workflow page opens in the selected workspace.

Typed parameters in the start dialog render as friendly controls such as text inputs, selects, number fields, and toggles. Workflows without typed parameter metadata use the raw parameter editor.

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `Escape` | Return to the board, once the workflow page has nothing left to close. |
| `Cmd/Ctrl + Click` on a card | Open the run on its workflow page in a new tab. |

Shortcuts are ignored while you are typing in an input or textarea.

## Tips

- Use workspaces to keep the board from mixing unrelated teams or environments.
- Use labels on workflows to make the template selector easier to scan.
- Open a run when you need logs, step status, outputs, artifacts, or retry controls.

## Related

- [Web UI Overview](/overview/web-ui)
- [Workspaces](/web-ui/workspaces)
- [Workflow Page](/overview/web-ui#workflow-page)
