# Server Configuration

Configure Dagu server settings.

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
basePath: ""              # Base path for reverse proxy (e.g., "/dagu")
apiBasePath: "/api/v1"    # API endpoint base path
tz: "Asia/Tokyo"          # Server timezone
debug: false              # Debug mode
logFormat: "text"         # Log format: "text" or "json"
headless: false           # Run without Web UI
metrics: "private"        # Metrics endpoint access: "private" (default) or "public"

# Directory Paths (must be under "paths" key)
paths:
  dagsDir: "~/.config/dagu/dags"                    # DAG definitions
  log_dir: "~/.local/share/dagu/logs"                # Log files
  dataDir: "~/.local/share/dagu/data"               # Application data
  suspendFlagsDir: "~/.local/share/dagu/suspend"    # Suspend flags
  adminLogsDir: "~/.local/share/dagu/logs/admin"    # Admin logs
  baseConfig: "~/.config/dagu/base.yaml"            # Base configuration
  dagRunsDir: ""                                    # Auto: {dataDir}/dag-runs
  queueDir: ""                                      # Auto: {dataDir}/queue
  procDir: ""                                       # Auto: {dataDir}/proc
  executable: ""                                    # Auto: current executable

# Permissions
permissions:
  writeDAGs: true         # Allow creating/editing/deleting DAGs
  runDAGs: true           # Allow running/stopping/retrying DAGs

# Authentication
auth:
  mode: "builtin"              # "none", "builtin", or "oidc"

  # Builtin auth (user management with RBAC)
  builtin:
    admin:
      username: "admin"
      password: ""             # Auto-generated if empty
    token:
      secret: "your-secret"    # Required for JWT signing
      ttl: "24h"

  # Basic auth (simple username/password)
  basic:
    username: "admin"
    password: "secret"

  # Token auth (API token)
  token:
    value: "your-secret-token"

  # OIDC auth (standalone or under builtin mode)
  oidc:
    clientId: "your-client-id"
    clientSecret: "your-client-secret"
    clientUrl: "http://localhost:8080"
    issuer: "https://accounts.google.com"
    scopes: ["openid", "profile", "email"]
    whitelist: ["admin@example.com"]
    # Builtin-specific fields (only used when mode: builtin)
    # enabled: true                  # Optional - auto-enabled when required fields are set
    autoSignup: true                 # Auto-create users on first login
    defaultRole: "viewer"            # Role for new users
    allowedDomains: ["company.com"]  # Allowed email domains
    buttonLabel: "Login with SSO"    # SSO button text

# TLS/HTTPS Configuration
tls:
  certFile: "/path/to/cert.pem"
  keyFile: "/path/to/key.pem"

# UI Customization
ui:
  navbarColor: "#1976d2"        # Header color (hex or name)
  navbarTitle: "Dagu"           # Header title
  logEncodingCharset: "utf-8"   # Log file encoding (see reference for supported encodings)
  maxDashboardPageLimit: 100    # Max items on dashboard
  dags:
    sortField: "name"           # Default sort field (name/status/lastRun/schedule/suspended)
    sortOrder: "asc"            # Default sort order (asc/desc)

# Latest Status Configuration
latestStatusToday: true         # Show only today's latest status

# Execution Mode
defaultExecutionMode: "local"      # "local" (default) or "distributed"
                                    # When "distributed", all DAGs dispatch to workers

# Terminal Configuration
terminal:
  enabled: false              # Enable web-based terminal (default: false)

# Audit Logging
audit:
  enabled: true               # Enable audit logging (default: true)
  retentionDays: 7            # Days to keep audit logs (default: 7, 0 = keep forever)

# Queue System
queues:
  enabled: true                 # Enable queue system (default: true)
  config:
    - name: "critical"
      maxConcurrency: 5          # Maximum concurrent DAG runs
    - name: "batch"
      maxConcurrency: 1
    - name: "default"
      maxConcurrency: 2

# Remote Nodes
remoteNodes:
  - name: "staging"
    apiBaseURL: "https://staging.example.com/api/v1"
    isBasicAuth: true
    basicAuthUsername: "admin"
    basicAuthPassword: "password"
  - name: "production"
    apiBaseURL: "https://prod.example.com/api/v1"
    isAuthToken: true
    authToken: "prod-token"
    skipTLSVerify: false
```

## Environment Variables

All options support `DAGU_` prefix:

**Server:**
- `DAGU_HOST` - Host (default: `127.0.0.1`)
- `DAGU_PORT` - Port (default: `8080`)
- `DAGU_TZ` - Timezone
- `DAGU_DEBUG` - Debug mode
- `DAGU_LOG_FORMAT` - Log format (`text`/`json`)
- `DAGU_SERVER_METRICS` - Metrics endpoint access: `private` (default) or `public`

**Paths:**
- `DAGU_HOME` - Set all paths
- `DAGU_DAGS_DIR` - DAGs directory
- `DAGU_LOG_DIR` - Logs
- `DAGU_DATA_DIR` - Data

**Auth:**
- `DAGU_AUTH_MODE` - Auth mode: `none`, `builtin`, or `oidc` (default: `none`)

*Builtin Auth (RBAC):*
- `DAGU_AUTH_TOKEN_SECRET` - JWT signing secret (required)
- `DAGU_AUTH_TOKEN_TTL` - JWT token expiry (default: `24h`)
- `DAGU_AUTH_ADMIN_USERNAME` - Initial admin username (default: `admin`)
- `DAGU_AUTH_ADMIN_PASSWORD` - Initial admin password (auto-generated if empty)

*Basic Auth:*
- `DAGU_AUTH_BASIC_USERNAME` - Basic auth username
- `DAGU_AUTH_BASIC_PASSWORD` - Basic auth password

*Token Auth:*
- `DAGU_AUTH_TOKEN` - API token

*OIDC Auth:*
- `DAGU_AUTH_OIDC_CLIENT_ID` - OIDC client ID
- `DAGU_AUTH_OIDC_CLIENT_SECRET` - OIDC client secret
- `DAGU_AUTH_OIDC_CLIENT_URL` - OIDC client URL
- `DAGU_AUTH_OIDC_ISSUER` - OIDC issuer URL
- `DAGU_AUTH_OIDC_SCOPES` - OIDC scopes (comma-separated)
- `DAGU_AUTH_OIDC_WHITELIST` - OIDC email whitelist (comma-separated)
- `DAGU_AUTH_OIDC_ENABLED` - Enable OIDC under builtin auth (default: `false`)
- `DAGU_AUTH_OIDC_AUTO_SIGNUP` - Auto-create users on first login (default: `false`)
- `DAGU_AUTH_OIDC_DEFAULT_ROLE` - Role for auto-created users (default: `viewer`)
- `DAGU_AUTH_OIDC_ALLOWED_DOMAINS` - Allowed email domains (comma-separated)
- `DAGU_AUTH_OIDC_BUTTON_LABEL` - SSO login button text

**UI:**
- `DAGU_UI_DAGS_SORT_FIELD` - Default DAGs page sort field
- `DAGU_UI_DAGS_SORT_ORDER` - Default DAGs page sort order

**Terminal:**
- `DAGU_TERMINAL_ENABLED` - Enable web-based terminal (default: `false`)

**Audit Logging:**
- `DAGU_AUDIT_ENABLED` - Enable audit logging (default: `true`)
- `DAGU_AUDIT_RETENTION_DAYS` - Days to keep audit logs (default: `7`, `0` = keep forever)

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
  writeDAGs: false
auth:
  mode: builtin
  builtin:
    admin:
      username: "admin"
      password: "${ADMIN_PASSWORD}"
    token:
      secret: "${AUTH_TOKEN_SECRET}"
      ttl: "24h"
tls:
  certFile: "/etc/ssl/cert.pem"
  keyFile: "/etc/ssl/key.pem"
```

### Docker
```bash
docker run -d \
  -e DAGU_HOST=0.0.0.0 \
  -e DAGU_AUTH_MODE=builtin \
  -e DAGU_AUTH_TOKEN_SECRET=your-secure-secret \
  -p 8080:8080 \
  -v dagu-data:/var/lib/dagu \
  ghcr.io/dagu-org/dagu:latest
# Admin password auto-generated on first run, check logs
```

## Authentication

### Builtin Auth

User management with role-based access control (RBAC). Supports multiple users with roles: `admin`, `manager`, `operator`, `viewer`.

```yaml
auth:
  mode: builtin
  builtin:
    admin:
      username: "admin"
      password: ""  # Auto-generated if empty
    token:
      secret: "${AUTH_TOKEN_SECRET}"  # Required
      ttl: "24h"
```

```bash
# Environment variables
export DAGU_AUTH_MODE=builtin
export DAGU_AUTH_TOKEN_SECRET=your-secure-secret
# Password auto-generated on first run, printed to stdout
```

On first startup, an admin user is created. If no password is set, one is auto-generated and printed to stdout. Use the web UI to manage users and change passwords.

See [Builtin Authentication](authentication/builtin) for detailed setup.

### Basic Auth

Simple single-user authentication without user management.

```yaml
auth:
  basic:
    username: "admin"
    password: "${ADMIN_PASSWORD}"
```

### API Token
```yaml
auth:
  token:
    value: "${API_TOKEN}"
```

```bash
curl -H "Authorization: Bearer your-token" \
  http://localhost:8080/api/v1/dags
```

### OIDC Authentication

**Standalone OIDC** (all users get admin role):
```yaml
auth:
  mode: oidc
  oidc:
    clientId: "${OIDC_CLIENT_ID}"
    clientSecret: "${OIDC_CLIENT_SECRET}"
    clientUrl: "https://dagu.example.com"
    issuer: "https://accounts.google.com"
```

**Builtin + OIDC** (recommended, with RBAC):
```yaml
auth:
  mode: builtin
  builtin:
    token:
      secret: "${AUTH_TOKEN_SECRET}"
  oidc:
    enabled: true
    clientId: "${OIDC_CLIENT_ID}"
    clientSecret: "${OIDC_CLIENT_SECRET}"
    clientUrl: "https://dagu.example.com"
    issuer: "https://accounts.google.com"
    autoSignup: true
    defaultRole: viewer
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
basePath: "/dagu"
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
  navbarColor: "#1976d2"
  navbarTitle: "Workflows"
  logEncodingCharset: "utf-8"
```

Color suggestions:
- Production: `#ff0000` (red)
- Staging: `#ff9800` (orange)
- Development: `#4caf50` (green)

### Log Encoding

The `logEncodingCharset` option specifies the character encoding used to read log files in the UI. This is useful when your DAG steps produce output in non-UTF-8 encodings.

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
  logEncodingCharset: "shift_jis"
```

**Environment variable:**
```bash
export DAGU_UI_LOG_ENCODING_CHARSET="shift_jis"
```

## Remote Nodes

```yaml
remoteNodes:
  - name: "production"
    apiBaseURL: "https://prod.example.com/api/v1"
    isBasicAuth: true
    basicAuthUsername: "admin"
    basicAuthPassword: "${PROD_PASSWORD}"
    
  - name: "staging"
    apiBaseURL: "https://staging.example.com/api/v1"
    isAuthToken: true
    authToken: "${STAGING_TOKEN}"
```

## Queues

```yaml
queues:
  enabled: true
  config:
    - name: "critical"
      maxConcurrency: 5
    - name: "batch"
      maxConcurrency: 1
    - name: "default"
      maxConcurrency: 2
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

See [Base Configuration](/configurations/base-config) for complete documentation on all available fields and inheritance behavior.

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

See [Prometheus Metrics](/features/prometheus-metrics#cache-metrics) for more details.

## Terminal

The web-based terminal allows executing shell commands directly from the Dagu UI. This feature is **disabled by default** for security reasons.

### Configuration

```yaml
terminal:
  enabled: true   # Enable web-based terminal (default: false)
```

Or via environment variable:
```bash
export DAGU_TERMINAL_ENABLED=true
```

### Security Notes

- The terminal runs commands with the same permissions as the Dagu server process
- Only enable in trusted environments where users should have shell access
- Consider using authentication (`auth.mode: builtin`) when enabling terminal access
- Terminal sessions are logged in the audit log (when audit logging is enabled)

## Audit Logging

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

Audit log files are automatically cleaned up based on the `retentionDays` setting:

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

Audit logs are stored as daily JSONL files in `{adminLogsDir}/audit/`:
```
~/.local/share/dagu/logs/admin/audit/
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
