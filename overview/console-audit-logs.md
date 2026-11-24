---
description: Send a Dagu server's audit entries to Dagu Console, so the record of who did what outlives the server, its disk, and its local retention.
---

# Audit Logs

A Dagu server keeps its [audit log](/server-admin/server#audit-logging) on its own disk, for 7 days by default. With `cloud.audit` on, it also sends the entries to [Dagu Console](https://console.dagu.sh), which keeps them for 90 days in the workspace's **Audit log**, beside the changes made in Console itself. A copy there survives the server, its disk, and anyone who edits the local files afterwards.

- **Nothing changes locally**: the server keeps writing its audit files and serving its own **Audit Logs** page.
- **No cost while idle**: the server reads its audit files only when entries are written, and not at all while sending is off.

Sending audit logs to Console needs Dagu v2.28 or later.

## Requirements

- Local audit is on (`audit.enabled`, the default). It needs a self-host license.
- The server is connected to Dagu Console with a license that checks in. See [Connect a Server](/overview/self-host-license#connect-a-server).
- The workspace is on a Team or Pro plan, or in a trial. Otherwise Console refuses the entries, and the server keeps them and asks again every hour.
- The server can reach `https://console.dagu.sh` over HTTPS. No inbound port is needed.

## Turn It On

Set `cloud.audit`, or `DAGU_CLOUD_AUDIT`, and restart Dagu:

```yaml
cloud:
  audit: changes
```

| Level | Sends |
| --- | --- |
| `off` (default) | Nothing |
| `changes` | Every entry but successful reads: every change, sign-in, and terminal command, and failed or denied reads |
| `all` | Every entry |

- **Reads**: a successful read is a successful MCP call to a read-only tool, such as `dagu_read`, or a successful MCP resource read. A tool or action that Dagu has not marked as a read is sent.
- **MCP calls**: each call is sent as one entry, its result. The local log also keeps the call's `received` and `started` entries.
- **Volume**: on one server used heavily through MCP, `changes` sent about 15% of the local entries and `all` about 40%.
- **History**: when first turned on, the server sends the entries it still holds, 7 days by default, at Console's pace. Entries written before v2.28 are never sent.
- Any other value is a configuration error.

The **Audit logs** card on **Plan & features** shows the level, what each entry carries, and where Console stores it. It is read-only: change `cloud.audit` in the configuration.

## What Is Sent

Each entry carries:
- its time, category, action, and result;
- the user ID and name;
- the IP address;
- the resource, workspace, credential, and MCP tool involved;
- its details.

A field longer than its limit is cut, and the entry lists it under `truncated`. Names and identifiers are limited to 256 bytes each, and a whole entry to 16 KiB.

### Masking

Every audit entry is masked when it is written, whether or not it is sent, so the local files and the server's **Audit Logs** page hold the masked entry too.

- **Replaced**: the values of secrets in Dagu's own store, and common token formats, such as GitHub, AWS, and Slack tokens.
- **Masked again before sending**, which catches a secret added after its entry was written.
- **Fields left as written**: those Dagu generates or picks from a fixed set, such as the ID, time, category, action, and result. Every other field is masked, including any field added later.
- **Not caught**: secrets from external providers, such as Vault or AWS Secrets Manager, and values that were not in Dagu's store when the entry was written or sent.
- **Not sent**: an entry that could not be masked, as while the secret values fail to load, stays on the server.

Console's copy is not tamper-proof: a server administrator can still forge or drop entries before they leave the server.

## In Console

Workspace owners open **Audit log** in Dagu Console.

- **What it shows**: entries from every server that sends them, and changes to the workspace's members and servers made in Console, newest first.
- **Filters**: by server, project, time range, category, action, user, and result.
- **Download**: saves the entries that match the filters as a JSON Lines file, up to 10 times an hour.
- **Retention**: entries are kept for 90 days.

## Delivery and Gaps

- **When it sends**: within about 5 seconds of new entries, up to 1,000 per request. Nothing is sent while no entry is written.
- **At least once**: the server moves past entries only after Console stores them. A resent entry is stored once.
- **Outages**: while Console is unreachable, or holds the server back, entries wait in the local files and go out later. Keep `audit.retention_days` longer than the longest outage you expect.
- **Stopping**: on a graceful stop, the server sends what is left for `cloud.audit_drain_timeout`, 25 seconds by default, which fits Kubernetes' 30-second grace period. Under `docker stop`, which kills after 10 seconds, set it to `8s`. `0` stops at once; any other value must be at least `5s`.

Entries the server knows were lost show in the log as gaps:

| Gap | When |
| --- | --- |
| Deleted | Local retention deleted entries before they were sent |
| Stopped | The server stopped before it sent them. If its disk survives, they arrive after it starts again, and the gap shows that they did |
| Rejected | A line in the local files could not be read, or Console could not store an entry |

A server killed without a stop signal, or a disk lost before its entries were sent, loses them with no gap.

## Servers That Come and Go

- **Without a persistent disk**, as on a spot VM or an autoscaled container, keep `<admin_logs_dir>/audit` and `<data_dir>/cloud` on a persistent volume. Otherwise entries not yet sent are lost with the disk.
- **Only the web server sends**: `dagu server` and `dagu start-all`. Workers and the coordinator write no audit entries.
- **`dagu secret`** writes its entries in its own process. They go out when it shares `DAGU_HOME` with a running web server. In a throwaway container, change secrets through the server's API instead.
- **Several processes**: in a distributed install, every process writes to the shared audit files, and one sends them.

## Turn It Off

Set `cloud.audit: off` and restart Dagu. Console keeps what it already has for its retention. Turned on again, the server resumes where it stopped; entries deleted in between show as a Deleted gap.

## Related Pages

- [Audit Logging](/server-admin/server#audit-logging): the server's local audit log
- [Monitoring](/overview/console-monitoring)
- [Connect a Server](/overview/self-host-license#connect-a-server)
- [Members](/overview/console-members)
- [Configuration Reference](/server-admin/reference)
