# Distributed Transport Security

Dagu supports built-in TLS, TLS with your own certificates, and plaintext HTTP/2 (h2c) for coordinator gRPC traffic.

This page covers the `peer` configuration used by distributed execution. It is separate from Web UI/API HTTPS configuration, which is documented in [TLS/HTTPS Configuration](/server-admin/authentication/tls).

::: tip
`peer` TLS secures coordinator gRPC traffic. It does not secure the Web UI/API HTTP server, `dagu server --tunnel`, or the separate HTTP health endpoints.
:::

::: info Version
Built-in TLS, `peer.ca_cert_file`, `peer.ca_key_file`, `dagu peer init`, `coordinator.require_tls`, the start lines, the ignored-setting warnings, startup warnings for your own certificates, plaintext connections on **System Status**, and `dagu worker --check` are in Dagu releases after 2.27.0. `peer.token` and `coordinator.require_token` require a Dagu release after 2.27.0. In 2.27.0, a client uses TLS only with `peer.insecure: false` and `peer.cert_file`, `peer.key_file`, `peer.client_ca_file`, or `peer.skip_tls_verify: true`. Unset `peer.insecure` and `peer.insecure: true` select h2c. Explicit `false` without a TLS setting fails.
:::

## Traffic Covered

Distributed execution uses coordinator gRPC for:

- task polling and dispatch
- worker heartbeats
- status updates
- log streaming
- artifact uploads
- distributed state RPCs

The processes that call the coordinator are workers, the scheduler, the Web UI/API process, `start-all`, CLI commands, and run processes.

## What to Set

| Setup | Transport | Setting |
|-------|-----------|---------|
| `start-all`, or processes that share the coordinator's data directory | Built-in TLS, under the [conditions below](#built-in-tls) | None |
| Docker Compose services that share the coordinator's data volume and use the default peer settings | Built-in TLS, under the same conditions | None |
| The Helm chart in distributed mode, chart 2.0.10 or later | Built-in TLS for the coordinator, scheduler, and UI pods; h2c for worker pods until they get the CA | Set `image.tag` to a Dagu release after 2.27.0. For worker pods, also set `peer.existingCASecret`. See [Kubernetes](#kubernetes) |
| A process with a separate data directory, on another host or the same one | Built-in TLS with the coordinator's peer CA. With `peer.insecure` unset and no TLS source, the client starts on h2c | Set `peer.ca_cert_file` to select built-in TLS, with the coordinator's existing peer CA or a CA you provide. Set `peer.token` by the [peer token rule](#peer-token). Remove any `peer.insecure: true`. See [Processes on Another Host](#processes-on-another-host) |
| A path where the connection closes or resets before the server's first TLS handshake message, or the server's first bytes are not a TLS record, as a plaintext proxy can cause | h2c, after a [fallback](#fallback-to-h2c) | None, while the client has a built-in TLS source, `peer.insecure` is unset, and the coordinator accepts h2c |
| Server TLS with your own certificates | TLS | `peer.cert_file` and `peer.key_file` on the coordinator, and `peer.insecure: false` with `peer.client_ca_file` on clients, as in [Server TLS](#server-tls). `start-all` takes different settings, which that section gives. |
| Mutual TLS with your own certificates | mTLS | Server TLS, plus `peer.client_ca_file` on the coordinator and `peer.cert_file` and `peer.key_file` on each client, as in [Mutual TLS](#mutual-tls) |
| Plaintext on purpose | h2c | Set `peer.insecure: true` on the client and use a coordinator that accepts h2c. |
| TLS only, with no fallback | Built-in TLS or TLS | Configure built-in TLS or your own certificate settings first. Set `peer.insecure: false` on clients. On a built-in TLS coordinator, set [`coordinator.require_tls: true`](#require-tls) to refuse h2c. A coordinator on its own certificates already refuses h2c. |

Leave `peer.insecure` unset unless one of the last four rows applies. Setting `peer.insecure: true` makes the process use h2c for outgoing coordinator calls.

## Built-in TLS

A coordinator without `peer.cert_file` and `peer.key_file` runs a peer CA. That is the CA that `peer.ca_cert_file` and `peer.ca_key_file` supply, or, when neither a server certificate pair nor a peer CA is supplied, one it generates on its first start and reuses on later starts. The generated CA has no expiry date. At each start, the coordinator issues itself a server certificate from the peer CA for the name `coordinator.dagu.invalid`.

- The coordinator serves built-in TLS and h2c on one port, `coordinator.port`. Each connection picks its transport, so older clients already on h2c and clients with `peer.insecure: true` keep working over h2c, unless the coordinator sets [`coordinator.require_tls: true`](#require-tls).
- Processes that share the coordinator's data directory use built-in TLS with no setting: `start-all`, a scheduler or Web UI/API process beside the coordinator, and workers on a shared filesystem. This holds for a connection while the process can read the coordinator's CA certificate, and the service registry allows it. For an address listed in the live registry, its own entry must advertise built-in TLS. For an unlisted address, any live entry advertising built-in TLS lets the client try it. Otherwise the connection uses h2c with `peer.insecure` unset, and fails with `peer.insecure: false`.
- Clients check the name `coordinator.dagu.invalid`, not the dialed address. Any address works: an IP address, a DNS name, or a load balancer that passes TCP through.
- Built-in TLS needs TLS 1.3.
- A coordinator with `coordinator.require_tls: false` that cannot create or read its generated CA logs a warning and serves h2c only.

`start-all` with no `peer` keys logs:

```text
Coordinator transport: built-in TLS and h2c (from the generated CA)
Peer transport: built-in TLS (from the coordinator's data directory)
```

### Processes on Another Host

A process that does not share the coordinator's data directory needs a TLS source or TLS settings of its own. A client with no TLS source at startup uses h2c when `peer.insecure` is unset, and logs `Peer transport: h2c (from no TLS source)`. With `peer.insecure: false`, startup exits with code 1 when the client has neither an explicit TLS setting nor a built-in TLS source, with `TLS enabled but no certificates provided`. Set `peer.ca_cert_file` to select built-in TLS. Set `peer.token` by the [peer token rule](#peer-token).

On each coordinator and client you migrate, clear `peer.cert_file`, `peer.key_file`, `peer.client_ca_file`, and `peer.skip_tls_verify: true` before you add `peer.ca_cert_file`. They conflict with it, and the process exits at start.

If you already have the coordinator's peer CA certificate, reuse it. Copy the certificate to each client, set `peer.ca_cert_file`, and remove any `peer.insecure: true` setting. Set `peer.token` by the rule above.

Otherwise, provide a CA. A CA you provide also keeps one CA across data directories, such as for several coordinators or a Kubernetes Secret. To make one, run `dagu peer init`:

```bash
dagu peer init --out ./peer
```

The command prints the paths to the CA certificate, CA key, and peer token, in that order. Use the generated token as [`peer.token`](#peer-token). If any output file already exists, the command names it, writes nothing, and exits with code 1.

With those settings cleared, set this on each coordinator, or on `start-all`, using the paths it printed:

```yaml
peer:
  ca_cert_file: "<the CA certificate path it printed>"
  ca_key_file: "<the CA key path it printed>"
  token: "<the generated token>"
```

The certificate must be a CA certificate whose key usage, when present, allows certificate signing, and the key must match it. Only the coordinator reads `peer.ca_key_file`. The coordinator then uses this CA instead of the one it generated, and processes that share its data directory keep using built-in TLS with no setting. This coordinator sets `peer.token` explicitly, so by the [peer token rule](#peer-token) any token a client sends must match it. Give every process that calls the coordinator the same `peer.token`, as [Peer Token](#peer-token) describes.

On each process on another host, with the conflicting settings cleared, set the certificate and the same token, and remove any `peer.insecure: true` setting. `peer.ca_cert_file` also takes `DAGU_PEER_CA_CERT_FILE`, or `--peer.ca-cert-file` on `dagu worker`:

```yaml
peer:
  ca_cert_file: "<the CA certificate path it printed>"
  token: "<the generated token>"
```

The process logs `Peer transport: built-in TLS (from peer.ca_cert_file)`. It verifies every coordinator against that certificate, and a certificate that does not verify fails the call. Add `peer.insecure: false` to keep it on TLS with no [fallback](#fallback-to-h2c) to h2c.

::: warning
Use a CA only for Dagu peers. For regular coordinator calls, built-in TLS accepts an eligible client certificate in place of the peer token.
:::

## Fallback to h2c

A client on built-in TLS with `peer.insecure` unset falls back to h2c for a coordinator address when its TLS handshake fails on the network path: the connection closes or resets before the server's first TLS handshake message, or the server's first bytes are not a TLS record. A proxy or service mesh sidecar that expects plaintext gRPC can cause these failures. A path that drops the handshake until it times out causes no fallback.

- The client uses h2c for that address for 10 minutes. Its next call after that tries built-in TLS again.
- The processes on one host that use the same data directory share the window. Only the process that opens it logs the warning.
- A call that failed before it got a connection is retried once over h2c, so the fallback itself fails no call. A coordinator with [`coordinator.require_tls: true`](#require-tls) refuses that retry.
- A certificate that does not verify fails the call and causes no fallback.
- One case differs. The client uses h2c for an address for 10 minutes, with the reason `no TLS source`, when all three hold: no live service registry entry lists the address, such as a coordinator of another Dagu; `peer.insecure` is unset; and the CA certificate of the coordinator that shares the data directory is the client's only TLS source. That happens when the address's certificate does not chain to that CA.

A worker behind a proxy that expects plaintext gRPC logs these lines. The warning also names the address and the handshake error.

```text
Peer transport: built-in TLS (from the coordinator's data directory)
Built-in TLS failed on the network path; using h2c for 10 minutes
Peer transport to 127.0.0.1:50055: h2c (from tls failed on the network path)
```

To turn the fallback off, set `peer.insecure: false` on the client. A handshake that fails on the network path then fails the call.

## Require TLS

To refuse every h2c call except health checks, set this on the coordinator:

```yaml
coordinator:
  require_tls: true
```

It has no command-line flag. Set it in the config file or as `DAGU_COORDINATOR_REQUIRE_TLS`. The default is `false`. Before enabling this setting, move every client to TLS. Upgrade older clients that rely on h2c to use built-in TLS.

- The coordinator refuses each h2c call except the gRPC health check. With a working peer CA, it logs `Coordinator transport: built-in TLS only (from coordinator.require_tls)` at start.
- A refused client logs one line for the reason it uses h2c, once, until a call to that coordinator other than a health check succeeds. The same line is the error of the refused call.
- A Dagu release from before built-in TLS prints the coordinator's own message instead: `the coordinator requires TLS: upgrade this process, or remove peer.insecure: true`.
- A refusal ends a fallback window, so the client's next call tries built-in TLS again.
- A coordinator that cannot create or read its generated CA exits with code 1 at start instead of serving h2c.
- It has no effect on a coordinator with `peer.cert_file` and `peer.key_file`, which serves no h2c.

| Why the client uses h2c | Line |
|-------------------------|------|
| `peer.insecure: true` | `The coordinator requires TLS. Remove peer.insecure: true.` |
| No TLS source | `The coordinator requires TLS. Set peer.ca_cert_file to the coordinator's CA certificate.` |
| A [fallback](#fallback-to-h2c) after TLS failed on the network path | `The coordinator requires TLS. Let the network path to it pass TLS.` |

Before you set it, check **System Status** and each process's start line. An empty caller list on **System Status** does not show that every client uses TLS, since it covers only the last 10 minutes and leaves out health checks and workers' own calls.

## Plaintext Connections on System Status

**System Status** shows which processes call the coordinator over h2c, and why:

- **Workers**: each worker's `Connection` column shows `Certificate` for a worker that presents a client certificate the peer CA signed, `TLS` for other TLS connections, or `Plaintext · <reason>` with the change to make below it. `Plaintext` links to this page. A worker whose heartbeat record a coordinator from before built-in TLS wrote shows `Connection not reported`. A list too narrow for the column shows the same line under the worker ID.
- **Coordinator Service**: under each coordinator, **Plaintext calls in the last 10 minutes** lists the hosts that called it over h2c in that time, other than health checks and a worker's own calls, with the reason and the time of the last call. The calls come from a scheduler, a Web UI/API process, a CLI command, or `dagu worker --check`.

| Shown | Cause | Change |
|-------|-------|--------|
| `Plaintext · peer.insecure: true in its config` | The process sets `peer.insecure: true`. | Remove `peer.insecure: true`. |
| `Plaintext · no TLS source` | The client has no usable CA for this coordinator address. | Set [`peer.ca_cert_file`](#processes-on-another-host). |
| `Plaintext · TLS failed on the network path` | Its handshake failed on the network path, and it [fell back](#fallback-to-h2c). | Let the path pass TLS, such as a proxy that passes TCP through. |
| `Plaintext · older version` | The call reported no recognized h2c reason. | Upgrade the client if it predates built-in TLS. |

## Check Worker Connections

Run `dagu worker --check` on the worker host, with the worker's configuration:

```bash
dagu worker --check --worker.coordinators=coordinator.example.com:50055
```

It prints any [ignored-setting](#ignored-settings) warnings and the start line, then for each address in `worker.coordinators`:

- `Transport`: what the worker picks for the address and why, and an open h2c window with its end and the handshake error that opened it
- `Reachable`: whether the address answers, directly or through the HTTPS proxy that the environment names
- `Handshake`: none over h2c, or the names the server certificate covers and the CA it chains to. A failure names each problem in plain words.
- `Credential`: the client certificate the worker would send, and where its peer token comes from. It never prints the token.
- `Coordinator answered`: the gRPC health result and, if it reports `SERVING`, the result of a `GetWorkers` call with the worker's configured credentials

It never registers a worker or takes a task. It reads h2c fallback windows but never opens or ends one; a line about a fallback describes what the worker would do. It exits with code 0 when every coordinator passes, and with code 1 otherwise. Without `worker.coordinators`, it checks the live coordinators in the service registry of its data directory, then exits with code 1, since a worker does not start without `worker.coordinators`.

An excerpt of the output for a worker that shares the coordinator's data directory:

```text
$ dagu worker --check --worker.coordinators=127.0.0.1:50055
Peer transport: built-in TLS (from the coordinator's data directory)
Coordinator 127.0.0.1:50055
  Transport: built-in TLS (from the coordinator's data directory)
  Reachable: yes
  Handshake: TLS
    Certificate covers: DNS:coordinator.dagu.invalid, DNS:dagu-host
    Certificate chains to: Dagu peer CA
  Coordinator answered: serving, and it accepted the call
Every coordinator passed the check
```

An excerpt for the same worker behind a proxy that expects plaintext gRPC:

```text
Coordinator 127.0.0.1:50055
  Transport: built-in TLS (from the coordinator's data directory)
  Reachable: yes
  Handshake: failed, read tcp 127.0.0.1:56262->127.0.0.1:50055: read: connection reset by peer
    Address dialed: 127.0.0.1:50055
    The worker falls back to h2c (from tls failed on the network path) for 10 minutes
  Coordinator answered: serving, and it accepted the call
```

A worker with your own CA, against a certificate that does not name the dialed address:

```text
$ dagu worker --check --worker.coordinators=127.0.0.1:50055 --peer.insecure=false --peer.client-ca-file=ca.crt
Peer transport: TLS (from peer.insecure: false)
Coordinator 127.0.0.1:50055
  Transport: TLS (from peer.insecure: false)
  Reachable: yes
  Handshake: failed, the certificate does not cover 127.0.0.1
    Address dialed: 127.0.0.1:50055
    Certificate covers: DNS:coordinator.example.com
    Certificate chains to: Example CA
Error: 1 of 1 coordinators did not pass the check
```

If the worker cannot open a connection, it prints `Cannot reach coordinator at <host>:<port>` and what to check. If the connection opens but the gRPC health check times out, `Coordinator answered` reports the timeout. A call that `coordinator.require_tls` refuses gets the line for its reason from [Require TLS](#require-tls).

## Start Lines and Warnings

### Start Line

The scheduler, the Web UI/API process, a worker, and `start-all` log one line at start, at level info, for the transport they use to call the coordinator. CLI commands and run processes log it at level debug. A scheduler, a Web UI/API process, or `start-all` with `coordinator.enabled: false` calls no coordinator, so it logs no start line and no [ignored-setting](#ignored-settings) warning. A process uses the first row that matches.

| Configuration | Start line |
|---------------|------------|
| `peer.insecure: true` | `Peer transport: h2c (from peer.insecure: true)` |
| `peer.insecure: false` with `peer.cert_file`, `peer.key_file`, `peer.client_ca_file`, or `peer.skip_tls_verify: true` | `Peer transport: TLS (from peer.insecure: false)` |
| `peer.ca_cert_file` | `Peer transport: built-in TLS (from peer.ca_cert_file)` |
| The process can read the CA certificate of a coordinator that shares its data directory | `Peer transport: built-in TLS (from the coordinator's data directory)` |
| `peer.insecure` unset and no TLS source | `Peer transport: h2c (from no TLS source)` |

`peer.insecure: false` with none of these settings and no TLS source exits with code 1 at start with `TLS enabled but no certificates provided`.

When the transport to one coordinator address differs from the start line, the process logs `Peer transport to <host>:<port>: <transport> (from <source>)` each time it changes.

The coordinator logs what it serves:

| Coordinator | Line |
|-------------|------|
| Generated CA, with `coordinator.require_tls: false` | `Coordinator transport: built-in TLS and h2c (from the generated CA)` |
| `peer.ca_cert_file` and `peer.ca_key_file`, with `coordinator.require_tls: false` | `Coordinator transport: built-in TLS and h2c (from peer.ca_cert_file)` |
| A working peer CA, with `coordinator.require_tls: true` | `Coordinator transport: built-in TLS only (from coordinator.require_tls)` |
| `peer.cert_file` and `peer.key_file` | `Coordinator transport: TLS (from peer.cert_file)` |
| A generated CA it cannot create or read, with `coordinator.require_tls: false` | `Coordinator transport: h2c (from no peer CA)` |

A supplied CA that is not a valid CA certificate, or whose key does not match it, exits with code 1 at start, naming the files. So does a generated CA that cannot be created or read under `coordinator.require_tls: true`.

### Ignored Settings

A TLS setting that the chosen transport does not use has no effect. The process logs one warning per such setting, with its value and the change that would use it:

```text
Peer TLS setting ignored: peer.client_ca_file (ca.crt) has no effect while peer.insecure is not false; set peer.insecure: false to use it
Peer TLS setting ignored: peer.ca_cert_file (ca.crt) has no effect while peer.insecure is true; remove peer.insecure: true to use it
```

On a client, `peer.cert_file`, `peer.key_file`, and `peer.client_ca_file` select TLS only with `peer.insecure: false`. A coordinator uses these settings for serving when both `peer.cert_file` and `peer.key_file` are set. `peer.insecure` controls outgoing calls only. A standalone coordinator skips client-side warnings.

### Start Checks of Your Own Certificates

A coordinator with `peer.cert_file` and `peer.key_file` checks them at start:

- A key that does not match the certificate exits with code 1, naming both files.
- `Coordinator certificate does not name the advertised address`: the certificate does not cover `coordinator.advertise`. When that is unset, the check uses the detected host name, or `coordinator.host` when no host name is detected. Add the address to the certificate, or set `coordinator.advertise` to a name it covers.
- `Coordinator certificate expires within 14 days`, or `Coordinator certificate has expired`.
- `Peer certificate does not allow client authentication`: a process that serves and calls with the same certificate while `peer.insecure: false` and `peer.client_ca_file` are set, such as `start-all`. Local runs work, and dispatching runs to workers fails until the certificate allows client authentication.

The three warnings do not stop the process.

## Certificate Requirements

This section and the next two apply to your own certificates, set with `peer.cert_file` and `peer.key_file`. A coordinator with its own certificates serves TLS only, with no h2c and no built-in TLS.

The coordinator certificate must be valid for the address clients dial. Built-in TLS needs no name for that address.

For example, if workers use:

```bash
dagu worker --worker.coordinators=dagu-coordinator.default.svc.cluster.local:50055
```

then the coordinator server certificate should include `dagu-coordinator.default.svc.cluster.local` in its subject alternative names.

If workers dial an IP address, include that IP address as an IP subject alternative name. If workers dial a DNS name, include that DNS name as a DNS subject alternative name.

Use certificates from your organization PKI, a Kubernetes operator that issues certificates, a private CA, or another certificate workflow that fits your environment. For production, avoid `peer.skip_tls_verify`; it disables coordinator certificate verification on the client side.

## Server TLS

Server TLS encrypts coordinator gRPC traffic and lets clients verify the coordinator identity.

On the coordinator:

```yaml
peer:
  cert_file: /etc/dagu/tls/coordinator.crt
  key_file: /etc/dagu/tls/coordinator.key
```

Equivalent flags:

```bash
dagu coordinator \
  --coordinator.host=0.0.0.0 \
  --coordinator.advertise=coordinator.example.com \
  --peer.cert-file=/etc/dagu/tls/coordinator.crt \
  --peer.key-file=/etc/dagu/tls/coordinator.key
```

The coordinator serves TLS from these files whatever `peer.insecure` says, since `peer.insecure` sets only how a process calls a coordinator. `start-all` also calls its own coordinator. For server-only TLS with `start-all`, set `peer.insecure: false`, use a coordinator certificate trusted by the system roots, and leave `peer.client_ca_file` unset. For mutual TLS with `start-all`, set `peer.insecure: false` and `peer.client_ca_file`: it presents `peer.cert_file` to its own coordinator and verifies the coordinator against `peer.client_ca_file`, so the certificate must verify against `peer.client_ca_file` and allow client authentication.

On each worker or other coordinator client:

```yaml
peer:
  insecure: false
  client_ca_file: /etc/dagu/tls/ca.crt
```

Equivalent flags:

```bash
dagu worker \
  --worker.coordinators=coordinator.example.com:50055 \
  --peer.insecure=false \
  --peer.client-ca-file=/etc/dagu/tls/ca.crt
```

`client_ca_file` has different roles depending on the process:

- On the coordinator, it is the CA used to verify client certificates. Setting it enables mTLS.
- On clients, `peer.client_ca_file` adds trusted CA certificates to the system roots.

## Mutual TLS

Mutual TLS requires the coordinator to verify client certificates and requires clients to verify the coordinator certificate.

On the coordinator:

```yaml
peer:
  cert_file: /etc/dagu/tls/coordinator.crt
  key_file: /etc/dagu/tls/coordinator.key
  client_ca_file: /etc/dagu/tls/client-ca.crt
```

Equivalent flags:

```bash
dagu coordinator \
  --coordinator.host=0.0.0.0 \
  --coordinator.advertise=coordinator.example.com \
  --peer.cert-file=/etc/dagu/tls/coordinator.crt \
  --peer.key-file=/etc/dagu/tls/coordinator.key \
  --peer.client-ca-file=/etc/dagu/tls/client-ca.crt
```

On each worker:

```yaml
peer:
  insecure: false
  cert_file: /etc/dagu/tls/worker.crt
  key_file: /etc/dagu/tls/worker.key
  client_ca_file: /etc/dagu/tls/server-ca.crt
```

Equivalent flags:

```bash
dagu worker \
  --worker.coordinators=coordinator.example.com:50055 \
  --peer.insecure=false \
  --peer.cert-file=/etc/dagu/tls/worker.crt \
  --peer.key-file=/etc/dagu/tls/worker.key \
  --peer.client-ca-file=/etc/dagu/tls/server-ca.crt
```

The server CA and client CA can be the same CA if one CA issues both coordinator and client certificates.

## Peer Token

`peer.token` and `coordinator.require_token` require a Dagu release after 2.27.0. The processes that call the coordinator, such as workers, the scheduler, and the Web UI/API process, send a peer token, and the coordinator checks it:

- For regular calls, an eligible built-in TLS client certificate is accepted before any token check.
- Regular calls may omit the token when `coordinator.require_token` is `false`.
- When the coordinator checks a token, it must match if `peer.token` is explicitly set or the call requires a token.
- Token-only calls always require a valid token.

With the token the coordinator generates, processes that share the coordinator's data directory need no setup.

To choose the token yourself, give the coordinator and every process that calls it the same `peer.token`:

```yaml
peer:
  token: "<a long random string>"
```

To require the peer token or an eligible built-in TLS client certificate for regular coordinator calls, set this on the coordinator:

```yaml
coordinator:
  require_token: true
```

`coordinator.require_token` defaults to `false`. The peer token works with or without TLS. On built-in TLS, an eligible client certificate chains to the peer CA. Token-only calls require a valid peer token. On built-in TLS, make these calls on a connection without a worker certificate.

## Kubernetes

Chart 2.0.10 removes `peer.insecure: true` from its distributed defaults. It still defaults to Dagu 2.27.0. Set `image.tag` to a Dagu release after 2.27.0 to use built-in TLS. The coordinator, scheduler, and Web UI/API pods share the data volume, so they use built-in TLS with no setting. Worker pods do not share it, so they use h2c until you store a peer CA in a Secret with both keys `ca.crt` and `ca.key` and name it in `peer.existingCASecret`. The [chart README](https://github.com/dagucloud/dagu/blob/main/charts/dagu/README.md#peer-tls) covers this, the peer token, and workers outside the cluster. Chart 2.0.9 still sets `peer.insecure: true` in distributed mode, even with a newer Dagu image.

To switch to your own certificates, clear `peer.existingCASecret`. The chart refuses to render certificate settings in `extraEnv` while it is set. Then provide the files through Kubernetes Secrets and set the corresponding `peer` config or `DAGU_PEER_*` environment variables for each component.

For mTLS:

- coordinator pods need the coordinator certificate, coordinator key, and client CA
- worker pods need a client certificate, client key, and server CA
- scheduler and Web UI/API pods need client-side peer settings if they dispatch through the coordinator

## Environment Variables

The peer TLS and token settings can also be configured with environment variables:

| Config key | Environment variable |
|------------|----------------------|
| `peer.insecure` | `DAGU_PEER_INSECURE` |
| `peer.cert_file` | `DAGU_PEER_CERT_FILE` |
| `peer.key_file` | `DAGU_PEER_KEY_FILE` |
| `peer.client_ca_file` | `DAGU_PEER_CLIENT_CA_FILE` |
| `peer.ca_cert_file` | `DAGU_PEER_CA_CERT_FILE` |
| `peer.ca_key_file` | `DAGU_PEER_CA_KEY_FILE` |
| `peer.skip_tls_verify` | `DAGU_PEER_SKIP_TLS_VERIFY` |
| `peer.token` | `DAGU_PEER_TOKEN` |
| `coordinator.require_token` | `DAGU_COORDINATOR_REQUIRE_TOKEN` |
| `coordinator.require_tls` | `DAGU_COORDINATOR_REQUIRE_TLS` |

## Troubleshooting

### TLS Client Cannot Connect

Run [`dagu worker --check`](#check-worker-connections) on the client host. It names the transport, the handshake result, and what the coordinator answered.

Check the coordinator's `Coordinator transport:` line at start. The coordinator serves TLS from your certificates only when both `peer.cert_file` and `peer.key_file` are set, and then serves no h2c. Without them it serves built-in TLS, and h2c unless `coordinator.require_tls: true`. On clients, `peer.client_ca_file` adds trusted CA certificates to the system roots. For built-in TLS, configure the coordinator's peer CA first. Remove the client's own-certificate settings and `peer.skip_tls_verify: true`, then set [`peer.ca_cert_file`](#processes-on-another-host), and `peer.token` by the [peer token rule](#peer-token). Remove any `peer.insecure: true` setting. If you already have the coordinator's peer CA certificate, reuse it.

A coordinator with `coordinator.require_tls: false` that cannot create or read its generated CA logs a warning and serves h2c only.

### Clients Fall Back to Plaintext

A warning that names a coordinator address and a handshake error means the network path did not carry TLS, and the client uses h2c for 10 minutes. Let the path carry TLS, such as a proxy that passes TCP through, or, if the coordinator accepts h2c, set `peer.insecure: true` to stay on h2c. See [Fallback to h2c](#fallback-to-h2c).

### Calls Refused With "The coordinator requires TLS"

The coordinator has `coordinator.require_tls: true`, and the client uses h2c. The rest of the line names the change for the client's reason, as the table in [Require TLS](#require-tls) shows: remove `peer.insecure: true`, set `peer.ca_cert_file`, or let the network path pass TLS. A client on Dagu 2.27.0 or earlier prints the coordinator's message instead; upgrade it.

### Certificate Name Mismatch

With built-in TLS, the client verifies the certificate against the peer CA and checks `coordinator.dagu.invalid`, whatever address it dials, so the dialed address never causes a name mismatch.

With your own certificates, the certificate must cover the dialed address. Check the address in `worker.coordinators` and `coordinator.advertise`, then use a certificate with the correct DNS or IP subject alternative name, or change workers to dial an address already covered by the certificate.

### mTLS Clients Are Rejected

This applies to a coordinator on its own certificates. If it sets `peer.client_ca_file`, it requires and verifies client certificates. Each client must provide a certificate and key signed by a CA trusted by the coordinator.

### Self-Signed Certificates

For self-signed or private CA certificates, prefer setting `peer.client_ca_file` on clients to the CA that signed the coordinator certificate.

`peer.skip_tls_verify` is only for temporary testing. It disables server certificate verification on the client side and should not be used for production coordinator traffic.

`peer.skip_tls_verify: true` selects TLS only with `peer.insecure: false`. With both, the client uses TLS with no other TLS file, as Dagu 2.27.0 already did.

## See Also

- [Distributed Networking](/server-admin/distributed/networking) - Coordinator and worker reachability
- [Worker Deployment](/server-admin/distributed/workers/shared-nothing) - Distributed worker setup
- [TLS/HTTPS Configuration](/server-admin/authentication/tls) - Web UI/API HTTPS
- [Configuration Reference](/server-admin/reference) - Full `peer` configuration reference
