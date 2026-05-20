# Profiles

Profiles are the Web UI name for the built-in steward's default personality. In file paths, API fields, and workflow YAML this concept still uses `soul`.

You can create multiple profiles and switch between them from [Personality](/features/agent/settings/behavior).

## Quick Start

1. Create a Markdown file in `{DAGsDir}/souls/`.
2. Add a `name` and optional `description` in the YAML frontmatter.
3. Write the instructions you want the agent to follow in the Markdown body.
4. Open **AI agent Settings** and choose that profile as the default personality.

## What A Profile Controls

A profile is best for long-lived guidance such as:

- tone and communication style
- priorities and operating principles
- domain focus, such as operations, support, or development
- recurring house rules you want applied to new sessions

Do not use profiles for secrets, one-off tasks, or temporary instructions.

## Example Profile

Profile files are Markdown files with YAML frontmatter followed by the instructions for the steward:

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
| `name` | string | yes | Display name shown in the profile selector |
| `description` | string | no | Short note shown in lists and selectors |

The Markdown body becomes the profile's standing instructions for new sessions that use it.

## Profile IDs

The profile ID is derived from the filename without the `.md` extension:

- `default.md` → ID: `default`
- `concise-ops.md` → ID: `concise-ops`

IDs must match the pattern `[a-z0-9]+(-[a-z0-9]+)*` with a maximum of 128 characters. Only lowercase alphanumeric characters and hyphens are allowed.

## Where To Put Profile Files

```
{DAGsDir}/souls/
├── default.md
├── concise-ops.md
└── verbose-teacher.md
```

## Default Profile

A `default` soul is included so the profile selector has a sensible starting point.

When no profile is selected, or the selected profile cannot be found, AI agent falls back to the `default` soul.

## Selecting a Profile

### Via Web UI

Open **AI agent Settings** (`/agent-settings`) and use the **Default Profile** selector.

The settings behavior is documented on [Personality](/features/agent/settings/behavior).

### Via API

```bash
curl -X PATCH /api/v1/settings/agent \
  -H "Content-Type: application/json" \
  -d '{ "selectedSoulId": "concise-ops" }'
```

The selected profile takes effect on the next session creation.

## Safety Boundary

Profiles shape AI agent's identity and style, but they do not override Dagu's built-in safety rules. This means:

- You **can** customize: identity, priorities, communication style, custom guidelines
- You **cannot** override: safety rules, security policies, tool restrictions, data hygiene rules

## API Endpoints

All profile endpoints require admin role.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/settings/agent/souls` | List profiles (paginated, searchable by query) |
| POST | `/api/v1/settings/agent/souls` | Create a new profile |
| GET | `/api/v1/settings/agent/souls/{soulId}` | Get profile by ID |
| PATCH | `/api/v1/settings/agent/souls/{soulId}` | Update profile (partial) |
| DELETE | `/api/v1/settings/agent/souls/{soulId}` | Delete profile |

### Query Parameters for List

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search query (matches name, description) |
| `page` | int | Page number (default: 1) |
| `perPage` | int | Results per page (default: 50) |

## Git Sync

Profile files are synced via [Git Sync](/server-admin/git-sync) with kind `soul`. Full conflict detection, publish, and discard operations are supported.

## Example: Creating A Custom Profile

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

Then select it from [Personality](/features/agent/settings/behavior) or via the API.

## See Also

- [AI agent Overview](/features/agent/) — Chat interface and configuration
- [Personality](/features/agent/settings/behavior) — Choose the default profile in the Web UI
- [Agent Step](/features/agent/step) — Using profiles (`soul`) in DAG agent steps
- [Git Sync](/server-admin/git-sync) — Synchronizing profile files with Git
