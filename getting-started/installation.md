# Installation

Install Dagu on your system.

## Quick Install

The script installers are the recommended path for most users, especially if you want Dagu set up for you. They open a guided wizard that can:

- install Dagu
- add it to your PATH
- set it up as a background service
- create and verify the first admin account
- install the Dagu AI skill when a supported AI tool is detected

### macOS/Linux

```bash
# Open the guided installer with recommended defaults
curl -fsSL https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.sh | bash

# Store temporary files outside /tmp (for example, on a NAS with a small /tmp)
curl -fsSL https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.sh | \
  bash -s -- --working-dir /volume1/tmp
```

The wizard uses friendly defaults. On Linux it can also create a `systemd` service. On macOS it can install a LaunchAgent.

### Windows

::: code-group

```powershell [PowerShell]
# Open the guided installer with recommended defaults
irm https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.ps1 | iex

# Install specific version
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.ps1))) -Version vX.Y.Z

# Install to custom directory
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.ps1))) -Version latest -InstallDir "C:\tools\dagu"
```

```cmd [CMD/PowerShell]
REM Install latest version
curl -fsSL https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.cmd -o installer.cmd && .\installer.cmd && del installer.cmd

REM Install specific version
curl -fsSL https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.cmd -o installer.cmd && .\installer.cmd -Version vX.Y.Z && del installer.cmd

REM Install to custom directory
curl -fsSL https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.cmd -o installer.cmd && .\installer.cmd -Version latest -InstallDir "C:\tools\dagu" && del installer.cmd
```

:::

The Windows wizard can also install Dagu as a Windows service using a version-pinned WinSW wrapper downloaded during setup.

> The guided setup flow is only available from the script installers. Homebrew, npm, Docker, Helm, and manual downloads install Dagu without the wizard, service setup, first-admin bootstrap, or AI skill prompts.

::: tip Running as a Windows Service
If you plan to run Dagu as a Windows service, the installer will prompt to elevate automatically. For non-interactive setups, start PowerShell as Administrator and run:

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.ps1))) `
  -Version latest `
  -Service yes `
  -InstallDir "C:\Program Files\Dagu" `
  -AdminUsername admin `
  -AdminPassword "change-me-now"
```
:::

### Docker

```bash
docker run -d \
  --name dagu \
  -p 8080:8080 \
  -v ~/.dagu:/var/lib/dagu \
  ghcr.io/dagu-org/dagu:latest \
  dagu start-all
```

Visit http://localhost:8080. See [Docker Images](/server-admin/deployment/docker-images) for available tags and variants.

## Package Managers

### npm

```bash
npm install -g --ignore-scripts=false @dagu-org/dagu
```

This installs Dagu globally with automatic platform detection.

### Homebrew

```bash
brew install dagu
```

### Manual Download

Download from [GitHub Releases](https://github.com/dagu-org/dagu/releases).

## Installation Options

### Custom Directory & Version

```bash
# Install to custom location
curl -fsSL https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.sh | \
  bash -s -- --install-dir ~/bin

# Install to system-wide location (requires sudo)
curl -fsSL https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.sh | \
  bash -s -- --install-dir /usr/local/bin

# Install specific version
curl -fsSL https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.sh | \
  bash -s -- --version vX.Y.Z

# Combine options
curl -fsSL https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.sh | \
  bash -s -- --version vX.Y.Z --install-dir ~/bin

# Use a custom working directory for temporary files
curl -fsSL https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.sh | \
  bash -s -- --working-dir /volume1/tmp
```

### Service Setup Examples

```bash
# Linux/macOS: install, start a background service, and create the first admin
curl -fsSL https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.sh | \
  bash -s -- --service yes --admin-username admin --admin-password 'change-me-now'

# Linux: force a system service and install to /usr/local/bin
curl -fsSL https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.sh | \
  bash -s -- --service yes --service-scope system --install-dir /usr/local/bin \
    --admin-username admin --admin-password 'change-me-now'
```

```powershell
# Windows: install as a service and create the first admin
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.ps1))) `
  -Service yes `
  -AdminUsername admin `
  -AdminPassword "change-me-now"
```

### Non-Interactive / CI

```bash
curl -fsSL https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.sh | \
  bash -s -- --dry-run --no-prompt --version latest
```

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.ps1))) `
  -DryRun -NoPrompt -Version latest
```

## Uninstall

The script installers also support uninstall. In interactive mode, the wizard can now start in either install/repair or uninstall mode.

By default, uninstall removes:

- the `dagu` binary
- the installer-managed background service
- installer-managed PATH changes

By default, uninstall keeps:

- the Dagu data directory
- workflow data and logs
- the Dagu AI skill

Use the extra flags only when you want a deeper cleanup.

### macOS/Linux

```bash
# Remove Dagu, its background service, and the installer PATH block
curl -fsSL https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.sh | \
  bash -s -- --uninstall

# Also delete the detected Dagu data directory
curl -fsSL https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.sh | \
  bash -s -- --uninstall --purge-data

# Also remove Dagu AI skill installs
curl -fsSL https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.sh | \
  bash -s -- --uninstall --remove-skill
```

Linux examples:

```bash
# Uninstall only the user-scoped Linux service and matching install
curl -fsSL https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.sh | \
  bash -s -- --uninstall --service-scope user

# Uninstall a custom install directory non-interactively
curl -fsSL https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.sh | \
  bash -s -- --uninstall --install-dir /usr/local/bin --no-prompt
```

### Windows

```powershell
# Remove Dagu, its Windows service, and PATH entry
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.ps1))) `
  -Uninstall

# Also delete the detected Dagu data directory
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.ps1))) `
  -Uninstall -PurgeData

# Also remove Dagu AI skill installs
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.ps1))) `
  -Uninstall -RemoveSkill
```

```cmd
REM Remove Dagu with the CMD launcher
curl -fsSL https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.cmd -o installer.cmd && .\installer.cmd -Uninstall && del installer.cmd
```

Notes:

- Non-interactive uninstall keeps data and AI skills unless you add `--purge-data` / `-PurgeData` or `--remove-skill` / `-RemoveSkill`.
- If more than one Dagu install is detected, non-interactive uninstall requires `--install-dir` or `-InstallDir`.
- On Windows, the installer prompts to elevate automatically when uninstall needs Administrator rights.

### Dagu AI Skill

If you installed Dagu with Homebrew, npm, or a manual download and use an AI coding tool, run this after `dagu` is available on your PATH. When the wizard detects a supported AI tool, it offers to install the same Dagu skill automatically.

You can install or rerun it later with:

```bash
dagu ai install --yes
```

To install into an explicit skills directory:

```bash
dagu ai install --skills-dir ~/.agents/skills
```

Or use the shared installer as a fallback:

```bash
npx skills add https://github.com/dagu-org/dagu --skill dagu
```

### Docker Compose

```yaml
services:
  dagu:
    image: ghcr.io/dagu-org/dagu:latest
    ports:
      - "8080:8080"
    environment:
      - DAGU_TZ=America/New_York
      - DAGU_PORT=8080 # optional. default is 8080
      - DAGU_HOME=/dagu # optional.
      - PUID=1000 # optional. default is 1000
      - PGID=1000 # optional. default is 1000
    volumes:
      - dagu:/var/lib/dagu
volumes:
  dagu: {}
```

Run with `docker compose up -d`.

### Docker with Host Docker Access

For Docker executor support:

```yaml
services:
  dagu:
    image: ghcr.io/dagu-org/dagu:latest
    ports:
      - "8080:8080"
    volumes:
      - dagu:/var/lib/dagu
      - /var/run/docker.sock:/var/run/docker.sock
    entrypoint: [] # Override default entrypoint
    user: "0:0"    # Run as root for Docker access
volumes:
  dagu: {}
```

⚠️ **Security**: Mounting Docker socket grants full Docker access.

## Build from Source

Requirements:
- Go 1.25+
- Node.js & pnpm
- Make

```bash
git clone https://github.com/dagu-org/dagu.git
cd dagu

# Build everything
make build

# Install
sudo cp .local/bin/dagu /usr/local/bin/
```

Development:
```bash
make ui          # Build frontend
make test        # Run tests
make run         # Start with hot reload
```

## Directory Structure

Dagu uses standard locations:

```
~/.config/dagu/
├── dags/         # Workflows
├── config.yaml   # Configuration
└── base.yaml     # Shared config

~/.local/share/dagu/
├── logs/         # Execution logs
├── data/         # History
└── suspend/      # Pause flags
```

Override with environment variables:
```bash
export DAGU_HOME=/opt/dagu           # All-in-one directory
export DAGU_DAGS_DIR=/workflows      # Custom workflow location
export DAGU_LOG_DIR=/var/log/dagu    # Custom log location
export DAGU_DATA_DIR=/var/lib/dagu    # Custom data location
```

## Verify Installation

```bash
dagu version
```

## Next Steps

- [Quick Start](/getting-started/quickstart) - Create your first workflow
- [Configuration](/server-admin/) - Customize Dagu
- [Web UI](/overview/web-ui) - Explore the interface
