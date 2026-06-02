# Runtime Profiles

Runtime profiles let you choose a named set of environment variables and secrets when a DAG run starts. They are useful when the same DAG should run against different runtime contexts, such as `dev`, `staging`, and `prod`, without copying environment values into the DAG file.

A runtime profile is not part of the DAG YAML. It is selected at run time from the Web UI, CLI, or REST API. The selected profile name is recorded in run history, and the profile values are resolved when each run attempt starts.

## When To Use Runtime Profiles

Use runtime profiles when values are shared across many runs or when the operator should choose the environment at launch time:

- Deployment targets such as `dev`, `staging`, and `prod`.
- Shared non-secret settings such as `LOG_LEVEL`, `REGION`, or `API_BASE_URL`.
- Shared credentials that should be selected with the target environment.
- Manual or queued runs where the same DAG should run with different backing services.

Use regular DAG `env:` when a value belongs to the workflow definition itself. Use `params:` when the value is part of one run's business input, such as a date, account ID, or batch size. Use `secrets:` when the DAG should always resolve a specific secret ref from YAML.

## Profile Entries

Each profile contains entries. Each entry has an environment variable key and one of two kinds:

| Kind | Stored value | Runtime behavior |
| --- | --- | --- |
| Variable | Plain text metadata in the profile store | Injected as a normal environment variable |
| Secret | A Dagu-managed secret value | Injected as a secret environment variable and masked in logs and status output |

Profile keys must be valid environment variable names. They must start with a letter or underscore and contain only letters, numbers, and underscores. Keys beginning with `DAGU_` are reserved for Dagu-managed runtime metadata and are rejected.

Profile names must be lowercase slugs. A valid name starts with a lowercase letter or number and then uses lowercase letters, numbers, `.`, `_`, or `-`.

## Create A Profile

From the Web UI, open **Profiles** and create a profile such as `prod`. Add variables and secrets from the profile details table.

![Profiles page showing runtime profiles and their variable and secret entries](/runtime-profiles-management.png)

From the CLI, profile management is local to the configured Dagu home. Remote CLI contexts do not manage profiles; use the Web UI or REST API on the remote server instead.

```bash
dagu profile create prod --description "Production runtime settings"
dagu profile set-var prod LOG_LEVEL info
dagu profile set-var prod API_BASE_URL https://api.example.com

printf '%s\n' "$PROD_API_TOKEN" | dagu profile set-secret prod API_TOKEN --value-stdin
```

Interactive secret entry is also supported:

```bash
dagu profile set-secret prod DATABASE_URL
```

The CLI prompts for the secret value and does not echo it back.

## Start A Run With A Profile

Use `--profile` with local `start`, `enqueue`, or `dry`:

```bash
dagu start etl.yaml --profile prod -- DATE=2026-06-01
dagu enqueue etl.yaml --profile prod -- DATE=2026-06-01
dagu dry etl.yaml --profile prod
```

Remote CLI `start` and `enqueue` reject `--profile`. To start a remote run with a profile, use the Web UI profile selector or send `profileName` through the REST API:

![Start DAG dialog showing the runtime profile selector](/runtime-profile-start-dialog.png)

```bash
curl -X POST "http://localhost:8080/api/v1/dags/etl.yaml/start" \
  -H "Content-Type: application/json" \
  -d '{
        "params": "{\"DATE\":\"2026-06-01\"}",
        "profileName": "prod"
      }'
```

The same `profileName` field is accepted by start, synchronous start, enqueue, and inline DAG-run execution endpoints.

## Runtime Behavior

When a run starts, Dagu:

1. Validates that the selected profile exists and is active.
2. Resolves profile variables and profile secrets.
3. Injects variables as run-level environment variables.
4. Injects secrets as secret environment variables.
5. Records the selected profile name and non-secret entry metadata in run status.

![DAG run details showing the selected runtime profile](/runtime-profile-run-details.png)

Secret entry plaintext is write-only. API and UI responses show secret entry metadata, not the secret value.

Profile variables are run-level values. Step-level `env:` can still override them for a single step. Profile secrets are treated as secrets, so they participate in secret masking and have higher precedence than normal run-level environment values. Avoid reusing the same key across DAG `env:`, DAG `secrets:`, and runtime profiles unless the override behavior is intentional.

## Retries

Retries inherit the original run's profile name. Profile selection is immutable across retry paths, including CLI, API, queue, scheduler, worker, and sub-DAG retry flows.

The profile's current values are resolved again when the retry attempt starts. This means rotating a profile secret affects future attempts, including retries, but the retry cannot switch to a different profile.

```bash
dagu retry --run-id=20260601T143120Z etl
```

There is no `--profile` option for `dagu retry`.

## Sub-DAGs

When a DAG starts a sub-DAG through Dagu's sub-workflow execution path, the selected profile is passed to the sub-DAG run. Sub-DAG retries inherit the profile recorded on that sub-DAG run.

This keeps a root run and its child runs on the same runtime profile unless a separate top-level run is started with a different profile.

## Protected Profiles

A protected profile is intended for higher-risk credentials or production environments.

Protected profile behavior:

- Only admins can create a protected profile.
- Only admins can view, update, delete, or use a protected profile.
- Managers can manage non-protected profiles.
- A user with run permission can use an active non-protected profile by name.
- Disabled profiles cannot be used for new runs.

Protection is an authorization boundary. It is not an approval workflow or a confirmation prompt. Use audit logs and your normal change-control process for sensitive profile changes.

## Relationship To Secrets

Runtime profile secret entries use Dagu-managed secrets internally. They are different from standalone DAG YAML `secrets:` refs:

```yaml
secrets:
  - name: DB_PASSWORD
    ref: prod/db-password
```

Use standalone `secrets:` refs when the DAG should always resolve the same named secret from YAML. Use runtime profile secrets when the operator chooses the runtime environment for a run.

Do not manage profile-owned backing secrets as standalone application secrets. Create and rotate them through the Profiles page, profile CLI, or profile API so the profile entry and secret value stay consistent.

## REST API

Runtime profile endpoints are available under `/api/v1/profiles`:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/profiles` | List runtime profiles |
| `POST` | `/profiles` | Create a profile |
| `GET` | `/profiles/{profileName}` | Get one profile |
| `PATCH` | `/profiles/{profileName}` | Update description, status, or protection |
| `DELETE` | `/profiles/{profileName}` | Delete a profile |
| `PUT` | `/profiles/{profileName}/variables/{key}` | Set a plain variable entry |
| `PUT` | `/profiles/{profileName}/secrets/{key}` | Set or rotate a secret entry |
| `DELETE` | `/profiles/{profileName}/entries/{key}` | Delete an entry |

Example:

```bash
curl -X POST "http://localhost:8080/api/v1/profiles" \
  -H "Content-Type: application/json" \
  -d '{"name":"prod","description":"Production runtime settings"}'

curl -X PUT "http://localhost:8080/api/v1/profiles/prod/variables/LOG_LEVEL" \
  -H "Content-Type: application/json" \
  -d '{"value":"info"}'

curl -X PUT "http://localhost:8080/api/v1/profiles/prod/secrets/API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value":"secret-token"}'
```

Secret values are write-only. Profile responses include the secret entry key, kind, and backing secret ID, but not plaintext.

## Related Pages

- [Environment Variables](/writing-workflows/environment-variables)
- [Workflow Secrets](/writing-workflows/secrets)
- [Runtime Variables](/writing-workflows/runtime-variables)
- [Web UI Profiles](/web-ui/profiles)
