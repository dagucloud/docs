---
description: Learn Dagu in ten short lessons. Run workflows locally, watch them in the Web UI, and handle retries, schedules, and alerts.
---

# Dagu Tutorial

Learn the basics of Dagu in ten short lessons. Each lesson is one small workflow. Watch a recorded run on the page, run it on your machine, and change it.

Every lesson runs from the Web UI, so it works on any operating system. No Dagu knowledge is assumed.

<div class="basic-recipe-map">
  <a href="/tutorial/first-workflow"><b>01</b><span>Your first workflow · 3 min</span></a>
  <a href="/tutorial/monitoring"><b>02</b><span>Watch runs in the Web UI · 5 min</span></a>
  <a href="/tutorial/params-and-outputs"><b>03</b><span>Parameters and outputs · 4 min</span></a>
  <a href="/tutorial/actions"><b>04</b><span>Built-in actions · 4 min</span></a>
  <a href="/tutorial/control-flow"><b>05</b><span>Branch and skip · 3 min</span></a>
  <a href="/tutorial/failures-and-retries"><b>06</b><span>Failures and retries · 3 min</span></a>
  <a href="/tutorial/sub-dags"><b>07</b><span>Sub-DAGs and fan-out · 3 min</span></a>
  <a href="/tutorial/scheduling"><b>08</b><span>Schedules · 2 min</span></a>
  <a href="/tutorial/approvals"><b>09</b><span>Approvals and human input · 3 min</span></a>
  <a href="/tutorial/console-alerts"><b>10</b><span>Alerts from Dagu Console · 3 min</span></a>
</div>

## Set up (2 minutes)

### 1. Install Dagu

::: code-group

```bash [macOS/Linux]
curl -fsSL https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.sh | bash
```

```powershell [Windows]
irm https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.ps1 | iex
```

```bash [Homebrew]
brew install dagu
```

```bash [npm]
npm install -g --ignore-scripts=false @dagucloud/dagu
```

:::

Other methods, including Docker: [Installation](/getting-started/installation/).

### 2. Start Dagu

```bash
dagu start-all
```

`dagu start-all` runs the Web UI and the scheduler together. Leave this terminal running.

Open <http://localhost:8080>. On first launch, create the admin account.

On first launch, Dagu also adds six example workflows (`example-01` to `example-06`) and a `wiki` folder. They are not part of the tutorial.

::: tip If Dagu runs as a background service
If your installer set up a background service, Dagu is already running at <http://localhost:8080>. Skip `start-all`.
:::

### 3. Add each lesson's workflow

Open **Workflows**, select **New**, enter the name each lesson gives, such as `tutorial-01-first-workflow`, and select **Create**. The workflow page opens.

Select **YAML** to open the file beside the canvas, replace its text with the lesson's YAML, then select **Save**.

<a href="/tutorial/first-workflow" class="learn-more">Start with lesson 1: Your first workflow →</a>
