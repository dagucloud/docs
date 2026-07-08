# Pi

[Pi](https://pi.dev) is a terminal coding agent. Install the CLI from npm:

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

## Base Invocation

The built-in Dagu provider invokes Pi in print mode:

```text
pi -p "<prompt>"
```

## Common Flags

| Flag | Type | Description |
|------|------|-------------|
| `--provider` | string | LLM provider, such as `openrouter`, `openai`, or `anthropic` |
| `--model` | string | Model pattern or ID, including `provider/model` and optional `:<thinking>` |
| `--thinking` | string | Thinking level: `off`, `minimal`, `low`, `medium`, `high`, or `xhigh` |
| `--tools` | string | Comma-separated tool allowlist |
| `--exclude-tools` | string | Comma-separated tool denylist |
| `--no-tools` | boolean | Disable all tools |
| `--no-session` | boolean | Run without saving a session |
| `--no-context-files` | boolean | Disable `AGENTS.md` and `CLAUDE.md` discovery |
| `--list-models` | string | List available models, optionally filtered |

## Example

Use a custom harness when a Pi option needs an exact flag mapping. Dagu uses `with.provider` to select the harness provider, so this example maps `ai_provider` to Pi's `--provider` flag.

```yaml
harnesses:
  pi_agent:
    # Run the installed Pi CLI.
    binary: pi
    # `--print` makes Pi run once and exit.
    prefix_args: ["--print"]
    # Pass the Dagu prompt as the final positional argument.
    prompt_mode: arg
    prompt_position: after_flags
    # Rename Dagu `with` keys to exact Pi flags where needed.
    option_flags:
      # `provider` is reserved by Dagu, so use `ai_provider` for Pi's LLM provider.
      ai_provider: --provider
      no_context_files: --no-context-files
      no_session: --no-session
      no_tools: --no-tools

steps:
  - id: summarize
    action: harness.run
    with:
      # Select the custom harness definition above.
      provider: pi_agent
      # Passed to Pi as `--provider openrouter`.
      ai_provider: openrouter
      # Passed to Pi as `--model openai/gpt-5.4-mini`.
      model: openai/gpt-5.4-mini
      # Small summarization task, so low reasoning is enough.
      thinking: low
      # Keep the run stateless and prevent file/tool access for this summary.
      no_session: true
      no_context_files: true
      no_tools: true
      prompt: |
        Summarize the README in one paragraph.
```

Generated invocation:

```text
pi --print --provider openrouter --model openai/gpt-5.4-mini --no-context-files --no-session --no-tools --thinking low "Summarize the README in one paragraph."
```

## Stdin

Pi print mode reads piped stdin and merges it into the initial prompt.

```yaml
harnesses:
  pi_agent:
    # Run the installed Pi CLI.
    binary: pi
    # `--print` makes Pi read piped stdin and exit after one response.
    prefix_args: ["--print"]
    # Pass the Dagu prompt as the final positional argument.
    prompt_mode: arg
    prompt_position: after_flags
    # `provider` is reserved by Dagu, so expose Pi's flag as `ai_provider`.
    option_flags:
      ai_provider: --provider

steps:
  - id: summarize
    action: harness.run
    with:
      # Select the custom harness definition above.
      provider: pi_agent
      # Passed to Pi as `--provider openrouter`.
      ai_provider: openrouter
      # Passed to Pi as `--model openai/gpt-5.4-mini`.
      model: openai/gpt-5.4-mini
      # Small summarization task, so low reasoning is enough.
      thinking: low
      prompt: |
        Summarize these notes.
      stdin: |
        Import completed.
        Empty rows were skipped.
```

## See Also

- [Pi](https://pi.dev)
- [Custom Harness Definitions](/step-types/harness/#custom-harness-definitions)
