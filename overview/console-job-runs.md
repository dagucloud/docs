---
description: Report DAG runs from Kubernetes Jobs, CI steps, and other machines that come and go to Dagu Console with a run key, without running a Dagu server or taking a license.
---

# Job Runs

A DAG that runs on a machine that exists only for that run, such as a Kubernetes Job, a CI step, or a Cloud Run job, can report its run to [Dagu Console](https://console.dagu.sh) with a run key. Console lists the run with your servers' runs, keeps it after the machine is gone, and alerts when it fails, as it does for a server's runs.

- **No server**: the machine takes no license and none of your plan's servers. A run key only writes runs; it reads nothing.
- **One run per process**: `dagu start`, `dagu exec`, `dagu retry`, and `dagu restart` report their top-level run. A sub-DAG reports as a step of its parent, and a run on a [distributed worker](/server-admin/distributed/) is reported by its server, not with the key.
- **Never in the way**: reporting never changes the run's status, exit code, or start time, and adds at most about 10 seconds to the process's exit.

Job runs need Dagu v2.28 or later.

## Set It Up

1. In Dagu Console, open **Servers**. Under **Jobs**, enter a name for the key in **New run key** and select **Create run key**. Copy the key: it starts with `drk_` and is shown only once.
2. Set it on each machine that runs your DAGs, as `DAGU_CLOUD_RUN_KEY` or `cloud.run_key`:

   ```bash
   DAGU_CLOUD_RUN_KEY=drk_... dagu start etl.yaml
   ```

   On Kubernetes, keep it in a Secret; in CI, in a secret named `DAGU_CLOUD_RUN_KEY`. [Examples](#examples) has a complete Kubernetes CronJob and GitHub Actions workflow.
3. Run a DAG. The process prints `Reporting this run to Dagu Console`, and the run shows on Console's **Runs** page under the key's name.

- A value that does not start with `drk_` is ignored with a warning, and the run goes on without reporting.
- Steps never inherit the key.
- The process's output never names the key or the workspace, since job logs are often public.
- To stop a key, select **Revoke** next to it on **Servers**. Machines that use it stop reporting at once, and their runs print that Console refused the key.

## Examples

### Kubernetes CronJob

Runs `nightly-etl` every day at 02:00 UTC in a new Pod. The DAG comes from a ConfigMap, and the run key from a Secret:

```bash
kubectl create secret generic dagu-run-key \
  --from-literal=DAGU_CLOUD_RUN_KEY=drk_...
```

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: nightly-etl
data:
  nightly-etl.yaml: |
    steps:
      - name: extract
        command: echo extracting
      - name: load
        command: echo loading
        depends: [extract]
---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: nightly-etl
spec:
  schedule: "0 2 * * *"
  timeZone: Etc/UTC
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      backoffLimit: 0
      template:
        spec:
          restartPolicy: Never
          containers:
            - name: dagu
              image: ghcr.io/dagucloud/dagu:latest
              args: ["dagu", "start", "/dags/nightly-etl.yaml"]
              envFrom:
                - secretRef:
                    name: dagu-run-key
              volumeMounts:
                - name: dags
                  mountPath: /dags
                  readOnly: true
          volumes:
            - name: dags
              configMap:
                name: nightly-etl
```

- Console lists the run under the key's name, with the Pod's name as its host.
- `args`, not `command`, keeps the image's [entrypoint](/server-admin/deployment/docker-images#entrypoint-and-process-reaping), which reaps the processes steps leave behind.
- `backoffLimit: 0` keeps a failed run one run: each Pod Kubernetes starts again is a new run in Console. Retry inside the DAG with `retry_policy` instead.
- A Pod that is evicted or killed for memory mid-run sends no finish. Console records its run as [lost](#when-it-reports) and alerts.
- A CronJob that never starts sends nothing. Give the workflow a [deadline](/overview/console-monitoring-alerts#deadline-alerts) in Console, such as **Must succeed by** 03:00.

### GitHub Actions

Save as `.github/workflows/nightly-etl.yml`, with the DAG at `dags/nightly-etl.yaml` in the repository, and add the run key as a repository secret named `DAGU_CLOUD_RUN_KEY` under **Settings** > **Secrets and variables** > **Actions**:

```yaml
name: nightly-etl
on:
  schedule:
    - cron: "0 2 * * *"
  workflow_dispatch:
jobs:
  etl:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dagucloud/setup-dagu@v1
      - name: Run the DAG
        run: dagu start dags/nightly-etl.yaml
        env:
          DAGU_CLOUD_RUN_KEY: ${{ secrets.DAGU_CLOUD_RUN_KEY }}
```

[setup-dagu](https://github.com/dagucloud/setup-dagu) installs Dagu. The run's page in Console links to the workflow run on GitHub, where its log is.

## When It Reports

- When the run starts, then about every minute while it runs, and at once when its status changes, such as to waiting for an approval. Console sets the interval, between 30 seconds and 5 minutes.
- When it finishes. The finish is tried for up to 10 seconds, so the process exits soon whether or not Console answers. A finish that cannot be sent in that time is lost: nothing is kept on the machine to send later. A [deadline](/overview/console-monitoring-alerts#alert-rules) on the workflow catches a scheduled job that never reported.
- Reports go out over HTTPS from the machine, and honor `HTTPS_PROXY`, `NO_PROXY`, and the system's certificates. No inbound port is needed.

A run whose machine stops reporting it, as when a Pod is evicted or a machine shuts down, is recorded **lost** once it misses three of its report intervals, about 3 minutes, and [alerts](/overview/console-monitoring-alerts#lost-run-alerts). The steps it was running are lost with it. If its machine's finish comes after all, it replaces the record.

## What Is Sent

- **The run**: DAG name, run and attempt IDs, status, times, failed step names, and its steps with their status, times, retries, and the steps each one waits for, as a server sends [run status](/overview/console-monitoring#run-status).
- **Where it ran**:
  - The platform: GitHub Actions, GitLab CI, Buildkite, CircleCI, Azure Pipelines, Jenkins, Cloud Run, AWS Batch, or Kubernetes.
  - A link to the CI run, where the platform gives one.
  - The machine's hostname.
- **The trigger**: only when given with `--trigger-type`, or for a retry or restart. Otherwise Console shows the platform in its place.
- **The Dagu version.**

Logs, outputs, parameters, and the DAG file are never sent.

## Error Messages

A job run reports at `runs` unless `cloud.report` says otherwise, so by default it sends no error messages.

- **To send them**, set `cloud.report: errors` or `DAGU_CLOUD_REPORT=errors` on the machine. A failed run then also carries why it failed, as a server's does at [`errors`](/overview/console-monitoring#error-messages): the error messages of up to 5 failed steps, each up to 2 KB from its end. A machine that is gone leaves them nowhere else, and a failure alert without them says only which step failed.
- **Masking**: known secret values and common token formats are replaced. Error messages can still contain hosts, paths, or data a step printed.
- **Keeping none**: a workspace can discard them on arrival, under **What to keep from Dagu servers** in Console's settings.
- **Reporting nothing**: with `cloud.report` set to `off` or `health`, a job run does not report.

When a failed job run has no error message, its page in Console says so and links here.

## Limits

A workspace has a monthly allowance of job runs, counted by calendar month in its time zone:

| Plan | Job runs a month | Price |
| --- | --- | --- |
| No plan | 1,000 | Free |
| Team, or a trial | 10,000 | Included |
| Pro | 20,000 | Included |
| Run Monitoring 10K | 10,000 | $19 per month, or $190 per year |
| Run Monitoring 100K | 100,000 | $99 per month, or $990 per year |

- **Run Monitoring plans** are bought by an owner on Console's **Billing** page, apart from Team and Pro. They license no server. For more than 100,000 job runs a month, [contact the Dagu team](https://dagu.sh/contact).
- **Several plans**: a workspace gets the largest allowance, not the sum. Pro with Run Monitoring 10K has 20,000.
- **Past the allowance**, until the month ends, successful runs are counted but not listed, and the run's process prints `Dagu Console counted this run but does not list it: this month's job runs are used`. Failed runs still alert, and are listed until the month's listed job runs reach 110% of the allowance. Owners get an email at 80% and at 100%. Nothing is charged automatically.
- **History**: finished job runs are kept 30 days on Team, Pro, a Run Monitoring plan, or in a trial, and 7 days without a plan.
- **Alerts**: without a plan, failure and lost-run alerts go by email. Team, Pro, a trial, or a Run Monitoring plan also sends job runs' alerts to chat, PagerDuty, and webhooks, and lets owners give a job's workflow a [deadline](/overview/console-monitoring-alerts#deadline-alerts) and a [limit on how long its runs run](/overview/console-monitoring-alerts#running-too-long-alerts).
- A report holds up to 64 KiB. A run that does not fit leaves out its steps first, then its error messages, then all but its first failed step name.

## Related Pages

- [Monitoring](/overview/console-monitoring)
- [Alerts and Email](/overview/console-monitoring-alerts)
- [Console Pages](/overview/console-monitoring-pages)
- [Configuration Reference](/server-admin/reference)
