# Memory

The agent maintains persistent memory across sessions using Markdown files. Memory is automatically loaded into the agent's context at the start of each session, allowing it to build on previous experience.

## Scopes

Memory operates at two levels:

| Scope | File Path | Purpose |
|-------|-----------|---------|
| **Global** | `{DAGsDir}/memory/MEMORY.md` | Cross-DAG preferences, environment details, user-wide policies |
| **Per-DAG** | `{DAGsDir}/memory/dags/{dagName}/MEMORY.md` | DAG-specific config, pitfalls, fixes, debugging playbooks |

## Directory Structure

```
{DAGsDir}/memory/
├── MEMORY.md                          # Global memory
└── dags/
    ├── my-pipeline/MEMORY.md          # Per-DAG memory
    └── etl-job/MEMORY.md
```

## How It Works

1. Memory files are plain Markdown (`MEMORY.md`)
2. At session start, memory content is loaded into the system prompt
3. Only the first 200 lines of each memory file are loaded into context. If a file exceeds 200 lines, a truncation notice is appended with the full file path so the agent can read the rest using the `read` tool
4. The agent uses `read` and `patch` tools to manage memory files directly during conversation

## DAG-First Routing

The agent follows a DAG-first routing strategy when deciding where to save information:

- If DAG context is available, save to **per-DAG** memory by default (not global)
- Per-DAG memory stores: DAG-specific config assumptions, pitfalls, fixes, and debugging playbooks
- **Global** memory is reserved for cross-DAG or user-wide stable preferences and policies
- If unsure whether knowledge is global or DAG-specific, default to per-DAG
- If no DAG context is available, the agent asks before writing to global memory

## What Gets Saved

**Save:**
- Stable patterns and conventions
- Environment details
- User preferences
- Debugging insights

**Do not save:**
- Session-specific state or temporary context
- Secrets, credentials, or API keys
- Unverified or speculative information

Users can explicitly control memory:
- Say **"remember this"** to save something immediately
- Say **"forget this"** to remove it

## Agent Step Integration

Memory can be enabled in `type: agent` DAG steps:

```yaml
steps:
  - type: agent
    agent:
      memory:
        enabled: true
    messages:
      - role: user
        content: "Analyze the logs and update findings"
```

When `memory.enabled` is `true`, both global and per-DAG memory are loaded into the agent step's context. Memory is disabled by default in agent steps.

## API Endpoints

All memory endpoints require admin role.

### Global Memory

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/settings/agent/memory` | Get global memory content and list of DAGs with memory |
| PUT | `/api/v1/settings/agent/memory` | Update global MEMORY.md |
| DELETE | `/api/v1/settings/agent/memory` | Clear global memory |

### DAG-Specific Memory

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/settings/agent/memory/dags/{dagName}` | Get memory for a specific DAG |
| PUT | `/api/v1/settings/agent/memory/dags/{dagName}` | Update DAG memory |
| DELETE | `/api/v1/settings/agent/memory/dags/{dagName}` | Clear DAG memory |

## Git Sync

Memory files are synced via [Git Sync](/features/git-sync) with kind `memory`. Full conflict detection, publish, and discard operations are supported.

## See Also

- [Agent Overview](/features/agent/) — Chat interface and configuration
- [Agent Step](/features/agent/step) — Using memory in DAG agent steps
- [Git Sync](/features/git-sync) — Synchronizing memory files with Git
