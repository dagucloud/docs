# License Comparison

This page compares the Community, Team, and Pro self-host plans. It does not list prices; see the [pricing page](https://dagu.sh/pricing) for current commercial terms.

## At a Glance

| Capability | Community | Team | Pro |
| --- | --- | --- | --- |
| Core workflow orchestration | ✓ | ✓ | ✓ |
| Web UI | ✓ | ✓ | ✓ |
| Workers | ✓ | ✓ | ✓ |
| Docker run action | ✓ | ✓ | ✓ |
| API keys | △ Up to 2 | ✓ | ✓ |
| OIDC/SSO | - | ✓ | ✓ |
| User management | - | ✓ | ✓ |
| Audit logs | - | ✓ | ✓ |
| Notification routing | ✓ | ✓ | ✓ |
| Incident routing | - | ✓ | ✓ |

## Notes

- **Workers:** run jobs outside the server. Self-hosted workers are not licensed separately.
- **Server licenses:** Team includes 3 self-host server licenses; Pro includes 15.
- **API keys:** Community self-host supports up to 2 API keys.
- **OIDC/SSO:** login with an external identity provider.
- **User management:** create, update, disable, and delete users.
- **Audit logs:** review administrative and security-relevant activity.
- **Notification routing:** send workflow events to team channels.
- **Incident routing:** open and resolve provider incidents for failed workflows.

## Connect a Server

A Team or Pro workspace in [Dagu Console](https://console.dagu.sh) has a number of server slots. Each Dagu server that uses the workspace's license takes one slot, and the console's **Servers** page lists every server with its name, last check-in, and Dagu version. Workers do not take slots.

### From the web UI

1. Open **Plan & features** as an administrator and select **Connect to Dagu Console**.
2. Dagu Console opens in a new tab. Sign in, check that it shows the same code as Dagu, choose the workspace, and approve the server.
3. Dagu loads the license within a few seconds. The **This server** panel shows the server's name, workspace, last check-in, and a link to the server in Dagu Console.

`dagu license connect` does the same from a shell, which helps when the server's web UI is not reachable from your browser.

### With a server key

For containers, fleets, and other automated setups, generate a **server key** on the console's **Servers** page and give it to each server:

```bash
export DAGU_LICENSE_KEY=DAGU-XXXX-XXXX-XXXX-XXXX
```

Every server that starts with the key takes a slot until the workspace's slots are used up. Generating a new key does not disconnect servers that are already connected. New servers, and servers that lost their data directory, need the new key.

### Name servers

Dagu Console shows each server by the hostname it reports. In Docker and Kubernetes the hostname is often a random container ID, so give servers a name:

```yaml
license:
  server_name: prod-eu-1
```

or `DAGU_LICENSE_SERVER_NAME=prod-eu-1`. The name is sent at every check-in, so a rename shows up in the console within an hour.

### Keep the server's identity

Dagu stores the server's ID and license in the `license` folder of the data directory (`paths.data_dir`). Persist that directory in containers. Without it, every restart registers as a new server and takes another slot, and the console reports that all servers are in use once the slots run out.

### Check-ins and disconnecting

Connected servers check in with Dagu Console every hour. **Check now** on **Plan & features** checks in immediately, for example after changing plans.

- **Disconnect** on **Plan & features**, or `dagu license deactivate`, frees the slot right away.
- **Disconnect** on the console's **Servers** page frees the slot and the server stops using the license at its next check-in. A server whose configuration still has the server key connects again when it restarts; generate a new key to prevent that.
- Slots are never freed automatically. A server that is gone for good keeps its slot until it is disconnected in the console.

### Air-gapped servers

Servers that cannot reach Dagu Console use an offline license. Create one with **Add offline server** on the console's **Servers** page and install it with `DAGU_LICENSE` or `DAGU_LICENSE_FILE`. An offline server takes a slot until its license is revoked.

## Related Pages

- [Builtin Authentication](/server-admin/authentication/builtin)
- [OIDC Authentication](/server-admin/authentication/oidc)
- [Audit Logging](/server-admin/server#audit-logging)
- [Notifications](/web-ui/notifications)
- [Incident Routing](/web-ui/incidents)
- [Pricing](https://dagu.sh/pricing)
