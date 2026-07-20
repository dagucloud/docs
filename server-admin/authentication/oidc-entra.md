# Microsoft Entra ID OIDC Group Access

Configure Microsoft Entra ID group claims so Dagu can assign workspace-scoped roles during OIDC login.

## Configure the Group Claim

For the Dagu app registration, open **Token configuration**, add a groups claim, and select **Groups assigned to the application**. Assign only the authorization groups Dagu needs on the corresponding Enterprise Application.

Entra emits immutable group Object IDs in the `groups` claim by default. Use those IDs directly as Dagu mapping keys:

```yaml
auth:
  oidc:
    role_mapping:
      groups_claim: groups
      default_workspace_access: none
      workspace_mappings:
        11111111-2222-3333-4444-555555555555:
          - workspace: payments
            role: developer
```

`ApplicationGroup` includes groups explicitly assigned to the app and requires direct membership; nested group membership is not included. JWT group claims have a 200-group limit. When overage occurs, Entra omits `groups` and emits a claim reference instead. Dagu does not query Microsoft Graph for that reference, so use app-assigned groups and keep `default_workspace_access: none`.

Decode a real test login's ID token and confirm `groups` contains the expected Object IDs. Test a mapped user, multiple mapped groups, an unmapped user, and membership revocation.

See Microsoft's [group claim configuration](https://learn.microsoft.com/en-us/entra/identity/hybrid/connect/how-to-connect-fed-group-claims) and [token claim reference](https://learn.microsoft.com/en-us/entra/identity-platform/access-token-claims-reference).
