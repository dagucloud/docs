# Authentication

Configure authentication and access control for your Boltbase instance.

## Available Authentication Methods

- [Builtin Authentication](authentication/builtin) - User management with role-based access control (RBAC)
- [API Keys](authentication/api-keys) - Programmatic access with role-based permissions (requires Builtin Auth)
- [Webhooks](authentication/webhooks) - DAG-specific tokens for external integrations (requires Builtin Auth)
- [Basic Authentication](authentication/basic) - Simple username and password authentication
- [OIDC Authentication](authentication/oidc) - OpenID Connect authentication
- [TLS/HTTPS](authentication/tls) - Encrypted connections
- [Remote Nodes](authentication/remote-nodes) - Multi-instance authentication

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
```

Or via environment variables:

```bash
export BOLTBASE_AUTH_MODE=builtin
export BOLTBASE_AUTH_TOKEN_SECRET=your-secure-random-secret
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

**Recommended: Builtin + OIDC** (SSO with user management and RBAC):

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
| **Builtin + OIDC** | Enterprise SSO with RBAC, auto-signup, role mapping from IdP |
| **API Keys** | CI/CD pipelines, automation with role-based access (requires Builtin Auth) |
| **Webhooks** | External integrations (GitHub, Slack, CI/CD) to trigger specific DAGs (requires Builtin Auth) |
| **Basic** | Single user, simple setup, no user management needed |

## Environment Variables

All authentication methods support environment variable configuration. See individual authentication type documentation for details.
