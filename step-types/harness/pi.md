# Pi

[Pi](https://pi.ai) is an AI assistant by Inflection AI.

## Installation

See the [Pi documentation](https://pi.ai) for installation instructions.

## Base Invocation

```text
pi -p "<prompt>"
```

## Common Flags

| Flag | Type | Description |
|------|------|-------------|
| `--model` | string | Model variant |

## Example

```yaml
steps:
  - name: summarize
    action: harness.run
    with:
      provider: pi
      prompt: "Summarize the README in one paragraph"
```

Generated invocation:

```text
pi -p "Summarize the README in one paragraph"
```

## YOLO Mode

Pi runs non-interactively by default when using `-p` (prompt mode), making it suitable for automated workflows without additional flags.

If you want to ensure fully autonomous execution without any confirmation prompts, use the `--auto` flag:

```yaml
steps:
  - name: auto-summarize
    action: harness.run
    with:
      provider: pi
      prompt: "Summarize the README in one paragraph"
      auto: true
```

Generated invocation:

```text
pi -p "Summarize the README in one paragraph" --auto
```

## See Also

- [Pi.ai](https://pi.ai)
- [Pi Help Center](https://pi.ai/help)
