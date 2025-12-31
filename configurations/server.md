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
apiBasePath: "/api/v2"    # API endpoint base path
tz: "Asia/Tokyo"          # Server timezone
debug: false              # Debug mode
logFormat: "text"         # Log format: "text" or "json"
headless: false           # Run without Web UI
metrics: "private"        # Metrics endpoint access: "private" (default) or "public"

# Directory Paths (must be under "paths" key)
paths:
  dagsDir: "~/.config/dagu/dags"                    # DAG definitions
  logDir: "~/.local/share/dagu/logs"                # Log files
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

  # OIDC auth
  oidc:
    clientId: "your-client-id"
    clientSecret: "your-client-secret"
    clientUrl: "http://localhost:8080"
    issuer: "https://accounts.google.com"
    scopes: ["openid", "profile", "email"]
    whitelist: ["admin@example.com"]

# TLS/HTTPS Configuration
tls:
  certFile: "/path/to/cert.pem"
  keyFile: "/path/to/key.pem"

# UI Customization
ui:
  navbarColor: "#1976d2"        # Header color (hex or name)
  navbarTitle: "Dagu"           # Header title
  logEncodingCharset: "utf-8"   # Log file encoding (supports 50+ encodings, see below)
  maxDashboardPageLimit: 100    # Max items on dashboard
  dags:
    sortField: "name"           # Default sort field (name/status/lastRun/schedule/suspended)
    sortOrder: "asc"            # Default sort order (asc/desc)

# Latest Status Configuration
latestStatusToday: true         # Show only today's latest status

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
    apiBaseURL: "https://staging.example.com/api/v2"
    isBasicAuth: true
    basicAuthUsername: "admin"
    basicAuthPassword: "password"
  - name: "production"
    apiBaseURL: "https://prod.example.com/api/v2"
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

**UI:**
- `DAGU_UI_DAGS_SORT_FIELD` - Default DAGs page sort field
- `DAGU_UI_DAGS_SORT_ORDER` - Default DAGs page sort order

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

### Builtin Auth (Recommended)

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
  http://localhost:8080/api/v2/dags
```

### OIDC Authentication
```yaml
auth:
  oidc:
    clientId: "${OIDC_CLIENT_ID}"
    clientSecret: "${OIDC_CLIENT_SECRET}"
    clientUrl: "https://dagu.example.com"
    issuer: "https://accounts.google.com"
    scopes:
      - "email"
    whitelist:
      - "admin@dagu.example.com" # Optional: restrict to specific emails
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
    apiBaseURL: "https://prod.example.com/api/v2"
    isBasicAuth: true
    basicAuthUsername: "admin"
    basicAuthPassword: "${PROD_PASSWORD}"
    
  - name: "staging"
    apiBaseURL: "https://staging.example.com/api/v2"
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

`~/.config/dagu/base.yaml` - Shared DAG settings:

```yaml
mailOn:
  failure: true

smtp:
  host: "smtp.company.com"
  port: "587"
  username: "${SMTP_USER}"
  password: "${SMTP_PASS}"

env:
  - ENVIRONMENT: production
```

## Metrics Endpoint

Dagu exposes Prometheus metrics at `/api/v2/metrics`. By default, this endpoint requires authentication.

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
    metrics_path: '/api/v2/metrics'
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
    metrics_path: '/api/v2/metrics'
```

When metrics is set to `public`, no authentication is needed:
```yaml
scrape_configs:
  - job_name: 'dagu'
    static_configs:
      - targets: ['dagu:8080']
    metrics_path: '/api/v2/metrics'
```

## See Also

- [Set up authentication](#authentication) for secure access
- [Configure remote nodes](#remote-nodes) for multi-environment management
- [Customize the UI](#ui-customization) for your organization
- [Enable HTTPS](#tlshttps-configuration) for encrypted connections
