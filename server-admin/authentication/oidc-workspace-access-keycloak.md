# Test OIDC Workspace Access with Keycloak

Use a local Keycloak container to test OIDC group-to-workspace mappings without creating an account with a hosted identity provider.

::: info License requirement
End-to-end OIDC login on self-hosted Dagu requires an active self-host license with SSO enabled. Workspace mapping does not require a separate license beyond the OIDC/SSO feature.
:::

This guide creates:

- a Keycloak realm and confidential OIDC client
- a `groups` claim in the ID token
- one user mapped to a Dagu workspace
- one unmapped user for testing the `none` fallback and grant revocation

This setup is for local testing only. Keycloak development mode and the example credentials are not suitable for production.

## Prerequisites

- Docker
- Dagu available at `http://localhost:8080`
- an active self-host license for OIDC/SSO
- an existing Dagu workspace, or permission to create one

## 1. Start Keycloak

Run Keycloak on port `8081` so it does not conflict with Dagu:

```bash
docker run --name dagu-keycloak -d \
  -p 127.0.0.1:8081:8080 \
  -e KC_BOOTSTRAP_ADMIN_USERNAME=admin \
  -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin \
  -v dagu-keycloak-data:/opt/keycloak/data \
  quay.io/keycloak/keycloak:latest \
  start-dev
```

Open `http://localhost:8081/admin` and sign in with `admin` / `admin`.

The named volume preserves the test realm when the container stops. Use `docker stop dagu-keycloak` and `docker start dagu-keycloak` for subsequent sessions.

## 2. Create a Realm

1. Open the realm selector in the upper-left corner.
2. Choose **Create realm**.
3. Enter `dagu` as the realm name.
4. Click **Create**.

Confirm that the realm selector shows `dagu` before continuing. Clients, groups, and users created in the `master` realm are not available in the `dagu` realm.

## 3. Create the Dagu Client

1. Open **Clients**.
2. Click **Create client**.
3. Select **OpenID Connect** as the client type.
4. Enter `dagu-client` as the client ID.
5. Click **Next**.
6. Enable **Client authentication**.
7. Keep **Standard flow** enabled.
8. Click **Next**.
9. Set **Valid redirect URIs** to `http://localhost:8080/oidc-callback`.
10. Set **Web origins** to `http://localhost:8080`.
11. Click **Save**.

### Copy the Client Secret

1. Open **Clients** and select `dagu-client`.
2. Open the **Credentials** tab.
3. Copy the value under **Client secret**.

If the **Credentials** tab is missing, return to **Settings**, enable **Client authentication**, and save the client.

Regenerating the secret immediately invalidates the previous value. Update Dagu whenever the secret is regenerated.

## 4. Add Groups to the ID Token

Add a regular realm-group mapper to the client's dedicated scope:

1. Open **Clients** and select `dagu-client`.
2. Open the **Client scopes** tab in the client details.
3. Find the row described as **Dedicated scope and mappers for this client**.
4. Click the linked scope name in that row. Do not depend on it having a particular generated name.
5. Open the **Mappers** tab.
6. Click **Configure a new mapper**, or **Add mapper** > **By configuration**.
7. Select **Group Membership**. Do not select **Organization Group Membership**.
8. Configure the mapper:

| Setting | Value |
| --- | --- |
| Name | `groups` |
| Token Claim Name | `groups` |
| Full group path | Enabled |
| Add to ID token | Enabled |
| Add to access token | Enabled, optional |
| Add to userinfo | Enabled, optional |

9. Click **Save**.

With **Full group path** enabled, a top-level group named `payments-team` appears in the token as `/payments-team`. Dagu's mapping key must include the same leading slash.

## 5. Create Groups and Test Users

### Create the mapped group

1. Open **Groups**.
2. Click **Create group**.
3. Enter `payments-team`.
4. Click **Create**.

### Create a mapped user

1. Open **Users**.
2. Click **Add user**.
3. Enter `payments-user` as the username.
4. Enter an email address and enable **Email verified**.
5. Click **Create**.
6. Open **Credentials** and set a password.
7. Disable **Temporary** before saving the password.
8. Open the user's **Groups** tab.
9. Click **Join group** and select `payments-team`.

### Create an unmapped user

Repeat the user steps with the username `unmapped-user`, but do not add this user to a group. This user verifies the behavior of `default_workspace_access: none`.

## 6. Configure Dagu

Add the following to the Dagu configuration, replacing the client secret:

```yaml
auth:
  mode: builtin
  builtin:
    token:
      secret: "local-test-token-secret"
    initial_admin:
      username: admin
      password: local-admin-password
  oidc:
    client_id: dagu-client
    client_secret: "copy-from-keycloak-credentials"
    client_url: "http://localhost:8080"
    issuer: "http://localhost:8081/realms/dagu"
    scopes:
      - openid
      - profile
      - email
    role_mapping:
      groups_claim: groups
      workspace_mappings:
        /payments-team:
          - workspace: payments
            role: developer
      default_workspace_access: none
      role_attribute_strict: false
      skip_org_role_sync: false
```

Start Dagu:

```bash
dagu start-all
```

When testing a source checkout, build the current branch and run its binary instead:

```bash
make build
.local/bin/dagu start-all
```

## 7. Create the Test Workspace

Sign in with an existing Dagu administrator or the configured initial administrator.

1. Open the workspace selector.
2. Choose **New workspace**.
3. Enter `payments`.
4. Press **Enter**.

A mapping may reference a workspace that does not exist yet, but the grant remains dormant until the workspace is created.

## 8. Verify the Mapping

Use a private browser window for each test account to avoid reusing an existing Keycloak or Dagu session.

### Mapped user

1. Open `http://localhost:8080`.
2. Choose the OIDC/SSO login option.
3. Sign in as `payments-user`.
4. Confirm that the workspace selector includes `payments`.
5. Confirm that the account has `developer` permissions inside `payments` and does not receive grants for other named workspaces.

Workspace-scoped users retain the global `viewer` role. Resources without a workspace label remain governed by that global role, so use workspace-labelled workflows when checking isolation.

### Unmapped user

1. Sign out from both Dagu and Keycloak, or use another private browser session.
2. Sign in as `unmapped-user`.
3. Confirm that login succeeds.
4. Confirm that no named workspace grant is assigned.

As an administrator, open the Dagu users page and edit `unmapped-user`. The account should show **Managed by SSO**, while rename, disable, and re-enable operations remain available even though the user has no workspace grants. Password reset is not available for OIDC users; use a separate builtin administrator for recovery access.

### Grant revocation and restoration

1. In Keycloak, remove `payments-user` from `payments-team`.
2. Sign out and sign in to Dagu again as `payments-user`.
3. Confirm that the `payments` grant is removed.
4. Add the user back to `payments-team` in Keycloak.
5. Sign in to Dagu again and confirm that the grant returns.

Authorization is recomputed at successful OIDC login because `skip_org_role_sync` is `false`.
If Dagu cannot persist changed workspace authorization, it rejects the login instead of issuing a session with the previous policy.

Dagu does not observe the Keycloak membership change until that login occurs. After the login stores the new policy, any
other Dagu sessions for the same user use the updated workspace access on their next request.

## Verify the Token Claim

The generated ID token must contain the exact group path used in the Dagu configuration:

```json
{
  "groups": ["/payments-team"]
}
```

In the Keycloak client-scope view, use the token evaluation view when available, select `payments-user`, and inspect the generated ID token. A real login token is authoritative if the evaluation view differs from the configured login flow.

## Troubleshooting

### The Credentials tab is missing

Enable **Client authentication** under **Clients** > `dagu-client` > **Settings**, then save the client.

### The dedicated scope name is not visible

Open **Clients** > `dagu-client` > **Client scopes** and find the row described as **Dedicated scope and mappers for this client**. Click the link in that row; the generated name can vary.

### The `groups` claim is missing

Check all of the following:

- the mapper type is **Group Membership**
- **Add to ID token** is enabled
- the mapper is attached to `dagu-client`
- the user joined the group in the `dagu` realm
- the login used a new session after the mapper or membership changed

### Login succeeds but the workspace grant is missing

- Compare the ID-token group value with the `workspace_mappings` key exactly. Group names are case-sensitive.
- Include the leading slash when **Full group path** is enabled.
- Confirm that a `role_attribute_path` or `group_mappings` entry did not grant a global role first. Global mappings take precedence over workspace mappings.
- Confirm that the named workspace exists if the grant appears configured but remains dormant.

### A membership change is not reflected

- Sign out from Dagu and Keycloak, then start a new OIDC login. Ordinary Dagu API requests do not query Keycloak groups.
- Confirm the new ID token contains the updated `groups` claim; an existing Keycloak session may reuse older authentication state.
- If `skip_org_role_sync` is `true`, authorization is intentionally kept from the first login.

### An existing user is denied after enabling strict mode

`role_attribute_strict: true` also applies to users already stored in Dagu. Decode the user's current ID token and confirm
that at least one global or workspace mapping matches exactly. Dagu does not retain the previous authorization when strict
mapping has no match.

### The callback is rejected

Confirm that the Keycloak client allows exactly:

```text
http://localhost:8080/oidc-callback
```

## Next Steps

- [OIDC Workspace Access](oidc-workspace-access) explains evaluation order, strict mode, fallbacks, and synchronization.
- [Keycloak OIDC Setup](oidc-keycloak) covers general Keycloak deployment configuration.
- [Workspaces](/web-ui/workspaces) explains workspace creation and workflow labels.
- [Keycloak container guide](https://www.keycloak.org/server/containers) documents development and production container modes.
- [Keycloak protocol mapper reference](https://www.keycloak.org/admin-api/protocol-mappers) documents the Group Membership mapper fields.
