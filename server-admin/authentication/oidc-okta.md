# Okta OIDC Group Access

Configure Okta group claims so Dagu can assign workspace-scoped roles during OIDC login.

## Configure the Group Claim

On the Dagu OIDC application's **Sign On** tab, add an ID-token group claim:

- Name: `groups`
- Include in token type: ID Token
- Filter: limit the result to groups used by Dagu

Use a Dagu-specific prefix or allowlist instead of a production `.*` filter. Okta rejects a token request when a filtered claim matches more than 100 groups. Okta-sourced groups normally appear as an array of group-name strings; directory-sourced groups may require an expression or static allowlist.

Add `groups` to Dagu's requested scopes and map the emitted names exactly:

```yaml
auth:
  oidc:
    scopes: [openid, profile, email, groups]
    role_mapping:
      groups_claim: groups
      default_workspace_access: none
      workspace_mappings:
        Dagu-Payments:
          - workspace: payments
            role: developer
        Dagu-SRE:
          - workspace: infra
            role: operator
```

Decode a real test login's ID token and confirm `groups` contains the exact, case-sensitive strings used as mapping keys. Test a mapped user, multiple mapped groups, an unmapped user, and membership revocation.

See Okta's [groups claim guide](https://developer.okta.com/docs/guides/customize-tokens-groups-claim/main/) and [static allowlist guide](https://developer.okta.com/docs/guides/customize-tokens-static/main/).
