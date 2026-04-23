# Memory

Memory lets the agent keep useful long-lived context so you do not need to repeat the same background information in every conversation.

## What Memory Is Good For

Use memory for information that stays true across sessions, such as:

- team conventions
- preferred workflow patterns
- environment notes
- repeated troubleshooting advice
- per-DAG operating notes

Do not use memory for secrets, one-off instructions, or temporary session state.

## Two Memory Scopes

| Scope | Best For |
|-------|----------|
| **Global memory** | Rules or preferences that apply across many workflows |
| **Per-DAG memory** | Notes that matter only for one workflow |

As a rule, keep information as close as possible to the workflow it belongs to.

## How Users Control Memory

You can tell the agent directly:

- **"remember this"** when something should be kept
- **"forget this"** when it should be removed

When the agent is working with a specific DAG, it will usually prefer that DAG's memory rather than global memory.

## What To Save

Good examples:

- stable naming conventions
- common failure causes
- deployment caveats
- expectations for a particular workflow

Avoid saving:

- passwords, tokens, or credentials
- short-lived incident details
- guesses that have not been verified

## Reviewing And Editing Memory

Admins can review and edit agent memory from the Dagu UI and API.

| Action | Endpoint |
|--------|----------|
| View global memory | `GET /api/v1/settings/agent/memory` |
| Replace global memory | `PUT /api/v1/settings/agent/memory` |
| Clear global memory | `DELETE /api/v1/settings/agent/memory` |
| View one DAG's memory | `GET /api/v1/settings/agent/memory/dags/{dagName}` |
| Replace one DAG's memory | `PUT /api/v1/settings/agent/memory/dags/{dagName}` |
| Clear one DAG's memory | `DELETE /api/v1/settings/agent/memory/dags/{dagName}` |

## Memory In Agent Steps

You can also enable memory for workflow agent steps:

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

This is useful when a workflow should benefit from the same long-lived context as the interactive agent.

## Git Sync

If you use [Git Sync](/server-admin/git-sync), memory files can move through the same review and publish flow as DAGs and documents.

## Related Pages

- [AI Agent](/features/agent/)
- [Agent Step](/features/agent/step)
- [Git Sync](/server-admin/git-sync)
