# Deployment Models

Dagu can run as a local single-server process, a self-hosted production server, a managed Dagu Cloud server, or a hybrid deployment. The same workflow YAML can move between these models; the main decision is where the Dagu server runs and where workflow steps execute.

For the visual version on the website, see [Deployment models](https://dagu.cloud/#deployment-models). For commercial plans, see [Pricing](https://dagu.cloud/pricing).

## Terms

| Term | Meaning |
|------|---------|
| **Dagu server** | The Web UI, REST API, scheduler, queues, run state, logs, and coordinator service when distributed execution is enabled. If the coordinator runs as a separate process, it must be configured with access to the same Dagu persistent storage as the server components. |
| **Worker** | A `dagu worker` process that connects to a coordinator and executes assigned DAG runs. Workers can be selected by labels. |
| **Execution** | The place where workflow steps actually run: the Dagu server itself, a self-hosted worker, or a hybrid worker attached to a managed server. |
| **Hybrid worker** | A worker you run inside your own infrastructure and connect to a managed Dagu Cloud server. Use it for Docker steps, private networks, custom runtimes, secrets, or data-local work. |

## Models

| Model | Dagu server runs in | Workflow execution | Best for | More information |
|-------|--------------------|--------------------|----------|------------------|
| **Local single server** | One machine you operate. | On the same machine. | Development, small internal automation, edge devices, or a first production host. | [Quickstart](/getting-started/quickstart), [Installation](/getting-started/installation/) |
| **Self-hosted** | Your infrastructure, using the open-source Dagu server. | On the server or on workers you operate. | Teams that want Dagu inside their own network and security boundary. | [Deployment](/server-admin/deployment/), [Distributed Execution](/server-admin/distributed/) |
| **Licensed self-hosted** | Your infrastructure, with a paid self-host license when enterprise features are needed. | On the server or on self-hosted workers. Workers are not licensed separately. | Teams that need enterprise controls such as SSO, RBAC, audit logging, and support while keeping Dagu self-hosted. | [Self-host pricing](https://dagu.cloud/pricing#self-host), [Dagu Pro](https://dagu.cloud/pro) |
| **Dagu Cloud managed server** | A dedicated managed Dagu server operated by Dagu Cloud in an isolated gVisor instance on GKE. The managed license is included. | Directly in the managed Dagu server when the workflow fits the managed runtime boundary. | Teams that want Dagu as a full managed server instead of operating the server themselves. | [Managed pricing](https://dagu.cloud/pricing#managed), [Dagu Cloud](https://dagu.cloud/cloud) |
| **Hybrid managed server + hybrid workers** | Dagu Cloud operates the managed Dagu server. | Hybrid workers run inside your infrastructure and connect to the managed server. | Workflows that need managed operations but must execute Docker steps, private-network jobs, custom runtime work, or data-local processing inside your environment. | [Workers](/server-admin/distributed/workers/), [Docker step type](/step-types/docker), [Deployment options](https://dagu.cloud/cloud#deployment-model) |

## Common Topologies

Each topology below uses its own diagram so the labels stay readable in the docs.

### Local single server

<img src="/deployment-models/local.gif" alt="Local single-server Dagu deployment with the Web UI, API, scheduler, executor, and persistent volume on one host." style="width: 100%; border-radius: 8px; border: 1px solid var(--vp-c-divider); margin: 16px 0 24px;" />

Use this model when one machine is enough. `dagu start-all` runs the Web UI, scheduler, and execution engine in one process. State is file-backed by default, usually on local disk.

### Self-hosted with workers

<img src="/deployment-models/self-hosted.gif" alt="Self-hosted Dagu deployment where the Web UI, scheduler, queue, coordinator, and workers run in your infrastructure and the server-side components share the same persistent volume." style="width: 100%; border-radius: 8px; border: 1px solid var(--vp-c-divider); margin: 16px 0 24px;" />

Use this model when you want to keep the server, workers, secrets, logs, and workflow execution inside your own infrastructure. The server-side components, including the coordinator, use the same Dagu persistent storage. Workers either share that storage in shared-filesystem mode or report status and logs back to the coordinator in shared-nothing mode.

### Managed Dagu Cloud server

<img src="/deployment-models/managed.gif" alt="Dagu Cloud managed server deployment with managed Web UI, API, scheduler, coordinator, runtime, and persistent storage in an isolated gVisor instance on GKE." style="width: 100%; border-radius: 8px; border: 1px solid var(--vp-c-divider); margin: 16px 0 24px;" />

Dagu Cloud is a full managed Dagu server, not only a coordinator. Dagu Cloud operates the server components and their persistent storage. It can run workflows directly when they fit the managed runtime boundary. The managed server is provisioned as a dedicated isolated gVisor instance on GKE, and the managed license is included.

::: warning Docker steps in managed instances
Dagu Cloud managed instances do not expose a Docker daemon or Docker socket. Docker step types do not run inside the managed instance. Use self-hosted Dagu or attach a hybrid worker when a workflow needs Docker step execution.
:::

### Hybrid execution

<img src="/deployment-models/hybrid.gif" alt="Hybrid Dagu deployment where Dagu Cloud operates the managed server and hybrid workers run inside your infrastructure for Docker steps, private APIs, and data-local work." style="width: 100%; border-radius: 8px; border: 1px solid var(--vp-c-divider); margin: 16px 0 24px;" />

Use this model when you want Dagu Cloud to operate the server but need selected workflow execution to stay close to your systems. Hybrid workers are optional. They are useful for:

- Docker step execution
- Access to private networks or private APIs
- Custom toolchains and local runtimes
- Workflows that must run near data or secrets
- Jobs that should stay inside your infrastructure boundary

## Choosing a Model

| Requirement | Recommended model |
|-------------|-------------------|
| Try Dagu locally or run small automation on one host. | Local single server |
| Keep all control, state, and execution in your own environment. | Self-hosted |
| Add enterprise controls while staying self-hosted. | Licensed self-hosted |
| Avoid operating the Dagu server yourself. | Dagu Cloud managed server |
| Use a managed server but run Docker/private-network/data-local steps in your environment. | Hybrid managed server + hybrid workers |

## Pricing and Licensing Links

- [Community self-host](https://dagu.cloud/pricing#self-host): open-source Dagu for self-hosted use.
- [Paid self-host licenses](https://dagu.cloud/pricing#self-host): enterprise controls for self-hosted Dagu servers.
- [Managed Dagu Cloud](https://dagu.cloud/pricing#managed): dedicated managed Dagu server with the managed license included.
- [Contact](https://dagu.cloud/contact): sizing, deployment, or security review questions.

For implementation details, use the deployment guides:

- [Install Dagu](/getting-started/installation/)
- [Deploy Dagu](/server-admin/deployment/)
- [Distributed Execution](/server-admin/distributed/)
- [Workers](/server-admin/distributed/workers/)
- [Docker step type](/step-types/docker)
