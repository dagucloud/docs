# Agent Tools Reference

Reference for all tools available to Tsumugi.

## bash

Execute shell commands.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `command` | string | Yes | | Shell command to execute |
| `timeout` | integer | No | 120 | Timeout in seconds (max: 600) |

**Output**: Combined stdout/stderr, truncated at 100,000 characters.

**Requires Approval**: Commands containing `rm `, `chmod `, or `dagu start`.

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
[Showing lines 1-2000 of 5000. Use offset=2001 to continue.]
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

**DAG Pages**:
- `/dags` - DAG list
- `/dags/<name>` - DAG details
- `/dags/<name>/spec` - DAG specification tab
- `/dags/<name>/history` - History tab
- `/dag-runs` - All DAG runs
- `/dag-runs/<name>/<run-id>` - Specific run details
- `/queues` - Queue management

**Settings Pages**:
- `/system-status`
- `/users`
- `/api-keys`
- `/webhooks`
- `/terminal`
- `/audit-logs`
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
- If `options` provided, must have 2-4 items

---

## read_schema

Look up DAG YAML schema documentation.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `schema` | string | Yes | Schema name from available schemas |
| `path` | string | No | Dot-separated path to navigate (e.g., `steps.container`) |

**Common Paths**:
- `""` (empty string) - Root-level DAG fields
- `steps` - Step configuration
- `steps.type` - Executor/step types
- `steps.container` - Container configuration
- `handler_on` - Lifecycle handlers
- `handler_on.success` - Success handler

---

## web_search

Search the internet using DuckDuckGo.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | | Search query |
| `max_results` | integer | No | 5 | Maximum results to return (max: 10) |

**Output Format**:
```
Search results for "query":

1. Title
   URL: https://example.com
   Description text here

2. Another Title
   URL: https://example.org
   More description

[Found 5 results]
```

**Timeouts**: 30 seconds per request, up to 3 retries.
