# Custom Step Types

`step_types` defines reusable step types that expand to builtin-backed steps when a DAG is loaded. They are resolved during spec build, before normal step validation and execution. The runtime executes the expanded builtin step.

## Where You Can Declare Them

- At the top level of a DAG document.
- In `base.yaml`.
- Base-config and DAG-local definitions are merged per YAML document.
- A DAG-local definition that duplicates a base-config name is rejected.
- A DAG-local definition is visible only inside the YAML document that declares it. Another document separated by `---` must redeclare it or inherit it from base config.

## Definition Format

```yaml
step_types:
  greet:
    type: command
    description: Print a greeting
    input_schema:
      type: object
      additionalProperties: false
      required: [message]
      properties:
        message:
          type: string
        repeat:
          type: integer
          default: 2
    template:
      script: |
        #!/bin/bash
        for ((i=0; i<{{ .input.repeat }}; i++)); do
          printf '%s\n' {{ json .input.message }}
        done

steps:
  - type: greet
    with:
      message: hello
```

This expands to a builtin `command` step at load time. `with.repeat` defaults to `2`, and because the template uses a shebang with no `template.shell`, Bash runs the script. If `name` is omitted, the generated name uses the custom type prefix, such as `greet_1`.

## Definition Fields

- `step_types.<name>` must match `^[A-Za-z][A-Za-z0-9_-]*$`.
- Custom names cannot reuse builtin step type names such as `command`, `http`, `kubernetes`, `s3`, `chat`, or `agent`.
- `type` is required and must point to a builtin step type or builtin alias. Custom step types cannot target other custom step types.
- `input_schema` is required. It must be an inline JSON Schema object that resolves to an object schema.
- `template` is required. It must be a step fragment object.
- `template.type` is rejected. The expanded builtin type always comes from `step_types.<name>.type`.
- `description` is optional. It is applied only when the expanded step does not set its own description.

## Template Rendering

String values inside `template` are rendered with Go `text/template` using `.input` as the template data.
Custom step templates expose the same template functions as the [Template step](/step-types/template#template-functions), plus a `json` helper that returns the JSON encoding of a value.

### Available Functions

Custom step templates can use:

- Dagu pipeline-friendly functions documented for the template executor: `split`, `join`, `count`, `add`, `empty`, `upper`, `lower`, `trim`, and `default`
- The exact slim-sprig-derived function names listed on the [Template step](/step-types/template#available-slim-sprig-functions)
- `json`, which is specific to custom step templates and returns the JSON encoding of a value. This helper is useful when embedding user input inside a string field such as `script` or an HTTP body.

Functions that read environment variables, perform network lookups, use current time, generate random values, or generate crypto keys are not available. The exact blocked names are listed on the [Template step](/step-types/template#blocked-functions).

```yaml
step_types:
  webhook:
    type: http
    input_schema:
      type: object
      additionalProperties: false
      required: [url, text]
      properties:
        url:
          type: string
        text:
          type: string
    template:
      command: POST {{ .input.url }}
      with:
        headers:
          Content-Type: application/json
        body: |
          {"text": {{ json .input.text }}}
```

Rules:

- Missing template keys are errors.
- Template functions are hermetic; functions for environment access, network lookup, time, randomness, and crypto key generation are not available.
- Schema defaults are applied to `with`, then the result is validated, then the template is rendered during DAG load.

### Typed Input Injection

Use `$input` when a rendered field should be copied directly from custom-step `with` instead of rendered as a string template.

At the call site, `with` becomes the custom step input:

```yaml
steps:
  - type: say
    with:
      message: 'Review "quoted" text'
```

Inside `template`, this copies the validated `message` value into the rendered step:

```yaml
template:
  exec:
    command: /bin/echo
    args:
      - {$input: message}
```

The expanded builtin step receives:

```yaml
exec:
  command: /bin/echo
  args:
    - 'Review "quoted" text'
```

`$input` path resolution is relative to the validated input object after schema defaults are applied. It supports dotted object fields and numeric array indexes such as `items.0.name`.

Use `$input` for whole-field values such as argv entries, prompts, booleans, numbers, arrays, or objects. The copied value keeps its type and is not parsed as Go template text. For embedded text, use normal Go template syntax inside a string field.

## Runtime Expressions

Custom step templates are rendered while the DAG is loaded, before a step starts running. They are not rendered again when the step executes. This means runtime values cannot change Go template control flow and cannot change the static step graph.

Rule of thumb:

- Go template actions are custom-step template rendering at DAG load time.
- `${...}`, `$VAR`, and backtick expressions are Dagu runtime expressions evaluated later by the expanded builtin step.
- Runtime expressions can be passed through custom step templates, but they cannot control Go template `if`, `range`, or other load-time template logic.

Runtime expressions are still valid when they end up in fields that Dagu evaluates at execution time, such as command strings, command arguments, scripts, or executor config strings.

If a runtime expression is written directly in `template`, it is ordinary text during custom template rendering. For example, `${COUNT}` is not Go template syntax, so it stays `${COUNT}` in the expanded builtin step. It expands later when that builtin step executes, provided it is in a runtime-evaluated field.

```yaml
type: graph

step_types:
  echo_count:
    type: command
    input_schema:
      type: object
      additionalProperties: false
      properties: {}
    template:
      exec:
        command: /bin/echo
        args:
          - ${COUNT}

steps:
  - id: produce
    exec:
      command: /bin/echo
      args: [7]
    output: COUNT

  - id: consume
    depends: [produce]
    type: echo_count
    output: OUT
```

Runtime expressions can also come from custom-step `with` and be passed through the template:

```yaml
type: graph

step_types:
  repeat:
    type: command
    input_schema:
      type: object
      additionalProperties: false
      required: [count]
      properties:
        count:
          type: integer
    template:
      exec:
        command: /bin/echo
        args:
          - {$input: count}

steps:
  - id: produce
    exec:
      command: /bin/echo
      args: [3]
    output: COUNT

  - id: consume
    depends: [produce]
    type: repeat
    with:
      count: ${COUNT}
    output: OUT
```

In this example, `with.count` is declared as an integer, but `${COUNT}` is accepted by load/save validation because it is a whole runtime expression. The template injects the literal string `${COUNT}` into the expanded builtin step. The command executor evaluates it when `consume` runs, after `produce` has written `COUNT`.

Validation rules for runtime expressions in custom `with` input are intentionally narrow:

- String schema fields can contain embedded runtime expressions, such as `prefix-${NAME}`.
- Integer, number, boolean, and scalar enum fields can use a runtime expression only as the whole value, such as `${COUNT}`, `$COUNT`, or `` `cat count.txt` ``.
- Nested object properties and array items follow the same rule when their schema declares one of those scalar forms.
- Unknown fields, missing required fields, invalid additional properties, and non-runtime invalid values are still rejected.
- Custom input schema validation is not repeated after the runtime expression expands. The expanded builtin step and executor handle the final runtime value.

## Script Templates

For `command`-backed or `shell`-backed custom step types, `template.script` is usually the simplest and most common option.

```yaml
step_types:
  bash_snippet:
    type: command
    input_schema:
      type: object
      additionalProperties: false
      required: [message]
      properties:
        message:
          type: string
    template:
      script: |
        #!/bin/bash
        printf '%s\n' {{ json .input.message }}

steps:
  - type: bash_snippet
    with:
      message: xxx
```

Rules:

- Put `script` in the custom step `template`, not at the custom-step call site.
- If `template.script` has a shebang and you do not set `template.shell`, the shebang interpreter is used.
- If you set `template.shell`, that shell runs the script instead, so the shebang is not used for interpreter selection.

## Call-Site Fields

When a step uses a custom type, `with` is input to the custom definition. It is not merged directly into builtin executor configuration.

Allowed call-site fields:
`name`, `id`, `description`, `depends`, `continue_on`, `retry_policy`, `repeat_policy`, `mail_on_error`, `preconditions`, `signal_on_stop`, `env`, `timeout_sec`, `stdout`, `stderr`, `log_output`, `worker_selector`, `output`, `approval`.

Rejected call-site fields:
`command`, `exec`, `script`, `shell`, `shell_packages`, `working_dir`, `call`, `params`, `parallel`, `container`, `llm`, `messages`, `agent`, `value`, `routes`.

If you need one of the rejected fields, put it in `template`.

Precedence for custom step expansion is:

- Explicit allowed call-site fields override the rendered template.
- Explicit fields in the rendered template override DAG or base-config `defaults`.
- Additive fields compose in this order: `defaults`, then `template`, then explicit call-site values.

For additive fields, this means:

- `env` entries from `defaults` are prepended before `template.env`, and explicit call-site `env` entries are appended last.
- `preconditions` from `defaults` run before `template.preconditions`, and explicit call-site `preconditions` run last.

## Base Config Example

`base.yaml`

```yaml
step_types:
  greet:
    type: command
    input_schema:
      type: object
      additionalProperties: false
      required: [message]
      properties:
        message:
          type: string
    template:
      script: |
        #!/bin/bash
        printf '%s\n' {{ json .input.message }}
```

`hello.yaml`

```yaml
steps:
  - type: greet
    with:
      message: hello from base
```

Every DAG loaded with that base config can use `type: greet`.

## Handlers

Custom step types can be used in `steps` and in `handler_on`.

```yaml
step_types:
  notify:
    type: http
    input_schema:
      type: object
      additionalProperties: false
      required: [url, text]
      properties:
        url:
          type: string
        text:
          type: string
    template:
      command: POST {{ .input.url }}
      with:
        headers:
          Content-Type: application/json
        body: |
          {"text": {{ json .input.text }}}

handler_on:
  success:
    type: notify
    with:
      url: https://hooks.example.com/workflow
      text: completed
```

## Direct Exec

For `command`-backed or `shell`-backed custom step templates, use `exec` when you want explicit argv with no shell parsing.

```yaml
steps:
  - exec:
      command: /usr/bin/python3
      args:
        - -u
        - script.py
        - --limit
        - 10
```

For custom step types whose `type` is `command` or `shell`, `template.exec` is valid. It is mutually exclusive with `command` and `script`, and it cannot be combined with `shell` or `shell_packages`.

## Related

- [YAML Specification](/writing-workflows/yaml-specification)
- [Base Configuration](/server-admin/base-config)
- [Shell](/step-types/shell)
