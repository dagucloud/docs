---
description: Learn Dagu in about 35 minutes. Nine short lessons, each one small workflow you can watch run in the browser, then run on your own machine.
---

# Dagu Tutorial

Learn the basics of Dagu in about 35 minutes. Each lesson is one small workflow. Watch a recorded run of it on the page, then run it yourself and change it.

You need a terminal and basic shell skills. No Dagu knowledge is assumed.

<div class="basic-recipe-map">
  <a href="/tutorial/first-workflow"><b>01</b><span>Your first workflow · 4 min</span></a>
  <a href="/tutorial/monitoring"><b>02</b><span>Watch runs in the Web UI · 5 min</span></a>
  <a href="/tutorial/params-and-outputs"><b>03</b><span>Parameters and outputs · 4 min</span></a>
  <a href="/tutorial/actions"><b>04</b><span>Built-in actions · 4 min</span></a>
  <a href="/tutorial/control-flow"><b>05</b><span>Branch, skip, and poll · 4 min</span></a>
  <a href="/tutorial/failures-and-retries"><b>06</b><span>Failures and retries · 4 min</span></a>
  <a href="/tutorial/sub-dags"><b>07</b><span>Sub-DAGs and fan-out · 4 min</span></a>
  <a href="/tutorial/scheduling"><b>08</b><span>Schedules · 3 min</span></a>
  <a href="/tutorial/approvals"><b>09</b><span>Approvals and human input · 3 min</span></a>
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

### 2. Start Dagu in a tutorial folder

```bash
mkdir dagu-tutorial && cd dagu-tutorial
dagu start-all --dags .
```

`start-all` runs the Web UI and the scheduler together. `--dags .` tells Dagu to load every workflow file in this folder. Leave it running, and open a second terminal in the same folder for the lessons.

Open <http://localhost:8080>. On first launch, create the admin account.

In an empty folder, Dagu also adds six example workflows, `example-01` to `example-06`, and a `wiki` folder. They are not part of the tutorial. Keep or delete them.

::: tip Dagu already runs as a service?
If the installer set up a background service, Dagu is already at <http://localhost:8080>. Skip `start-all` and run the lesson commands from its DAGs folder instead, `~/.config/dagu/dags` by default.
:::

### 3. Get each lesson's workflow

Every lesson starts with one command that downloads its workflow into the current folder, for example:

```bash
curl -fsSLO https://docs.dagu.sh/tutorial/dags/tutorial-01-first-workflow.yaml
```

The workflow appears in the Web UI under **Workflows** right away. You can also create a workflow in the Web UI and paste the YAML from the lesson page.

<a href="/tutorial/first-workflow" class="learn-more">Start with lesson 1: Your first workflow →</a>
