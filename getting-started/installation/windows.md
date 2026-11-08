# Install on Windows

Dagu ships a signed graphical installer, a PowerShell script, and a CMD launcher. All three can set Dagu up as a Windows service using a version-pinned [WinSW](https://github.com/winsw/winsw) wrapper downloaded during setup.

## Installer (recommended)

Download and run the latest installer:

[dagu-windows-amd64-setup.exe](https://github.com/dagucloud/dagu/releases/latest/download/dagu-windows-amd64-setup.exe)

The installer is signed by Descarty株式会社, and the wizard asks two things:

- **How should Dagu run?** *As a Windows service* (recommended) starts Dagu with Windows and keeps the web UI available in your browser. *Command-line tool only* installs `dagu.exe` and leaves starting it to you. A checkbox on the same page, on by default, adds Dagu to the system `PATH`.
- **Network ports** (service only). The web UI port defaults to 8080 and the coordinator port to 50055. The wizard refuses a port that another program already uses.

On the last page the wizard can open the web UI, where you create the admin account on your first visit. The service stores its data and logs under `C:\ProgramData\Dagu`, and the Start menu gets an *Open Dagu* shortcut.

### Silent install

```powershell
.\dagu-windows-amd64-setup.exe /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /TASKS=service,path /PORT=8080 /COORDINATORPORT=50055
```

Use `/TASKS=manual,path` for the command-line tool only, and drop `path` to leave the `PATH` alone. Uninstall from **Settings > Apps**, or silently with `& "C:\Program Files\Dagu\unins000.exe" /VERYSILENT`. Uninstalling removes the service and the `PATH` entry but keeps `C:\ProgramData\Dagu`.

## PowerShell

```powershell
irm https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.ps1 | iex
```

### Install a specific version or location

```powershell
$daguInstaller = [scriptblock]::Create(
  (irm https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.ps1)
)

# Specific version
& $daguInstaller -Version vX.Y.Z

# Custom directory
& $daguInstaller `
  -Version latest `
  -InstallDir "C:\tools\dagu"
```

### Install as a Windows service

The installer will prompt to elevate automatically. For non-interactive setups, start PowerShell as Administrator and run:

```powershell
$daguInstaller = [scriptblock]::Create(
  (irm https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.ps1)
)
& $daguInstaller `
  -Version latest `
  -Service yes `
  -InstallDir "C:\Program Files\Dagu" `
  -AdminUsername admin `
  -AdminPassword "change-me-now"
```

### Common parameters

| Parameter | Purpose |
|---|---|
| `-Version vX.Y.Z` | Install a specific release |
| `-InstallDir <path>` | Custom install location |
| `-Service yes` | Register a Windows service (requires elevation) |
| `-AdminUsername <u> -AdminPassword <p>` | Bootstrap first admin |
| `-DryRun -NoPrompt` | CI preview mode |

## CMD launcher

For environments where running PowerShell inline is awkward:

```cmd
curl -fsSL https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.cmd -o installer.cmd && .\installer.cmd && del installer.cmd
```

With flags:

```cmd
curl -fsSL https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.cmd -o installer.cmd && .\installer.cmd -Version vX.Y.Z && del installer.cmd

curl -fsSL https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.cmd -o installer.cmd && .\installer.cmd -Version latest -InstallDir "C:\tools\dagu" && del installer.cmd
```

## Scoop

```powershell
scoop bucket add dagu https://github.com/dagucloud/scoop-bucket
scoop install dagu
```

Scoop installs `dagu.exe` without a service. Upgrade with `scoop update dagu`.

## Manual binary

Download the Windows archive from [GitHub Releases](https://github.com/dagucloud/dagu/releases), extract `dagu.exe`, and add its folder to your `PATH`.

## Verify

```powershell
dagu version
Get-Service dagu    # if installed as a Windows service
```

Next: [Quickstart](/getting-started/quickstart).
