# Builtin Authentication

Builtin authentication provides user management with role-based access control (RBAC) using JWT tokens.

## Features

- **User Management**: Create, update, and delete users through the web UI
- **Role-Based Access Control**: Five roles with different permission levels
- **JWT Authentication**: Secure token-based authentication
- **Password Management**: Users can change their own passwords; admins can reset any user's password
- **API Key Management**: Create and manage API keys for programmatic access with role-based permissions

## Roles

| Role | Permissions |
|------|-------------|
| `admin` | Full access including user management |
| `manager` | Create, edit, delete, run, and stop DAGs; can view audit logs |
| `developer` | Create, edit, delete, run, and stop DAGs |
| `operator` | Run and stop DAGs (execute only) |
| `viewer` | Read-only access to DAGs and execution history |

## Configuration

### YAML Configuration

```yaml
# ~/.config/boltbase/config.yaml
auth:
  mode: builtin  # default — can be omitted
  builtin:
    token:
      secret: your-secure-random-secret-key  # auto-generated if not set
      ttl: 24h
```

### Token TTL Format

The `ttl` field uses Go's duration format. Valid time units are:

| Unit | Description | Example |
|------|-------------|---------|
| `ns` | nanoseconds | `1000000ns` |
| `us` (or `µs`) | microseconds | `1000us` |
| `ms` | milliseconds | `1000ms` |
| `s` | seconds | `3600s` |
| `m` | minutes | `60m` |
| `h` | hours | `24h` |

**Note:** Days (`d`) and weeks (`w`) are **not supported**. Use hours instead.

Common TTL examples:

| Duration | Value |
|----------|-------|
| 1 hour | `1h` |
| 8 hours | `8h` |
| 24 hours (1 day) | `24h` |
| 7 days | `168h` |
| 30 days | `720h` |
| 365 days | `8760h` |

You can also combine units: `1h30m`, `2h45m30s`

### Environment Variables

```bash
export BOLTBASE_AUTH_MODE=builtin  # default — can be omitted

# Optional - token settings
export BOLTBASE_AUTH_TOKEN_SECRET=your-secure-random-secret-key  # auto-generated if not set
export BOLTBASE_AUTH_TOKEN_TTL=24h  # default: 24h

boltbase start-all
```

## Initial Setup

On first startup with builtin auth enabled:

1. If no users exist, the server enters setup mode
2. Visit the web UI — you will be redirected to the `/setup` page
3. Create your initial admin account with a username and password
4. After setup, you are automatically authenticated and redirected to the dashboard
5. Use the admin account to manage users, API keys, and webhooks

## API Access

### Login

```bash
# Get JWT token
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your-password"}'

# Response:
# {"token": "eyJhbG...", "user": {"id": "...", "username": "admin", "role": "admin"}}
```

### Using the Token

```bash
# Include token in Authorization header
curl -H "Authorization: Bearer eyJhbG..." \
  http://localhost:8080/api/v1/dags
```

### Get Current User

```bash
curl -H "Authorization: Bearer eyJhbG..." \
  http://localhost:8080/api/v1/auth/me
```

### Change Password (Self)

```bash
curl -X POST http://localhost:8080/api/v1/auth/change-password \
  -H "Authorization: Bearer eyJhbG..." \
  -H "Content-Type: application/json" \
  -d '{"currentPassword": "old-pass", "newPassword": "new-pass"}'
```

## User Management (Admin Only)

### List Users

```bash
curl -H "Authorization: Bearer eyJhbG..." \
  http://localhost:8080/api/v1/users
```

### Create User

```bash
curl -X POST http://localhost:8080/api/v1/users \
  -H "Authorization: Bearer eyJhbG..." \
  -H "Content-Type: application/json" \
  -d '{"username": "newuser", "password": "secure-pass", "role": "operator"}'
```

### Update User

```bash
curl -X PUT http://localhost:8080/api/v1/users/{user-id} \
  -H "Authorization: Bearer eyJhbG..." \
  -H "Content-Type: application/json" \
  -d '{"role": "manager"}'
```

### Reset User Password (Admin)

```bash
curl -X PUT http://localhost:8080/api/v1/users/{user-id}/password \
  -H "Authorization: Bearer eyJhbG..." \
  -H "Content-Type: application/json" \
  -d '{"newPassword": "new-secure-pass"}'
```

### Delete User

```bash
curl -X DELETE http://localhost:8080/api/v1/users/{user-id} \
  -H "Authorization: Bearer eyJhbG..."
```

### Disable/Enable User

Disabled users cannot log in or access the API, but their account is preserved:

```bash
# Disable a user
curl -X PATCH http://localhost:8080/api/v1/users/{user-id} \
  -H "Authorization: Bearer eyJhbG..." \
  -H "Content-Type: application/json" \
  -d '{"isDisabled": true}'

# Enable a user
curl -X PATCH http://localhost:8080/api/v1/users/{user-id} \
  -H "Authorization: Bearer eyJhbG..." \
  -H "Content-Type: application/json" \
  -d '{"isDisabled": false}'
```

**Note:** You can also disable/enable users from the web UI via the user management page. This is useful for revoking access without deleting the user account.

## Docker Compose Example

```yaml
services:
  boltbase:
    image: ghcr.io/dagu-org/boltbase:latest
    environment:
      - BOLTBASE_AUTH_MODE=builtin
      - BOLTBASE_AUTH_TOKEN_SECRET=change-me-to-secure-random-string
      # First admin account created via /setup page on first browser visit
    ports:
      - "8080:8080"
    volumes:
      - boltbase-data:/var/lib/boltbase

volumes:
  boltbase-data:
```

## Important Notes

- **Basic vs Builtin**: Basic auth (`auth.mode=basic`) and builtin auth (`auth.mode=builtin`) are mutually exclusive. When using builtin mode, basic auth credentials are not used.

## Security Notes

- **Token Secret**: Use a strong, random secret (at least 32 characters). This is used to sign JWT tokens.
- **Password Requirements**: Minimum 8 characters
- **Token Expiry**: Tokens expire after the configured TTL (default: 24 hours)
- **V1 API**: The V1 API is disabled when builtin auth is enabled (use V2 API)
- **Terminal Access**: The web-based terminal is disabled by default. Enable with `terminal.enabled: true` only in trusted environments. See [Terminal Configuration](/configurations/server#terminal).
- **Audit Logging**: Security events (logins, user changes, API key operations) are logged by default. See [Audit Logging](/configurations/server#audit-logging).

## API Key Management

Builtin authentication includes full API key management capabilities. API keys provide programmatic access with role-based permissions, ideal for CI/CD pipelines, automation scripts, and service-to-service communication.

### Quick Start

```bash
# Create an API key via the API (requires admin JWT token)
curl -X POST http://localhost:8080/api/v1/api-keys \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "ci-pipeline", "role": "operator"}'

# Use the API key
curl -H "Authorization: Bearer boltbase_your-api-key-here" \
  http://localhost:8080/api/v1/dags
```

### Key Features

- **Role Assignment**: Each API key has its own role (admin, manager, developer, operator, viewer)
- **Usage Tracking**: See when each key was last used
- **Web UI Management**: Create and manage keys from Settings > API Keys
- **Secure Storage**: Keys are hashed; the full key is only shown once at creation

For detailed documentation, see [API Keys](api-keys).

## OIDC/SSO Login

Builtin authentication supports OIDC/SSO login, allowing users to authenticate via enterprise identity providers (Google, Okta, Auth0, Keycloak, etc.) while maintaining Boltbase's user management and RBAC system.

### Enabling OIDC

OIDC is **automatically enabled** when all required fields (`client_id`, `client_secret`, `client_url`, `issuer`) are configured. No explicit `enabled` flag is needed.

```yaml
auth:
  mode: builtin
  builtin:
    token:
      secret: your-jwt-secret  # auto-generated if not set
      ttl: 24h
  oidc:
    client_id: your-client-id
    client_secret: your-client-secret
    client_url: https://boltbase.example.com
    issuer: https://accounts.google.com
    scopes: ["openid", "profile", "email"]
    # auto_signup defaults to true - users are auto-created on first login
    allowed_domains: ["company.com"]
    whitelist: ["partner@external.com"]
    button_label: "Login with SSO"
    role_mapping:
      default_role: viewer  # Role for new users when no mapping matches
```

### Environment Variables

```bash
# OIDC configuration (auto-enabled when all required fields are set)
export BOLTBASE_AUTH_OIDC_CLIENT_ID=your-client-id
export BOLTBASE_AUTH_OIDC_CLIENT_SECRET=your-client-secret
export BOLTBASE_AUTH_OIDC_CLIENT_URL=https://boltbase.example.com
export BOLTBASE_AUTH_OIDC_ISSUER=https://accounts.google.com

# Optional settings
export BOLTBASE_AUTH_OIDC_AUTO_SIGNUP=true                    # default: true
export BOLTBASE_AUTH_OIDC_DEFAULT_ROLE=viewer                 # default: viewer
export BOLTBASE_AUTH_OIDC_ALLOWED_DOMAINS=company.com,other.com  # comma-separated
export BOLTBASE_AUTH_OIDC_WHITELIST=user@example.com          # comma-separated
export BOLTBASE_AUTH_OIDC_BUTTON_LABEL="Login with SSO"
```

### Configuration Fields

| Field | Description | Default |
|-------|-------------|---------|
| `client_id` | OAuth2 client ID from your OIDC provider | Required |
| `client_secret` | OAuth2 client secret | Required |
| `client_url` | Base URL of your Boltbase instance | Required |
| `issuer` | OIDC provider URL | Required |
| `scopes` | OAuth2 scopes to request | `["openid", "profile", "email"]` |
| `auto_signup` | Auto-create users on first OIDC login | `true` |
| `allowed_domains` | Email domains allowed to authenticate | All domains |
| `whitelist` | Specific email addresses always allowed | None |
| `button_label` | Text displayed on the SSO login button | `"Login with SSO"` |
| `role_mapping.default_role` | Role assigned to new users when no mapping matches | `viewer` |

**Note**: `allowed_domains`, `whitelist`, and `scopes` can be specified as either YAML lists or comma-separated strings. This is especially useful for environment variables.

### Auto-Signup

When `auto_signup` is enabled (the default), users authenticating via OIDC for the first time are automatically created in Boltbase with the role specified by `role_mapping.default_role`. This eliminates the need to pre-create user accounts.

When `auto_signup` is disabled, users must exist in Boltbase before they can log in via OIDC.

### Domain Filtering

Use `allowed_domains` to restrict OIDC login to specific email domains:

```yaml
oidc:
  allowed_domains: ["company.com", "subsidiary.com"]
```

Users with emails outside these domains will be denied access.

### Email Whitelist

Use `whitelist` to allow specific email addresses:

```yaml
oidc:
  whitelist: ["allowed@example.com", "admin@example.com"]
```

**Access Control Logic:**
- If `whitelist` is set: only emails in the whitelist are allowed
- If `allowed_domains` is set: only emails from those domains are allowed
- If both are set: email must match whitelist OR domain must match allowed_domains
- If neither is set: all authenticated emails are allowed

```yaml
# Example: Allow company.com domain + specific external partners
oidc:
  allowed_domains: ["company.com"]
  whitelist: ["partner@external.com", "contractor@other.com"]
```

### Role Mapping

Map IdP groups to Boltbase roles for automatic role assignment:

```yaml
oidc:
  role_mapping:
    default_role: viewer           # Role when no mapping matches (default: viewer)
    groups_claim: groups           # Claim containing user's groups
    group_mappings:
      admins: admin               # IdP group -> Boltbase role
      developers: developer
      ops: operator
      everyone: viewer
    role_attribute_strict: false    # Deny login if no role matched
    skip_org_role_sync: false        # Sync roles on every login
```

**Role Mapping Options:**

| Field | Description | Default |
|-------|-------------|---------|
| `default_role` | Role assigned when no mapping matches | `viewer` |
| `groups_claim` | JWT claim containing group membership | `groups` |
| `group_mappings` | Map of IdP group names to Boltbase roles | None |
| `role_attribute_path` | jq expression for advanced role extraction | None |
| `role_attribute_strict` | Deny login when no valid role is found | `false` |
| `skip_org_role_sync` | Only assign role on first login | `false` |

**Example with jq expression:**

```yaml
role_mapping:
  default_role: viewer
  role_attribute_path: 'if (.groups | contains(["admins"])) then "admin" elif (.groups | contains(["devs"])) then "developer" else "viewer" end'
```

### How It Works

1. User clicks "Login with SSO" on the login page
2. Redirected to OIDC provider for authentication
3. After successful authentication, Boltbase validates the token
4. If `auto_signup` is enabled and user doesn't exist, a new user is created
5. Role is determined by `role_mapping` (if configured) or `default_role`
6. User receives a JWT token for the Boltbase session

### Notes

- OIDC users are managed alongside local users in the same user database
- OIDC users can also authenticate with their Boltbase password if one is set
- Admin users can manage all users (OIDC and local) from the web UI
- The callback URL is `{client_url}/oidc-callback`

## Comparison with Other Auth Methods

| Feature | Basic Auth | Token Auth | OIDC (standalone) | Builtin (Recommended) |
|---------|------------|------------|-------------------|----------------------|
| User Management | No | No | No | Yes |
| Role-Based Access | No | No | No | Yes |
| Password Change | No | No | No | Yes |
| Multiple Users | No | No | Yes | Yes |
| API Key Management | No | No | No | Yes |
| SSO/OIDC Login | No | No | Yes | Yes |
| Role Mapping from IdP | No | No | No | Yes |
| Self-Hosted | Yes | Yes | Yes | Yes |

Builtin mode (`auth.mode: builtin`) is suitable for production deployments that require user management and RBAC. Enable OIDC under builtin mode for SSO while retaining full user management capabilities.
