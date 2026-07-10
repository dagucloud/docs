# Rclone (`rclone@v1`)

Run portable copy, sync, check, list, or storage-management workflows across rclone-supported backends.

- Repository: [`dagucloud/rclone`](https://github.com/dagucloud/rclone)
- Runtime owned by the action: `rclone/rclone@v1.74.1` and `nodejs/node@v22.21.1` through action `tools`

Contributions are welcome. The repository is public, so improvements, bug reports, and pull requests can go to [`dagucloud/rclone`](https://github.com/dagucloud/rclone).

## Example

```yaml
steps:
  - id: list_files
    action: rclone@v1
    with:
      command: lsf
      source: /data/input

  - id: print
    env:
      - FILE_LIST: ${steps.list_files.outputs.stdout}
    run: printf '%s\n' "$FILE_LIST"
    depends: list_files
```

The action returns a JSON output object. Use `${steps.step_id.outputs.stdout}` for small listings or command output. For large listings, exports, or command logs, write to an artifact instead of routing the data through action outputs.

Use `copy` when the destination should accumulate or update files without mirroring deletions:

```yaml
steps:
  - id: copy_to_backup
    action: rclone@v1
    with:
      command: copy
      source: /data/reports
      destination: backup:reports
      checksum: true
      transfers: 4
```

`sync`, `move`, `moveto`, `rmdir`, `delete`, and `purge` are treated as destructive. They fail unless either `dryRun: true` or `allowDestructive: true` is set:

```yaml
steps:
  - id: preview_sync
    action: rclone@v1
    with:
      command: sync
      source: /data/reports
      destination: backup:reports
      dryRun: true

  - id: run_sync
    action: rclone@v1
    with:
      command: sync
      source: /data/reports
      destination: backup:reports
      allowDestructive: true
    depends: preview_sync
```

## Inputs

| Field | Description |
|-------|-------------|
| `command` | Required rclone command to run. |
| `source` | Source path or remote, required by commands that read from a path. |
| `destination` | Destination path or remote, required by two-path commands. |
| `configPath` | Optional path passed with `--config`. |
| `workdir` | Optional directory to `cd` into before running rclone. |
| `dryRun` | Add `--dry-run`. |
| `allowDestructive` | Required for destructive commands unless `dryRun` is true. |
| `checksum` | Add `--checksum`. |
| `fastList` | Add `--fast-list`. |
| `verbose` | Add `-v`. |
| `stats` | Optional value for `--stats`, such as `30s` or `0`. |
| `logLevel` | Optional `DEBUG`, `INFO`, `NOTICE`, or `ERROR`. |
| `transfers` / `checkers` | Optional values for `--transfers` and `--checkers`. |
| `include` / `exclude` / `filter` | Repeated include, exclude, and filter rules. |
| `extraArgs` | Additional rclone flags passed after the command and before paths. |
| `env` | Extra environment variables exposed to rclone. |
| `maxOutputBytes` | Maximum stdout and stderr bytes captured into action outputs. Defaults to `1048576`. |

## Outputs

| Field | Description |
|-------|-------------|
| `ok` | `true` when rclone exits with code 0. |
| `command` | rclone command that was run. |
| `stdout` / `stderr` | Captured rclone stdout and stderr. |
| `stdoutTruncated` / `stderrTruncated` | Whether stdout or stderr capture was truncated. |
| `durationMs` | Wrapper-measured command duration in milliseconds. |
| `exitCode` | rclone process exit code. |
| `error` | Error message when validation or rclone execution fails. |

For large listings, attach rclone stdout directly to an artifact by calling the pinned CLI in a normal step:

```yaml
tools:
  - rclone/rclone@v1.74.1

steps:
  - id: list_large_tree
    run: rclone lsf backup:reports --recursive
    stdout:
      artifact: rclone/reports.txt
```

## Related

- [Official Dagu Actions](/dagu-actions/official)
- [Action Package Execution](/dagu-actions/execution-model)
