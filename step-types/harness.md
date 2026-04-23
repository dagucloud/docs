# Harness

Run CLI-based coding agents as workflow steps.

The harness executor starts a subprocess, captures stdout and stderr, and uses the process exit status as the step result.

The selected attempt's CLI binary must either be available in `PATH` or be referenced by path. Dagu resolves each provider binary when that attempt runs, so a missing fallback binary does not fail a successful primary attempt.

## Step Contract

- `command` is the prompt. Harness steps accept a single command string; command arrays are rejected.
- `script` is optional extra stdin content.
- After DAG-level defaults are applied, the step needs a provider.
- `with.provider` may be a built-in provider or a name defined under top-level `harnesses:`.
- `with.provider` may contain `${VAR}` interpolation and is resolved after interpolation at runtime.

Example:

```yaml
steps:
  - name: review
    type: harness
    command: "Review the current branch and list problems"
    with:
      provider: claude
      model: sonnet
      bare: true
```

## Built-in Providers

Built-in providers have fixed prompt placement:

| Provider | Binary | Base invocation |
|----------|--------|-----------------|
| `claude` | `claude` | `claude -p "<prompt>"` |
| `codex` | `codex` | `codex exec "<prompt>"` |
| `copilot` | `copilot` | `copilot -p "<prompt>"` |
| `opencode` | `opencode` | `opencode run "<prompt>"` |
| `pi` | `pi` | `pi -p "<prompt>"` |

For built-in providers:

- the prompt is always passed on the command line
- additional `with` keys become CLI flags, with `snake_case` keys normalized to kebab-case
- `script`, if present, is piped to stdin unchanged

## Custom Harness Definitions

Use top-level `harnesses:` to define named custom harness adapters.

```yaml
harnesses:
  gemini:
    binary: gemini
    prefix_args: ["run"]
    prompt_mode: flag
    prompt_flag: --prompt
    option_flags:
      model: --model

steps:
  - name: summarize
    type: harness
    command: "Summarize the repository status"
    with:
      provider: gemini
      model: gemini-2.5-pro
```

Custom harness definition fields:

| Field | Type | Required | Default | Meaning |
|-------|------|----------|---------|---------|
| `binary` | string | yes | - | CLI binary name or path |
| `prefix_args` | string[] | no | `[]` | Arguments emitted before prompt placement and generated flags |
| `prompt_mode` | `arg` \| `flag` \| `stdin` | no | `arg` | How the prompt is passed |
| `prompt_flag` | string | only for `flag` mode | - | Exact flag token used for the prompt |
| `prompt_position` | `before_flags` \| `after_flags` | no | `before_flags` | Where prompt tokens go relative to generated flags |
| `flag_style` | `gnu_long` \| `single_dash` | no | `gnu_long` | Default generated flag token style |
| `option_flags` | object | no | - | Exact flag token overrides per `with` key |

Rules enforced by Dagu:

- custom harness names cannot be `claude`, `codex`, `copilot`, `opencode`, or `pi`
- `prompt_flag` is valid only when `prompt_mode: flag`
- unknown keys inside a harness definition are rejected

### Custom Prompt Placement

`prompt_mode: arg`

```yaml
harnesses:
  aider:
    binary: aider
    prefix_args: ["exec"]
    prompt_mode: arg
    prompt_position: after_flags
    flag_style: single_dash

steps:
  - type: harness
    command: "Review the auth module"
    with:
      provider: aider
      model: sonnet
```

Generated argv:

```text
aider exec -model sonnet "Review the auth module"
```

`prompt_mode: flag`

```yaml
harnesses:
  gemini:
    binary: gemini
    prefix_args: ["run"]
    prompt_mode: flag
    prompt_flag: --prompt
    option_flags:
      model: --model

steps:
  - type: harness
    command: "Review the auth module"
    with:
      provider: gemini
      model: gemini-2.5-pro
```

Generated argv:

```text
gemini run --prompt "Review the auth module" --model gemini-2.5-pro
```

`prompt_mode: stdin`

```yaml
harnesses:
  llm:
    binary: my-agent
    prefix_args: ["exec"]
    prompt_mode: stdin

steps:
  - type: harness
    command: "Review this patch"
    script: |
      diff --git a/main.go b/main.go
      ...
    with:
      provider: llm
      format: json
```

Generated argv:

```text
my-agent exec --format json
```

Stdin content:

```text
Review this patch

diff --git a/main.go b/main.go
...
```

For `stdin` mode:

- if `script` is empty, stdin is just the prompt
- if both `command` and `script` are present, stdin is `prompt + "\n\n" + script`

## `with`-to-Flag Mapping

After removing reserved keys, Dagu converts remaining `with` entries to CLI flags.

| YAML value | Result |
|------------|--------|
| `key: "value"` | `flag value` |
| `key: true` | bare `flag` |
| `key: false` | omitted |
| `key: ""` | omitted |
| `key: 20` | `flag 20` |
| `key: 5.5` | `flag 5.5` |
| `key: [a, b]` | `flag a flag b` |

Flag token selection:

- built-in providers use `--key`
- custom definitions with `flag_style: gnu_long` use `--key`
- custom definitions with `flag_style: single_dash` use `-key`
- `option_flags.<key>` overrides the exact token for that key

Additional details:

- built-in providers normalize `snake_case` keys to kebab-case flag names, so `max_turns` becomes `--max-turns`
- custom harness definitions keep keys as written unless `option_flags` overrides them
- keys are emitted in lexicographic order for deterministic argv generation
- reserved keys are `provider` and `fallback`
- Dagu does not validate provider-specific flag names or values

## DAG-Level Defaults

Top-level `harness:` provides defaults for harness steps.

```yaml
harness:
  provider: claude
  model: sonnet
  fallback:
    - provider: codex
      full-auto: true

steps:
  - command: "Write tests for the auth module"

  - type: harness
    command: "Fix the flaky integration tests"
    with:
      model: opus
      effort: high
```

Merge rules:

- DAG-level `harness:` is the base config for every harness step
- step-level `with:` overrides primary keys from DAG-level `harness:`
- step-level `fallback:` replaces the DAG-level fallback list; it is not merged
- if a DAG has `harness:` and a step omits `type:`, Dagu treats that step as `type: harness`

## Fallbacks

`with.fallback` is an ordered list of alternative provider configs.

```yaml
harnesses:
  gemini:
    binary: gemini
    prefix_args: ["run"]
    prompt_mode: flag
    prompt_flag: --prompt

steps:
  - name: implement
    type: harness
    command: "Implement the feature and add tests"
    with:
      provider: claude
      fallback:
        - provider: codex
        - provider: gemini
          model: gemini-2.5-pro
```

Behavior:

- Dagu tries the primary provider first, then each fallback in order
- fallback entries are flat provider configs; nested `fallback` blocks are not supported
- if the step context is cancelled, remaining fallbacks are skipped
- stdout from failed attempts is discarded
- stderr from every attempt remains in the step logs

## Parameterized Provider Selection

```yaml
params:
  - PROVIDER: claude

steps:
  - name: task
    type: harness
    command: "Analyze the repository layout"
    with:
      provider: "${PROVIDER}"
```

Interpolated scalar strings are normalized before flags are generated, so values such as `"true"`, `"10"`, and `"5.5"` become booleans or numbers.

## Exit Codes

| Exit code | Meaning |
|-----------|---------|
| `0` | CLI completed successfully |
| `124` | Step context was cancelled or timed out |
| any other non-zero value | The child process exit code, or `1` when setup failed before a process exit code existed |

On failure, Dagu includes the last 1024 bytes of stderr in the returned error message.
