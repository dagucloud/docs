# Tool Permissions & Bash Policy

This page covers the `/agent-settings` controls that limit what the built-in agent is allowed to do.

## Tool Permissions

The settings page includes a **Tool Permissions** section listing the tools exposed by the built-in agent.

Each tool can be enabled or disabled individually.

This affects the built-in Web UI agent and features built on top of it, including Workflow Operator.

Examples include:

- `bash`
- `read`
- `patch`
- `think`
- `navigate`
- `ask_user`
- `delegate`

The exact tool list is loaded from the backend. Remote-node tools only appear when remote nodes are configured.

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

Rules are evaluated top-down. Each rule includes:

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

It splits the command into executable segments and checks rules against each segment. The first matching rule for a segment decides the result for that segment.

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

## Relationship to Safe Mode

Safe mode is not configured on `/agent-settings`.

It is a runtime control in the interactive chat UI and in bot request handling.

When a bash command is denied:

- `On Deny = Block` always blocks it
- `On Deny = Ask User` triggers approval only when safe mode is on and an approval UI is available
- If safe mode is off, `Ask User` behaves like allow in interactive sessions

For workflow `type: agent` steps, there is no approval UI, so denied bash commands fail instead of prompting.

## Practical Guidance

- Start by disabling tools you know the agent should never use
- Keep bash rules small and explicit
- Put narrow allow or deny rules above broader ones
- Use `Block` for commands that should never run, even with human approval

## See Also

- [Agent Settings](/features/agent/settings/)
- [Models & Providers](/features/agent/settings/models)
- [Tools Reference](/features/agent/tools)
- [Agent Step](/features/agent/step)
