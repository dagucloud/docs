# Secrets

The Secrets page lets admins and managers create and rotate Dagu-managed secrets from the Web UI.

Secrets created here are referenced from DAG YAML with `ref`:

```yaml
secrets:
  - name: DB_PASSWORD
    ref: prod/db-password
```

The DAG receives `DB_PASSWORD` as an environment variable when the run starts. The plaintext value is not stored in the DAG file.

## Secret Scopes

Secrets can be global or workspace-scoped. The same ref can exist globally and in multiple workspace scopes with different values.

| Secret scope | Secrets page behavior |
| --- | --- |
| **Global** | Manage workspace-less secrets available to all DAGs as a fallback |
| **Named workspace** | Manage secrets for DAGs with `labels: [workspace=<name>]` |

When writing DAG YAML, use only the ref value:

```yaml
ref: prod/db-password
```

Do not include the scope or workspace name in the ref. A DAG in `workspace=payments` first resolves `prod/db-password` from the `payments` workspace, then from **Global** if no workspace-specific secret exists. A DAG without a workspace label resolves it from **Global**.

## Create A Secret

1. Open **Secrets** from the Web UI.
2. Select **Global** or a named workspace.
3. Click **Add Secret**.
4. Keep provider set to **Dagu Managed**.
5. Enter a ref such as `prod/db-password`. Refs use lowercase slug segments separated by `/`.
6. Enter the value and save.

The value is write-only. After saving, the API and UI return metadata such as ref, status, version, and timestamps, but not the plaintext value.

## Rotate A Secret

Use **Rotate** from the row action menu to write a new value version. New runs use the latest version. Running steps keep the environment they already received when the run started.

## Enable And Disable

Disable a secret to stop new runs from resolving it. A DAG run that references a disabled secret fails during initialization before any steps execute.

Enable the secret again when it should be usable by new runs.

## External Providers

External registry-backed providers such as Vault, Kubernetes, and cloud secret managers are request-based in the current UI. Use [Request access](https://dagu.sh/contact) to contact the Dagu team.

Existing DAG-based direct providers still work without the Web UI registry:

```yaml
secrets:
  - name: DB_PASSWORD
    provider: env
    key: PROD_DB_PASSWORD
```

See [Workflow Secrets](/writing-workflows/secrets) for the full YAML behavior and direct provider reference.

## Storage

Dagu-managed secrets are stored in Dagu's internal secret store under:

```text
<data_dir>/secrets
```

Values are encrypted at rest and versioned. The encryption key is resolved from the same data directory, so include the data directory in secure backups if you rely on Dagu-managed secrets.

## Permissions

Secret management is intended for administrative users. A user needs manager or admin permission for the selected scope before creating, rotating, enabling, disabling, or deleting secrets.

## Related

- [Workflow Secrets](/writing-workflows/secrets)
- [Workspaces](/web-ui/workspaces)
- [User Management](/server-admin/authentication/user-management)
