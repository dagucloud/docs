# Scheduler High Availability

Run a standby scheduler on a second host. When the active scheduler fails, the standby takes over schedules and queues with no operator action.

::: warning Version
This page describes releases after 2.26.0. In 2.26.0 and earlier:

- A scheduler that stalls past `scheduler.lock_stale_threshold` can dispatch once more after a standby has taken over, so one slot can run twice.
- A scheduler that loses the lock exits with status 0.
- Slots missed during a takeover are not replayed.
- `/health` does not report the role.
- Stopping the scheduler also stops the runs it started from a queue.
:::

## How it works

```text
        Host A                                  Host B
 +----------------------+               +----------------------+
 | dagu scheduler       |               | dagu scheduler       |
 |   ACTIVE             |               |   STANDBY            |
 | dagu server          |               | dagu server          |
 +----------+-----------+               +-----------+----------+
            |  renews the lock    watches the lock  |
            +------------------+   +----------------+
                               v   v
               Shared storage, same path on both hosts
               DAGU_HOME:  dags/  data/  logs/  config.yaml
```

Schedulers that share a data directory compete for one lock. The holder is **active**, and only it schedules runs and consumes queues. Every other instance is a **standby**, which waits and watches the holder renew the lock.

`dagu server` is not part of this. It runs on both hosts at once, and either one can serve the UI and API because both read the same files. A load balancer in front of them is yours to provide.

Runs execute on the host whose scheduler started them. A standby starts no scheduled work until it becomes active.

## What happens on failure

| Event | Result with default settings |
| --- | --- |
| The active scheduler stops cleanly | It releases the lock. A standby becomes active within 5 seconds, plus startup. |
| The active scheduler or its host dies | A standby becomes active within 40 seconds, plus startup. |
| The active scheduler stalls or loses its storage | After 23 seconds without a renewal it stops dispatching and exits with a failure. A standby takes over as in the row above, and a supervisor restarts the failed instance as a standby. |
| The standby fails | Scheduled work is unaffected. Restart the standby to restore protection. |
| A host restarts and finds the lock its crash left behind | It becomes active after 30 seconds, because it must first see the lock go unrenewed. |

The 40 seconds is `scheduler.lock_stale_threshold + 2 × scheduler.lock_retry_interval`. The 23 seconds is the stale threshold minus the renewal interval, which is the smaller of 7 seconds and a quarter of the threshold.

## What is guaranteed

These hold when the [requirements](#requirements) are met.

**Guaranteed**

- A standby becomes active within the bound above after the active scheduler dies.
- Each slot of a recurring schedule has at most one run, including around a failover. Each slot has one run ID, shared by a live run and a replay of that slot.
- A run keeps going when the scheduler that started it stops or fails, as long as the process manager leaves it running. See [`KillMode`](#set-up-with-systemd). `signal_handling.enable_propagation` is the exception: with it, a stopping scheduler stops the runs it started.
- A scheduler that loses the lock exits with a non-zero status.

**Best effort**

- A scheduler that takes over a stale lock replays slots of recurring schedules missed since the failed scheduler's last tick, as far back as `scheduler.failover_recovery_window`. Older slots are replayed only if the DAG's own `catchup_window` reaches them. Nothing is replayed when queues are disabled.
- A replayed run follows the DAG's `overlap_policy`. If a DAG still counts as running at takeover, that policy decides whether the replay runs.

**Not provided**

- Exactly-once side effects, or resuming a step after a crash. Runs on a failed host are [marked failed](/writing-workflows/scheduling#zombie-detection) and are not resumed. To run a scheduled DAG again automatically, set a DAG-level [`retry_policy`](/writing-workflows/durable-execution).
- Availability of the shared storage. While it is unavailable, no scheduler can hold the lock, and scheduling stops until it returns.
- Failover between sites.

## Requirements

| Requirement | Detail |
| --- | --- |
| Shared storage | NFSv3 or NFSv4.x, mounted with `hard,actimeo=0` on every host. In Kubernetes, a `ReadWriteMany` volume. |
| Same path | `DAGU_HOME`, or the data and DAG directories, at the same absolute path on every host. The data directory is part of each slot's run ID. |
| Same version | Every host runs the same Dagu version, apart from the short window of an [upgrade](/server-admin/upgrades). |
| Same user | The Dagu user has the same UID and GID on every host. |
| Supervisor | Something restarts a scheduler that exits, such as systemd with `Restart=always`. A scheduler that loses the lock does not come back by itself. |
| Clock sync | NTP or chrony, within a second across hosts. Takeover timing does not depend on it, but schedule times and the liveness of runs do. |
| Queues enabled | `queues.enabled` stays `true`, its default, for missed slots to be replayed. |

## Set up with systemd

Mount the shared storage on each host, here at `/srv/dagu`:

```text
# /etc/fstab
nfs.example.internal:/export/dagu  /srv/dagu  nfs  hard,actimeo=0,_netdev  0  0
```

Create `/etc/systemd/system/dagu-scheduler.service` on each host:

```ini
[Unit]
Description=Dagu scheduler
After=network-online.target remote-fs.target
Wants=network-online.target
RequiresMountsFor=/srv/dagu

[Service]
Type=simple
User=dagu
Group=dagu
WorkingDirectory=/srv/dagu
ExecStart=/usr/local/bin/dagu scheduler
Restart=always
RestartSec=10
KillMode=process
Environment="DAGU_HOME=/srv/dagu"

[Install]
WantedBy=multi-user.target
```

`KillMode=process` is what lets runs outlive a scheduler restart. With systemd's default, or with `KillMode=mixed`, stopping the unit ends every run it started. Containers behave the same way: when a Docker container or Kubernetes pod stops, the runs inside it stop too.

Create `/etc/systemd/system/dagu-server.service` the same way, with these lines changed:

```ini
Description=Dagu web server
ExecStart=/usr/local/bin/dagu server
Environment="DAGU_HOME=/srv/dagu"
Environment="DAGU_HOST=0.0.0.0"
```

Start both on each host:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now dagu-scheduler dagu-server
```

Use separate units instead of `dagu start-all`. `dagu start-all` does not serve the health endpoint, and it takes its web server down with it when the scheduler loses the lock.

## Check the pair

Each scheduler reports its role on `scheduler.port`, 8090 by default:

```bash
curl -s http://host-a:8090/health
# {"status":"healthy","role":"active"}

curl -s http://host-b:8090/health
# {"status":"healthy","role":"standby"}

curl -s -o /dev/null -w '%{http_code}\n' 'http://host-b:8090/health?role=active'
# 503
```

Rehearse a failover on your own storage before relying on it. On the active host, kill only the scheduler process:

```bash
sudo kill -9 "$(systemctl show -p MainPID --value dagu-scheduler)"
```

Within 40 seconds plus startup, `/health?role=active` answers `200` on the other host, and its log shows `Took over the scheduler lock from a failed instance`. systemd restarts the killed scheduler, which comes back as a standby.

## Monitor

`GET /health?role=active` answers `200` only on the active instance, so a probe or load balancer can find it.

The web server's [metrics](/server-admin/prometheus-metrics) include `dagu_scheduler_instances{status}`, the number of instances that are `active` or `standby`:

```yaml
groups:
  - name: dagu-scheduler
    rules:
      - alert: DaguNoActiveScheduler
        expr: dagu_scheduler_instances{status="active"} != 1
        for: 2m
      - alert: DaguNoStandbyScheduler
        expr: dagu_scheduler_instances{status="standby"} < 1
        for: 10m
```

[Troubleshooting](/server-admin/troubleshooting#scheduler-lock-messages) lists the scheduler's log messages and what to do about each.

## Settings

| Key | Environment variable | Default | Meaning |
| --- | --- | --- | --- |
| `scheduler.lock_stale_threshold` | `DAGU_SCHEDULER_LOCK_STALE_THRESHOLD` | `30s` | How long a lock can go unrenewed before a standby takes it |
| `scheduler.lock_retry_interval` | `DAGU_SCHEDULER_LOCK_RETRY_INTERVAL` | `5s` | How often a standby tries the lock |
| `scheduler.failover_recovery_window` | `DAGU_SCHEDULER_FAILOVER_RECOVERY_WINDOW` | `2m` | How far back a takeover replays missed slots; `0s` disables it |
| `scheduler.port` | `DAGU_SCHEDULER_PORT` | `8090` | Port of the health endpoint; `0` disables it |

A lower stale threshold shortens failover, but it also makes a brief storage stall more likely to end the active scheduler.

## Kubernetes

The Helm chart runs a standby in distributed mode. See [Kubernetes](/server-admin/deployment/kubernetes#standby-schedulers).

## Licensing

Hosts that share a data directory share one server ID, so an active and standby pair takes one license slot.

## Distributed workers

This page covers the scheduler. To run steps on other machines, see [Distributed Execution](/server-admin/distributed/).
