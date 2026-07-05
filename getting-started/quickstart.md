# Quickstart

From zero to a running workflow in under five minutes.

## 1. Install

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

```bash
dagu version
```

## 2. Write your first workflow

A DAG is a YAML file. Save the following as `hello.yaml`:

```yaml
steps:
  - id: hello
    run: echo "Hello from Dagu!"
  - id: step_2
    run: echo "Running step 2"
    depends: hello
```

## 3. Run it

```bash
dagu start hello.yaml
```

Output:

```
Succeeded - 2026-04-24T15:23:07+09:00

dag: hello (0s)
├─log: .../logs/hello/.../dag-run....log
│
├─cmd_1 (0s) [succeeded]
│ ├─echo "Hello from Dagu!"
│ │
│ └─stdout: .../cmd_1....out
│     Hello from Dagu!
│
└─cmd_2 (0s) [succeeded]
  ├─echo "Running step 2"
  │
  └─stdout: .../cmd_2....out
      Running step 2

Result: Succeeded
```

Timestamp, duration, and log paths vary by run.

Other useful commands:

```bash
dagu validate hello.yaml   # Check syntax without running
dagu dry hello.yaml        # Show execution plan
dagu status hello          # Last run status
dagu history hello         # Recent runs
```

Run with Docker instead:

```bash
mkdir -p ~/.dagu/dags && cp hello.yaml ~/.dagu/dags/
docker run --rm -v ~/.dagu:/var/lib/dagu ghcr.io/dagucloud/dagu:latest \
  dagu start hello
```

## 4. Open the web UI

```bash
dagu start-all
```

Visit <http://localhost:8080>. The UI shows live run status, logs per step, execution history, and a YAML editor.

On first launch against an empty DAGs directory (`~/.config/dagu/dags/`), Dagu creates a set of example workflows (`example-01-basic-sequential.yaml` through `example-06-container-workflow.yaml`). Set `DAGU_SKIP_EXAMPLES=true` or `skip_examples: true` in `config.yaml` to disable.

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

- [Core Concepts](/getting-started/concepts) — steps, dependencies, execution model
- [Deployment Models](/overview/deployment-models) — local, self-hosted, managed, and hybrid options
- [Writing Workflows](/writing-workflows/) — full YAML surface
- [Step Types](/step-types/shell) — built-in executors (docker, ssh, http, wait, sql, s3, sub-DAG, ...)
- [Examples](/writing-workflows/examples) — ready-to-adapt patterns
- [CLI Reference](/getting-started/cli) — every command and flag
- [MCP Quickstart](/mcp/quickstart) — connect external AI tools to a running Dagu server
- [MCP Server](/mcp/) — connect MCP-capable clients to a running Dagu server
