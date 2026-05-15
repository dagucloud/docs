# Secrets

`secrets:` declares environment variables whose values are resolved when a DAG run starts.

Dagu supports two secret declaration styles:

1. **Registry refs** for secrets managed from Dagu's Web UI.
2. **Direct provider refs** for existing DAG-based secrets such as `env`, `file`, `kubernetes`, and `vault`.

Both styles inject a target environment variable into the run. The value is resolved before steps start and is masked in Dagu-managed logs.

## Registry Refs

Use `ref` when the secret value is managed in Dagu's secret registry:

```yaml
secrets:
  - name: DB_PASSWORD
    ref: prod/db-password
```

`name` is the environment variable exposed to steps. `ref` is the workspace-local registry key. The DAG does not store the plaintext value or provider details.

Create or rotate the value in the Web UI under **Secrets**:

1. Select **Default** or a named workspace.
2. Create a Dagu-managed secret with ref `prod/db-password`.
3. Use `ref: prod/db-password` in DAGs that belong to that same workspace.

```yaml
labels:
  - workspace=payments

secrets:
  - name: DB_PASSWORD
    ref: prod/db-password

steps:
  - name: migrate
    run: ./migrate.sh
```

Refs are **workspace-local**. A DAG in `workspace=payments` can resolve only secrets stored in the `payments` workspace. A DAG without a workspace label uses the default workspace. Do not include the workspace name in `ref`; use `ref: prod/db-password`, not `ref: payments/prod/db-password`.

Registry refs currently resolve Dagu-managed secrets. External registry providers such as Vault, cloud secret managers, and Kubernetes-backed registry records are request-based and are not creatable through the secret management API yet. Use [Request access](https://dagu.sh/contact) to contact the Dagu team. Existing direct provider refs still work as described below.

## Direct Provider Refs

Use `provider` plus `key` when the DAG should fetch a secret directly from a provider at runtime:

```yaml
secrets:
  - name: DB_PASSWORD
    provider: env
    key: PROD_DB_PASSWORD
```

The current built-in direct provider registry contains:

| Provider | Source |
| --- | --- |
| `env` | A variable from the context environment scope, an internal Dagu transport variable, or the Dagu process environment |
| `file` | The complete contents of one local file |
| `kubernetes` | One data key from a Kubernetes Secret resource |
| `vault` | One field from a HashiCorp Vault secret response |

Existing DAGs that use `provider` and `key` continue to work. Direct provider refs do not require the Web UI secret registry.

```yaml
secrets:
  - name: API_TOKEN
    provider: file
    key: /run/secrets/api-token
  - name: STRIPE_WEBHOOK_SECRET
    provider: kubernetes
    key: payments/stripe-webhook-secret
    options:
      namespace: prod
```

## Secret Reference Schema

Each item must use exactly one of these shapes:

```yaml
# Registry ref
secrets:
  - name: TARGET_ENV_NAME
    ref: prod/example-secret
```

```yaml
# Direct provider ref
secrets:
  - name: TARGET_ENV_NAME
    provider: env
    key: SOURCE_ENV_NAME
    options:
      option_name: option_value
```

| Field | Required | Meaning |
| --- | --- | --- |
| `name` | Yes | Target environment variable injected into the run |
| `ref` | Required for registry refs | Workspace-local registry ref, for example `prod/db-password` |
| `provider` | Required for direct provider refs | Resolver name. Built-in values are `env`, `file`, `kubernetes`, and `vault` |
| `key` | Required for direct provider refs | Provider-specific lookup key |
| `options` | Direct provider refs only | Provider-specific string map |

Validation rules:

- `name` must be a valid environment variable name.
- `name` must be unique inside the DAG.
- `name` must not start with `DAGU_`.
- `ref` must be lowercase slug segments separated by `/`, for example `prod/db-password`.
- `ref` cannot be combined with `provider`, `key`, or `options`.
- Direct provider refs require both `provider` and `key`.

Provider existence and backing secret availability are checked when the run resolves secrets. An unknown provider such as `unknown-provider` fails the run with `unknown secret provider`.

## Literal Keys And Options

`secrets[].key` and `secrets[].options` are not evaluated with Dagu's variable engine. They are passed to the direct provider as literal strings.

This does not resolve `SECRET_FILE_PATH`:

```yaml
env:
  - SECRET_FILE_PATH: /run/secrets/api-token

secrets:
  - name: API_TOKEN
    provider: file
    key: ${SECRET_FILE_PATH} # literal path, not expanded
```

To read a value loaded from `.env`, use the `env` provider:

```dotenv
# .env
PROD_API_TOKEN=token-from-dotenv
```

```yaml
dotenv: .env

secrets:
  - name: API_TOKEN
    provider: env
    key: PROD_API_TOKEN
```

`dotenv:` is related, but it is not a secret provider. Dotenv files load normal DAG environment variables. A dotenv value becomes a masked secret only when a `secrets:` entry reads it through `provider: env`.

## Resolution Time

When a DAG run starts, Dagu:

1. Loads dotenv files into the DAG environment.
2. Resolves all entries in `secrets:`.
3. Adds resolved secret values to the run environment with source `secret`.
4. Starts steps only if secret resolution succeeds.

If any secret fails to resolve, run initialization fails and steps do not execute. `dagu dry` also resolves secrets. `dagu validate` checks YAML shape and DAG structure, but it does not contact providers and does not verify that a secret exists.

## Variable Precedence

During step execution, the environment scope is layered so later layers override earlier layers:

1. Step environment values, including evaluated `env:` entries and container env entries for the step.
2. Output variables from dependency steps.
3. Secrets.
4. DAG-level environment values, including values loaded from dotenv files, runtime metadata, and params.
5. Filtered process environment values.

This means a secret overrides DAG `env:` and dotenv values with the same name. This is allowed for backward compatibility with existing DAGs. A step-level `env:` value can still override the secret for that step.

```yaml
env:
  - DB_PASSWORD: visible-dag-env

secrets:
  - name: DB_PASSWORD
    provider: env
    key: PROD_DB_PASSWORD

steps:
  - name: uses-secret
    run: ./migrate.sh

  - name: overrides-for-one-step
    env:
      - DB_PASSWORD: local-test-password
    run: ./test.sh
```

## Storage For Dagu-Managed Secrets

Dagu-managed registry values are stored by Dagu in the internal secret store under the configured data directory:

```text
<data_dir>/secrets
```

The file-backed implementation stores secret metadata and encrypted value versions. Plaintext values are write-only through the API and Web UI: after saving, Dagu does not return the value in API responses. Values are decrypted only when a run resolves the secret.

The encryption key is resolved from the same data directory. Back up the data directory securely if you rely on Dagu-managed secrets.

## Masking

Dagu creates a masker from non-empty resolved secret values. The replacement string is `*******`.

The masker is applied to:

- Step stdout and stderr log writers.
- Step stdout and stderr redirect writers.
- Final `outputs.json` values collected from string-form `output: NAME` step outputs.
- Chat step messages immediately before they are sent to the LLM provider.

The matcher replaces exact secret values. It does not mask empty values. It also does not mask values loaded through `env:` or `dotenv:` unless those values are resolved through `secrets:`.

Masking is not a process sandbox. The step process receives the raw secret in its environment and can write it to files, databases, APIs, child processes, or output variables used by later steps.

## Provider Pages

- [Web UI Secrets](/web-ui/secrets)
- [Dotenv Loading](/writing-workflows/secrets/dotenv)
- [`env` Provider](/writing-workflows/secrets/env-provider)
- [`file` Provider](/writing-workflows/secrets/file-provider)
- [Kubernetes Provider](/writing-workflows/secrets/kubernetes-provider)
- [HashiCorp Vault Provider](/writing-workflows/secrets/vault-provider)

## Complete Example

```dotenv
# /srv/app/.env
SLACK_BOT_TOKEN=xoxb-from-dotenv
```

```yaml
working_dir: /srv/app
labels:
  - workspace=payments
dotenv: .env

secrets:
  # Dagu-managed registry secret in the payments workspace
  - name: DB_PASSWORD
    ref: prod/db-password

  # Existing direct provider secrets
  - name: SLACK_TOKEN
    provider: env
    key: SLACK_BOT_TOKEN
  - name: API_KEY
    provider: vault
    key: kv/data/prod/api/key
  - name: STRIPE_WEBHOOK_SECRET
    provider: kubernetes
    key: payments/stripe-webhook-secret
    options:
      namespace: prod

steps:
  - name: deploy
    run: ./deploy.sh
    env:
      - DATABASE_URL: postgres://app:${DB_PASSWORD}@db/prod
      - AUTH_HEADER: "Bearer ${API_KEY}"
```
