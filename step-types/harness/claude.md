# Claude Code

[Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview) is Anthropic's agentic coding tool that lets you collaborate with Claude directly from your terminal.

## Installation

See the [official installation guide](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview).

For containerized Dagu runs, see [Run Claude Code in a Container](./sandbox/claude-code).

## Base Invocation

```text
claude -p "<prompt>"
```

## Common Flags

Any `with` key other than the reserved keys `prompt`, `stdin`, `provider`, `fallback`, `managed`, and `acp_permission` is passed as a CLI flag. Snake-case keys are normalized to kebab-case.

| Flag | Type | Description |
|------|------|-------------|
| `--model` | string | Model variant (e.g. `sonnet`, `opus`) |
| `--bare` | boolean | Minimal mode: skips hooks, LSP, plugin sync, auto-memory, `CLAUDE.md` discovery, and keychain reads |
| `--max-turns` | number | Maximum tool-calling iterations |

`bare: true` skips keychain reads, so a subscription login is not visible to the
step and the run fails with `Not logged in · Please run /login`. Use it only
when the credential comes from `ANTHROPIC_API_KEY` in the step environment.

## Example

```yaml
steps:
  - name: review-pr
    action: harness.run
    with:
      provider: claude
      prompt: |
        Review the current branch for bugs and style issues
      model: sonnet
```

Generated invocation:

```text
claude -p "Review the current branch for bugs and style issues" --model sonnet
```

## YOLO Mode

By default, Claude Code asks for approval before running commands. In a Dagu workflow this is not possible, so you should run in non-interactive mode:

```yaml
steps:
  - name: auto-refactor
    action: harness.run
    with:
      provider: claude
      prompt: |
        Refactor the auth module
      dangerously_skip_permissions: true
```

Generated invocation:

```text
claude -p "Refactor the auth module" --dangerously-skip-permissions
```

**Warning:** This skips all safety checks. Only use in isolated or trusted environments.

## Push-back

A [human task](/writing-workflows/human-tasks#requesting-changes) after a Claude Code step lets a reviewer send the work back:

```yaml
steps:
  - id: implement
    action: harness.run
    with:
      provider: claude
      prompt: |
        Implement the requested feature
      model: opus

  - id: review
    depends: [implement]
    action: human.task
    with:
      prompt: Review the implementation
      push_back:
        rewind_to: implement
        form:
          type: object
          required: [feedback]
          properties:
            feedback:
              type: string
```

On push-back, the prompt is augmented with reviewer feedback and the previous stdout log path. See [Agent Loops](/ai/loops/) for repeating the step until a check passes and for review workflows.

## See Also

- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference.md): Complete flag reference
- [Permission Modes](https://code.claude.com/docs/en/permission-modes.md): How approval and YOLO mode work
- [Environment Variables](https://code.claude.com/docs/en/env-vars.md): `CLAUDE_CODE_*` environment variables
- [Common Workflows](https://code.claude.com/docs/en/common-workflows.md): Example prompts and patterns
- [Settings](https://code.claude.com/docs/en/settings.md): Global and project-level configuration
