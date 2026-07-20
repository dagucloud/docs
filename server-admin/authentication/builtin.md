# Builtin Authentication

Builtin authentication is the recommended authentication mode for self-hosted Dagu. It provides JWT-based login, admin bootstrap, password management, API keys, and the role-based access model used by self-hosted Dagu.

::: info Deployment Model
This page covers self-hosted Dagu. Creating additional API keys beyond the configured limit, creating, updating, and deleting users, and enabling OIDC/SSO login require an active self-host license. Managed server includes those features by default. See the [pricing page](https://dagu.sh/pricing) for current self-host and cloud availability.
:::

## Features

- **JWT Authentication**: Secure token-based authentication
- **Initial Admin Bootstrap**: Create the first admin through config, environment variables, or the setup page
- **Password Management**: Users can change their own passwords; admins can reset any user's password
- **API Key Management**: Create and manage API keys for programmatic access with role-based permissions
- **User Management**: List and inspect users, reset passwords, and, with an active self-host license, create, update, disable, and delete users through the web UI and API
- **Role-Based Access Control**: Five roles with different permission levels
- **Workspace Scoping**: Show all workspaces or selected workspaces with per-workspace roles inside one Dagu installation
- **OIDC/SSO Integration**: Add enterprise identity providers under builtin auth

## Roles

| Role | Permissions |
|------|-------------|
| `admin` | Full access including user management |
| `manager` | Create, edit, delete, run, and stop DAGs; can view audit logs |
| `developer` | Create, edit, delete, run, and stop DAGs |
| `operator` | Run and stop DAGs (execute only) |
| `viewer` | Read-only access to DAGs and execution history |

Workspace access can further scope a user to selected workspaces. This is UI/API data scoping, not tenant isolation. Selected-workspace users keep top-level role `viewer` and receive per-workspace grants such as `developer` for `ops` and `operator` for `prod`. Resources with no workspace label are shown as `default` and remain visible through the top-level viewer role.

See [User Management](./user-management#workspace-access) for the full workspace access rules and API schema.

## Configuration

### YAML Configuration

```yaml
# ~/.config/dagu/config.yaml
auth:
  mode: builtin  # default — can be omitted
  builtin:
    token:
      secret: your-secure-random-secret-key  # auto-generated if not set
      ttl: 24h
    initial_admin:              # optional — auto-create admin on first startup
      username: admin
      password: your-secure-password
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

The maximum token TTL is `8760h` (365 days). Values above this limit are rejected during startup validation.

### Environment Variables

```bash
export DAGU_AUTH_MODE=builtin  # default — can be omitted

# Optional - token settings
export DAGU_AUTH_TOKEN_SECRET=your-secure-random-secret-key  # auto-generated if not set
export DAGU_AUTH_TOKEN_TTL=24h  # default: 24h; maximum: 8760h

# Optional - auto-create admin on first startup (both required together)
export DAGU_AUTH_BUILTIN_INITIAL_ADMIN_USERNAME=admin
export DAGU_AUTH_BUILTIN_INITIAL_ADMIN_PASSWORD=your-secure-password

dagu start-all
```

## Initial Setup

On first startup with builtin auth enabled and no users in the store:

**Option A: Via config or environment variables (headless)**

Set `initial_admin.username` and `initial_admin.password` in the config file or via `DAGU_AUTH_BUILTIN_INITIAL_ADMIN_USERNAME` and `DAGU_AUTH_BUILTIN_INITIAL_ADMIN_PASSWORD` environment variables. The server creates the admin user at startup and is immediately ready — no browser interaction required.

The guided script installers can collect these credentials for you during setup and verify that the first admin login works before they finish.

```yaml
auth:
  mode: builtin
  builtin:
    initial_admin:
      username: admin
      password: a-strong-password-here
```

Both fields must be provided together. If only one is set, the server fails validation and does not start.

The admin is only created when the user store is empty (zero users). On subsequent restarts, the config is ignored and the existing users are untouched. If all users are deleted and the config is still present, the admin is re-created on the next restart.

If the password is shorter than 8 characters or the user store is unwritable, the server exits with a non-zero code. It does not fall back to the setup page.

The server emits a warning at startup if the password matches a known weak value (`password`, `changeme`, `admin`, `dagu`, `12345678`).

**Option B: Via the setup page (interactive)**

1. Visit the web UI — you will be redirected to the `/setup` page
2. Create your initial admin account with a username and password
3. After setup, you are automatically authenticated and redirected to the dashboard

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
  -d '{"username": "newuser", "password": "secure-pass", "role": "operator", "workspaceAccess": {"all": true}}'
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
  dagu:
    image: ghcr.io/dagucloud/dagu:latest
    environment:
      - DAGU_AUTH_MODE=builtin
      - DAGU_AUTH_TOKEN_SECRET=change-me-to-secure-random-string
      # Auto-create admin on first startup (remove after first run if desired)
      - DAGU_AUTH_BUILTIN_INITIAL_ADMIN_USERNAME=admin
      - DAGU_AUTH_BUILTIN_INITIAL_ADMIN_PASSWORD=${ADMIN_PASSWORD}
    ports:
      - "8080:8080"
    volumes:
      - dagu-data:/var/lib/dagu

volumes:
  dagu-data:
```

If `DAGU_AUTH_BUILTIN_INITIAL_ADMIN_USERNAME` and `DAGU_AUTH_BUILTIN_INITIAL_ADMIN_PASSWORD` are not set, the server shows the `/setup` page on first visit instead.

## Important Notes

- **Basic vs Builtin**: Basic auth (`auth.mode=basic`) and builtin auth (`auth.mode=builtin`) are mutually exclusive. When using builtin mode, basic auth credentials are not used.

## Security Notes

- **Token Secret**: Use a strong, random secret (at least 32 characters). This is used to sign JWT tokens.
- **Password Requirements**: Minimum 8 characters
- **Token Expiry**: Tokens expire after the configured TTL (default: 24 hours)
- **Legacy API**: The old legacy API routes have been removed. All API access uses the current `/api/v1` endpoints, which require authentication when builtin auth is enabled.
- **Terminal Access**: The web-based terminal is disabled by default. Enable with `terminal.enabled: true` only in trusted environments. See [Terminal Configuration](/server-admin/server#terminal).
- **Audit Logging**: Security events (logins, user changes, API key operations) are logged by default. See [Audit Logging](/server-admin/server#audit-logging).

## API Key Management

Builtin authentication includes API key management capabilities. API keys provide programmatic access with role-based permissions, ideal for CI/CD pipelines, automation scripts, and service-to-service communication.

If the server has an API key creation limit, existing keys above that limit keep working, but Dagu shows a warning on the API key management page and blocks new key creation until enough keys are deleted or the limit changes.

### Quick Start

```bash
# Create an API key via the API (requires admin JWT token)
curl -X POST http://localhost:8080/api/v1/api-keys \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "ci-pipeline", "role": "operator"}'

# Use the API key
curl -H "Authorization: Bearer dagu_your-api-key-here" \
  http://localhost:8080/api/v1/dags
```

### Key Features

- **Role Assignment**: Each API key has its own role (admin, manager, developer, operator, viewer)
- **Creation Limits**: Server-side key creation limits apply only to new keys
- **Usage Tracking**: See when each key was last used
- **Web UI Management**: Create and manage keys from Settings > API Keys
- **Secure Handling**: The full key is shown only once at creation

For detailed documentation, see [API Keys](api-keys).

## OIDC/SSO Login

On self-hosted Dagu, builtin + OIDC requires an active self-host license. Managed server includes authentication features by default. See the [pricing page](https://dagu.sh/pricing) for current self-host and cloud availability.

Builtin authentication supports OIDC/SSO login, allowing users to authenticate via enterprise identity providers (Google, Okta, Auth0, Keycloak, and others) while maintaining Dagu's user management and RBAC system.

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
    client_url: https://dagu.example.com
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
export DAGU_AUTH_OIDC_CLIENT_ID=your-client-id
export DAGU_AUTH_OIDC_CLIENT_SECRET=your-client-secret
export DAGU_AUTH_OIDC_CLIENT_URL=https://dagu.example.com
export DAGU_AUTH_OIDC_ISSUER=https://accounts.google.com

# Optional settings
export DAGU_AUTH_OIDC_AUTO_SIGNUP=true                    # default: true
export DAGU_AUTH_OIDC_DEFAULT_ROLE=viewer                 # default: viewer
export DAGU_AUTH_OIDC_ALLOWED_DOMAINS=company.com,other.com  # comma-separated
export DAGU_AUTH_OIDC_WHITELIST=user@example.com          # comma-separated
export DAGU_AUTH_OIDC_BUTTON_LABEL="Login with SSO"
```

### Configuration Fields

| Field | Description | Default |
|-------|-------------|---------|
| `client_id` | OAuth2 client ID from your OIDC provider | Required |
| `client_secret` | OAuth2 client secret | Required |
| `client_url` | Base URL of your Dagu instance | Required |
| `issuer` | OIDC provider URL | Required |
| `scopes` | OAuth2 scopes to request | `["openid", "profile", "email"]` |
| `auto_signup` | Auto-create users on first OIDC login | `true` |
| `allowed_domains` | Email domains allowed to authenticate | All domains |
| `whitelist` | Specific email addresses always allowed | None |
| `button_label` | Text displayed on the SSO login button | `"Login with SSO"` |
| `role_mapping.default_role` | Role assigned to new users when no mapping matches | `viewer` |

**Note**: `allowed_domains`, `whitelist`, and `scopes` can be specified as either YAML lists or comma-separated strings. This is especially useful for environment variables.

### Auto-Signup

When `auto_signup` is enabled (the default), users authenticating via OIDC for the first time are automatically created in Dagu with the role specified by `role_mapping.default_role`. This eliminates the need to pre-create user accounts.

When `auto_signup` is disabled, users must exist in Dagu before they can log in via OIDC.

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

### Role and Workspace Mapping

Map IdP groups to global roles or workspace-scoped roles during OIDC login:

```yaml
oidc:
  role_mapping:
    default_role: viewer           # Global role for an unmatched `all` fallback
    groups_claim: groups           # Claim containing user's groups
    group_mappings:
      dagu-org-admins: admin       # IdP group -> org-wide Dagu role
    workspace_mappings:
      payments-team:
        - workspace: payments
          role: developer
      sre-team:
        - workspace: infra
          role: operator
    default_workspace_access: none # all (compatible default) or none
    role_attribute_strict: false    # Deny login if no global or workspace mapping matched
    skip_org_role_sync: false       # Sync role and workspace access on every login
```

**Role Mapping Options:**

| Field | Description | Default |
|-------|-------------|---------|
| `default_role` | Global role for unmatched users when the fallback is `all` and strict mode is off | `viewer` |
| `groups_claim` | JWT claim containing group membership | `groups` |
| `group_mappings` | Map of IdP group names to Dagu roles | None |
| `workspace_mappings` | Map of IdP group names to workspace/role grant lists | None |
| `default_workspace_access` | Access for users with no global or workspace match (`all` or `none`) | `all` |
| `role_attribute_path` | jq expression for advanced role extraction | None |
| `role_attribute_strict` | Deny login when neither a global nor workspace mapping matches | `false` |
| `skip_org_role_sync` | Only assign role and workspace access on first login | `false` |

Group names are matched exactly and case-sensitively. A jq or `group_mappings` match completely replaces workspace mappings: the user receives that global role across all workspaces, even when it is lower than a role from a matching workspace grant. Do not map a catch-all group globally when workspace scoping is intended. Without a global match, all matching workspace grant lists are merged; the highest role wins when multiple groups grant the same workspace. Workspace-scoped users always have global role `viewer`, and `admin` is not valid as a workspace role.

`default_workspace_access: all` preserves the compatible behavior for unmapped users and applies `default_role`. Set it to `none` for multi-team deployments: an unmapped user is forced to global `viewer` and has no access to named workspaces. Unlabelled DAGs are still governed by the global `viewer` role, so label resources that require team isolation.

When `workspace_mappings` is non-empty, or when `default_workspace_access` is explicitly `none`, OIDC is the source of truth for workspace access. Manual API edits to an OIDC user's role or workspace access are overwritten on the next successful OIDC login. Set `skip_org_role_sync: true` to keep first-login assignments instead; the users UI then leaves role and workspace access editable. If a configured workspace does not exist, the grant remains dormant and login emits a warning; creating that workspace later activates the grant.

The JSON environment variable form is intended for container deployments:

```bash
export DAGU_AUTH_OIDC_WORKSPACE_MAPPINGS='{"payments-team":[{"workspace":"payments","role":"developer"}]}'
export DAGU_AUTH_OIDC_DEFAULT_WORKSPACE_ACCESS=none
```

**Example with jq expression:**

```yaml
role_mapping:
  default_role: viewer
  role_attribute_path: 'if (.groups | contains(["admins"])) then "admin" elif (.groups | contains(["devs"])) then "developer" else "viewer" end'
```

### How It Works

1. User clicks "Login with SSO" on the login page
2. Redirected to OIDC provider for authentication
3. After successful authentication, Dagu validates the token
4. If `auto_signup` is enabled and user doesn't exist, a new user is created
5. Role and workspace access are determined by `role_mapping`
6. User receives a JWT token for the Dagu session

Membership changes take effect when an OIDC login triggers synchronization. After a successful sync, all existing Dagu sessions observe the stored role and workspace access on their next request.

### Notes

- OIDC users are managed alongside local users in the same user database
- OIDC users can also authenticate with their Dagu password if one is set
- Admin users can manage all users (OIDC and local) from the web UI
- The callback URL is `{client_url}/oidc-callback`

## Comparison with Other Auth Methods

| Feature | Basic Auth | Builtin | Builtin + OIDC |
|---------|------------|---------|----------------|
| Multiple Users | No | Yes | Yes |
| Role-Based Access | No | Yes | Yes |
| Password Change | No | Yes | Yes |
| API Key Management | No | Yes | Yes |
| SSO/OIDC Login | No | No | Yes |
| Role Mapping from IdP | No | No | Yes |
| Self-Hosted | Yes | Yes | Yes |

Builtin mode (`auth.mode: builtin`) is the recommended authentication mode for self-hosted Dagu. Add OIDC under builtin mode when you want self-hosted SSO while retaining Dagu's user management and API key capabilities.
