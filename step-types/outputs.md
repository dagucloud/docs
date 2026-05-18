# Outputs Action

Publish DAG or packaged action outputs without parsing stdout in the caller.

Use `action: outputs.write` when a workflow needs to return a small structured result assembled from literals, parameters, or previous step outputs:

```yaml
steps:
  - id: publish_result
    action: outputs.write
    with:
      values:
        messageId: msg-123
        status: sent
```

The values are added to the run outputs and are available to downstream steps as:

```yaml
${publish_result.outputs.messageId}
${publish_result.outputs.status}
```

When the step is inside an action package workflow, the parent workflow reads those fields from the action step:

```yaml
steps:
  - id: notify
    action: acme/dagu-action-notify@v1.2.0
    with:
      text: "Deploy finished"

  - id: audit
    run: echo "Message: ${notify.outputs.messageId}"
    depends: [notify]
```

## Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `values` | object | yes | Output fields to publish. Must contain at least one key. |

Values should be small JSON-compatible values. Use [Artifacts](/writing-workflows/artifacts) for files, reports, logs, screenshots, or large JSON payloads.

`outputs.write` does not validate an action manifest by itself. When the step runs inside an action package workflow, Dagu validates the final collected action output object against the `outputs` schema in `dagu-action.yaml` after the action workflow returns.

## Stdout Outputs

If a command already writes the boundary result to stdout, use `stdout.outputs` instead of adding a separate `outputs.write` step:

```yaml
steps:
  - id: notify
    run: ./notify.sh
    stdout:
      outputs:
        decode: json
```

Use `fields` to publish only selected values:

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
```

## Related

- [Workflow Outputs](/writing-workflows/outputs)
- [Third-Party Actions](/dagu-actions/third-party)
- [Artifacts](/writing-workflows/artifacts)
