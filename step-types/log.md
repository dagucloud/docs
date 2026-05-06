# Log

Write a message to stdout without running a shell command. Use `log` for progress markers, status messages, and values you want to expose in the DAG run log without wrapping `echo` in a `command` step.

## Basic Usage

```yaml
params:
  - ENVIRONMENT: production

steps:
  - id: announce
    type: log
    with:
      message: "Deploying to ${ENVIRONMENT}"
```

The step writes this line to stdout:

```text
Deploying to production
```

If `message` does not end with a newline, Dagu appends one.

## Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | Message to write to stdout. Supports Dagu variable substitution. |

`log` only accepts `with.message`. Other `with` fields are rejected during validation.

## Variables

`message` is evaluated like other executor configuration fields, so it can reference params, DAG environment variables, secrets, and outputs from previous steps.

```yaml
type: graph

params:
  - ENVIRONMENT: staging

steps:
  - id: version
    command: git rev-parse --short HEAD
    output: VERSION

  - id: announce
    depends: version
    type: log
    with:
      message: "Deploying ${VERSION} to ${ENVIRONMENT}"
```

## Capturing Output

Because `log` writes to stdout, you can capture the message with `output:` and reuse it later.

```yaml
type: graph

params:
  - VERSION: v1.2.3

steps:
  - id: release_line
    type: log
    with:
      message: "release=${VERSION}"
    output: RELEASE_LINE

  - id: use_release_line
    depends: release_line
    command: printf '%s\n' "${RELEASE_LINE}"
```

## When to Use `log`

Use `log` when the step only needs to emit text. Use a shell `command` or `script` step when you need shell features such as pipelines, redirects, command substitution, or conditional logic.

`log` does not support `command`, `script`, or multi-command arrays.
