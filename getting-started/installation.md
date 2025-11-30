# Installation

Install Dagu on your system.

## Quick Install

### macOS/Linux

```bash
# Install to ~/.local/bin (default, no sudo required)
curl -L https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.sh | bash

# Store temporary files outside /tmp (e.g., limited-size NAS)
curl -L https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.sh | \
  bash -s -- --working-dir /volume1/tmp
```

This detects your OS/architecture and installs to `~/.local/bin` by default. Provide
`--working-dir` if `/tmp` is constrained on your system (for example, on some NAS devices).

### Windows

::: code-group

```powershell [PowerShell]
# Install latest version to default location (%LOCALAPPDATA%\Programs\dagu)
irm https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.ps1 | iex

# Install specific version
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.ps1))) v1.24.0

# Install to custom directory
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.ps1))) latest "C:\tools\dagu"
```

```cmd [CMD]
REM Install latest version
curl -fsSL https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.cmd -o installer.cmd && installer.cmd && del installer.cmd

REM Install specific version
curl -fsSL https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.cmd -o installer.cmd && installer.cmd v1.24.0 && del installer.cmd

REM Install to custom directory
curl -fsSL https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.cmd -o installer.cmd && installer.cmd latest "C:\tools\dagu" && del installer.cmd
```

:::

The installer downloads the appropriate binary and adds it to your PATH.

::: tip Running as a Windows Service
If you plan to run Dagu as a Windows service, you should install it to `Program Files` which requires administrator privileges. Download the installer script and run it as Administrator:

```powershell
# Download the installer
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.ps1" -OutFile "installer.ps1"

# Right-click PowerShell → "Run as Administrator", then:
.\installer.ps1 latest "C:\Program Files\dagu"
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

Visit http://localhost:8080

## Package Managers

### npm

```bash
npm install -g --ignore-scripts=false @dagu-org/dagu
```

This installs Dagu globally with automatic platform detection.

### Homebrew

```bash
brew update && brew install dagu
```

### Manual Download

Download from [GitHub Releases](https://github.com/dagu-org/dagu/releases).

## Installation Options

### Custom Directory & Version

```bash
# Install to custom location
curl -L https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.sh | \
  bash -s -- --install-dir ~/bin

# Install to system-wide location (requires sudo)
curl -L https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.sh | \
  bash -s -- --install-dir /usr/local/bin

# Install specific version
curl -L https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.sh | \
  bash -s -- --version v1.17.0

# Combine options
curl -L https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.sh | \
  bash -s -- --version v1.17.0 --install-dir ~/bin

# Use a custom working directory for temporary files
curl -L https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.sh | \
  bash -s -- --working-dir /volume1/tmp
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
- [Configuration](/configurations/) - Customize Dagu
- [Web UI](/overview/web-ui) - Explore the interface
