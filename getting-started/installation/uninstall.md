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

```powershell
# Binary + Windows service + PATH entry
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.ps1))) `
  -Uninstall

# Also delete the data directory
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/dagucloud/dagu/main/scripts/installer.ps1))) `
  -Uninstall -PurgeData
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

## Docker

Stop and remove the container; remove the volume to also delete data:

```bash
docker rm -f dagu
docker volume rm dagu    # destroys workflow history
```

## Helm

```bash
helm uninstall dagu
kubectl delete pvc -l app.kubernetes.io/name=dagu   # destroys workflow history
```
