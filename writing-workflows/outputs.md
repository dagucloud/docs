# Outputs

Capture small step results, publish structured values, and collect final run outputs.

## Overview

Dagu supports two `output:` modes:

- **String form** captures a step's trimmed stdout into one variable such as `${VERSION}`.
- **Object form** publishes structured step-scoped output for `${step_id.output.*}` references.

These modes solve different problems:

- Use **string form** when you want a flat variable and a final `outputs.json` entry.
- Use **object form** when you want structured downstream data without brittle `echo` glue.

## String Form

Capture stdout into a variable and include it in the DAG run's `outputs.json`:

```yaml
steps:
  - id: get_version
    command: cat VERSION
    output: VERSION

  - id: build_image
    command: docker build -t myapp:${VERSION} .
```

The captured stdout is trimmed and becomes:

- `${VERSION}` for downstream steps
- `${get_version.output}` for step-ID references
- `version` in `outputs.json`

The dollar prefix is optional:

```yaml
output: $VERSION
```

## Object Form

Object form publishes structured step output instead of a flat variable:

```yaml
steps:
  - id: inspect_build
    script: |
      printf '{"version":"v1.2.3","artifact":{"url":"https://example.test/app.tgz"}}'
    output:
      version:
        from: stdout
        decode: json
        select: .version
      artifact:
        from: stdout
        decode: json
        select: .artifact

  - id: deploy
    depends: [inspect_build]
    command: |
      echo "Deploying ${inspect_build.output.version}"
      echo "Artifact: ${inspect_build.output.artifact.url}"
```

### Entry Forms

#### Literal value

```yaml
output:
  versionLabel: "ver - ${build.output.version}"
  meta:
    env: stg
    approved: true
```

String leaves are expanded with normal `${...}` references. Backtick command substitution and shell expansion are not run in object-form output values.

#### Source-backed value

```yaml
output:
  version:
    from: stdout
    decode: json
    select: .version

  warning:
    from: stderr
    decode: json
    select: .warning

  reportPath:
    from: file
    path: build/report.json
    decode: json
    select: .path
```

### Supported Fields

| Field | Description |
|-------|-------------|
| `value` | Literal scalar, array, or object value to publish |
| `from` | Runtime source: `stdout`, `stderr`, or `file` |
| `path` | File path used when `from: file` |
| `decode` | `text`, `json`, or `yaml` |
| `select` | jq-style path applied after `decode: json` or `decode: yaml` |

### Publish-Only Steps

If a step only has object-form `output:` and no executor fields, Dagu treats it as a publish-only step:

```yaml
steps:
  - id: publish
    output:
      version: "${build.output.version}"
      versionLabel: "ver - ${build.output.version}"
```

This is useful for reshaping or renaming values without a fake `echo` step.

## Step References

Step IDs expose several properties:

- `${id.stdout}` - path to the stdout log file
- `${id.stderr}` - path to the stderr log file
- `${id.exit_code}` - exit code as a string
- `${id.output}` - captured string output or the full object-form payload as compact JSON

Nested access works when the output value is structured JSON:

```yaml
steps:
  - id: build
    command: echo '{"version":"v1.2.3"}'
    output: BUILD_JSON

  - command: echo "Version: ${build.output.version}"
```

For object-form output, nested access is the primary pattern:

```yaml
${inspect_build.output.version}
${inspect_build.output.artifact.url}
```

Substring slicing still works on the final string value:

```yaml
${build.output:0:5}
```

> `${id.stdout}` and `${id.stderr}` are file paths, not file content. Use `cat ${id.stdout}` to read the content.

## Run Output Collection

When a DAG run completes, Dagu writes collected outputs to `outputs.json` for the Web UI and Outputs API.

Only **string-form** `output: NAME` participates in `outputs.json` today.

Example:

```yaml
steps:
  - id: build
    command: cat VERSION
    output: BUILD_VERSION

  - id: test
    command: pytest --collect-only -q | tail -1
    output: TEST_COUNT
    depends: [build]
```

Result:

```json
{
  "outputs": {
    "buildVersion": "1.2.3",
    "testCount": "42 tests"
  }
}
```

Keys are converted from `SCREAMING_SNAKE_CASE` to `camelCase`.

If multiple steps write the same output variable name, the last collected value wins.

## Web UI and API

The Web UI **Outputs** tab and the REST outputs endpoint read from `outputs.json`:

```bash
GET /api/v1/dag-runs/{name}/{dagRunId}/outputs
```

Example response:

```json
{
  "metadata": {
    "dagName": "my-workflow",
    "dagRunId": "abc123",
    "attemptId": "attempt_001",
    "status": "succeeded",
    "completedAt": "2024-01-15T10:30:00Z",
    "params": "{\"env\":\"prod\"}"
  },
  "outputs": {
    "version": "1.2.3",
    "recordCount": "1000"
  }
}
```

Use `latest` as the run ID to fetch the most recent run's outputs.

## Size Limits and Safety

- Captured stdout is limited by `max_output_size` (default 1MB).
- Object-form `from: stdout`, `from: stderr`, and `from: file` use the same limit.
- For large or untrusted data, write to a file and pass the path downstream instead of capturing the content.

If you need secrets, use [Secrets](/writing-workflows/secrets) and avoid printing them to stdout.

## Related Documentation

- [Data Flow](/writing-workflows/data-flow) - Data passing patterns
- [Variables Reference](/writing-workflows/template-variables) - `${...}` syntax and step references
- [YAML Specification](/writing-workflows/yaml-specification) - Full field reference
- [API Reference](/overview/api) - Outputs endpoint
