# Custom Actions

`actions` defines reusable, typed actions that expand to built-in step types when a workflow is loaded. Use them when several DAGs should share the same validated call shape without copying executor-specific YAML everywhere.

## Basic Shape

```yaml
actions:
  release.announce:
    description: Print a reusable release announcement
    input_schema:
      type: object
      additionalProperties: false
      required: [channel, version]
      properties:
        channel:
          type: string
          enum: [changelog, email, slack]
        version:
          type: string
        summary:
          type: string
          default: Ready for rollout
    template:
      run: echo {{ json .input.channel }} release {{ json .input.version }} - {{ json .input.summary }}

steps:
  - id: build
    output:
      version: "v1.2.3"

  - id: announce
    action: release.announce
    with:
      channel: changelog
      version: ${build.output.version}
    depends: build
```

The call site stays consistent:

- `action` chooses the reusable action.
- `with` is validated against the action's `input_schema`.
- The rendered `template` becomes the actual step that Dagu executes.

## Where To Declare Actions

- At the top level of a DAG document.
- In `base.yaml`, so every DAG can inherit the same action definitions.
- DAG-local actions are visible only inside the YAML document that declares them.
- Base-config and DAG-local actions are merged per YAML document.
- A DAG-local action that duplicates a base-config action name is rejected.

## Definition Fields

| Field | Required | Description |
|-------|----------|-------------|
| `description` | No | Human-readable description copied to expanded steps unless the call site overrides it. |
| `input_schema` | Yes | Inline JSON Schema object for `with`. The schema must resolve to an object schema. |
| `output_schema` | No | Inline JSON Schema object for JSON stdout validation. |
| `template` | Yes | Canonical step fragment using `run` or `action` plus workflow-control fields. |

Action names must match:

```text
^[A-Za-z][A-Za-z0-9_-]*(\.[A-Za-z][A-Za-z0-9_-]*)*$
```

Custom action names cannot reuse built-in step type names such as `http.request`, `dag.run`, `dag.enqueue`, `template.render`, or `agent.run`.

## Template Rules

String values inside `template` are rendered with Go `text/template` using `.input` as the validated input object. Custom action templates expose the same template functions as [Template](/step-types/template), plus `json`, which returns a JSON-safe encoding of a value.

```yaml
actions:
  webhook.send:
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
      action: http.request
      with:
        method: POST
        url: "{{ .input.url }}"
        headers:
          Content-Type: application/json
        body: |
          {"text": {{ json .input.text }}}
```

Rules:

- Missing template keys are errors.
- Template functions are hermetic; environment, network, clock, random, and crypto helpers are not available.
- `template` must use canonical execution fields such as `run` or `action`. Legacy fields such as `command`, `script`, `type`, `call`, `messages`, `agent`, `value`, and `routes` are rejected for custom action templates.
- Runtime expressions such as `${BUILD_ID}` are ordinary text during template rendering and are evaluated later by the expanded step if they land in a runtime-evaluated field.

## Typed Input Injection

Use `$input` when a rendered field should keep the original JSON type instead of becoming a string template result.

```yaml
actions:
  say.exec:
    input_schema:
      type: object
      additionalProperties: false
      required: [message]
      properties:
        message:
          type: string
    template:
      action: exec
      with:
        command: /bin/echo
        args:
          - {$input: message}

steps:
  - action: say.exec
    with:
      message: 'Review "quoted" text'
```

`$input` paths are relative to the validated input object after schema defaults are applied. They support dotted object fields and numeric array indexes such as `items.0.name`.

## Output Contracts

Use `output_schema` when a custom action emits machine-readable JSON:

```yaml
actions:
  ticket.classify:
    input_schema:
      type: object
      additionalProperties: false
      required: [text]
      properties:
        text:
          type: string
    output_schema:
      type: object
      additionalProperties: false
      required: [category, priority]
      properties:
        category:
          type: string
          enum: [bug, feature, question]
        priority:
          type: string
          enum: [low, medium, high]
    template:
      run: |
        uv run --python 3.13.9 python - <<'PY'
        import json
        print(json.dumps({"category": "bug", "priority": "high"}))
        PY

tools:
  - astral-sh/uv@0.11.14

steps:
  - id: classify
    action: ticket.classify
    with:
      text: "App crashes on startup"

  - id: route
    run: echo "${classify.output.category}:${classify.output.priority}"
    depends: classify
```

Rules:

- `stdout` must contain valid JSON that matches `output_schema`.
- Human-readable logs should go to `stderr`.
- If the call site does not set `output:`, the decoded JSON object is published as `${step_id.output.*}`.
- If the call site sets object-form `output:`, Dagu validates stdout first, then applies the explicit output mapping.

## Call-Site Fields

Allowed call-site fields are workflow-control fields:

```text
id, name, description, depends, continue_on, retry_policy, repeat_policy,
mail_on_error, preconditions, signal_on_stop, env, timeout_sec, stdout,
stderr, log_output, worker_selector, output, approval
```

Execution fields belong in the action template, not at the call site. A custom action call uses only:

```yaml
steps:
  - action: release.announce
    with:
      channel: slack
      version: v1.2.3
```

## Base Config Example

`base.yaml`

```yaml
actions:
  notify.success:
    input_schema:
      type: object
      additionalProperties: false
      required: [message]
      properties:
        message:
          type: string
    template:
      action: log.write
      with:
        message: {$input: message}
```

`hello.yaml`

```yaml
steps:
  - action: notify.success
    with:
      message: hello from base
```

## Legacy `step_types`

`step_types` remains loadable for backward compatibility, but it is deprecated. `dagu validate` reports a deprecation warning for legacy definitions while still returning success when there are no real validation errors. New workflows should use `actions`.

## Related

- [Dagu Actions](/dagu-actions/)
- [YAML Specification](/writing-workflows/yaml-specification)
- [Base Configuration](/server-admin/base-config)
- [Step Types](/step-types/shell)
