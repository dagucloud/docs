# OIDC authentication

Configure OpenID Connect under builtin authentication to add SSO while retaining Dagu user management, roles, and API
keys.

::: info Deployment model and license
This page covers self-hosted Dagu. OIDC/SSO requires an active self-host license. Managed server includes authentication
features and does not use this `config.yaml` setup. See the [pricing page](https://dagu.sh/pricing) for current availability.
:::

## Before enabling OIDC

Create the first builtin administrator through `/setup` or `auth.builtin.initial_admin`. Dagu redirects OIDC login and
callback requests to `/setup` while the user store is empty. Keep this administrator as a recovery account for
identity-provider outages.

## Configuration

OIDC is enabled when `client_id`, `client_secret`, `client_url`, and `issuer` are all set. There is no separate `enabled`
field.

```yaml
auth:
  mode: builtin
  builtin:
    token:
      secret: your-secure-random-secret-key
    initial_admin:  # omit to create the administrator through /setup
      username: admin
      password: your-secure-password
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

Environment-variable configuration uses the same values:

```bash
export DAGU_AUTH_MODE=builtin
export DAGU_AUTH_TOKEN_SECRET=your-secure-random-secret-key
export DAGU_AUTH_BUILTIN_INITIAL_ADMIN_USERNAME=admin
export DAGU_AUTH_BUILTIN_INITIAL_ADMIN_PASSWORD=your-secure-password
export DAGU_AUTH_OIDC_CLIENT_ID=your-client-id
export DAGU_AUTH_OIDC_CLIENT_SECRET=your-client-secret
export DAGU_AUTH_OIDC_CLIENT_URL=https://dagu.example.com
export DAGU_AUTH_OIDC_ISSUER=https://accounts.google.com
export DAGU_AUTH_OIDC_SCOPES=openid,profile,email

dagu start-all
```

If the builtin administrator already exists, omit the two `DAGU_AUTH_BUILTIN_INITIAL_ADMIN_*` variables.

## Callback URL

Register this redirect URI with the provider:

```text
{client_url}/oidc-callback
```

For example, `https://dagu.example.com/oidc-callback`.

## User provisioning and access filters

`auto_signup` controls whether a first-time OIDC identity creates a Dagu user. It defaults to `true`. When disabled, only
OIDC identities already stored in Dagu can sign in.

Use `allowed_domains` and `whitelist` to restrict who can sign in:

```yaml
auth:
  oidc:
    allowed_domains: ["company.com"]
    whitelist: ["partner@external.com"]
```

An address is accepted when it matches either list. If neither setting is configured, any email accepted by the provider is
allowed. Environment variables use comma-separated values:

```bash
export DAGU_AUTH_OIDC_ALLOWED_DOMAINS=company.com,subsidiary.com
export DAGU_AUTH_OIDC_WHITELIST=partner@external.com
```

| Field | Purpose | Default |
|-------|---------|---------|
| `scopes` | OAuth2 scopes requested from the provider | `openid`, `profile`, `email` |
| `auto_signup` | Create users on their first OIDC login | `true` |
| `allowed_domains` | Allowed email domains | unrestricted |
| `whitelist` | Individually allowed email addresses | none |
| `button_label` | Text shown on the SSO button | `Login with SSO` |

## Role and workspace mapping

`role_mapping` can assign an organization-wide role or workspace-specific grants from IdP claims. Global mappings take
precedence over workspace mappings. When `workspace_mappings` is non-empty, set `default_workspace_access` explicitly to
`all` or `none`.

See [OIDC workspace access](./oidc-workspace-access) for evaluation order, strict mode, synchronization, and provider group
claims.

## Provider guides

- [Google](./oidc-google)
- [Auth0](./oidc-auth0)
- [Okta](./oidc-okta)
- [Microsoft Entra ID](./oidc-entra)
- [Keycloak](./oidc-keycloak)
- [Local workspace-access test with Keycloak](./oidc-workspace-access-keycloak)

## Behavior and security

- The provider must support OpenID Connect Discovery.
- Use HTTPS in production so the transient OIDC cookies are sent securely.
- Dagu validates state and nonce values during the login flow.
- OIDC users cannot use, set, or reset a Dagu password.
- Group and role changes are applied when the user completes another OIDC login, not on ordinary API requests.

## Migrate from standalone OIDC mode

Standalone `auth.mode: oidc` has been removed. Change the mode to `builtin`, configure a builtin token secret and initial
administrator, and keep the existing `auth.oidc` provider settings.

See [Builtin authentication](./builtin) for the initial administrator and token configuration.
