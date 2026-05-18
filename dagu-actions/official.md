# Official Actions

Official actions are remote action packages maintained in the `dagucloud` GitHub organization. They use the same remote action runtime as any other package, but callers can use the short form:

```yaml
action: name@version
```

Dagu resolves that form to the GitHub repository `dagucloud/name`. For example, `python-script@v1` resolves to `dagucloud/python-script` at tag `v1`.

Versions are required. Pin production workflows to a version tag or commit SHA; a commit SHA is the strongest reproducibility boundary. The examples below use the current `v1` tags.

## Available Official Actions

| Action | Repository | Runtime owned by the action | Use when |
|--------|------------|-----------------------------|----------|
| `dbt@v1` | [`dagucloud/dbt`](https://github.com/dagucloud/dbt) | `astral-sh/uv@0.11.14` through action `tools`; default Python `3.13.9` | You need to run dbt Core commands with project-local adapter requirements. |
| `duckdb@v1` | [`dagucloud/duckdb`](https://github.com/dagucloud/duckdb) | `duckdb/duckdb@v1.5.2` through action `tools` | You need analytical SQL or file-backed DuckDB workflows without adding DuckDB bindings to the Dagu core binary. |
| `ffmpeg@v1` | [`dagucloud/ffmpeg`](https://github.com/dagucloud/ffmpeg) | `Tyrrrz/FFmpegBin@8.1` and `nodejs/node@v22.21.1` through action `tools` | You need media conversion, transcoding, probing, or stream processing without baking FFmpeg into worker images. |
| `github-cli@v1` | [`dagucloud/github-cli`](https://github.com/dagucloud/github-cli) | `cli/cli@v2.92.0` and `nodejs/node@v22.21.1` through action `tools` | You need GitHub repository, issue, pull request, release, or API automation from a workflow. |
| `node-script@v1` | [`dagucloud/node-script`](https://github.com/dagucloud/node-script) | `nodejs/node@v22.21.1` through action `tools` | You need a small JavaScript transform or glue step and want the action to provide Node.js. |
| `python-script@v1` | [`dagucloud/python-script`](https://github.com/dagucloud/python-script) | `astral-sh/uv@0.11.14` through action `tools`; default Python `3.13.9` | You need a small Python transform or glue step, optionally with pinned Python requirements. |
| `rclone@v1` | [`dagucloud/rclone`](https://github.com/dagucloud/rclone) | `rclone/rclone@v1.74.1` and `nodejs/node@v22.21.1` through action `tools` | You need portable file copy, sync, check, list, or storage-management workflows across rclone-supported backends. |

Action `tools` are prepared by Dagu's managed tools runtime, powered internally by [aqua](https://github.com/aquaproj/aqua) from [aquaproj](https://github.com/aquaproj).

Official actions are not sandboxes. The action runs with the same worker permissions, filesystem access, network access, and secrets available to the Dagu run. Only run trusted code.

## dbt: `dbt`

```yaml
steps:
  - id: dbt_build
    action: dbt@v1
    with:
      projectDir: /data/jaffle-shop
      profilesDir: /data/dbt-profiles
      requirements:
        - dbt-duckdb==1.10.1
      command: build
      targetPath: ${DAG_RUN_ARTIFACTS_DIR}/dbt-target
      logPath: ${DAG_RUN_ARTIFACTS_DIR}/dbt-logs

  - id: print_summary
    depends: [dbt_build]
    run: |
      echo "dbt exit code: ${dbt_build.outputs.exitCode}"
      echo "dbt run results: ${dbt_build.outputs.runResultsPath}"
```

`projectDir` must point to the directory containing `dbt_project.yml` on the worker that runs the action. Remote actions run in their own action workspace, so use absolute paths or paths that are meaningful on that worker.

Use `requirements` for pip-compatible dbt packages. The default is `dbt-core`, but most projects should pin an adapter package such as `dbt-duckdb==1.10.1`, `dbt-postgres==1.9.0`, or the adapter version used by your project.

Supported commands include `build`, `run`, `test`, `seed`, `snapshot`, `compile`, `deps`, `debug`, `parse`, `list`, `ls`, `show`, `run-operation`, `source freshness`, `docs generate`, and `clean`. Use `args` for command-specific flags that do not have a first-class input.

Inputs include:

| Field | Description |
|-------|-------------|
| `projectDir` | Required directory containing `dbt_project.yml`. |
| `command` | dbt command to run. Defaults to `build`. |
| `requirements` | Pip requirement specifiers installed with `uv run --with`. Defaults to `["dbt-core"]`. |
| `profilesDir` | Optional directory containing `profiles.yml`. |
| `profile` / `target` | Optional dbt profile and target names. |
| `select` / `exclude` | Repeated dbt selection and exclusion arguments. |
| `selector` | YAML selector name passed with `--selector`. |
| `vars` | Value passed with `--vars`; objects are encoded as compact JSON. |
| `threads` | Thread count passed with `--threads`. |
| `state` | State directory passed with `--state`. |
| `targetPath` / `logPath` | Directories passed with `--target-path` and `--log-path`. |
| `fullRefresh`, `failFast`, `warnError`, `defer`, `quiet` | Boolean dbt flags. |
| `args` | Additional raw dbt CLI arguments appended after structured options. |
| `env` | Extra environment variables exposed to the dbt process. |
| `pythonVersion` | Python version used by uv. Defaults to `3.13.9`. |
| `timeoutSeconds` | Timeout for the dbt process. Defaults to `3600`. |

Outputs include:

| Field | Description |
|-------|-------------|
| `ok` | `true` when dbt exits with code 0. |
| `exitCode` | dbt process exit code. |
| `command` | Full argv used to invoke dbt through uv. |
| `stdout` / `stderr` | Captured dbt stdout and stderr. |
| `durationMs` | Wrapper-measured dbt process duration in milliseconds. |
| `targetPath` / `logPath` | Effective dbt target and log paths. |
| `manifestPath` | Present when `manifest.json` exists under `targetPath`. |
| `runResultsPath` | Present when `run_results.json` exists under `targetPath`. |
| `catalogPath` | Present when `catalog.json` exists under `targetPath`. |
| `sourcesPath` | Present when `sources.json` exists under `targetPath`. |
| `error` | Validation or wrapper error object when dbt does not start. |

## DuckDB: `duckdb`

```yaml
steps:
  - id: query
    action: duckdb@v1
    with:
      query: |
        SELECT 42 AS answer, 'duckdb' AS engine;

  - id: print
    depends: [query]
    run: printf '%s\n' '${query.outputs.result}'
```

`query` is passed to `duckdb -c`. By default, the action uses DuckDB JSON output mode and publishes raw stdout as `${query.outputs.result}`, replacing `query` with your step id.

Use `database` to run against an existing file, `workdir` when SQL references files by relative path, and `readonly: true` for read-only inspection:

```yaml
steps:
  - id: summarize
    action: duckdb@v1
    with:
      workdir: /data/project
      database: analytics.duckdb
      readonly: true
      query: |
        SELECT count(*) AS events
        FROM read_csv_auto('events.csv');
```

Inputs include:

| Field | Description |
|-------|-------------|
| `query` | Required SQL passed to `duckdb -c`. |
| `database` | Optional DuckDB database file path. Omit for a transient in-memory database. |
| `workdir` | Optional directory to `cd` into before running DuckDB. |
| `format` | Output format: `json`, `csv`, `table`, `markdown`, `line`, `list`, or `column`. Defaults to `json`. |
| `readonly` | Open the database in read-only mode. Defaults to `false`. |

Outputs include:

| Field | Description |
|-------|-------------|
| `result` | Raw DuckDB stdout in the selected format. |

Use action output only for small results. For large rowsets, write to a run artifact from SQL with `COPY ... TO '${DAG_RUN_ARTIFACTS_DIR}/...'`, or call the pinned DuckDB CLI directly and attach stdout with `stdout.artifact`. The CLI is pinned through Dagu `tools`, which is powered by aqua from the aquaproj project:

```yaml
tools:
  - duckdb/duckdb@v1.5.2

steps:
  - id: export_rows
    run: |
      duckdb -batch -bail -no-stdin -csv /data/source.duckdb \
        -c "SELECT id, name, score FROM source_table WHERE score >= 80"
    stdout:
      artifact: exports/selected_rows.csv
```

See [DuckDB](/step-types/sql/duckdb) for database-file handling, multi-step workflows, import/export examples, and artifact patterns.

## FFmpeg: `ffmpeg`

```yaml
steps:
  - id: convert
    action: ffmpeg@v1
    with:
      overwrite: true
      args: >-
        -i input.mov -c:v libx264 -c:a aac "${DAG_RUN_ARTIFACTS_DIR}/converted/output.mp4"
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
    depends: [inspect]
    run: printf '%s\n' '${inspect.outputs.stdout}'
```

Inputs include:

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

Outputs include:

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

Do not use action outputs to carry large media data. Write media files under `${DAG_RUN_ARTIFACTS_DIR}`, a shared mounted path, or object storage.

## GitHub CLI: `github-cli`

```yaml
steps:
  - id: repo
    action: github-cli@v1
    with:
      repo: dagucloud/dagu
      args: ["repo", "view", "--json", "name,description,url"]

  - id: print
    depends: [repo]
    run: printf '%s\n' '${repo.outputs.stdout}'
```

`args` is passed to `gh` as an argument array, without shell parsing. Do not include the `gh` executable name.

For non-public data or write operations, pass a token through `env`. GitHub CLI reads `GH_TOKEN` or `GITHUB_TOKEN` for GitHub.com, and `GH_ENTERPRISE_TOKEN` or `GITHUB_ENTERPRISE_TOKEN` for GitHub Enterprise Server:

```yaml
secrets:
  - name: GH_TOKEN
    provider: env
    key: GH_TOKEN

steps:
  - id: latest_release
    action: github-cli@v1
    with:
      repo: dagucloud/dagu
      args:
        - api
        - repos/{owner}/{repo}/releases/latest
        - --jq
        - .tag_name
      env:
        GH_TOKEN: ${GH_TOKEN}
```

Inputs include:

| Field | Description |
|-------|-------------|
| `args` | Required array of GitHub CLI arguments passed to `gh` without shell parsing. |
| `stdin` | Optional text written to `gh` stdin. |
| `env` | Extra environment variables for `gh`, such as `GH_TOKEN`, `GITHUB_TOKEN`, or `GH_ENTERPRISE_TOKEN`. |
| `repo` | Optional `GH_REPO` value in `[HOST/]OWNER/REPO` format. |
| `host` | Optional `GH_HOST` value for GitHub Enterprise or explicit host selection. |
| `workdir` | Optional working directory for `gh`. |
| `timeoutSeconds` | Maximum runtime for the command. Defaults to `300`, max `1800`. |

Outputs include:

| Field | Description |
|-------|-------------|
| `ok` | `true` when `gh` exits with status 0. |
| `exitCode` | `gh` exit code. Timeouts use `124`; wrapper validation errors use `-1`. |
| `stdout` / `stderr` | Text written by `gh` to stdout and stderr. |
| `durationMs` | Runtime duration in milliseconds. |
| `ghVersion` | First line of `gh --version`. |
| `timedOut` | `true` when the wrapper terminated `gh` after `timeoutSeconds`. |
| `error` | Wrapper error object when validation or process startup fails. |

## JavaScript: `node-script`

```yaml
steps:
  - id: compute
    action: node-script@v1
    with:
      input:
        version: "1.2.3"
        services: ["api", "worker"]
      script: |
        console.log("preparing release", input.version)

        return {
          tag: `v${input.version}`,
          serviceCount: input.services.length
        }

  - id: print
    depends: [compute]
    run: echo "release tag is ${compute.outputs.result.tag}"
```

`script` is a JavaScript async function body. `return` publishes `result`. The action exposes `input`, `params`, `env`, and a captured `console` object.

Outputs include:

| Field | Description |
|-------|-------------|
| `ok` | `true` when the script completed successfully. |
| `result` | JSON-compatible value returned by the script. |
| `stdout` | Text written through `console.log`, `console.info`, `console.debug`, or `console.dir`. |
| `stderr` | Text written through `console.warn` or `console.error`. |
| `durationMs` | Wrapper-measured script duration in milliseconds. |
| `nodeVersion` | Node.js version used by the action. |
| `error` | Error object when the script fails. |

## Python: `python-script`

```yaml
steps:
  - id: compute
    action: python-script@v1
    with:
      input:
        version: "2.3.4"
        services: ["api", "worker", "scheduler"]
      requirements:
        - packaging==25.0
      script: |
        from packaging.version import Version

        version = Version(input["version"])

        return {
            "major": version.major,
            "serviceCount": len(input["services"]),
        }

  - id: print
    depends: [compute]
    run: echo "major version is ${compute.outputs.result.major}"
```

`script` is a Python async function body. `return` publishes `result`, and `await` works directly. The action exposes `input`, `params`, and `env`.

The `requirements` field is optional. When present, each entry is passed to `uv run --with`, so pin dependencies for reproducible runs.

Outputs include:

| Field | Description |
|-------|-------------|
| `ok` | `true` when the script completed successfully. |
| `result` | JSON-compatible value returned by the script. |
| `stdout` | Text written to stdout with `print()` or other stdout writes. |
| `stderr` | Text written to stderr by the script process. |
| `durationMs` | Wrapper-measured duration in milliseconds. |
| `pythonVersion` | Python version used by the script process. |
| `error` | Error object when the script fails. |

## Rclone: `rclone`

```yaml
steps:
  - id: list_files
    action: rclone@v1
    with:
      command: lsf
      source: /data/input

  - id: print
    depends: [list_files]
    run: printf '%s\n' '${list_files.outputs.stdout}'
```

The action returns a JSON output object. Use `${step.outputs.stdout}` for small listings or command output. For large listings, exports, or command logs, write to an artifact instead of routing the data through action outputs.

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
    depends: [preview_sync]
    action: rclone@v1
    with:
      command: sync
      source: /data/reports
      destination: backup:reports
      allowDestructive: true
```

Inputs include:

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

Outputs include:

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

## Runtime and Worker Behavior

Official actions declare their own `tools` in the action DAG. Caller DAG `tools` are not inherited across the action boundary.

In standalone runs, the local Dagu process resolves the action, prepares the action tools, and runs the action DAG as a sub-DAG. In distributed runs, the worker executing the action step resolves and packages the action workspace; the worker running the action DAG prepares that action DAG's tools in its own local tools cache.

For the full package model, reference formats, manifest rules, output publication rules, and distributed execution details, see [Execution Model](/dagu-actions/execution-model).
