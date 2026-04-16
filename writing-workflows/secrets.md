# Secrets

`secrets:` declares environment variables whose values are resolved when a DAG run starts.

The current built-in resolver registry contains exactly these providers:

| Provider | Source |
|----------|--------|
| `env` | A variable from the context environment scope, an internal Dagu transport variable, or the Dagu process environment |
| `file` | The complete contents of one local file |
| `vault` | One field from a HashiCorp Vault secret response |

`dotenv:` is related, but it is not a secret provider. Dotenv files load normal DAG environment variables. A dotenv value becomes a masked secret only when a `secrets:` entry reads it through `provider: env`.

## Secret Reference Schema

Each `secrets:` item has this shape:

```yaml
secrets:
  - name: TARGET_ENV_NAME
    provider: env
    key: SOURCE_ENV_NAME
    options:
      option_name: option_value
```

| Field | Required | Meaning |
|-------|----------|---------|
| `name` | Yes | Target environment variable name injected into the run |
| `provider` | Yes | Resolver name. Built-in values are `env`, `file`, and `vault` |
| `key` | Yes | Provider-specific lookup key |
| `options` | No | Provider-specific string map |

At DAG build time, Dagu checks only that `name`, `provider`, and `key` are present and that `name` is unique inside the DAG. Provider existence is checked when secrets are resolved. An unknown provider such as `unknown-provider` fails the run with `unknown secret provider`.

Dagu does not currently enforce an environment-variable name pattern for `name`. Use normal environment variable names such as `DB_PASSWORD` when the value must be available to step processes.

## Literal Keys And Options

`secrets[].key` and `secrets[].options` are not evaluated with Dagu's variable engine. They are passed to the provider as literal strings.

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

## Resolution Time

When a DAG run starts, Dagu:

1. Loads dotenv files into the DAG environment.
2. Resolves all entries in `secrets:`.
3. Adds resolved secret values to the run environment with source `secret`.
4. Starts steps only if secret resolution succeeds.

If any secret fails to resolve, the run initialization fails and steps do not execute. `dagu dry` also resolves secrets. `dagu validate` checks YAML shape and DAG structure, but it does not contact providers and does not verify that a secret exists.

## Variable Precedence

During step execution, the environment scope is layered so later layers override earlier layers:

1. Step environment values, including evaluated `env:` entries and container env entries for the step.
2. Output variables from dependency steps.
3. Secrets.
4. DAG-level environment values, including values loaded from dotenv files, runtime metadata, and params.
5. Filtered process environment values.

This means a secret overrides DAG `env:` and dotenv values with the same name. A step-level `env:` value can still override the secret for that step.

```yaml
env:
  - DB_PASSWORD: visible-dag-env

secrets:
  - name: DB_PASSWORD
    provider: env
    key: PROD_DB_PASSWORD

steps:
  - name: uses-secret
    command: ./migrate.sh

  - name: overrides-for-one-step
    env:
      - DB_PASSWORD: local-test-password
    command: ./test.sh
```

## Masking

Dagu creates a masker from non-empty resolved secret values. The replacement string is `*******`.

The masker is applied to:

- Step stdout and stderr log writers.
- Step stdout and stderr redirect writers.
- Final `outputs.json` values collected from declared step outputs.
- Chat step messages immediately before they are sent to the LLM provider.

The matcher replaces exact secret values. It does not mask empty values. It also does not mask values loaded through `env:` or `dotenv:` unless those values are resolved through `secrets:`.

Masking is not a process sandbox. The step process receives the raw secret in its environment and can write it to files, databases, APIs, child processes, or output variables used by later steps.

## Provider Pages

- [Dotenv Loading](/writing-workflows/secrets/dotenv)
- [`env` Provider](/writing-workflows/secrets/env-provider)
- [`file` Provider](/writing-workflows/secrets/file-provider)
- [HashiCorp Vault Provider](/writing-workflows/secrets/vault-provider)

## Complete Example

```dotenv
# /srv/app/.env
SLACK_BOT_TOKEN=xoxb-from-dotenv
```

```yaml
working_dir: /srv/app
dotenv: .env

secrets:
  - name: SLACK_TOKEN
    provider: env
    key: SLACK_BOT_TOKEN
  - name: DB_PASSWORD
    provider: file
    key: /run/secrets/db-password
  - name: API_KEY
    provider: vault
    key: kv/data/prod/api/key

steps:
  - name: deploy
    command: ./deploy.sh
    env:
      - DATABASE_URL: postgres://app:${DB_PASSWORD}@db/prod
      - AUTH_HEADER: "Bearer ${API_KEY}"
```
