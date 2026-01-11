# OIDC Authentication

OpenID Connect (OIDC) authentication for Dagu using OAuth2.

## Recommended: Builtin + OIDC Mode

For most use cases, we recommend using **builtin auth mode with OIDC enabled** instead of standalone OIDC mode. This gives you:

- SSO/OIDC login convenience
- Dagu's user management and RBAC
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
    clientId: your-client-id
    clientSecret: your-client-secret
    clientUrl: https://dagu.example.com
    issuer: https://accounts.google.com
    # autoSignup defaults to true
    roleMapping:
      defaultRole: viewer
```

See [Builtin Authentication - OIDC/SSO Login](/configurations/authentication/builtin#oidcsso-login) for full documentation.

## Standalone OIDC Mode

Standalone OIDC mode (`auth.mode: oidc`) is available for simple setups where you don't need Dagu's user management features.

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
# ~/.config/dagu/config.yaml
auth:
  mode: oidc  # Standalone OIDC mode
  oidc:
    clientId: "your-client-id"
    clientSecret: "your-client-secret"
    clientUrl: "http://localhost:8080"
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
export DAGU_AUTH_MODE=oidc
export DAGU_AUTH_OIDC_CLIENT_ID="your-client-id"
export DAGU_AUTH_OIDC_CLIENT_SECRET="your-client-secret"
export DAGU_AUTH_OIDC_CLIENT_URL="http://localhost:8080"
export DAGU_AUTH_OIDC_ISSUER="https://accounts.google.com"
export DAGU_AUTH_OIDC_SCOPES="openid,profile,email"
export DAGU_AUTH_OIDC_WHITELIST="admin@example.com,team@example.com"

dagu start-all
```

## Configuration Fields

- **clientId**: OAuth2 client ID from your OIDC provider (required)
- **clientSecret**: OAuth2 client secret (required)  
- **clientUrl**: Base URL of your Dagu instance, used for callback (required)
- **issuer**: OIDC provider URL (required)
- **scopes**: OAuth2 scopes to request (default: `["openid", "profile", "email"]`)
- **whitelist**: Email addresses allowed to authenticate (optional)

OIDC is automatically enabled when clientId, clientSecret, and issuer are provided.

## Callback URL

The OIDC callback URL is automatically configured as:
```
{clientUrl}/oidc-callback
```

For example, if `clientUrl` is `http://localhost:8080`, the callback URL is:
```
http://localhost:8080/oidc-callback
```

Register this callback URL with your OIDC provider.

## How It Works

1. User accesses Dagu web interface
2. If not authenticated, redirected to OIDC provider
3. User logs in with provider
4. Provider redirects back to Dagu callback URL
5. Dagu validates the token and creates a session
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
export DAGU_AUTH_OIDC_WHITELIST="admin@company.com,team@company.com"
```

**Important:** When whitelist is set, only emails in the whitelist are allowed. If whitelist is empty or not specified, all authenticated users are allowed.

Note: Wildcard domains (e.g., `*@company.com`) are NOT supported. You must list each email address explicitly.

## Common OIDC Providers

- [Google](oidc-google) - Google Workspace/Cloud Identity
- [Auth0](oidc-auth0) - Identity platform with social login support
- [Keycloak](oidc-keycloak) - Open source identity provider

## Multiple Authentication Methods

In standalone OIDC mode, you can combine OIDC with token auth for API access:

```yaml
auth:
  mode: oidc
  # OIDC for web UI
  oidc:
    clientId: "web-client"
    clientSecret: "secret"
    clientUrl: "https://dagu.example.com"
    issuer: "https://auth.example.com"

  # Token for API access (works alongside OIDC)
  token:
    value: "api-token"
```

For full user management with SSO, consider using [Builtin + OIDC mode](/configurations/authentication/builtin#oidcsso-login) instead.

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
