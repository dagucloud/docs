# Distributed Transport Security

Choose how Dagu processes encrypt coordinator gRPC traffic: built-in TLS, your own certificates, or h2c.

This page covers the `peer` configuration used by distributed execution. It is separate from Web UI/API HTTPS configuration, which is documented in [TLS/HTTPS Configuration](/server-admin/authentication/tls).

::: tip
`peer` TLS secures coordinator gRPC traffic. It does not secure the Web UI/API HTTP server, `dagu server --tunnel`, or the separate HTTP health endpoints.
:::

::: info Version
Built-in TLS, `peer.ca_cert_file`, `coordinator.require_tls`, the start lines, the ignored-setting warnings, the start checks of your own certificates, plaintext connections on **System Status**, and `dagu worker --check` are in Dagu releases after 2.27.0. In 2.27.0 and earlier, clients use h2c unless `peer.insecure: false` and certificate files are set.
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
| `start-all`, or processes that share the coordinator's data directory | Built-in TLS | None |
| Docker Compose services that mount the coordinator's data volume | Built-in TLS | None |
| The Helm chart | Built-in TLS for the coordinator, scheduler, and UI pods; h2c for worker pods until they get the CA | See [Kubernetes](#kubernetes) |
| A process on another host | Built-in TLS once it has the coordinator's CA, h2c until then | `peer.ca_cert_file` on the process, and `peer.ca_cert_file` with `peer.ca_key_file` on the coordinator, as in [Processes on Another Host](#processes-on-another-host) |
| A path that cannot carry TLS, such as a proxy that expects plaintext gRPC | h2c, after a [fallback](#fallback-to-h2c) | None |
| Your own certificates | TLS or mTLS | `peer.cert_file` and `peer.key_file` on the coordinator, and `peer.insecure: false` with `peer.client_ca_file` on clients, as in [Server TLS](#server-tls) |
| Plaintext on purpose | h2c | `peer.insecure: true` |
| TLS only, with no fallback | Built-in TLS | `peer.insecure: false` on clients, and [`coordinator.require_tls: true`](#require-tls) on the coordinator |

Leave `peer.insecure` unset unless one of the last three rows applies. A config that sets `peer.insecure: true` keeps h2c.

## Built-in TLS

A coordinator without `peer.cert_file` and `peer.key_file` runs its own CA. It generates the CA on its first start and reuses it on later starts. At each start, it issues itself a server certificate for the name `coordinator.dagu.invalid`.

- The coordinator serves built-in TLS and h2c on one port, `coordinator.port`. Older processes and clients with `peer.insecure: true` keep working.
- Processes that share the coordinator's data directory use built-in TLS with no setting: `start-all`, a scheduler or Web UI/API process beside the coordinator, and workers on a shared filesystem.
- Clients check the name `coordinator.dagu.invalid`, not the dialed address. Any address works: an IP address, a DNS name, or a load balancer that passes TCP through.
- Built-in TLS needs TLS 1.3.
- A coordinator that cannot create or read its CA logs a warning and serves h2c only.

`start-all` with no `peer` keys logs:

```text
Coordinator transport: built-in TLS and h2c (from the generated CA)
Peer transport: built-in TLS (from the coordinator's data directory)
```

### Processes on Another Host

A process that does not share the coordinator's data directory has no TLS source. It uses h2c and logs `Peer transport: h2c (from no TLS source)`. To move it to built-in TLS, give the coordinator a CA, and give the process that CA's certificate.

To make a CA, run `dagu peer init --out <dir>`. It writes `ca.crt`, `ca.key`, and `token`, a value for [`peer.token`](#peer-token), and overwrites no file.

On the coordinator, or on `start-all`:

```yaml
peer:
  ca_cert_file: /path/to/ca.crt
  ca_key_file: /path/to/ca.key
```

The certificate must be a CA certificate whose key usage, when present, allows certificate signing, and the key must match it. The coordinator then uses this CA instead of the one it generated. Processes that share its data directory keep using built-in TLS with no setting.

On each process on another host, set only the certificate, in the config file or as `DAGU_PEER_CA_CERT_FILE`:

```yaml
peer:
  ca_cert_file: /path/to/ca.crt
```

The process logs `Peer transport: built-in TLS (from peer.ca_cert_file)`. It verifies every coordinator against that certificate, and a certificate that does not verify fails the call.

## Fallback to h2c

A client on built-in TLS with `peer.insecure` unset falls back to h2c for a coordinator address when its TLS handshake fails on the network path: the connection is reset or closed before the coordinator answers, or the reply is not TLS. A proxy or service mesh sidecar that expects plaintext gRPC does this.

- The client uses h2c for that address for 10 minutes. Its next call after that tries built-in TLS again.
- The processes on one host share the window. Only the process that opens it logs the warning.
- A call that failed before it got a connection is sent again over h2c, so a fallback fails no call.
- A certificate that does not verify fails the call and causes no fallback.
- One case differs: an address that the service registry does not list, such as a coordinator of another Dagu. When its certificate does not chain to the CA of the coordinator that shares the data directory, the client uses h2c for that address for 10 minutes, with the reason `no TLS source`.

A worker behind a proxy that expects plaintext gRPC logs these lines. The warning also names the address and the handshake error.

```text
Peer transport: built-in TLS (from the coordinator's data directory)
Built-in TLS failed on the network path; using h2c for 10 minutes
Peer transport to 127.0.0.1:50055: h2c (from tls failed on the network path)
```

To turn the fallback off, set `peer.insecure: false` on the client. A handshake that fails on the network path then fails the call.

## Require TLS

To refuse every h2c call, set this on the coordinator:

```yaml
coordinator:
  require_tls: true
```

The environment variable is `DAGU_COORDINATOR_REQUIRE_TLS`. The default is `false`.

- The coordinator refuses each h2c call except the gRPC health check, and logs `Coordinator transport: built-in TLS only (from coordinator.require_tls)` at start.
- A refused client logs this once, until one of its calls succeeds: `The coordinator requires TLS. Upgrade this process, or remove peer.insecure: true.`
- A process on another host without `peer.insecure: true` gets the same message when it has no TLS source. Set [`peer.ca_cert_file`](#processes-on-another-host) on it.
- A refusal ends a fallback window, so the client's next call tries built-in TLS again.
- A coordinator that cannot create or read its CA exits with code 1 at start instead of serving h2c.
- It has no effect on a coordinator with `peer.cert_file` and `peer.key_file`, which serves no h2c.

Before you set it, check that **System Status** shows no plaintext connection.

## Plaintext Connections on System Status

**System Status** shows each process that calls the coordinator over h2c, and why:

- **Workers**: each worker's `Connection` column shows `TLS`, or `Plaintext · <reason>` with the change to make below it. `Plaintext` links to this page. A list too narrow for the column shows the same line under the worker ID.
- **Coordinator Service**: under each coordinator, **Plaintext calls in the last 10 minutes** lists the hosts that called it over h2c, other than for a worker's own calls, with the reason and the time of the last call. The calls come from a scheduler, a Web UI/API process, a CLI command, or `dagu worker --check`.

| Shown | Cause | Change |
|-------|-------|--------|
| `Plaintext · peer.insecure: true in its config` | The process sets `peer.insecure: true`. | Remove `peer.insecure: true`. |
| `Plaintext · no TLS source` | The process does not share the coordinator's data directory and has no `peer.ca_cert_file`. | Set [`peer.ca_cert_file`](#processes-on-another-host). |
| `Plaintext · TLS failed on the network path` | Its handshake failed on the network path, and it [fell back](#fallback-to-h2c). | Let the path pass TLS, such as a proxy that passes TCP through. |
| `Plaintext · older version` | The process runs a Dagu release from before built-in TLS. | Upgrade it. |

## Check Worker Connections

Run `dagu worker --check` on the worker host, with the worker's configuration:

```bash
dagu worker --check --worker.coordinators=<coordinator-address>:50055
```

It prints any [ignored-setting](#ignored-settings) warnings and the start line, then for each address in `worker.coordinators`:

- `Transport`: what the worker picks for the address and why, and an open h2c window with its end and the handshake error that opened it
- `Reachable`: whether the address answers, directly or through the HTTPS proxy that the environment names
- `Handshake`: none over h2c, or the names the server certificate covers and the CA it chains to. A failure names each problem in plain words.
- `Credential`: the client certificate and the peer token the worker would send
- `Coordinator answered`: the reply to a health check and to a call that needs the credential

It never registers a worker or takes a task. It exits with code 0 when every coordinator passes, and with code 1 otherwise. Without `worker.coordinators`, it checks the live coordinators in the service registry of its data directory, then exits with code 1, since a worker does not start without `worker.coordinators`.

A worker that shares the coordinator's data directory:

```text
$ dagu worker --check --worker.coordinators=127.0.0.1:50055
Peer transport: built-in TLS (from the coordinator's data directory)
Coordinator 127.0.0.1:50055
  Transport: built-in TLS (from the coordinator's data directory)
  Reachable: yes
  Handshake: TLS
    Certificate covers: DNS:coordinator.dagu.invalid, DNS:dagu-host
    Certificate chains to: Dagu peer CA
  Credential: peer token from the coordinator's data directory
  Coordinator answered: serving, and it accepted the call
Every coordinator passed the check
```

The same worker behind a proxy that expects plaintext gRPC:

```text
Coordinator 127.0.0.1:50055
  Transport: built-in TLS (from the coordinator's data directory)
  Reachable: yes
  Handshake: failed, read tcp 127.0.0.1:56262->127.0.0.1:50055: read: connection reset by peer
    Address dialed: 127.0.0.1:50055
    The worker falls back to h2c (from tls failed on the network path) for 10 minutes
  Credential: peer token from the coordinator's data directory
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

An address that does not answer gets `Cannot reach coordinator at <host>:<port>` and what to check. A call that `coordinator.require_tls` refuses gets the client's message from [Require TLS](#require-tls).

## Start Lines and Warnings

### Start Line

The scheduler, the Web UI/API process, a worker, and `start-all` log one line at start, at level info, for the transport they use to call the coordinator. CLI commands and run processes log it at level debug.

| Configuration | Start line |
|---------------|------------|
| `peer.insecure: true` | `Peer transport: h2c (from peer.insecure: true)` |
| `peer.insecure: false` with `peer.cert_file`, `peer.key_file`, `peer.client_ca_file`, or `peer.skip_tls_verify: true` | `Peer transport: TLS (from peer.insecure: false)` |
| `peer.ca_cert_file` | `Peer transport: built-in TLS (from peer.ca_cert_file)` |
| The process shares the coordinator's data directory | `Peer transport: built-in TLS (from the coordinator's data directory)` |
| None of these | `Peer transport: h2c (from no TLS source)` |

`peer.insecure: false` with none of these settings and no TLS source exits with code 1 at start with `TLS enabled but no certificates provided`.

When the transport to one coordinator address differs from the start line, the process logs `Peer transport to <host>:<port>: <transport> (from <source>)` each time it changes.

The coordinator logs what it serves:

| Coordinator | Line |
|-------------|------|
| Generated CA | `Coordinator transport: built-in TLS and h2c (from the generated CA)` |
| `peer.ca_cert_file` and `peer.ca_key_file` | `Coordinator transport: built-in TLS and h2c (from peer.ca_cert_file)` |
| `coordinator.require_tls: true` | `Coordinator transport: built-in TLS only (from coordinator.require_tls)` |
| `peer.cert_file` and `peer.key_file` | `Coordinator transport: TLS (from peer.cert_file)` |
| A CA it cannot create or read | `Coordinator transport: h2c (from no peer CA)` |

### Ignored Settings

A TLS setting that the chosen transport does not use has no effect. The process logs one warning per such setting, with its value and the change that would use it:

```text
Peer TLS setting ignored: peer.client_ca_file (ca.crt) has no effect while peer.insecure is not false; set peer.insecure: false to use it
Peer TLS setting ignored: peer.ca_cert_file (ca.crt) has no effect while peer.insecure is true; remove peer.insecure: true to use it
```

On a client, `peer.cert_file`, `peer.key_file`, and `peer.client_ca_file` select TLS only with `peer.insecure: false`. A coordinator uses them to serve whatever `peer.insecure` says, so a process that only serves logs no warning.

### Start Checks of Your Own Certificates

A coordinator with `peer.cert_file` and `peer.key_file` checks them at start:

- A key that does not match the certificate exits with code 1, naming both files.
- `Coordinator certificate does not name the advertised address`: the certificate does not cover `coordinator.advertise`, or the detected host name when that is unset. Add the address to the certificate, or set `coordinator.advertise` to a name it covers.
- `Coordinator certificate expires within 14 days`, or `Coordinator certificate has expired`.
- `Peer certificate does not allow client authentication`: a process that serves and calls with the same certificate while `peer.client_ca_file` is set, such as `start-all`. Local runs work, and dispatching runs to workers fails until the certificate allows client authentication.

The three warnings do not stop the process.

## Certificate Requirements

With your own certificates, the coordinator certificate must be valid for the address clients dial. Built-in TLS needs no name for that address.

For example, if workers use:

```bash
dagu worker --worker.coordinators=dagu-coordinator.default.svc.cluster.local:50055
```

then the coordinator server certificate should include `dagu-coordinator.default.svc.cluster.local` in its subject alternative names.

If workers dial an IP address, include that IP address as an IP subject alternative name. If workers dial a DNS name, include that DNS name as a DNS subject alternative name.

Use certificates from your organization PKI, cert-manager, a private CA, or another certificate workflow that fits your environment. For production, avoid `peer.skip_tls_verify`; it disables coordinator certificate verification on the client side.

## Server TLS

Server TLS encrypts coordinator gRPC traffic and lets clients verify the coordinator identity.

On the coordinator:

```yaml
peer:
  insecure: false
  cert_file: /etc/dagu/tls/coordinator.crt
  key_file: /etc/dagu/tls/coordinator.key
```

Equivalent flags:

```bash
dagu coordinator \
  --coordinator.host=0.0.0.0 \
  --coordinator.advertise=<coordinator-address> \
  --peer.insecure=false \
  --peer.cert-file=/etc/dagu/tls/coordinator.crt \
  --peer.key-file=/etc/dagu/tls/coordinator.key
```

On each worker or other coordinator client:

```yaml
peer:
  insecure: false
  client_ca_file: /etc/dagu/tls/ca.crt
```

Equivalent flags:

```bash
dagu worker \
  --worker.coordinators=<coordinator-address>:50055 \
  --peer.insecure=false \
  --peer.client-ca-file=/etc/dagu/tls/ca.crt
```

`client_ca_file` has different roles depending on the process:

- On the coordinator, it is the CA used to verify client certificates. Setting it enables mTLS.
- On a worker or another coordinator client, it is the CA used to verify the coordinator server certificate.

## Mutual TLS

Mutual TLS requires the coordinator to verify client certificates and requires clients to verify the coordinator certificate.

On the coordinator:

```yaml
peer:
  insecure: false
  cert_file: /etc/dagu/tls/coordinator.crt
  key_file: /etc/dagu/tls/coordinator.key
  client_ca_file: /etc/dagu/tls/client-ca.crt
```

Equivalent flags:

```bash
dagu coordinator \
  --coordinator.host=0.0.0.0 \
  --coordinator.advertise=<coordinator-address> \
  --peer.insecure=false \
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
  --worker.coordinators=<coordinator-address>:50055 \
  --peer.insecure=false \
  --peer.cert-file=/etc/dagu/tls/worker.crt \
  --peer.key-file=/etc/dagu/tls/worker.key \
  --peer.client-ca-file=/etc/dagu/tls/server-ca.crt
```

The server CA and client CA can be the same CA if one CA issues both coordinator and client certificates.

## Peer Token

The coordinator and the processes that call it, such as workers, the scheduler, and the Web UI/API process, identify each other with a peer token. Processes that share the coordinator's data directory need no setup.

To choose the token yourself, give the coordinator and every process that calls it the same `peer.token`:

```yaml
peer:
  token: "<a long random string>"
```

To accept only processes that send the token, set this on the coordinator:

```yaml
coordinator:
  require_token: true
```

`coordinator.require_token` defaults to `false`. The peer token works with or without TLS.

## Kubernetes

The official Helm chart renders no `peer.insecure`. Its coordinator, scheduler, and UI pods share the data volume, so they use built-in TLS. Worker pods do not share it, so they use h2c until they get the CA. The [chart's README](https://github.com/dagucloud/dagu/blob/main/charts/dagu/README.md#peer-tls) describes both.

For your own certificates, mount them into the coordinator, scheduler, Web UI/API, and worker pods that serve or dial coordinator gRPC, through Kubernetes Secrets, and set the corresponding `peer` config or `DAGU_PEER_*` environment variables for each component.

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
| `peer.ca_cert_file` | `DAGU_PEER_CA_CERT_FILE` |
| `peer.ca_key_file` | `DAGU_PEER_CA_KEY_FILE` |
| `peer.token` | `DAGU_PEER_TOKEN` |
| `coordinator.require_token` | `DAGU_COORDINATOR_REQUIRE_TOKEN` |
| `coordinator.require_tls` | `DAGU_COORDINATOR_REQUIRE_TLS` |

## Troubleshooting

### TLS Client Cannot Connect

Run [`dagu worker --check`](#check-worker-connections) on the client host. It names the transport, the handshake result, and what the coordinator answered.

The coordinator serves TLS from your certificates only when both `peer.cert_file` and `peer.key_file` are set. Without them it serves built-in TLS and h2c. A client with `peer.insecure: false` and `peer.client_ca_file` verifies the coordinator against `peer.client_ca_file`; to use built-in TLS, set [`peer.ca_cert_file`](#processes-on-another-host) instead.

### Certificate Name Mismatch

If clients reject the coordinator certificate, check the address in `worker.coordinators` and `coordinator.advertise`. The certificate must be valid for the address clients dial.

Use a certificate with the correct DNS or IP subject alternative name, or change workers to dial an address already covered by the certificate.

### mTLS Clients Are Rejected

If the coordinator sets `peer.client_ca_file`, it requires and verifies client certificates. Each client must provide a certificate and key signed by a CA trusted by the coordinator.

### Self-Signed Certificates

For self-signed or private CA certificates, prefer setting `peer.client_ca_file` on clients to the CA that signed the coordinator certificate.

`peer.skip_tls_verify` is only for temporary testing. It disables server certificate verification on the client side and should not be used for production coordinator traffic.

`peer.skip_tls_verify` does not enable TLS by itself. Keep `peer.insecure: false` and provide TLS configuration such as `peer.client_ca_file` when testing with this option.

## See Also

- [Distributed Networking](/server-admin/distributed/networking) - Coordinator and worker reachability
- [Worker Deployment](/server-admin/distributed/workers/shared-nothing) - Distributed worker setup
- [TLS/HTTPS Configuration](/server-admin/authentication/tls) - Web UI/API HTTPS
- [Configuration Reference](/server-admin/reference) - Full `peer` configuration reference
