# Migrating from JP1/AJS3

A JP1/AJS3 jobnet becomes a Dagu DAG: one YAML file you keep in Git. This page maps JP1/AJS3 concepts to Dagu and Dagu Cloud, shows a converted jobnet, and moves job groups one at a time.

If you want a migration tool for your JP1/AJS3 definitions, [request it](https://dagu.sh/contact).

## How the concepts map

| JP1/AJS3 | Dagu |
| --- | --- |
| Jobnet | [DAG](/writing-workflows/basics), one YAML file |
| Job | [Step](/writing-workflows/basics#steps) |
| Predecessor link | `depends` |
| Nested jobnet | [`dag.run`](/writing-workflows/sub-dags) step |
| Recovery job | `handler_on.failure` |
| Rerun | `dagu retry` for the same run, `dagu restart` for a new one |
| Schedule rule | [`schedule`](/writing-workflows/scheduling) |
| Calendar | [Business calendar](/writing-workflows/business-calendars) |
| File-wait start condition | [`wait.file`](/step-types/wait) step |
| Agent host | [SSH](/step-types/ssh), or a [worker](/server-admin/distributed/) selected by `worker_selector` |
| Concurrency limit | `max_active_steps` within a run, or a named [queue](/server-admin/queues) across runs |
| Operator console | [Web UI](/overview/web-ui) in a browser, and the `dagu` CLI |
| Operator permissions | [Roles](/server-admin/authentication/user-management) per server or per workspace, with SSO and audit logs |
| Delay and end-time monitoring | [Deadline, missed-schedule, and running-too-long alerts](/overview/console-monitoring-alerts) in Dagu Console |
| Job monitoring across servers | [Dagu Console](/overview/console-monitoring): every server's runs, failures, and machines on one set of pages |
| Manager host database | Files in the data directory |

## Example

A nightly jobnet that waits for a file, runs three jobs in order, and calls a recovery job on failure:

```yaml
type: graph
schedule: "CRON_TZ=Asia/Tokyo 30 22 * * *"
calendar: weekdays

steps:
  - id: wait_for_sales_file
    action: wait.file
    with:
      path: /data/inbound/sales.csv
      poll_interval: 30s
    timeout_sec: 3600

  - id: load_sales
    run: /opt/batch/load_sales.sh
    depends: wait_for_sales_file

  - id: aggregate
    run: /opt/batch/aggregate.sh
    depends: load_sales

  - id: export_report
    run: /opt/batch/export_report.sh
    depends: aggregate

handler_on:
  failure:
    run: /opt/batch/recover_sales.sh
```

For Japanese holidays, replace `weekdays` with a [calendar file](/writing-workflows/business-calendars).

## Operations after the move

- **Monitoring and alerts.** [Dagu Console](/overview/dagu-cloud) shows every server's runs and failures, and alerts on failed jobs, missed deadlines, scheduled runs that did not start, and runs far past their usual time, by email, Slack, Microsoft Teams, PagerDuty, or webhook. Inside a closed network, the control plane can be deployed in your network under an Enterprise agreement. See [Private Control Plane](/server-admin/deployment/closed-network#private-control-plane).
- **Availability.** A [standby scheduler on shared storage](/server-admin/deployment/high-availability) takes over automatically when the active one stops.
- **Operator access.** The `operator` role runs and stops jobs without editing them, and `viewer` is read-only. Sign-in goes through your identity provider with SSO, and audit logs record changes. See [Plans and Licenses](/overview/self-host-license).
- **Support.** Enterprise agreements include support with response targets. See the [support policy](/server-admin/support-policy) and [contact us](https://dagu.sh/contact).

## Steps

1. Export the unit definitions of one job group as text.
2. Convert them to DAG files: unit to step, predecessor link to `depends`, recovery unit to `handler_on.failure`. A script does this mechanically, or an [AI client connected over MCP](/ai/#write-workflows-with-an-ai-tool) writes each DAG and checks it against the server before saving.
3. Run `dagu validate` on every generated file.
4. Recreate calendars, and compare the next fire times with `dagu calendar fires`.
5. Run the group in parallel with JP1/AJS3, on test data or with side effects turned off, and compare results.
6. Stop the group in JP1/AJS3 and enable its schedules in Dagu.
7. Set up [backups](/server-admin/backup-restore) and [alerts](/overview/console-monitoring-alerts) before you move the next group.
