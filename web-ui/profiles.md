# Profiles

The Profiles page manages runtime profiles: named sets of variables and secrets that can be selected when starting or enqueueing a DAG run.

Use profiles when the same DAG should run against different environments without changing the DAG YAML. For example, a single workflow can run with the `dev`, `staging`, or `prod` profile.

## What A Profile Contains

Each profile has:

| Field | Meaning |
| --- | --- |
| Name | The runtime profile name selected at run start |
| Status | `active` profiles can be used; `disabled` profiles cannot start new runs |
| Protected | Admin-only profile for higher-risk credentials or production environments |
| Entries | Variables and secrets injected into runs that select the profile |

Variables store plain values. Secrets store write-only Dagu-managed secret values. Secret values are not shown again after saving.

## Create A Profile

1. Open **Profiles**.
2. Click **Add Profile**.
3. Enter a lowercase profile name such as `prod`.
4. Add an optional description.
5. Enable **Protected** only when the profile should be admin-only.
6. Save the profile.

Managers can manage non-protected profiles. Admins are required to create, view, update, delete, or use protected profiles.

## Add Entries

Use the entries table on a profile row to add or update values:

- Choose **Variable** for non-sensitive values such as `LOG_LEVEL` or `REGION`.
- Choose **Secret** for credentials such as `API_TOKEN`, `DATABASE_URL`, or cloud keys.

Entry keys must be valid environment variable names and cannot start with `DAGU_`.

Rotating a secret entry writes a new secret value. New runs and new retry attempts use the latest value resolved at attempt start. Already-running steps keep the environment they received when they started.

## Use A Profile

When starting or enqueueing a DAG from the Web UI, select a profile from the **Profile** field in the start dialog. If no profile is selected, the run uses only the environment, parameters, and secrets defined by the DAG and server configuration.

Run history and run details show the selected profile name when a profile was used.

## Retries

Retries always inherit the original run's profile. The retry dialog does not allow switching profiles. This keeps a failed run's retry tied to the same runtime environment identity while still resolving the latest profile values when the retry attempt starts.

## Relationship To Secrets

The standalone Secrets feature manages registry secrets referenced directly from DAG YAML with `secrets[].ref`.

Runtime profile secrets are different: they belong to a runtime profile and should be created or rotated from the Profiles page. Dagu stores their values in the managed secret store internally, but the profile remains the user-facing owner of those values.

## Related

- [Runtime Profiles](/writing-workflows/runtime-profiles)
- [Workflow Secrets](/writing-workflows/secrets)
- [Workspaces](/web-ui/workspaces)
- [User Management](/server-admin/authentication/user-management)
