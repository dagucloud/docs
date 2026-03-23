# Authentication

Configure authentication and access control for your Dagu instance.

::: info Deployment Model
These pages focus on configuring self-hosted Dagu. Hosted Dagu Cloud includes managed user authentication, user management, OIDC/SSO, and audit logging by default, so you typically do not need to configure those features manually there. See the [pricing page](https://dagu.sh/pricing) for current self-host and cloud availability.
:::

## Available Authentication Methods

- [Builtin Authentication](./builtin) - Recommended self-host auth mode with JWT login, API keys, and role-based access
- [API Keys](./api-keys) - Programmatic access with role-based permissions (requires Builtin Auth)
- [Webhooks](./webhooks) - DAG-specific tokens for external integrations (requires Builtin Auth)
- [Basic Authentication](./basic) - Simple username and password authentication
- [OIDC Authentication](./oidc) - OpenID Connect / SSO under builtin auth
- [TLS/HTTPS](./tls) - Encrypted connections
- [Remote Nodes](./remote-nodes) - Multi-instance authentication

## Quick Start

### Builtin Authentication (Recommended)

Builtin auth is the recommended authentication mode for self-hosted Dagu. It supports JWT-based login, initial admin bootstrap, password changes, API keys, and the role-based access model used by self-hosted Dagu. On self-hosted Dagu, creating additional users or enabling OIDC/SSO requires an active self-host license. Hosted Dagu Cloud includes those features by default. See the [pricing page](https://dagu.sh/pricing) for current self-host and cloud availability.

```yaml
auth:
  mode: builtin  # default — can be omitted
  builtin:
    token:
      secret: your-secure-random-secret  # auto-generated if not set
      ttl: 24h
    initial_admin:              # optional — skip the setup page
      username: admin
      password: your-secure-password
```

Or via environment variables:

```bash
export DAGU_AUTH_MODE=builtin
export DAGU_AUTH_TOKEN_SECRET=your-secure-random-secret
# Optional — auto-create admin on first startup
export DAGU_AUTH_BUILTIN_INITIAL_ADMIN_USERNAME=admin
export DAGU_AUTH_BUILTIN_INITIAL_ADMIN_PASSWORD=your-secure-password
```

### Basic Authentication

Simple single-user authentication without user management.

```yaml
auth:
  mode: basic
  basic:
    username: admin
    password: secure-password
```

### OIDC Authentication

**Recommended: Builtin + OIDC** for self-hosted SSO:

On self-hosted Dagu, OIDC/SSO login requires an active self-host license. Hosted Dagu Cloud includes authentication features by default. See the [pricing page](https://dagu.sh/pricing) for current self-host and cloud availability.

```yaml
auth:
  mode: builtin
  builtin:
    token:
      secret: your-jwt-secret
  oidc:
    client_id: "your-client-id"
    client_secret: "your-client-secret"
    client_url: "http://localhost:8080"
    issuer: "https://accounts.google.com"
    auto_signup: true
    role_mapping:
      default_role: viewer
```

**Standalone OIDC** (removed — use Builtin + OIDC instead):

> Standalone OIDC mode (`auth.mode: oidc`) has been removed. Use builtin + OIDC mode above for SSO with user management.

## Choosing an Authentication Method

| Method | Use Case |
|--------|----------|
| **Builtin** | Self-hosted JWT login, admin bootstrap, password changes, and API keys |
| **Builtin + OIDC** | Self-hosted SSO with auto-signup and role mapping; requires a self-host license on self-hosted Dagu and is included in Dagu Cloud |
| **API Keys** | CI/CD pipelines, automation with role-based access (requires Builtin Auth) |
| **Webhooks** | External integrations (GitHub, Slack, CI/CD) to trigger specific DAGs (requires Builtin Auth) |
| **Basic** | Single user, simple setup, no user management needed |

## Environment Variables

All authentication methods support environment variable configuration. See individual authentication type documentation for details.
