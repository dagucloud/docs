# AI Agent

The Dagu AI Agent is the assistant built into the Web UI. It helps create workflows, explain failures, inspect files, and automate repetitive operator tasks from inside Dagu.

![Agent Chat](/agent-modal.png)

## Where You Use It

The same agent foundation appears in three places:

- the **Web UI assistant**
- workflow steps with `type: agent`
- **Workflow Operator** integrations such as Slack and Telegram

## Quick Start

1. Open **Agent Settings** at `/agent-settings`
2. Enable the agent
3. Add at least one model and set a default
4. Open the **Agent** button in the lower-left corner of the UI

For subscription-based Codex setup, see [OpenAI Subscription](/features/agent/settings/openai-subscription).

![Agent Settings](/agent-settings-openai-codex.png)

## What The Web UI Agent Can Help With

Common uses:

- create or edit DAG YAML
- explain failed runs and logs
- suggest retries, parameter changes, or debugging steps
- navigate to the right page in Dagu
- work with local files when the tool policy allows it

## Working In Chat

### Sessions

The chat sidebar lets you reopen earlier conversations or start a new one with the **+** button.

### Current DAG Context

When you open the agent from a DAG or run page, Dagu automatically gives the assistant the relevant workflow context. You can also attach additional DAGs manually from the chat input.

### Model And Soul

In the chat composer you can override:

- the model used for the next request
- the soul (personality/instructions)

### Safe Mode

The shield toggle controls whether commands that require confirmation should stop and ask before running.

## Settings Map

Use these pages for detailed setup:

- [Settings Overview](/features/agent/settings/)
- [Models & Providers](/features/agent/settings/models)
- [Tool Permissions & Bash Policy](/features/agent/settings/controls)
- [Personality & Web Search](/features/agent/settings/behavior)

## Tool Access

Depending on your settings, the agent can work with tools such as:

- file read and edit tools
- bash command execution
- page navigation
- user prompts
- delegation to other agents or remote nodes

You control this from [Tool Permissions & Bash Policy](/features/agent/settings/controls).

## Use The Agent In Workflows

When you want the assistant to run as part of a DAG, use [`type: agent`](/features/agent/step).

Typical examples:

- generate a summary from logs
- review code or configuration
- prepare a release note or runbook update
- classify or route work before later steps

## Related Pages

- [Agent Step](/features/agent/step)
- [Memory](/features/agent/memory)
- [Souls](/features/agent/souls)
- [Tools Reference](/features/agent/tools)
- [Workflow Operator](/features/bots/)
- [Chat & AI Agents](/features/chat/)
