# Copilot

GitHub Copilot CLI brings GitHub Copilot to your terminal.

## Installation

Requires the [GitHub Copilot CLI extension](https://github.com/github/gh-copilot).

## Base Invocation

```text
copilot -p "<prompt>"
```

## Common Flags

| Flag | Type | Description |
|------|------|-------------|
| `--model` | string | Model variant |
| `--bare` | boolean | Minimal output mode |

## Example

```yaml
steps:
  - name: explain-code
    action: harness.run
    with:
      provider: copilot
      prompt: "Explain what this function does and suggest improvements"
      model: gpt-4o
```

Generated invocation:

```text
copilot -p "Explain what this function does and suggest improvements" --model gpt-4o
```

## YOLO Mode

GitHub Copilot does not have interactive approval prompts in CLI mode. When using `-p` (prompt mode), it runs non-interactively by default, making it suitable for automated workflows without additional flags.

However, if you want to ensure fully autonomous execution, use the `--auto` flag:

```yaml
steps:
  - name: auto-review
    action: harness.run
    with:
      provider: copilot
      prompt: "Review this PR for security issues"
      auto: true
```

Generated invocation:

```text
copilot -p "Review this PR for security issues" --auto
```

## See Also

- [GitHub Copilot in the CLI](https://docs.github.com/en/copilot/using-github-copilot/using-github-copilot-in-the-command-line)
- [GitHub Copilot Documentation](https://docs.github.com/en/copilot)
- [GitHub CLI Installation](https://github.com/cli/cli#installation)
