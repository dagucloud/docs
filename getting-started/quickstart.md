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

```bash [Homebrew]
brew install dagu
```

```bash [npm]
npm install -g --ignore-scripts=false @dagucloud/dagu
```

:::

The script installers run a guided wizard for PATH setup, background service setup, and the first admin account. Homebrew, npm, and Docker install the binary only.

Full options (specific versions, custom directories, service scope, uninstall, CI/non-interactive): [Installation Guide](/getting-started/installation/).

Verify:

```bash
dagu version
```

## 2. Write your first workflow

A DAG is a YAML file. Save the following as `hello.yaml`:

```yaml
steps:
  - echo "Hello from Dagu!"
  - echo "Running step 2"
```

Steps run sequentially by default. Each step is a shell command.

## 3. Run it

```bash
dagu start hello.yaml
```

Output:

```
┌─ DAG: hello ─────────────────────────────────────────────────────┐
│ Status: Success ✓           | Started: 23:34:57 | Elapsed: 471ms │
└──────────────────────────────────────────────────────────────────┘

Progress: ████████████████████████████████████████ 100% (2/2 steps)
```

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
type: graph
steps:
  - id: extract
    command: ./extract.sh
  - id: transform_a
    command: ./transform_a.sh
    depends: extract
  - id: transform_b
    command: ./transform_b.sh
    depends: extract
  - id: load
    command: ./load.sh
    depends: [transform_a, transform_b]
```

`type: graph` enables parallel execution via `depends`. `type: chain` (the default) runs steps in the order they appear.

### Parameters

```yaml
params:
  - SOURCE: /data
  - DEST: /backup

steps:
  - command: tar -czf ${DEST}/backup.tar.gz ${SOURCE}
```

```bash
dagu start backup.yaml -- SOURCE=/important DEST=/backups
```

### Retries and error handling

```yaml
steps:
  - command: curl -f https://example.com/data.zip -o data.zip
    retry_policy:
      limit: 3
      interval_sec: 30

  - command: ./process.sh data.zip
    continue_on:
      failure: true

handler_on:
  failure:
    command: echo "run failed" | mail -s "alert" admin@example.com
  exit:
    command: rm -f data.zip
```

### Containers

Run every step in the same container:

```yaml
container:
  image: python:3.11
  volumes:
    - ./data:/data
steps:
  - command: python -c "open('/data/out.txt','w').write('hi')"
  - command: python -c "print(open('/data/out.txt').read())"
```

Or run a single step in its own container:

```yaml
steps:
  - name: build
    container:
      image: node:20-alpine
    command: npm run build
```

### Scheduling

```yaml
schedule: "0 2 * * *"      # 2 AM daily
overlap_policy: skip        # drop new runs while one is active
timeout_sec: 3600
steps:
  - command: ./nightly.sh
```

### Working directory

DAGs execute in the directory of the YAML file by default. Override with `working_dir`:

```yaml
working_dir: /app/project
dotenv: .env                 # resolved from working_dir
steps:
  - command: ls -la
```

## Next steps

- [Core Concepts](/getting-started/concepts) — steps, dependencies, execution model
- [Writing Workflows](/writing-workflows/) — full YAML surface
- [Step Types](/step-types/shell) — all 18 executors (docker, ssh, http, sql, s3, sub-DAG, …)
- [Examples](/writing-workflows/examples) — ready-to-adapt patterns
- [CLI Reference](/getting-started/cli) — every command and flag
