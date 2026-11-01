# Watched Folders

A DAG-level `watch` block starts one run for each file that arrives in a folder. A file dropped there is processed once, by one run, soon after it is complete. No schedule polls the folder, and no run starts when nothing arrived.

## Quick start

```yaml
watch:
  path: ~/Downloads/invoices
  pattern: "*.pdf"
  interval: 30s

steps:
  - id: archive
    action: file.move
    with:
      source: ${WATCH_FILE}
      destination: ~/Documents/invoices/${WATCH_NAME}
      create_dirs: true
```

The scheduler reads `~/Downloads/invoices` every 30 seconds. Each PDF that arrives starts a run, and the run moves the file to `~/Documents/invoices`.

Watching needs the scheduler process: run `dagu scheduler`, or `dagu start-all` to run it with the web server. See [Scheduling](/writing-workflows/scheduling#prerequisites).

## Fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `path` | Yes | - | The folder watched. A leading `~` is the home directory. A relative path resolves against the scheduler's working directory. Subfolders are not watched. |
| `pattern` | No | Every file | A glob the file name must match, such as `*.pdf` or `orders-*.csv`. `*` also matches every file. |
| `interval` | No | `10s` | How often the folder is read, as a duration such as `30s` or `5m`. At least `1s`. |

A DAG with `watch` needs no `schedule`. Both can be set, and each starts its own runs.

Some entries never match, whatever the pattern:

- names that start with `.` or `~$`, such as hidden files and Office lock files
- names that end in `.tmp`, `.part`, `.partial`, `.crdownload`, or `.download`, the files of a copy or download still in progress
- folders, and anything else that is not a regular file

## When a file counts as arrived

The scheduler reads the folder every `interval`. A file counts as arrived once its size and modification time are the same on two readings in a row, so a file still being copied waits. A run starts between one and two intervals after the file stops changing.

- Each file runs once. The scheduler remembers it by its size and modification time.
- A file replaced with other content runs again. A file that is removed and comes back runs again.
- The files a folder holds when the watch starts are remembered without running. The same happens when `path` or `pattern` changes. A watch takes what arrives, not what was already there.
- A file that arrives while the scheduler is stopped runs once the scheduler is back.
- The record of watched folders is kept with the scheduler's state and survives restarts. A DAG that fails to load for a while, as during an edit, keeps its record, so a file that arrives meanwhile runs once the DAG loads again.

## The run

Each arrival queues one run, as a webhook request does. The run receives two parameters:

| Parameter | Value |
|-----------|-------|
| `WATCH_FILE` | The absolute path of the file |
| `WATCH_NAME` | The name of the file |

Use `${WATCH_FILE}` and `${WATCH_NAME}` in value-resolved fields such as `with`. Steps also receive both as environment variables.

- The run's trigger type is `file`, which `${context.trigger.type}` and the run history show.
- The run ID is `file-` followed by a hash of the DAG name, the path, the size, and the modification time. If the scheduler stops after it queues a run but before it records the file, it queues the file again under the same ID, and the queue keeps the run it already holds.
- A file whose run could not be queued is tried again at the next reading.
- The scheduler reads the folder on its own host. A run that a [distributed worker](/server-admin/distributed/) executes receives the scheduler host's path, so the worker must reach the file at that path.

::: warning File names are untrusted input
Whoever puts a file in the folder chooses its name. In a `run` step, read the path from the environment inside double quotes instead of writing `${WATCH_NAME}` or `${WATCH_FILE}` into the command:

```yaml
watch:
  path: /srv/inbox
  pattern: "*.csv"

steps:
  - id: count_rows
    run: wc -l "$WATCH_FILE"
```

See [Quoting Does Not Sanitize Inserted Values](/writing-workflows/quoting-and-escaping#quoting-does-not-sanitize-inserted-values).
:::

## Suspended DAGs and unreadable folders

A suspended DAG starts no runs. Its files wait and run once the DAG resumes. [Pausing the scheduler](/writing-workflows/scheduling#pausing-the-scheduler) holds every watch the same way.

A folder that cannot be read, such as a network share that is offline, is reported once in the scheduler log. The scheduler reads it again every interval.

## Validation

`dagu validate` rejects:

- a `watch` without `path`
- a `pattern` that is not a valid glob
- an `interval` that is not a duration, or is under `1s`
- any other key under `watch`

## Related

- [Scheduling](/writing-workflows/scheduling) for cron and one-off start times
- [Runtime Context and Variables](/writing-workflows/runtime-variables) for `WATCH_FILE`, `WATCH_NAME`, and the trigger type
- [LLM Completion](/step-types/llm/#files) for a model step that reads the arrived file
- [File](/step-types/file) for moving, copying, and deleting files
