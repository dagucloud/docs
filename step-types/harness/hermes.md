# Hermes Agent

[Hermes Agent](https://hermes-agent.nousresearch.com/) by Nous Research is a self-improving AI agent with a built-in learning loop. It creates skills from experience, improves them during use, and builds a deepening model of the user across sessions.

## Installation

```bash
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
```

See the [Hermes quickstart](https://hermes-agent.nousresearch.com/docs/getting-started/quickstart) for full details.

## Base Invocation

Hermes is invoked in its scripted one-shot mode (`-z`), designed for programmatic callers:

```text
hermes -z "<prompt>"
```

This produces **single prompt in, final response text out** — no banner, no spinner, no tool previews.

## Common Flags

| Flag | Type | Description |
|------|------|-------------|
| `--provider` | string | Override provider (e.g. `openrouter`, `anthropic`) |
| `--model` | string | Override model |
| `--yolo` | boolean | Bypass dangerous-command approval prompts |
| `--quiet` | boolean | Suppress banner/spinner/tool previews |
| `--toolsets` | string | Comma-separated toolsets (e.g. `web,terminal,skills`) |
| `--skills` | string | Preload skills |
| `--checkpoints` | boolean | Enable filesystem checkpoints |
| `--max-turns` | number | Maximum iterations per turn |

## YOLO Mode

Hermes supports a `--yolo` flag that bypasses dangerous-command approval prompts. This is essential for fully automated workflows where no human is present to approve commands:

```yaml
steps:
  - name: auto-refactor
    action: harness.run
    with:
      provider: hermes
      prompt: "Refactor the auth module to use interfaces"
      yolo: true
      toolsets: "terminal,skills"
```

Generated invocation:

```text
hermes -z "Refactor the auth module to use interfaces" --toolsets terminal,skills --yolo
```

**Warning:** This bypasses safety checks for dangerous commands. Only use in isolated or trusted environments.

## Example

```yaml
steps:
  - name: refactor-auth
    action: harness.run
    with:
      provider: hermes
      prompt: "Refactor the auth module to use interfaces"
      yolo: true
      toolsets: "terminal,skills"
```

Generated invocation:

```text
hermes -z "Refactor the auth module to use interfaces" --toolsets terminal,skills --yolo
```

## Fallback Example

```yaml
harness:
  provider: hermes
  yolo: true
  fallback:
    - provider: claude
      model: sonnet

steps:
  - name: analyze
    action: harness.run
    with:
      prompt: "Analyze the codebase for security issues"
```

## Notes

- Hermes supports many providers via `--provider`: `openrouter`, `anthropic`, `openai-codex`, `copilot`, `gemini`, `deepseek`, `nvidia`, and [many more](https://hermes-agent.nousresearch.com/docs/reference/cli-commands#hermes-chat)
- Use `--quiet` or `--yolo` for CI/automated workflows where interactive prompts are not possible

## See Also

- [CLI Commands Reference](https://hermes-agent.nousresearch.com/docs/reference/cli-commands) — All `hermes` subcommands and flags
- [Configuration Guide](https://hermes-agent.nousresearch.com/docs/user-guide/configuration) — `config.yaml`, providers, models
- [Quickstart](https://hermes-agent.nousresearch.com/docs/getting-started/quickstart) — Install, setup, first conversation
- [Toolsets](https://hermes-agent.nousresearch.com/docs/user-guide/features/tools) — Built-in tools and toolset system
- [Skills System](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills) — Creating and managing skills
