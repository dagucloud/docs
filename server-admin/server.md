# Server Configuration

Configure Dagu server settings.

::: info Deployment Model
This page documents self-hosted Dagu server configuration. Hosted Dagu Cloud includes managed authentication, audit logging, and related platform services by default, so you typically do not configure those features through `config.yaml` there. See the [pricing page](https://dagu.sh/pricing) for current self-host and cloud availability.
:::

## Configuration Methods

Precedence order:
1. Command-line flags (highest)
2. Environment variables (`DAGU_` prefix)
3. Configuration file (lowest)

```bash
# CLI flag wins
dagu start-all --port=8000

# Even with env var
export DAGU_PORT=8080

# And config file
port: 7000
```

## Configuration File

Location: `~/.config/dagu/config.yaml`

```yaml
# Server Configuration
host: "127.0.0.1"         # Web UI binding host
port: 8080                # Web UI binding port
base_path: ""              # Base path for reverse proxy (e.g., "/dagu")
api_base_path: "/api/v1"    # API endpoint base path
tz: "Asia/Tokyo"          # Server timezone
debug: false              # Debug mode
log_format: "text"         # Log format: "text" or "json"
access_log_mode: "all"     # Access log mode: "all" (default), "non-public", or "none"
headless: false           # Run without Web UI
metrics: "private"        # Metrics endpoint access: "private" (default) or "public"

# Directory Paths (must be under "paths" key)
paths:
  dags_dir: "~/.config/dagu/dags"                    # DAG definitions
  docs_dir: ""                                       # Auto: {dags_dir}/docs
  log_dir: "~/.local/share/dagu/logs"                # Log files
  data_dir: "~/.local/share/dagu/data"               # Application data
  suspend_flags_dir: "~/.local/share/dagu/suspend"    # Suspend flags
  admin_logs_dir: "~/.local/share/dagu/logs/admin"    # Admin logs
  base_config: "~/.config/dagu/base.yaml"            # Base configuration
  dag_runs_dir: ""                                    # Auto: {data_dir}/dag-runs
  queue_dir: ""                                      # Auto: {data_dir}/queue
  proc_dir: ""                                       # Auto: {data_dir}/proc
  executable: ""                                    # Auto: current executable

# Permissions
permissions:
  write_dags: true         # Allow creating/editing/deleting DAGs
  run_dags: true           # Allow running/stopping/retrying DAGs

# Authentication
auth:
  mode: "builtin"              # "none", "basic", or "builtin" (default)

  # Builtin auth (JWT sessions, API keys, and role-based access)
  builtin:
    token:
      secret: "your-secret"    # Auto-generated if not set
      ttl: "24h"

  # Basic auth (simple username/password)
  basic:
    username: "admin"
    password: "secret"

  # OIDC auth (auto-enabled under builtin mode when all required fields are set)
  oidc:
    client_id: "your-client-id"
    client_secret: "your-client-secret"
    client_url: "http://localhost:8080"
    issuer: "https://accounts.google.com"
    scopes: ["openid", "profile", "email"]
    whitelist: ["admin@example.com"]
    # Builtin-specific fields (only used when mode: builtin)
    auto_signup: true                 # Auto-create users on first login
    role_mapping:
      default_role: "viewer"          # Role for new users
    allowed_domains: ["company.com"]  # Allowed email domains
    button_label: "Login with SSO"    # SSO button text

# TLS/HTTPS Configuration
tls:
  cert_file: "/path/to/cert.pem"
  key_file: "/path/to/key.pem"

# UI Customization
ui:
  navbar_color: "#1976d2"        # Header color (hex or name)
  navbar_title: "Dagu"           # Header title
  log_encoding_charset: "utf-8"   # Log file encoding (see reference for supported encodings)
  max_dashboard_page_limit: 100    # Max items on dashboard
  dags:
    sort_field: "name"           # Default sort field (name/status/lastRun/schedule/suspended)
    sort_order: "asc"            # Default sort order (asc/desc)

# Latest Status Configuration
latest_status_today: true         # Show only today's latest status

# Execution Mode
default_execution_mode: "local"      # "local" (default) or "distributed"
                                    # When "distributed", all DAGs dispatch to workers

# Terminal Configuration
terminal:
  enabled: false              # Enable web-based terminal (default: false)
  max_sessions: 5             # Maximum concurrent terminal sessions per server

# Audit Logging
audit:
  enabled: true               # Enable audit logging (default: true)
  retention_days: 7            # Days to keep audit logs (default: 7, 0 = keep forever)

# Session Storage
session:
  max_per_user: 100            # Max sessions per user (default: 100, 0 = unlimited)

# Queue System
queues:
  enabled: true                 # Enable queue system (default: true)
  config:
    - name: "critical"
      max_concurrency: 5          # Maximum concurrent DAG runs
    - name: "batch"
      max_concurrency: 1
    - name: "default"
      max_concurrency: 2

# Remote Nodes
remote_nodes:
  - name: "staging"
    api_base_url: "https://staging.example.com/api/v1"
    is_basic_auth: true
    basic_auth_username: "admin"
    basic_auth_password: "password"
  - name: "production"
    api_base_url: "https://prod.example.com/api/v1"
    is_auth_token: true
    auth_token: "prod-token"
    skip_tls_verify: false
```

## Environment Variables

All options support `DAGU_` prefix:

**Server:**
- `DAGU_HOST` - Host (default: `127.0.0.1`)
- `DAGU_PORT` - Port (default: `8080`)
- `DAGU_TZ` - Timezone
- `DAGU_DEBUG` - Debug mode
- `DAGU_LOG_FORMAT` - Log format (`text`/`json`)
- `DAGU_ACCESS_LOG_MODE` - Access log mode: `all` (default), `non-public`, or `none`
- `DAGU_SERVER_METRICS` - Metrics endpoint access: `private` (default) or `public`

**Paths:**
- `DAGU_HOME` - Set all paths
- `DAGU_DAGS_DIR` - DAGs directory
- `DAGU_LOG_DIR` - Logs
- `DAGU_DATA_DIR` - Data

**Auth:**
- `DAGU_AUTH_MODE` - Auth mode: `none`, `basic`, or `builtin` (default: `builtin`)

*Builtin Auth (RBAC):*
- `DAGU_AUTH_TOKEN_SECRET` - JWT signing secret (auto-generated if not set)
- `DAGU_AUTH_TOKEN_TTL` - JWT token expiry (default: `24h`)

*Basic Auth:*
- `DAGU_AUTH_BASIC_USERNAME` - Basic auth username
- `DAGU_AUTH_BASIC_PASSWORD` - Basic auth password

*OIDC Auth:*
- `DAGU_AUTH_OIDC_CLIENT_ID` - OIDC client ID
- `DAGU_AUTH_OIDC_CLIENT_SECRET` - OIDC client secret
- `DAGU_AUTH_OIDC_CLIENT_URL` - OIDC client URL
- `DAGU_AUTH_OIDC_ISSUER` - OIDC issuer URL
- `DAGU_AUTH_OIDC_SCOPES` - OIDC scopes (comma-separated)
- `DAGU_AUTH_OIDC_WHITELIST` - OIDC email whitelist (comma-separated)
- `DAGU_AUTH_OIDC_AUTO_SIGNUP` - Auto-create users on first login (default: `true`)
- `DAGU_AUTH_OIDC_DEFAULT_ROLE` - Role for auto-created users (default: `viewer`)
- `DAGU_AUTH_OIDC_ALLOWED_DOMAINS` - Allowed email domains (comma-separated)
- `DAGU_AUTH_OIDC_BUTTON_LABEL` - SSO login button text

**UI:**
- `DAGU_UI_DAGS_SORT_FIELD` - Default DAGs page sort field
- `DAGU_UI_DAGS_SORT_ORDER` - Default DAGs page sort order

**Terminal:**
- `DAGU_TERMINAL_ENABLED` - Enable web-based terminal (default: `false`)
- `DAGU_TERMINAL_MAX_SESSIONS` - Maximum concurrent terminal sessions (default: `5`)

**Audit Logging:**
- `DAGU_AUDIT_ENABLED` - Enable audit logging (default: `true`)
- `DAGU_AUDIT_RETENTION_DAYS` - Days to keep audit logs (default: `7`, `0` = keep forever)

**Session Storage:**
- `DAGU_SESSION_MAX_PER_USER` - Max sessions per user (default: `100`, `0` = unlimited)

## Common Setups

### Development
```yaml
host: "127.0.0.1"
port: 8080
debug: true
```

### Production
```yaml
host: "0.0.0.0"
port: 443
permissions:
  write_dags: false
auth:
  mode: builtin
  builtin:
    token:
      secret: "${AUTH_TOKEN_SECRET}"  # auto-generated if not set
      ttl: "24h"
tls:
  cert_file: "/etc/ssl/cert.pem"
  key_file: "/etc/ssl/key.pem"
```

### Docker
```bash
docker run -d \
  -e DAGU_HOST=0.0.0.0 \
  -e DAGU_AUTH_MODE=builtin \
  -e DAGU_AUTH_BUILTIN_INITIAL_ADMIN_USERNAME=admin \
  -e DAGU_AUTH_BUILTIN_INITIAL_ADMIN_PASSWORD=your-secure-password \
  -p 8080:8080 \
  -v dagu-data:/var/lib/dagu \
  ghcr.io/dagu-org/dagu:latest
# Admin auto-created on first startup; omit INITIAL_ADMIN vars to use the /setup page instead
```

## Authentication

### Builtin Auth

Builtin auth provides JWT sessions, initial admin bootstrap, password management, API keys, and the role model used by self-hosted Dagu. On self-hosted Dagu, creating, updating, and deleting additional users requires an active self-host license. Hosted Dagu Cloud includes user management by default. See the [pricing page](https://dagu.sh/pricing) for current self-host and cloud availability. Available roles are `admin`, `manager`, `developer`, `operator`, and `viewer`.

```yaml
auth:
  mode: builtin
  builtin:
    token:
      secret: "${AUTH_TOKEN_SECRET}"  # auto-generated if not set
      ttl: "24h"
    initial_admin:                    # optional — auto-create admin on first startup
      username: admin
      password: "${ADMIN_PASSWORD}"
```

```bash
# Environment variables
export DAGU_AUTH_MODE=builtin
# Token secret auto-generated if not set

# Optional — auto-create admin on first startup (both required together)
export DAGU_AUTH_BUILTIN_INITIAL_ADMIN_USERNAME=admin
export DAGU_AUTH_BUILTIN_INITIAL_ADMIN_PASSWORD=your-secure-password
```

When `initial_admin` is configured and no users exist, the server creates the admin at startup and skips the setup page. The guided script installers can populate these settings for you during setup. When `initial_admin` is not configured, visit the web UI on first startup to create your admin account via the setup page.

See [Builtin Authentication](authentication/builtin) for detailed setup.

### Basic Auth

Simple single-user authentication without user management.

```yaml
auth:
  mode: basic
  basic:
    username: "admin"
    password: "${ADMIN_PASSWORD}"
```

### OIDC Authentication

**Builtin + OIDC** (SSO with user management and RBAC):
```yaml
auth:
  mode: builtin
  builtin:
    token:
      secret: "${AUTH_TOKEN_SECRET}"
  oidc:
    client_id: "${OIDC_CLIENT_ID}"
    client_secret: "${OIDC_CLIENT_SECRET}"
    client_url: "https://dagu.example.com"
    issuer: "https://accounts.google.com"
    auto_signup: true
    role_mapping:
      default_role: viewer
```

See [OIDC Configuration](authentication/oidc) for detailed setup.

### TLS/HTTPS

**Let's Encrypt:**
```bash
certbot certonly --standalone -d dagu.example.com

export DAGU_CERT_FILE=/etc/letsencrypt/live/dagu.example.com/fullchain.pem
export DAGU_KEY_FILE=/etc/letsencrypt/live/dagu.example.com/privkey.pem
```

**Behind Nginx:**
```yaml
# config.yaml
base_path: "/dagu"
host: "127.0.0.1"
port: 8080
```

```nginx
location /dagu/ {
    proxy_pass http://127.0.0.1:8080/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

## UI Customization

```yaml
ui:
  navbar_color: "#1976d2"
  navbar_title: "Workflows"
  log_encoding_charset: "utf-8"
```

Color suggestions:
- Production: `#ff0000` (red)
- Staging: `#ff9800` (orange)
- Development: `#4caf50` (green)

### Log Encoding

The `log_encoding_charset` option specifies the character encoding used to read log files in the UI. This is useful when your DAG steps produce output in non-UTF-8 encodings.

**Common encodings:**
- `utf-8` (default) - Unicode
- `shift_jis`, `euc-jp` - Japanese
- `gb2312`, `gbk`, `gb18030` - Simplified Chinese
- `big5` - Traditional Chinese
- `euc-kr` - Korean
- `iso-8859-1` through `iso-8859-16` - Latin/European
- `windows-1250` through `windows-1258` - Windows code pages
- `koi8-r`, `koi8-u` - Cyrillic

See [Configuration Reference - Supported Log Encodings](/server-admin/reference#supported-log-encodings) for the complete list of 50+ supported encodings.

**Example for Japanese logs:**
```yaml
ui:
  log_encoding_charset: "shift_jis"
```

**Environment variable:**
```bash
export DAGU_UI_LOG_ENCODING_CHARSET="shift_jis"
```

## Remote Nodes

```yaml
remote_nodes:
  - name: "production"
    api_base_url: "https://prod.example.com/api/v1"
    is_basic_auth: true
    basic_auth_username: "admin"
    basic_auth_password: "${PROD_PASSWORD}"

  - name: "staging"
    api_base_url: "https://staging.example.com/api/v1"
    is_auth_token: true
    auth_token: "${STAGING_TOKEN}"
```

## Queues

See [Queue Configuration](/server-admin/queues) for full documentation.

```yaml
queues:
  enabled: true
  config:
    - name: "critical"
      max_concurrency: 5
    - name: "batch"
      max_concurrency: 1
    - name: "default"
      max_concurrency: 2
```

## Base Configuration

`~/.config/dagu/base.yaml` provides shared defaults for all DAGs:

```yaml
mail_on:
  failure: true

smtp:
  host: "smtp.company.com"
  port: "587"
  username: "${SMTP_USER}"
  password: "${SMTP_PASS}"

env:
  - ENVIRONMENT: production
```

See [Base Configuration](/server-admin/base-config) for complete documentation on all available fields and inheritance behavior.

## Metrics Endpoint

Dagu exposes Prometheus metrics at `/api/v1/metrics`. By default, this endpoint requires authentication.

### Configuration

```yaml
# Require authentication (default)
metrics: "private"

# Allow public access (no authentication required)
metrics: "public"
```

Or via environment variable:
```bash
export DAGU_SERVER_METRICS=public
```

### Prometheus Scraping

When metrics is set to `private` (default), configure Prometheus to authenticate:

```yaml
scrape_configs:
  - job_name: 'dagu'
    bearer_token: 'your-api-token'
    static_configs:
      - targets: ['dagu:8080']
    metrics_path: '/api/v1/metrics'
```

Or with basic auth:
```yaml
scrape_configs:
  - job_name: 'dagu'
    basic_auth:
      username: 'admin'
      password: 'secret'
    static_configs:
      - targets: ['dagu:8080']
    metrics_path: '/api/v1/metrics'
```

When metrics is set to `public`, no authentication is needed:
```yaml
scrape_configs:
  - job_name: 'dagu'
    static_configs:
      - targets: ['dagu:8080']
    metrics_path: '/api/v1/metrics'
```

## Cache Configuration

Dagu uses in-memory caches to improve performance. Cache limits can be configured via presets:

```yaml
cache: normal   # options: low, normal, high (default: normal)
```

Or via environment variable:
```bash
export DAGU_CACHE=low
```

### Presets

| Preset | DAG Definitions | DAG Run Status | API Keys | Webhooks |
|--------|-----------------|----------------|----------|----------|
| `low`  | 500 | 5,000 | 100 | 100 |
| `normal` | 1,000 | 10,000 | 500 | 500 |
| `high` | 5,000 | 50,000 | 1,000 | 1,000 |

- **low**: For memory-constrained environments
- **normal**: Balanced for typical deployments (default)
- **high**: For large-scale deployments with many DAGs

TTL (time-to-live): DAG caches expire after 12 hours, API key/webhook caches after 15 minutes.

### Monitoring Cache Usage

Use Prometheus metrics to monitor cache sizes:
```txt
dagu_cache_entries_total
```

See [Prometheus Metrics](/server-admin/prometheus-metrics#cache-metrics) for more details.

## Terminal

The web-based terminal allows executing shell commands directly from the Dagu UI. This feature is **disabled by default** for security reasons.

### Configuration

```yaml
terminal:
  enabled: true
  max_sessions: 5
```

Or via environment variable:
```bash
export DAGU_TERMINAL_ENABLED=true
export DAGU_TERMINAL_MAX_SESSIONS=5
```

### Security Notes

- The terminal runs commands with the same permissions as the Dagu server process
- Only enable in trusted environments where users should have shell access
- Consider using authentication (`auth.mode: builtin`) when enabling terminal access
- New sessions are rejected with HTTP `429` after `terminal.max_sessions` active terminals
- Terminal sessions are logged in the audit log (when audit logging is enabled)

## Audit Logging

::: info Self-Host License
On self-hosted Dagu, audit logging requires an active self-host license. Hosted Dagu Cloud includes audit logging by default. See the [pricing page](https://dagu.sh/pricing) for current self-host and cloud availability.
:::

Dagu maintains audit logs for security-sensitive operations. Audit logging is **enabled by default**.

### Configuration

```yaml
audit:
  enabled: true   # Enable audit logging (default: true)
```

Or via environment variable:
```bash
export DAGU_AUDIT_ENABLED=false
export DAGU_AUDIT_RETENTION_DAYS=30
```

### Retention

Audit log files are automatically cleaned up based on the `retention_days` setting:

- **Default**: 7 days (keeps today plus the 7 previous days)
- **Disable cleanup**: Set to `0` to keep logs forever
- Cleanup runs on startup, then every 24 hours
- Dates are evaluated in UTC
- Only files matching the `YYYY-MM-DD.jsonl` naming pattern are affected

### Logged Events

When enabled, the following events are recorded:
- **Authentication**: Login attempts (success/failure), password changes
- **User Management**: User creation, updates, deletion
- **API Keys**: Key creation, updates, deletion
- **Webhooks**: Webhook creation, deletion, token regeneration
- **Terminal**: Shell command executions

### Storage

Audit logs are stored as daily JSONL files in `{admin_logs_dir}/audit/`:
```
~/.local/share/dagu/logs/admin/audit/
├── 2025-01-10.jsonl
├── 2025-01-11.jsonl
└── ...
```

Logs can be viewed through the web UI at Settings > Audit Logs.

## Session Storage

Agent chat sessions are stored as JSON files per user. To prevent unbounded disk growth, sessions are automatically cleaned up when a per-user limit is exceeded.

### Configuration

```yaml
session:
  max_per_user: 100   # Max sessions per user (default: 100, 0 = unlimited)
```

Or via environment variable:
```bash
export DAGU_SESSION_MAX_PER_USER=50
```

### Cleanup Behavior

- When a new session is created and the user exceeds the limit, the oldest sessions are deleted
- Sub-sessions (created by delegate agents) are deleted together with their parent session and do not count toward the limit
- Set to `0` to disable cleanup (keep all sessions)

## See Also

- [Set up authentication](#authentication) for secure access
- [Configure remote nodes](#remote-nodes) for multi-environment management
- [Customize the UI](#ui-customization) for your organization
- [Enable HTTPS](#tlshttps-configuration) for encrypted connections
- [Configure terminal access](#terminal) for shell access
- [Configure audit logging](#audit-logging) for security monitoring
- [Prometheus Metrics](/server-admin/prometheus-metrics) for monitoring
