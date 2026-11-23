# Upgrades

This page is the procedure for upgrading a production server. [Self-Upgrade](/server-admin/self-upgrade) describes the `dagu upgrade` command itself.

Fixes ship in the latest stable release series. See the [support policy](/server-admin/support-policy).

## Before you upgrade

1. Read the "Upgrading from" sections below for every version you skip. They list the changes that need action. The release notes have the full list: https://github.com/dagucloud/dagu/releases
2. [Back up](/server-admin/backup-restore) configuration, DAGs, and the data directory.
3. Install the target version on a staging server first if your workflows are critical. See [Multi-Environment Deployments](/server-admin/deployment/multi-environment).

## Single server

```bash
dagu upgrade --version v2.27.0
dagu version
```

`dagu upgrade` offers to restart the service the installer set up. With `--yes`, it prints the restart command instead, such as `sudo systemctl restart dagu`.

With `allow_web_upgrade: true`, an administrator can instead select **Update now** in the web UI's update notice. Dagu installs the latest stable release and restarts through its service. See [Upgrade From the Web UI](/server-admin/self-upgrade#upgrade-from-the-web-ui).

Without internet access, replace the binary by hand as described in [Closed Networks](/server-admin/deployment/closed-network#install).

A restart stops runs in progress unless the service keeps them running. See [Keep runs across restarts](#keep-runs-across-restarts).

## Keep runs across restarts

Each run is a separate process, so it can outlive the Dagu process that started it and record its own result. systemd's default, `KillMode=control-group`, ends every process of the service when it stops, runs included. `KillMode=process` ends only Dagu itself.

The installer sets `KillMode=process`. A service set up by an older installer keeps the default until the installer runs again or the override below is added. `dagu upgrade` detects this and offers to add the override before it restarts the service.

To add the override by hand, open it for the service:

```bash
sudo systemctl edit dagu
```

Add these lines, then save and exit:

```ini
[Service]
KillMode=process
```

For a user service, use `systemctl --user edit dagu`. `systemctl edit` reloads systemd, so the next restart already keeps runs.

On macOS, the launchd agent the installer sets up already leaves runs running. On Windows, the service keeps runs going through restarts and upgrades.

Stopping a container stops the runs inside it. To let runs finish across an upgrade, set `signal_handling.drain_timeout`: a stopping Dagu then starts no new runs and waits up to that long for the running ones. See [Graceful Shutdown](/server-admin/operations#graceful-shutdown), and for Helm, [Kubernetes](/server-admin/deployment/kubernetes#upgrade). Runs on [workers](/server-admin/distributed/) outside the container keep going while Dagu restarts.

## Active and standby pair

Upgrade the standby first. The upgraded instance then takes over once, and an older version never takes over from a newer one.

1. Find the standby:

   ```bash
   curl -s http://host-a:8090/health
   curl -s http://host-b:8090/health
   ```

2. On the standby host, stop Dagu, replace the binary, and start it. It comes back as a standby:

   ```bash
   sudo systemctl stop dagu-scheduler dagu-server
   # install the new binary at /usr/local/bin/dagu
   sudo systemctl start dagu-scheduler dagu-server
   ```

3. On the active host, do the same. The scheduler releases the lock when it stops, so the upgraded standby becomes active within `scheduler.lock_retry_interval`, plus startup.
4. Confirm that every host reports the new version, and that exactly one is active:

   ```bash
   dagu version
   curl -s -o /dev/null -w '%{http_code}\n' 'http://host-a:8090/health?role=active'
   curl -s -o /dev/null -w '%{http_code}\n' 'http://host-b:8090/health?role=active'
   ```

## Workers

Upgrade the binary or image on each worker host as well. The [Workers page](/server-admin/distributed/workers/#web-ui-workers-page) shows the Dagu version of each worker and marks a worker older or newer than the server, so it shows when every worker is upgraded.

## Upgrading from 2.27.0 or earlier

A DAG file whose name ends in `.test.yaml` or `.test.yml` becomes a [workflow test](/writing-workflows/workflow-tests) file. It leaves the DAG list, the scheduler stops running it, and `dagu start` refuses it. Before the upgrade, rename such files, for example `smoke.test.yaml` to `smoke-test.yaml`, and update everything that starts one by its old name or path, such as the `dag` of a `dag.run` step or a script that runs `dagu start`.

To find them, read `paths.dags_dir` from `dagu config --values`, run as the server runs, with its configuration and environment. A service installed by the script installer keeps its data under `/var/lib/dagu` for a system service or `~/.dagu` for a user service. Then search that directory:

```bash
dagu config --values | grep paths.dags_dir
find /path/to/dags -name '*.test.yaml' -o -name '*.test.yml'
```

## Upgrading from 2.26.0 or earlier

Later releases change how the scheduler behaves in four ways:

- **Run IDs of cron slots have a new format.** The new version cannot recognize a run the old version started, so a slot that ran in the same minute as the handover can run again. Hand over in a minute with no schedule due.
- **The data directory must have the same path on every host,** because it is now part of each slot's run ID.
- **A scheduler that loses the lock exits with status 1,** not 0. It needs a supervisor that restarts it.
- **Stopping the scheduler no longer stops runs it started from a queue.** `scheduler.failover_recovery_window` is new and on by default, at 2 minutes.

On Windows, the service keeps runs going through restarts once it runs the new version. The restart that installs it ends the runs 2.26.0 started, so upgrade when no critical run is in progress.

## Kubernetes

See [Kubernetes](/server-admin/deployment/kubernetes#upgrade). A new chart version can change the default image, so read its `appVersion` first:

```bash
helm repo update
helm show chart dagu/dagu | grep -E '^(version|appVersion):'
```

## Roll back

Roll back by restoring the backup taken before the upgrade, because an older version may not read state that a newer one wrote:

1. Stop Dagu on every host.
2. [Restore](/server-admin/backup-restore#restore) the backup taken before the upgrade.
3. Install the previous binary and start Dagu.

Runs made since the backup are lost from the history.
