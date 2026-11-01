# HashiCorp Vault Provider

The `vault` provider reads one field from a HashiCorp Vault secret response.

```yaml
secrets:
  - name: API_KEY
    provider: vault
    key: kv/data/prod/api/key
```

The resolver supports token-based client configuration. It does not implement AppRole, Kubernetes auth, AWS auth, or any Vault login flow.

## Client Settings

Global defaults are configured in Dagu `config.yaml`:

```yaml
secrets:
  vault:
    address: https://vault.example.com
    token: hvs.example
    # Optional TLS settings for a private CA or mTLS to Vault
    ca_cert: /etc/dagu/certs/vault-ca.pem
    client_cert: /etc/dagu/certs/vault-client.crt
    client_key: /etc/dagu/certs/vault-client.key
```

The same fields can be set with Dagu config environment variables:

```bash
export DAGU_SECRETS_VAULT_ADDRESS=https://vault.example.com
export DAGU_SECRETS_VAULT_TOKEN=hvs.example
export DAGU_SECRETS_VAULT_CA_CERT=/etc/dagu/certs/vault-ca.pem
export DAGU_SECRETS_VAULT_CLIENT_CERT=/etc/dagu/certs/vault-client.crt
export DAGU_SECRETS_VAULT_CLIENT_KEY=/etc/dagu/certs/vault-client.key
```

To keep the token out of the configuration, set `secrets.vault.token_file` or `DAGU_SECRETS_VAULT_TOKEN_FILE` to a file that holds it, such as a mounted Docker or Kubernetes secret. Dagu reads the file at startup. See [Secrets From Files](/server-admin/configuration#secrets-from-files).

Per-secret options override the global defaults for that secret:

```yaml
secrets:
  - name: API_KEY
    provider: vault
    key: kv/data/prod/api/key
    options:
      vault_address: https://vault-alt.example.com
      vault_token: hvs.override
      vault_ca_cert: /etc/dagu/certs/alt-vault-ca.pem
      vault_client_cert: /etc/dagu/certs/alt-vault-client.crt
      vault_client_key: /etc/dagu/certs/alt-vault-client.key
```

If no Dagu Vault address is configured, the resolver uses the HashiCorp Vault API client's default address, `https://127.0.0.1:8200`. If no Dagu Vault token is configured, Dagu creates the client without a token.

`vault_address`, `vault_token`, `vault_ca_cert`, `vault_client_cert`, `vault_client_key`, and `field` option values are literal strings. They are not expanded through DAG variables or dotenv values.

## Key Parsing

The resolver turns `key` into a Vault read path and a field name.

If `options.field` is set and not empty:

```yaml
secrets:
  - name: DB_PASSWORD
    provider: vault
    key: kv/data/prod/db
    options:
      field: password
```

Dagu reads path `kv/data/prod/db` and returns field `password`.

If `options.field` is not set, Dagu trims one trailing slash from `key` and splits on the last slash:

```yaml
secrets:
  - name: DB_PASSWORD
    provider: vault
    key: kv/data/prod/db/password
```

Dagu reads path `kv/data/prod/db` and returns field `password`.

If `key` has no slash, Dagu reads that path and returns field `value`:

```yaml
secrets:
  - name: TOKEN
    provider: vault
    key: app-token
```

Dagu reads path `app-token` and returns field `value`.

## KV v1 And KV v2 Responses

After reading the Vault path, Dagu checks the response data. If the top-level response contains a `data` field whose value is an object, Dagu unwraps that object before looking up the field. This matches KV v2 responses.

For KV v2, include `/data/` in the path yourself:

```yaml
secrets:
  - name: SLACK_TOKEN
    provider: vault
    key: kv/data/integrations/slack/token
```

Dagu reads Vault path `kv/data/integrations/slack`, unwraps the nested `data` object, and returns field `token`.

For KV v1, use the path as Vault exposes it:

```yaml
secrets:
  - name: SLACK_TOKEN
    provider: vault
    key: secret/integrations/slack/token
```

Dagu reads Vault path `secret/integrations/slack` and returns field `token`.

If the Vault read returns no secret, the error mentions that KV v2 paths must include `/data/` when the read path did not contain it.

## Field Values

The returned field value is converted with Go string formatting. String fields are returned unchanged. Non-string fields are converted to their textual representation.

If the field is missing, the error lists the available fields from the response data.
