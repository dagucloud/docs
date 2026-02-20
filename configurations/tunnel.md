# Tunnel (Tailscale)

Remote access to Dagu via embedded Tailscale node. No port forwarding, firewall rules, or VPN setup required.

## Architecture

```mermaid
graph LR
    subgraph Remote["Remote Device"]
        B[Browser]
    end

    subgraph Tailnet["Tailscale Network"]
        WG[WireGuard Tunnel]
    end

    subgraph Server["Dagu Server"]
        TS[tsnet Listener<br/>:80 or :443]
        RP[Reverse Proxy]
        DS[Dagu HTTP<br/>:8080]
    end

    B -->|HTTPS/HTTP| WG
    WG -->|Encrypted| TS
    TS --> RP
    RP --> DS
```

**How it works:**
1. Dagu starts an embedded Tailscale node using [tsnet](https://pkg.go.dev/tailscale.com/tsnet)
2. The node joins your Tailscale network (tailnet)
3. A reverse proxy forwards requests to the local Dagu server
4. Access via `http://dagu.<your-tailnet>.ts.net`

## Quick Start

```bash
dagu server --tunnel
```

**First run:**
```
To start this tsnet server, go to: https://login.tailscale.com/a/abc123
```
Click the URL to authorize. Credentials are saved for subsequent runs.

**Access:**
```
http://dagu.<your-tailnet>.ts.net
```

## CLI Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--tunnel`, `-t` | bool | `false` | Enable tunnel mode |
| `--tunnel-token` | string | `""` | Tailscale auth key for headless login |
| `--tunnel-funnel` | bool | `false` | Enable public internet access |
| `--tunnel-https` | bool | `false` | Use HTTPS (requires admin setup) |

## Configuration File

```yaml
# ~/.config/dagu/config.yaml
tunnel:
  enabled: true

  tailscale:
    # Auth key for headless authentication (optional)
    # Generate at: https://login.tailscale.com/admin/settings/keys
    auth_key: "tskey-auth-xxxxx"

    # Machine name in tailnet (default: "dagu")
    hostname: "dagu"

    # Enable Tailscale Funnel for public access
    funnel: false

    # Use HTTPS for tailnet-only access
    https: false

    # State directory (default: ~/.dagu_data/tailscale)
    state_dir: ""

  # Allow terminal access via tunnel (default: false)
  allow_terminal: false

  # IP allowlist (empty = allow all)
  allowed_ips: []

  # Rate limiting for authentication
  rate_limiting:
    enabled: false
    login_attempts: 5        # Max attempts per window
    window_seconds: 300      # 5 minutes
    block_duration_seconds: 900  # 15 minutes
```

## Environment Variables

| Variable | Config Key |
|----------|------------|
| `DAGU_TUNNEL_ENABLED` | `tunnel.enabled` |
| `DAGU_TUNNEL_TAILSCALE_AUTH_KEY` | `tunnel.tailscale.auth_key` |
| `DAGU_TUNNEL_TAILSCALE_HOSTNAME` | `tunnel.tailscale.hostname` |
| `DAGU_TUNNEL_TAILSCALE_FUNNEL` | `tunnel.tailscale.funnel` |
| `DAGU_TUNNEL_TAILSCALE_HTTPS` | `tunnel.tailscale.https` |
| `DAGU_TUNNEL_TAILSCALE_STATE_DIR` | `tunnel.tailscale.state_dir` |
| `DAGU_TUNNEL_ALLOW_TERMINAL` | `tunnel.allow_terminal` |
| `DAGU_TUNNEL_RATE_LIMITING_ENABLED` | `tunnel.rate_limiting.enabled` |
| `DAGU_TUNNEL_RATE_LIMITING_LOGIN_ATTEMPTS` | `tunnel.rate_limiting.login_attempts` |
| `DAGU_TUNNEL_RATE_LIMITING_WINDOW_SECONDS` | `tunnel.rate_limiting.window_seconds` |
| `DAGU_TUNNEL_RATE_LIMITING_BLOCK_DURATION_SECONDS` | `tunnel.rate_limiting.block_duration_seconds` |

## Modes

### Default: HTTP (Tailnet Only)

```bash
dagu server --tunnel
```

| Property | Value |
|----------|-------|
| URL | `http://dagu.<tailnet>.ts.net` |
| Port | 80 |
| Encryption | WireGuard (network layer) |
| Access | Tailnet devices only |
| Setup | None |

Traffic is encrypted by WireGuard. HTTP is used because TLS on top of WireGuard is redundant.

### HTTPS (Tailnet Only)

```bash
dagu server --tunnel --tunnel-https
```

| Property | Value |
|----------|-------|
| URL | `https://dagu.<tailnet>.ts.net` |
| Port | 443 |
| Encryption | WireGuard + TLS |
| Access | Tailnet devices only |
| Setup | Enable HTTPS in Tailscale admin |

**Setup:**
1. Go to https://login.tailscale.com/admin/dns
2. Enable "HTTPS Certificates"

### Funnel: Public Internet

```bash
dagu server --tunnel --tunnel-funnel
```

| Property | Value |
|----------|-------|
| URL | `https://dagu.<tailnet>.ts.net` |
| Port | 443 |
| Encryption | TLS |
| Access | Anyone on internet |
| Setup | Enable Funnel in Tailscale admin |

**Setup:**
1. Go to https://login.tailscale.com/admin/acls
2. Add to policy:
```json
{
  "nodeAttrs": [
    {
      "target": ["*"],
      "attr": ["funnel"]
    }
  ]
}
```

::: warning Authentication Required
When using Funnel, ensure authentication is enabled:
```yaml
server:
  auth:
    mode: builtin  # or basic
```
:::

## Authentication Flow

### Interactive Login (Default)

```
1. Start server
   $ dagu server --tunnel

2. Server prints login URL
   To start this tsnet server, go to: https://login.tailscale.com/a/abc123

3. Click URL → Authorize in browser

4. State saved to ~/.dagu_data/tailscale/tailscaled.state

5. Subsequent runs auto-connect (no login needed)
```

### Headless Login (Auth Key)

For automated deployments without interactive login:

```bash
# Generate auth key at https://login.tailscale.com/admin/settings/keys
dagu server --tunnel --tunnel-token=tskey-auth-kxxxxxxx
```

Or via environment:
```bash
export DAGU_TUNNEL_TAILSCALE_AUTH_KEY=tskey-auth-kxxxxxxx
dagu server --tunnel
```

## File Locations

```
~/.dagu_data/
├── tailscale/
│   └── tailscaled.state   # Persistent auth credentials
└── tunnel_url             # Last known tunnel URL
```

## API Endpoint

```
GET /api/v1/services/tunnel
```

**Response:**
```json
{
  "enabled": true,
  "provider": "tailscale",
  "status": "connected",
  "publicUrl": "http://dagu.tail01cbab.ts.net",
  "mode": "direct",
  "isPublic": false,
  "startedAt": "2024-01-27T12:45:44Z"
}
```

**Status values:** `disabled`, `connecting`, `connected`, `reconnecting`, `error`

**Mode values:** `direct` (tailnet), `funnel` (public)

## Technical Details

- **Connection timeout:** 60 seconds
- **Status poll interval:** 100ms
- **Graceful degradation:** Tunnel failure does not stop the server
- **Proxy target:** Connects to `127.0.0.1:<port>` (auto-converts `0.0.0.0`)

## See Also

- [Server Configuration](/configurations/server) - Host, port, authentication
- [Authentication](/configurations/authentication) - Securing access
- [Remote Nodes](/configurations/remote-nodes) - Multi-instance setup
