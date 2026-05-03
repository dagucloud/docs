# Installation

Pick the guide for your platform.

- [**macOS**](/getting-started/installation/macos) — Homebrew or the guided script installer (LaunchAgent service)
- [**Linux**](/getting-started/installation/linux) — Guided script installer with systemd service, or a manual binary
- [**npm**](/getting-started/installation/npm) — Global package that downloads the Dagu binary during postinstall
- [**Windows**](/getting-started/installation/windows) — PowerShell script installer with optional Windows service
- [**Docker**](/getting-started/installation/docker) — `docker run`, Compose, and mounting the host Docker socket
- [**Kubernetes**](/getting-started/installation/kubernetes) — Official Helm chart
- [**Build from source**](/getting-started/installation/source) — Go + Node toolchain

## Which one should I use?

| Situation | Install method |
|---|---|
| Trying Dagu locally on a laptop | **Homebrew** (macOS) or **script installer** (Linux/Windows) |
| Running a shared server | **Script installer** with `--service yes` |
| Running in a container | **Docker** |
| Running on a cluster | **Kubernetes (Helm)** |
| CI / reproducible setups | **npm**, **manual binary download**, or **Docker** |
| Developing on Dagu itself | **Build from source** |

## What the script installers do

The `installer.sh` / `installer.ps1` / `installer.cmd` scripts open a guided wizard that can:

- Install the `dagu` binary
- Add it to your `PATH`
- Set it up as a background service (systemd on Linux, LaunchAgent on macOS, Windows service on Windows)
- Create and verify the first admin account

Homebrew, npm, Docker, Helm, and manual downloads install without the guided wizard, service setup, or admin bootstrap.

## Where Dagu Keeps Things

After installation, Dagu uses these paths by default. These are the main locations to know when you want to back up workflows, move storage, or inspect logs:

```
~/.config/dagu/
├── dags/          # Your workflow YAML files
├── config.yaml    # Server configuration
└── base.yaml      # Shared DAG defaults

~/.local/share/dagu/
├── logs/          # Per-run execution logs
├── data/          # Run history and state
└── suspend/       # Suspend flags
```

Override any path with environment variables:

```bash
export DAGU_HOME=/opt/dagu              # all-in-one override
export DAGU_DAGS_DIR=/workflows
export DAGU_LOG_DIR=/var/log/dagu
export DAGU_DATA_DIR=/var/lib/dagu
```

## Verifying the install

```bash
dagu version
```

Then run the [Quickstart](/getting-started/quickstart) to create your first workflow.

## Uninstalling

The script installers also uninstall. See [Uninstall](/getting-started/installation/uninstall).
