# Migrating from Rundeck

There is no importer. A migration means rewriting each job as a YAML file, which is usually mechanical. Plan to move a few jobs at a time and run them in parallel with Rundeck before cutting over.

## How the concepts map

| Rundeck | Dagu |
| --- | --- |
| Job | [DAG](/writing-workflows/basics), one YAML file |
| Job step | [Step](/writing-workflows/basics#steps) |
| Sequential workflow | Steps linked with `depends` |
| Job option | [`params`](/writing-workflows/data-variables) |
| Error handler | `handler_on.failure`, or a step's `retry_policy` and `continue_on` |
| Schedule | [`schedule`](/writing-workflows/scheduling), with `CRON_TZ=` for the time zone |
| Node dispatch over SSH | [`ssh`](/step-types/ssh), per DAG or per step |
| Agent on a node | [Worker](/server-admin/distributed/) selected by `worker_selector` |
| Job reference | [`dag.run`](/writing-workflows/sub-dags) step |
| Key Storage | Secrets |
| Webhook | [Webhooks](/server-admin/authentication/webhooks) |
| Project | [Workspace](/web-ui/workspaces) |
| Job definitions in the database | Files in Git, checked with `dagu validate` |

## Example

A nightly deployment job with an option, a retry, and an error handler:

```yaml
type: graph
schedule: "CRON_TZ=Asia/Tokyo 0 2 * * *"
calendar: weekdays

params:
  - name: environment
    default: staging

ssh:
  user: deploy
  host: app01.example.internal
  key: /etc/dagu/keys/deploy

steps:
  - id: stop_app
    run: sudo systemctl stop myapp

  - id: migrate
    run: /opt/myapp/bin/migrate --env "${params.environment}"
    depends: stop_app
    retry_policy:
      limit: 3
      interval_sec: 30

  - id: start_app
    run: sudo systemctl start myapp
    depends: migrate

handler_on:
  failure:
    run: /opt/ops/page-oncall.sh
```

## What does not carry over

- **Node filters and resource models.** Dagu has no fleet inventory. Name hosts directly, or use worker labels, and express a fan-out with [`parallel`](/writing-workflows/control-flow).
- **Per-job ACLs.** Roles apply to a whole server or a workspace, so you cannot hand a single job to a group. To limit a group to certain jobs, give those jobs their own workspace.
- **Plugins.** Rundeck plugins do not run on Dagu. Use a [step type](/step-types/shell) or call the same tool from a command.
- **Cluster mode.** Dagu has one active scheduler with [standbys on shared storage](/server-admin/deployment/high-availability), which is a different design from a Rundeck cluster.

SSO, roles, and audit logs need a [self-host license](/overview/self-host-license).

## Steps

1. List jobs by how often they run and who depends on them. Start with low-risk ones.
2. Export the job definitions as YAML from the Rundeck web console or API.
3. Write a script that turns the export into DAG files, or convert a few by hand to learn the mapping.
4. Run `dagu validate` on every file in CI.
5. Move secrets out of Key Storage.
6. Run the new DAG alongside the Rundeck job, on a test target or with the Rundeck job's side effects turned off, and compare results.
7. Disable the Rundeck schedule and enable the Dagu one.
8. Set up [backups](/server-admin/backup-restore) and [alerts](/server-admin/prometheus-metrics) before you retire Rundeck.
