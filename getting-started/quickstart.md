# Quick Start

Get up and running with Dagu in under 2 minutes.

## Install Dagu

::: code-group

```bash [macOS/Linux]
# Install to ~/.local/bin (default, no sudo required)
curl -L https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.sh | bash

# Install specific version
curl -L https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.sh | bash -s -- --version v1.17.0

# Install to custom directory
curl -L https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.sh | bash -s -- --install-dir /usr/local/bin
```

```powershell [Windows]
# Install latest version to default location (%LOCALAPPDATA%\Programs\dagu)
irm https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.ps1 | iex

# Install specific version
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.ps1))) v1.24.0
```

```bash [Docker]
docker pull ghcr.io/dagu-org/dagu:latest
```

```bash [Homebrew]
brew update && brew install dagu
```

```bash [npm]
npm install -g --ignore-scripts=false @dagu-org/dagu
```

:::

See [Installation Guide](/getting-started/installation) for more options.

## AI-Assisted Workflow Authoring

If you use an AI coding tool (Claude Code, Codex, OpenCode, Gemini CLI, or Copilot CLI), you can install the Dagu skill so the AI knows how to write correct DAG YAML files:

```bash
dagu ai install

# Install only into a specific skills directory
dagu ai install --skills-dir ~/.agents/skills
```

This auto-detects installed tools and prompts you for each one. Use `--yes` to skip prompts:

```bash
dagu ai install --yes
```

If you pass one or more `--skills-dir` values, Dagu skips auto-detection and installs only into those skills directories.

After installation, your AI coding tool can generate, edit, and debug Dagu DAG definitions with knowledge of the full YAML schema, all 18+ executor types, CLI commands, and common pitfalls.

See [`dagu ai install`](/getting-started/cli#ai-install) for details on detection logic, custom skills directories, and install locations.

## Your First Workflow

::: info Example DAGs
When you first start Dagu with an empty DAGs directory, it automatically creates several example workflows to help you get started:
- `example-01-basic-sequential.yaml` - Basic sequential execution
- `example-02-parallel-execution.yaml` - Parallel task execution
- `example-03-complex-dependencies.yaml` - Complex dependency graphs
- `example-04-scheduling.yaml` - Scheduled workflows
- `example-05-nested-workflows.yaml` - Nested sub-workflows
- `example-06-container-workflow.yaml` - Container-based workflows

To skip creating these examples, set `DAGU_SKIP_EXAMPLES=true` or add `skip_examples: true` to your config file.
:::

### 1. Create a workflow

::: code-group

```bash [Binary]
mkdir -p ~/.config/dagu/dags && cat > ~/.config/dagu/dags/hello.yaml << 'EOF'
steps:
  - echo "Hello from Dagu!"
  - echo "Running step 2"
EOF
```

```bash [Docker]
mkdir -p ~/.dagu/dags && cat > ~/.dagu/dags/hello.yaml << 'EOF'
steps:
  - echo "Hello from Dagu!"
  - echo "Running step 2"
EOF
```

### 2. Run it

::: code-group

```bash [Binary]
dagu start hello
```

```bash [Docker]
docker run --rm \
  -v ~/.dagu:/var/lib/dagu \
  ghcr.io/dagu-org/dagu:latest \
  dagu start hello
```

:::

Output:
```
┌─ DAG: hello ─────────────────────────────────────────────────────┐
│ Status: Success ✓           | Started: 23:34:57 | Elapsed: 471ms │
└──────────────────────────────────────────────────────────────────┘

Progress: ████████████████████████████████████████ 100% (2/2 steps)
```

*Note: The output may vary if you are using Docker.*

### 2.5. Validate (optional)

Before running, you can validate the DAG structure without executing it:

```bash
dagu validate ~/.config/dagu/dags/hello.yaml
```

If there are issues, the command prints human‑readable errors and exits with code 1.

### 3. Check the status

::: code-group

```bash [Binary]
dagu status hello
```

```bash [Docker]
docker run --rm \
  -v ~/.dagu:/var/lib/dagu \
  ghcr.io/dagu-org/dagu:latest \
  dagu status hello
```

:::

### 4. View Execution History

Check past runs of your workflow:

::: code-group

```bash [Binary]
# View recent runs
dagu history hello

# View last 50 runs
dagu history hello --limit 50

# Export to JSON
dagu history hello --format json

# Export to CSV
dagu history hello --format csv
```

```bash [Docker]
# View recent runs
docker run --rm \
  -v ~/.dagu:/var/lib/dagu \
  ghcr.io/dagu-org/dagu:latest \
  dagu history hello
```

:::

The history command shows:
- Run ID (never truncated - safe to copy-paste)
- Status (succeeded, failed, running, etc.)
- Start time (UTC)
- Duration
- Parameters

For more filtering options, see the [CLI reference](/getting-started/cli#history).

### 5. View in the UI

::: code-group

```bash [Binary]
dagu start-all
```

```bash [Docker]
docker run -d \
  -p 8080:8080 \
  -v ~/.dagu:/var/lib/dagu \
  ghcr.io/dagu-org/dagu:latest \
  dagu start-all
```

:::

Open [http://localhost:8080](http://localhost:8080)

## Understanding Workflows

A workflow is a YAML file that defines steps and their dependencies:

```yaml
steps:
  - command: echo "First step"
  - command: echo "Second step"  # Runs after first step automatically
```

Key concepts:
- **Steps**: Individual tasks that run commands
- **Dependencies**: Control execution order
- **Commands**: Any shell command you can run

## Working Directory

By default, DAGs execute in the directory where the YAML file is located. You can override this with `working_dir`:

```yaml
# All relative paths are resolved from working_dir
working_dir: /app/project
dotenv: .env          # Loads /app/project/.env
steps:
  - command: ls -la            # Lists files in /app/project
  - command: cat ./config.yml  # Reads /app/project/config.yml
```

## Parameters

You can define parameters for workflows to make them reusable:

```yaml
# backup.yaml
params:
  - SOURCE: /data
  - DEST: /backup
  - TS: "`date +%Y%m%d_%H%M%S`"  # Command substitution

steps:
  # Backup files
  - command: tar -czf ${DEST}/backup_${TS}.tar.gz ${SOURCE}
  # Clean old backups
  - command: find ${DEST} -name "backup_*.tar.gz" -mtime +7 -delete
```

Run with parameters:

```bash
dagu start backup.yaml -- SOURCE=/important/data DEST=/backups
```

## Error Handling

Add retries and error handlers:

```yaml
steps:
  - command: curl -f https://example.com/data.zip -o data.zip
    retry_policy:
      limit: 3
      interval_sec: 30
      
  - command: echo "Unzipping data and processing"
    continue_on: failed  # Continue even if this fails (DAG ends as partially_succeeded)
      
handler_on:
  failure:
    command: echo "Workflow failed!" | mail -s "Alert" admin@example.com
  success:
    command: echo "Success at $(date)"
```

## Using Containers

Run all steps in Docker containers:

```yaml
# Using a container for all steps
container:
  image: python:3.11
  volumes:
    - ./data:/data
steps:
  # write data to a file
  - command: python -c "with open('/data/output.txt', 'w') as f: f.write('Hello from Dagu!')"
  # read data from the file
  - command: python -c "with open('/data/output.txt') as f: print(f.read())"
```

## Scheduling

Run workflows automatically:

```yaml
schedule: "0 2 * * *"  # 2 AM daily
steps:
  - command: echo "Running nightly process"
```

The workflow will execute every day at 2 AM.

## What's Next?

- [Core Concepts](/getting-started/concepts) - Understand Dagu's architecture
- [Writing Workflows](/writing-workflows/) - Learn advanced features
- [Examples](/writing-workflows/examples) - Ready-to-use workflow patterns
- [CLI Reference](/getting-started/cli) - All command options
