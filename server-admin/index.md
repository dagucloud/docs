# Configurations

Deploy, configure, and operate Dagu.

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
  wiki_dir: /opt/dagu/workflows/wiki
  log_dir: /var/log/dagu
```

### Docker
```bash
docker run -d \
  -e DAGU_HOST=0.0.0.0 \
  -e DAGU_AUTH_MODE=basic \
  -e DAGU_AUTH_BASIC_USERNAME=admin \
  -e DAGU_AUTH_BASIC_PASSWORD=secret \
  -p 8080:8080 \
  ghcr.io/dagucloud/dagu:latest
```

## Topics

**[Monitoring in Dagu Console](/overview/console-monitoring)**
- Every server's health, runs, and trends in one place
- Email when a workflow fails or a server stops reporting
- Opt-in, outbound HTTPS only, metadata only

**[Configuration](/server-admin/configuration)**
- Config file, environment variables, and precedence
- `DAGU_HOME` and path defaults
- Wiki and runbook storage
- Persistent state directory configuration

**[Server Configuration](/server-admin/server)**
- Host, port, authentication
- TLS/HTTPS setup
- UI customization

**[Base Configuration](/server-admin/base-config)**
- Shared DAG defaults
- Lifecycle handlers
- Email notifications

**[Notifications](/web-ui/notifications)**
- Reusable Microsoft Teams, Slack, email, Telegram, webhook, and local command channels
- Global and workspace notification rules
- License requirements for team notification routing

**[Incident Routing](/web-ui/incidents)**
- Reusable PagerDuty and SolarWinds Incident Response connections
- Global, workspace, and DAG incident routes
- License requirements for team incident routing

**[Operations](/server-admin/operations)**
- Running as a service
- Monitoring and metrics
- Logging and alerting

**[Git Sync](/server-admin/git-sync)**
- Synchronize DAGs and their supporting files
- Review, publish, and resolve repository changes
- Configure read-only branch promotion

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
export DAGU_WIKI_DIR=/opt/workflows/wiki
export DAGU_LOG_DIR=/var/log/dagu

# Auth
export DAGU_AUTH_MODE=basic
export DAGU_AUTH_BASIC_USERNAME=admin
export DAGU_AUTH_BASIC_PASSWORD=secret

dagu start-all
```

## See Also

- [Set up authentication](/server-admin/server#authentication) for production
- [Understand configuration precedence](/server-admin/configuration) before mixing flags, environment variables, and `config.yaml`
- [Configure base defaults](/server-admin/base-config) for shared DAG settings
- [Configure Git Sync](/server-admin/git-sync) for repository-managed DAGs and supporting files
- [Configure Wiki](/web-ui/wiki) for Markdown runbooks and Git Sync
- [Monitor servers from Dagu Console](/overview/console-monitoring) for one view across servers and alert emails
- [Configure resource monitoring](/server-admin/operations#resource-monitoring) and [Prometheus metrics](/server-admin/operations#prometheus-metrics) for each server
- [Set up distributed execution](/server-admin/distributed/) for scaling
- [Review all options](/server-admin/reference) for fine-tuning
