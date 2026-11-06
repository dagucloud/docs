---
description: Run Dagu as a Windows service that starts with the computer, and know what a service can and cannot reach.
---

# Windows Service

The Windows installer can register Dagu as a Windows service that starts with the computer and restarts after a failure. The service is a version-pinned [WinSW](https://github.com/winsw/winsw) wrapper around `dagu start-all`.

## Install the Service

Start PowerShell as Administrator and run:

```powershell
$daguInstaller = [scriptblock]::Create(
  (irm https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.ps1)
)
& $daguInstaller -Service yes -AdminUsername admin -AdminPassword "change-me-now"
```

Without `-AdminUsername` and `-AdminPassword`, create the first admin account at http://127.0.0.1:8080/setup. Add `-Port <port>` to serve on another port. See [Install on Windows](/getting-started/installation/windows) for the other installer parameters.

## Where Things Are

| Path | Contents |
| --- | --- |
| `C:\Program Files\Dagu\dagu.exe` | The Dagu binary |
| `C:\Program Files\Dagu\dagu-service.xml` | The service definition, which sets `DAGU_HOME`, `DAGU_HOST`, and `DAGU_PORT` |
| `C:\ProgramData\Dagu\` | `DAGU_HOME`: workflows in `dags\`, `config.yaml`, and run data |
| `C:\ProgramData\Dagu\logs\` | Run logs and the service wrapper's logs |

Environment variables take precedence over `config.yaml`, so change the address or port in `dagu-service.xml`, then restart the service.

## Manage the Service

Run these in PowerShell as Administrator:

```powershell
Get-Service Dagu        # Check status
Restart-Service Dagu    # Apply changes to config.yaml or dagu-service.xml
Stop-Service Dagu
Start-Service Dagu
```

## What the Service Can Reach

The service runs as the LocalSystem account in session 0, not as the signed-in user:

- Commands see the machine `PATH` and LocalSystem's profile. Tools installed only for your user, and the sign-ins they keep, such as a coding agent CLI's login, are not available. Install tools for all users or call them by absolute path, and pass credentials as [secrets](/writing-workflows/secrets).
- Session 0 has no desktop, so [computer steps](/step-types/computer#setting-up-a-desktop-host) fail. For them, run Dagu in the user's signed-in session instead, for example from Task Scheduler with **Run only when user is logged on**.

## Uninstall

```powershell
$daguInstaller = [scriptblock]::Create(
  (irm https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.ps1)
)
& $daguInstaller -Uninstall
```

This removes the binary, the service, and the `PATH` entry, and keeps `C:\ProgramData\Dagu`. Add `-PurgeData` to delete that as well. See [Uninstall](/getting-started/installation/uninstall).

## Access

Open http://127.0.0.1:8080 in your browser.
