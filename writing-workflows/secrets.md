# Secrets

Externalize sensitive values and let Dagu resolve them just in time. The `secrets` block defines environment variables whose values come from secret providers instead of being committed to YAML.

## Declaring secrets

Each entry in `secrets` maps a provider key to the environment variable your steps consume:

```yaml
secrets:
  - name: API_TOKEN
    provider: env
    key: PROD_API_TOKEN
  - name: DB_PASSWORD
    provider: file
    key: secrets/prod-db-password
    options:
      format: plain

steps:
  - command: ./deploy.sh
    env:
      - DATABASE_URL: postgres://user:${DB_PASSWORD}@db/prod
      - AUTH_HEADER: "Bearer ${API_TOKEN}"
```

- `name` – the environment variable injected into the DAG runtime.
- `provider` – secret backend identifier (must match a registered resolver).
- `key` – provider-specific lookup key (environment variable name, file path, cloud identifier, etc.).
- `options` – provider-specific configuration; keys and values must be strings.

Secret values override DAG-level variables and `.env` entries with the same name. Step-level `env` still has the final say if an individual step needs a different value.

## Built-in providers

### `env`

Reads from existing environment variables. Use this provider when secrets are delivered by your process manager, CI/CD pipeline, or local shell session.

```yaml
secrets:
  - name: SLACK_TOKEN
    provider: env
    key: PROD_SLACK_TOKEN
```

- Fails fast if the variable is missing (`LookupEnv` is used to distinguish unset vs empty).
- Suitable for development, CI, and any platform that can inject process env securely.

### `file`

Pulls values from files such as Kubernetes Secret Store CSI mounts or Docker secrets.

```yaml
secrets:
  - name: AWS_CREDENTIALS
    provider: file
    key: /var/run/secrets/aws/credentials
```

Relative paths search in order:

1. DAG `working_dir` (if set)
2. Directory that contains the DAG file

The first existing file wins; if none are found the run fails with a clear error.

### `vault`

Reads from Hashicrop Vault kv engine. Use this when secrets data is already being managed in a vault.

As environment variables, Provide `VAULT_ADDR` and `VAULT_TOKEN` to dagu.

or use `options`
```yaml
secrets:
  - name: SLACK_TOKEN
    provider: vault
    key: kv/data/secrets/slack_token
    options:
      vault_address: https://vault.example.com
      vault_token: hvs.DummyToken
```

Basic Usage
```yaml
secrets:
  - name: SLACK_TOKEN
    provider: vault
    key: kv/data/secrets/slack_token # <- path is kv/data/secrets, field name is slack_token
```
if use vault kv v2, require `/data/` in key.

Use the field option to override the default convention.
```yaml
secrets:
  - name: SSH_PASSWORD
    provider: vault
    key: kv/data/secrets
    options:
      field: slack_token
```

## Resolution workflow

1. It parses the `secrets` block and validates required fields and duplicate names.
2. Right before execution, the runtime resolves each secret through the registered provider.
3. Resolved values are appended to the environment after base/DAG variables.
4. Secrets are scrubbed from all output (logs, stdout, captured output) automatically.
5. For chat steps, secrets are masked before messages are sent to LLM providers.

Secrets are never persisted to disk or stored in the database. Only the resolved processes receive them.

## LLM Protection

When using chat steps with the `secrets` block, secret values are automatically masked before being sent to external LLM providers. This prevents accidental exposure of sensitive data to AI APIs:

```yaml
secrets:
  - name: DB_PASSWORD
    provider: env
    key: PROD_DB_PASSWORD

steps:
  - type: chat
    llm:
      provider: openai
      model: gpt-4o
    messages:
      - role: user
        content: "Analyze this connection string: postgres://user:${DB_PASSWORD}@db/prod"
```

In this example, `${DB_PASSWORD}` is substituted in the message for your reference, but the actual secret value is replaced with `*******` before being sent to OpenAI. The saved session history (messages.json) retains the original content for debugging purposes.
