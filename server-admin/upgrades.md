# Upgrades

This page is the procedure for upgrading a production server. [Self-Upgrade](/server-admin/self-upgrade) describes the `dagu upgrade` command itself.

Only the latest stable release series receives fixes. See the [support policy](/server-admin/support-policy).

## Before you upgrade

1. Read the release notes for every version between yours and the target: https://github.com/dagucloud/dagu/releases
2. [Back up](/server-admin/backup-restore) configuration, DAGs, and the data directory.
3. Install the target version on a staging server first if your workflows are critical. See [Multi-Environment Deployments](/server-admin/deployment/multi-environment).

## Single server

```bash
dagu upgrade --version v2.26.0
sudo systemctl restart dagu
dagu version
```

Without internet access, replace the binary by hand as described in [Closed Networks](/server-admin/deployment/closed-network#install).

A restart stops runs in progress unless the service keeps them running. See [Keep runs across restarts](#keep-runs-across-restarts).

## Keep runs across restarts

Each run is a separate process, so it can outlive the Dagu process that started it and record its own result. systemd's default, `KillMode=control-group`, ends every process of the service when it stops, runs included. `KillMode=process` ends only Dagu itself.

Open an override for the service:

```bash
sudo systemctl edit dagu
```

Add these lines, then save and exit:

```ini
[Service]
KillMode=process
```

For a user service, use `systemctl --user edit dagu`. `systemctl edit` reloads systemd, so the next restart already keeps runs.

Stopping a container stops the runs inside it. To keep runs going while Dagu restarts in a container, run them on [workers](/server-admin/distributed/) outside it.

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

## Upgrading from 2.26.0 or earlier

Later releases change how the scheduler behaves in four ways:

- **Run IDs of cron slots have a new format.** The new version cannot recognize a run the old version started, so a slot that ran in the same minute as the handover can run again. Hand over in a minute with no schedule due.
- **The data directory must have the same path on every host,** because it is now part of each slot's run ID.
- **A scheduler that loses the lock exits with status 1,** not 0. It needs a supervisor that restarts it.
- **Stopping the scheduler no longer stops runs it started from a queue.** `scheduler.failover_recovery_window` is new and on by default, at 2 minutes.

## Kubernetes

See [Kubernetes](/server-admin/deployment/kubernetes#upgrade). A new chart version can change the default image, so read its `appVersion` first:

```bash
helm repo update
helm show chart dagu/dagu | grep -E '^(version|appVersion):'
```

## Roll back

Dagu does not promise that an older version can read state written by a newer one, and downgrades are not tested. To roll back:

1. Stop Dagu on every host.
2. [Restore](/server-admin/backup-restore#restore) the backup taken before the upgrade.
3. Install the previous binary and start Dagu.

Runs made since the backup are lost from the history.
