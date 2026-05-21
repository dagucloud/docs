# Install on Linux

The guided script installer is the recommended path. It can register Dagu as a systemd service and bootstrap the first admin account.

## Script installer

```bash
curl -fsSL https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.sh | bash
```

By default the wizard installs to `~/.local/bin` (no sudo required). It can also:

- add `dagu` to your `PATH`
- register a `systemd --user` unit (per-user) or a system unit (root)
- create and verify the first admin account

### Non-interactive with user service

```bash
curl -fsSL https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.sh | \
  bash -s -- \
    --service yes \
    --admin-username admin \
    --admin-password 'change-me-now'
```

### System-wide service

```bash
curl -fsSL https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.sh | \
  bash -s -- \
    --service yes \
    --service-scope system \
    --install-dir /usr/local/bin \
    --admin-username admin \
    --admin-password 'change-me-now'
```

### Common flags

| Flag | Purpose |
|---|---|
| `--version vX.Y.Z` | Install a specific release |
| `--install-dir /usr/local/bin` | System-wide install |
| `--install-dir ~/bin` | Custom user location |
| `--service yes` | Register a systemd unit |
| `--service-scope user\|system` | Per-user vs system-wide service |
| `--admin-username <u> --admin-password <p>` | Bootstrap first admin |
| `--working-dir /volume1/tmp` | Override `/tmp` (useful on NAS) |
| `--dry-run --no-prompt` | CI preview mode |

### Service PATH capture

When the installer registers a service, it snapshots the `PATH` from your current shell into the unit file. CLI tools on that `PATH` — `python`, `node`, `docker`, custom binaries — become available to workflow steps running under the service. Rerun the installer or edit the unit file if you add tools later.

## Manual binary

Download the tarball for your architecture from [GitHub Releases](https://github.com/dagucloud/dagu/releases), extract, and place `dagu` on your `PATH`:

```bash
tar -xzf dagu_*_linux_amd64.tar.gz
sudo install dagu /usr/local/bin/
```

## Package managers

- **Homebrew on Linux**: `brew install dagu`
- **npm**: see [npm install](/getting-started/installation/npm)
- **Docker**: see [Docker install](/getting-started/installation/docker)

## Verify

```bash
dagu version
systemctl --user status dagu    # if installed as a user service
```

Next: [Quickstart](/getting-started/quickstart).
