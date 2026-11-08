# Uninstall

The script installers double as uninstallers. In interactive mode the wizard offers install/repair or uninstall on launch.

## What uninstall removes by default

- the `dagu` binary
- the installer-managed background service (systemd, LaunchAgent, or Windows service)
- installer-managed `PATH` changes

## What uninstall keeps by default

- the Dagu data directory (`~/.local/share/dagu/` or `DAGU_HOME`)
- your workflow YAML files and run history

Opt into deeper cleanup with the flags below.

## macOS / Linux

```bash
# Binary + service + PATH entry
curl -fsSL https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.sh | \
  bash -s -- --uninstall

# Also delete the data directory
curl -fsSL https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.sh | \
  bash -s -- --uninstall --purge-data
```

### Linux-specific

```bash
# Remove only the user-scope service and matching install
curl -fsSL https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.sh | \
  bash -s -- --uninstall --service-scope user

# Target a custom install directory non-interactively
curl -fsSL https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.sh | \
  bash -s -- --uninstall --install-dir /usr/local/bin --no-prompt
```

## Windows

### Graphical installer

Uninstall Dagu from **Settings > Apps**, or silently:

```powershell
& "C:\Program Files\Dagu\unins000.exe" /VERYSILENT
```

This removes the binary, the Windows service, and the `PATH` entry the installer added. It keeps `C:\ProgramData\Dagu`; delete that directory to remove the data as well.

### Script installer

```powershell
$daguInstaller = [scriptblock]::Create(
  (irm https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.ps1)
)

# Binary + Windows service + PATH entry
& $daguInstaller -Uninstall

# Also delete the data directory
& $daguInstaller -Uninstall -PurgeData
```

CMD launcher:

```cmd
curl -fsSL https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.cmd -o installer.cmd && .\installer.cmd -Uninstall && del installer.cmd
```

## Notes

- Non-interactive uninstall keeps data unless you pass `--purge-data` / `-PurgeData`.
- If multiple Dagu installs are detected, non-interactive uninstall requires `--install-dir` / `-InstallDir` to pick one.
- On Windows, the installer auto-elevates when uninstall needs Administrator rights.

## Homebrew

```bash
brew uninstall dagu
```

## npm

```bash
npm uninstall -g @dagucloud/dagu
```

## Scoop

```powershell
scoop uninstall dagu
```

## Docker

Stop and remove the container; remove the volume to also delete data:

```bash
docker rm -f dagu
docker volume rm dagu    # destroys workflow history
```

## Helm

```bash
RELEASE=dagu
NAMESPACE=dagu
helm uninstall "$RELEASE" --namespace "$NAMESPACE"
```

The official chart retains its managed PVC by default, so uninstalling Dagu does not remove workflows, run history, credentials, or other persisted state.

List the PVC for the release:

```bash
kubectl --namespace "$NAMESPACE" get pvc \
  --selector "app.kubernetes.io/instance=$RELEASE"
```

If the chart created the PVC, delete it only when the data is no longer needed. Set `PVC_NAME` to the name returned by the previous command:

```bash
PVC_NAME=dagu-data
kubectl --namespace "$NAMESPACE" delete pvc "$PVC_NAME"
```

Set `RELEASE` and `NAMESPACE` to the values used during installation. A claim configured through `persistence.existingClaim` is managed outside Helm and is never deleted by the chart; do not run the manual deletion command for that claim.
