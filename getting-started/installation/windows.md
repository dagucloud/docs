# Install on Windows

The Windows installer ships as both a PowerShell script and a CMD launcher. The wizard can install Dagu as a Windows service using a version-pinned [WinSW](https://github.com/winsw/winsw) wrapper downloaded during setup.

## PowerShell

```powershell
irm https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.ps1 | iex
```

### Install a specific version or location

```powershell
# Specific version
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.ps1))) -Version vX.Y.Z

# Custom directory
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.ps1))) `
  -Version latest `
  -InstallDir "C:\tools\dagu"
```

### Install as a Windows service

The installer will prompt to elevate automatically. For non-interactive setups, start PowerShell as Administrator and run:

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.ps1))) `
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

## Manual binary

Download the Windows archive from [GitHub Releases](https://github.com/dagucloud/dagu/releases), extract `dagu.exe`, and add its folder to your `PATH`.

## Verify

```powershell
dagu version
Get-Service dagu    # if installed as a Windows service
```

Next: [Quickstart](/getting-started/quickstart).
