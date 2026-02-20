# Configuration Reference

All Dagu configuration options.

## Configuration File

Default: `~/.config/dagu/config.yaml`

```yaml
# Server
host: "127.0.0.1"
port: 8080
base_path: ""              # For reverse proxy (e.g., "/dagu")
api_base_path: "/api/v1"    # API endpoint base path
tz: "America/New_York"
debug: false
log_format: "text"         # "text" or "json"
headless: false
skip_examples: false       # Skip creating example DAGs
metrics: "private"        # Metrics endpoint: "private" (default) or "public"

# Terminal (web-based shell access)
terminal:
  enabled: false          # Enable web terminal (default: false)

# Audit Logging
audit:
  enabled: true           # Enable audit logging (default: true)
  retention_days: 7        # Days to keep audit logs (default: 7, 0 = keep forever)

# Directories (must be under "paths" key)
paths:
  dags_dir: "~/.config/dagu/dags"
  log_dir: "~/.local/share/dagu/logs"
  data_dir: "~/.local/share/dagu/data"
  suspend_flags_dir: "~/.local/share/dagu/suspend"
  admin_logs_dir: "~/.local/share/dagu/logs/admin"
  base_config: "~/.config/dagu/base.yaml"
  dag_runs_dir: ""            # Auto: {data_dir}/dag-runs
  queue_dir: ""              # Auto: {data_dir}/queue
  proc_dir: ""               # Auto: {data_dir}/proc
  service_registry_dir: ""    # Auto: {data_dir}/service-registry
  executable: ""            # Auto: current executable path

# Permissions
permissions:
  write_dags: true         # Create/edit/delete DAGs
  run_dags: true           # Run/stop/retry DAGs

# Authentication
auth:
  mode: "builtin"          # "none", "basic", or "builtin" (default)

  # Builtin auth (user management with RBAC)
  builtin:
    token:
      secret: "your-secret-key"  # Auto-generated if not set
      ttl: "24h"

  # Basic auth (simple username/password)
  basic:
    username: "admin"
    password: "secret"

  # OIDC auth (auto-enabled under builtin mode when all required fields are set)
  oidc:
    client_id: "your-client-id"
    client_secret: "your-client-secret"
    client_url: "https://dagu.example.com"
    issuer: "https://accounts.google.com"
    scopes: ["openid", "profile", "email"]
    # Builtin-specific settings (only when mode=builtin)
    auto_signup: false        # Auto-create users on first login
    default_role: "viewer"    # Role for new users
    allowed_domains: []       # Restrict by email domain
    button_label: "Login with SSO"

# TLS/HTTPS
tls:
  cert_file: "/path/to/cert.pem"
  key_file: "/path/to/key.pem"

# UI
ui:
  navbar_color: "#1976d2"     # Hex or CSS color
  navbar_title: "Dagu"
  log_encoding_charset: "utf-8"  # Character encoding for log files (see supported encodings below)
  max_dashboard_page_limit: 100
  dags:
    sort_field: "name"        # Default sort field (name/status/lastRun/schedule/suspended)
    sort_order: "asc"         # Default sort order (asc/desc)

latest_status_today: true      # Show only today's status

# Execution
default_execution_mode: "local"  # "local" (default) or "distributed"

# Queues
queues:
  enabled: true          # Default: true
  config:
    - name: "critical"
      max_concurrency: 5   # Maximum concurrent DAG runs
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

# Coordinator (for distributed execution)
coordinator:
  enabled: true           # Enable coordinator (default: true)
  host: "127.0.0.1"       # Bind address
  port: 50055             # gRPC port

# Worker (for distributed execution)
worker:
  id: ""                  # Worker ID (default: hostname@PID)
  max_active_runs: 100      # Max parallel task executions
  labels:                 # Worker capabilities
    gpu: "false"
    memory: "16G"
    region: "us-east-1"
  postgres_pool:           # PostgreSQL connection pool (shared-nothing mode only)
    max_open_conns: 25      # Total connections across ALL PostgreSQL DSNs (default: 25)
    max_idle_conns: 5       # Idle connections per DSN (default: 5)
    conn_max_lifetime: 300  # Connection lifetime in seconds (default: 300)
    conn_max_idle_time: 60   # Idle connection timeout in seconds (default: 60)

# Peer TLS configuration (for distributed execution)
peer:
  insecure: true          # Use h2c instead of TLS (default: true)
  cert_file: ""            # TLS certificate for peer connections
  key_file: ""             # TLS key for peer connections
  client_ca_file: ""        # CA certificate for peer verification (mTLS)
  skip_tls_verify: false    # Skip TLS certificate verification

# Scheduler
scheduler:
  port: 8090              # Health check port (0 to disable)
  lock_stale_threshold: "30s"  # Time after which a scheduler lock is considered stale
  lock_retry_interval: "5s"   # Interval between lock acquisition attempts
  zombie_detection_interval: "45s"  # Interval for detecting zombie DAG runs (0 to disable)

# Resource Monitoring
monitoring:
  retention: "24h"        # How long to keep resource history (default: 24h)
  interval: "5s"          # How often to collect metrics (default: 5s)
```

## Environment Variables

All options support `DAGU_` prefix.

**Note:** For security, Dagu filters which system environment variables are passed to step processes and sub DAGs. System variables are available for expansion (`${VAR}`) in DAG configuration, but only whitelisted variables (`PATH`, `HOME`, `LANG`, `TZ`, `SHELL`) and variables with allowed prefixes (`DAGU_*`, `LC_*`, `DAG_*`) are passed to the step execution environment. See [Operations - Security](/configurations/operations#security) for details.

### Server
- `DAGU_HOST` - Server host (default: `127.0.0.1`)
- `DAGU_PORT` - Server port (default: `8080`)
- `DAGU_BASE_PATH` - Base path for reverse proxy
- `DAGU_API_BASE_URL` - **DEPRECATED** - Use `api_base_path` config instead
- `DAGU_TZ` - Server timezone
- `DAGU_DEBUG` - Enable debug mode
- `DAGU_LOG_FORMAT` - Log format (`text`/`json`)
- `DAGU_HEADLESS` - Run without UI
- `DAGU_LATEST_STATUS_TODAY` - Show only today's status
- `DAGU_SKIP_EXAMPLES` - Skip automatic creation of example DAGs (default: `false`)
- `DAGU_SERVER_METRICS` - Metrics endpoint access: `private` (default) or `public`

### Terminal
- `DAGU_TERMINAL_ENABLED` - Enable web-based terminal (default: `false`)

### Audit Logging
- `DAGU_AUDIT_ENABLED` - Enable audit logging (default: `true`)
- `DAGU_AUDIT_RETENTION_DAYS` - Days to keep audit logs (default: `7`, `0` = keep forever)

### Directories
- `DAGU_HOME` - Set all directories to this path (can be overridden by `--dagu-home` flag)
- `DAGU_DAGS_DIR` - DAG definitions
- `DAGU_DAGS` - Alternative to `DAGU_DAGS_DIR`
- `DAGU_LOG_DIR` - Log files
- `DAGU_DATA_DIR` - Application data
- `DAGU_SUSPEND_FLAGS_DIR` - Suspend flags
- `DAGU_ADMIN_LOG_DIR` - Admin logs
- `DAGU_BASE_CONFIG` - Base configuration
- `DAGU_DAG_RUNS_DIR` - DAG run data directory
- `DAGU_QUEUE_DIR` - Queue data directory
- `DAGU_PROC_DIR` - Process data directory
- `DAGU_SERVICE_REGISTRY_DIR` - Service registry data directory
- `DAGU_EXECUTABLE` - Path to Dagu executable

**Note:** The `--dagu-home` CLI flag takes precedence over the `DAGU_HOME` environment variable.

### Authentication
- `DAGU_AUTH_MODE` - Authentication mode: `none`, `basic`, or `builtin` (default: `builtin`)

#### Builtin Auth (RBAC)
- `DAGU_AUTH_TOKEN_SECRET` - JWT signing secret (auto-generated if not set)
- `DAGU_AUTH_TOKEN_TTL` - JWT token expiry (default: `24h`)
- `DAGU_USERS_DIR` - User data directory (default: `{data_dir}/users`)

#### Basic Auth
- `DAGU_AUTH_BASIC_USERNAME` - Basic auth username
- `DAGU_AUTH_BASIC_PASSWORD` - Basic auth password

#### OIDC Auth
OIDC settings (used under builtin auth mode, auto-enabled when all required fields are set):
- `DAGU_AUTH_OIDC_CLIENT_ID` - OAuth2 client ID from your OIDC provider
- `DAGU_AUTH_OIDC_CLIENT_SECRET` - OAuth2 client secret
- `DAGU_AUTH_OIDC_CLIENT_URL` - Base URL of your Dagu instance (for callback)
- `DAGU_AUTH_OIDC_ISSUER` - OIDC provider URL
- `DAGU_AUTH_OIDC_SCOPES` - OAuth2 scopes (comma-separated, default: `openid,profile,email`)
- `DAGU_AUTH_OIDC_WHITELIST` - Email addresses allowed to authenticate (comma-separated)

Builtin-specific OIDC settings (only used when `auth.mode=builtin`):
- `DAGU_AUTH_OIDC_AUTO_SIGNUP` - Auto-create users on first OIDC login (default: `false`)
- `DAGU_AUTH_OIDC_DEFAULT_ROLE` - Role for auto-created users (default: `viewer`)
- `DAGU_AUTH_OIDC_ALLOWED_DOMAINS` - Email domains allowed to authenticate (comma-separated)
- `DAGU_AUTH_OIDC_BUTTON_LABEL` - SSO login button text (default: `Login with SSO`)
- `DAGU_AUTH_OIDC_GROUPS_CLAIM` - JWT claim containing group membership (default: `groups`)
- `DAGU_AUTH_OIDC_ROLE_ATTRIBUTE_PATH` - jq expression for role extraction
- `DAGU_AUTH_OIDC_ROLE_ATTRIBUTE_STRICT` - Deny login when no valid role found (default: `false`)
- `DAGU_AUTH_OIDC_SKIP_ORG_ROLE_SYNC` - Only assign role on first login (default: `false`)

### TLS/HTTPS
- `DAGU_CERT_FILE` - SSL certificate
- `DAGU_KEY_FILE` - SSL key

### UI
- `DAGU_UI_NAVBAR_COLOR` - Nav bar color
- `DAGU_UI_NAVBAR_TITLE` - Nav bar title
- `DAGU_UI_LOG_ENCODING_CHARSET` - Log file character encoding (see [Supported Log Encodings](#supported-log-encodings))
- `DAGU_UI_MAX_DASHBOARD_PAGE_LIMIT` - Dashboard limit
- `DAGU_UI_DAGS_SORT_FIELD` - Default DAGs page sort field
- `DAGU_UI_DAGS_SORT_ORDER` - Default DAGs page sort order

### Queue
- `DAGU_QUEUE_ENABLED` - Enable queue system (default: true)

### Execution
- `DAGU_DEFAULT_EXECUTION_MODE` - Default execution mode: `local` (default) or `distributed`. When `distributed`, all DAGs are dispatched to workers through the coordinator, even without an explicit `worker_selector`. Use `worker_selector: local` in a DAG to override.

### Coordinator
- `DAGU_COORDINATOR_ENABLED` - Enable coordinator service (default: `true`)
- `DAGU_COORDINATOR_HOST` - Coordinator bind address (default: `127.0.0.1`)
- `DAGU_COORDINATOR_ADVERTISE` - Address to advertise in service registry (default: auto-detected hostname)
- `DAGU_COORDINATOR_PORT` - Coordinator gRPC port (default: `50055`)

### Worker
- `DAGU_WORKER_ID` - Worker instance ID (default: `hostname@PID`)
- `DAGU_WORKER_MAX_ACTIVE_RUNS` - Max concurrent task executions (default: `100`)
- `DAGU_WORKER_LABELS` - Worker labels (format: `key1=value1,key2=value2`)
- `DAGU_WORKER_POSTGRES_POOL_MAX_OPEN_CONNS` - PostgreSQL max open connections across all DSNs (default: `25`)
- `DAGU_WORKER_POSTGRES_POOL_MAX_IDLE_CONNS` - PostgreSQL max idle connections per DSN (default: `5`)
- `DAGU_WORKER_POSTGRES_POOL_CONN_MAX_LIFETIME` - PostgreSQL connection max lifetime in seconds (default: `300`)
- `DAGU_WORKER_POSTGRES_POOL_CONN_MAX_IDLE_TIME` - PostgreSQL connection max idle time in seconds (default: `60`)

### Peer (for distributed TLS)
- `DAGU_PEER_INSECURE` - Use insecure connection (default: `true`)
- `DAGU_PEER_CERT_FILE` - TLS certificate for peer connections
- `DAGU_PEER_KEY_FILE` - TLS key for peer connections
- `DAGU_PEER_CLIENT_CA_FILE` - CA certificate for peer verification (mTLS)
- `DAGU_PEER_SKIP_TLS_VERIFY` - Skip TLS certificate verification

### Scheduler
- `DAGU_SCHEDULER_PORT` - Health check server port (default: `8090`)
- `DAGU_SCHEDULER_LOCK_STALE_THRESHOLD` - Time after which a scheduler lock is considered stale (default: `30s`)
- `DAGU_SCHEDULER_LOCK_RETRY_INTERVAL` - Interval between lock acquisition attempts (default: `5s`)
- `DAGU_SCHEDULER_ZOMBIE_DETECTION_INTERVAL` - Interval for detecting zombie DAG runs (default: `45s`, `0` to disable)

### Resource Monitoring
- `DAGU_MONITORING_RETENTION` - How long to keep resource history (default: `24h`)
- `DAGU_MONITORING_INTERVAL` - How often to collect resource metrics (default: `5s`)

### Legacy Environment Variables (Deprecated)
These variables are maintained for backward compatibility but should not be used in new deployments:
- `DAGU__ADMIN_NAVBAR_COLOR` - Use `DAGU_UI_NAVBAR_COLOR`
- `DAGU__ADMIN_NAVBAR_TITLE` - Use `DAGU_UI_NAVBAR_TITLE`
- `DAGU__ADMIN_PORT` - Use `DAGU_PORT`
- `DAGU__ADMIN_HOST` - Use `DAGU_HOST`
- `DAGU__DATA` - Use `DAGU_DATA_DIR`
- `DAGU__SUSPEND_FLAGS_DIR` - Use `DAGU_SUSPEND_FLAGS_DIR`
- `DAGU__ADMIN_LOGS_DIR` - Use `DAGU_ADMIN_LOG_DIR`

## Base Configuration

Shared defaults for all DAGs: `~/.config/dagu/base.yaml`

```yaml
# Environment
env:
  - ENVIRONMENT: production
  - LOG_LEVEL: info

# Defaults
queue: "default"
hist_retention_days: 30

# Email notifications
mail_on:
  failure: true

smtp:
  host: "smtp.gmail.com"
  port: "587"
  username: "notifications@company.com"
  password: "${SMTP_PASSWORD}"

error_mail:
  from: "dagu@company.com"
  to: "ops-team@company.com"
  prefix: "[ERROR]"
  attach_logs: true
```

For complete documentation on all available fields, inheritance behavior, and common patterns, see [Base Configuration](/configurations/base-config).

## Command-Line Flags

### Global Flags (All Commands)
- `--config, -c` - Config file (default: `~/.config/dagu/config.yaml`)
- `--dagu-home` - Override DAGU_HOME for this command invocation
- `--quiet, -q` - Suppress output
- `--cpu-profile` - Enable CPU profiling

The `--dagu-home` flag sets a custom application home directory for the current command, overriding the `DAGU_HOME` environment variable. When set, all paths use a unified structure under the specified directory.

**Example:**
```bash
# Use a custom home directory
dagu --dagu-home=/tmp/dagu-test start my-workflow.yaml

# Run server with isolated data
dagu --dagu-home=/opt/dagu-prod start-all
```

### Server/Start-All
- `--host, -s` - Server host
- `--port, -p` - Server port
- `--dags, -d` - DAGs directory

### Scheduler
- `--dags, -d` - DAGs directory

## Configuration Precedence

1. Command-line flags (highest)
2. Environment variables
3. Configuration file
4. Base configuration
5. Default values (lowest)

```bash
# Port 9000 wins (CLI flag beats env var)
DAGU_PORT=8080 dagu start-all --port 9000

# --dagu-home flag overrides DAGU_HOME environment variable
DAGU_HOME=/opt/dagu dagu --dagu-home=/tmp/dagu-test start my-workflow.yaml
```

## Special Environment Variables

Dagu sets metadata like `DAG_RUN_ID`, `DAG_RUN_LOG_FILE`, and the active `DAG_RUN_STEP_NAME` while each workflow runs. Consult [Special Environment Variables](/reference/special-environment-variables) for the full list and examples of how to use them in automations.

## Directory Structure

### Default (XDG)
```
~/.config/dagu/
├── dags/              # DAG definitions
├── config.yaml        # Main configuration
└── base.yaml          # Shared DAG defaults

~/.local/share/dagu/
├── logs/              # All log files
│   ├── admin/         # Admin/server logs
│   │   └── audit/     # Audit logs (daily JSONL files)
│   └── dags/          # DAG execution logs
├── data/              # Application data
│   ├── dag-runs/      # DAG run history
│   ├── queue/         # Queue data
│   ├── proc/          # Process data
│   └── service-registry/  # Service registry data
└── suspend/           # DAG suspend flags
```

### With DAGU_HOME
```
$DAGU_HOME/
├── dags/              # DAG definitions
├── logs/              # All log files
│   └── admin/         # Admin/server logs
│       └── audit/     # Audit logs (daily JSONL files)
├── data/              # Application data
│   ├── dag-runs/      # DAG run history
│   ├── queue/         # Queue data
│   ├── proc/          # Process data
│   └── service-registry/  # Service registry data
├── suspend/           # DAG suspend flags
├── config.yaml        # Main configuration
└── base.yaml          # Shared DAG defaults
```

## Configuration Examples

### Minimal
```yaml
port: 8080
```

### Production
```yaml
host: 0.0.0.0
port: 443

auth:
  mode: builtin
  builtin:
    token:
      secret: ${AUTH_TOKEN_SECRET}  # auto-generated if not set
      ttl: 24h

tls:
  cert_file: /etc/ssl/certs/dagu.crt
  key_file: /etc/ssl/private/dagu.key

permissions:
  write_dags: false
  run_dags: true

ui:
  navbar_color: "#ff0000"
  navbar_title: "Production"
```

### Multi-Environment
```yaml
remote_nodes:
  - name: staging
    api_base_url: https://staging.example.com/api/v1
    is_auth_token: true
    auth_token: ${STAGING_TOKEN}

  - name: production
    api_base_url: https://prod.example.com/api/v1
    is_auth_token: true
    auth_token: ${PROD_TOKEN}
```

### Distributed Execution
```yaml
# Main instance with coordinator
host: 0.0.0.0
port: 8080

coordinator:
  host: 0.0.0.0
  port: 50055

default_execution_mode: distributed  # Dispatch all DAGs to workers

# Worker configuration
worker:
  id: gpu-worker-01
  max_active_runs: 10
  labels:
    gpu: "true"
    cuda: "11.8"
    memory: "64G"
    region: "us-east-1"

# TLS configuration for peer connections
peer:
  insecure: false  # Enable TLS
  cert_file: /etc/dagu/tls/cert.pem
  key_file: /etc/dagu/tls/key.pem
  client_ca_file: /etc/dagu/tls/ca.pem
```

## Default Values

### Key Defaults
- `api_base_path`: `/api/v1`
- `queues.enabled`: `true`
- `permissions.write_dags`: `true`
- `permissions.run_dags`: `true`
- `ui.max_dashboard_page_limit`: `100`
- `ui.log_encoding_charset`: `utf-8`
- `ui.dags.sort_field`: `name`
- `ui.dags.sort_order`: `asc`
- `log_format`: `text`
- `host`: `127.0.0.1`
- `port`: `8080`
- `metrics`: `private`
- `default_execution_mode`: `local`
- `coordinator.enabled`: `true`
- `terminal.enabled`: `false`
- `audit.enabled`: `true`

### Auto-generated Paths
When not specified, these paths are automatically set based on `paths.data_dir`:
- `paths.dag_runs_dir`: `{paths.data_dir}/dag-runs` - Stores DAG run history
- `paths.queue_dir`: `{paths.data_dir}/queue` - Stores queue data
- `paths.proc_dir`: `{paths.data_dir}/proc` - Stores process data
- `paths.executable`: Current executable path - Auto-detected from running process

## Supported Log Encodings

The `ui.log_encoding_charset` configuration option supports a wide range of character encodings for reading log files. This is useful when your DAG steps produce output in non-UTF-8 encodings.

### Common Encodings

| Encoding | Aliases | Description |
|----------|---------|-------------|
| `utf-8` | `utf8` | Unicode (default) |
| `shift_jis` | `shiftjis`, `sjis`, `s-jis` | Japanese (Windows) |
| `euc-jp` | `eucjp` | Japanese (Unix) |
| `iso-2022-jp` | `iso2022jp` | Japanese (Email) |
| `gb2312` | `gb-2312` | Simplified Chinese |
| `gbk` | `cp936`, `windows-936` | Simplified Chinese (Extended) |
| `gb18030` | | Simplified Chinese (Full) |
| `big5` | `big-5` | Traditional Chinese |
| `euc-kr` | `euckr`, `korean` | Korean |

### ISO-8859 (Latin) Encodings

| Encoding | Aliases | Description |
|----------|---------|-------------|
| `iso-8859-1` | `latin1`, `l1` | Western European |
| `iso-8859-2` | `latin2`, `l2` | Central European |
| `iso-8859-5` | `cyrillic` | Cyrillic |
| `iso-8859-6` | `arabic` | Arabic |
| `iso-8859-7` | `greek` | Greek |
| `iso-8859-8` | `hebrew` | Hebrew |
| `iso-8859-9` | `latin5`, `turkish` | Turkish |
| `iso-8859-15` | `latin9` | Western European with Euro |

### Windows Code Pages

| Encoding | Aliases | Description |
|----------|---------|-------------|
| `windows-1250` | `cp1250` | Central European |
| `windows-1251` | `cp1251` | Cyrillic |
| `windows-1252` | `cp1252`, `ansi` | Western European |
| `windows-1253` | `cp1253` | Greek |
| `windows-1254` | `cp1254` | Turkish |
| `windows-1255` | `cp1255` | Hebrew |
| `windows-1256` | `cp1256` | Arabic |
| `windows-1257` | `cp1257` | Baltic |
| `windows-1258` | `cp1258` | Vietnamese |

### Other Encodings

| Encoding | Aliases | Description |
|----------|---------|-------------|
| `koi8-r` | `koi8r` | Russian |
| `koi8-u` | `koi8u` | Ukrainian |
| `macintosh` | `mac`, `macroman` | Mac Roman |
| `ibm866` | `cp866` | DOS Cyrillic |
| `utf-16` | `utf16`, `utf-16le` | Unicode (16-bit) |
| `utf-16be` | `utf16be` | Unicode (16-bit Big Endian) |

### Example Configuration

```yaml
# For Japanese logs (Shift_JIS encoding)
ui:
  log_encoding_charset: "shift_jis"

# For Russian logs (KOI8-R encoding)
ui:
  log_encoding_charset: "koi8-r"

# For legacy Windows systems
ui:
  log_encoding_charset: "windows-1252"
```

## See Also

- [Server Configuration](/configurations/server)
- [Production Setup](/configurations/operations)
- [Deployment Guides](/configurations/deployment)
