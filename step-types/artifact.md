# Artifact

Write, read, and list DAG-run artifacts without referencing `DAG_RUN_ARTIFACTS_DIR` directly. Use `artifact.write` for explicit artifact content, and use `stdout.artifact` / `stderr.artifact` on command steps when the command stream itself should become the artifact.

Using an `artifact.*` action or artifact stream output automatically enables artifact storage for the DAG. If `artifacts.enabled: false` is set explicitly, artifact actions and artifact stream outputs are invalid. References to `DAG_RUN_ARTIFACTS_DIR` also auto-enable artifact storage, but command streams are usually clearer with `stdout.artifact` or `stderr.artifact`. After artifact storage is active, value-resolved fields can read the same path with `${context.paths.artifacts_dir}`.

## Command Stream Output

When a command produces large report, JSON, Markdown, or log content, attach stdout or stderr directly to an artifact instead of capturing it with `output:` or redirecting through shell:

```yaml
steps:
  - id: report
    run: ./generate-report --format markdown
    stdout:
      artifact: reports/report.md

  - id: diagnostics
    run: ./collect-diagnostics
    stderr:
      artifact: logs/diagnostics.err
```

Artifact stream paths are relative to the DAG-run artifact directory. Parent directories are created automatically. Absolute paths, Windows drive paths, and paths containing `..` are rejected.

## Actions

| Action | Description |
|--------|-------------|
| `artifact.write` | Write text content to a run artifact. |
| `artifact.read` | Read a run artifact to stdout. |
| `artifact.list` | List run artifacts as JSON. |

## Write

```yaml
steps:
  - id: save_report
    action: artifact.write
    with:
      path: reports/summary.md
      content: |
        # Summary
        status: ok
      overwrite: true
```

`path` is relative to the DAG-run artifact directory. Parent directories are created automatically. Absolute paths, Windows drive paths, and paths containing `..` are rejected.

## Read

```yaml
steps:
  - id: read_report
    action: artifact.read
    with:
      path: reports/summary.md
    output: REPORT
```

By default, `artifact.read` writes the file content to stdout. Use `format: json` to emit metadata and content as JSON:

```yaml
steps:
  - action: artifact.read
    with:
      path: reports/summary.md
      format: json
```

## List

```yaml
steps:
  - id: list_reports
    action: artifact.list
    with:
      path: reports
      recursive: true
      pattern: "**/*.md"
```

`artifact.list` writes JSON to stdout with artifact-relative paths.

## Fields

| Field | Actions | Type | Default | Description |
|-------|---------|------|---------|-------------|
| `path` | all | string | `.` for list | Artifact-relative path. Required for write and read. |
| `content` | write | string | - | Text content to write. |
| `overwrite` | write | boolean | `false` | Replace an existing artifact. |
| `atomic` | write | boolean | `true` | Write by atomic replacement when overwriting. |
| `mode` | write | string | `0600` | File mode such as `0600` or `0644`. |
| `format` | read | string | `raw` | `raw` or `json`. |
| `max_bytes` | read | integer | `0` | Maximum bytes to read. Zero means no limit. |
| `recursive` | list | boolean | `false` | Include nested files. |
| `include_dirs` | list | boolean | `false` | Include directories in the JSON entries. |
| `pattern` | list | string | - | Glob pattern matched against artifact-relative paths. |

Use `file.*` when you need to operate on arbitrary local paths. Use `artifact.*` when the file is part of the DAG-run output that users should inspect or download from Dagu.
