# Authentication

Configure authentication and access control for your Dagu instance.

## Available Authentication Methods

- [Builtin Authentication](./builtin) - User management (Pro) with role-based access control (RBAC)
- [API Keys](./api-keys) - Programmatic access with role-based permissions (requires Builtin Auth)
- [Webhooks](./webhooks) - DAG-specific tokens for external integrations (requires Builtin Auth)
- [Basic Authentication](./basic) - Simple username and password authentication
- [OIDC Authentication](./oidc) - OpenID Connect authentication (Pro)
- [TLS/HTTPS](./tls) - Encrypted connections
- [Remote Nodes](./remote-nodes) - Multi-instance authentication

## Quick Start

### Builtin Authentication (Recommended)

User management with role-based access control. Supports multiple users with different roles: `admin`, `manager`, `operator`, `viewer`.

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

**Recommended: Builtin + OIDC (Pro)** (SSO with user management and RBAC):

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
    default_role: viewer
```

**Standalone OIDC** (removed — use Builtin + OIDC instead):

> Standalone OIDC mode (`auth.mode: oidc`) has been removed. Use builtin + OIDC mode above for SSO with user management.

## Choosing an Authentication Method

| Method | Use Case |
|--------|----------|
| **Builtin** | Multiple users with different permission levels, self-hosted user management |
| **Builtin + OIDC (Pro)** | Enterprise SSO with RBAC, auto-signup, role mapping from IdP |
| **API Keys** | CI/CD pipelines, automation with role-based access (requires Builtin Auth) |
| **Webhooks** | External integrations (GitHub, Slack, CI/CD) to trigger specific DAGs (requires Builtin Auth) |
| **Basic** | Single user, simple setup, no user management needed |

## Environment Variables

All authentication methods support environment variable configuration. See individual authentication type documentation for details.
