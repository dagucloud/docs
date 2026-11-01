---
description: Give a DAG's webhook a public URL through Dagu Cloud, so GitHub, Stripe, or Slack can start it on a server with no public address. Requests wait while the server is offline.
---

# Public Webhook URLs

A [webhook](/server-admin/authentication/webhooks) is reachable only where the Dagu server is. A public URL gives the same webhook an address on the internet through Dagu Cloud, so services such as GitHub, Stripe, or Slack can start the DAG on a server behind a firewall or NAT, with no open port, tunnel, or reverse proxy.

```text
GitHub, Stripe, Slack, ...
        │  POST https://hooks.dagu.sh/<server>/<token>
        ▼
   Dagu Cloud  ── keeps each request until the server takes it ──┐
                                                                 │  WebSocket, opened by the server
                                                                 ▼
                                              Dagu scheduler ──▶ queued webhook run
```

- The server opens the connection, outbound over HTTPS. Nothing connects in to it.
- Dagu Cloud stores each request until the server takes it, for up to 7 days, so requests that arrive while the server is offline or restarting still start their runs.
- Each request starts at most one run, even when Dagu Cloud sends it again.
- The DAG's local webhook endpoint keeps working as before. A public URL is an extra address, not a replacement.

## Requirements

- Dagu v2.20 or later.
- [Builtin auth](/server-admin/authentication/builtin), which webhooks require.
- A self-hosted server connected to [Dagu Console](https://console.dagu.sh) with a license that checks in, as for [monitoring](/overview/console-monitoring#requirements). See [Connect a Server](/overview/self-host-license#connect-a-server).
- A running scheduler: `dagu start-all`, or `dagu scheduler` beside `dagu server`. The scheduler holds the connection; `dagu server` alone shows the URL as connecting.
- Outbound HTTPS to `console.dagu.sh` and `relay.dagu.sh`.

| Plan | Public URLs per server |
|------|------------------------|
| Free monitoring (workspace without a plan) or a trial | 1 |
| Team or Pro | 1,000 |

## Turn It On

1. Open the workflow, then the **Webhook** launcher on its canvas. Create the webhook if the DAG has none.
2. In **Public URL**, turn the switch on. Only admins can.
3. Copy the URL once it appears. It looks like `https://hooks.dagu.sh/<server>/<token>`.
4. Give the URL to the sender, and [choose the sender](#choose-the-sender) so Dagu checks its signature.

The URL appears once the server connects to Dagu Cloud, within about 10 seconds. The card also shows the latest deliveries and anything Dagu Cloud had to drop.

The URL ends in a random 32-byte token. Dagu stores it encrypted, like the webhook's HMAC secret, so the page can show the URL again. Dagu Cloud stores only its SHA-256. Treat the URL as a secret: anyone who has it can send to the webhook unless a sender is chosen.

## Choose the Sender

By default, anyone with the URL may send to it. Choose a sender to have Dagu reject requests without that sender's valid signature:

| Sender | Signature checked | Signing secret |
|--------|-------------------|----------------|
| **Anyone with the URL** | None | None |
| **GitHub** | `X-Hub-Signature-256` | Made by Dagu and shown once; paste it into the GitHub webhook's **Secret**. |
| **Stripe** | `Stripe-Signature` | The endpoint's signing secret, starting with `whsec_`. |
| **Slack** | `X-Slack-Signature` and `X-Slack-Request-Timestamp` | The Slack app's signing secret. |
| **Standard Webhooks** | `webhook-id`, `webhook-timestamp`, and `webhook-signature` | The sender's secret, starting with `whsec_`. |

- Signed timestamps must be within 5 minutes of when Dagu Cloud received the request, not when the server took it, so a request that waited while the server was offline still passes.
- For GitHub, set the webhook's **Content type** to `application/json`.
- For Slack, Dagu Cloud answers the URL check that Slack sends when you save the Request URL. It starts no run.
- The secret is encrypted at rest. Leave the secret field empty to keep the stored one; for GitHub, **New secret** makes another.

### Events

**Events** limits which requests start runs. Leave it empty to start a run for every request. A name also takes the events under it, so `issues` takes `issues.opened` and `issues.closed`.

| Sender | Event name |
|--------|------------|
| GitHub | `X-GitHub-Event`, joined to the body's `action` with a dot: `push`, `pull_request.opened` |
| Stripe and Standard Webhooks | The body's `type`: `invoice.paid` |
| Slack | The wrapped event's `type`: `app_mention` |

GitHub's `ping`, sent when a webhook is created, never starts a run.

## What the Run Receives

| Variable | Contents |
|----------|----------|
| `WEBHOOK_PAYLOAD` | The request body exactly as the sender sent it, whatever its content type. Unlike the [local endpoint](/server-admin/authentication/webhooks#payload-handling), it is not read as a `{"payload": ...}` wrapper. Left out when the body does not fit in one environment variable. |
| `WEBHOOK_PAYLOAD_FILE` | The path of a private file holding the body. Always set. The file is removed when the run ends. |
| `WEBHOOK_HEADERS` | The request headers named in the DAG's `webhook.forward_headers`, as for local requests. |

- The run's trigger type is `webhook`, and it uses the DAG's default [runtime profile](/writing-workflows/runtime-profiles).
- The run ID is the delivery ID. A request Dagu Cloud sends again starts no second run; a request the sender sends again is a new delivery.
- Read the body from `WEBHOOK_PAYLOAD_FILE` when it may be large. One environment variable holds less than 128 KiB on Linux and macOS and 32,767 characters on Windows. A larger body is left out of `WEBHOOK_PAYLOAD` and `DAG_PARAMS_JSON`.

```yaml
webhook:
  forward_headers:
    - X-GitHub-Event

steps:
  - id: deploy
    run: |
      jq -r '.ref' "$WEBHOOK_PAYLOAD_FILE"
```

## Deliveries

The scheduler checks each delivery and answers Dagu Cloud:

| Situation | Logged as | Dagu Cloud |
|-----------|-----------|------------|
| Webhook disabled | Ignored | Drops the request. |
| Sender chosen, signature missing or invalid | Rejected, with the reason | Drops the request. |
| GitHub `ping`, or an event the list leaves out | Skipped | Drops the request. |
| Body larger than `webhooks.max_payload_size` | Failed | Drops the request. |
| DAG fails to load, or the run cannot start (for example, a required param is missing) | Failed, with the error | Drops the request. |
| 100 runs already queued for the DAG | Waiting | Sends it again after 60 seconds. |
| Storage error while queueing | Waiting | Sends it again after 30 seconds. |
| Queued | Started, with the run | Drops the request. |

The **Public URL** card lists the latest 20 deliveries: when Dagu Cloud received each one, its event and size, and how it was logged, with a link to the run it started. Bodies are not kept in this list; a started run has its body.

### Missed Deliveries

Dagu Cloud drops a request that waits more than 7 days, and refuses requests while 1,000 wait for the server. The card shows how many it dropped and refused since an admin last dismissed the notice.

## What Senders See

| Response | When |
|----------|------|
| `202 Accepted` | Dagu Cloud stored the request. The body is `{"id": "<delivery ID>"}`. |
| `404 Not Found` | The URL is wrong, turned off, or replaced. |
| `413 Payload Too Large` | The body is larger than 512 KiB. |
| `415 Unsupported Media Type` | The body is not UTF-8 text. |
| `429 Too Many Requests` | More than 60 requests in a minute reached this URL. `Retry-After` says when to try again. |
| `431 Request Header Fields Too Large` | The request headers exceed 16 KiB. |
| `503 Service Unavailable` | 1,000 requests are already waiting for the server. `Retry-After` is 10 minutes. |

`202` means Dagu Cloud has the request, not that a run started. Senders that retry on errors, such as GitHub and Stripe, retry these responses on their own schedules.

## Replace or Turn Off

- **New URL** makes a new token. The old URL stops working at once. Requests Dagu Cloud already took through it are still delivered.
- Turning the URL off removes it, drops every request waiting for it, and clears its delivery list. Turning it on again makes a new URL.
- Deleting the webhook or the DAG also removes the URL.
- Renaming the DAG keeps its webhook, its URL, and the requests waiting for it.

Changes take effect within about 10 seconds. If the scheduler is stopped, they take effect when it starts again.

## Data and Privacy

- Dagu Cloud stores a request's body and headers only until the server takes it, for at most 7 days.
- It never forwards credentials or proxy headers to the server: `Authorization`, `Cookie`, `Host`, `X-Forwarded-*`, `X-Real-IP`, and hop-by-hop headers are removed.
- Dagu Cloud stores only the SHA-256 of each URL's token. The server sends it only its name, its Dagu version, and the outcome of each delivery. Workflows run only on your server.

## Troubleshooting

| Card shows | Meaning |
|------------|---------|
| Connecting to Dagu Cloud… | The scheduler has not connected yet. Check that a scheduler is running and can reach `relay.dagu.sh`. |
| This server is not connected to Dagu Cloud. | The server has no license that checks in. [Connect it](/overview/self-host-license#connect-a-server). |
| Your plan allows N public URLs, and this one is not among them. | The server has more public URLs than its plan allows. The oldest are held; turn another off, or change the plan. |
| Dagu Cloud refused a relay ticket | Dagu Console no longer accepts this server, for example after it was released from the workspace. The scheduler tries again every 10 minutes. |
| The plan allows no public URLs. | The server's plan allows none. The scheduler tries again every 10 minutes. |
| The webhooks could not be read. | A webhook record on the server cannot be read or decrypted. Dagu Cloud keeps the URLs it last had until the scheduler can read every webhook again. |

## API

All endpoints take the `remoteNode` query parameter. Changes are admin-only and written to the audit log; developers and managers can read.

| Method and path | Action |
|-----------------|--------|
| `GET /api/v1/dags/{fileName}/webhook/public` | The URL, its state, the latest deliveries, and missed counts. |
| `POST /api/v1/dags/{fileName}/webhook/public` | Turn the public URL on. |
| `DELETE /api/v1/dags/{fileName}/webhook/public` | Turn it off. |
| `POST /api/v1/dags/{fileName}/webhook/public/regenerate` | Replace the URL. |
| `PUT /api/v1/dags/{fileName}/webhook/public/sender` | Set the sender, secret, and events. |
| `DELETE /api/v1/dags/{fileName}/webhook/public/missed` | Dismiss missed counts. |

See [Public URL Endpoints](/web-ui/api#public-url-endpoints) for request and response shapes.
