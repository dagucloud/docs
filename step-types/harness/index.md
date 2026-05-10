# Harness

Run CLI-based coding agents as workflow steps.

The harness executor starts a subprocess, captures stdout and stderr, and uses the process exit status as the step result.

The selected attempt's CLI binary must either be available in `PATH` or be referenced by path. Dagu resolves each provider binary when that attempt runs, so a missing fallback binary does not fail a successful primary attempt.

## Supported Providers

Dagu has built-in support for the following CLI agents. Each provider is pre-configured with the correct invocation pattern:

| Provider | Page |
|----------|------|
| [Claude Code](./claude) | `claude` |
| [Codex](./codex) | `codex` |
| [Copilot](./copilot) | `copilot` |
| [Hermes Agent](./hermes) | `hermes` |
| [OpenCode](./opencode) | `opencode` |
| [Pi](./pi) | `pi` |

You can also define [custom harness definitions](#custom-harness-definitions) for any CLI agent.

## Step Contract

- `command` is the prompt. Harness steps accept a single command string; command arrays are rejected.
- `script` is optional extra stdin content.
- After DAG-level defaults are applied, the step needs a provider.
- `config.provider` may be a built-in provider or a name defined under top-level `harnesses:`.
- `config.provider` may contain `${VAR}` interpolation and is resolved after interpolation at runtime.

Example:

```yaml
steps:
  - name: review
    type: harness
    command: "Review the current branch and list problems"
    config:
      provider: claude
      model: sonnet
      bare: true
```

## Approval Push-back

Harness steps automatically receive approval push-back context when they are rewound and re-executed. Dagu appends a push-back context block to the prompt with:

- the current push-back iteration
- reviewer-provided feedback inputs, such as `FEEDBACK`
- the previous stdout log path, when the step had stdout before reset

Dagu passes the previous stdout as a file path only. It does not inline stdout into the prompt because harness output can be large. The path is also available as `DAG_PUSHBACK_PREVIOUS_STDOUT_FILE`; the current iteration is available as `DAG_PUSHBACK_ITERATION`.

```yaml
steps:
  - id: implement
    type: harness
    command: "Implement the requested change and summarize what changed"
    config:
      provider: codex
    approval:
      prompt: "Review the implementation"
      input: [FEEDBACK]
```

On the first run, `implement` receives only the original prompt. If the reviewer pushes back with `FEEDBACK`, Dagu reruns the harness step and augments the prompt with the feedback, iteration number, and previous stdout log path.

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
    config:
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
| `option_flags` | object | no | - | Exact flag token overrides per `config` key |

Rules enforced by Dagu:

- custom harness names cannot conflict with [built-in providers](#supported-providers)
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
    config:
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
    config:
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
    config:
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

## `config`-to-Flag Mapping

After removing reserved keys, Dagu converts remaining `config` entries to CLI flags.

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
    config:
      model: opus
      effort: high
```

Merge rules:

- DAG-level `harness:` is the base config for every harness step
- step-level `config:` overrides primary keys from DAG-level `harness:`
- step-level `fallback:` replaces the DAG-level fallback list; it is not merged
- if a DAG has `harness:` and a step omits `type:`, Dagu treats that step as `type: harness`

## Fallbacks

`config.fallback` is an ordered list of alternative provider configs.

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
    config:
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
    config:
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
