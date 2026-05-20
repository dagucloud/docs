# Tool Permissions, Web Search & Bash Policy

This page covers the `/agent-tools` controls that limit which tools Dagu's agent may use and how bash commands are filtered.

The global policy applies to:

- the Web UI AI agent
- the `dagu agent` CLI session
- Workflow Operator sessions for Slack, Telegram, Discord, and LINE
- workflow steps that run `action: agent.run`

Workflow `action: agent.run` steps expose a narrower runtime tool set than interactive sessions. They can narrow that list further with `with.tools.enabled` and can override bash policy fields with `with.tools.bash_policy`, but they cannot re-enable a tool that the global policy disables.

## Web Search Backend

The **Web Search Backend** section controls whether agent sessions get web access.

The current UI values are:

- `Model Web Search`: provider-native search, when the selected model provider supports it
- `Tavily`: hosted search and extraction tools
- `Firecrawl`: hosted search and extraction tools

For `Model Web Search`, the UI can set an optional max-use limit per request.

For `Tavily` and `Firecrawl`, the UI stores the provider API key status and backend options. Hosted backends expose the callable `web_search` and `web_extract` tools only when the backend is enabled and configured. Those tools are still subject to **Tool Permissions**.

## Tool Permissions

The page includes a **Tool Permissions** section listing registered agent tools.

Each tool can be enabled or disabled individually.

Disabling a tool removes it from interactive agent sessions and prevents workflow `action: agent.run` steps from using it.

Examples include:

- `bash`
- `read`
- `patch`
- `think`
- `navigate`
- `ask_user`
- `delegate`
- `dag_def_manage`
- `dag_run_manage`
- `runbook_manage`
- `remote_agent`
- `list_contexts`
- `web_search`
- `web_extract`

The exact tool list is loaded from the backend. Some tools are listed because they are registered, but are only available at runtime when their dependency is configured. For example, remote-agent tools require a remote context resolver, and hosted web tools require a configured Tavily or Firecrawl backend.

See [Tools Reference](/features/agent/tools) for what each tool does.

## Bash Command Policy

Inside **Tool Permissions**, the settings page includes a **Bash Command Policy** section.

This policy is checked before the `bash` tool runs.

### Main Controls

| Setting | Meaning |
|---|---|
| `No Match Behavior` | What happens when no enabled regex rule matches a command segment |
| `On Deny` | Whether denied commands are hard-blocked or sent through the approval flow |

The current UI values are:

- `No Match Behavior`: `Allow` or `Deny`
- `On Deny`: `Ask User` or `Block`

### Ordered Rules

Rules are evaluated top-down. Disabled rules are skipped. Each rule includes:

- `Name`
- `Regex Pattern`
- `Action` (`allow` or `deny`)
- `Enabled`

The current UI also lets you:

- Add a rule
- Move a rule up
- Move a rule down
- Remove a rule

## How Matching Works

The backend does not evaluate the entire shell string as one blob.

It splits the command into executable segments and checks rules against each segment. Segment boundaries include semicolons, newlines, pipes, `&&`, `||`, and `&`. The first matching enabled rule for a segment decides the result for that segment.

If no rule matches:

- `No Match Behavior = Allow` lets that segment continue
- `No Match Behavior = Deny` denies that segment

If any segment is denied, the command is denied.

## Unsupported Shell Constructs

Some shell constructs are denied before regex rules are applied.

The current policy code rejects commands that use:

- Backticks: `` `...` ``
- `$()` command substitution
- Heredocs
- Process substitution such as `<(...)` or `>(...)`

This is intentional because the policy matcher is not a full shell parser.

## Relationship to Safe Mode and Workflows

Safe mode is not configured on `/agent-settings` or `/agent-tools`.

It is a runtime control in the interactive chat UI and in bot request handling.

When a bash command is denied:

- `On Deny = Block` always blocks it
- `On Deny = Ask User` triggers approval only when safe mode is on and the session has an approval handler
- if safe mode is off, `Ask User` behaves like allow in interactive sessions

For workflow `action: agent.run` steps, denied bash commands fail instead of prompting. In workflow steps, `deny_behavior: ask_user` is effectively a block because there is no command-approval handler.

## Practical Guidance

- Start by disabling tools you know the agent should never use
- Keep bash rules small and explicit
- Put narrow allow or deny rules above broader ones
- Use `Block` for commands that should never run, even with human approval

## See Also

- [AI agent Settings](/features/agent/settings/)
- [Models & Providers](/features/agent/settings/models)
- [Web Search](/features/agent/web-search)
- [Tools Reference](/features/agent/tools)
- [Agent Step](/features/agent/step)
