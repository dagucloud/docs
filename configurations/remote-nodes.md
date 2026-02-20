# Remote Nodes

## Multi-Environment

By setting up remote nodes, you can run workflows on different Dagu server environments (e.g., development, staging, production) in a single Dagu server Web UI.

```yaml
remote_nodes:
  - name: "development"
    api_base_url: "http://dev.internal:8080/api/v1"
    is_basic_auth: true
    basic_auth_username: "dev"
    basic_auth_password: "${DEV_PASSWORD}"

  - name: "staging"
    api_base_url: "https://staging.example.com/api/v1"
    is_auth_token: true
    auth_token: "${STAGING_TOKEN}"

  - name: "production"
    api_base_url: "https://prod.example.com/api/v1"
    is_auth_token: true
    auth_token: "${PROD_TOKEN}"
```

## Using API Keys for Remote Access

When remote nodes use [Builtin Authentication](/configurations/authentication/builtin), you can use [API Keys](/configurations/authentication/api-keys) for secure, role-based access:

```yaml
remote_nodes:
  - name: "production"
    api_base_url: "https://prod.example.com/api/v1"
    is_auth_token: true
    auth_token: "dagu_7Kq9mXxN3pLwR5tY2vZa8bCdEfGhJk4n6sUwXy0zA1B"
```

API keys provide fine-grained role-based permissions (admin, manager, operator, viewer) and usage tracking. See [Remote Nodes Authentication](/configurations/authentication/remote-nodes) for detailed setup instructions.

## Secure Access using mTLS

```yaml
# mTLS configuration
remote_nodes:
  - name: "secure-prod"
    api_base_url: "https://secure.example.com/api/v1"
    tlsConfig:
      cert_file: "/etc/dagu/certs/client.crt"
      key_file: "/etc/dagu/certs/client.key"
      ca_file: "/etc/dagu/certs/ca.crt"
```

## See Also

- [Server Configuration](/configurations/server)
- [Remote Nodes Authentication](/configurations/authentication/remote-nodes)
- [API Keys](/configurations/authentication/api-keys)
