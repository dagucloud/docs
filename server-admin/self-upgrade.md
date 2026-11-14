# Self-Upgrade

Dagu includes a built-in upgrade command to update to the latest version directly from the command line.

## Overview

The `dagu upgrade` command downloads and installs the latest version of Dagu, using SHA256 checksum verification.

## Basic Usage

```bash
# Upgrade to latest version
dagu upgrade

# Check if update is available (no installation)
dagu upgrade --check

# Upgrade to specific version
dagu upgrade --version v2.11.0

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
| `--force` | `-f` | Allow downgrading to an older version | `false` |

## Installation Methods

The upgrade command automatically detects how Dagu was installed:

| Method | Self-Upgrade | Recommended Action |
|--------|--------------|-------------------|
| Binary download | Yes | `dagu upgrade` |
| Go install | No | Reinstall with the script installer or a released binary |
| Homebrew | No | `brew upgrade dagu` |
| Snap | No | `snap refresh dagu` |
| Container (Docker, Podman, Kubernetes) | No | Pull the latest image |

Dagu treats an install as a container when `/.dockerenv` or `/run/.containerenv` exists, or when `KUBERNETES_SERVICE_HOST` is set.

If the install directory is not writable, the command fails with a permission error that suggests running with `sudo`, or as Administrator on Windows.

## How It Works

1. **Version Check**: Fetches latest release from GitHub API
2. **Download**: Downloads platform-specific archive with retry logic
3. **Verification**: Validates SHA256 checksum
4. **Backup** (optional): Creates `.bak` file of current binary
5. **Installation**: Atomically replaces the binary
6. **Restart Hint**: Prints how to restart Dagu so running processes use the new binary

## Restarting After an Upgrade

`dagu upgrade` does not restart running Dagu processes. A restart stops runs in progress unless the service keeps them; see [Keep runs across restarts](/server-admin/upgrades#keep-runs-across-restarts). After a successful upgrade, it prints the restart command for the background service the Dagu installer set up:

```
Restart Dagu to use the new version:
  sudo systemctl restart dagu
```

| Service | Detected By | Command |
|---------|-------------|---------|
| macOS launchd agent | `~/Library/LaunchAgents/local.dagu.server.plist` | `launchctl kickstart -k gui/$(id -u)/local.dagu.server` |
| Linux systemd system service | `/etc/systemd/system/dagu.service` | `sudo systemctl restart dagu` |
| Linux systemd user service | `~/.config/systemd/user/dagu.service` | `systemctl --user restart dagu` |
| Windows service | `dagu-service.xml` next to the binary | `Restart-Service Dagu` |

When no installer service is found, it prints `Restart any running Dagu processes to use the new version.`

## Supported Platforms

- **macOS**: amd64, arm64
- **Linux**: 386, amd64, arm64, armv6, armv7, ppc64le, s390x
- **Windows**: 386, amd64, arm64

## Update Notifications

Dagu caches update check results for 24 hours. When automatic checks are enabled, an available update appears as a notification in the web UI. The notification shows the update command for the detected installation method, such as `dagu upgrade` or `brew upgrade dagu`. Container installs show no command.

When the binary a running server started from is replaced, by `dagu upgrade` or a package manager, the web UI shows a restart notice instead, with the restart command from [Restarting After an Upgrade](#restarting-after-an-upgrade) when one is found.

Automatic checks are controlled by the main server config and are enabled by default:

```yaml
check_updates: true
```

Disable them with `check_updates: false` or `DAGU_CHECK_UPDATES=false`.

This only affects update notifications in the web UI. Restart notices and manual commands such as `dagu upgrade` and `dagu upgrade --check` still work.

## Examples

### Check for Updates

```bash
dagu upgrade --check
```

Output:
```
Current version: v2.11.0
Latest version:  v2.11.1

An update is available. Run 'dagu upgrade' to update.
```

### Dry Run

```bash
dagu upgrade --dry-run
```

Output:
```
Dry run - no changes will be made

Current version: v2.11.0
Target version:  v2.11.1

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
dagu upgrade --version v2.11.0
```

### Include Pre-releases

```bash
dagu upgrade --pre-release
```

## Security

- All downloads are verified using SHA256 checksums from `checksums.txt`
- Archives are validated to prevent path traversal attacks
- Binary replacement is atomic to prevent corruption
