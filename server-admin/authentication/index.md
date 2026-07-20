# Authentication

Choose an authentication method for your Dagu instance.

::: info Deployment model
These pages cover self-hosted Dagu. Managed server includes user management and SSO, so its authentication is configured
outside `config.yaml`. See the [pricing page](https://dagu.sh/pricing) for current availability.
:::

## Choose an authentication method

| Method | Use it when |
|--------|-------------|
| [Builtin](./builtin) | You need multiple users, roles, API keys, or OIDC. This is the recommended self-hosted mode. |
| [Builtin + OIDC](./oidc) | Users should sign in through an OpenID Connect provider. Self-hosted SSO requires an active license. |
| [Basic](./basic) | A single shared account is enough and you do not need user management. |
| `none` | Authentication is handled outside Dagu or the instance is isolated. |

Builtin authentication is the default. On a new installation, create the first builtin administrator through `/setup` or
`auth.builtin.initial_admin`. Dagu requires this administrator before it allows OIDC sign-in.

## Related access controls

- [User management](./user-management) covers roles, workspace access, and password operations.
- [API keys](./api-keys) provide role-based access for automation.
- [Webhooks](./webhooks) use DAG-specific tokens for external triggers.
- [TLS/HTTPS](./tls) secures browser and API connections.
- [Remote nodes](./remote-nodes) covers authentication between Dagu instances.
