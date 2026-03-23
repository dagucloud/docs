# Remote Nodes

## Multi-Environment

By setting up remote nodes, you can run workflows on different Dagu server environments (e.g., development, staging, production) in a single Dagu server Web UI.

```yaml
remote_nodes:
  - name: "development"
    api_base_url: "http://dev.internal:8080/api/v1"
    auth_type: basic
    basic_auth_username: "dev"
    basic_auth_password: "${DEV_PASSWORD}"

  - name: "staging"
    api_base_url: "https://staging.example.com/api/v1"
    auth_type: token
    auth_token: "${STAGING_TOKEN}"

  - name: "production"
    api_base_url: "https://prod.example.com/api/v1"
    auth_type: token
    auth_token: "${PROD_TOKEN}"
```

## Using API Keys for Remote Access

When remote nodes use [Builtin Authentication](/server-admin/authentication/builtin), you can use [API Keys](/server-admin/authentication/api-keys) for secure, role-based access:

```yaml
remote_nodes:
  - name: "production"
    api_base_url: "https://prod.example.com/api/v1"
    auth_type: token
    auth_token: "dagu_7Kq9mXxN3pLwR5tY2vZa8bCdEfGhJk4n6sUwXy0zA1B"
```

API keys provide fine-grained role-based permissions (admin, manager, developer, operator, viewer) and usage tracking. See [Remote Nodes Authentication](/server-admin/authentication/remote-nodes) for detailed setup instructions.

## See Also

- [Server Configuration](/server-admin/server)
- [Remote Nodes Authentication](/server-admin/authentication/remote-nodes)
- [API Keys](/server-admin/authentication/api-keys)
