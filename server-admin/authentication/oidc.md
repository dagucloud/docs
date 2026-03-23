# OIDC Authentication

::: info Deployment Model
This page covers OIDC/SSO setup for self-hosted Dagu. On self-hosted Dagu, OIDC/SSO login requires an active [self-host license](https://dagu.sh/pricing). Hosted Dagu Cloud includes authentication features by default, so you do not configure OIDC through `config.yaml` there.
:::

OpenID Connect (OIDC) is configured under builtin auth mode.

## Recommended: Builtin + OIDC

For most self-hosted deployments, enable OIDC under builtin auth. This gives you:

- SSO/OIDC login
- Dagu user management and role-based access
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
    client_id: your-client-id
    client_secret: your-client-secret
    client_url: https://dagu.example.com
    issuer: https://accounts.google.com
    scopes: ["openid", "profile", "email"]
    auto_signup: true
    role_mapping:
      default_role: viewer
```

```bash
export DAGU_AUTH_MODE=builtin
export DAGU_AUTH_TOKEN_SECRET=your-jwt-secret
export DAGU_AUTH_OIDC_CLIENT_ID=your-client-id
export DAGU_AUTH_OIDC_CLIENT_SECRET=your-client-secret
export DAGU_AUTH_OIDC_CLIENT_URL=https://dagu.example.com
export DAGU_AUTH_OIDC_ISSUER=https://accounts.google.com
export DAGU_AUTH_OIDC_SCOPES=openid,profile,email

dagu start-all
```

OIDC is automatically enabled when the required fields (`client_id`, `client_secret`, `client_url`, `issuer`) are configured. No separate `enabled` flag is needed.

See [Builtin Authentication - OIDC/SSO Login](/server-admin/authentication/builtin#oidcsso-login) for advanced settings such as `allowed_domains`, `whitelist`, and IdP role mapping.

## Callback URL

Register this callback URL with your provider:

```txt
{client_url}/oidc-callback
```

For example:

```txt
https://dagu.example.com/oidc-callback
```

## Common OIDC Providers

- [Google](oidc-google) - Google Workspace / Cloud Identity
- [Auth0](oidc-auth0) - Hosted identity platform
- [Keycloak](oidc-keycloak) - Open source identity provider

## Removed: Standalone OIDC Mode

> Standalone OIDC mode (`auth.mode: oidc`) has been removed. Use builtin + OIDC instead.

## Migrating from Older Configs

If you previously used `auth.mode: oidc`, migrate to builtin + OIDC:

```yaml
auth:
  mode: builtin
  builtin:
    token:
      secret: your-jwt-secret
  oidc:
    client_id: your-client-id
    client_secret: your-client-secret
    client_url: https://dagu.example.com
    issuer: https://auth.example.com
    auto_signup: true
    role_mapping:
      default_role: viewer
```

This preserves SSO login while adding Dagu's user management, role-based access, and API key support.

## Notes

- HTTPS is recommended in production for secure cookies
- The provider must support OpenID Connect Discovery
- Minimum required scopes are `openid`, `profile`, and `email`
- State and nonce parameters are used to protect the login flow
