# Distributed Networking

Configure the network path between Dagu coordinators and workers.

Distributed execution uses gRPC between workers and the coordinator. Dagu does not require a specific network provider: the worker only needs a reachable `host:port` for the coordinator gRPC service.

::: tip
`dagu server --tunnel` exposes the Web UI and REST API over HTTP. It does not expose the distributed coordinator gRPC service. Use the patterns on this page for coordinator and worker traffic.
:::

## Default Pattern

The default pattern is to give the coordinator a stable address and let workers dial that address directly.

Use this pattern for Kubernetes Services, VM or bare-metal private networks, Docker networks, VPNs, and overlay networks.

On the coordinator host:

```bash
dagu start-all \
  --coordinator.host=0.0.0.0 \
  --coordinator.advertise=<coordinator-address> \
  --coordinator.port=50055
```

On each worker host:

```bash
dagu worker \
  --worker.coordinators=<coordinator-address>:50055 \
  --worker.labels=gpu=true
```

Replace `<coordinator-address>` with a DNS name or IP address that resolves from the worker and routes to the coordinator gRPC port. Examples include a Kubernetes Service DNS name, an internal load balancer DNS name, a private VM DNS name, a private IP address, or a VPN/overlay-network address.

If the Web UI should also be reachable from other hosts, bind the web server to a reachable address too:

```bash
dagu start-all \
  --host=0.0.0.0 \
  --port=8080 \
  --coordinator.host=0.0.0.0 \
  --coordinator.advertise=<coordinator-address> \
  --coordinator.port=50055
```

The network layer must allow TCP traffic from workers to the coordinator on port `50055`.

If the coordinator should listen only on a specific interface, set `--coordinator.host` to that interface address instead of `0.0.0.0`.

## Traffic Model

Normal distributed execution has one required control-plane path:

```
worker process  --->  coordinator gRPC port
```

Workers poll the coordinator, send heartbeats, push status, stream logs, and upload artifacts over gRPC. The coordinator does not need to open an inbound connection to the worker for normal execution.

The coordinator health port and worker health port are separate HTTP endpoints for process health checks:

| Port | Default | Purpose |
|------|---------|---------|
| Coordinator gRPC | `50055` | Required for distributed task dispatch and worker communication |
| Coordinator health | `8091` | Optional `GET /health` endpoint for the coordinator process |
| Worker health | `8092` | Optional `GET /health` endpoint for a worker process |

Do not route workers to `8091` or `8092`; workers need the coordinator gRPC port.

Setting `worker.health-port=0` disables only the worker's local HTTP `/health` endpoint. It does not disable coordinator polling, heartbeats, or other gRPC traffic. Likewise, `coordinator.health-port=0` disables only the coordinator's HTTP health endpoint. The coordinator health server listens on `:8091` by default, binding all interfaces independently of `coordinator.host`; changing `coordinator.host` changes the gRPC listener only.

## Required Dagu Settings

On the coordinator, configure:

- `coordinator.host`: local address where the coordinator listens.
- `coordinator.port`: local gRPC port.
- `coordinator.advertise`: address that workers can use to reach this coordinator.

On workers, configure:

- `worker.coordinators`: explicit coordinator addresses in `host:port` form.

`worker.coordinators` is required. Workers use these addresses for coordinator discovery and do not access the coordinator's file-backed service registry.

The examples below use `dagu coordinator` when showing only the coordinator gRPC listener. If the coordinator runs inside `dagu start-all`, pass the same `--coordinator.host`, `--coordinator.advertise`, `--coordinator.port`, and `--peer.*` flags to `dagu start-all`.

## Kubernetes

In Kubernetes, expose the coordinator gRPC port with a Service and use the Service DNS name as the coordinator address.

In the official Helm chart's distributed mode, the chart creates a coordinator `ClusterIP` Service on port `50055`, sets the coordinator advertise address to that Service name, and passes the same address to every worker. For a release named `dagu`, the worker endpoint is:

```bash
dagu-coordinator:50055
```

The short Service name works because the chart deploys the coordinator and workers in the same namespace. Render the chart or run `kubectl get service` to find the exact name when the release uses a different name or override.

The UI server, scheduler, and coordinator share an RWX volume. Workers use ephemeral pod storage and send status and logs through gRPC; they do not mount the shared PVC. For Helm installation details, see [Kubernetes deployment](/server-admin/deployment/kubernetes#distributed-mode).

For hand-written manifests without shared service registry access, configure workers with the Service DNS name explicitly:

```bash
dagu worker \
  --worker.coordinators=dagu-coordinator.default.svc.cluster.local:50055 \
  --worker.labels=gpu=true
```

The coordinator should bind to all pod interfaces and advertise the Service DNS name:

```bash
dagu coordinator \
  --coordinator.host=0.0.0.0 \
  --coordinator.advertise=dagu-coordinator.default.svc.cluster.local \
  --coordinator.port=50055
```

## Private Networks, VPNs, and Overlay Networks

Private networks, VPNs, and overlay networks use the same default pattern: workers dial a coordinator address that is routable inside that network.

The coordinator gRPC bind address defaults to `127.0.0.1`, so Tailnet membership alone does not expose the coordinator. For direct Tailnet access, set `--coordinator.host=0.0.0.0` or bind to the coordinator's Tailscale interface address.

Examples of valid coordinator addresses:

- `dagu-coordinator.internal.example.com`
- `10.0.12.34`
- `coordinator.wireguard.internal`
- `coordinator.tailnet-name.ts.net`

On the coordinator:

```bash
dagu coordinator \
  --coordinator.host=0.0.0.0 \
  --coordinator.advertise=<private-or-overlay-address> \
  --coordinator.port=50055
```

On each worker:

```bash
dagu worker \
  --worker.coordinators=<private-or-overlay-address>:50055
```

If the coordinator should listen only on the private or overlay interface, set `--coordinator.host` to that interface address.

## Tailscale Serve TCP Forwarding

Tailscale Serve is not required for normal Tailnet deployments. Use direct Tailnet connectivity when workers can dial the coordinator's Tailscale IP address or MagicDNS name.

Use Tailscale Serve TCP forwarding only when the coordinator should listen on localhost and Tailscale should publish a raw TCP forwarder inside the tailnet.

On the coordinator host, start the coordinator on loopback and advertise the tailnet name:

```bash
dagu coordinator \
  --coordinator.host=127.0.0.1 \
  --coordinator.advertise=<coordinator-tailnet-name> \
  --coordinator.port=50055
```

In another terminal or service manager on the same host, publish the coordinator port with Tailscale Serve TCP forwarding:

```bash
tailscale serve --tcp=50055 tcp://localhost:50055
```

On each worker host:

```bash
dagu worker \
  --worker.coordinators=<coordinator-tailnet-name>:50055
```

`tailscale serve --tcp` forwards raw TCP packets to a local TCP server. That is the required mode for Dagu coordinator gRPC traffic. The HTTP and HTTPS reverse proxy modes are for HTTP services and are not the right mode for coordinator gRPC.

For unattended operation, run `tailscale serve` under a service manager or use Tailscale's background mode if it is appropriate for your deployment:

```bash
tailscale serve --bg --tcp=50055 tcp://localhost:50055
```

## SSH Local Port Forwarding

Use this pattern when workers can reach the coordinator host with SSH but cannot connect to the coordinator port directly.

On the coordinator host, bind the coordinator to loopback and advertise loopback:

```bash
dagu coordinator \
  --coordinator.host=127.0.0.1 \
  --coordinator.advertise=127.0.0.1 \
  --coordinator.port=50055
```

On each worker host, keep an SSH local port forward open:

```bash
ssh -N -L 50055:127.0.0.1:50055 <user>@<coordinator-ssh-host>
```

Then start the worker against the worker-local forwarded port:

```bash
dagu worker \
  --worker.coordinators=127.0.0.1:50055
```

Use the same local port as the coordinator port. Dagu includes the coordinator owner host and port in tasks, and workers use that owner address for follow-up RPCs such as task acknowledgment, status updates, log streams, and artifact uploads.

This pattern is intended for deployments where every remote worker reaches the coordinator through its own local SSH forward. Do not mix it with workers that need to reach the coordinator directly unless they have a route for the same advertised address.

## SSH Reverse Port Forwarding

If the coordinator host can open an SSH session to the worker host, use a reverse forward instead. Keep this session open on the coordinator host:

```bash
ssh -N -R 50055:127.0.0.1:50055 <user>@<worker-host>
```

This opens `127.0.0.1:50055` on the worker host and forwards it to the coordinator's loopback gRPC port. Use the same loopback coordinator settings and worker command shown for [SSH local forwarding](#ssh-local-port-forwarding):

```bash
dagu worker \
  --worker.coordinators=127.0.0.1:50055
```

Only coordinator port `50055` needs forwarding. Choose local or reverse forwarding based on which host can authenticate to the other; do not run both for the same worker.

## Transport Security

The default peer transport is h2c (`peer.insecure=true`). That is convenient for local testing or trusted isolated networks, but it does not provide Dagu-level encryption or peer identity.

For TLS, mTLS, and certificate requirements, see [Distributed Transport Security](/server-admin/distributed/transport-security).

## Troubleshooting

### Worker Cannot Connect

Check the address that the worker dials:

```bash
dagu worker --worker.coordinators=<coordinator-address>:50055
```

Then verify:

- The coordinator process is listening on `coordinator.host:coordinator.port`.
- The address in `worker.coordinators` resolves from the worker host.
- Firewalls, network policies, security groups, VPN ACLs, or SSH forwards allow TCP traffic to the coordinator gRPC port.
- The worker is not using the coordinator health port (`8091`) or worker health port (`8092`) as its coordinator address.

### Worker Connects But Follow-Up RPCs Fail

Check `coordinator.advertise`. The coordinator stores this value in tasks as the owner address. Workers use the owner address for follow-up RPCs after a task is claimed.

For direct network access, advertise the address workers can reach:

```bash
--coordinator.advertise=<coordinator-address>
```

For SSH local forwarding where every worker uses `127.0.0.1:50055`, advertise loopback:

```bash
--coordinator.advertise=127.0.0.1
```

### Tailscale Serve Is Running But Workers Fail

Confirm that Serve is using raw TCP forwarding:

```bash
tailscale serve --tcp=50055 tcp://localhost:50055
```

If the worker reports `error reading server preface: EOF` and keeps retrying, Tailscale Serve is likely using HTTP or HTTPS mode against the gRPC port. HTTP and HTTPS Serve modes are for HTTP services; replace them with the raw TCP command above.

## See Also

- [Distributed Execution](/server-admin/distributed/) - Coordinator and worker setup
- [Distributed Transport Security](/server-admin/distributed/transport-security) - TLS and mTLS for coordinator gRPC
- [Worker Deployment](/server-admin/distributed/workers/shared-nothing) - Distributed worker setup
- [Install on Kubernetes](/getting-started/installation/kubernetes) - Official Helm chart
- [Tunnel (Tailscale)](/server-admin/tunnel) - Web UI/API access through Dagu's embedded Tailscale node
- [Tailscale Serve command](https://tailscale.com/docs/reference/tailscale-cli/serve) - Official Tailscale Serve TCP forwarding syntax
