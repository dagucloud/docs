# Configurations

Deploy, configure, and operate Dagu.

::: info Deployment Model
These pages primarily document self-hosted Dagu. Hosted Dagu Cloud includes managed authentication, audit logging, and related platform features by default, so those capabilities usually do not need manual `config.yaml` setup there. See the [pricing page](https://dagu.sh/pricing) for current self-host and cloud availability.
:::

## Configuration Methods

Precedence order:
1. Command-line flags (highest)
2. Environment variables (`DAGU_` prefix)
3. Configuration file (lowest)

```bash
# Port 9000 wins
dagu start-all --port 9000

# Despite env var
export DAGU_PORT=8080

# And config file
port: 7000
```

## Quick Start

### Development
```bash
# Zero config
dagu start-all
```

### Production
```yaml
# ~/.config/dagu/config.yaml
host: 0.0.0.0
port: 8080

auth:
  mode: basic
  basic:
    username: admin
    password: ${ADMIN_PASSWORD}

paths:
  dags_dir: /opt/dagu/workflows
  log_dir: /var/log/dagu
```

### Docker
```bash
docker run -d \
  -e DAGU_HOST=0.0.0.0 \
  -e DAGU_AUTH_BASIC_USERNAME=admin \
  -e DAGU_AUTH_BASIC_PASSWORD=secret \
  -p 8080:8080 \
  ghcr.io/dagu-org/dagu:latest
```

## Topics

**[Server Configuration](/server-admin/server)**
- Host, port, authentication
- TLS/HTTPS setup
- UI customization

**[Base Configuration](/server-admin/base-config)**
- Shared DAG defaults
- Lifecycle handlers
- Email notifications

**[Operations](/server-admin/operations)**
- Running as a service
- Monitoring and metrics
- Logging and alerting

**[Remote Nodes](/server-admin/remote-nodes)**
- Configure remote instances
- Multi-node setup

**[Tunnel (Tailscale)](/server-admin/tunnel)**
- Remote access without port forwarding
- Tailscale integration

**[Distributed Execution](/server-admin/distributed/)**
- Coordinator and worker setup
- Service registry configuration
- Worker labels and routing

**[Configuration Reference](/server-admin/reference)**
- All options
- Environment variables
- Examples

## Common Configurations

### Production
```yaml
host: 127.0.0.1
port: 8080

tls:
  cert_file: /etc/ssl/cert.pem
  key_file: /etc/ssl/key.pem

auth:
  mode: basic
  basic:
    username: admin
    password: ${ADMIN_PASSWORD}

permissions:
  write_dags: false  # Read-only
  run_dags: true

ui:
  navbar_color: "#FF0000"
  navbar_title: "Production"
```

### Development
```yaml
host: 127.0.0.1
port: 8080
debug: true

auth:
  mode: none
```

## Environment Variables

```bash
# Server
export DAGU_HOST=0.0.0.0
export DAGU_PORT=8080

# Paths
export DAGU_DAGS_DIR=/opt/workflows
export DAGU_DOCS_DIR=/opt/workflows/docs
export DAGU_LOG_DIR=/var/log/dagu

# Auth
export DAGU_AUTH_BASIC_USERNAME=admin
export DAGU_AUTH_BASIC_PASSWORD=secret

dagu start-all
```

## See Also

- [Set up authentication](/server-admin/server#authentication) for production
- [Configure base defaults](/server-admin/base-config) for shared DAG settings
- [Configure monitoring](/server-admin/operations#monitoring) for visibility
- [Set up distributed execution](/server-admin/distributed/) for scaling
- [Review all options](/server-admin/reference) for fine-tuning
