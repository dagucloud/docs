# Harness

Run coding agents as workflow steps. Harnesses can run external CLI agents or Dagu's built-in AI agent.

For CLI providers, the harness executor starts a subprocess, captures stdout and stderr, and uses the process exit status as the step result. For the built-in provider, the harness executor runs the same in-process agent used by [`agent.run`](/features/agent/step).

The selected CLI attempt's binary must either be available in `PATH` or be referenced by path. Dagu resolves each CLI provider binary when that attempt runs, so a missing fallback binary does not fail a successful primary attempt.

To run CLI agents inside a container sandbox, see [Harness Sandboxed Execution](./sandbox/). This is the recommended shape when an AI or coding agent should run with explicit filesystem mounts, toolchains, network policy, and credentials.

## Supported Providers

Dagu has built-in support for the following providers. CLI providers are pre-configured with the correct invocation pattern:

| Provider | Page |
|----------|------|
| Built-in Dagu agent | `builtin` |
| [Claude Code](./claude) | `claude` |
| [Codex](./codex) | `codex` |
| [Copilot](./copilot) | `copilot` |
| [Hermes Agent](./hermes) | `hermes` |
| [OpenCode](./opencode) | `opencode` |
| [Pi](./pi) | `pi` |

You can also define [custom harness definitions](#custom-harness-definitions) for any CLI agent.

## Step Contract

- `with.prompt` is the prompt. Harness steps accept a single command string; command arrays are rejected.
- `with.stdin` is optional extra stdin content.
- After DAG-level defaults are applied, the step needs a provider. Omitted provider configuration is still invalid.
- `with.provider` may be `builtin`, a built-in CLI provider, or a name defined under top-level `harnesses:`.
- `with.provider` may contain `${VAR}` interpolation and is resolved after interpolation at runtime.

Example:

```yaml
steps:
  - name: review
    action: harness.run
    with:
      prompt: |
        Review the current branch and list problems
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
    action: harness.run
    with:
      prompt: |
        Implement the requested change and summarize what changed
      provider: codex
    approval:
      prompt: "Review the implementation"
      input: [FEEDBACK]
```

On the first run, `implement` receives only the original prompt. If the reviewer pushes back with `FEEDBACK`, Dagu reruns the harness step and augments the prompt with the feedback, iteration number, and previous stdout log path.

## Built-in Providers

The `builtin` provider runs Dagu's in-process AI agent with the same runtime behavior as `agent.run`. It uses Agent Settings for model definitions, credentials, tool policy, web tool backend configuration, memory stores, and souls.

```yaml
steps:
  - action: harness.run
    with:
      prompt: |
        Review the current branch and return concise findings
      provider: builtin
      model: coder-default
      tools:
        enabled: [read, bash, think]
      max_iterations: 20
```

For `provider: builtin`, supported config fields are:

| Field | Type | Meaning |
|-------|------|---------|
| `provider` | string | Must be `builtin` |
| `model` | string | Model ID from Agent Settings; when omitted, the global default model is used |
| `tools` | object | Tool selection and bash policy, same shape as `agent.run` |
| `skills` | string[] | Skill IDs available to the agent |
| `soul` | string | Soul ID for the agent identity |
| `memory` | object | Memory configuration, for example `{enabled: true}` |
| `web_search` | object | Provider-native web search configuration |
| `safe_mode` | bool | Safe mode setting |
| `max_iterations` | int | Maximum tool-call rounds |
| `fallback` | array | Ordered fallback provider configs |

Unknown fields are rejected for `provider: builtin`. This differs from CLI providers, where unknown fields are passed through as CLI flags.

When `with.stdin` is set with `provider: builtin`, Dagu appends it to the user prompt with a blank line between the prompt and stdin content.

CLI built-in providers have fixed prompt placement:

| Provider | Binary | Base invocation |
|----------|--------|-----------------|
| `claude` | `claude` | `claude -p "<prompt>"` |
| `codex` | `codex` | `codex exec "<prompt>"` |
| `copilot` | `copilot` | `copilot -p "<prompt>"` |
| `opencode` | `opencode` | `opencode run "<prompt>"` |
| `pi` | `pi` | `pi -p "<prompt>"` |

For built-in CLI providers:

- the prompt is always passed on the command line
- additional `with` keys become CLI flags, with `snake_case` keys normalized to kebab-case
- `with.stdin`, if present, is piped to stdin unchanged

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
    action: harness.run
    with:
      prompt: |
        Summarize the repository status
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

- custom harness names cannot conflict with [built-in providers](#supported-providers), including `builtin`
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
  - action: harness.run
    with:
      prompt: |
        Review the auth module
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
  - action: harness.run
    with:
      prompt: |
        Review the auth module
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
  - action: harness.run
    with:
      prompt: |
        Review this patch
      stdin: |
        diff --git a/main.go b/main.go
        ...
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

- if `with.stdin` is empty, stdin is just the prompt
- if both `with.prompt` and `with.stdin` are present, stdin is `prompt + "\n\n" + stdin`

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

- built-in CLI providers use `--key`
- custom definitions with `flag_style: gnu_long` use `--key`
- custom definitions with `flag_style: single_dash` use `-key`
- `option_flags.<key>` overrides the exact token for that key

Additional details:

- built-in CLI providers normalize `snake_case` keys to kebab-case flag names, so `max_turns` becomes `--max-turns`
- custom harness definitions keep keys as written unless `option_flags` overrides them
- keys are emitted in lexicographic order for deterministic argv generation
- reserved keys are `provider` and `fallback`
- Dagu does not validate provider-specific flag names or values

## DAG-Level Defaults

Top-level `harness:` provides defaults for harness steps.

```yaml
harness:
  provider: builtin
  model: coder-default
  max_iterations: 30
  fallback:
    - provider: codex
      full-auto: true

steps:
  - action: harness.run
    with:
      prompt: |
        Write tests for the auth module

  - action: harness.run
    with:
      prompt: |
        Fix the flaky integration tests
      max_iterations: 80
```

Merge rules:

- DAG-level `harness:` is the base config for every harness step
- step-level `with:` overrides primary keys from DAG-level `harness:`
- step-level `fallback:` replaces the DAG-level fallback list; it is not merged
- `defaults.agent` is separate and applies to `agent.run`, not `harness.run`

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
    action: harness.run
    with:
      prompt: |
        Implement the feature and add tests
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
    action: harness.run
    with:
      prompt: |
        Analyze the repository layout
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
