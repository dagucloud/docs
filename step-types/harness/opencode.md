# OpenCode

[OpenCode](https://opencode.ai) is an open-source AI coding agent.

## Installation

See the [OpenCode installation guide](https://opencode.ai).

For containerized Dagu runs, see [Run OpenCode in a Container](./sandbox/opencode).

## Base Invocation

```text
opencode run "<prompt>"
```

## Common Flags

| Flag | Type | Description |
|------|------|-------------|
| `--model` | string | Model to use |
| `--bare` | boolean | Minimal output mode |

## Example

```yaml
steps:
  - name: review
    action: harness.run
    with:
      provider: opencode
      prompt: |
        Review the current branch and list problems
      model: claude-sonnet-4
```

Generated invocation:

```text
opencode run "Review the current branch and list problems" --model claude-sonnet-4
```

## YOLO Mode

OpenCode runs non-interactively by default when using `run` mode. For fully autonomous execution without any interactive prompts, ensure you are using the `run` subcommand and not the interactive TUI:

```yaml
steps:
  - name: auto-implement
    action: harness.run
    with:
      provider: opencode
      prompt: |
        Implement the feature described in the issue
      auto: true
```

Generated invocation:

```text
opencode run "Implement the feature described in the issue" --auto
```

For CI/CD environments, you may also want to set the `OPENCODE_API_KEY` environment variable to avoid authentication prompts.

## See Also

- [OpenCode CLI Docs](https://opencode.ai/docs/cli/)
- [Providers Directory](https://opencode.ai/docs/providers/)
- [Configuration](https://opencode.ai/docs/config/)
- [Custom Commands](https://opencode.ai/docs/commands/)
- [OpenCode on GitHub](https://github.com/anomalyco/opencode)
