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

   On Kubernetes, keep it in a Secret and load it into each Job's container:

   ```bash
   kubectl create secret generic dagu-run-key \
     --from-literal=DAGU_CLOUD_RUN_KEY=drk_...
   ```

   ```yaml
   envFrom:
     - secretRef:
         name: dagu-run-key
   ```

   In CI, add it as a secret named `DAGU_CLOUD_RUN_KEY`.
3. Run a DAG. The process prints `Reporting this run to Dagu Console`, and the run shows on Console's **Runs** page under the key's name.

- A value that does not start with `drk_` is ignored with a warning, and the run goes on without reporting.
- Steps never inherit the key.
- The process's output never names the key or the workspace, since job logs are often public.
- To stop a key, select **Revoke** next to it on **Servers**. Machines that use it stop reporting at once, and their runs print that Console refused the key.

## When It Reports

- When the run starts, then about every minute while it runs, and at once when its status changes, such as to waiting for an approval. Console sets the interval, between 30 seconds and 5 minutes.
- When it finishes. The finish is tried for up to 10 seconds, so the process exits soon whether or not Console answers. A finish that cannot be sent in that time is lost: nothing is kept on the machine to send later. A [deadline](/overview/console-monitoring-alerts#alert-rules) on the workflow catches a scheduled job that never reported.
- Reports go out over HTTPS from the machine, and honor `HTTPS_PROXY`, `NO_PROXY`, and the system's certificates. No inbound port is needed.

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

- A workspace has 10,000 job runs a month. Once they are used, until the month ends, successful runs are counted but not listed; failed runs still alert and are listed. The run's process prints `Dagu Console counted this run but does not list it: this month's job runs are used`.
- Finished job runs are kept 30 days on a Team or Pro plan or in a trial, and 7 days on [free monitoring](/overview/console-monitoring#free-and-paid).
- A report holds up to 64 KiB. A run that does not fit leaves out its steps first, then its error messages, then all but its first failed step name.

## Related Pages

- [Monitoring](/overview/console-monitoring)
- [Alerts and Email](/overview/console-monitoring-alerts)
- [Console Pages](/overview/console-monitoring-pages)
- [Configuration Reference](/server-admin/reference)
