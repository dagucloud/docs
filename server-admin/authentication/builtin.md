# Builtin authentication

Builtin authentication is the default and recommended mode for self-hosted Dagu. It provides individual user accounts,
JWT sessions, role-based access, and API keys. OIDC or proxy authentication can be added without changing the
authentication mode.

::: info License requirements
Builtin login and the first administrator do not require a license. Creating, updating, and deleting additional users,
creating API keys beyond the configured limit, and enabling OIDC/SSO require an active self-host license. Managed server
includes these features. See the [pricing page](https://dagu.sh/pricing) for current availability.
:::

## Roles and workspace access

| Role | Permissions |
|------|-------------|
| `admin` | Full access, including user and API key management |
| `manager` | Create, edit, delete, run, and stop DAGs; view audit logs |
| `developer` | Create, edit, delete, run, and stop DAGs |
| `operator` | Run and stop DAGs |
| `viewer` | Read-only access to DAGs and execution history |

Workspace access can apply the role everywhere or assign roles to selected workspaces. Selected-workspace users keep the
top-level `viewer` role. Resources without a workspace label remain visible in the `default` workspace view. This is data
scoping within one Dagu installation, not tenant isolation.

See [User management](./user-management#workspace-access) for workspace access rules and API examples.

## Configuration

```yaml
# ~/.config/dagu/config.yaml
auth:
  mode: builtin  # default; may be omitted
  builtin:
    token:
      secret: your-secure-random-secret-key  # generated when omitted
      ttl: 24h
    initial_admin:  # optional; skips the setup page
      username: admin
      password: your-secure-password
```

The equivalent environment variables are:

```bash
export DAGU_AUTH_MODE=builtin
export DAGU_AUTH_TOKEN_SECRET=your-secure-random-secret-key
export DAGU_AUTH_TOKEN_TTL=24h
export DAGU_AUTH_BUILTIN_INITIAL_ADMIN_USERNAME=admin
export DAGU_AUTH_BUILTIN_INITIAL_ADMIN_PASSWORD=your-secure-password

dagu start-all
```

## Create the first administrator

On a new installation, create the first builtin administrator before anyone signs in.

### Configure the administrator at startup

Set both `initial_admin.username` and `initial_admin.password`, either in YAML or through the corresponding environment
variables shown above. Dagu creates the account only when the user store is empty. Later restarts leave existing users
unchanged.

Both fields are required together. Dagu fails to start if one is missing, the password has fewer than eight characters, or
the user store cannot be written. It also warns when the configured password is a common weak value.

### Use the setup page

If `initial_admin` is omitted, open the web UI and complete `/setup`:

1. Enter the administrator username and password.
2. Create the account.
3. Dagu signs in the new administrator and opens the dashboard.

OIDC login and callback endpoints redirect to `/setup` while the user store is empty. Keep the builtin administrator as a
recovery account for identity-provider outages.

The [user management guide](./user-management#first-admin-setup) also documents installer and API setup options.

## Token settings

Use a random token secret of at least 32 characters. Dagu uses it to sign JWTs.

`token.ttl` uses Go duration syntax. Common values include `1h`, `8h`, `24h`, and `168h`. Units can be combined, such as
`1h30m`. Days and weeks are not valid units, so use hours instead. The default is `24h`; the maximum is `8760h`.

## Sign in and manage passwords

Builtin users sign in through the web UI or `POST /api/v1/auth/login`:

```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'
```

Send the returned token in the `Authorization` header:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/v1/dags
```

Builtin passwords require at least eight characters. Builtin users can change their own password, and administrators can
reset another builtin user's password. OIDC users authenticate through their identity provider and cannot use, set, or
reset a Dagu password.

See [User management](./user-management) for web UI and API operations.

## Docker Compose example

```yaml
services:
  dagu:
    image: ghcr.io/dagucloud/dagu:latest
    environment:
      - DAGU_AUTH_MODE=builtin
      - DAGU_AUTH_TOKEN_SECRET=change-me-to-secure-random-string
      - DAGU_AUTH_BUILTIN_INITIAL_ADMIN_USERNAME=admin
      - DAGU_AUTH_BUILTIN_INITIAL_ADMIN_PASSWORD=${ADMIN_PASSWORD}
    ports:
      - "8080:8080"
    volumes:
      - dagu-data:/var/lib/dagu

volumes:
  dagu-data:
```

Remove the `initial_admin` variables after the account is created if credentials should not remain in the deployment
configuration. If they remain, Dagu ignores them while users exist.

## Security notes

- JWTs expire after `token.ttl`.
- Disabled users cannot sign in or use an existing JWT.
- The web terminal is disabled by default. Enable it only in trusted environments.
- Authentication and user-management events are written to the audit log.

## Related pages

- [User management](./user-management)
- [API keys](./api-keys)
- [OIDC authentication](./oidc)
- [Proxy authentication](./proxy)
- [OIDC workspace access](./oidc-workspace-access)
- [TLS/HTTPS](./tls)
