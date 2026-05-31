# Codex

OpenAI Codex is an agentic coding tool that runs in your terminal.

## Installation

See the [official OpenAI Codex documentation](https://platform.openai.com/docs/guides/codex).

## Base Invocation

```text
codex exec "<prompt>"
```

## Default Config

Codex is the only built-in provider that ships with a default config. When you use `provider: codex`, Dagu automatically applies:

```yaml
skip_git_repo_check: true
```

This becomes `--skip-git-repo-check` on the CLI. You can override it by explicitly setting `skip_git_repo_check: false` in your step `with`.

## Common Flags

| Flag | Type | Description |
|------|------|-------------|
| `--model` | string | Model to use (e.g. `gpt-5.5`) |
| `--full-auto` | boolean | Full auto-approval mode |
| `--skip-git-repo-check` | boolean | Skip git repository validation |

## Example

```yaml
steps:
  - name: generate-tests
    action: harness.run
    with:
      provider: codex
      prompt: |
        Write unit tests for the auth module
      model: gpt-5.5
      full-auto: true
```

Generated invocation:

```text
codex exec "Write unit tests for the auth module" --full-auto --model gpt-5.5 --skip-git-repo-check
```

## YOLO Mode

Codex supports a `--yolo` flag that bypasses all approval prompts and sandboxing. This is useful for fully automated workflows:

```yaml
steps:
  - name: auto-fix
    action: harness.run
    with:
      provider: codex
      prompt: |
        Fix all lint errors
      yolo: true
      sandbox: workspace-write
```

Generated invocation:

```text
codex exec "Fix all lint errors" --yolo --sandbox workspace-write --skip-git-repo-check
```

**Warning:** This disables all safety checks. Only use in isolated or trusted environments.

## Fallback Example

```yaml
harness:
  provider: codex
  full-auto: true
  fallback:
    - provider: claude
      model: sonnet

steps:
  - name: refactor
    action: harness.run
    with:
      prompt: |
        Refactor the database layer to use interfaces
```

## See Also

- [Codex CLI Reference](https://developers.openai.com/codex/cli/reference) — Complete command and flag reference
- [Non-interactive Mode](https://developers.openai.com/codex/noninteractive) — Running Codex in CI/scripts
- [Config Basics](https://developers.openai.com/codex/config-basic) — `config.toml` and precedence
- [Sandboxing](https://developers.openai.com/codex/concepts/sandboxing) — How the sandbox works
- [Models](https://developers.openai.com/codex/models) — Available model aliases and overrides
