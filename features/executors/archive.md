# Archive Executor

Work with archive files directly from a DAG step without relying on shell utilities. The executor is built on top of [`github.com/mholt/archives`](https://github.com/mholt/archives) and streams data for efficiency.

## Supported Formats

### Archive Formats

| Format | Extension | Read | Write | Password Support | Notes |
|--------|-----------|------|-------|------------------|-------|
| **ZIP** | `.zip` | ✓ | ✓ | No | Full read/write support |
| **TAR** | `.tar` | ✓ | ✓ | No | Full read/write support |
| **RAR** | `.rar` | ✓ | ✗ | Yes (read) | Read-only; extraction with password |
| **7-Zip** | `.7z` | ✓ | ✗ | Yes (read) | Read-only; extraction with password |

### Compression Formats (Single File)

| Format | Extension | Compression Level | Notes |
|--------|-----------|-------------------|-------|
| **GZIP** | `.gz` | 0-9 (default: -1) | Configurable compression |
| **Bzip2** | `.bz2` | 0-9 (default: -1) | Configurable compression |
| **XZ** | `.xz` | Fixed | High compression ratio |
| **Zstandard** | `.zst`, `.zstd` | Fixed | Fast with good compression |
| **LZ4** | `.lz4` | Fixed | Very fast, lower ratio |

### Combined Formats (Archive + Compression)

| Format | Extensions | Read | Write | Compression Level |
|--------|------------|------|-------|-------------------|
| **TAR+GZIP** | `.tar.gz`, `.tgz` | ✓ | ✓ | 0-9 (default: -1) |
| **TAR+Bzip2** | `.tar.bz2`, `.tbz2`, `.tbz` | ✓ | ✓ | 0-9 (default: -1) |
| **TAR+XZ** | `.tar.xz`, `.txz` | ✓ | ✓ | Fixed |
| **TAR+Zstandard** | `.tar.zst`, `.tar.zstd` | ✓ | ✓ | Fixed |

### Format Detection

The executor automatically detects archive format from:
1. **File extension** - Recognizes all standard extensions (`.tar.gz`, `.zip`, etc.)
2. **Magic bytes** - Examines file headers when extension is ambiguous
3. **Explicit configuration** - Override with `format` field when needed

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
    type: archive
    config:
      source: logs.tar.gz
      destination: ./logs
    command: extract

  - name: package
    type: archive
    config:
      source: ./logs
      destination: logs-backup.tar.gz
    command: create

  - name: inspect
    type: archive
    config:
      source: logs-backup.tar.gz
    command: list
    output: ARCHIVE_INDEX
```

`extract` and `create` emit a JSON summary (files processed, bytes, duration, etc.) on `stdout`. `list` outputs a JSON array of entries so subsequent steps can filter or inspect the archive with tools like `jq`.

## Configuration

| Field | Description | Type | Default | Notes |
|-------|-------------|------|---------|-------|
| `source` | Input archive or directory | string | *required* | Path to archive file (extract/list) or source directory (create) |
| `destination` | Output directory or archive path | string | `.` (extract) | Target directory (extract) or output archive path (create); optional for `list` |
| `format` | Archive format override | string | auto-detect | Explicit format: `zip`, `tar`, `tar.gz`, `tar.bz2`, `tar.xz`, `tar.zst`, `7z`, `rar`, etc. |
| `compressionLevel` | Compression level | int | `-1` | `-1` = default, `0` = none, `1-9` = level; applies to gzip and bzip2 only |
| `overwrite` | Replace existing files | bool | `false` | When `false`, extraction fails if destination file exists |
| `stripComponents` | Strip leading path segments | int | `0` | Remove N leading directories from paths (like `tar --strip-components=N`) |
| `preservePaths` | Preserve full paths | bool | `true` | When `false`, only extracts the basename of each file |
| `include` | Include glob patterns | []string | all files | Only process files matching these patterns (e.g., `**/*.csv`) |
| `exclude` | Exclude glob patterns | []string | none | Skip files matching these patterns (applied after include) |
| `followSymlinks` | Follow symlinks when creating | bool | `false` | When `true`, dereferences symlinks; when `false`, preserves them |
| `verifyIntegrity` | Verify archive after operation | bool | `false` | Performs full read pass to validate archive integrity |
| `continueOnError` | Continue on individual file errors | bool | `false` | Logs errors but continues processing remaining files |
| `dryRun` | Simulate operation | bool | `false` | Calculate metrics without writing files to disk |
| `password` | Archive password | string | none | **Extraction only** for password-protected `7z` and `rar` archives |

All fields support environment interpolation (`${VAR}`) and outputs from previous steps.

## Additional Examples

### Selective Extraction

```yaml
workingDir: /data/pipeline

steps:
  - name: extract-csv
    type: archive
    config:
      source: dataset.tar.zst
      destination: ./data
      include:
        - command: "**/*.csv"
      stripComponents: 1
    command: extract
```

### Create Archive With Verification

```yaml
workingDir: /deploy/release

steps:
  - name: bundle-artifacts
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
    type: archive
    config:
      source: secure-data.7z
      destination: ./decrypted
      password: ${ARCHIVE_PASSWORD}
      include:
        - command: "**/*.csv"
      overwrite: true
    command: extract
```

> **Important:** Password protection is **read-only**. You can extract password-protected `7z` and `rar` archives, but creating encrypted archives is not supported.

## Security Features

The executor implements security protections against malicious archives:

- **Path traversal prevention** - Rejects archives with entries escaping the destination directory
- **Symlink validation** - Blocks symlinks with absolute targets or paths escaping the destination
- **Safe path handling** - Validates all extracted paths before writing files

These protections defend against "zip slip" and similar archive-based attacks.

## Limitations

| Format | Limitation |
|--------|------------|
| **RAR** | Read-only; cannot create RAR archives |
| **7-Zip** | Read-only; cannot create 7z archives |
| **Password Protection** | Extraction only; cannot create encrypted archives |
| **Compression Levels** | Only GZIP and Bzip2 support configurable levels (0-9) |

## Output Format

### Extract and Create Operations

Both `extract` and `create` commands output JSON to `stdout` with operation metrics:

```json
{
  "operation": "extract",
  "source": "logs.tar.gz",
  "destination": "./logs",
  "filesExtracted": 1523,
  "bytesExtracted": 45829384,
  "filesSkipped": 0,
  "duration": "1.234s",
  "verifyPerformed": false,
  "errors": []
}
```

### List Operation

The `list` command outputs a JSON array of archive entries:

```json
{
  "operation": "list",
  "source": "logs.tar.gz",
  "totalFiles": 1523,
  "totalSize": 45829384,
  "verified": false,
  "duration": "0.123s",
  "files": [
    {
      "path": "logs/app.log",
      "size": 12345,
      "mode": "-rw-r--r--",
      "modTime": "2025-11-02T12:34:56Z",
      "isDir": false
    }
  ]
}
```
