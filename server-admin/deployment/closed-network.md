# Closed Networks

Dagu schedules and runs workflows without internet access. It needs no external database, broker, or license server. Some optional features do need a connection, and this page lists them.

## Install

On a machine with internet access, download the archive and `checksums.txt` for your platform from https://github.com/dagucloud/dagu/releases and [verify them](/server-admin/verify-releases). Then move the archive into the closed network and install the binary:

```bash
tar -xzf dagu_2.26.0_linux_amd64.tar.gz dagu
sudo install -m 0755 dagu /usr/local/bin/dagu
dagu version
```

For containers, copy the image to your own registry or load it directly:

```bash
docker pull ghcr.io/dagucloud/dagu:2.26.0
docker save -o dagu-2.26.0.tar ghcr.io/dagucloud/dagu:2.26.0

# inside the closed network
docker load -i dagu-2.26.0.tar
```

For Kubernetes, download the chart with `helm pull dagu/dagu`, push the image to your registry, and set `image.repository` and `image.tag`. See [Images and private registries](/server-admin/deployment/kubernetes#images-and-private-registries).

## Configure

Turn off the update check, which otherwise tries to reach GitHub:

```yaml
check_updates: false
```

## License

Servers that cannot reach Dagu Console use an offline license.

1. From a machine with internet access, create one with **Add offline server** on the console's **Instances** page.
2. Install it with `DAGU_LICENSE` or `DAGU_LICENSE_FILE`, or save it as `data/license/license.jwt`.

An offline server takes a license slot until its license is revoked. Paid features keep working for 14 days after a license expires, so replace it before then.

An active and standby pair that shares a data directory needs one license.

## Private Control Plane

Organizations that need central monitoring and alerts inside a closed network can have the control plane deployed in their own network. This is available on request under an Enterprise agreement, with the scope and schedule agreed per engagement. Contact `company@descarty.com`.

Your servers report to it instead of Dagu Cloud. Because it runs separately from them, it can also alert when a server stops reporting.

## What needs a connection

| Feature | Needs | Without it |
| --- | --- | --- |
| [Monitoring in Dagu Console](/overview/console-monitoring), including alerts for failed workflows, missed deadlines, and servers that stop reporting | `console.dagu.sh` | Use a [private control plane](#private-control-plane), or see [below](#alerts-without-dagu-console). |
| [Public webhook URLs](/server-admin/authentication/public-webhook-urls) | `console.dagu.sh`, `relay.dagu.sh` | Use the local webhook endpoint from inside your network. |
| [Remote access from Dagu Cloud](/overview/cloud-remote-access) | `console.dagu.sh`, `relay.dagu.sh` | Connect MCP clients to the server directly. |
| `dagu upgrade` | GitHub | [Replace the binary by hand](/server-admin/upgrades). |
| [`tools`](/writing-workflows/tools) in a DAG | GitHub, for the aqua registry and downloads | Install the commands on the host or in the image, and remove `tools` from the DAG. |
| [Dagu Actions](/dagu-actions/) | GitHub | Use built-in step types and your own commands. |
| AI steps | The model provider | Point them at a model endpoint inside your network. |

## Alerts without Dagu Console

Deadline, late-start, and server-stopped alerts come from Dagu Console. Without a [private control plane](#private-control-plane), build the alerts you need from what runs locally:

- **Failed workflows:** a [`handler_on.failure`](/writing-workflows/lifecycle-handlers) step, or [email](/writing-workflows/email-notifications) through your internal mail server.
- **Scheduler health:** the `dagu_scheduler_instances` and other [Prometheus metrics](/server-admin/prometheus-metrics), and `GET /health` on the scheduler.
- **A job that never started:** a separate check that compares the DAG's last run against when it was due, using `dagu history` or the [API](/web-ui/api).
