# Outputs

Capture small step results, publish structured values, and return final run or action outputs.

## Overview

Dagu has three related output surfaces:

- **String form** captures a step's trimmed stdout into one variable such as `${VERSION}`.
- **Object form** publishes structured step-scoped output for `${step_id.output.*}` references.
- **DAG/action outputs** publish values for the run's Outputs tab and for packaged action callers through `${step_id.outputs.*}`.

These modes solve different problems:

- Use **string form** when you want a flat variable and a final `outputs.json` entry.
- Use **object form** when one step needs structured downstream data through `${step_id.output.*}`.
- Use **DAG/action outputs** when the whole DAG or packaged action should return values to its caller.

Use `output:` for small values. If a step produces a large report, JSON dump, Markdown document, or log that users should inspect later, write the stream directly to an artifact with `stdout.artifact` or `stderr.artifact` instead:

```yaml
steps:
  - id: report
    run: ./generate-report --format markdown
    stdout:
      artifact: reports/report.md
```

## String Form

Capture stdout into a variable and include it in the DAG run's `outputs.json`:

```yaml
steps:
  - id: get_version
    run: cat VERSION
    output: VERSION

  - id: build_image
    run: docker build -t myapp:${VERSION} .
    depends: get_version
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
    run: |
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
    run: |
      echo "Deploying ${inspect_build.output.version}"
      echo "Artifact: ${inspect_build.output.artifact.url}"
    depends: [inspect_build]
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

Plain objects stay literal unless they use one of the reserved long-form keys: `value`, `from`, `path`, `decode`, or `select`.
If you need a literal object containing one of those keys, wrap it with `value:`.

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

`value` cannot be combined with `from`, `path`, `decode`, or `select`.

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
- `${id.outputs}` - DAG/action outputs published by that step as compact JSON
- `${id.outputs.field}` - one field from the published DAG/action outputs

Nested access works when the output value is structured JSON:

```yaml
steps:
  - id: build
    run: echo '{"version":"v1.2.3"}'
    output: BUILD_JSON

  - id: print_version
    run: echo "Version: ${build.output.version}"
    depends: build
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

## DAG and Action Outputs

Use `stdout.outputs` when the command's stdout is the value you want to return from the DAG or action.

String form captures stdout text into one output field:

```yaml
steps:
  - id: create_ticket
    run: ./create-ticket.sh
    stdout:
      outputs: ticketId
```

Object form can decode stdout as JSON or YAML. If no `field` is set, decoded JSON must be an object and each key becomes an output:

```yaml
steps:
  - id: notify
    run: ./notify.sh
    stdout:
      outputs:
        decode: json
```

Use `fields` when stdout has more data than the boundary should expose:

```yaml
steps:
  - id: notify
    run: ./notify.sh
    stdout:
      outputs:
        fields:
          messageId:
            decode: json
            select: .id
          status:
            decode: json
            select: .status
```

Use `outputs.write` when the result is assembled from prior step outputs or literal values:

```yaml
steps:
  - id: publish
    action: outputs.write
    with:
      values:
        messageId: msg-123
        status: sent
```

Packaged action callers read these values with `${notify.outputs.messageId}`. This is intentionally separate from `${notify.output.*}`, which is for step-scoped `output:` values.

When these values are produced inside an action package workflow, Dagu validates the final action output object against the `outputs` schema in `dagu-action.yaml` after the action workflow returns a run result. `stdout.outputs` and `outputs.write` publish values; the manifest schema is what validates the action boundary. If validation fails, the parent action step fails.

## Run Output Collection

When a DAG run completes, Dagu writes collected outputs to `outputs.json` for the Web UI and Outputs API.

Collected run outputs include string-form `output: NAME`, `stdout.outputs`, and `outputs.write`. Object-form `output:` stays step-scoped and is not collected unless the workflow explicitly republishes values through `stdout.outputs` or `outputs.write`.

Example:

```yaml
steps:
  - id: build
    run: cat VERSION
    output: BUILD_VERSION

  - id: test
    run: pytest --collect-only -q | tail -1
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

String-form `output: NAME` keys are converted from `SCREAMING_SNAKE_CASE` to `camelCase`. Keys from `stdout.outputs` and `outputs.write` are preserved.

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

- Captured stdout is limited by `max_output_size` (default 1MB). Use `stdout.artifact` for large command output that should be stored as a run artifact instead of a variable.
- Object-form `from: stdout`, `from: stderr`, and `from: file` use the same limit.
- For large or untrusted data, write to a file and pass the path downstream instead of capturing the content.

If you need secrets, use [Secrets](/writing-workflows/secrets) and avoid printing them to stdout.

## Related Documentation

- [Data Flow](/writing-workflows/data-flow) - Data passing patterns
- [Variables Reference](/writing-workflows/template-variables) - `${...}` syntax and step references
- [YAML Specification](/writing-workflows/yaml-specification) - Full field reference
- [API Reference](/overview/api) - Outputs endpoint
