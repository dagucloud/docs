# System Requirements

Dagu is one binary. It needs no database, message broker, or language runtime.

## Platforms

Dagu's automated tests run on Linux x86-64 and Windows x86-64 on every change. The other builds are compiled from the same source at each release, but no automated test runs on them.

| Operating system | Builds | Tested on every change |
| --- | --- | --- |
| Linux | amd64, 386, arm64, armv6, armv7, ppc64le, s390x | amd64 |
| Windows | amd64, 386, arm64 | amd64 |
| macOS | amd64, arm64 | None |

| Way to run it | Supported versions |
| --- | --- |
| Container images | `linux/amd64`, `linux/arm64`, `linux/arm/v7`. See [Docker Images](/server-admin/deployment/docker-images). |
| Kubernetes, with the Helm chart | Kubernetes 1.19 or newer |

Some step types need software of their own, such as a Docker daemon for Docker steps.

## Network ports

All ports are configurable, and all are inbound to the Dagu host.

| Port | Used by | Needed when |
| --- | --- | --- |
| 8080 | Web UI and API | Always, for `dagu server` and `dagu start-all` |
| 8090 | Scheduler health endpoint | Probing `dagu scheduler` |
| 50055 | Coordinator | [Distributed workers](/server-admin/distributed/) are used |

For outbound connections, see the [firewall table](/overview/security#firewall). Dagu needs none to schedule and run workflows.

## Storage

Use a local file system, or NFS for a [standby scheduler](/server-admin/deployment/high-availability#requirements).

A shared volume holds many small files. Plan for inode use as well as bytes.

## Sizing

These figures were measured on one machine: an Apple silicon Mac with 14 cores and 48 GB of memory, on a build of Dagu after 2.26.0. They are a starting point. Measure your own workload before you commit to a size.

| Measurement | Result |
| --- | --- |
| `dagu start-all` at idle | About 90 to 110 MB of memory (RSS) |
| `dagu start-all` while 25 runs were active | 91 MB |
| Each running DAG run, as its own process | About 78 MB (RSS) |
| Disk per run with two steps and one line of output each | About 42 KB and 7 files |

RSS counts memory shared between processes, so adding it across runs overstates the total.

Estimate from these:

- **Memory:** 150 MB, plus 80 MB for each DAG run at peak concurrency, plus what your steps use.
- **CPU:** Dagu itself is rarely the limit. Size for your steps.
- **Disk:** the size of your step output, retained for as long as `hist_retention_days` keeps it, plus artifacts and about 7 files per run for each run kept.

To limit concurrency, use [queues](/server-admin/queues). To stop history from growing, see [Operations](/server-admin/operations).
