# Archive Executor

Work with archive files (ZIP, TAR, TAR.GZ, TAR.BZ2, TAR.XZ, TAR.ZST, 7z, RAR, and more) directly from a DAG step without relying on shell utilities. The executor is built on top of [`github.com/mholt/archives`](https://github.com/mholt/archives) and streams data for efficiency.

## Supported Operations

| Command   | Description                          |
|-----------|--------------------------------------|
| `extract` | Unpack an archive into a directory   |
| `create`  | Create an archive from files/folders |
| `list`    | Enumerate entries in an archive      |

## Quick Start

```yaml
steps:
  - name: unpack
    executor:
      type: archive
      config:
        source: logs.tar.gz
        destination: ./logs
    command: extract

  - name: package
    executor:
      type: archive
      config:
        source: ./logs
        destination: logs-backup.tar.gz
    command: create

  - name: inspect
    executor:
      type: archive
      config:
        source: logs-backup.tar.gz
    command: list
    output: ARCHIVE_INDEX
```

`extract` and `create` emit a JSON summary (files processed, bytes, duration, etc.) on `stdout`. `list` outputs a JSON array of entries so subsequent steps can filter or inspect the archive with tools like `jq`.

## Configuration

| Field | Description | Notes |
|-------|-------------|-------|
| `source` | Input archive or directory | Required for all commands |
| `destination` | Output directory (extract) or archive path (create) | Optional for `list` |
| `format` | Override format detection (e.g. `tar.gz`, `zip`) | Auto-detected by default |
| `compressionLevel` | Compression level passed to supported formats | `-1` uses library default |
| `overwrite` | Replace existing files when extracting | Defaults to `false` |
| `stripComponents` | Drop leading path segments while extracting | Similar to `tar --strip-components` |
| `include` / `exclude` | Glob filters applied to archive entries | Uses `**`-aware matching |
| `followSymlinks` | Dereference symlinks when creating archives | Default keeps symlinks |
| `verifyIntegrity` | Fully read the archive after create/extract/list | Adds a read-only pass |
| `dryRun` | Simulate extraction/creation without writing files | Useful for previews |
| `password` | Password for protected archives | Extraction only (`7z`, `rar`) |

All fields support environment interpolation (`${VAR}`) and outputs from previous steps.

## Additional Examples

### Selective Extraction

```yaml
workingDir: /data/pipeline

steps:
  - name: extract-csv
    executor:
      type: archive
      config:
        source: dataset.tar.zst
        destination: ./data
        include:
          - "**/*.csv"
        stripComponents: 1
    command: extract
```

### Create Archive With Verification

```yaml
workingDir: /deploy/release

steps:
  - name: bundle-artifacts
    executor:
      type: archive
      config:
        source: ./dist
        destination: dist.tar.gz
        format: tar.gz
        verifyIntegrity: true
    command: create
```

### Extract Password-Protected 7z (Read-Only)

```yaml
workingDir: /data/decrypted

secrets:
  - name: ARCHIVE_PASSWORD
    provider: env
    key: ARCHIVE_PASSWORD

steps:
  - name: unpack-secure
    executor:
      type: archive
      config:
        source: secure-data.7z
        destination: ./decrypted
        password: ${ARCHIVE_PASSWORD}
        include:
          - "**/*.csv"
        overwrite: true
    command: extract
```

> Passwords are supported for extraction of encrypted formats such as 7z and RAR. Creation of encrypted archives is not currently supported.
