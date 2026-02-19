# Server Configuration

Configure Boltbase server settings.

## Configuration Methods

Precedence order:
1. Command-line flags (highest)
2. Environment variables (`BOLTBASE_` prefix)
3. Configuration file (lowest)

```bash
# CLI flag wins
boltbase start-all --port=8000

# Even with env var
export BOLTBASE_PORT=8080

# And config file
port: 7000
```

## Configuration File

Location: `~/.config/boltbase/config.yaml`

```yaml
# Server Configuration
host: "127.0.0.1"         # Web UI binding host
port: 8080                # Web UI binding port
base_path: ""              # Base path for reverse proxy (e.g., "/boltbase")
api_base_path: "/api/v1"    # API endpoint base path
tz: "Asia/Tokyo"          # Server timezone
debug: false              # Debug mode
log_format: "text"         # Log format: "text" or "json"
headless: false           # Run without Web UI
metrics: "private"        # Metrics endpoint access: "private" (default) or "public"

# Directory Paths (must be under "paths" key)
paths:
  dags_dir: "~/.config/boltbase/dags"                    # DAG definitions
  log_dir: "~/.local/share/boltbase/logs"                # Log files
  data_dir: "~/.local/share/boltbase/data"               # Application data
  suspend_flags_dir: "~/.local/share/boltbase/suspend"    # Suspend flags
  admin_logs_dir: "~/.local/share/boltbase/logs/admin"    # Admin logs
  base_config: "~/.config/boltbase/base.yaml"            # Base configuration
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

  # Builtin auth (user management with RBAC)
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
    default_role: "viewer"            # Role for new users
    allowed_domains: ["company.com"]  # Allowed email domains
    button_label: "Login with SSO"    # SSO button text

# TLS/HTTPS Configuration
tls:
  cert_file: "/path/to/cert.pem"
  key_file: "/path/to/key.pem"

# UI Customization
ui:
  navbar_color: "#1976d2"        # Header color (hex or name)
  navbar_title: "Boltbase"           # Header title
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

# Audit Logging
audit:
  enabled: true               # Enable audit logging (default: true)
  retention_days: 7            # Days to keep audit logs (default: 7, 0 = keep forever)

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

All options support `BOLTBASE_` prefix:

**Server:**
- `BOLTBASE_HOST` - Host (default: `127.0.0.1`)
- `BOLTBASE_PORT` - Port (default: `8080`)
- `BOLTBASE_TZ` - Timezone
- `BOLTBASE_DEBUG` - Debug mode
- `BOLTBASE_LOG_FORMAT` - Log format (`text`/`json`)
- `BOLTBASE_SERVER_METRICS` - Metrics endpoint access: `private` (default) or `public`

**Paths:**
- `BOLTBASE_HOME` - Set all paths
- `BOLTBASE_DAGS_DIR` - DAGs directory
- `BOLTBASE_LOG_DIR` - Logs
- `BOLTBASE_DATA_DIR` - Data

**Auth:**
- `BOLTBASE_AUTH_MODE` - Auth mode: `none`, `basic`, or `builtin` (default: `builtin`)

*Builtin Auth (RBAC):*
- `BOLTBASE_AUTH_TOKEN_SECRET` - JWT signing secret (auto-generated if not set)
- `BOLTBASE_AUTH_TOKEN_TTL` - JWT token expiry (default: `24h`)

*Basic Auth:*
- `BOLTBASE_AUTH_BASIC_USERNAME` - Basic auth username
- `BOLTBASE_AUTH_BASIC_PASSWORD` - Basic auth password

*OIDC Auth:*
- `BOLTBASE_AUTH_OIDC_CLIENT_ID` - OIDC client ID
- `BOLTBASE_AUTH_OIDC_CLIENT_SECRET` - OIDC client secret
- `BOLTBASE_AUTH_OIDC_CLIENT_URL` - OIDC client URL
- `BOLTBASE_AUTH_OIDC_ISSUER` - OIDC issuer URL
- `BOLTBASE_AUTH_OIDC_SCOPES` - OIDC scopes (comma-separated)
- `BOLTBASE_AUTH_OIDC_WHITELIST` - OIDC email whitelist (comma-separated)
- `BOLTBASE_AUTH_OIDC_AUTO_SIGNUP` - Auto-create users on first login (default: `false`)
- `BOLTBASE_AUTH_OIDC_DEFAULT_ROLE` - Role for auto-created users (default: `viewer`)
- `BOLTBASE_AUTH_OIDC_ALLOWED_DOMAINS` - Allowed email domains (comma-separated)
- `BOLTBASE_AUTH_OIDC_BUTTON_LABEL` - SSO login button text

**UI:**
- `BOLTBASE_UI_DAGS_SORT_FIELD` - Default DAGs page sort field
- `BOLTBASE_UI_DAGS_SORT_ORDER` - Default DAGs page sort order

**Terminal:**
- `BOLTBASE_TERMINAL_ENABLED` - Enable web-based terminal (default: `false`)

**Audit Logging:**
- `BOLTBASE_AUDIT_ENABLED` - Enable audit logging (default: `true`)
- `BOLTBASE_AUDIT_RETENTION_DAYS` - Days to keep audit logs (default: `7`, `0` = keep forever)

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
  -e BOLTBASE_HOST=0.0.0.0 \
  -e BOLTBASE_AUTH_MODE=builtin \
  -p 8080:8080 \
  -v boltbase-data:/var/lib/boltbase \
  ghcr.io/dagu-org/boltbase:latest
# First admin account created via /setup page on first visit
```

## Authentication

### Builtin Auth

User management with role-based access control (RBAC). Supports multiple users with roles: `admin`, `manager`, `operator`, `viewer`.

```yaml
auth:
  mode: builtin
  builtin:
    token:
      secret: "${AUTH_TOKEN_SECRET}"  # auto-generated if not set
      ttl: "24h"
```

```bash
# Environment variables
export BOLTBASE_AUTH_MODE=builtin
# Token secret auto-generated if not set
```

On first startup, visit the web UI to create your admin account via the setup page.

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
    client_url: "https://boltbase.example.com"
    issuer: "https://accounts.google.com"
    auto_signup: true
    default_role: viewer
```

See [OIDC Configuration](authentication/oidc) for detailed setup.

### TLS/HTTPS

**Let's Encrypt:**
```bash
certbot certonly --standalone -d boltbase.example.com

export BOLTBASE_CERT_FILE=/etc/letsencrypt/live/boltbase.example.com/fullchain.pem
export BOLTBASE_KEY_FILE=/etc/letsencrypt/live/boltbase.example.com/privkey.pem
```

**Behind Nginx:**
```yaml
# config.yaml
base_path: "/boltbase"
host: "127.0.0.1"
port: 8080
```

```nginx
location /boltbase/ {
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

See [Configuration Reference - Supported Log Encodings](/configurations/reference#supported-log-encodings) for the complete list of 50+ supported encodings.

**Example for Japanese logs:**
```yaml
ui:
  log_encoding_charset: "shift_jis"
```

**Environment variable:**
```bash
export BOLTBASE_UI_LOG_ENCODING_CHARSET="shift_jis"
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

`~/.config/boltbase/base.yaml` provides shared defaults for all DAGs:

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

See [Base Configuration](/configurations/base-config) for complete documentation on all available fields and inheritance behavior.

## Metrics Endpoint

Boltbase exposes Prometheus metrics at `/api/v1/metrics`. By default, this endpoint requires authentication.

### Configuration

```yaml
# Require authentication (default)
metrics: "private"

# Allow public access (no authentication required)
metrics: "public"
```

Or via environment variable:
```bash
export BOLTBASE_SERVER_METRICS=public
```

### Prometheus Scraping

When metrics is set to `private` (default), configure Prometheus to authenticate:

```yaml
scrape_configs:
  - job_name: 'boltbase'
    bearer_token: 'your-api-token'
    static_configs:
      - targets: ['boltbase:8080']
    metrics_path: '/api/v1/metrics'
```

Or with basic auth:
```yaml
scrape_configs:
  - job_name: 'boltbase'
    basic_auth:
      username: 'admin'
      password: 'secret'
    static_configs:
      - targets: ['boltbase:8080']
    metrics_path: '/api/v1/metrics'
```

When metrics is set to `public`, no authentication is needed:
```yaml
scrape_configs:
  - job_name: 'boltbase'
    static_configs:
      - targets: ['boltbase:8080']
    metrics_path: '/api/v1/metrics'
```

## Cache Configuration

Boltbase uses in-memory caches to improve performance. Cache limits can be configured via presets:

```yaml
cache: normal   # options: low, normal, high (default: normal)
```

Or via environment variable:
```bash
export BOLTBASE_CACHE=low
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
boltbase_cache_entries_total
```

See [Prometheus Metrics](/features/prometheus-metrics#cache-metrics) for more details.

## Terminal

The web-based terminal allows executing shell commands directly from the Boltbase UI. This feature is **disabled by default** for security reasons.

### Configuration

```yaml
terminal:
  enabled: true   # Enable web-based terminal (default: false)
```

Or via environment variable:
```bash
export BOLTBASE_TERMINAL_ENABLED=true
```

### Security Notes

- The terminal runs commands with the same permissions as the Boltbase server process
- Only enable in trusted environments where users should have shell access
- Consider using authentication (`auth.mode: builtin`) when enabling terminal access
- Terminal sessions are logged in the audit log (when audit logging is enabled)

## Audit Logging

Boltbase maintains audit logs for security-sensitive operations. Audit logging is **enabled by default**.

### Configuration

```yaml
audit:
  enabled: true   # Enable audit logging (default: true)
```

Or via environment variable:
```bash
export BOLTBASE_AUDIT_ENABLED=false
export BOLTBASE_AUDIT_RETENTION_DAYS=30
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
~/.local/share/boltbase/logs/admin/audit/
├── 2025-01-10.jsonl
├── 2025-01-11.jsonl
└── ...
```

Logs can be viewed through the web UI at Settings > Audit Logs.

## See Also

- [Set up authentication](#authentication) for secure access
- [Configure remote nodes](#remote-nodes) for multi-environment management
- [Customize the UI](#ui-customization) for your organization
- [Enable HTTPS](#tlshttps-configuration) for encrypted connections
- [Configure terminal access](#terminal) for shell access
- [Configure audit logging](#audit-logging) for security monitoring
- [Prometheus Metrics](/features/prometheus-metrics) for monitoring
