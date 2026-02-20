# Self-Upgrade

Dagu includes a built-in upgrade command that allows you to update to the latest version directly from the command line.

## Overview

The `dagu upgrade` command downloads and installs the latest version of Dagu, with built-in checksum verification for security.

## Basic Usage

```bash
# Upgrade to latest version
dagu upgrade

# Check if update is available (no installation)
dagu upgrade --check

# Upgrade to specific version
dagu upgrade --version v1.30.0

# Preview changes without installing
dagu upgrade --dry-run

# Skip confirmation prompt
dagu upgrade -y
```

## Command Options

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--check` | | Check for updates without installing | `false` |
| `--version` | `-v` | Upgrade to specific version | latest |
| `--dry-run` | | Preview changes without installing | `false` |
| `--backup` | | Create backup before upgrading | `false` |
| `--yes` | `-y` | Skip confirmation prompt | `false` |
| `--pre-release` | | Include pre-release versions | `false` |

## Installation Methods

The upgrade command automatically detects how Dagu was installed:

| Method | Self-Upgrade | Recommended Action |
|--------|--------------|-------------------|
| Binary download | Yes | `dagu upgrade` |
| Go install | No | `go install github.com/dagu-org/dagu@latest` |
| Homebrew | No | `brew upgrade dagu` |
| Snap | No | `snap refresh dagu` |
| Docker | No | Pull latest image |

## How It Works

1. **Version Check**: Fetches latest release from GitHub API
2. **Download**: Downloads platform-specific archive with retry logic
3. **Verification**: Validates SHA256 checksum
4. **Backup** (optional): Creates `.bak` file of current binary
5. **Installation**: Atomically replaces the binary

## Supported Platforms

- **macOS**: amd64, arm64
- **Linux**: 386, amd64, arm64, armv6, armv7, ppc64le, s390x
- **FreeBSD**: 386, amd64, arm64, armv6, armv7
- **OpenBSD**: 386, amd64, arm64, armv6, armv7
- **Windows**: 386, amd64, arm64, armv6, armv7

## Update Notifications

Dagu caches update check results for 24 hours. When an update is available, you'll see a notification in the web UI.

## Examples

### Check for Updates

```bash
dagu upgrade --check
```

Output:
```
Current version: v1.30.0
Latest version:  v1.30.3

An update is available. Run 'dagu upgrade' to update.
```

### Dry Run

```bash
dagu upgrade --dry-run
```

Output:
```
Dry run - no changes will be made

Current version: v1.30.0
Target version:  v1.30.3

The following changes will be made:
  - Download: dagu_1.30.3_darwin_arm64.tar.gz (25.3 MB)
  - Verify:   SHA256 checksum
  - Replace:  /usr/local/bin/dagu
```

### Upgrade with Backup

```bash
dagu upgrade --backup
```

Creates `/usr/local/bin/dagu.bak` before replacing.

### Upgrade to Specific Version

```bash
dagu upgrade --version v1.30.0
```

### Include Pre-releases

```bash
dagu upgrade --pre-release
```

## Security

- All downloads are verified using SHA256 checksums from `checksums.txt`
- Archives are validated to prevent path traversal attacks
- Binary replacement is atomic to prevent corruption
