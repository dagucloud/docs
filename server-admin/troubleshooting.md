# Troubleshooting

Start with what the running system reports:

```bash
dagu version
dagu config                         # paths in use
dagu ps                             # runs in progress on this host
dagu history --limit 20             # recent runs
dagu status --run-id <run-id> <dag> # one run in detail
journalctl -u dagu-scheduler -n 200 # service logs, on systemd
curl -s http://localhost:8090/health # dagu scheduler only, not start-all
```

Each run's log files are under `logs/<dag name>/`. Audit logs are in `logs/admin/audit/`.

## Scheduler lock messages

| Log message | Meaning | What to do |
| --- | --- | --- |
| `Waiting to acquire scheduler lock` | This instance is a standby. Another scheduler holds the lock. | Expected on a standby. On a single server, look for a forgotten scheduler using the same data directory. |
| `Acquired scheduler lock` | This instance is now active. | Nothing. |
| `Took over the scheduler lock from a failed instance` | The previous active scheduler stopped renewing the lock. | Find out why that instance failed. Its host's logs have the cause. |
| `Failed to renew scheduler lock, will retry` | A renewal failed, usually on slow or unavailable storage. | Check the storage. If it continues past the stale threshold, this instance stops. |
| `Failed to check scheduler lock, will retry` | A standby could not read the lock. | Check the storage. The standby keeps waiting. |
| `Skipping scheduler tick: scheduler lock lease expired` | The instance has gone too long without a renewal, and is dispatching nothing. | It stops shortly. Check the storage and any host stalls. |
| `Scheduler lock lost, self-fencing` | The instance could no longer hold the lock, and exits with a failure. | Confirm the supervisor restarted it. Then look for the cause in storage and host logs. |

## Schedules

**A schedule did not run.**

1. Confirm that a scheduler is active. With `dagu scheduler`, run `curl -s 'http://localhost:8090/health?role=active'`. With `dagu start-all`, check that the service is running.
2. Check whether the DAG is suspended.
3. Check the schedule's time zone. `CRON_TZ=` applies per schedule, and otherwise the server's time zone applies.
4. Check its business calendar with `dagu calendar fires`.
5. If no scheduler was running at the time, the slot was missed. See [catchup](/writing-workflows/scheduling) and [`failover_recovery_window`](/server-admin/deployment/high-availability#settings).

**A slot ran twice.** Check that every scheduler host is on a release after 2.26.0, and that the data directory has the same path on every host. See [High Availability](/server-admin/deployment/high-availability).

**Both schedulers report `active`.** They are not sharing a data directory. Compare `dagu config` on each host, and confirm the shared volume is mounted on both.

## Runs

**A run shows running, but its process is gone.** The active scheduler [marks it failed](/writing-workflows/scheduling#zombie-detection) after a few minutes. Opening the run in the UI or with `dagu status` can repair it sooner.

**Runs were marked failed after a host crashed.** This is expected. Runs on a failed host are not resumed. Set a DAG-level [`retry_policy`](/writing-workflows/durable-execution) to start them again automatically.

**Runs stop when the scheduler restarts.** The process manager is ending them. See [`KillMode`](/server-admin/deployment/high-availability#set-up-with-systemd).

**Runs wait in the queue.** Check the queue's `max_concurrency` in [Queues](/server-admin/queues). Queued runs need an active scheduler to start.

## Storage

**`stale file handle` or other I/O errors on NFS.** Confirm the mount uses `hard`, and that the storage server is healthy. A `soft` mount can return errors to Dagu during a brief outage.

**Disk or inodes are full.** Check with `df -h` and `df -i`, then reduce `hist_retention_days`. See [Operations](/server-admin/operations).

## Sign-in and secrets

**Everyone was signed out after a restart or move.** `data/auth/token_secret` changed or was not persisted. Keep the `data` directory on persistent storage.

**Secrets cannot be read after a restore or move.** `data/auth/encryption_key` is not the original. Restore it from the [backup](/server-admin/backup-restore).

**The console reports that all servers are in use.** The server lost `data/license/` and registered as new. See [Keep the server's identity](/overview/self-host-license#keep-the-server-s-identity).

## Getting help

See the [support policy](/server-admin/support-policy). A report is easiest to act on with the Dagu version, install method, operating system, storage type, and the relevant log lines with secrets removed.
