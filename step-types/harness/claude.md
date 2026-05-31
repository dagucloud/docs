# Claude Code

[Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview) is Anthropic's agentic coding tool that lets you collaborate with Claude directly from your terminal.

## Installation

See the [official installation guide](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview).

## Base Invocation

```text
claude -p "<prompt>"
```

## Common Flags

Any `with` key other than `provider` and `fallback` is passed as a CLI flag. Snake-case keys are normalized to kebab-case.

| Flag | Type | Description |
|------|------|-------------|
| `--model` | string | Model variant (e.g. `sonnet`, `opus`) |
| `--bare` | boolean | Minimal output mode |
| `--max-turns` | number | Maximum tool-calling iterations |

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
      bare: true
```

Generated invocation:

```text
claude -p "Review the current branch for bugs and style issues" --bare --model sonnet
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

## Approval Push-back

When combined with Dagu's approval gates, Claude Code steps can be reviewed and iterated:

```yaml
steps:
  - id: implement
    action: harness.run
    with:
      provider: claude
      prompt: |
        Implement the requested feature
      model: opus
    approval:
      prompt: "Review the implementation"
      input: [FEEDBACK]
```

On push-back, the prompt is augmented with reviewer feedback and the previous stdout log path.

## See Also

- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference.md) — Complete flag reference
- [Permission Modes](https://code.claude.com/docs/en/permission-modes.md) — How approval and YOLO mode work
- [Environment Variables](https://code.claude.com/docs/en/env-vars.md) — `CLAUDE_CODE_*` env vars
- [Common Workflows](https://code.claude.com/docs/en/common-workflows.md) — Example prompts and patterns
- [Settings](https://code.claude.com/docs/en/settings.md) — Global and project-level configuration
