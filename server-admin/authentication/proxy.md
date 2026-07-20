# Proxy authentication

Proxy authentication lets a reverse proxy sign users in to Dagu by sending
authenticated identity headers. It is an optional login method under
`auth.mode: builtin`, so local login, OIDC, and API keys remain available.

::: danger Protect the Dagu UI service
Dagu treats the configured user header as proof of identity. Dagu does not
check the source IP of the request. If a client can reach the UI service
without passing through the authenticating proxy, that client can impersonate
another user.

Make the proxy the only network path to the UI service. Enforce this with
private service exposure, firewall rules, or a Kubernetes NetworkPolicy.
:::

Proxy authentication requires a self-host license with SSO. Managed server
authentication is configured outside `config.yaml`. See the
[pricing page](https://dagu.sh/pricing) for current availability.

## Sign-in flow

1. The user opens the Dagu login page and selects the proxy login option.
2. The authenticating proxy verifies its session and overwrites the configured
   identity headers.
3. Dagu reads those headers on `GET {base_path}/proxy-login`.
4. Dagu resolves or creates the user, applies access mappings, and issues its
   builtin JWT session.
5. The browser returns to the login page and opens the application.

With no `base_path`, the login endpoint is `GET /proxy-login`. Identity headers
have no effect on the REST API, webhooks, health checks, static assets, or any
other route. Use [API keys](./api-keys) for programmatic access.

## Requirements

- Complete builtin setup through `/setup` or `auth.builtin.initial_admin`.
  A proxy identity cannot create the first administrator.
- Keep a local builtin administrator for recovery.
- Supply a stable, unique user identifier that will not be reassigned.
- Run one Dagu UI process. The Helm chart enforces one UI replica when proxy
  authentication is enabled.
- Disable the builtin tunnel. Dagu rejects proxy authentication with
  `tunnel.enabled: true` because the tunnel creates another ingress path.
- Do not use proxy authentication with `headless: true` or an auth mode other
  than `builtin`; Dagu rejects both configurations.

## Configure Dagu

```yaml
# ~/.config/dagu/config.yaml
auth:
  mode: builtin
  proxy:
    enabled: true
    button_label: Continue with SSO
    headers:
      user: X-Auth-Request-User
      groups: X-Auth-Request-Groups
    auto_signup: true
    role_mapping:
      default_role: viewer
      default_workspace_access: none
      require_mapping: false
      skip_org_role_sync: false
      group_mappings:
        dagu-admins: admin
      workspace_mappings:
        payments-team:
          - workspace: payments
            role: developer
```

Restart Dagu after changing the configuration.

### Configuration fields

| Field | Required | Default | Purpose |
|-------|----------|---------|---------|
| `enabled` | No | `false` | Enables the login endpoint and login-page option. |
| `source` | No | empty | Distinguishes identities from different login systems. |
| `button_label` | No | `Continue with SSO` | Sets the login-page option text. |
| `headers.user` | When enabled | none | Contains the stable user identifier. |
| `headers.groups` | With group or workspace mappings | none | Contains CSV group names. |
| `auto_signup` | No | `true` | Creates users on their first proxy login. |
| `role_mapping.default_role` | No | `viewer` | Role for an unmatched user when workspace access is `all`. |
| `role_mapping.default_workspace_access` | No | `none` | Gives an unmatched user access to `all` or `none` of the named workspaces. |
| `role_mapping.require_mapping` | No | `false` | Rejects identities that match no mapping when `true`. |
| `role_mapping.skip_org_role_sync` | No | `false` | Stops access updates on later proxy logins when `true`. |
| `role_mapping.group_mappings` | No | `{}` | Maps groups to global roles. |
| `role_mapping.workspace_mappings` | No | `{}` | Maps groups to workspace grants. |

`source` and the user-header value identify the account. Leave `source` empty
when one proxy or identity provider supplies every login. Give each login
system a different `source` if two systems might send the same user value.
Changing `source` creates a different identity; it does not migrate existing
accounts.

`source` may contain up to 128 Unicode characters. It cannot contain control
characters or surrounding whitespace.

### Environment variables

Scalar fields have direct environment-variable equivalents:

```bash
DAGU_AUTH_MODE=builtin
DAGU_AUTH_PROXY_ENABLED=true
DAGU_AUTH_PROXY_SOURCE=corporate-sso
DAGU_AUTH_PROXY_BUTTON_LABEL='Continue with SSO'
DAGU_AUTH_PROXY_HEADERS_USER=X-Auth-Request-User
DAGU_AUTH_PROXY_HEADERS_GROUPS=X-Auth-Request-Groups
DAGU_AUTH_PROXY_AUTO_SIGNUP=true
DAGU_AUTH_PROXY_DEFAULT_ROLE=viewer
DAGU_AUTH_PROXY_DEFAULT_WORKSPACE_ACCESS=none
DAGU_AUTH_PROXY_REQUIRE_MAPPING=false
DAGU_AUTH_PROXY_SKIP_ORG_ROLE_SYNC=false
```

Mappings use JSON objects:

```bash
DAGU_AUTH_PROXY_GROUP_MAPPINGS='{"dagu-admins":"admin"}'
DAGU_AUTH_PROXY_WORKSPACE_MAPPINGS='{"payments-team":[{"workspace":"payments","role":"developer"}]}'
```

Invalid JSON, duplicate object keys, unknown grant fields, or trailing input
prevents startup.

## Identity header contract

The proxy must do the following for every request sent to Dagu:

1. Remove the configured user and groups headers received from the client.
2. Authenticate the request.
3. Set one user header from authenticated session data.
4. Set the groups header from authenticated session data, if configured.
5. Forward the request to a private Dagu UI service.

Confirm which upstream claim populates the user header. Do not assume that a
header named `User` contains an immutable identifier. Email addresses and
editable usernames are unsafe if the identity provider can rename or reassign
them. Dagu does not link proxy identities to existing local or OIDC users.

Header names must be valid HTTP field names. `Authorization`, `Cookie`, and
`Host` cannot be identity headers. The user and groups header names must differ.

Dagu applies these input limits:

| Input | Limit |
|-------|-------|
| User header | One value, 255 bytes |
| Groups header | 64 KiB total across all values |
| Group | 512 bytes |
| Groups | 1,000 entries before duplicate removal |

Values must be valid UTF-8 without control characters. Dagu trims surrounding
spaces and tabs. Groups are case-sensitive CSV values; quoted fields and
multiple groups-header values are supported. Duplicate groups are removed. An
empty groups header means that the user has no groups. If mappings are
configured, the groups header must be present, but it may be empty.

Dagu hides the configured identity headers from its request logs. Configure the
proxy not to log them either.

The login endpoint accepts only `GET` without a query string or request body.

## Access mapping

Dagu evaluates groups in this order:

1. A matching `group_mappings` entry grants its global role across all
   workspaces. The highest global role wins.
2. If there is no global match, Dagu merges all matching workspace grants. The
   highest role wins for each workspace.
3. With `require_mapping: true`, Dagu rejects an identity with no match.
4. Otherwise, `default_workspace_access` controls the unmatched user's access.
   `all` grants `default_role` everywhere. `none` grants no named workspaces and
   uses the top-level `viewer` role.

Role priority is `admin`, `manager`, `developer`, `operator`, then `viewer`.
`admin` cannot be scoped to one workspace. A global match takes precedence over
workspace mappings.

The defaults allow unmatched users to sign in with `viewer` and no named
workspace grants. Such users can still view unlabelled workflows in the
`default` workspace view. Workspace access limits visibility within one Dagu
installation; it is not tenant isolation.

By default, Dagu recalculates proxy-managed access on every login. Set
`skip_org_role_sync: true` to preserve later administrator changes. New users
still receive the current mapping, and `require_mapping` remains a login gate.

## Configure the authenticating proxy

Any proxy or gateway is suitable if it can authenticate requests, overwrite the
identity headers, and prevent direct access to Dagu. The exact configuration is
product-specific.

### oauth2-proxy

Use oauth2-proxy v7.15.2 or later. That release added `--trusted-proxy-ip` and
fixed authentication bypasses involving trusted proxy headers and some
`auth_request` setups. See the advisories for
[trusted proxy headers](https://github.com/oauth2-proxy/oauth2-proxy/security/advisories/GHSA-7x63-xv5r-3p2x)
and
[`auth_request`](https://github.com/oauth2-proxy/oauth2-proxy/security/advisories/GHSA-5hvv-m4w4-gf6v).

```yaml
extraArgs:
  reverse-proxy: "true"
  trusted-proxy-ip: "<gateway IP or CIDR>"
  set-xauthrequest: "true"
  oidc-groups-claim: groups
```

`set-xauthrequest` makes oauth2-proxy return `X-Auth-Request-User` and
`X-Auth-Request-Groups` from its auth endpoint. Verify that the chosen provider
puts a stable identifier in the user header.

`trusted-proxy-ip` is an oauth2-proxy setting for forwarded headers. It is not a
Dagu source-IP check. Restrict it to the gateways that can reach oauth2-proxy.
Also restrict direct access to oauth2-proxy itself.

Configure the gateway to call `/oauth2/auth`, redirect unauthenticated users to
`/oauth2/start`, and copy only the two configured identity headers to Dagu. The
gateway must overwrite client-supplied values even when the auth response omits
a header.

### Existing ingress-nginx deployments

::: warning ingress-nginx is retired
The Kubernetes project retired ingress-nginx in March 2026. It no longer
receives bug fixes or security updates. Do not choose it for a new deployment.
Use this example only while migrating an existing installation to a supported
Gateway API implementation or ingress controller. See the
[Kubernetes retirement notice](https://kubernetes.io/blog/2025/11/11/ingress-nginx-retirement/).
:::

For an existing ingress-nginx deployment, the Dagu Ingress needs these
annotations:

```yaml
metadata:
  annotations:
    nginx.ingress.kubernetes.io/auth-url: "http://oauth2-proxy.auth.svc.cluster.local/oauth2/auth"
    nginx.ingress.kubernetes.io/auth-signin: "https://$host/oauth2/start?rd=$escaped_request_uri"
    nginx.ingress.kubernetes.io/auth-response-headers: "X-Auth-Request-User,X-Auth-Request-Groups"
```

Keep oauth2-proxy's `/oauth2/start` and callback routes reachable through the
same public hostname.

## Helm and Kubernetes

The Dagu chart uses camel-case values:

```yaml
ui:
  replicas: 1

auth:
  mode: builtin
  proxy:
    enabled: true
    buttonLabel: Continue with SSO
    headers:
      user: X-Auth-Request-User
      groups: X-Auth-Request-Groups
    autoSignup: true
    roleMapping:
      defaultRole: viewer
      defaultWorkspaceAccess: none
      requireMapping: false
      skipOrgRoleSync: false
      groupMappings:
        dagu-admins: admin
      workspaceMappings: {}
```

The chart rejects proxy authentication when `ui.replicas` is not `1`, when
`auth.mode` is not `builtin`, or when `extraEnv` contains a
`DAGU_AUTH_PROXY_*` override. It uses the `Recreate` strategy for the UI
Deployment, so UI upgrades briefly interrupt browser access.

Start with the chart's
[NetworkPolicy example](https://github.com/dagu-org/dagu/blob/main/charts/dagu/examples/proxy-network-policy.yaml),
then change its namespaces and selectors. Allow the component that forwards the
application request to Dagu, not necessarily the authentication service.

Keep the UI Service as `ClusterIP`. Do not expose another `LoadBalancer`,
`NodePort`, Ingress, Gateway, or service-mesh route that bypasses authentication.

## Verify the deployment

Check these cases before exposing Dagu:

- A valid proxy session creates the expected user and access.
- A forged user or groups header is rejected or overwritten.
- An unrelated host or pod cannot reach the Dagu UI service directly.
- An unmatched identity is rejected when `require_mapping` is enabled.
- A disabled Dagu user cannot sign in.
- The local recovery administrator can use its restricted access path.

Typical `/proxy-login` responses are:

| Result | Meaning |
|--------|---------|
| Redirect to `/setup` | The first builtin administrator does not exist. |
| `400 invalid request` | The request has a query string or body. |
| `400 invalid proxy identity` | The user header is duplicated, or a value is invalid or too large. |
| `401 proxy identity unavailable` | The user header is missing or empty, or a required groups header is absent. An empty groups value is valid. |
| `403 access denied` | The license, signup policy, mapping policy, or account state denied login. |
| `404 not found` | Proxy authentication is disabled. |
| `405 method not allowed` | The endpoint received a method other than `GET`. |

## Account lifecycle

- Proxy users cannot use Dagu passwords. Password login, password change, and
  administrator reset are unavailable.
- Disabling a user blocks the next login and the next authenticated request from
  an existing session.
- Deleting a user allows the same proxy identity to be created again when
  `auto_signup` is true. Disable the user for a durable block.
- Mapping changes take effect on the next login when
  `skip_org_role_sync` is false.
- Set `auto_signup: false` after rollout to limit login to existing proxy users.

Keep the local recovery administrator behind a restricted path that removes
identity headers and denies `/proxy-login`.

## Related pages

- [Builtin authentication](./builtin)
- [User management](./user-management)
- [API keys](./api-keys)
- [TLS/HTTPS](./tls)
- [Kubernetes deployment](/server-admin/deployment/kubernetes)
