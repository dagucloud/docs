# `env` Provider

The `env` provider resolves one variable and injects it as a secret environment variable.

```yaml
secrets:
  - name: DB_PASSWORD
    provider: env
    key: PROD_DB_PASSWORD
```

`name` is the target variable exposed to the DAG run. `key` is the source variable to look up.

## Lookup Order

The resolver checks `key` in this order:

1. The context environment scope. During normal DAG execution, this scope starts with the Dagu process environment and then overlays DAG `env:` entries and values loaded through `dotenv:`.
2. The internal transport variable `_DAGU_PRESOLVED_SECRET_<KEY>`, used by Dagu when a parent process pre-resolves env-provider secrets for a subprocess.
3. A direct lookup in the process environment visible to the Dagu process.

If the variable is not set, resolution fails. If the variable exists and its value is an empty string, resolution succeeds with an empty value. Empty secret values are not masked.

Values are returned as-is. Whitespace, newlines, and other characters are not trimmed.

`options` are ignored by this provider.

## From Process Environment

```bash
export PROD_SLACK_TOKEN=xoxb-...
dagu start /srv/dags/notify.yaml
```

```yaml
secrets:
  - name: SLACK_TOKEN
    provider: env
    key: PROD_SLACK_TOKEN

steps:
  - command: ./notify.sh
```

The step process receives `SLACK_TOKEN`, not only `PROD_SLACK_TOKEN`.

## From Dotenv

```dotenv
# .env
PROD_API_TOKEN=token-from-dotenv
```

```yaml
working_dir: /srv/app
dotenv: .env

secrets:
  - name: API_TOKEN
    provider: env
    key: PROD_API_TOKEN

steps:
  - command: ./deploy.sh
```

Because the value is resolved through `secrets:`, `API_TOKEN` is tracked as a secret. The original dotenv variable `PROD_API_TOKEN` is not tracked as a secret unless it is also declared in `secrets:`.

## Renaming

`name` and `key` can be different.

```yaml
secrets:
  - name: DATABASE_URL
    provider: env
    key: PROD_DATABASE_URL
```

Use the same value for both fields when the source and target names should match:

```yaml
secrets:
  - name: GITHUB_TOKEN
    provider: env
    key: GITHUB_TOKEN
```

## Literal Key

`key` is not templated.

```yaml
env:
  - SOURCE_NAME: PROD_TOKEN

secrets:
  - name: TOKEN
    provider: env
    key: ${SOURCE_NAME} # looks for a variable literally named ${SOURCE_NAME}
```
