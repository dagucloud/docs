# Agent Tools Reference

Reference for tools available to the interactive Dagu agent in the Web UI.

Provider-native web search is configured in [Personality & Web Search](/features/agent/settings/behavior) and model requests; it is not exposed as a separate callable tool. Workflow agent steps also add a step-only `output` tool and omit `navigate`, `ask_user`, and `delegate`.

## bash

Execute shell commands.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `command` | string | Yes | | Shell command to execute |
| `timeout` | integer | No | 120 | Timeout in seconds (max: 600) |

**Output**: Combined stdout/stderr, truncated at 100,000 characters.

**Policy Behavior**:
- Bash execution is controlled by the configured regex-based bash policy.
- By default, bash is allowed unless a deny rule matches.
- In interactive sessions, deny rules with `ask_user` prompt for approval when safe mode is on.
- With safe mode off, `ask_user` rules run without prompting. `block` rules still fail.
- Backticks, `$()`, heredocs, and process substitution are denied before execution.

---

## read

Read file contents with line numbers.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `path` | string | Yes | | File path (absolute or relative to working directory) |
| `offset` | integer | No | 1 | Starting line number (1-based) |
| `limit` | integer | No | 2000 | Maximum lines to read |

**Limits**:
- Maximum file size: 1MB
- Directories cannot be read (use `bash` with `ls`)

**Output Format**:
```
     1	first line
     2	second line
...
... [123 more lines, use offset=2001 to continue]
```

---

## patch

Create, edit, or delete files.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | Yes | File path |
| `operation` | string | Yes | One of: `create`, `replace`, `delete` |
| `content` | string | For `create` | Full file content |
| `old_string` | string | For `replace` | Exact text to find (must be unique in file) |
| `new_string` | string | For `replace` | Replacement text |

**Create Operation**:
- Creates parent directories automatically
- Directory permissions: 0750
- File permissions: 0600

**Replace Operation**:
- `old_string` must appear exactly once in the file
- Whitespace and indentation must match exactly

**DAG Validation**:
Files ending in `.yaml` within the DAGs directory are validated automatically after modification using `spec.LoadYAML`.

---

## think

Record reasoning without executing actions.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `thought` | string | Yes | Reasoning or planning text |

**Output**: `"Thought recorded. Continue with your plan."`

---

## navigate

Navigate the user to a UI page.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | Yes | Target path |

**Common Paths**:
- `/dags` - DAG list
- `/dags/<name>` - DAG details
- `/dags/<name>/spec` - DAG specification tab
- `/dags/<name>/history` - History tab
- `/dag-runs` - All DAG runs
- `/dag-runs/<name>/<run-id>` - Specific run details
- `/queues` - Queue management
- `/docs` - Documents page
- `/docs/<doc-id>` - Specific document

**Admin-only Pages**:
- `/users`
- `/api-keys`
- `/terminal`
- `/git-sync`
- `/agent-settings`

---

## ask_user

Prompt the user with a question.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `question` | string | Yes | | Question text |
| `options` | string[] | No | | Predefined choices (2-4 items) |
| `allow_free_text` | boolean | No | false | Enable text input field |
| `free_text_placeholder` | string | No | | Placeholder for text input |
| `multi_select` | boolean | No | false | Allow selecting multiple options |

**Constraints**:
- If `options` is provided, it must contain 2-4 items

---

## delegate

Spawn sub-agents that execute tasks in parallel.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tasks` | array | Yes | List of sub-task objects (max: 8) |
| `tasks[].task` | string | Yes | Description of the sub-task for the sub-agent |
| `tasks[].skills` | string[] | No | Skill IDs to pre-load into the sub-agent context |

Each sub-agent:
- Runs in a separate session linked to the parent via `ParentSessionID`
- Receives the same system prompt and all tools except `delegate`, `ask_user`, and `navigate`
- Does not receive the parent conversation history
- Can start with specific skills pre-loaded via `tasks[].skills`
- Executes its full tool-calling loop, then returns its last assistant text response as a summary to the parent

Sub-agents inherit the tool policy configured in agent settings. In safe mode, bash commands denied with `ask_user` behavior are also denied because the approval prompt cannot be delivered to the user.

**Concurrency**: All tasks run in parallel. If more than 8 tasks are provided, only the first 8 execute; the rest are dropped with a notice appended to the output.

**Output Format**:

The tool returns numbered summaries, one per sub-agent:

```
[1] Analyze database config: The config at /etc/app/db.yaml uses...

[2] Check disk usage: /var/log is at 78% capacity...
```

If tasks were truncated:
```
(2 additional tasks truncated — max 8 per call)
```

Task descriptions in the output are truncated to 60 characters.

**Availability**: Interactive chat only. Not available in DAG agent steps (`type: agent`). Calling `delegate` in a DAG agent step returns `"Delegate capability is not available in this context"`.

**Sub-sessions**: Each sub-agent creates a persisted session with a unique UUID. Sub-sessions are excluded from the main session list but can be retrieved individually via `GET /api/v1/agent/sessions/{delegateId}`. The tool result message includes a `delegate_ids` field referencing all sub-session IDs created by that call.

**SSE streaming**: Sub-agent messages are forwarded through the parent session's SSE stream as `delegate_messages` events. The parent also receives `delegate_event` notifications with type `started` or `completed` for each sub-agent. The frontend renders a floating panel per active sub-agent.

**Cost**: Sub-agent LLM costs are rolled up to the parent session's total cost.

**Example**:

```json
{
  "tasks": [
    {
      "task": "Read the file /opt/app/docker-compose.yaml and check if the postgres service has a health check configured"
    },
    {
      "task": "Run 'df -h' and report any filesystems above 80% usage"
    },
    {
      "task": "Read /opt/app/config/cron.yaml and verify all cron expressions are valid",
      "skills": ["linux-ops"]
    }
  ]
}
```

---

## use_skill

Load knowledge from a configured skill.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `skill_id` | string | Yes | Skill ID to load |

**Availability**: Only shown when a skill store is configured.

**Output**: The tool returns the skill knowledge wrapped in a `<skill ...>` block for the model to use in the current task.

---

## search_skills

Search configured skills by keyword or tag without loading full skill content.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | No | | Keyword matched against name, description, and tags |
| `tags` | string[] | No | | Tags that must all match |
| `page` | integer | No | 1 | Page number |
| `per_page` | integer | No | 50 | Results per page (max: 200) |

**Availability**: Only shown when a skill store is configured.

**Output**: Paginated skill summaries including ID, name, description, and tags.

---

## remote_agent

Send a task to a configured remote node.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `context` | string | Yes | Remote node name |
| `message` | string | Yes | Task or prompt to send to the remote agent |

**Availability**: Only shown when remote nodes are configured.

**Behavior**:
- Requires execute permission
- Creates a remote session and polls until completion
- Remote execution always runs in safe mode
- Returns the remote agent's final result, truncated if necessary

---

## list_contexts

List remote nodes available to `remote_agent`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name_filter` | string | No | Optional substring filter for node names |

**Availability**: Only shown when remote nodes are configured.

**Output**: A markdown list of matching node names and descriptions.
