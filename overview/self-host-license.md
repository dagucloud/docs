# Plans and Licenses

Dagu is open source and free to self-host on any number of servers; this is the Community plan. A Team or Pro license turns on single sign-on, user management with roles, audit logs, incident routing, and unlimited API keys on each server it covers, and gives those servers paid monitoring in [Dagu Cloud](/overview/dagu-cloud). Team and Pro differ only in how many servers they cover.

| Plan | Price | Servers with license features |
| --- | --- | --- |
| Community | Free | None; any number of servers run without them |
| Team | $50 per month, or $500 per year | 3 |
| Pro | $150 per month, or $1,500 per year | 15 |

Workers do not count as servers. For more servers or other terms, [contact the Dagu team](https://dagu.sh/contact). The [pricing page](https://dagu.sh/pricing) lists the same prices.

## At a Glance

### On Each Server

| Capability | Community | Team | Pro |
| --- | --- | --- | --- |
| Core workflow orchestration | ✓ | ✓ | ✓ |
| Web UI | ✓ | ✓ | ✓ |
| Workers | ✓ | ✓ | ✓ |
| Docker run action | ✓ | ✓ | ✓ |
| Notification routing | ✓ | ✓ | ✓ |
| API keys | △ Up to 2 | Unlimited | Unlimited |
| OIDC/SSO | - | ✓ | ✓ |
| User management and roles (RBAC) | - | ✓ | ✓ |
| Audit logs | - | ✓ | ✓ |
| Incident routing | - | ✓ | ✓ |

### In Dagu Cloud

A Community server in Dagu Cloud uses free monitoring. [Free and Paid](/overview/console-monitoring#free-and-paid) lists every limit.

| Capability | Community | Team | Pro |
| --- | --- | --- | --- |
| Servers monitored | △ 1, with free monitoring | 3 | 15 |
| Reports and run history | △ Every 5 minutes, 7 days | Every 60 seconds, 30 days | Every 60 seconds, 30 days |
| Alert emails | △ Owners and admins | Owners, admins, and the members and addresses you add | Owners, admins, and the members and addresses you add |
| Chat, PagerDuty, and webhook alerts | - | ✓ | ✓ |
| Alert rules and deadlines per workspace, server, and workflow | - | ✓ | ✓ |
| Machine CPU, memory, and disk | - | ✓ | ✓ |
| Weekly summary | - | ✓ | ✓ |
| [People in a Dagu Console workspace](/overview/console-members) | △ Owner only | Up to 10 | Up to 10 |
| Public webhook URLs through Dagu Cloud | △ 1, with free monitoring | Up to 1,000 per server | Up to 1,000 per server |
| Remote access from Dagu Cloud (MCP) | - | ✓ | ✓ |

## Notes

- **Workers:** run jobs outside the server. Self-hosted workers are not licensed separately.
- **API keys:** a Community server has up to 2 API keys. Team and Pro remove the limit.
- **OIDC/SSO:** login with an external identity provider.
- **User management and roles (RBAC):** create, update, disable, and delete users, and give each user a role.
- **Audit logs:** review administrative and security-relevant activity.
- **Notification routing:** send workflow events to team channels.
- **Incident routing:** open and resolve provider incidents for failed workflows.
- **Monitoring in Dagu Console:** see connected servers' health, runs, and trends in one place, and get an email when a workflow fails or a server stops reporting. A Community server can be monitored for free, one per workspace and with lower limits; it stays on Community. See [Free and Paid](/overview/console-monitoring#free-and-paid).
- **Public webhook URLs through Dagu Cloud:** give a DAG's webhook an address on the internet, so GitHub, Stripe, or Slack can start it on a server with no public address. A server on Team or Pro has up to 1,000; a server on free monitoring or in a trial has one. See [Public Webhook URLs](/server-admin/authentication/public-webhook-urls).
- **Remote access from Dagu Cloud (MCP):** let MCP clients connected to Dagu Cloud use the server's MCP tools over a connection the server opens, up to a role the server's administrator chooses. It needs a Team or Pro plan, or a trial. See [Remote Access from Dagu Cloud](/overview/cloud-remote-access).

## Trial

A 14-day trial covers one server with everything Team and Pro include, except that the workspace cannot invite people, the server has one public webhook URL, and offline licenses are not available. It needs no credit card. Start it with **Also try paid features free for 14 days** when you connect a server, or with **Start free trial** on **Plan & features** for a server on free monitoring. Workspace owners get an email three days before the trial ends and another when it has ended.

## When a Plan or Trial Ends

When a plan ends, its license is suspended. At each server's next check-in, within an hour:

- One server on Dagu v2.19.2 or later moves to free monitoring, provided no other server holds the free slot.
- Every other server stops using the license and runs as Community.

Single sign-on, user management, audit logs, and incident routing turn off on all of them, and no API key can be created past the second; existing keys keep working. A server that cannot reach Dagu Cloud keeps these features until 14 days after the license's end date.

When a trial ends, its server moves to free monitoring the same way. Its paid features stop when the trial ends, with no 14-day period.

## Connect a Server

A Team or Pro workspace in [Dagu Console](https://console.dagu.sh) has a number of server slots. A workspace without a plan has one, for [free monitoring](/overview/console-monitoring#free-and-paid) on Dagu v2.19.2 or later. Each Dagu server that uses the workspace's license takes one slot, and the console's **Instances** page lists every server with its name, last check-in, and Dagu version. Workers do not take slots.

Connecting shares only the license check-in, unless the server's [Monitoring](/overview/console-monitoring), [public webhook URLs](/server-admin/authentication/public-webhook-urls), or [remote access](/overview/cloud-remote-access) is on. See [Dagu Cloud: Security and Data Flow](/overview/security). Monitoring lets the console show each server's health and runs and email you when a workflow fails or the server stops reporting. On a Community server, the **Monitor this server for free** card turns it on as part of connecting.

### From the web UI

1. Open **Plan & features** as an administrator. On the **Monitor this server for free** card, choose what the server reports and select **Connect for free**. To start the 14-day trial of paid features in the same step, also select **Also try paid features free for 14 days**.
2. Dagu Console opens in a new tab. Sign in or sign up, check that it shows the same code as Dagu, choose the workspace, and approve the server. Dagu waits up to an hour for the approval.
3. Dagu loads the license within a few seconds. The **Overview** shows the server's name, workspace, last check-in, and a link to the server in Dagu Console.

`dagu license activate` without a key does the same from a shell, which helps when the server's web UI is not reachable from your browser. On Dagu v2.22 or later, `--report` sets what the server reports; see [From the command line](/overview/console-monitoring#from-the-command-line).

A server on free monitoring starts the trial with **Start free trial** on **Plan & features**, which opens its page in Dagu Console.

### With a server key

For containers, fleets, and other automated setups, generate a **server key** on the console's **Instances** page and give it to each server:

```bash
export DAGU_LICENSE_KEY=DAGU-XXXX-XXXX-XXXX-XXXX
```

Every server that starts with the key takes a slot until the workspace's slots are used up. Generating a new key does not disconnect servers that are already connected. New servers, and servers that lost their data directory, need the new key.

### Name servers

Dagu Console shows each server by the name it reports: `license.server_name`, else the hostname. In Docker and Kubernetes the hostname is often a random container ID.

To rename a server, change its name on the server's **Settings** tab in Dagu Console, or select **Rename** next to **Server** on the **Plan & features** page in Dagu. Both set the same name, and Dagu Console and Dagu show it from then on, with the reported name beside it. Clear the name to show the reported name again.

To set the name a server reports, for example for every replica of a deployment:

```yaml
license:
  server_name: prod-eu-1
```

or `DAGU_LICENSE_SERVER_NAME=prod-eu-1`. The server sends it at every check-in, so a change shows up in the console within an hour. A name set in Dagu Console or Dagu is shown in its place.

### Keep the server's identity

Dagu stores the server's ID and license in the `license` folder of the data directory (`paths.data_dir`). Persist that directory in containers. Without it, every restart registers as a new server and takes another slot, and the console reports that all servers are in use once the slots run out.

### Check-ins and disconnecting

Connected servers check in with Dagu Console every hour, and right away when Dagu Console moves them to another license, as when a trial starts, while monitoring is on. **Plan & features** also checks in when you come back to it from Dagu Console, and **Check now** checks in immediately.

- **Disconnect** on **Plan & features**, or `dagu license deactivate`, frees the slot right away.
- **Disconnect** on the console's **Instances** page frees the slot and the server stops using the license at its next check-in. A server whose configuration still has the server key connects again when it restarts; generate a new key to prevent that.
- Slots are never freed automatically. A server that is gone for good keeps its slot until it is disconnected in the console.

### Air-gapped servers

Servers that cannot reach Dagu Console use an offline license. Create one with **Add offline server** on the console's **Instances** page and install it with `DAGU_LICENSE` or `DAGU_LICENSE_FILE`. An offline server takes a slot until its license is revoked.

For central monitoring and alerts in an air-gapped network, see [Private Control Plane](/server-admin/deployment/closed-network#private-control-plane).

## Related Pages

- [Monitoring](/overview/console-monitoring)
- [Public Webhook URLs](/server-admin/authentication/public-webhook-urls)
- [Remote Access from Dagu Cloud](/overview/cloud-remote-access)
- [Dagu Console Account](/overview/console-account)
- [Dagu Console Members](/overview/console-members)
- [Builtin Authentication](/server-admin/authentication/builtin)
- [OIDC Authentication](/server-admin/authentication/oidc)
- [Audit Logging](/server-admin/server#audit-logging)
- [Notifications](/web-ui/notifications)
- [Incident Routing](/web-ui/incidents)
- [Pricing](https://dagu.sh/pricing)
