# Souls

Souls define the agent's identity, priorities, and communication style. Each soul is a Markdown file with YAML frontmatter that gets injected into the agent's system prompt. You can create multiple souls and switch between them from Agent Settings.

## File Format

Soul files use YAML frontmatter followed by a Markdown body:

```markdown
---
name: Dagu Assistant
description: General-purpose workflow automation assistant
---

# Identity

You are Dagu Assistant, an AI assistant specialized in workflow automation
and DAG management for Dagu.

# Priorities

1. Safety: avoid unintended side effects; confirm before executing.
2. Correctness: follow Dagu schema; validate before claiming success.
3. Clarity: provide minimal, actionable steps; avoid unnecessary boilerplate.
4. No guessing: ask the user when values are unclear.

# Communication Style

- Be concise and professional.
- Avoid excessive emoji use. Prefer clean, readable text.
```

### Frontmatter Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Display name shown in the soul selector |
| `description` | string | no | Brief description of the soul's focus |

The Markdown body after the frontmatter is the soul's content. This content is injected into the `<identity>` block of the agent's system prompt.

## Soul ID

The soul ID is derived from the filename without the `.md` extension:

- `default.md` → ID: `default`
- `concise-ops.md` → ID: `concise-ops`

IDs must match the pattern `[a-z0-9]+(-[a-z0-9]+)*` with a maximum of 128 characters. Only lowercase alphanumeric characters and hyphens are allowed.

## Directory Structure

```
{DAGsDir}/souls/
├── default.md
├── concise-ops.md
└── verbose-teacher.md
```

## Default Soul

A `default` soul ships embedded in the binary and is seeded on first startup. Seeding is skipped if the souls directory already contains `.md` files or if the `.examples-created` marker file exists.

When no soul is selected, or the selected soul cannot be found, the agent falls back to the `default` soul.

## Selecting a Soul

### Via Web UI

Navigate to **Agent Settings** (`/settings/agent`) and use the soul selector dropdown in the General Settings section.

### Via API

```bash
curl -X PATCH /api/v1/settings/agent \
  -H "Content-Type: application/json" \
  -d '{ "selectedSoulId": "concise-ops" }'
```

The selected soul takes effect on the next session creation.

## Safety Boundary

Soul content populates the `<identity>` block only. The system safety rules (in the `<rules>` section of the system prompt) are always present and cannot be overridden by souls. This means:

- You **can** customize: identity, priorities, communication style, custom guidelines
- You **cannot** override: safety rules, security policies, tool restrictions, data hygiene rules

## API Endpoints

All soul endpoints require admin role.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/settings/agent/souls` | List souls (paginated, searchable by query) |
| POST | `/api/v1/settings/agent/souls` | Create a new soul |
| GET | `/api/v1/settings/agent/souls/{soulId}` | Get soul by ID |
| PATCH | `/api/v1/settings/agent/souls/{soulId}` | Update soul (partial) |
| DELETE | `/api/v1/settings/agent/souls/{soulId}` | Delete soul |

### Query Parameters for List

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search query (matches name, description) |
| `page` | int | Page number (default: 1) |
| `perPage` | int | Results per page (default: 50) |

## Git Sync

Soul files are synced via [Git Sync](/features/git-sync) with kind `soul`. Full conflict detection, publish, and discard operations are supported.

## Example: Creating a Custom Soul

Create a file `{DAGsDir}/souls/concise-ops.md`:

```markdown
---
name: Concise Ops
description: Minimal, operations-focused assistant
---

# Identity

You are a concise operations assistant for Dagu.
You focus on infrastructure, monitoring, and deployment workflows.

# Priorities

1. Brevity: give the shortest correct answer.
2. Safety: always confirm before destructive operations.
3. Ops-first: prefer operational best practices (health checks, rollbacks, resource limits).

# Communication Style

- Use bullet points over paragraphs.
- Skip pleasantries. Get to the point.
- Include command examples when relevant.
```

Then select it from Agent Settings or via the API.

## See Also

- [Agent Overview](/features/agent/) — Chat interface and configuration
- [Agent Step](/features/agent/step) — Using souls in DAG agent steps
- [Git Sync](/features/git-sync) — Synchronizing soul files with Git
