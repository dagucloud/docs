# OIDC Authentication

OpenID Connect (OIDC) authentication for Boltbase using OAuth2.

## Recommended: Builtin + OIDC Mode

For most use cases, we recommend using **builtin auth mode with OIDC enabled** instead of standalone OIDC mode. This gives you:

- SSO/OIDC login convenience
- Boltbase's user management and RBAC
- API key management
- Role mapping from IdP groups
- Auto-signup for new users (enabled by default)

```yaml
auth:
  mode: builtin
  builtin:
    token:
      secret: your-jwt-secret
  oidc:
    # OIDC is auto-enabled when all required fields are set
    client_id: your-client-id
    client_secret: your-client-secret
    client_url: https://boltbase.example.com
    issuer: https://accounts.google.com
    # auto_signup defaults to true
    role_mapping:
      default_role: viewer
```

See [Builtin Authentication - OIDC/SSO Login](/configurations/authentication/builtin#oidcsso-login) for full documentation.

## Standalone OIDC Mode

> **Removed**: Standalone OIDC mode (`auth.mode: oidc`) has been removed. The valid auth modes are `none`, `basic`, and `builtin`. Use [Builtin + OIDC mode](/configurations/authentication/builtin#oidcsso-login) instead, which provides the same SSO functionality with added user management and RBAC.

Standalone OIDC mode was previously available for simple setups where you didn't need Boltbase's user management features.

**Important**: All authenticated OIDC users are granted **admin role** with full access. There is no role-based access control in this mode. Use [Builtin + OIDC mode](/configurations/authentication/builtin#oidcsso-login) if you need RBAC.

### Limitations

Standalone OIDC mode has the following limitations compared to [Builtin + OIDC mode](/configurations/authentication/builtin#oidcsso-login):

| Feature | Standalone OIDC | Builtin + OIDC |
|---------|-----------------|----------------|
| Role-based access control | No (all users are admin) | Yes (4 roles) |
| User management | No | Yes |
| Role mapping from IdP | No | Yes |
| API key management | No | Yes |
| Domain-based filtering | No | Yes |
| Configurable session TTL | No (24h fixed) | Yes |

## Configuration

### YAML Configuration

```yaml
# ~/.config/boltbase/config.yaml
auth:
  mode: oidc  # Standalone OIDC mode
  oidc:
    client_id: "your-client-id"
    client_secret: "your-client-secret"
    client_url: "http://localhost:8080"
    issuer: "https://accounts.google.com"
    scopes:
      - "openid"
      - "profile"
      - "email"
    whitelist:
      - "admin@example.com"
      - "team@example.com"
```

### Environment Variables

```bash
export BOLTBASE_AUTH_MODE=oidc
export BOLTBASE_AUTH_OIDC_CLIENT_ID="your-client-id"
export BOLTBASE_AUTH_OIDC_CLIENT_SECRET="your-client-secret"
export BOLTBASE_AUTH_OIDC_CLIENT_URL="http://localhost:8080"
export BOLTBASE_AUTH_OIDC_ISSUER="https://accounts.google.com"
export BOLTBASE_AUTH_OIDC_SCOPES="openid,profile,email"
export BOLTBASE_AUTH_OIDC_WHITELIST="admin@example.com,team@example.com"

boltbase start-all
```

## Configuration Fields

- **client_id**: OAuth2 client ID from your OIDC provider (required)
- **client_secret**: OAuth2 client secret (required)
- **client_url**: Base URL of your Boltbase instance, used for callback (required)
- **issuer**: OIDC provider URL (required)
- **scopes**: OAuth2 scopes to request (default: `["openid", "profile", "email"]`)
- **whitelist**: Email addresses allowed to authenticate (optional)

OIDC is automatically enabled when client_id, client_secret, and issuer are provided.

## Callback URL

The OIDC callback URL is automatically configured as:
```
{client_url}/oidc-callback
```

For example, if `client_url` is `http://localhost:8080`, the callback URL is:
```
http://localhost:8080/oidc-callback
```

Register this callback URL with your OIDC provider.

## How It Works

1. User accesses Boltbase web interface
2. If not authenticated, redirected to OIDC provider
3. User logs in with provider
4. Provider redirects back to Boltbase callback URL
5. Boltbase validates the token and creates a session
6. Session stored in secure cookie (24 hour validity)

## Email Whitelist

Restrict access to specific email addresses:

```yaml
auth:
  oidc:
    # ... other config ...
    whitelist:
      - "admin@company.com"
      - "team@company.com"
      - "user1@company.com"
```

Or use comma-separated format (useful for environment variables):

```bash
export BOLTBASE_AUTH_OIDC_WHITELIST="admin@company.com,team@company.com"
```

**Important:** When whitelist is set, only emails in the whitelist are allowed. If whitelist is empty or not specified, all authenticated users are allowed.

Note: Wildcard domains (e.g., `*@company.com`) are NOT supported. You must list each email address explicitly.

## Common OIDC Providers

- [Google](oidc-google) - Google Workspace/Cloud Identity
- [Auth0](oidc-auth0) - Identity platform with social login support
- [Keycloak](oidc-keycloak) - Open source identity provider

## Migrating from Standalone OIDC

If you previously used `auth.mode: oidc`, migrate to builtin + OIDC:

```yaml
auth:
  mode: builtin
  builtin:
    token:
      secret: your-jwt-secret  # auto-generated if not set
  oidc:
    client_id: "your-client-id"
    client_secret: "your-client-secret"
    client_url: "https://boltbase.example.com"
    issuer: "https://auth.example.com"
    auto_signup: true
    role_mapping:
      default_role: viewer
```

This gives you SSO login with full user management, RBAC, and API key support.

## Session Management

- Sessions stored in secure HTTP-only cookies
- 24 hour session duration (fixed, not configurable)
- No refresh token support - users must re-authenticate after 24 hours
- No logout endpoint (close browser to end session)
- Original URL preserved through authentication flow

## Notes

- HTTPS recommended in production for secure cookies
- Provider must support OpenID Connect Discovery
- Minimum required scopes: openid, profile, email
- State and nonce parameters used for security
