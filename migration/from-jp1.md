# Migrating from JP1/AJS3

There is no automatic converter. Because Dagu's definitions are plain YAML, a migration is a script you write and can rerun: export the unit definitions as text, generate DAG files, and validate them. Move one job group at a time, and run it in parallel with JP1/AJS3 before cutting over.

JP1 is a suite. Dagu replaces only the job scheduling part. Monitoring, asset management, and other JP1 products need their own replacements.

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

## What to plan for

- **Availability.** Only one scheduler is active at a time. A [standby on shared storage](/server-admin/deployment/high-availability) takes over if it fails, and the storage is yours to provide. Runs on a failed host are marked failed and are not resumed.
- **Support.** Team and Pro licenses do not include support. Enterprise agreements add response targets. See the [support policy](/server-admin/support-policy).
- **Operator access.** SSO, roles, and audit logs need a [self-host license](/overview/self-host-license). Roles apply to a whole server or a workspace, not to a single job.
- **Deadline alerts.** Alerts for missed deadlines and late starts come from Dagu Console. A closed network needs a [private control plane](/server-admin/deployment/closed-network#private-control-plane), available on request under an Enterprise agreement, or [its own checks](/server-admin/deployment/closed-network#alerts-without-dagu-console).

## Steps

1. Export the unit definitions of one job group as text.
2. Map them with a script: unit to step, predecessor link to `depends`, recovery unit to `handler_on.failure`.
3. Run `dagu validate` on every generated file.
4. Recreate calendars, and compare the next fire times with `dagu calendar fires`.
5. Run the group in parallel with JP1/AJS3, on test data or with side effects turned off, and compare results.
6. Stop the group in JP1/AJS3 and enable its schedules in Dagu.
7. Set up [backups](/server-admin/backup-restore) and [alerts](/server-admin/prometheus-metrics) before you move the next group.
