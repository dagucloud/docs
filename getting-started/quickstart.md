---
description: Install Dagu and run your first YAML workflow in under five minutes with the CLI, web UI, Docker, npm, or Homebrew.
---

# Quickstart

From zero to a running workflow in under five minutes.

## 1. Install

::: tip Prefer a desktop app?
[Kitewell](https://kitewell.app/) is a separate app for running workflows on your own Mac or Windows PC without the command line.
:::

::: code-group

```bash [macOS/Linux]
curl -fsSL https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.sh | bash
```

```powershell [Windows]
irm https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.ps1 | iex
```

```bash [Docker]
docker pull ghcr.io/dagucloud/dagu:latest
```

```bash [npm]
npm install -g --ignore-scripts=false @dagucloud/dagu
```

```bash [Homebrew]
brew install dagu
```

:::

The script installers run a guided wizard for PATH setup, background service setup, and the first admin account. Homebrew, npm, and Docker install the binary or container only.

Full options (specific versions, custom directories, service scope, uninstall, CI/non-interactive): [Installation Guide](/getting-started/installation/).

Verify:

::: code-group

```bash [Installed binary]
dagu version
```

```bash [Docker]
docker run --rm ghcr.io/dagucloud/dagu:latest dagu version
```

:::

## 2. Write your first workflow

A DAG is a YAML file. In an empty folder, save the following as `hello.yaml`:

```yaml
steps:
  - id: hello
    run: echo "Hello from Dagu!"
  - id: step_2
    run: echo "Running step 2"
    depends: hello
```

## 3. Run it

::: code-group

```bash [Installed binary]
dagu start hello.yaml
```

```bash [Docker]
mkdir -p ~/.dagu/dags
cp hello.yaml ~/.dagu/dags/
docker run --rm \
  -v ~/.dagu:/var/lib/dagu \
  ghcr.io/dagucloud/dagu:latest \
  dagu start hello
```

:::

Output:

```
Succeeded - 2026-04-24T15:23:07+09:00

dag: hello (0s)
├─log: .../logs/hello/.../dag-run....log
│
├─hello (0s) [succeeded]
│ ├─echo "Hello from Dagu!"
│ │
│ └─stdout: .../hello....out
│     Hello from Dagu!
│
└─step_2 (0s) [succeeded]
  ├─echo "Running step 2"
  │
  └─stdout: .../step_2....out
      Running step 2

Result: Succeeded
```

Timestamp, duration, and log paths vary by run.

Other useful commands:

::: code-group

```bash [Installed binary]
dagu validate hello.yaml   # Check syntax without running
dagu dry hello.yaml        # Show execution plan
dagu status hello          # Last run status
dagu history hello         # Recent runs
```

```bash [Docker]
docker run --rm -v ~/.dagu:/var/lib/dagu ghcr.io/dagucloud/dagu:latest dagu validate hello
docker run --rm -v ~/.dagu:/var/lib/dagu ghcr.io/dagucloud/dagu:latest dagu dry hello
docker run --rm -v ~/.dagu:/var/lib/dagu ghcr.io/dagucloud/dagu:latest dagu status hello
docker run --rm -v ~/.dagu:/var/lib/dagu ghcr.io/dagucloud/dagu:latest dagu history hello
```

:::

## 4. Open the web UI

::: code-group

```bash [Installed binary]
dagu start-all --dags .
```

```bash [Docker]
docker run --rm \
  -v ~/.dagu:/var/lib/dagu \
  -p 8080:8080 \
  ghcr.io/dagucloud/dagu:latest \
  dagu start-all
```

:::

Visit <http://localhost:8080>. On first launch, create the admin account unless the installer wizard already created one. Open a workflow from **Workflows** to see its graph with live step status, its run history, and logs per step, and to edit it visually or as YAML.
The `--dags .` flag loads every YAML file in the current folder as a workflow, which is why `hello.yaml` lives in an empty folder.

If the script installer set up the background service, Dagu is already running at <http://localhost:8080>. Add workflows from the UI, or copy `hello.yaml` into the DAGs directory the installer printed, instead of starting a second server.

On first launch against an empty DAGs directory, Dagu creates six example workflows (`example-01-basic-sequential.yaml` through `example-06-retry-on-failure.yaml`). The first attempt of `example-06-retry-on-failure` fails and a retry succeeds, which shows how a step recovers from a flaky dependency. The default binary directory is `~/.config/dagu/dags/`; the Docker commands above mount `~/.dagu/dags/` at `/var/lib/dagu/dags/`. Set `DAGU_SKIP_EXAMPLES=true` or `skip_examples: true` in `config.yaml` to disable the examples.

## Core pieces

### Dependencies

```yaml
steps:
  - id: extract
    run: ./extract.sh

  - id: transform_a
    run: ./transform_a.sh
    depends: extract

  - id: transform_b
    run: ./transform_b.sh
    depends: extract

  - id: load
    run: ./load.sh
    depends: [transform_a, transform_b]
```

### Parameters

```yaml
params:
  - SOURCE: /data
  - DEST: /backup

steps:
  - run: tar -czf ${params.DEST}/backup.tar.gz ${params.SOURCE}
```

```bash
dagu start backup.yaml -- SOURCE=/important DEST=/backups
```

### Retries and error handling

```yaml
steps:
  - id: download
    run: curl -f https://example.com/data.zip -o data.zip
    retry_policy:
      limit: 3
      interval_sec: 30

  - id: process
    run: ./process.sh data.zip
    continue_on:
      failure: true
    depends: download

handler_on:
  failure:
    run: echo "run failed" | mail -s "alert" admin@example.com
  exit:
    run: rm -f data.zip
    depends: download
```

### Containers

::: warning Docker installation
If Dagu itself runs in Docker, the earlier Docker command cannot create
container steps until you
[mount the host Docker socket](/getting-started/installation/docker#run-container-steps-when-dagu-runs-in-docker).
:::

Run every step in the same container:

```yaml
container:
  image: python:3.11
  volumes:
    - ./data:/data
steps:
  - id: write_file
    run: python -c "open('/data/out.txt','w').write('hi')"
  - id: read_file
    run: python -c "print(open('/data/out.txt').read())"
    depends: write_file
```

Or run a single step in its own container:

```yaml
steps:
  - name: build
    container:
      image: node:20-alpine
    run: npm run build
```

### Scheduling

```yaml
schedule: "0 2 * * *"      # 2 AM daily
overlap_policy: skip        # drop new runs while one is active
timeout_sec: 3600
steps:
  - run: ./nightly.sh
```

### Working directory

DAGs execute in the directory of the YAML file by default. Override with `working_dir`:

```yaml
working_dir: /app/project
dotenv: .env                 # resolved from working_dir
steps:
  - run: ls -la
```

## Next steps

- [Tutorial](/tutorial/): nine short hands-on lessons on monitoring, actions, control flow, sub-DAGs, and more
- [Core Concepts](/getting-started/concepts): steps, dependencies, and execution model
- [Deployment Models](/overview/deployment-models): single server, temporary workers, and distributed workers
- [Writing Workflows](/writing-workflows/): full YAML surface
- [Step Types](/step-types/shell): built-in executors (docker, ssh, http, wait, sql, s3, sub-DAG, and more)
- [Examples](/writing-workflows/examples): ready-to-adapt patterns
- [CLI Reference](/getting-started/cli): every command and flag
- [MCP Quickstart](/mcp/quickstart): connect external AI tools to a running Dagu server
- [MCP Server](/mcp/): connect MCP-capable clients to a running Dagu server
- [Monitoring](/overview/console-monitoring): get an email when a workflow fails or a server stops reporting
