# Install on macOS

Two supported paths: **Homebrew** (binary only) or the **guided script installer** (optional LaunchAgent service and admin bootstrap).

## Homebrew

```bash
brew install dagu
```

Upgrade later with `brew upgrade dagu`. Homebrew installs the binary only — no service, no admin account. Set those up yourself or use the script installer.

## Script installer

```bash
curl -fsSL https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.sh | bash
```

The wizard can add `dagu` to your `PATH`, register a LaunchAgent, and create the first admin account.

### Non-interactive install with service

```bash
curl -fsSL https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.sh | \
  bash -s -- \
    --service yes \
    --admin-username admin \
    --admin-password 'change-me-now'
```

### Common flags

| Flag | Purpose |
|---|---|
| `--version vX.Y.Z` | Install a specific release |
| `--install-dir ~/bin` | Install to a custom location |
| `--install-dir /usr/local/bin` | Install system-wide (needs sudo) |
| `--service yes` | Register a LaunchAgent |
| `--admin-username <u> --admin-password <p>` | Bootstrap first admin |
| `--working-dir /volume1/tmp` | Override `/tmp` (useful on NAS) |
| `--dry-run --no-prompt` | CI preview mode |

### Service PATH capture

When the installer sets up a background service, it captures the `PATH` from the shell you ran it in. CLI tools on that `PATH` — `claude`, `node`, `docker`, and so on — become available to workflow steps that run inside the service. If you add new tools later, rerun the installer or use absolute paths in steps.

## Manual binary

Download from [GitHub Releases](https://github.com/dagucloud/dagu/releases), unpack, and put `dagu` on your `PATH`.

## npm

See [npm install](/getting-started/installation/npm).

## Verify

```bash
dagu version
```

Next: [Quickstart](/getting-started/quickstart).
