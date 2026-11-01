# Cockpit

Cockpit is a kanban-style view for monitoring workflow runs across days. It provides a quick overview of what is queued, running, waiting for review, done, or failed.

![Cockpit](/web-ui-cockpit-demo.png)

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

Each card shows the workflow name, status, elapsed time, and a short parameter preview. Click a card to peek at the run without leaving the board.

## Browsing Older Runs

Cockpit starts with recent days. Scroll down and click **Load older day** to inspect earlier activity. Today's runs update live while the page is open.

## Peeking at a Run

The peek is a side sheet over the board. It shows:

- the workflow description, schedule, and labels
- the run's status, progress, and error, if any
- a read-only graph of the workflow with the run's step states
- recent runs of the workflow; select one to show it in place
- start, stop, and retry controls for users who can run the workflow

Select **Open run** to open the run on its [workflow page](/overview/web-ui#workflow-page), on the **Artifacts** tab when the run has artifacts. On screens narrower than 768 pixels, a click on a card opens the workflow page directly.

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
| `Escape` | Close the peek. |
| `Enter` or `f` | Open the run on its workflow page. |
| `Cmd/Ctrl + Enter` | Open the run on its workflow page in a new tab. |
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
