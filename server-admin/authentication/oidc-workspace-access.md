# OIDC Workspace Access

Map identity-provider groups to organization-wide roles or workspace-scoped roles when users sign in with OIDC.

This guide assumes [builtin authentication with OIDC](/server-admin/authentication/oidc) is already configured. OIDC/SSO for self-hosted Dagu requires an active self-host license.

## Configuration

The following example gives organization-wide access to Dagu administrators, limits the payments and SRE teams to their workspaces, and gives unmatched users no access to named workspaces:

```yaml
auth:
  mode: builtin
  oidc:
    role_mapping:
      groups_claim: groups
      group_mappings:
        dagu-org-admins: admin
      workspace_mappings:
        payments-team:
          - workspace: payments
            role: developer
        sre-team:
          - workspace: infra
            role: operator
      default_workspace_access: none
      role_attribute_strict: false
      skip_org_role_sync: false
```

Group names are exact and case-sensitive. Use the exact strings emitted in the ID token.

## Evaluation Order

Dagu evaluates mappings in this order:

1. A valid `role_attribute_path` result assigns that global role across all workspaces.
2. Otherwise, a matching `group_mappings` entry assigns a global role across all workspaces. If several groups match, the highest role wins.
3. Otherwise, all matching `workspace_mappings` grants are merged. If several groups grant the same workspace, the highest role wins.
4. If nothing matches and `role_attribute_strict` is `true`, login is denied.
5. If nothing matches and strict mode is off, `default_workspace_access` determines the fallback.

Role priority is `admin`, `manager`, `developer`, `operator`, then `viewer`.

::: warning Global mappings replace workspace mappings
A jq or `group_mappings` match takes precedence over every workspace mapping. The user receives the matched global role across all workspaces, even if a workspace mapping would have assigned a higher role. Do not configure a catch-all global group when workspace isolation is intended.
:::

A jq expression is evaluated before group mappings. An expression that always returns a valid role, including `viewer`, prevents both group and workspace mappings from being evaluated.

## Unmatched Users

When strict mode is off, the fallback behaves as follows:

| `default_workspace_access` | Result when no mapping matches |
|----------------------------|--------------------------------|
| `all` | Apply `default_role` across all workspaces |
| `none` | Assign global `viewer` and no named workspace grants |

`all` is the compatible default. When `workspace_mappings` is non-empty, always set `default_workspace_access` explicitly.
Omitting it uses `all`, which can silently grant every workspace to an unmatched user. `default_role` is used only for an
unmatched `all` fallback.

Use `none` when named workspaces must be isolated by default. Unlabelled DAGs remain governed by the global `viewer` role, so label resources that require workspace isolation.

Set `role_attribute_strict: true` when an unmapped user must not be allowed to sign in at all. Strict mode takes precedence over both fallback values.

::: warning Test every existing user before enabling strict mode
Strict mode applies on every OIDC login, including users that already exist in Dagu. If their current token no longer
contains a matching role or workspace group, login is denied instead of retaining their previously stored authorization.
:::

## Workspace Grant Rules

- Workspace-scoped users always have global role `viewer`.
- `admin` cannot be assigned as a workspace-scoped role.
- A group may grant access to multiple workspaces.
- Several groups may grant the same workspace; the highest role wins.
- Final grants are stored in deterministic workspace-name order.
- A workspace does not need to exist when the mapping is configured. The grant remains dormant, login emits a warning, and creating the workspace later activates it.

Example with overlapping grants:

```yaml
role_mapping:
  groups_claim: groups
  workspace_mappings:
    engineering:
      - workspace: platform
        role: developer
    on-call:
      - workspace: platform
        role: operator
      - workspace: incidents
        role: operator
  default_workspace_access: none
```

A user in both groups receives `developer` in `platform` and `operator` in `incidents`.

## Global Role Mapping

Use `group_mappings` for groups that should have organization-wide access:

```yaml
role_mapping:
  groups_claim: groups
  group_mappings:
    dagu-admins: admin
    dagu-auditors: viewer
  default_role: viewer
  default_workspace_access: none
```

For advanced claim structures, `role_attribute_path` accepts a jq expression:

```yaml
role_mapping:
  role_attribute_path: >-
    if (.groups | contains(["dagu-admins"])) then "admin"
    elif (.groups | contains(["dagu-developers"])) then "developer"
    else empty
    end
```

Returning `empty` allows evaluation to continue to `group_mappings` and `workspace_mappings`. Returning a valid role stops evaluation and grants that role globally.

## Synchronization and User Management

OIDC manages workspace access when `workspace_mappings` is non-empty or `default_workspace_access` is explicitly `none`.

With the default `skip_org_role_sync: false`:

- Role and workspace access are recomputed at every successful OIDC login.
- Manual API changes to an OIDC user's role or workspace access are overwritten at the next login.
- The users page marks the account **Managed by SSO** and makes role and workspace access read-only.
- Administrators can still rename, disable, re-enable, or delete the account.
- Existing sessions use the currently stored role and workspace access on their next request.
- An existing user is denied login if strict mapping no longer finds a match.

Dagu learns about an IdP membership change only when an OIDC login runs. Once that login stores the new authorization,
all existing Dagu sessions use it on their next request. Until another OIDC login occurs, an existing session can continue
using the last stored authorization; the next login normally occurs when its Dagu JWT expires.

Set `skip_org_role_sync: true` to keep the authorization assigned at the user's first login. Subsequent logins do not update it, and the users page leaves role and workspace access editable.

::: warning Local passwords are a separate login path
An administrator can set a Dagu password for an OIDC user. That user can then sign in through the builtin login form, which
does not fetch current IdP groups or run OIDC authorization synchronization. Do not set or reset passwords for OIDC users
when all access must pass through the identity provider. Use a separate local administrator account for recovery access.
:::

## Configuration Reference

| Field | Description | Default |
|-------|-------------|---------|
| `default_role` | Role assigned across all workspaces when no mapping matches, strict mode is off, and `default_workspace_access` is `all` | `viewer` |
| `groups_claim` | ID-token claim containing group membership | `groups` |
| `group_mappings` | IdP group names mapped to global Dagu roles | None |
| `workspace_mappings` | IdP group names mapped to workspace and role grant lists | None |
| `default_workspace_access` | Unmatched-user fallback: `all` applies `default_role` globally; `none` denies access to named workspaces | `all` |
| `role_attribute_path` | jq expression for extracting a global role | None |
| `role_attribute_strict` | Deny login when neither a global nor workspace mapping matches | `false` |
| `skip_org_role_sync` | Keep first-login authorization instead of synchronizing on subsequent logins | `false` |

## Environment Variables

Workspace mappings use a JSON object whose keys are IdP groups:

```bash
export DAGU_AUTH_OIDC_WORKSPACE_MAPPINGS='{"payments-team":[{"workspace":"payments","role":"developer"}]}'
export DAGU_AUTH_OIDC_DEFAULT_WORKSPACE_ACCESS=none
```

The JSON value must be one object. Unknown grant fields, malformed JSON, blank group names, empty grant lists, invalid workspace names, duplicate workspaces within a group, invalid roles, and workspace-scoped `admin` roles are rejected during configuration loading.

See the [configuration reference](/server-admin/reference#oidc-auth) for the remaining OIDC environment variables.

## Provider Guides

- [Test workspace access locally with Keycloak](oidc-workspace-access-keycloak)
- [Okta group claims](oidc-okta)
- [Microsoft Entra ID group claims](oidc-entra)
- [Keycloak group claims](oidc-keycloak)

## Rollout Checklist

1. Decode a real test login's ID token and record the exact group values.
2. Configure only the groups Dagu needs.
3. Explicitly set `default_workspace_access` when using `workspace_mappings`, and decide whether unmatched users should receive all workspaces or no named workspaces.
4. Avoid catch-all global mappings when workspace isolation is required.
5. Before enabling strict mode, test every existing OIDC user and confirm each token contains a matching value.
6. Test a globally mapped user, each workspace group, overlapping groups, an unmapped user, malformed group claims, and membership revocation.
7. Confirm unlabelled resources do not contain data that requires workspace isolation.
8. If IdP-only login is required, confirm OIDC users do not have Dagu passwords and keep recovery access in a separate local administrator account.
