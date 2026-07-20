# Proxy authentication

Proxy authentication lets an authenticating reverse proxy establish Dagu browser sessions. The proxy authenticates the
user, removes any client-supplied identity headers, and forwards authenticated identity headers to Dagu.

::: danger Protect every route to the UI service
Dagu treats the configured user header as proof of identity. A client that can reach the UI service without passing through
the authenticating proxy can choose that header and impersonate another user. Use network policy, firewall rules, and private
service exposure to make the proxy the only network path to the UI.
:::

::: info Deployment model and license
This page covers self-hosted Dagu. Proxy authentication requires an active self-host license with SSO. Managed server
authentication is configured outside `config.yaml`. See the [pricing page](https://dagu.sh/pricing) for current availability.
:::

## How it works

Dagu reads the configured identity headers only on `GET {base_path}/proxy-login`. With no `base_path`, that is
`GET /proxy-login`. The same headers do not authenticate requests to the REST API, webhooks, health checks, static
assets, or any other route.

The browser flow is:

1. The user selects the proxy authentication option on the Dagu login page.
2. The authenticating proxy verifies its own session and sets the configured identity headers.
3. Dagu resolves or provisions the user, applies role and workspace mappings, and creates a Dagu session.
4. The browser returns to the Dagu login page, which stores the session and opens the application.

Use [API keys](./api-keys) for programmatic access. Proxy identity headers are not an API authentication mechanism.

## Before enabling it

- Complete builtin authentication setup through `/setup` or `auth.builtin.initial_admin`. A proxy identity cannot
  create the first Dagu account.
- Keep a local builtin administrator as a recovery account.
- Run exactly one UI replica. The Helm chart enforces this requirement and uses a `Recreate` deployment strategy while the
  integration is enabled.
- Ensure the proxy supplies a stable, unique, non-reassigned user identifier.
- Back up the user store before rollout. Its default location is `{data_dir}/users`.
- Disable Dagu's builtin tunnel. Dagu rejects `auth.proxy.enabled: true` together with `tunnel.enabled: true` because the
  tunnel creates another ingress path.

Proxy authentication also cannot be enabled with `headless: true` or an authentication mode other than `builtin`.

## Configure Dagu

The following example deliberately omits `source`; it is optional.

```yaml
# ~/.config/dagu/config.yaml
auth:
  mode: builtin
  proxy:
    enabled: true
    login_label: Continue with Corporate SSO
    headers:
      user: X-Auth-Request-User
      groups: X-Auth-Request-Groups
    auto_signup: true
    role_mapping:
      default_role: viewer
      default_workspace_access: none
      require_mapping: true
      skip_org_role_sync: false
      group_mappings:
        dagu-admins: admin
      workspace_mappings:
        payments-team:
          - workspace: payments
            role: developer
```

Restart Dagu after changing the configuration.

### Optional identity source

Dagu identifies an account by the pair `(source, user-header value)`. When `source` is omitted or empty, Dagu uses the
default empty namespace. This is the simplest configuration for a deployment with one stable identity authority.

Set a stable `source` when the identity needs an explicit namespace:

```yaml
auth:
  proxy:
    source: corporate-sso
```

Changing `source` makes the same user-header value resolve to a different account. It does not migrate or relink existing
accounts, so do not change it during routine proxy upgrades.

### Configuration reference

| Field | Required | Default | Purpose |
|-------|----------|---------|---------|
| `enabled` | No | `false` | Enables the proxy login endpoint and login-page option. |
| `source` | No | empty | Stable namespace combined with the user-header value to identify an account. |
| `login_label` | No | `Continue with SSO` | Text shown for the proxy authentication option on the login page. |
| `headers.user` | When enabled | none | Header containing the stable user identifier. |
| `headers.groups` | With group or workspace mappings | none | Header containing group names. |
| `auto_signup` | No | `true` | Creates an account when a proxy identity signs in for the first time. |
| `role_mapping.default_role` | No | `viewer` | Global role for an unmatched user when default workspace access is `all`. |
| `role_mapping.group_mappings` | No | `{}` | Exact proxy group names mapped to global Dagu roles. |
| `role_mapping.workspace_mappings` | No | `{}` | Exact proxy group names mapped to workspace grants. |
| `role_mapping.default_workspace_access` | No | `none` | Gives an unmatched user access to `all` or `none` of the named workspaces. |
| `role_mapping.require_mapping` | No | `true` | Denies login when no global or workspace mapping matches. At least one mapping must be configured when enabled. |
| `role_mapping.skip_org_role_sync` | No | `false` | When `true`, preserves existing role and workspace access instead of recalculating them on subsequent logins. |

The `source` value may contain up to 128 Unicode characters. It cannot have surrounding whitespace or control characters.
Header names must be valid HTTP field names. `Authorization`, `Cookie`, and `Host` cannot be used as identity headers, and
the user and groups headers must be different.

### Environment variables

Scalar settings have direct environment-variable equivalents:

```bash
export DAGU_AUTH_MODE=builtin
export DAGU_AUTH_PROXY_ENABLED=true
# DAGU_AUTH_PROXY_SOURCE is optional
export DAGU_AUTH_PROXY_LOGIN_LABEL='Continue with Corporate SSO'
export DAGU_AUTH_PROXY_HEADERS_USER=X-Auth-Request-User
export DAGU_AUTH_PROXY_HEADERS_GROUPS=X-Auth-Request-Groups
export DAGU_AUTH_PROXY_AUTO_SIGNUP=true
export DAGU_AUTH_PROXY_DEFAULT_ROLE=viewer
export DAGU_AUTH_PROXY_DEFAULT_WORKSPACE_ACCESS=none
export DAGU_AUTH_PROXY_REQUIRE_MAPPING=true
export DAGU_AUTH_PROXY_SKIP_ORG_ROLE_SYNC=false
```

Mappings use JSON objects:

```bash
export DAGU_AUTH_PROXY_GROUP_MAPPINGS='{"dagu-admins":"admin"}'
export DAGU_AUTH_PROXY_WORKSPACE_MAPPINGS='{"payments-team":[{"workspace":"payments","role":"developer"}]}'
```

Invalid JSON, duplicate object keys, unknown grant fields, or trailing input prevents server startup.

## Map groups to authorization

Group names are exact and case-sensitive. Dagu parses the groups header as CSV, including quoted CSV fields, and removes
duplicate groups before evaluating mappings.

Mapping evaluation follows these rules:

1. A matching `group_mappings` entry grants a global role across all workspaces. If several global mappings match, the
   highest role wins.
2. If no global mapping matches, all matching `workspace_mappings` grants are merged. If several groups grant the same
   workspace, the highest role wins.
3. If nothing matches and `require_mapping` is `true`, login is denied.
4. Otherwise, `default_workspace_access` controls the fallback. `all` grants `default_role` everywhere; `none` grants no
   named workspaces and keeps the top-level role at `viewer`.

Role priority is `admin`, `manager`, `developer`, `operator`, then `viewer`. An `admin` role cannot be scoped to one
workspace. A global mapping takes precedence over every workspace mapping, even when the workspace role would otherwise be
higher.

Users with no named-workspace grants can still see unlabelled workflows in the `default` workspace view. Workspace access is
data scoping within one Dagu installation, not tenant isolation.

By default, `skip_org_role_sync` is `false`, so Dagu recalculates a proxy user's role and workspace access from the current
group mappings at every login. The Web UI marks that authorization as proxy-managed; API edits remain possible, but the next
login can overwrite them. Set `skip_org_role_sync: true` to preserve the existing role and workspace access on subsequent
logins. `require_mapping` remains a login gate even when synchronization is skipped. New users always receive the current
mapping when their account is created.

## Configure the proxy trust boundary

For every request sent to Dagu, the proxy must:

1. Remove the configured user and groups headers supplied by the client.
2. Authenticate the request.
3. Set or overwrite the headers from authenticated session data.
4. Forward the request to a private Dagu UI service.

The user value is an opaque identity key. Dagu does not match it to an existing username, email address, or OIDC account.
Avoid forwarding, routing, and tenant-selection headers as identity headers, and do not log identity headers at the proxy.
Dagu redacts the configured identity headers from its request logs.

The login endpoint accepts only a `GET` request without a query string or request body. Preserve that request shape when
configuring redirects or authentication middleware.

### oauth2-proxy with ingress-nginx

oauth2-proxy's
[`--set-xauthrequest`](https://oauth2-proxy.github.io/oauth2-proxy/configuration/overview/) option returns
`X-Auth-Request-User` and `X-Auth-Request-Groups` from its auth endpoint. Configure oauth2-proxy with at least:

```yaml
extraArgs:
  reverse-proxy: "true"
  trusted-proxy-ip: "<ingress-controller IP or CIDR>"
  set-xauthrequest: "true"
  oidc-groups-claim: groups
```

Provider, cookie, redirect URL, and client-secret settings depend on the deployment. Restrict `trusted-proxy-ip` to the
ingress controllers that can reach oauth2-proxy, using the syntax supported by the installed oauth2-proxy version.

Following ingress-nginx's
[external authentication pattern](https://kubernetes.github.io/ingress-nginx/examples/auth/oauth-external-auth/), protect
the Dagu Ingress and copy only the authenticated response headers:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: dagu
  namespace: dagu
  annotations:
    nginx.ingress.kubernetes.io/auth-url: "http://oauth2-proxy.auth.svc.cluster.local/oauth2/auth"
    nginx.ingress.kubernetes.io/auth-signin: "https://$host/oauth2/start?rd=$escaped_request_uri"
    nginx.ingress.kubernetes.io/auth-response-headers: "X-Auth-Request-User,X-Auth-Request-Groups"
spec:
  ingressClassName: nginx
  rules:
    - host: dagu.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: dagu-ui
                port:
                  number: 8080
```

Confirm that the installed ingress-nginx version overwrites client request headers even when the authentication response
omits a value. Keep the UI Service private and remove every alternate Ingress, public `LoadBalancer`, `NodePort`, or service
mesh route that could bypass authentication.

## Helm configuration

The Helm chart uses camel-case values and renders the corresponding snake-case Dagu configuration:

```yaml
ui:
  replicas: 1

auth:
  mode: builtin
  proxy:
    enabled: true
    # source: corporate-sso  # optional
    loginLabel: Continue with Corporate SSO
    headers:
      user: X-Auth-Request-User
      groups: X-Auth-Request-Groups
    autoSignup: true
    roleMapping:
      defaultRole: viewer
      defaultWorkspaceAccess: none
      requireMapping: true
      skipOrgRoleSync: false
      groupMappings:
        dagu-admins: admin
      workspaceMappings:
        payments-team:
          - workspace: payments
            role: developer
```

The chart rejects proxy authentication configuration when `ui.replicas` is not `1`, when `auth.mode` is not `builtin`, or when a
`DAGU_AUTH_PROXY_*` entry in `extraEnv` could bypass those checks. Enabling the integration changes only the UI deployment to
the `Recreate` strategy, so UI upgrades have a brief interruption.

Start with the chart's
[proxy authentication NetworkPolicy example](https://github.com/dagu-org/dagu/blob/main/charts/dagu/examples/proxy-network-policy.yaml),
then adapt its namespace and ingress-controller selectors to the cluster. The correct allowed source is the component that
forwards application requests to Dagu. With ingress-nginx external authentication, that is the ingress controller, not
oauth2-proxy.

## Verify before rollout

Test the positive path and every trust boundary before exposing Dagu:

- A valid proxy session creates or resolves the expected user and applies the expected role and workspace access.
- A forged user or groups header sent to the public endpoint is rejected or overwritten by the proxy.
- Direct access to the UI service from an unrelated host or pod is denied.
- A user without a matching group mapping is denied when `require_mapping` is enabled.
- A disabled Dagu user cannot sign in even when the proxy still authenticates that identity.
- The local recovery administrator can sign in only through its restricted recovery path.

Typical endpoint responses are:

| Result | Meaning |
|--------|---------|
| Redirect to `/setup` | The first builtin administrator has not been created. |
| `400 invalid request` | The request included a query string or body. |
| `400 invalid proxy identity` | A header or request value is malformed, duplicated, or too large. |
| `401 proxy identity unavailable` | A required identity header is missing or empty. |
| `403 access denied` | The license, signup policy, mapping policy, or account state denied login. |
| `404 not found` | Proxy authentication is disabled. |
| `405 method not allowed` | The login endpoint received a method other than `GET`. |

## Account lifecycle and recovery

- Proxy users do not have Dagu passwords. Password login, change, and administrator reset are unavailable for them.
- Disabling a user blocks login and invalidates continued use of its Dagu session when the next authenticated request checks
  the account.
- Deleting a user allows the same proxy identity to be provisioned again when `auto_signup` is `true`. Disable the account
  for durable denial.
- Mapping changes take effect on the next proxy login when `skip_org_role_sync` is `false`.
- After initial rollout, `auto_signup` can be disabled to admit only identities that have already been provisioned.

Keep the local recovery administrator behind a network-restricted operator path that removes identity headers and denies
`/proxy-login`. Test that path periodically.

To roll back, remove `auth.proxy`, restore the restricted local administrator path, and then deploy the older Dagu version.
Preserve a backup of the user store during rollback.

## Related pages

- [Builtin authentication](./builtin)
- [User management](./user-management)
- [API keys](./api-keys)
- [TLS/HTTPS](./tls)
- [Kubernetes deployment](/server-admin/deployment/kubernetes)
