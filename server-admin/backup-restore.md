# Backup and Restore

Dagu keeps all of its state in files, so a backup is a copy of those files. No database dump is needed.

## What to back up

The paths below are relative to `DAGU_HOME`. Without `DAGU_HOME`, configuration and DAGs are in `~/.config/dagu`, and `data/` and `logs/` are in `~/.local/share/dagu`. `dagu config` shows the paths in use.

| Path | Contents | Back up |
| --- | --- | --- |
| `config.yaml`, `base.yaml`, `calendars/` | Configuration, shared DAG defaults, business calendars | Required |
| `dags/` | DAG definitions and the Wiki | Required, unless Git holds them all |
| `data/auth/` | The encryption key and the sign-in token secret | Required. Handle it as a secret. |
| `data/secrets/` | Encrypted secrets | Required |
| `data/users/`, `data/apikeys/`, `data/webhooks/`, `data/workspaces/` | People, API keys, webhooks, workspaces | Required |
| `data/license/` | Server ID and license | Required. Without it, the server registers as new and takes another license slot. |
| `data/scheduler/` | Schedule state, excluding `locks/` | Required for catch-up |
| The rest of `data/` | Run history, queues, artifacts, notification settings | Recommended |
| `logs/` | Run logs | As your retention policy needs |
| `logs/admin/audit/` | Audit logs | As your retention policy needs |

Leave these out. They describe processes that will not exist after a restore:

- `data/proc/`
- `data/service-registry/`
- `data/scheduler/locks/`
- `data/cache/`

::: danger Keep the encryption key
Secrets, and other values Dagu encrypts, can only be read with the key in `data/auth/encryption_key`, or `DAGU_ENCRYPTION_KEY` if that is set. If the key is missing, Dagu generates a new one and the old values cannot be read. Store the backup as carefully as the secrets it protects.
:::

## Back up

For a consistent copy, stop Dagu first. This example has `DAGU_HOME=/srv/dagu`:

```bash
sudo systemctl stop dagu-scheduler dagu-server

sudo tar -C /srv -czf /backup/dagu-$(date +%F).tar.gz \
  --exclude='dagu/data/proc' \
  --exclude='dagu/data/service-registry' \
  --exclude='dagu/data/scheduler/locks' \
  --exclude='dagu/data/cache' \
  dagu

sudo systemctl start dagu-scheduler dagu-server
```

To back up without stopping, take an atomic snapshot of the volume, using LVM, ZFS, or your NFS filer. Copying files from a live system can capture one file before a change and a related file after it.

In an active and standby pair, stop Dagu on both hosts, or the other host keeps writing during the copy.

## Restore

1. Stop Dagu on every host.
2. Restore the files to the same absolute path. The data directory is part of each slot's run ID, so a different path gives slots new IDs.

   ```bash
   sudo tar -C /srv -xzf /backup/dagu-2026-11-09.tar.gz
   sudo chown -R dagu:dagu /srv/dagu
   ```

3. Review DAGs that set `catchup_window`. When the scheduler starts, they replay slots missed since the backup, up to their window. Start `dagu server` first and [suspend](/web-ui/api#suspend-resume-dag-scheduling) any that must not run.
4. Start the scheduler.
5. Confirm the result:

   ```bash
   dagu history --limit 5
   curl -s http://localhost:8090/health
   ```

   Open a DAG that uses a secret and run it, to confirm the encryption key was restored.

A run that was in progress when the backup was taken has a status of running. Dagu detects that its process is gone and [marks it failed](/writing-workflows/scheduling#zombie-detection).

## Test your backups

Restore to a separate host on a schedule you can defend, and run one workflow that uses a secret. A backup you have not restored is an assumption.
