# Dotenv Loading

`dotenv:` loads key-value pairs into the DAG environment before secret resolution. It is not a secret provider by itself.

Values loaded from dotenv files are normal DAG environment values. They are not masked unless a `secrets:` entry reads them through `provider: env`.

## Syntax

```yaml
# Load .env automatically by default when dotenv is omitted
steps:
  - command: ./run.sh
```

```yaml
# Load .env, then .env.production
dotenv: .env.production
```

```yaml
# Load .env, then .env.defaults, then .env.production
dotenv:
  - .env.defaults
  - .env.production
```

```yaml
# Disable dotenv loading
dotenv: []
```

When `dotenv` is omitted, Dagu builds the DAG with `dotenv: [".env"]`. When `dotenv` is set to a non-empty string or array, Dagu prepends `.env` to the configured list and removes duplicate paths while preserving order. `dotenv: []` disables dotenv loading because the final list is empty.

## File Lookup

Dagu looks up relative dotenv paths in this order:

1. The DAG `working_dir`.
2. The directory containing the DAG file, when it is different from `working_dir`.

Absolute paths and `~` paths are resolved directly.

The dotenv path string is evaluated before lookup with OS environment expansion and command substitution. For example:

```yaml
dotenv:
  - ${HOME}/.config/my-app/.env
  - "`pwd`/.env.local"
```

Missing dotenv files in a DAG are ignored. Parse errors are logged as warnings and the run continues.

For `dagu exec --dotenv <path>`, the CLI resolves the path before it creates the temporary DAG. A missing file returns an error before execution starts.

## Loading Order

Files are loaded in list order. Later files override earlier values with the same key when the runtime environment map is built.

```dotenv
# .env
API_HOST=https://staging.example.com
LOG_LEVEL=info
```

```dotenv
# .env.production
API_HOST=https://api.example.com
```

```yaml
dotenv:
  - .env.production

steps:
  - command: printenv API_HOST LOG_LEVEL
```

The effective values are:

```text
API_HOST=https://api.example.com
LOG_LEVEL=info
```

## Dotenv Values As Secrets

A dotenv value is a secret only when it is resolved through `secrets:`.

```dotenv
# .env
PROD_DB_PASSWORD=secret-from-dotenv
```

```yaml
dotenv: .env

secrets:
  - name: DB_PASSWORD
    provider: env
    key: PROD_DB_PASSWORD

steps:
  - command: ./migrate.sh
```

`DB_PASSWORD` is marked as a secret and is masked in Dagu-managed log writers. `PROD_DB_PASSWORD` remains a normal DAG environment value because it came from dotenv.

## What Dotenv Does Not Do

Dotenv values do not template `secrets[].key` or `secrets[].options`.

```dotenv
# .env
SECRET_PATH=/run/secrets/db-password
```

```yaml
dotenv: .env

secrets:
  - name: DB_PASSWORD
    provider: file
    key: ${SECRET_PATH} # literal string, not /run/secrets/db-password
```

Use a literal `file` provider path, or store the secret value itself in dotenv and read it with the `env` provider.
