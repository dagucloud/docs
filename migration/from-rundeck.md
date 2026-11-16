# Migrating from Rundeck

A Rundeck job becomes a Dagu DAG: one YAML file you keep in Git. This page maps Rundeck concepts to Dagu, shows a converted job, and moves jobs a few at a time.

If you want a migration tool for your Rundeck job definitions, or a Rundeck feature you rely on, [request it](https://github.com/dagucloud/dagu/issues).

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
| Key Storage | [Secrets](/writing-workflows/secrets) |
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

## Running jobs across many nodes

- **Node targeting.** Name a host per DAG or per step with [`ssh`](/step-types/ssh), or label [workers](/server-admin/distributed/) and route steps with `worker_selector`. Fan one command out across a list of hosts with [`parallel`](/writing-workflows/control-flow).
- **Delegating jobs to a group.** Put the jobs in their own [workspace](/web-ui/workspaces) and give the group the `operator` role there. Operators run and stop those jobs without editing them. Map identity-provider groups to workspace roles with [OIDC Workspace Access](/server-admin/authentication/oidc-workspace-access).
- **Plugins.** Use a built-in [step type](/step-types/shell), an official or [custom action](/dagu-actions/custom), or call the same tool from a command.
- **High availability.** A [standby scheduler on shared storage](/server-admin/deployment/high-availability) takes over automatically when the active one stops.
- **Monitoring and alerts.** [Dagu Console](/overview/dagu-cloud) shows every server's runs and failures, and alerts by email, Slack, Microsoft Teams, PagerDuty, or webhook.

SSO, roles, and audit logs come with a [self-host license](/overview/self-host-license).

## Steps

1. List jobs by how often they run and who depends on them. Start with low-risk ones.
2. Export the job definitions as YAML from the Rundeck web console or API.
3. Convert the export to DAG files with a script, or have an [AI client connected over MCP](/ai/#write-workflows-with-an-ai-tool) write each DAG and check it against the server before saving.
4. Run `dagu validate` on every file in CI.
5. Move secrets out of Key Storage.
6. Run the new DAG alongside the Rundeck job, on a test target or with the Rundeck job's side effects turned off, and compare results.
7. Disable the Rundeck schedule and enable the Dagu one.
8. Set up [backups](/server-admin/backup-restore) and [alerts](/overview/console-monitoring-alerts) before you retire Rundeck.
