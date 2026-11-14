# Deployment Models

Dagu runs on one machine, on temporary workers your platform creates for each run, or on workers you keep running. All three are self-hosted, and the same workflow YAML runs on any of them.

## Terms

| Term | Meaning |
|------|---------|
| **Dagu server** | The Web UI, REST API, scheduler, queues, run history, logs, and coordinator service when distributed execution is enabled. If the coordinator runs as a separate process, it must be configured to use the same shared Dagu data as the other server components. |
| **Worker** | A `dagu worker` process that connects to a coordinator and executes dispatched DAG runs. Selectable by labels. |
| **Temporary worker** | Compute your platform provisions for a single run. It invokes `dagu start` rather than running `dagu worker`, and is destroyed when the run ends. |
| **Execution** | The place where workflow steps actually run: the Dagu server itself, a worker you operate, or a temporary worker that your platform provisions for one run on a machine sharing the same volume. |

## Common Topologies

Each topology below uses its own diagram so the labels stay readable in the docs.

### Single server

<picture>
  <source media="(max-width: 640px)" srcset="/deployment-models/single-server-portrait.svg" width="480" height="610">
  <img src="/deployment-models/single-server.svg" width="720" height="450" alt="Single server: one machine runs dagu start-all; the Dagu server runs your steps and writes DAGs, run history, and logs to local files." style="width: 100%; height: auto; margin: 16px 0 24px;">
</picture>

Use this model when one machine is enough. `dagu start-all` runs the Web UI, scheduler, and execution engine in one process. History and logs stay on the same machine by default.

### Temporary workers

<picture>
  <source media="(max-width: 640px)" srcset="/deployment-models/temporary-workers-portrait.svg" width="480" height="712">
  <img src="/deployment-models/temporary-workers.svg" width="720" height="450" alt="Temporary workers: your launcher starts a temporary worker that runs dagu start and writes state to a shared volume; the always-on Dagu server reads the same volume, with no network path between the two." style="width: 100%; height: auto; margin: 16px 0 24px;">
</picture>

Use this model when each run should get its own compute, provisioned on demand and destroyed once the run finishes. Your platform starts a container or job that runs the binary and exits:

```bash
dagu start etl.yaml
dagu retry --run-id="$RUN_ID" etl
```

The worker and the Dagu server share one volume and nothing else. There is no coordinator, no gRPC, and no network path between them. Status, history, and logs reach the Web UI because both read and write the same files.

Anything that can start a container against the volume can drive it:

- Cloud Run Jobs, AWS Batch, or Azure Container Apps Jobs
- Kubernetes Jobs and CronJobs with the volume attached
- Nomad batch jobs or Slurm
- a CI job on GitHub Actions, GitLab CI, or Jenkins
- cron or a systemd timer on a host that already mounts the volume

Because a worker exists only while its run is in flight, execution capacity falls to zero between jobs and scales out by starting more of them. Distributed workers hold a daemon on every execution host; here a worker lives no longer than the run it was created for.

**Concurrency.** Each dag-run owns a directory, and Dagu locks it by creating a directory, an operation that is atomic on POSIX filesystems and over NFS. Two processes therefore cannot operate on the same dag-run. Separate runs never contend, because each has its own ID and its own directory. Pass `--run-id` when the launcher already has a stable identifier, so a restarted Kubernetes Job or a rerun CI build resumes its run instead of creating a duplicate.

**Scheduling.** The `schedule:` field and queues are handled by the scheduler process, so neither takes effect unless a `dagu scheduler` runs somewhere. In this model the launcher owns scheduling. Keep DAG definitions on the shared volume under `paths.dags_dir` so the server can render and edit the same files the launcher runs.

### Distributed workers

<picture>
  <source media="(max-width: 640px)" srcset="/deployment-models/distributed-workers-portrait.svg" width="480" height="648">
  <img src="/deployment-models/distributed-workers.svg" width="720" height="450" alt="Distributed workers: workers on your hosts poll the coordinator in the Dagu server over outbound gRPC, so they need no inbound port; the server writes status, logs, and artifacts to Dagu data." style="width: 100%; height: auto; margin: 16px 0 24px;">
</picture>

Use this model when execution should sit on hosts you keep running and pick by label. The server dispatches tasks into a coordinator; workers connect outbound over gRPC, poll for tasks matching their labels, and report status, logs, and artifacts back. Nothing is pushed to a worker, so workers need no inbound port.

The coordinator writes worker output to the same Dagu data as the rest of the server side: run status through the DAG-run repository, plus streamed logs and artifacts under `paths.log_dir` and `paths.artifact_dir`. Workers do not access that server storage directly.

Unlike temporary workers, these stay up between runs, which is what buys label routing, warm toolchains, and a fixed place for private-network access. Workers are useful for:

- Docker step execution on dedicated hosts
- Access to private networks or private APIs
- Custom toolchains and local runtimes
- Workflows that must run near data or secrets
- Distributing heavier workloads across multiple execution hosts

## Choosing a Topology

| Requirement | Topology |
|-------------|----------|
| Try Dagu, or run scheduled work on a single host. | Single server |
| Give each run its own compute and hold no capacity between jobs. | Temporary workers |
| Route Docker, private-network, or data-local steps to hosts you keep running. | Distributed workers |
| Keep scheduling through the failure of one host. | Any of these, with a [standby scheduler](/server-admin/deployment/high-availability) |

## Where the Control Plane Runs

| Option | Where it runs | Availability |
|--------|---------------|--------------|
| None | Run servers without a control plane. | Community |
| Dagu Cloud | Hosted at `console.dagu.sh`. Servers connect out. | Free monitoring, Team, and Pro |
| [Private Control Plane](/server-admin/deployment/closed-network#private-control-plane) | Inside your own network. Nothing connects to Dagu Cloud. | On request, under an Enterprise agreement |

## Monitoring Across Topologies

Every topology can report to [Dagu Console](/overview/console-monitoring), which shows your servers together and emails you when a workflow fails or a server stops reporting. Several independent servers, such as one per site, each connect to the same workspace and appear side by side.

<picture>
  <source media="(max-width: 640px)" srcset="/deployment-models/console-monitoring-portrait.svg" width="480" height="804">
  <img src="/deployment-models/console-monitoring.svg" width="720" height="450" alt="Monitoring with Dagu Console: three servers, one per topology, report metadata to Dagu Console over outbound HTTPS; Dagu Console shows them together and emails you when a workflow fails or a server goes silent, while logs, outputs, and secrets stay on each server." style="width: 100%; height: auto; margin: 16px 0 24px;">
</picture>

The always-on Dagu server sends the reports (`dagu server` or `dagu start-all`); workers never report themselves. With Dagu v2.25.7 or later on a paid plan, the server also reports its distributed workers from their heartbeats to the coordinator. It reports the runs whose events reach its event store, `paths.event_store_dir`, which defaults to `logs/admin/events` under the Dagu home rather than under the data directory.

| Topology | Runs reported |
|----------|---------------|
| **Single server** | Every top-level run. |
| **Temporary workers** | Runs on temporary workers only when they write to the server's event store directory. Share that directory on the volume, not just the data directory. |
| **Distributed workers** | Every top-level run: the coordinator records what workers report. A standalone `dagu coordinator` must use the same event store directory as the server. |

Sub-DAG runs are not reported on their own; their top-level run is.

## Public Webhook URLs Across Topologies

[Public webhook URLs](/server-admin/authentication/public-webhook-urls) work in every topology. The scheduler holds the connection to Dagu Cloud, so a server needs a running scheduler: `dagu start-all`, or `dagu scheduler` beside `dagu server`. With several schedulers for high availability, only the one holding the scheduler lock connects.

| Topology | Where webhook runs execute |
|----------|----------------------------|
| **Single server** | On the server. |
| **Temporary workers** | On a temporary worker, like any queued run. |
| **Distributed workers** | Wherever the DAG's worker selector routes it. The worker writes `WEBHOOK_PAYLOAD_FILE` locally, so the payload file works there too. |

Only the scheduler needs outbound HTTPS to `relay.dagu.sh` and `console.dagu.sh`. Workers need nothing extra.

## Remote Access Across Topologies

[Remote access](/overview/cloud-remote-access) works in every topology. Each process that serves the web UI, `dagu server` or `dagu start-all`, opens its own connection to Dagu Cloud while remote access is on. Calls go to the process heard from most recently, so a server with several replicas keeps taking calls while one restarts.

| Topology | Where calls run |
|----------|-----------------|
| **Single server** | On the server. |
| **Temporary workers** | On the server. A run that a call starts or retries is queued like any other and can run on a worker. |
| **Distributed workers** | On the server, with runs routed as above. |

The processes that serve the web UI need outbound HTTPS to `relay.dagu.sh` and `console.dagu.sh`. Workers need nothing extra. See [Dagu Cloud: Security and Data Flow](/overview/security) for every connection and what it carries.

## Pricing and Licensing Links

- [Community self-host](https://dagu.sh/pricing#self-host): open-source Dagu for self-hosted use.
- [Team and Pro self-host licenses](https://dagu.sh/pricing#self-host): enterprise controls and more API keys for self-hosted Dagu servers.
- [Plans and Licenses](/overview/self-host-license): prices and features of Community, Team, and Pro.
- [Monitoring](/overview/console-monitoring): one view of all your Dagu servers in Dagu Console, free for one server; Team and Pro cover every licensed server.
- [Public Webhook URLs](/server-admin/authentication/public-webhook-urls): start DAGs from GitHub, Stripe, or Slack on servers with no public address.
- [Contact](https://dagu.sh/contact): sizing, deployment, or security review questions.

For setup details and operating guides, use:

- [Install Dagu](/getting-started/installation/)
- [Deploy Dagu](/server-admin/deployment/)
- [Distributed Execution](/server-admin/distributed/)
- [Workers](/server-admin/distributed/workers/)
- [Docker action](/step-types/docker)
