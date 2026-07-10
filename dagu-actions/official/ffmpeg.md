# FFmpeg (`ffmpeg@v1`)

Run FFmpeg or ffprobe from a Dagu workflow without baking FFmpeg into worker images.

- Repository: [`dagucloud/ffmpeg`](https://github.com/dagucloud/ffmpeg)
- Runtime owned by the action: `Tyrrrz/FFmpegBin@8.1` and `nodejs/node@v22.21.1` through action `tools`

Contributions are welcome. The repository is public, so improvements, bug reports, and pull requests can go to [`dagucloud/ffmpeg`](https://github.com/dagucloud/ffmpeg).

## Example

```yaml
steps:
  - id: convert
    action: ffmpeg@v1
    with:
      overwrite: true
      args: >-
        -i input.mov -c:v libx264 -c:a aac "${context.paths.artifacts_dir}/converted/output.mp4"
```

`args` is the FFmpeg or ffprobe argument string excluding the executable name. It is parsed into argv by the action wrapper, not by a shell. For exact argument boundaries, pass a JSON array string:

```yaml
args: '["-i","input.mov","-c:v","libx264","-c:a","aac","output.mp4"]'
```

The action runs `ffmpeg` by default and prepends automation-safe options:

- `-hide_banner` unless `hideBanner: false`
- `-nostdin` unless `nostdin: false`
- `-n` by default, or `-y` when `overwrite: true`

Use `command: ffprobe` to inspect media and capture probe output:

```yaml
steps:
  - id: inspect
    action: ffmpeg@v1
    with:
      command: ffprobe
      args: >-
        -v error -print_format json -show_format -show_streams /data/video.mp4

  - id: print_probe
    env:
      - PROBE_OUTPUT: ${steps.inspect.outputs.stdout}
    run: printf '%s\n' "$PROBE_OUTPUT"
    depends: inspect
```

## Inputs

| Field | Description |
|-------|-------------|
| `args` | Required shell-style arguments passed to `ffmpeg` or `ffprobe`, excluding the executable name. JSON array strings are also accepted. |
| `command` | `ffmpeg` or `ffprobe`. Defaults to `ffmpeg`. |
| `workdir` | Optional working directory for the command. |
| `env` | Extra environment variables as newline-delimited `KEY=value` entries. JSON object strings are also accepted. |
| `timeoutSeconds` | Command timeout in seconds. Defaults to `3600`. |
| `overwrite` | For `ffmpeg`, pass `-y` when true; otherwise pass `-n`. |
| `hideBanner` | Pass `-hide_banner`. Defaults to `true`. |
| `nostdin` | For `ffmpeg`, pass `-nostdin`. Defaults to `true`. |
| `maxOutputBytes` | Maximum bytes captured from stdout and stderr. Defaults to `1048576`. |

## Outputs

| Field | Description |
|-------|-------------|
| `ok` | `true` when the command exits with status 0 before timeout. |
| `exitCode` | Process exit code, or `-1` when the process was terminated before producing one. |
| `signal` | Signal name when the process was terminated by a signal. |
| `command` | `ffmpeg` or `ffprobe`. |
| `args` | Final argument list passed to the command, including action-managed defaults. |
| `stdout` / `stderr` | Captured stdout and stderr, truncated to `maxOutputBytes`. |
| `durationMs` | Wrapper-measured command duration in milliseconds. |
| `timedOut` | `true` when `timeoutSeconds` was reached. |
| `truncated` | Object with `stdout` and `stderr` booleans. |
| `error` | Error object when validation or process startup fails. |

Do not use action outputs to carry large media data. Write media files under `${context.paths.artifacts_dir}`, a shared mounted path, or object storage.

## Related

- [Official Dagu Actions](/dagu-actions/official)
- [Action Package Execution](/dagu-actions/execution-model)
