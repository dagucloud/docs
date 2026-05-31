# Distributed Transport Security

Configure TLS or mutual TLS for Dagu coordinator and worker gRPC traffic.

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
| h2c plaintext | No coordinator certificate required | `peer.insecure: true` | Local development or trusted isolated networks |
| TLS | `peer.cert_file` and `peer.key_file` | `peer.insecure: false` plus a CA file for the coordinator certificate | Encrypted coordinator traffic with server identity |
| mTLS | `peer.cert_file`, `peer.key_file`, and `peer.client_ca_file` | `peer.insecure: false`, client certificate/key, and CA file | Encrypted traffic with coordinator and client identity |

The default is h2c plaintext:

```yaml
peer:
  insecure: true
```

Plaintext h2c is convenient for local testing, but it does not provide Dagu-level encryption or peer identity.

## Certificate Requirements

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

## Kubernetes

Mount peer certificates into the coordinator, scheduler, Web UI/API, and worker pods that need to serve or dial coordinator gRPC.

For the official Helm chart, the default rendered Dagu config uses:

```yaml
peer:
  insecure: true
```

To enable peer TLS in Kubernetes, provide certificate files through Kubernetes Secrets and set the corresponding `peer` config or `DAGU_PEER_*` environment variables for each component.

For mTLS:

- coordinator pods need the coordinator certificate, coordinator key, and client CA
- worker pods need a client certificate, client key, and server CA
- scheduler and Web UI/API pods need client-side peer settings if they dispatch through the coordinator

## Environment Variables

The peer TLS settings can also be configured with environment variables:

| Config key | Environment variable |
|------------|----------------------|
| `peer.insecure` | `DAGU_PEER_INSECURE` |
| `peer.cert_file` | `DAGU_PEER_CERT_FILE` |
| `peer.key_file` | `DAGU_PEER_KEY_FILE` |
| `peer.client_ca_file` | `DAGU_PEER_CLIENT_CA_FILE` |
| `peer.skip_tls_verify` | `DAGU_PEER_SKIP_TLS_VERIFY` |

## Troubleshooting

### TLS Client Cannot Connect

Check that the coordinator is actually serving TLS. The coordinator enables TLS only when both `peer.cert_file` and `peer.key_file` are configured.

If the coordinator has no certificate and key, clients must use `peer.insecure: true`.

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
- [Shared Nothing Workers](/server-admin/distributed/workers/shared-nothing) - Distributed workers without shared storage
- [TLS/HTTPS Configuration](/server-admin/authentication/tls) - Web UI/API HTTPS
- [Configuration Reference](/server-admin/reference) - Full `peer` configuration reference
