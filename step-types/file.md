# File

Read, write, copy, move, delete, create, inspect, and list local files from workflow steps without wrapping filesystem operations in shell scripts.

Use `file.*` for arbitrary local paths on the machine running the step. Use [`artifact.*`](/step-types/artifact) when the file is a DAG-run output that should be stored, viewed, or downloaded from Dagu.

## Basic Usage

```yaml
steps:
  - id: write_report
    action: file.write
    with:
      path: reports/summary.txt
      content: "status=ok\n"
      create_dirs: true

  - id: read_report
    action: file.read
    with:
      path: reports/summary.txt
    output: REPORT_TEXT
    depends: write_report
```

Relative paths resolve from the step working directory. Absolute paths and `~` are also supported.

## Actions

| Action | Description |
|--------|-------------|
| `file.stat` | Write file metadata as JSON. |
| `file.read` | Read a file to stdout, or emit JSON with metadata and content. |
| `file.write` | Write text content to a file. |
| `file.copy` | Copy a file, symlink, or directory. |
| `file.move` | Move a file or directory. |
| `file.delete` | Delete a file or directory. |
| `file.mkdir` | Create a directory path. |
| `file.list` | List directory entries as JSON. |

## Read

By default, `file.read` writes raw file content to stdout:

```yaml
steps:
  - id: read_config
    action: file.read
    with:
      path: config/app.yaml
    output: APP_CONFIG
```

Use `format: json` to include metadata and content in one JSON object:

```yaml
steps:
  - id: read_metadata
    action: file.read
    with:
      path: config/app.yaml
      format: json
      max_bytes: 1048576
```

`max_bytes` rejects files larger than the configured size before reading them. The default `0` means no limit.

## Write

```yaml
steps:
  - id: write_config
    action: file.write
    with:
      path: output/config.json
      content: '{"enabled":true}'
      create_dirs: true
      overwrite: true
      mode: "0600"
```

`file.write` creates new files with mode `0600` by default. Existing files are not replaced unless `overwrite: true` is set. When overwriting, `atomic: true` is the default.

## Copy And Move

```yaml
steps:
  - id: copy_report
    action: file.copy
    with:
      source: reports/latest.csv
      destination: archive/latest.csv
      create_dirs: true
      overwrite: true

  - id: move_archive
    action: file.move
    with:
      source: archive
      destination: archive-ready
      recursive: true
    depends: copy_report
```

Copying or moving directories requires `recursive: true`. `file.copy` refuses to place a copied directory inside its own source path.

## Delete And Mkdir

```yaml
steps:
  - id: make_workspace
    action: file.mkdir
    with:
      path: work/imports
      mode: "0750"

  - id: cleanup_workspace
    action: file.delete
    with:
      path: work/imports
      recursive: true
    depends: make_workspace
```

`file.mkdir` creates parent directories as needed and defaults to mode `0750`. `file.delete` requires `recursive: true` for directories and refuses to delete the filesystem root. Set `missing_ok: true` when a missing target should count as success.

## List

```yaml
steps:
  - id: list_reports
    action: file.list
    with:
      path: reports
      recursive: true
      pattern: "**/*.csv"
      include_dirs: false
    output: REPORTS
```

`pattern` uses glob syntax against slash-separated paths relative to the listed directory. `file.list` writes JSON containing matching entries and file counts.

## Fields

| Field | Actions | Type | Default | Description |
|-------|---------|------|---------|-------------|
| `path` | stat, read, write, delete, mkdir, list | string | - | Target file or directory path. |
| `source` | copy, move | string | - | Source path. |
| `destination` | copy, move | string | - | Destination path. |
| `content` | write | string | - | Text content to write. |
| `mode` | write, mkdir | string | `0600` for write, `0750` for mkdir | Octal file or directory mode such as `0600` or `0750`. |
| `format` | read | string | `raw` | `raw` or `json`. |
| `pattern` | list | string | - | Glob pattern matched against relative paths. |
| `overwrite` | write, copy, move | boolean | `false` | Replace an existing destination. |
| `create_dirs` | write, copy, move | boolean | `false` | Create missing parent directories. |
| `atomic` | write | boolean | `true` | Use atomic replacement when overwriting files. |
| `recursive` | copy, move, delete, list | boolean | `false` | Recurse into directories or allow directory deletion. |
| `missing_ok` | stat, delete | boolean | `false` | Succeed when the target path is missing. |
| `dry_run` | write, copy, move, delete, mkdir | boolean | `false` | Report what would happen without mutating files. |
| `include_dirs` | list | boolean | `false` | Include directories in list output. |
| `follow_symlinks` | stat, copy | boolean | `false` | Follow the top-level source symlink. |
| `max_bytes` | read | integer | `0` | Maximum bytes to read. Zero means no limit. |

## Output

All file actions write JSON to stdout except `file.read` with the default `format: raw`. Capture JSON output with `output:` when later steps need metadata such as paths, sizes, or counts.
