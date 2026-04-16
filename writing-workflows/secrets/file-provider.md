# `file` Provider

The `file` provider reads the complete contents of one local file and injects the result as a secret environment variable.

```yaml
secrets:
  - name: DB_PASSWORD
    provider: file
    key: /run/secrets/db-password
```

## Path Resolution

`key` is the file path.

Absolute paths are used as-is:

```yaml
secrets:
  - name: API_TOKEN
    provider: file
    key: /run/secrets/api-token
```

Relative paths are searched in this order:

1. The DAG `working_dir`, after runtime environment expansion of `working_dir`.
2. The directory containing the DAG file.

The first existing path wins. If no base directory contains the file, Dagu tries the relative path as written and returns the resulting file error.

```yaml
working_dir: /srv/app

secrets:
  - name: DB_PASSWORD
    provider: file
    key: secrets/db-password

steps:
  - command: ./migrate.sh
```

This checks `/srv/app/secrets/db-password` before the DAG file directory.

## File Contents

Dagu reads the file with `os.ReadFile` and converts the bytes to a string. The provider does not trim trailing newlines or surrounding whitespace.

If the file contains:

```text
secret-value
```

with a trailing newline, the injected value also contains that newline.

Empty files resolve to an empty secret value. Empty values are not masked.

Unknown `options` are ignored by this provider.

## Mounted Secret Example

```yaml
working_dir: /srv/app

secrets:
  - name: POSTGRES_PASSWORD
    provider: file
    key: /run/secrets/postgres-password
  - name: SERVICE_ACCOUNT_JSON
    provider: file
    key: /var/run/secrets/gcp/service-account.json

steps:
  - name: import
    command: ./import.sh
    env:
      - DATABASE_URL: postgres://etl:${POSTGRES_PASSWORD}@db/warehouse
```

The provider only reads local files visible to the Dagu process that executes the run. In distributed execution, that means the worker process must be able to read the same path.

## Literal Path

`key` is not templated.

```yaml
env:
  - SECRET_FILE: /run/secrets/token

secrets:
  - name: API_TOKEN
    provider: file
    key: ${SECRET_FILE} # literal path, not /run/secrets/token
```
