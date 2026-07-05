# Log

Write a message to stdout without running a shell command. Use `action: log.write` for progress markers, status messages, and values you want to expose in the DAG run log without wrapping `echo` in a shell step.

## Basic Usage

```yaml
params:
  - ENVIRONMENT: production

steps:
  - id: announce
    action: log.write
    with:
      message: "Deploying to ${params.ENVIRONMENT}"
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

`log.write` only accepts `with.message`. Other `with` fields are rejected during validation.

## Variables

`message` is evaluated like other executor configuration fields, so it can reference params, DAG environment variables, secrets, and outputs from previous steps.

```yaml
params:
  - ENVIRONMENT: staging

steps:
  - id: version
    run: |
      version="$(git rev-parse --short HEAD)"
      printf 'version=%s\n' "$version" >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: version

  - id: announce
    action: log.write
    with:
      message: "Deploying ${steps.version.outputs.version} to ${params.ENVIRONMENT}"
    depends: version
```

## Capturing Output

Because `log` writes to stdout, you can capture the message with `output:` and reuse it later.

```yaml
params:
  - VERSION: v1.2.3

steps:
  - id: release_line
    run: |
      printf 'release_line=%s\n' "release=${params.VERSION}" >> "$DAGU_OUTPUT_FILE"
    outputs:
      - name: release_line

  - id: use_release_line
    run: printf '%s\n' "${steps.release_line.outputs.release_line}"
    depends: release_line
```

## When to Use `log`

Use `log.write` when the step only needs to emit text. Use `run` when you need shell features such as pipelines, redirects, command substitution, or conditional logic.

`log.write` does not support shell commands or scripts.
