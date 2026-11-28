# Distributed Transport Security

Configure built-in TLS, TLS with your own certificates, or mutual TLS for Dagu coordinator and worker gRPC traffic.

This page covers the `peer` configuration used by distributed execution. It is separate from Web UI/API HTTPS configuration, which is documented in [TLS/HTTPS Configuration](/server-admin/authentication/tls).

::: tip
`peer` TLS secures coordinator gRPC traffic. It does not secure the Web UI/API HTTP server, `dagu server --tunnel`, or the separate HTTP health endpoints.
:::

## Traffic Covered

Distributed execution uses coordinator gRPC for:

- task polling and dispatch
- worker heartbeats
- status updates
- log streaming
- artifact uploads
- distributed state RPCs

All processes that dial the coordinator must use compatible peer transport settings. This includes workers and any server-side process that dispatches work through the coordinator, such as the scheduler, Web UI/API process, or queue processor.

## Modes

| Mode | Coordinator config | Client config | Use case |
|------|--------------------|---------------|----------|
| Built-in TLS | None: the coordinator generates a peer CA, or uses `peer.ca_cert_file` and `peer.ca_key_file` | None when the client shares the coordinator's data directory; otherwise `peer.ca_cert_file` | Encrypted traffic with no certificates to manage |
| h2c plaintext | None | `peer.insecure: true`, or a client with no TLS source | Local development or trusted isolated networks |
| TLS | `peer.cert_file` and `peer.key_file` | `peer.insecure: false` plus a CA file for the coordinator certificate | Encrypted traffic with certificates from your own PKI |
| mTLS | `peer.cert_file`, `peer.key_file`, and `peer.client_ca_file` | `peer.insecure: false`, client certificate/key, and CA file | Encrypted traffic with coordinator and client identity |

Plaintext h2c does not provide Dagu-level encryption or peer identity.

## Built-in TLS

In Dagu releases after 2.27.0, a coordinator without `peer.cert_file` and `peer.key_file` serves built-in TLS and h2c on one port, `coordinator.port`. Each connection picks its transport, so clients on either transport keep working, including Dagu 2.27.0 and earlier, which connect over h2c.

- **Peer CA:** on its first start, the coordinator generates a CA and keeps it in `<data_dir>/coordinator/`, readable by its user only. Later starts reuse it. The CA has no expiry date.
- **Coordinator certificate:** at each start, the coordinator issues itself a server certificate from the CA, in memory only. The certificate names `coordinator.dagu.invalid`, and clients verify that name and the CA chain, not the address they dial. Built-in TLS needs no certificate per address.
- **Published CA certificate:** the coordinator writes the CA certificate to `<data_dir>/coordinator/peer-ca.crt`.

A client picks its transport from the first row that matches:

| Client configuration | Transport |
|----------------------|-----------|
| `peer.insecure: true` | h2c |
| `peer.insecure: false` with `peer.cert_file`, `peer.key_file`, `peer.client_ca_file`, or `peer.skip_tls_verify: true` | TLS with those settings |
| `peer.ca_cert_file` | Built-in TLS, verified against that certificate |
| A readable `peer-ca.crt` in its own data directory, while the service registry there lists a live coordinator that serves built-in TLS | Built-in TLS |
| `peer.insecure: false` with none of the above | The process exits at start with `TLS enabled but no certificates provided` |
| None of these | h2c, as in Dagu 2.27.0 |

So the scheduler, the Web UI/API process, `start-all`, and workers that share the coordinator's data directory use built-in TLS with no setting. A worker on another host uses h2c until you give it the CA certificate.

Each process logs its choice at start:

```text
Coordinator transport: built-in TLS and h2c (from the generated CA)
Peer transport: built-in TLS (from the coordinator's data directory)
```

To keep every process on h2c, set `peer.insecure: true`.

### Workers on Other Hosts

Copy `<data_dir>/coordinator/peer-ca.crt` from the coordinator host to the worker, and set:

```yaml
peer:
  insecure: false
  ca_cert_file: /etc/dagu/peer-ca.crt
  token: "<the coordinator's peer token>"
```

`peer.insecure: false` keeps the worker on TLS with no fallback to h2c. The peer token is in `<data_dir>/coordinator/peer-token` on the coordinator host; see [Peer Token](#peer-token).

### Fallback to h2c

A client on built-in TLS with `peer.insecure` unset falls back to h2c when its TLS handshake fails at the transport level, such as through a sidecar or proxy that expects plaintext gRPC. It logs a warning that names the address, uses h2c for that address for 10 minutes, and then tries built-in TLS again. A call that failed before it reached a coordinator is sent once more over h2c, so a fallback fails no call.

A certificate that does not verify never causes a fallback. A client with `peer.insecure: false` never falls back.

### Your Own Peer CA

To keep the same CA across data directories, such as for several coordinators or a Kubernetes Secret, generate one:

```bash
dagu peer init --out /etc/dagu/peer
```

It writes `ca.crt`, `ca.key`, and a peer `token` into the directory, and writes nothing when any of them exists. Then set, on each coordinator:

```yaml
peer:
  ca_cert_file: /etc/dagu/peer/ca.crt
  ca_key_file: /etc/dagu/peer/ca.key
  token: "<contents of /etc/dagu/peer/token>"
```

and on each client, `peer.ca_cert_file: /etc/dagu/peer/ca.crt` and the same `peer.token`. Only the coordinator reads `peer.ca_key_file`.

::: warning
Use a CA only for Dagu peers. The coordinator accepts any client certificate that its peer CA signed in place of the peer token.
:::

### Require TLS

Once every client uses TLS, set this on the coordinator to refuse calls over h2c:

```yaml
coordinator:
  require_tls: true
```

The coordinator then refuses every call over h2c, except gRPC health checks, with `the coordinator requires TLS: upgrade this process, or remove peer.insecure: true`. Dagu 2.27.0 and earlier connect only over h2c, so upgrade every process first. `coordinator.require_tls` has no flag; use `DAGU_COORDINATOR_REQUIRE_TLS`. It has no effect on a coordinator with its own certificates, which serves no h2c.

## Certificate Requirements

This section and the next two apply to your own certificates, set with `peer.cert_file` and `peer.key_file`. A coordinator with its own certificates serves TLS only, with no h2c and no built-in TLS.

The coordinator certificate must be valid for the address clients dial.

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

In Dagu releases after 2.27.0, the official Helm chart no longer sets `peer.insecure: true`. The coordinator, scheduler, and Web UI/API pods share the data volume, so they use built-in TLS with no setting. Worker pods do not share it, so they use h2c until you store a peer CA in a Secret and name it in `peer.existingCASecret`. The chart README covers this, the peer token, and workers outside the cluster.

To use your own certificates instead, provide the files through Kubernetes Secrets and set the corresponding `peer` config or `DAGU_PEER_*` environment variables for each component.

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

Check the coordinator's `Coordinator transport:` line at start. With `peer.cert_file` and `peer.key_file`, it serves TLS with those certificates only. Without them, it serves built-in TLS and h2c, and a client verifies it with `peer.ca_cert_file` or the published `peer-ca.crt`.

A coordinator that cannot create or read its generated CA, such as one that cannot write its data directory, logs a warning and serves h2c only.

### Clients Fall Back to Plaintext

A warning that names a coordinator address and a handshake error means the network path did not carry TLS, and the client uses h2c for 10 minutes. Let the path carry TLS, such as a proxy that passes TCP through, or set `peer.insecure: true` to stay on h2c.

### Calls Refused With "the coordinator requires TLS"

The coordinator has `coordinator.require_tls: true`, and the client uses h2c. Upgrade the client past Dagu 2.27.0, remove `peer.insecure: true`, or give it `peer.ca_cert_file`.

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
