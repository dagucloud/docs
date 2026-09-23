# Harness

Run coding agents as workflow steps. Harnesses run external CLI agents on the host or inside a container.

For CLI providers, the harness executor normally starts a subprocess, captures stdout and stderr, and uses the process exit status as the step result. Built-in OpenCode steps use a managed server session by default on long-lived Dagu execution hosts; see [OpenCode](./opencode).

The selected CLI attempt's binary must either be available in `PATH` or be referenced by path. Dagu resolves each CLI provider binary when that attempt runs, so a missing fallback binary does not fail a successful primary attempt. Agent CLIs that authenticate with an environment variable can also be installed per-DAG with [`tools`](/writing-workflows/tools); the managed toolset directory is prepended to `PATH` for the run. DAG-level tools and secrets supply CLI steps only, not the process-owned OpenCode managed service.

To run CLI agents inside a container sandbox, see [Harness Sandboxed Execution](./sandbox/). This is the recommended shape when an AI or coding agent should run with explicit filesystem mounts, toolchains, network mode, external egress controls, and credentials.

## Supported Providers

Dagu has built-in support for the following providers. Each adapter is pre-configured with the provider's non-interactive invocation and supplementary-input behavior:

| Provider | Key | Base invocation | `with.stdin` |
|----------|-----|-----------------|--------------|
| [Claude Code](./claude) | `claude` | `claude -p "<prompt>" [flags]` | Piped to stdin |
| [Codex](./codex) | `codex` | `codex exec "<prompt>" [flags]` | Piped to stdin |
| [GitHub Copilot](./copilot) | `copilot` | `copilot -p "<prompt>" [flags]` | Piped to stdin |
| [OpenCode](./opencode) | `opencode` | Managed session or `opencode run "<prompt>" [flags]` | Piped to stdin on the CLI path |
| [Pi](./pi) | `pi` | `pi -p "<prompt>" [flags]` | Piped to stdin |
| Gemini CLI | `gemini` | `gemini -p "<prompt>" [flags]` | Piped to stdin |
| Cursor | `cursor` | `cursor-agent -p "<prompt>" [flags]` | Folded into the prompt |
| Cline | `cline` | `cline [flags] "<prompt>"` | Piped to stdin |
| Aider | `aider` | `aider --message "<prompt>" [flags]` | Folded into the prompt |
| Qwen Code | `qwen` | `qwen -p "<prompt>" [flags]` | Piped to stdin |
| Goose | `goose` | `goose run --text "<prompt>" [flags]` | Folded into the prompt |
| Kiro CLI | `kiro` | `kiro-cli chat --no-interactive "<prompt>" [flags]` | Piped to stdin |
| Droid | `droid` | `droid exec "<prompt>" [flags]` | Folded into the prompt |
| Amp | `amp` | `amp -x "<prompt>" [flags]` | Piped to stdin |
| DeepSeek Harness | `deepseek` | `dsh --profile headless [flags] "<prompt>"` | Folded into the prompt |
| Kilo Code | `kilo` | `kilo run "<prompt>" --auto [flags]` | Piped to stdin |

Codex enables `skip_git_repo_check` by default, Cursor defaults to `output_format: text`, Goose defaults to `quiet: true`, and Kilo Code defaults to `auto: true` so the agent runs unattended. Explicit values under `with` override these defaults. The `deepseek` adapter targets the official DeepSeek Harness `dsh` CLI in its headless profile; it does not select DeepSeek as another harness's model backend.

You can also define [custom harness definitions](#custom-harness-definitions) for any CLI agent. The [Hermes Agent guide](./hermes) is a complete custom-provider example.

## Step Contract

- `with.prompt` is the prompt. Harness steps accept a single command string; command arrays are rejected.
- `with.stdin` is optional extra stdin content. It is inline text, not a file path. The step-level [`stdin`](/writing-workflows/data-flow#standard-input) field, which names a file, applies to `run` steps and is rejected on harness steps.
- After DAG-level defaults are applied, the step needs a provider. Omitted provider configuration is still invalid.
- `with.provider` may be a built-in CLI provider or a name defined under top-level `harnesses:`.
- `with.provider` may contain scoped references such as `${env.PROVIDER}` and is resolved after interpolation at runtime.

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

## Structured JSON Output

Use the step-level `output_schema` field when downstream steps require stdout to
contain exactly one JSON object with a known shape:

```yaml
steps:
  - id: analyze
    action: harness.run
    with:
      provider: codex
      prompt: |
        Analyze the authentication code.
        Return only one JSON object with `summary` and `risk` fields.
    output_schema:
      type: object
      additionalProperties: false
      required: [summary, risk]
      properties:
        summary:
          type: string
        risk:
          type: string
          enum: [low, medium, high]
```

After the successful harness attempt exits, Dagu decodes its complete stdout as
one JSON value and validates it against the schema. The step fails if stdout is
empty, contains non-JSON output or multiple JSON values, or does not match the
schema. `output_schema` belongs on the step, not under `with`, and works with
both built-in providers and custom harness definitions.

`output_schema` validates output; it does not instruct the agent to generate
JSON. Tell the agent to return only JSON, or use an appropriate provider-native
structured-output option. Provider options such as `with.format: json`,
`with.output_format: json`, and `with.json: true` are passed through as CLI
flags. They are not portable Dagu options, and a provider may use them to emit a
JSONL event stream rather than one final JSON document.

See the [validated JSON harness example](/writing-workflows/examples/harness-run#validated-json-result)
for an end-to-end workflow and the
[`output_schema` workflow specification](/writing-workflows/yaml-specification#output)
for the general step-level contract.

## Approval Push-back

Harness steps automatically receive push-back context from an approval or a [human task](/writing-workflows/human-tasks#requesting-changes) when they are rewound and re-executed. Dagu appends a push-back context block to the prompt with:

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

For built-in CLI providers:

- the prompt is always passed on the command line
- additional `with` keys become CLI flags, with `snake_case` keys normalized to kebab-case
- `with.stdin`, if present, is piped or folded into the prompt as shown in the [provider table](#supported-providers)

## Custom Harness Definitions

Use top-level `harnesses:` to define named custom harness adapters.

```yaml
harnesses:
  gemini-custom:
    binary: gemini
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
      provider: gemini-custom
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

- a non-null custom definition shadows a [built-in provider](#supported-providers) with the same name; removing that definition exposes the built-in again
- `prompt_flag` is valid only when `prompt_mode: flag`
- unknown keys inside a harness definition are rejected

### Custom Prompt Placement

`prompt_mode: arg`

```yaml
harnesses:
  reviewbot:
    binary: my-review-agent
    prefix_args: ["exec"]
    prompt_mode: arg
    prompt_position: after_flags
    flag_style: single_dash

steps:
  - action: harness.run
    with:
      prompt: |
        Review the auth module
      provider: reviewbot
      model: sonnet
```

Generated argv:

```text
my-review-agent exec -model sonnet "Review the auth module"
```

`prompt_mode: flag`

```yaml
harnesses:
  gemini-custom:
    binary: gemini
    prompt_mode: flag
    prompt_flag: --prompt
    option_flags:
      model: --model

steps:
  - action: harness.run
    with:
      prompt: |
        Review the auth module
      provider: gemini-custom
      model: gemini-2.5-pro
```

Generated argv:

```text
gemini --prompt "Review the auth module" --model gemini-2.5-pro
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
- reserved keys are `prompt`, `stdin`, `provider`, `fallback`, and `managed`
- Dagu does not validate provider-specific flag names or values

## DAG-Level Defaults

Top-level `harness:` provides defaults for harness steps.

```yaml
harness:
  provider: claude
  model: sonnet
  bare: true
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
      provider: codex
      full-auto: true
```

Merge rules:

- DAG-level `harness:` is the base config for every harness step
- step-level `with:` overrides primary keys from DAG-level `harness:`
- step-level `with.fallback` replaces the DAG-level fallback list; it is not merged

## Fallbacks

`with.fallback` is an ordered list of alternative provider configs.

```yaml
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
      provider: "${params.PROVIDER}"
```

Interpolated scalar strings are normalized before flags are generated, so values such as `"true"`, `"10"`, and `"5.5"` become booleans or numbers.

## Exit Codes

| Exit code | Meaning |
|-----------|---------|
| `0` | CLI completed successfully |
| `124` | Step context was cancelled or timed out |
| any other non-zero value | The child process exit code, or `1` when setup failed before a process exit code existed |

On failure, Dagu includes the last 1024 bytes of stderr in the returned error message.
